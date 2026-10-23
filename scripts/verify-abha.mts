/**
 * ABHA verification contract — `npm run verify:abha`
 *
 * The relay's ABDM client (server/relay/abha.ts) is checked against a stand-in
 * ABDM sandbox that implements the documented V3 flow and rejects anything the
 * Integrator Guide (v1.1.4, §1.0, §2.0, §6.2) says is required:
 *
 *   1. CONTRACT     session with clientId/clientSecret; REQUEST-ID (UUID),
 *                   TIMESTAMP (ISO 8601) and the bearer token on every call;
 *                   the documented bodies; ABHA number and OTP RSA-encrypted
 *                   with OAEP/SHA-1 so ABDM's private key recovers them exactly
 *   2. FLOW         OTP requested → verified → the account comes back; the
 *                   session token is reused, not requested per call
 *   3. REFUSALS     wrong OTP, malformed ABHA number, bad input — clear 400s
 *   4. ABUSE        OTP requests and attempts are capped (429)
 *   5. FAILURE      ABDM unreachable → 502; no credentials → 503, nothing faked
 *
 * What this cannot check is ABDM itself: with real sandbox credentials the same
 * client talks to https://abhasbx.abdm.gov.in unchanged.
 */

import crypto from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';

const { createRelay } = await import('../server/relay/app');
const { MemoryStore } = await import('../server/relay/store');
const { createAbdmClient, normaliseAbhaNumber } = await import('../server/relay/abha');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

// ── stand-in ABDM sandbox ────────────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const CLIENT = { clientId: 'SBX_TEST', clientSecret: 'sandbox-secret' };
const ABHA = '91-4819-7073-1234';
const OTP = '123456';
const ACCESS = 'access-token-' + crypto.randomUUID();
const decrypt = (b64: string) =>
    crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(b64, 'base64')).toString('utf8');

