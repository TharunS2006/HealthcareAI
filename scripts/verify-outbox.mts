/**
 * Outbox check — `npm run verify:outbox`
 *
 * The outbox (lib/sync/outbox.ts) carries a referred patient's record to the
 * district service so the receiving facility sees it before the patient
 * arrives. It must never lose a record and never hammer the service:
 *
 *   1. SIGNED OUT   nothing is sent without a token; the record stays queued
 *   2. SIGNED IN    the record goes up with the token and leaves the queue
 *   3. 401          a session the service refuses keeps the record queued, to retry
 *   4. REFUSED      a record the service rejects (400) is set aside, not deleted
 *   5. OFFLINE      an unreachable service stops the pass; every record stays
 *   6. MID-PASS     a record queued while a pass runs goes up when that pass
 *                   ends — an emergency referral queued just after its patient
 *                   used to wait for the minute sweep
 */

import 'fake-indexeddb/auto';

const print = console.log.bind(console);
let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) print(` PASS ${label}`);
    else {
        failures += 1;
        print(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}
for (const level of ['info', 'warn', 'error', 'log'] as const) console[level] = () => {};

// Node has a navigator with no onLine; a browser always has one. Online, here.
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });

type Call = { url: string; auth: string | null; body: any };
const calls: Call[] = [];
let answer: (call: Call) => Response | Promise<Response> = () => new Response('{}', { status: 200 });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = { url: String(input), auth: headers.get('authorization'), body: JSON.parse(String(init?.body ?? 'null')) };
    calls.push(call);
    return answer(call);
}) as typeof fetch;

const { addToSyncQueue, getSyncQueue, removeFromSyncQueue } = await import('../lib/db');
const { flushOutbox } = await import('../lib/sync/outbox');
const { setIdentityProvider } = await import('../lib/sync/cloudRecords');
const { SEED_PATIENTS } = await import('../lib/data/facilities');

const patient = SEED_PATIENTS[0];
async function queue(id: string): Promise<void> {
    await addToSyncQueue({ id, patientId: patient.id, entityType: 'PATIENT', data: patient, retryCount: 0, createdAt: new Date().toISOString() });
}
const queued = async (id: string) => (await getSyncQueue()).find(i => i.id === id);

print('\n1. SIGNED OUT');
await queue('q-1');
setIdentityProvider(() => ({}));
check('nothing is uploaded without a token', (await flushOutbox()) === 0 && calls.length === 0, `${calls.length} request(s)`);
const waiting = await queued('q-1');
check('the record stays queued, with no retry counted against it', Boolean(waiting) && waiting!.retryCount === 0 && !waiting!.blockedReason);

print('\n2. SIGNED IN');
setIdentityProvider(() => ({ Authorization: 'Bearer test-token' }));
answer = () => new Response(JSON.stringify({ duplicate: false }), { status: 200 });
check('the record is uploaded', (await flushOutbox()) === 1);
check('…carrying the token', calls[0]?.auth === 'Bearer test-token', String(calls[0]?.auth));
check('…as the whole record, for the receiving clinician', calls[0]?.body?.payload?.id === patient.id && calls[0]?.url.endsWith('/api/v1/records/patients'));
check('…and leaves the queue', !(await queued('q-1')));

print('\n3. 401');
calls.length = 0;
await queue('q-2');
answer = () => new Response('{"detail":"expired"}', { status: 401 });
await flushOutbox();
const refused = await queued('q-2');
check('a session the service refuses keeps the record queued', Boolean(refused) && !refused!.blockedReason, JSON.stringify(refused));
check('…with a later retry scheduled', Boolean(refused?.nextAttemptAt) && Date.parse(refused!.nextAttemptAt!) > Date.now());

print('\n4. REFUSED');
await addToSyncQueue({ ...refused!, nextAttemptAt: undefined });
answer = () => new Response('{"detail":"payload.id missing"}', { status: 400 });
await flushOutbox();
const setAside = await queued('q-2');
check('a record the service rejects is set aside, not deleted', Boolean(setAside?.blockedReason), JSON.stringify(setAside));
check('…and the reason is kept', /400/.test(setAside?.blockedReason ?? ''), setAside?.blockedReason);

print('\n5. OFFLINE');
calls.length = 0;
await queue('q-3');
await queue('q-4');
answer = () => { throw new TypeError('fetch failed'); };
await flushOutbox();
check('an unreachable service stops the pass after one attempt', calls.length === 1, `${calls.length} request(s)`);
check('every record is still queued', Boolean(await queued('q-3')) && Boolean(await queued('q-4')));

print('\n6. MID-PASS');
calls.length = 0;
// q-4 was never attempted in 5 (the pass stopped at q-3), so it is due; q-3 is
// waiting out its backoff and must stay put.
await removeFromSyncQueue('q-4');
await queue('q-5');
let release!: () => void;
const held = new Promise<void>(resolve => { release = resolve; });
answer = async () => { await held; return new Response('{}', { status: 200 }); };
const pass = flushOutbox();                 // uploading q-5, held until released
await new Promise(resolve => setTimeout(resolve, 20));
await queue('q-6');                         // queued mid-pass…
const asked = flushOutbox();                // …which asks for a flush, as enqueue() does
check('a flush asked for during a pass returns at once', (await asked) === 0);
release();
const sentInPass = await pass;
check('the record queued mid-pass goes up as soon as the pass ends', !(await queued('q-6')) && !(await queued('q-5')), `${calls.length} request(s)`);
check('…in that same call, not at the next sweep', sentInPass === 2, `sent ${sentInPass}`);
check('…and a record waiting out a backoff is not tried early', Boolean(await queued('q-3')) && calls.length === 2, `${calls.length} request(s)`);

print(failures === 0 ? '\nAll outbox checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
