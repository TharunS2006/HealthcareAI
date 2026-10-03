/**
 * ABHA verification through the ABDM sandbox (ABHA V3 APIs).
 *
 * Follows ABDM's "Integrator Guide – ABDM ABHA V3 APIs" (v1.1.4), §1.0 session,
 * §2.0 encryption and §6.2 "Login via ABHA OTP":
 *
 *   POST {session}                          { clientId, clientSecret } → accessToken
 *   GET  {abha}/v3/profile/public/certificate → publicKey (RSA/ECB/OAEPWithSHA-1AndMGF1Padding)
 *   POST {abha}/v3/profile/login/request/otp  { scope: [abha-login, mobile-verify],
 *                                              loginHint: abha-number, loginId: <encrypted>,
 *                                              otpSystem: abdm } → txnId
 *   POST {abha}/v3/profile/login/verify       { scope, authData: { authMethods: [otp],
 *                                              otp: { txnId, otpValue: <encrypted> } } }
 *                                              → authResult, accounts[]
 *
 * Every call carries REQUEST-ID (a UUID), TIMESTAMP (ISO 8601) and the bearer
 * access token. The client secret never leaves this server: the browser only
 * sends the ABHA number and the OTP the citizen typed.
 *
 * Credentials: ABDM_CLIENT_ID / ABDM_CLIENT_SECRET, issued to the integrator on
 * the ABDM sandbox portal. Without them every call answers "not configured" —
 * nothing is faked.
 *
 * @module server/relay/abha
 */

import crypto from 'crypto';

export interface AbdmConfig {
    clientId: string;
    clientSecret: string;
    sessionUrl: string;
    abhaBaseUrl: string;
}

export function abdmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AbdmConfig | null {
    const clientId = env.ABDM_CLIENT_ID?.trim();
    const clientSecret = env.ABDM_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    return {
        clientId,
        clientSecret,
        sessionUrl: env.ABDM_SESSION_URL?.trim() || 'https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions',
        abhaBaseUrl: (env.ABDM_ABHA_BASE_URL?.trim() || 'https://abhasbx.abdm.gov.in/abha/api').replace(/\/+$/, ''),
    };
}

/** 14 digits, with or without the 91-XXXX-XXXX-XXXX hyphens; returned hyphenated. */
export function normaliseAbhaNumber(raw: string): string | null {
    const digits = raw.replace(/[\s-]/g, '');
    if (!/^\d{14}$/.test(digits)) return null;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

export class AbdmError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export interface AbhaAccount {
    abhaNumber: string;
    abhaAddress: string | null;
    name: string;
    status: string;
}

export function createAbdmClient(config: AbdmConfig, fetchImpl: typeof fetch = fetch) {
    let session: { token: string; until: number } | null = null;
    let publicKey: { pem: string; until: number } | null = null;

    const headers = (token?: string) => ({
        'Content-Type': 'application/json',
        'REQUEST-ID': crypto.randomUUID(),
        TIMESTAMP: new Date().toISOString(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
        let response: Response;
        try {
            response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
        } catch {
            throw new AbdmError('The ABDM sandbox could not be reached', 502);
        }
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
            const detail = (body.message ?? (body.error as { message?: string } | undefined)?.message ?? body.error ?? `HTTP ${response.status}`) as string;
            // ABDM's 4xx is about the citizen's input; anything else is ours to report as unavailable.
            throw new AbdmError(String(detail), response.status >= 400 && response.status < 500 ? 400 : 502);
        }
        return body;
    }

    async function accessToken(): Promise<string> {
        if (session && session.until > Date.now()) return session.token;
        const body = await call(config.sessionUrl, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret }),
        });
        const token = body.accessToken;
        if (typeof token !== 'string') throw new AbdmError('ABDM did not issue a session token — check ABDM_CLIENT_ID / ABDM_CLIENT_SECRET', 502);
        const ttl = typeof body.expiresIn === 'number' ? body.expiresIn : 600;
        session = { token, until: Date.now() + Math.max(30, ttl - 60) * 1000 };
        return token;
    }

    async function encrypt(value: string): Promise<string> {
        if (!publicKey || publicKey.until < Date.now()) {
            const body = await call(`${config.abhaBaseUrl}/v3/profile/public/certificate`, { method: 'GET', headers: headers(await accessToken()) });
            if (typeof body.publicKey !== 'string') throw new AbdmError('ABDM did not return its public key', 502);
            const b64 = body.publicKey.replace(/\s+/g, '');
            publicKey = { pem: `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----\n`, until: Date.now() + 6 * 3600_000 };
        }
        // RSA/ECB/OAEPWithSHA-1AndMGF1Padding, as the certificate endpoint specifies.
        return crypto.publicEncrypt({ key: publicKey.pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(value, 'utf8')).toString('base64');
    }

    const SCOPE = ['abha-login', 'mobile-verify'];

    return {
        /** Ask ABDM to text an OTP to the mobile linked to this ABHA number. */
        async requestOtp(abhaNumber: string): Promise<{ txnId: string; message: string }> {
            const body = await call(`${config.abhaBaseUrl}/v3/profile/login/request/otp`, {
                method: 'POST',
                headers: headers(await accessToken()),
                body: JSON.stringify({ scope: SCOPE, loginHint: 'abha-number', loginId: await encrypt(abhaNumber), otpSystem: 'abdm' }),
            });
            if (typeof body.txnId !== 'string') throw new AbdmError('ABDM did not return a transaction id', 502);
            return { txnId: body.txnId, message: String(body.message ?? 'OTP sent to the mobile number linked to this ABHA') };
        },

        /** Check the OTP; on success, the ABHA account it unlocks. */
        async verifyOtp(txnId: string, otp: string): Promise<AbhaAccount> {
            const body = await call(`${config.abhaBaseUrl}/v3/profile/login/verify`, {
                method: 'POST',
                headers: headers(await accessToken()),
                body: JSON.stringify({ scope: SCOPE, authData: { authMethods: ['otp'], otp: { txnId, otpValue: await encrypt(otp) } } }),
            });
            const accounts = Array.isArray(body.accounts) ? (body.accounts as Array<Record<string, unknown>>) : [];
            if (body.authResult !== 'success' || accounts.length === 0) {
                throw new AbdmError(String(body.message ?? 'The OTP was not accepted'), 400);
            }
            const a = accounts[0];
            return {
                abhaNumber: String(a.ABHANumber ?? '').trim(),
                abhaAddress: typeof a.preferredAbhaAddress === 'string' ? a.preferredAbhaAddress : null,
                name: String(a.name ?? ''),
                status: String(a.status ?? ''),
            };
        },
    };
}
