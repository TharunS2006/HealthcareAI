/**
 * Relay role enforcement — `npm run verify:relay`
 *
 * Starts its own mesh relay on a spare port and checks, over HTTP, that the
 * relay applies the same rules as the app:
 *
 *   1. IDENTITY   reads without identity headers are refused (401)
 *   2. EVENTS     a forged referral event (an ANM accepting her own referral,
 *                 an MO answering another PHC's) is refused (403); a legal
 *                 one is accepted (202)
 *   3. SCOPE      a user is only sent referrals their facility is party to;
 *                 the DHO sees the district
 *   4. RESOURCES  only a facility's bed manager may change its beds; an MO
 *                 may move occupancy only through an admission at their PHC
 *   5. CONTRACT   every way the relay says no is one the app reads as a
 *                 refusal, and a 404 (another server on the relay's port) is not
 */

import { spawn } from 'node:child_process';

const wf = await import('../lib/referrals/workflow');
const { SEED_USERS } = await import('../lib/auth/users');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');
const { SEED_RESOURCES } = await import('../lib/data/resources');

const PORT = 3000 + Math.floor(Math.random() * 900) + 100 + 1000; // 4100–4999
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const relay = spawn('node_modules/.bin/tsx', ['server/mesh-server.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const stop = () => { try { relay.kill(); } catch { /* already gone */ } };
process.on('exit', stop);

async function waitForRelay(): Promise<boolean> {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`${BASE}/health`);
            if (r.ok) return true;
        } catch { /* not up yet */ }
        await new Promise(res => setTimeout(res, 250));
    }
    return false;
}

const user = (id: string) => SEED_USERS.find(u => u.id === id)!;
const actor = (id: string) => wf.actorFromUser(user(id), user(id).facilityId ?? undefined);
const headers = (id: string) => ({
    'Content-Type': 'application/json',
    'x-nalammesh-user': id,
    'x-nalammesh-role': user(id).role,
    ...(user(id).facilityId ? { 'x-nalammesh-facility': user(id).facilityId! } : {}),
});
const fac = (id: string) => {
    const f = FACILITY_NETWORK.find(x => x.id === id)!;
    return { id: f.id, name: f.name, type: f.type };
};
const post = (path: string, body: unknown, as?: string) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: as ? headers(as) : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const since = async (as: string) => {
    const r = await fetch(`${BASE}/api/referrals/since/0`, { headers: headers(as) });
    return (await r.json()) as { referrals: Array<{ referral: { id: string } }> };
};

if (!(await waitForRelay())) {
    console.log(' FAIL the relay did not start');
    process.exit(1);
}

const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const must = <T extends { ok: boolean }>(r: T) => {
    if (!r.ok) throw new Error((r as unknown as { message: string }).message);
    return r as Extract<T, { ok: true }>;
};

// ---------------------------------------------------------------------------
console.log('\n1. IDENTITY');
// ---------------------------------------------------------------------------
check('reading referrals with no identity is refused (401)', (await fetch(`${BASE}/api/referrals/since/0`)).status === 401);
check('reading patient records with no identity is refused (401)', (await fetch(`${BASE}/api/sync/since/0`)).status === 401);
check('an ANM may read referrals (200)', (await fetch(`${BASE}/api/referrals/since/0`, { headers: headers('u-anm-kothi') })).status === 200);
check('the contract documents the identity headers', JSON.stringify(await (await fetch(`${BASE}/api`)).json()).includes('x-nalammesh-role'));

// ---------------------------------------------------------------------------
console.log('\n2. EVENTS');
// ---------------------------------------------------------------------------
let ref = must(wf.createReferral({
    id: `ref-relay-${PORT}`, eventId: 'c1', at: at(0),
    patient: { id: 'p-relay', name: 'Relay Test', age: 40, gender: 'F' },
    from: fac('sc-kothi'), to: fac('phc-bhamragad'),
    reason: 'Acute gastroenteritis with severe dehydration', priority: 'URGENT', transportMode: 'SELF',
}, actor('u-anm-kothi'))).referral;
ref = must(wf.applyAction(ref, { action: 'SEND', actor: actor('u-anm-kothi'), at: at(0), eventId: 's1' })).referral;
check('a new referral from the ANM is accepted (202)', (await post('/api/referrals/publish', { referral: ref, notifications: [] })).status === 202);

const opened = must(wf.applyAction(ref, { action: 'OPEN', actor: actor('u-mo-bhamragad'), at: at(1), eventId: 'o1' })).referral;
check('the PHC MO opening it is accepted (202)', (await post('/api/referrals/publish', { referral: opened, notifications: [] })).status === 202);