const seen = { sessions: 0, problems: [] as string[], otpRequests: 0 };
const txns = new Map<string, string>();
const body = (req: IncomingMessage) => new Promise<string>(res => { let s = ''; req.on('data', c => (s += c)); req.on('end', () => res(s)); });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const abdm = createServer(async (req, res) => {
    const send = (status: number, payload: object) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
    const raw = await body(req);
    const json = raw ? JSON.parse(raw) : {};
    if (!UUID.test(String(req.headers['request-id']))) seen.problems.push(`${req.url}: REQUEST-ID missing or not a UUID`);
    if (Number.isNaN(Date.parse(String(req.headers.timestamp))) || !String(req.headers.timestamp).includes('T')) seen.problems.push(`${req.url}: TIMESTAMP missing or not ISO 8601`);

    if (req.url === '/gateway/v3/sessions') {
        seen.sessions += 1;
        if (json.clientId !== CLIENT.clientId || json.clientSecret !== CLIENT.clientSecret) return send(401, { message: 'Invalid client' });
        return send(200, { accessToken: ACCESS, expiresIn: 1200, tokenType: 'bearer' });
    }
    if (req.headers.authorization !== `Bearer ${ACCESS}`) return send(401, { message: 'Unauthorized' });
    if (req.url === '/abha/api/v3/profile/public/certificate') {
        return send(200, { publicKey: PUBLIC_B64, encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding' });
    }
    if (req.url === '/abha/api/v3/profile/login/request/otp') {
        seen.otpRequests += 1;
        if (JSON.stringify(json.scope) !== '["abha-login","mobile-verify"]' || json.loginHint !== 'abha-number' || json.otpSystem !== 'abdm') {
            seen.problems.push(`request/otp body not as documented: ${raw}`);
            return send(400, { message: 'Bad request' });
        }
        let abha: string;
        try { abha = decrypt(json.loginId); } catch { seen.problems.push('loginId not decryptable with OAEP/SHA-1'); return send(400, { message: 'Invalid loginId' }); }
        if (abha !== ABHA) return send(400, { message: 'ABHA number not found' });
        const txnId = crypto.randomUUID();
        txns.set(txnId, abha);
        return send(200, { txnId, message: 'OTP sent to mobile number ending with ******4723' });
    }
    if (req.url === '/abha/api/v3/profile/login/verify') {
        const otp = json.authData?.otp;
        if (JSON.stringify(json.scope) !== '["abha-login","mobile-verify"]' || JSON.stringify(json.authData?.authMethods) !== '["otp"]' || !otp?.txnId) {
            seen.problems.push(`verify body not as documented: ${raw}`);
            return send(400, { message: 'Bad request' });
        }
        if (!txns.has(otp.txnId)) return send(400, { message: 'Invalid transaction' });
        let value: string;
        try { value = decrypt(otp.otpValue); } catch { seen.problems.push('otpValue not decryptable with OAEP/SHA-1'); return send(400, { message: 'Invalid OTP' }); }
        if (value !== OTP) return send(400, { message: 'Please enter a valid OTP. Entered OTP is either expired or incorrect.' });
        return send(200, {
            txnId: otp.txnId, authResult: 'success', message: 'OTP verified successfully', token: 'x', expiresIn: 1800,
            accounts: [{ ABHANumber: '91-4819-7073-XXXX', preferredAbhaAddress: 'test.citizen@sbx', name: 'Test Citizen', status: 'ACTIVE' }],
        });
    }
    return send(404, { message: 'not found' });
});
await new Promise<void>(r => abdm.listen(0, '127.0.0.1', () => r()));
const ABDM_BASE = `http://127.0.0.1:${(abdm.address() as { port: number }).port}`;

// ── relays under test ────────────────────────────────────────────────────────
async function serve(client: ReturnType<typeof createAbdmClient> | null) {
    const { app } = createRelay({ store: new MemoryStore(), secret: 's'.repeat(40), abdm: client });
    const server = createServer(app);
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    return { server, base: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
const configured = await serve(createAbdmClient({ ...CLIENT, sessionUrl: `${ABDM_BASE}/gateway/v3/sessions`, abhaBaseUrl: `${ABDM_BASE}/abha/api` }));
const unconfigured = await serve(null);
const unreachable = await serve(createAbdmClient({ ...CLIENT, sessionUrl: 'http://127.0.0.1:9/sessions', abhaBaseUrl: 'http://127.0.0.1:9/abha/api' }));
const post = (base: string, path: string, payload: unknown) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

// ---------------------------------------------------------------------------
console.log('\n1–2. CONTRACT AND FLOW');
// ---------------------------------------------------------------------------
check('ABHA numbers normalise with or without hyphens', normaliseAbhaNumber('91481970731234') === ABHA && normaliseAbhaNumber('91-4819-7073-1234') === ABHA && normaliseAbhaNumber('9148') === null);
const otpRes = await post(configured.base, '/api/abha/otp', { abhaNumber: '91481970731234' });
const otpBody = (await otpRes.json()) as { txnId?: string; message?: string };
check('an OTP is requested and a transaction id returned', otpRes.status === 200 && typeof otpBody.txnId === 'string', JSON.stringify(otpBody));
check('ABDM\'s message is passed on to the citizen', /ending with/.test(otpBody.message ?? ''));
const wrong = await post(configured.base, '/api/abha/verify', { txnId: otpBody.txnId, otp: '000000' });
check('a wrong OTP is refused with ABDM\'s reason (400)', wrong.status === 400 && /incorrect/.test(((await wrong.json()) as { error: string }).error));
const right = await post(configured.base, '/api/abha/verify', { txnId: otpBody.txnId, otp: OTP });
const rightBody = (await right.json()) as { verified?: boolean; account?: { name: string; abhaNumber: string; abhaAddress: string } };
check('the right OTP verifies and returns the account', right.status === 200 && rightBody.verified === true && rightBody.account?.name === 'Test Citizen');
check('…with ABDM\'s masked ABHA number, never the full one', rightBody.account?.abhaNumber === '91-4819-7073-XXXX');
check('every call carried REQUEST-ID, TIMESTAMP and the documented bodies; both values decrypted exactly', seen.problems.length === 0, seen.problems.join(' | '));
check('one session token served every call', seen.sessions === 1, `${seen.sessions} sessions`);

// ---------------------------------------------------------------------------
console.log('\n3. REFUSALS');
// ---------------------------------------------------------------------------
check('a malformed ABHA number is refused before ABDM is called (400)', (await post(configured.base, '/api/abha/otp', { abhaNumber: '1234' })).status === 400);
check('an ABHA number ABDM does not know is refused (400)', (await post(configured.base, '/api/abha/otp', { abhaNumber: '91-0000-0000-0000' })).status === 400);
check('a non-6-digit OTP is refused (400)', (await post(configured.base, '/api/abha/verify', { txnId: 'x', otp: '12' })).status === 400);

// ---------------------------------------------------------------------------
console.log('\n4. ABUSE');
// ---------------------------------------------------------------------------
const before = seen.otpRequests;
const codes: number[] = [];
for (let i = 0; i < 7; i++) codes.push((await post(configured.base, '/api/abha/otp', { abhaNumber: '91-4819-7073-1234' })).status);
check('OTP requests for one number are capped at 5 per 15 minutes (429 after)', codes.filter(c => c === 429).length >= 2 && seen.otpRequests - before <= 4, codes.join(','));
const txn = ((await (await post(configured.base, '/api/abha/otp', { abhaNumber: '91-4819-7073-9999' })).json()) as { txnId?: string }).txnId ?? 'none';
const attempts: number[] = [];
for (let i = 0; i < 7; i++) attempts.push((await post(configured.base, '/api/abha/verify', { txnId: txn, otp: '000000' })).status);
check('OTP guesses per transaction are capped (429 after 5)', attempts.slice(5).every(c => c === 429), attempts.join(','));

// ---------------------------------------------------------------------------
console.log('\n5. FAILURE');
// ---------------------------------------------------------------------------
const down = await post(unreachable.base, '/api/abha/otp', { abhaNumber: ABHA });
check('ABDM unreachable → 502 with a reason', down.status === 502 && /could not be reached/.test(((await down.json()) as { error: string }).error));
const none = await post(unconfigured.base, '/api/abha/otp', { abhaNumber: ABHA });
check('no ABDM credentials → 503 "not configured", nothing faked', none.status === 503 && /not configured/.test(((await none.json()) as { error: string }).error));
check('/health says whether ABHA is configured',
    ((await (await fetch(`${configured.base}/health`)).json()) as { abha: string }).abha === 'configured'
    && ((await (await fetch(`${unconfigured.base}/health`)).json()) as { abha: string }).abha === 'not configured');

[configured, unconfigured, unreachable].forEach(s => s.server.close());
abdm.close();
console.log(failures === 0 ? '\nAll ABHA verification checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
