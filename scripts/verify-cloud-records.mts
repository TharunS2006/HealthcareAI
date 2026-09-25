/**
 * Cloud record hand-off check — `npm run verify:cloud-records`
 *
 * Exercises lib/sync/cloudRecords.ts against a real FastAPI instance over real
 * HTTP. The backend's own checks (backend/scripts/verify_records.py) cover the
 * service's behaviour; this covers the wire between the two, which is where a
 * mismatch would be invisible until a hospital was waiting for a record that
 * never arrived.
 *
 * The properties that matter:
 *   - A record uploaded from the device comes back off the incoming board intact.
 *   - A status the cloud has no word for (REJECTED) still lands, rather than
 *     422-ing forever inside the outbox.
 *   - A malformed record is reported as NOT retryable, so it leaves the queue
 *     instead of blocking every later upload behind it.
 *   - Every failure path returns a reason. Nothing resolves to a silent empty.
 *
 * Spins up its own backend on a spare port against a throwaway database, so it
 * touches neither district.db nor whatever is running on :8000.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8123;
process.env.NEXT_PUBLIC_REPORTING_URL = `http://127.0.0.1:${PORT}`;
// Node exposes a read-only `navigator` with no `onLine`, which the browser guard
// would read as "offline" and skip every request. Redefined here so the code
// under test takes the same path it takes in a browser with a connection.
Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
});

const failures: string[] = [];
const pass = (label: string) => console.log(`  PASS  ${label}`);
const fail = (label: string, detail: string) => {
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failures.push(label);
};

// Tokens are minted by the relay's own signer, with a secret the service is started with.
const AUTH_SECRET = 'verify-cloud-records-secret-' + 'z'.repeat(20);
const { signToken } = await import('../server/relay/auth');
const bearerFor = (sub: string, role: 'MO' | 'DHO', fac: string | null) =>
    ({ Authorization: `Bearer ${signToken({ sub, role, fac, name: sub }, AUTH_SECRET).token}` });

const dbDir = mkdtempSync(join(tmpdir(), 'nalammesh-verify-'));
const backend = spawn(
    'python3',
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(PORT), '--log-level', 'warning'],
    {
        cwd: new URL('../backend', import.meta.url).pathname,
        env: { ...process.env, DATABASE_URL: `sqlite:///${join(dbDir, 'verify.db')}`, NALAMMESH_AUTH_SECRET: AUTH_SECRET },
        stdio: ['ignore', 'ignore', 'pipe'],
    }
);
let backendStderr = '';
backend.stderr.on('data', (chunk) => { backendStderr += String(chunk); });

const stop = () => { if (!backend.killed) backend.kill('SIGTERM'); };
process.on('exit', stop);

async function waitForBackend(): Promise<boolean> {
    for (let i = 0; i < 60; i += 1) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/health`);
            if (res.ok) return true;
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    return false;
}

console.log('\nNalamMesh — device → cloud record hand-off\n');

if (!(await waitForBackend())) {
    console.log('  Could not start the district service. Is FastAPI installed?');
    console.log(backendStderr.slice(-800));
    stop();
    process.exit(1);
}

const { uploadPatientRecord, uploadCareReferral, fetchIncoming, fetchStore, setIdentityProvider, wireStatus } =
    await import('../lib/sync/cloudRecords');

// The district service answers only a signed-in role (backend/app/access.py).
// Checks 1–6 run as the District Health Officer, who may upload and read any
// facility's board and the full store; section 0 checks what happens without.
const DHO = bearerFor('u-dho', 'DHO', null);
setIdentityProvider(() => ({}));

const NOW = new Date().toISOString();
const EARLIER = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const patient: any = {
    id: 'pat-verify-1',
    name: 'Lakshmi Devi',
    age: 27,
    gender: 'F',
    village: 'Bhamragad',
    tehsil: 'Bhamragad',
    district: 'Gadchiroli',
    vitals: { bloodPressureSystolic: 168, bloodPressureDiastolic: 112, spo2: 91 },
    // The app's real vocabularies, deliberately: TriageStatus is RED/YELLOW/GREEN
    // while TriagePriority is EMERGENCY/URGENT/SEMI_URGENT/ROUTINE. Uploading a
    // record built from the cloud's own words instead would hide a mapping bug.
    triageStatus: 'RED',
    triagePriority: 'EMERGENCY',
    highRiskFlags: ['PRE_ECLAMPSIA'],
    gps: { lat: 19.4, lng: 80.2, accuracy: 12 },
    isSynced: false,
    timestamp: NOW,
};

const referral = (over: Record<string, unknown> = {}): any => ({
    id: 'ref-verify-1',
    patientId: 'pat-verify-1',
    patientName: 'Lakshmi Devi',
    patientAge: 27,
    patientGender: 'F',
    fromFacilityId: 'phc-bhamragad',
    fromFacilityName: 'PHC Bhamragad',
    fromFacilityType: 'PHC',
    toFacilityId: 'dh-gadchiroli',
    toFacilityName: 'District Hospital Gadchiroli',
    toFacilityType: 'DH',
    reason: 'Severe pre-eclampsia',
    priority: 'EMERGENCY',
    // Accepted and dispatched: uploads as IN_TRANSIT (see wireStatus).
    status: 'ACCEPTED',
    inTransitAt: EARLIER,
    referredBy: 'ASHA Sunita',
    referredAt: EARLIER,
    transportMode: 'AMBULANCE_102',
    clinicalSummary: 'BP 168/112, SpO2 91%, headache and visual disturbance',
    etaMinutes: 22,
    ...over,
});

// ── 0. Identity and status mapping ───────────────────────────────────────────
console.log('\nWithout a signed-in role, uploads wait and reads are refused:');
const anonymous = await uploadPatientRecord(patient, NOW);
check('an upload with no session stays queued (retryable), not refused',
    !anonymous.ok && anonymous.retryable === true, JSON.stringify(anonymous));
const anonymousStore = await fetchStore(50);
check('with no session the store is not asked, and the screen is told why',
    anonymousStore.ok === false && anonymousStore.reason === 'no-session', JSON.stringify(anonymousStore));
const anonymousBoard = await fetchIncoming('phc-bhamragad');
check('…and the same for a pre-arrival board',
    anonymousBoard.ok === false && anonymousBoard.reason === 'no-session', JSON.stringify(anonymousBoard));
setIdentityProvider(() => ({ Authorization: 'Bearer forged.token.value' }));
const forged = await fetchStore(50);
check('a token the relay never signed is refused by the store',
    forged.ok === false && forged.reason === 'forbidden', JSON.stringify(forged));
setIdentityProvider(() => bearerFor('u-mo-bhamragad', 'MO', 'phc-bhamragad'));
const otherBoard = await fetchIncoming('dh-gadchiroli');
check('a PHC cannot read another facility\'s pre-arrival board',
    otherBoard.ok === false && otherBoard.reason === 'forbidden', JSON.stringify(otherBoard));
setIdentityProvider(() => DHO);

console.log('\nLifecycle statuses map onto the service\'s five:');
check('awaiting-answer states upload as INITIATED',
    ['CREATED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED'].every(st => wireStatus({ status: st as any }) === 'INITIATED'));
check('accepted and dispatched uploads as IN_TRANSIT, accepted alone as ACCEPTED',
    wireStatus({ status: 'ACCEPTED', inTransitAt: NOW }) === 'IN_TRANSIT' && wireStatus({ status: 'ACCEPTED' }) === 'ACCEPTED');
check('arrived / admitted / discharged leave the board as COMPLETED; rejected as CANCELLED',
    ['PATIENT_ARRIVED', 'ADMITTED', 'DISCHARGED'].every(st => wireStatus({ status: st as any }) === 'COMPLETED') &&
    wireStatus({ status: 'REJECTED' }) === 'CANCELLED');

// ── 1. Round trip ────────────────────────────────────────────────────────────
console.log('A record uploaded here is readable there:');
const up = await uploadPatientRecord(patient, NOW);
check('patient upload accepted', up.ok, JSON.stringify(up));

const refUp = await uploadCareReferral(referral(), NOW);
check('referral upload accepted', refUp.ok, JSON.stringify(refUp));

const board = await fetchIncoming('dh-gadchiroli');
if (!board.ok) {
    fail('receiving facility can read its incoming board', `reason: ${board.reason}`);
} else {
    const found = board.cases.find((c) => c.referral.id === 'ref-verify-1');
    check('the case appears on the receiving board', Boolean(found), JSON.stringify(board.cases.map((c) => c.referral.id)));
    check('the clinical summary survives the trip',
        found?.referral.clinicalSummary === 'BP 168/112, SpO2 91%, headache and visual disturbance',
        `got ${found?.referral.clinicalSummary}`);
    check('the full patient record arrives, vitals and risk flags included',
        found?.patient?.name === 'Lakshmi Devi'
        && found?.patient?.vitals?.bloodPressureSystolic === 168
        && Array.isArray(found?.patient?.highRiskFlags)
        && found?.patient?.highRiskFlags?.[0] === 'PRE_ECLAMPSIA',
        JSON.stringify(found?.patient));
    check('the ETA the ward plans against arrives', found?.eta_minutes === 22, `got ${found?.eta_minutes}`);
}

// ── 2. A status the cloud has no word for ────────────────────────────────────
console.log('\nA REJECTED referral still lands, and leaves the board:');
const rejected = await uploadCareReferral(referral({ id: 'ref-verify-2', status: 'REJECTED' }), NOW);
check('REJECTED is accepted rather than refused at the schema boundary',
    rejected.ok, JSON.stringify(rejected));
const afterReject = await fetchIncoming('dh-gadchiroli');
check('a rejected referral is not shown as still coming',
    afterReject.ok && !afterReject.cases.some((c) => c.referral.id === 'ref-verify-2'),
    JSON.stringify(afterReject));

// ── 3. Stale replay ──────────────────────────────────────────────────────────
console.log('\nA reconnecting device cannot overwrite newer data:');
const replay = await uploadPatientRecord({ ...patient, name: 'STALE COPY' }, EARLIER);
check('the old copy is acknowledged but not applied',
    replay.ok && replay.duplicate === true, JSON.stringify(replay));
const afterReplay = await fetchIncoming('dh-gadchiroli');
const still = afterReplay.ok && afterReplay.cases.find((c) => c.referral.id === 'ref-verify-1');
check('the board still shows the newer record',
    Boolean(still) && (still as any).patient?.name === 'Lakshmi Devi',
    JSON.stringify((still as any)?.patient?.name));

// ── 4. A record the server will never accept ─────────────────────────────────
console.log('\nAn unacceptable record is reported as permanent, not retried forever:');
const bad = await uploadPatientRecord({ ...patient, id: 'pat-bad', age: -5 } as any, NOW);
check('a malformed record fails', !bad.ok, JSON.stringify(bad));
check('and is marked not-retryable so it cannot block the queue',
    !bad.ok && bad.retryable === false, JSON.stringify(bad));
check('and carries a reason a human can act on',
    !bad.ok && typeof (bad as any).detail === 'string' && (bad as any).detail.length > 0,
    JSON.stringify(bad));

// ── 5. The two urgency vocabularies line up ──────────────────────────────────
// The app grades referrals on four levels and the cloud stores three. This is
// where that conversion is proved, because getting it wrong is silent: the case
// simply sits in the wrong column of the receiving ward's board.
console.log('\nFour-level priorities convert without ever being downgraded:');
const { colourForPriority } = await import('../lib/care/priority');
const EXPECTED: Array<[string, string]> = [
    ['EMERGENCY', 'RED'],
    ['URGENT', 'YELLOW'],
    ['SEMI_URGENT', 'YELLOW'],
    ['ROUTINE', 'GREEN'],
];
for (const [priority, colour] of EXPECTED) {
    check(`${priority} → ${colour}`, colourForPriority(priority as any) === colour,
        `got ${colourForPriority(priority as any)}`);
}
check('SEMI_URGENT rounds up rather than down to GREEN',
    colourForPriority('SEMI_URGENT' as any) !== 'GREEN');
check('an unreadable priority is treated as the most urgent, not the least',
    colourForPriority('WHO_KNOWS' as any) === 'RED' && colourForPriority(undefined) === 'RED',
    `got ${colourForPriority('WHO_KNOWS' as any)} / ${colourForPriority(undefined)}`);

console.log('\nEvery app priority is actually accepted by the cloud:');
for (const [priority] of EXPECTED) {
    const res = await uploadCareReferral(
        referral({ id: `ref-prio-${priority}`, priority, status: 'SENT' }), NOW);
    check(`a ${priority} referral uploads`, res.ok, JSON.stringify(res));
}

// ── 6. The Data Inspector sees what was actually uploaded ────────────────────
// This is the screen a judge is shown to check the offline-to-cloud claim, so
// the thing under test is not "the endpoint responds" but "the record I just
// sent from this device is in there, whole".
console.log('\nThe store dump holds the record this device uploaded:');
const store = await fetchStore(50);
if (!store.ok) {
    fail('the store dump is readable', `reason: ${store.reason}`);
} else {
    const held = store.store.patient_records.find((r) => r.id === 'pat-verify-1');
    check('the uploaded patient is in the store', Boolean(held),
        JSON.stringify(store.store.patient_records.map((r) => r.id)));
    check('its payload is the device record, not a projection of it',
        held?.payload?.vitals?.bloodPressureSystolic === 168
        && held?.payload?.highRiskFlags?.[0] === 'PRE_ECLAMPSIA',
        JSON.stringify(held?.payload));
    check('the projection columns the panel shows beside it agree',
        held?.name === 'Lakshmi Devi' && held?.age === 27,
        `${held?.name} / ${held?.age}`);
    check('the referral is held too, so both panels have rows',
        store.store.care_referrals.some((r) => r.id === 'ref-verify-1'),
        JSON.stringify(store.store.care_referrals.map((r) => r.id)));

    // The tiles read the totals while the panels list rows. If those two ever
    // disagreed the page would state a number it is not showing.
    check('shown matches the rows actually returned',
        store.store.patient_records_shown === store.store.patient_records.length
        && store.store.care_referrals_shown === store.store.care_referrals.length,
        JSON.stringify({
            shown: store.store.patient_records_shown,
            rows: store.store.patient_records.length,
        }));
    check('the total is never smaller than what is shown',
        store.store.patient_records_total >= store.store.patient_records_shown
        && store.store.care_referrals_total >= store.store.care_referrals_shown,
        JSON.stringify({
            total: store.store.patient_records_total,
            shown: store.store.patient_records_shown,
        }));
    check('the most recent upload is the first row a judge reads',
        store.store.patient_records[0]?.id === 'pat-verify-1',
        JSON.stringify(store.store.patient_records.map((r) => r.id)));
}

// A 200 with a body of the wrong shape is the one failure that would render as
// a healthy, empty store — the exact reading the page must never produce.
console.log('\nA well-formed reply of the wrong shape is a failure, not an empty store:');
const realFetch = globalThis.fetch;
globalThis.fetch = (async () =>
    new Response(JSON.stringify({ patient_records_total: 4, detail: 'not this shape' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
const malformed = await fetchStore(50);
globalThis.fetch = realFetch;
check('a body with no record arrays is reported as an error',
    malformed.ok === false && malformed.reason === 'error', JSON.stringify(malformed));

// ── 7. Nothing resolves to a silent empty ────────────────────────────────────
console.log('\nAn unreachable cloud reports a reason, never an empty board:');
process.env.NEXT_PUBLIC_REPORTING_URL = 'http://127.0.0.1:1';
const dead = await fetchIncoming('dh-gadchiroli');
check('unreachable is reported as a failure, not as "nobody is coming"',
    dead.ok === false && typeof dead.reason === 'string', JSON.stringify(dead));
const deadUpload = await uploadPatientRecord(patient, NOW);
check('an upload to an unreachable cloud stays retryable',
    !deadUpload.ok && deadUpload.retryable === true, JSON.stringify(deadUpload));
const deadStore = await fetchStore(50);
check('an unreachable store reads as unreachable, not as "the cloud is empty"',
    deadStore.ok === false && deadStore.reason === 'unreachable', JSON.stringify(deadStore));
process.env.NEXT_PUBLIC_REPORTING_URL = `http://127.0.0.1:${PORT}`;

// ── 8. The hosted site does not dial what the browser will block ─────────────
// On the HTTPS deployment there is no district service; a plain-HTTP address is
// blocked by the browser as mixed content. It must read as unreachable — with
// no request made, so the console does not fill with blocked calls.
console.log('\nOn an HTTPS page, a plain-HTTP service is unreachable and never called:');
const { blockedAsMixedContent } = await import('../lib/cloudEndpoint');
const g = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in g;
g.window = { location: { protocol: 'https:', hostname: 'healthcare-ai-beryl.vercel.app' } };
let calls = 0;
globalThis.fetch = (async () => { calls += 1; return new Response('{}'); }) as typeof fetch;
process.env.NEXT_PUBLIC_REPORTING_URL = 'http://healthcare-ai-beryl.vercel.app:8000';
const blockedStore = await fetchStore(50);
const blockedUpload = await uploadPatientRecord(patient, NOW);
check('a blocked address reads as unreachable', blockedStore.ok === false && blockedStore.reason === 'unreachable', JSON.stringify(blockedStore));
check('… an upload to it stays queued for retry', !blockedUpload.ok && blockedUpload.retryable === true, JSON.stringify(blockedUpload));
check('… and no request is sent', calls === 0, `${calls} request(s)`);
check('HTTPS and loopback addresses are not treated as blocked',
    !blockedAsMixedContent('https://nalammesh-chat.vercel.app/api') && !blockedAsMixedContent('http://localhost:3001') &&
    blockedAsMixedContent('http://192.168.1.9:3001'));
g.window = { location: { protocol: 'http:', hostname: 'localhost' } };
check('an HTTP page (local demo, APK over LAN) may call HTTP addresses', !blockedAsMixedContent('http://192.168.1.9:3001'));
if (hadWindow) g.window = undefined; else delete g.window;
globalThis.fetch = realFetch;
process.env.NEXT_PUBLIC_REPORTING_URL = `http://127.0.0.1:${PORT}`;

function check(label: string, condition: boolean | undefined, detail = '') {
    if (condition) pass(label);
    else fail(label, detail);
}

stop();
console.log('');
if (failures.length > 0) {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
}
console.log('All checks passed — records reach the receiving facility intact, stale replays');
console.log('cannot overwrite newer data, and every failure names a reason.\n');
process.exit(0);