const forged = {
    ...opened,
    status: 'ACCEPTED',
    timeline: [...opened.timeline, { id: 'forged-1', action: 'ACCEPT', fromStatus: 'DELIVERED', toStatus: 'ACCEPTED', at: at(2), actor: actor('u-anm-kothi') }],
};
const forgedRes = await post('/api/referrals/publish', { referral: forged, notifications: [] });
check('an ANM "accepting" her own referral is refused (403)', forgedRes.status === 403, String(forgedRes.status));
const wrongPhc = { ...forged, timeline: [...opened.timeline, { ...forged.timeline.at(-1)!, id: 'forged-2', actor: actor('u-mo-perimili') }] };
check('an MO at another PHC answering it is refused (403)', (await post('/api/referrals/publish', { referral: wrongPhc, notifications: [] })).status === 403);
const dhoAccept = { ...forged, timeline: [...opened.timeline, { ...forged.timeline.at(-1)!, id: 'forged-3', actor: actor('u-dho') }] };
check('the DHO accepting it is refused (403)', (await post('/api/referrals/publish', { referral: dhoAccept, notifications: [] })).status === 403);

const accepted = must(wf.applyAction(opened, {
    action: 'ACCEPT', actor: actor('u-mo-bhamragad'), at: at(3), eventId: 'a1',
    reservation: { ward: 'GENERAL', label: 'General ward bed', handoverInstructions: 'PHC ward' },
})).referral;
check('the right MO accepting it is accepted (202)', (await post('/api/referrals/publish', { referral: accepted, notifications: [] })).status === 202);

// ---------------------------------------------------------------------------
console.log('\n3. SCOPE');
// ---------------------------------------------------------------------------
const seenBy = async (id: string) => (await since(id)).referrals.some(r => r.referral.id === ref.id);
check('the sending Sub Centre sees it', await seenBy('u-anm-kothi'));
check('the receiving PHC sees it', await seenBy('u-mo-bhamragad'));
check('another Sub Centre does not', !(await seenBy('u-anm-govindpur')));
check('another PHC does not', !(await seenBy('u-mo-perimili')));
check('a hospital not on the referral does not', !(await seenBy('u-ha-dh')));
check('the DHO does', await seenBy('u-dho'));

// ---------------------------------------------------------------------------
console.log('\n4. RESOURCES');
// ---------------------------------------------------------------------------
const chc = SEED_RESOURCES.find(r => r.facilityId === 'chc-etapalli')!;
const phc = SEED_RESOURCES.find(r => r.facilityId === 'phc-bhamragad')!;
check('the CHC bed manager may change CHC beds (202)', (await post('/api/resources/publish', { resources: chc, reason: 'MANAGE' }, 'u-ha-chc')).status === 202);
check('the CHC bed manager may not change DH beds (403)',
    (await post('/api/resources/publish', { resources: { ...chc, facilityId: 'dh-district' }, reason: 'MANAGE' }, 'u-ha-chc')).status === 403);
check('an ANM may not change beds (403)', (await post('/api/resources/publish', { resources: chc, reason: 'MANAGE' }, 'u-anm-kothi')).status === 403);
check('an MO may move occupancy at their own PHC through an admission (202)',
    (await post('/api/resources/publish', { resources: phc, reason: 'OCCUPANCY' }, 'u-mo-bhamragad')).status === 202);
check('...but may not edit PHC beds directly (403)', (await post('/api/resources/publish', { resources: phc, reason: 'MANAGE' }, 'u-mo-bhamragad')).status === 403);
check('only the Super Admin may change users',
    (await post('/api/users/publish', { user: user('u-anm-kothi') }, 'u-dho')).status === 403 &&
    (await post('/api/users/publish', { user: user('u-anm-kothi') }, 'u-sa')).status === 202);
check('maintenance tickets need the facility bed manager',
    (await post('/api/tickets/publish', { ticket: { id: 't', facilityId: 'chc-etapalli' } }, 'u-mo-bhamragad')).status === 403 &&
    (await post('/api/tickets/publish', { ticket: { id: 't', facilityId: 'chc-etapalli' } }, 'u-ha-chc')).status === 202);

// ---------------------------------------------------------------------------
console.log('\n5. CONTRACT');
// ---------------------------------------------------------------------------
// The app reads only these answers as the relay saying no (lib/referrals/transport.ts);
// anything else leaves the referral "not yet sent" and retries.
const { RELAY_REFUSAL_STATUSES } = await import('../lib/referrals/transport');
const refusals = [
    (await fetch(`${BASE}/api/referrals/since/0`)).status, // no identity
    (await post('/api/referrals/publish', { referral: forged, notifications: [] })).status, // role may not
    (await fetch(`${BASE}/api/referrals/since/x`, { headers: headers('u-anm-kothi') })).status, // malformed
];
check('every way the relay says no is read by the app as a refusal', refusals.every(code => RELAY_REFUSAL_STATUSES.has(code)), refusals.join());
const foreign = (await fetch(`${BASE}/api/not-a-relay-route`, { method: 'POST' })).status;
check('a 404 — another server on the relay\'s port — is read as unavailable, not refused', foreign === 404 && !RELAY_REFUSAL_STATUSES.has(foreign), String(foreign));

stop();
console.log(failures === 0 ? '\nAll relay access checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
