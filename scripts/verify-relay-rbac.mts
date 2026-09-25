/**
 * Relay sign-in and role enforcement — `npm run verify:relay`
 *
 * Starts the real local relay (server/mesh-server.ts) on a spare port with a
 * test signing secret, and checks over HTTP and websockets that:
 *
 *   1. SIGN-IN     the PIN is verified; wrong PINs count down and lock the
 *                  account; an account with no PIN cannot sign in
 *   2. IDENTITY    only a token this relay signed is identity — not claimed
 *                  headers, not an edited, expired or foreign token
 *   3. EVENTS      the role rules still hold, and an event must be the
 *                  signed-in user's own (409 retry while another user's
 *                  change is on its way; never accepted under the wrong token)
 *   4. DIRECTORY   a deactivated user's token stops working at once
 *   5. SCOPE       a user is only sent referrals their facility is party to
 *   6. RESOURCES   only a facility's bed manager may change its beds
 *   7. SOCKETS     a socket's identity is its token; changes are pushed only
 *                  to users who may see them; reset is the Super Admin's;
 *                  PIN hashes reach only devices of the same facility
 *   8. CONTRACT    the statuses the app reads as refused / retry / unavailable
 *   9. HOSTED      the serverless configuration against an Upstash-protocol
 *                  store: state shared between instances, lockout persisted
 *  10. PRODUCTION  no demo account signs in; the first Super Admin comes from
 *                  the relay's bootstrap PIN; staff sign in by Staff ID
 */

import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';

const wf = await import('../lib/referrals/workflow');
const { SEED_USERS, DEMO_PIN } = await import('../lib/auth/users');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');
const { SEED_RESOURCES } = await import('../lib/data/resources');
const { SEED_REFERRALS } = await import('../lib/data/referralSeed');
const { signToken } = await import('../server/relay/auth');

const PORT = 4100 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'verify-relay-secret-' + 'k'.repeat(24);

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const relay = spawn('node_modules/.bin/tsx', ['server/mesh-server.ts'], {
    env: { ...process.env, PORT: String(PORT), NALAMMESH_AUTH_SECRET: SECRET, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' },
    stdio: 'ignore',
});
const sockets: Socket[] = [];
const stop = () => {
    sockets.forEach(s => s.close());
    try { relay.kill(); } catch { /* already gone */ }
};
process.on('exit', stop);

async function waitFor(base: string): Promise<boolean> {
    for (let i = 0; i < 80; i++) {
        try {
            if ((await fetch(`${base}/health`)).ok) return true;
        } catch { /* not up yet */ }
        await new Promise(res => setTimeout(res, 250));
    }
    return false;
}

const user = (id: string) => SEED_USERS.find(u => u.id === id)!;
const actor = (id: string) => wf.actorFromUser(user(id), user(id).facilityId ?? undefined);
const fac = (id: string) => {
    const f = FACILITY_NETWORK.find(x => x.id === id)!;
    return { id: f.id, name: f.name, type: f.type };
};
const login = (base: string, userId: string, pin: string) =>
    fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, pin }) });
const tokens = new Map<string, string>();
async function tokenFor(id: string, base = BASE): Promise<string> {
    const key = `${base}|${id}`;
    if (!tokens.has(key)) {
        const r = await login(base, id, DEMO_PIN);
        const body = (await r.json()) as { token?: string; error?: string };
        if (!body.token) throw new Error(`sign-in as ${id} failed: ${r.status} ${body.error}`);
        tokens.set(key, body.token);
    }
    return tokens.get(key)!;
}
const auth = async (id: string, base = BASE) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenFor(id, base)}` });
const post = async (path: string, body: unknown, as?: string, base = BASE) =>
    fetch(`${base}${path}`, { method: 'POST', headers: as ? await auth(as, base) : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const since = async (as: string, base = BASE) => {
    const r = await fetch(`${base}/api/referrals/since/0`, { headers: await auth(as, base) });
    return (await r.json()) as { referrals: Array<{ referral: { id: string; status: string } }> };
};
const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const must = <T extends { ok: boolean }>(r: T) => {
    if (!r.ok) throw new Error((r as unknown as { message: string }).message);
    return r as Extract<T, { ok: true }>;
};

if (!(await waitFor(BASE))) {
    console.log(' FAIL the relay did not start');
    process.exit(1);
}

// ---------------------------------------------------------------------------
console.log('\n1. SIGN-IN');
// ---------------------------------------------------------------------------
const good = await login(BASE, 'u-anm-kothi', DEMO_PIN);
const goodBody = (await good.json()) as { token?: string; expiresAt?: number; user?: Record<string, unknown> };
check('the right PIN signs in and returns a token', good.status === 200 && typeof goodBody.token === 'string' && (goodBody.expiresAt ?? 0) > Date.now());
check('the returned user carries no PIN hash', goodBody.user !== undefined && !('pinHash' in goodBody.user));
const wrong = await login(BASE, 'u-anm-govindpur', '1111');
check('a wrong PIN is refused (401) and says how many tries are left', wrong.status === 401 && /4 attempt/.test(((await wrong.json()) as { error: string }).error));
for (let i = 0; i < 3; i++) await login(BASE, 'u-anm-govindpur', '1111');
const fifth = await login(BASE, 'u-anm-govindpur', '1111');
check('the fifth wrong PIN locks the account (423)', fifth.status === 423, String(fifth.status));
check('…and a locked account refuses even the right PIN (423)', (await login(BASE, 'u-anm-govindpur', DEMO_PIN)).status === 423);
check('an unknown user is refused like a wrong PIN (401)', (await login(BASE, 'u-nobody', DEMO_PIN)).status === 401);
check('a malformed request is 400', (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 400);
const noPin = { id: 'u-new-anm', name: 'New ANM', role: 'ANM', facilityId: 'sc-kothi', staffId: 'ANM-NEW-1', active: true };
await post('/api/users/publish', { user: noPin }, 'u-sa');
check('an account with no PIN set cannot sign in (403)', (await login(BASE, 'u-new-anm', DEMO_PIN)).status === 403);

// ---------------------------------------------------------------------------
console.log('\n2. IDENTITY');
// ---------------------------------------------------------------------------
const read = (h: Record<string, string>) => fetch(`${BASE}/api/referrals/since/0`, { headers: h });
check('no token → 401', (await read({})).status === 401);
check('claimed x-nalammesh headers are not identity → 401',
    (await read({ 'x-nalammesh-user': 'u-dho', 'x-nalammesh-role': 'DHO' })).status === 401);
const anmToken = await tokenFor('u-anm-kothi');
const [h, p, s] = anmToken.split('.');
const promoted = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'DHO', fac: null })).toString('base64url');
check('a token edited to another role → 401', (await read({ Authorization: `Bearer ${h}.${promoted}.${s}` })).status === 401);
const expired = signToken({ sub: 'u-dho', role: 'DHO', fac: null, name: 'x' }, SECRET, Date.now() - 13 * 3600_000).token;
check('an expired token → 401', (await read({ Authorization: `Bearer ${expired}` })).status === 401);
const foreignSecret = signToken({ sub: 'u-dho', role: 'DHO', fac: null, name: 'x' }, 'another-secret-' + 'q'.repeat(30)).token;
check('a token signed with another secret → 401', (await read({ Authorization: `Bearer ${foreignSecret}` })).status === 401);
check('a valid token → 200', (await read({ Authorization: `Bearer ${anmToken}` })).status === 200);
const me = (await (await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${anmToken}` } })).json()) as { userId?: string; role?: string };
check('/api/auth/me names the token\'s user', me.userId === 'u-anm-kothi' && me.role === 'ANM');

// ---------------------------------------------------------------------------
console.log('\n3. EVENTS');
// ---------------------------------------------------------------------------
let ref = must(wf.createReferral({
    id: `ref-relay-${PORT}`, eventId: 'c1', at: at(0),
    patient: { id: 'p-relay', name: 'Relay Test', age: 40, gender: 'F' },
    from: fac('sc-kothi'), to: fac('phc-bhamragad'),
    reason: 'Acute gastroenteritis with severe dehydration', priority: 'URGENT', transportMode: 'SELF',
}, actor('u-anm-kothi'))).referral;
ref = must(wf.applyAction(ref, { action: 'SEND', actor: actor('u-anm-kothi'), at: at(0), eventId: 's1' })).referral;
check('publishing without a token → 401', (await post('/api/referrals/publish', { referral: ref, notifications: [] })).status === 401);
check('the ANM publishing her own new referral → 202', (await post('/api/referrals/publish', { referral: ref, notifications: [] }, 'u-anm-kothi')).status === 202);

const opened = must(wf.applyAction(ref, { action: 'OPEN', actor: actor('u-mo-bhamragad'), at: at(1), eventId: 'o1' })).referral;
const carried = await post('/api/referrals/publish', { referral: opened, notifications: [] }, 'u-anm-kothi');
const carriedBody = (await carried.json()) as { retry?: boolean };
check('the ANM carrying the MO\'s unsynced opening → 409 retry, not accepted', carried.status === 409 && carriedBody.retry === true, String(carried.status));
check('the MO publishing his own opening → 202', (await post('/api/referrals/publish', { referral: opened, notifications: [] }, 'u-mo-bhamragad')).status === 202);
check('…after which the ANM\'s copy goes through (nothing new of anyone else\'s)', (await post('/api/referrals/publish', { referral: opened, notifications: [] }, 'u-anm-kothi')).status === 202);

const forged = {
    ...opened,
    status: 'ACCEPTED',
    timeline: [...opened.timeline, { id: 'forged-1', action: 'ACCEPT', fromStatus: 'DELIVERED', toStatus: 'ACCEPTED', at: at(2), actor: actor('u-anm-kothi') }],
};
check('an ANM "accepting" her own referral → 403 (role rule)', (await post('/api/referrals/publish', { referral: forged, notifications: [] }, 'u-anm-kothi')).status === 403);
const accepted = must(wf.applyAction(opened, {
    action: 'ACCEPT', actor: actor('u-mo-bhamragad'), at: at(3), eventId: 'a1',
    reservation: { ward: 'GENERAL', label: 'General ward bed', handoverInstructions: 'PHC ward' },
})).referral;
const inTheirName = await post('/api/referrals/publish', { referral: accepted, notifications: [] }, 'u-anm-kothi');
check('an ANM publishing an acceptance in the MO\'s name is never accepted', inTheirName.status === 409, String(inTheirName.status));
check('…the relay still shows it unanswered', (await since('u-dho')).referrals.find(r => r.referral.id === ref.id)?.referral.status === 'DELIVERED');
const wrongPhc = { ...accepted, timeline: [...opened.timeline, { ...accepted.timeline.at(-1)!, id: 'forged-2', actor: actor('u-mo-perimili') }] };
check('an MO at another PHC answering it → 403', (await post('/api/referrals/publish', { referral: wrongPhc, notifications: [] }, 'u-mo-perimili')).status === 403);
check('the right MO accepting it → 202', (await post('/api/referrals/publish', { referral: accepted, notifications: [] }, 'u-mo-bhamragad')).status === 202);

// Delivery: a referral still CREATED is marked sent by whichever side learns
// it arrived — the creator's device on the relay's acknowledgement, or the
// receiving facility's when it reaches them.
const fresh = must(wf.createReferral({
    id: `ref-delivery-${PORT}`, eventId: 'dc1', at: at(0),
    patient: { id: 'p-delivery', name: 'Delivery Test', age: 22, gender: 'F' },
    from: fac('sc-kothi'), to: fac('phc-bhamragad'),
    reason: 'Bleeding in early pregnancy with dizziness', priority: 'EMERGENCY', transportMode: 'AMBULANCE_108',
}, actor('u-anm-kothi'))).referral;
check('the ANM publishes a referral not yet sent (202)', (await post('/api/referrals/publish', { referral: fresh, notifications: [] }, 'u-anm-kothi')).status === 202);
const delivered = must(wf.applyAction(fresh, { action: 'SEND', actor: actor('u-anm-kothi'), at: at(0), eventId: `${fresh.id}:send:dc1`, sentVia: 'LOCAL_PEER' })).referral;
check('an MO at another PHC cannot mark it sent', (await post('/api/referrals/publish', { referral: delivered, notifications: [] }, 'u-mo-perimili')).status !== 202);
check('the receiving PHC\'s MO may record that it arrived (202)', (await post('/api/referrals/publish', { referral: delivered, notifications: [] }, 'u-mo-bhamragad')).status === 202);

// The demo referrals ship on every device, authored by seeded users: any
// signed-in device may push them unchanged, but a "seed" event that differs
// from the shipped one is not waved through.
const seed = SEED_REFERRALS.find(r => r.id === 'ref-seed-02')!;
check('an unchanged demo referral is accepted from any signed-in device (202)',
    (await post('/api/referrals/publish', { referral: seed, notifications: [] }, 'u-dho')).status === 202);
const seedLast = seed.timeline.at(-1)!;
const doctoredSeed = { ...SEED_REFERRALS.find(r => r.id === 'ref-seed-03')!, id: 'ref-seed-03' };
doctoredSeed.timeline = doctoredSeed.timeline.map((e, i, all) => (i === all.length - 1 ? { ...e, action: 'DISCHARGE' as const, toStatus: 'DISCHARGED' as const } : e));
const doctored = await post('/api/referrals/publish', { referral: doctoredSeed, notifications: [] }, 'u-dho');
check('a demo event id reused with a different action is not accepted', doctored.status !== 202, `${doctored.status} (last seed step was ${seedLast.action})`);

// ---------------------------------------------------------------------------
console.log('\n4. DIRECTORY');
// ---------------------------------------------------------------------------
const periToken = await tokenFor('u-mo-perimili');
check('a user\'s token works while they are active', (await read({ Authorization: `Bearer ${periToken}` })).status === 200);
await post('/api/users/publish', { user: { ...user('u-mo-perimili'), active: false } }, 'u-sa');
check('deactivating them stops the token at once (401)', (await read({ Authorization: `Bearer ${periToken}` })).status === 401);
check('…and they cannot sign in again', (await login(BASE, 'u-mo-perimili', DEMO_PIN)).status === 401);
await post('/api/users/publish', { user: user('u-mo-perimili') }, 'u-sa');
check('a directory edit without a new PIN keeps the old one', (await login(BASE, 'u-mo-perimili', DEMO_PIN)).status === 200);

// ---------------------------------------------------------------------------
console.log('\n5. SCOPE');
// ---------------------------------------------------------------------------
const seenBy = async (id: string) => (await since(id)).referrals.some(r => r.referral.id === ref.id);
check('the sending Sub Centre sees it', await seenBy('u-anm-kothi'));
check('the receiving PHC sees it', await seenBy('u-mo-bhamragad'));
check('another PHC does not', !(await seenBy('u-mo-perimili')));
check('a hospital not on the referral does not', !(await seenBy('u-ha-dh')));
check('the DHO does', await seenBy('u-dho'));

// ---------------------------------------------------------------------------
console.log('\n6. RESOURCES');
// ---------------------------------------------------------------------------
const chc = SEED_RESOURCES.find(r => r.facilityId === 'chc-etapalli')!;
const phc = SEED_RESOURCES.find(r => r.facilityId === 'phc-bhamragad')!;
check('the CHC bed manager may change CHC beds (202)', (await post('/api/resources/publish', { resources: chc, reason: 'MANAGE' }, 'u-ha-chc')).status === 202);
check('…but not DH beds (403)', (await post('/api/resources/publish', { resources: { ...chc, facilityId: 'dh-district' }, reason: 'MANAGE' }, 'u-ha-chc')).status === 403);
check('an ANM may not change beds (403)', (await post('/api/resources/publish', { resources: chc, reason: 'MANAGE' }, 'u-anm-kothi')).status === 403);
check('an MO may move occupancy at their own PHC through an admission (202)', (await post('/api/resources/publish', { resources: phc, reason: 'OCCUPANCY' }, 'u-mo-bhamragad')).status === 202);
check('only the Super Admin may change users',
    (await post('/api/users/publish', { user: user('u-anm-kothi') }, 'u-dho')).status === 403 &&
    (await post('/api/users/publish', { user: user('u-anm-kothi') }, 'u-sa')).status === 202);
check('maintenance tickets need the facility bed manager',
    (await post('/api/tickets/publish', { ticket: { id: 't', facilityId: 'chc-etapalli' } }, 'u-mo-bhamragad')).status === 403 &&
    (await post('/api/tickets/publish', { ticket: { id: 't', facilityId: 'chc-etapalli' } }, 'u-ha-chc')).status === 202);

// ---------------------------------------------------------------------------
console.log('\n7. SOCKETS');
// ---------------------------------------------------------------------------
const open = (token: string | null) => new Promise<Socket>((resolve, reject) => {
    const sock = connect(BASE, { transports: ['websocket'], auth: { token }, reconnection: false, timeout: 4000 });
    sockets.push(sock);
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
});
const moSock = await open(await tokenFor('u-mo-bhamragad'));
const anonSock = await open(null);
const got = { mo: 0, anon: 0 };
moSock.on('referral:update', () => { got.mo += 1; });
anonSock.on('referral:update', () => { got.anon += 1; });
await new Promise(r => setTimeout(r, 300)); // identity is settled asynchronously after connect
const arrived = must(wf.applyAction(accepted, { action: 'DISPATCH', actor: actor('u-anm-kothi'), at: at(4), eventId: 'd1' })).referral;
check('the ANM dispatching over HTTP → 202', (await post('/api/referrals/publish', { referral: arrived, notifications: [] }, 'u-anm-kothi')).status === 202);
await new Promise(r => setTimeout(r, 400));
check('the MO\'s socket is pushed the change', got.mo === 1, String(got.mo));
check('a socket with no token is pushed nothing', got.anon === 0, String(got.anon));
const ack = await new Promise<{ ok: boolean; retry?: boolean }>(resolve =>
    anonSock.emit('referral:publish', { referral: arrived, notifications: [] }, resolve));
check('a socket with no token cannot publish', ack.ok === false);
const anmSock = await open(await tokenFor('u-anm-kothi'));
await new Promise(r => setTimeout(r, 200));
let wiped = false;
moSock.on('data:reset', () => { wiped = true; });
anmSock.emit('data:reset');
await new Promise(r => setTimeout(r, 300));
check('an ANM cannot wipe the network (data:reset ignored)', !wiped && (await seenBy('u-dho')));

// Directory changes: PIN hashes reach only devices whose staff could sign in with them.
type UserUpdate = { user: { id: string; pinHash?: string; pinHashWithheld?: boolean } };
const userUpdates = { mo: [] as UserUpdate[], anm: [] as UserUpdate[], anon: [] as UserUpdate[] };
moSock.on('user:update', (m: UserUpdate) => userUpdates.mo.push(m));
anmSock.on('user:update', (m: UserUpdate) => userUpdates.anm.push(m));
anonSock.on('user:update', (m: UserUpdate) => userUpdates.anon.push(m));
await post('/api/users/publish', { user: user('u-anm-kothi') }, 'u-sa');
await post('/api/users/publish', { user: user('u-mo-bhamragad') }, 'u-sa');
await new Promise(r => setTimeout(r, 400));
const upd = (who: UserUpdate[], id: string) => who.find(m => m.user.id === id)?.user;
check('a signed-out socket is sent no directory change at all', userUpdates.anon.length === 0, String(userUpdates.anon.length));
check('the ANM\'s own change reaches her device with her PIN hash', Boolean(upd(userUpdates.anm, 'u-anm-kothi')?.pinHash));
check('…but reaches the PHC Medical Officer\'s device without it, marked withheld',
    upd(userUpdates.mo, 'u-anm-kothi') !== undefined && !upd(userUpdates.mo, 'u-anm-kothi')?.pinHash && upd(userUpdates.mo, 'u-anm-kothi')?.pinHashWithheld === true,
    JSON.stringify(upd(userUpdates.mo, 'u-anm-kothi')));
check('the Medical Officer gets his own hash', Boolean(upd(userUpdates.mo, 'u-mo-bhamragad')?.pinHash));
const moCatchUp = await new Promise<{ users: UserUpdate['user'][] }>(resolve => moSock.emit('referral:catchup', { since: 0 }, resolve));
const leaked = moCatchUp.users.filter(u => u.id !== 'u-mo-bhamragad' && u.pinHash).map(u => u.id);
check('catch-up gives a PHC device no PIN hash of staff posted elsewhere', leaked.length === 0 && moCatchUp.users.length > 0, leaked.join(', '));
const httpCatchUp = await (await fetch(`${BASE}/api/referrals/since/0`, { headers: await auth('u-anm-kothi') })).json() as { users?: UserUpdate['user'][] };
check('…nor does HTTP catch-up give a Sub-Centre device anyone else\'s',
    (httpCatchUp.users ?? []).length > 0 && (httpCatchUp.users ?? []).every(u => u.id === 'u-anm-kothi' || !u.pinHash), JSON.stringify((httpCatchUp.users ?? []).filter(u => u.pinHash).map(u => u.id)));

// ---------------------------------------------------------------------------
console.log('\n8. CONTRACT');
// ---------------------------------------------------------------------------
// How lib/referrals/transport.ts reads each answer.
const { RELAY_REFUSAL_STATUSES } = await import('../lib/referrals/transport');
const refused = [
    (await post('/api/referrals/publish', { referral: forged, notifications: [] }, 'u-anm-kothi')).status, // role may not
    (await fetch(`${BASE}/api/referrals/since/x`, { headers: await auth('u-anm-kothi') })).status, // malformed
];
check('a role refusal and a malformed request read as REFUSED', refused.every(code => RELAY_REFUSAL_STATUSES.has(code)), refused.join());
check('401 is not a refusal — the app asks for the PIN and keeps the change', !RELAY_REFUSAL_STATUSES.has(401));
check('409 is not a refusal — the app retries', !RELAY_REFUSAL_STATUSES.has(409));
const foreign404 = (await fetch(`${BASE}/api/not-a-relay-route`, { method: 'POST' })).status;
check('a 404 (another server on the relay\'s port) is unavailable, not refused', foreign404 === 404 && !RELAY_REFUSAL_STATUSES.has(foreign404));

// ---------------------------------------------------------------------------
console.log('\n9. HOSTED');
// ---------------------------------------------------------------------------
// A stand-in for Upstash's REST API: the same wire protocol (@upstash/redis
// sends ["COMMAND", ...args] with a bearer token and asks for base64 results),
// backed by a Map, so the serverless relay is tested with its real client.
const kv = new Map<string, string | Map<string, string>>();
const expiries = new Map<string, number>();
const UPSTASH_TOKEN = 'fake-upstash-token';
const live = (k: string) => {
    const t = expiries.get(k);
    if (t && t <= Date.now()) { kv.delete(k); expiries.delete(k); }
    return kv.get(k);
};
const hash = (k: string) => { let v = live(k); if (!(v instanceof Map)) { v = new Map(); kv.set(k, v); } return v as Map<string, string>; };
function run([cmd, ...args]: string[]): unknown {
    switch (cmd.toLowerCase()) {
        case 'hset': { const m = hash(args[0]); let n = 0; for (let i = 1; i < args.length; i += 2) { if (!m.has(args[i])) n++; m.set(args[i], args[i + 1]); } return n; }
        case 'hget': { const v = live(args[0]); return v instanceof Map ? v.get(args[1]) ?? null : null; }
        case 'hgetall': { const v = live(args[0]); return v instanceof Map ? [...v.entries()].flat() : []; }
        case 'hlen': { const v = live(args[0]); return v instanceof Map ? v.size : 0; }
        case 'hdel': { const v = live(args[0]); let n = 0; if (v instanceof Map) for (const f of args.slice(1)) if (v.delete(f)) n++; return n; }
        case 'expire': expiries.set(args[0], Date.now() + Number(args[1]) * 1000); return 1;
        case 'incr': { const n = Number(live(args[0]) ?? 0) + 1; kv.set(args[0], String(n)); return n; }
        case 'get': { const v = live(args[0]); return typeof v === 'string' ? v : null; }
        case 'del': { let n = 0; for (const k of args) if (kv.delete(k)) n++; return n; }
        case 'set': {
            const nx = args.some(a => a.toLowerCase() === 'nx');
            if (nx && live(args[0]) !== undefined) return null;
            kv.set(args[0], args[1]);
            const px = args.findIndex(a => a.toLowerCase() === 'px');
            if (px > 0) expiries.set(args[0], Date.now() + Number(args[px + 1]));
            return 'OK';
        }
        default: throw new Error(`fake upstash: ${cmd} not implemented`);
    }
}
const encode = (v: unknown): unknown => (typeof v === 'string' && v !== 'OK' ? Buffer.from(v).toString('base64') : Array.isArray(v) ? v.map(encode) : v);
const body = (req: IncomingMessage) => new Promise<string>(res => { let s = ''; req.on('data', c => (s += c)); req.on('end', () => res(s)); });
let commands = 0;
let outage = false;
const upstash = createServer(async (req, res) => {
    if (outage) { req.socket.destroy(); return; }
    if (req.headers.authorization !== `Bearer ${UPSTASH_TOKEN}`) { res.writeHead(401).end('{"error":"unauthorized"}'); return; }
    const wrap = (result: unknown) => ({ result: req.headers['upstash-encoding'] === 'base64' ? encode(result) : result });
    try {
        const parsed = JSON.parse(await body(req)) as unknown[];
        // The client batches concurrent commands to /pipeline: an array of commands in, an array of results out.
        if (req.url?.startsWith('/pipeline') || req.url?.startsWith('/multi-exec')) {
            commands += parsed.length;
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify((parsed as unknown[][]).map(c => wrap(run(c.map(String))))));
            return;
        }
        commands++;
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(wrap(run(parsed.map(String)))));
    } catch (e) {
        res.writeHead(400).end(JSON.stringify({ error: String(e) }));
    }
});
await new Promise<void>(r => upstash.listen(0, '127.0.0.1', () => r()));
const upstashUrl = `http://127.0.0.1:${(upstash.address() as { port: number }).port}`;

// Two serverless instances of the hosted relay, sharing that store.
process.env.UPSTASH_REDIS_REST_URL = upstashUrl;
process.env.UPSTASH_REDIS_REST_TOKEN = UPSTASH_TOKEN;
process.env.NALAMMESH_AUTH_SECRET = SECRET;
const { createRelay } = await import('../server/relay/app');
const { storeFromEnv } = await import('../server/relay/store');
const instances = await Promise.all([0, 1].map(async () => {
    const { app } = createRelay({ store: storeFromEnv(), secret: SECRET, log: (m, d) => { if (/failed/i.test(m)) console.log('   relay log:', m, JSON.stringify(d)); } });
    const server = createServer(app);
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    return { server, base: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}));
const [A, B] = instances.map(i => i.base);
check('both instances report the Upstash store', (await Promise.all([A, B].map(async b => ((await (await fetch(`${b}/health`)).json()) as { store: string }).store))).every(k => k === 'upstash'));

// The Vercel entry itself: configured, it serves; missing a piece, it refuses
// every request and names what is missing, rather than losing referrals.
const { createHostedApp } = await import('../server/relay/hosted');
async function hostedStatus(env: Record<string, string>): Promise<{ health: number; signIn: number; body: string }> {
    // Next augments ProcessEnv with NODE_ENV; these are deliberately partial environments.
    const server = createServer(createHostedApp(env as NodeJS.ProcessEnv, () => {}));
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
        const health = await fetch(`${base}/health`);
        const signIn = await fetch(`${base}/api/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return { health: health.status, signIn: signIn.status, body: await health.text() };
    } finally {
        server.close();
    }
}
const hostedEnv = { KV_REST_API_URL: upstashUrl, KV_REST_API_TOKEN: UPSTASH_TOKEN, NALAMMESH_AUTH_SECRET: SECRET, VERCEL: '1' };
const configured = await hostedStatus(hostedEnv);
check('the Vercel entry, fully configured, is healthy on Upstash', configured.health === 200 && JSON.parse(configured.body).store === 'upstash', configured.body);
const noStore = await hostedStatus({ NALAMMESH_AUTH_SECRET: SECRET, VERCEL: '1' });
check('without Upstash it refuses every request (503), never falling back to memory', noStore.health === 503 && noStore.signIn === 503 && /Upstash/.test(noStore.body), noStore.body);
const weakSecret = await hostedStatus({ ...hostedEnv, NALAMMESH_AUTH_SECRET: 'short' });
check('with a secret under 32 characters it refuses (503) and says why', weakSecret.health === 503 && /NALAMMESH_AUTH_SECRET/.test(weakSecret.body), weakSecret.body);
const noSecret = await hostedStatus({ KV_REST_API_URL: upstashUrl, KV_REST_API_TOKEN: UPSTASH_TOKEN });
check('with no secret it never invents one per instance (503)', noSecret.health === 503 && /NALAMMESH_AUTH_SECRET/.test(noSecret.body), noSecret.body);

let hosted = must(wf.createReferral({
    id: `ref-hosted-${PORT}`, eventId: 'hc1', at: at(0),
    patient: { id: 'p-hosted', name: 'Hosted Test', age: 30, gender: 'M' },
    from: fac('sc-kothi'), to: fac('phc-bhamragad'),
    reason: 'Fever with rash for five days', priority: 'EMERGENCY', transportMode: 'AMBULANCE_108',
}, actor('u-anm-kothi'))).referral;
hosted = must(wf.applyAction(hosted, { action: 'SEND', actor: actor('u-anm-kothi'), at: at(0), eventId: 'hs1' })).referral;
check('the ANM publishes through instance A (202)', (await post('/api/referrals/publish', { referral: hosted, notifications: [] }, 'u-anm-kothi', A)).status === 202);
check('the MO polling instance B receives it', (await since('u-mo-bhamragad', B)).referrals.some(r => r.referral.id === hosted.id));
const hostedOpen = must(wf.applyAction(hosted, { action: 'OPEN', actor: actor('u-mo-bhamragad'), at: at(1), eventId: 'ho1' })).referral;
const [r1, r2] = await Promise.all([
    post('/api/referrals/publish', { referral: hostedOpen, notifications: [] }, 'u-mo-bhamragad', B),
    post('/api/referrals/publish', { referral: hostedOpen, notifications: [] }, 'u-mo-bhamragad', A),
]);
check('two instances writing the same referral at once both succeed', r1.status === 202 && r2.status === 202, `${r1.status} ${r2.status}`);
const seen = (await since('u-anm-kothi', A)).referrals.find(r => r.referral.id === hosted.id);
check('…and the ANM sees it delivered, with no event lost', seen?.referral.status === 'DELIVERED');
// Two users change the same referral at the same moment through different
// instances: the MO acknowledges on B while the ANM comments on A. Each starts
// from the same copy; without the store's lock one read-merge-write would
// overwrite the other.
const acked = must(wf.applyAction(hostedOpen, { action: 'ACKNOWLEDGE', actor: actor('u-mo-bhamragad'), at: at(2), eventId: 'hk1' })).referral;
const commented = must(wf.addComment(hostedOpen, actor('u-anm-kothi'), 'Patient\'s mother is travelling with her', at(2), 'hcm1')).referral;
const [ra, rb] = await Promise.all([
    post('/api/referrals/publish', { referral: acked, notifications: [] }, 'u-mo-bhamragad', B),
    post('/api/referrals/publish', { referral: commented, notifications: [] }, 'u-anm-kothi', A),
]);
const both = (await since('u-dho', A)).referrals.find(r => r.referral.id === hosted.id)?.referral as unknown as { status: string; comments: Array<{ id: string }>; timeline: Array<{ id: string }> } | undefined;
check('different changes by two users at once through two instances are both kept',
    ra.status === 202 && rb.status === 202 && both?.timeline.some(e => e.id === 'hk1') === true && both?.comments.some(c => c.id === 'hcm1') === true,
    `${ra.status} ${rb.status} events=${both?.timeline.map(e => e.id)} comments=${both?.comments.map(c => c.id)}`);
for (let i = 0; i < 5; i++) await login(A, 'u-sp-dh', '0000');
check('a lockout counted on instance A holds on instance B', (await login(B, 'u-sp-dh', DEMO_PIN)).status === 423);
check('a token from one instance is accepted by the other', (await fetch(`${B}/api/auth/me`, { headers: { Authorization: `Bearer ${await tokenFor('u-dho', A)}` } })).status === 200);
check('the store was really used', commands > 20, `${commands} commands`);
outage = true;
const duringOutage = await post('/api/referrals/publish', { referral: hostedOpen, notifications: [] }, 'u-mo-bhamragad', A).catch(() => null);
check('with the store unreachable the relay answers 503 (the app keeps the change and retries)', duringOutage?.status === 503, String(duringOutage?.status));
check('…and stays up', (await fetch(`${A}/health`)).ok);
outage = false;

instances.forEach(i => i.server.close());
upstash.close();

// ---------------------------------------------------------------------------
console.log('\n10. PRODUCTION');
// ---------------------------------------------------------------------------
const { relayModeFromEnv } = await import('../server/relay/mode');
const { hashPin } = await import('../lib/auth/pin');
check('a production relay without a bootstrap PIN will not serve',
    relayModeFromEnv({ NALAMMESH_DEPLOYMENT_MODE: 'production' }).problems.length === 1
    && relayModeFromEnv({ NALAMMESH_DEPLOYMENT_MODE: 'production', NALAMMESH_BOOTSTRAP_ADMIN_PIN: '2468' }).problems.length === 1);
const hostedNoPin = await hostedStatus({ ...hostedEnv, NALAMMESH_DEPLOYMENT_MODE: 'production' });
check('…the hosted entry answers 503 and names the setting', hostedNoPin.health === 503 && /BOOTSTRAP_ADMIN_PIN/.test(hostedNoPin.body), hostedNoPin.body);
check('an unset mode is an evaluation relay', relayModeFromEnv({}).demoAccounts === true);

const prodMode = relayModeFromEnv({ NALAMMESH_DEPLOYMENT_MODE: 'production', NALAMMESH_BOOTSTRAP_ADMIN_PIN: '135790', NALAMMESH_BOOTSTRAP_ADMIN_NAME: 'Dr. First Admin' });
const prodStore = storeFromEnv({} as NodeJS.ProcessEnv);
const prodServer = createServer(createRelay({ store: prodStore, secret: SECRET, demoAccounts: prodMode.demoAccounts, bootstrapAdmin: prodMode.bootstrapAdmin }).app);
await new Promise<void>(r => prodServer.listen(0, '127.0.0.1', () => r()));
const P = `http://127.0.0.1:${(prodServer.address() as { port: number }).port}`;
const staffLogin = (staffId: string, pin: string) =>
    fetch(`${P}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId, pin }) });
check('/health says production', ((await (await fetch(`${P}/health`)).json()) as { mode: string }).mode === 'production');
check('the demo Super Admin cannot sign in with the public PIN', (await login(P, 'u-sa', DEMO_PIN)).status === 401);
check('…nor any demo account', (await Promise.all(['u-anm-kothi', 'u-mo-bhamragad', 'u-dho'].map(id => login(P, id, DEMO_PIN)))).every(r => r.status === 401));
check('the first Super Admin signs in by Staff ID with the bootstrap PIN', (await staffLogin('ADMIN-01', '135790')).status === 200);
const adminBody = await (await staffLogin('admin-01', '135790')).json() as { token: string; user: { role: string; name: string; pinHash?: string } };
check('…Staff ID is not case-sensitive, and the account is the named Super Admin, its hash not sent',
    adminBody.user?.role === 'SUPER_ADMIN' && adminBody.user?.name === 'Dr. First Admin' && adminBody.user?.pinHash === undefined, JSON.stringify(adminBody.user));
check('a wrong PIN is refused', (await staffLogin('ADMIN-01', '000000')).status === 401);
const newAnm = { id: 'u-anm-new', name: 'Asha Kumre', role: 'ANM', facilityId: 'sc-kothi', staffId: 'ANM-KOT-2001', active: true, pinHash: await hashPin('482913') };
const created = await fetch(`${P}/api/users/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminBody.token}` }, body: JSON.stringify({ user: newAnm }) });
check('the Super Admin creates a real account', created.status === 202, String(created.status));
check('…who signs in by Staff ID on a new device', (await staffLogin('ANM-KOT-2001', '482913')).status === 200);
for (let i = 0; i < 5; i++) await staffLogin('NO-SUCH-ID', '111111');
check('guessing Staff IDs is locked out like guessing PINs', (await staffLogin('NO-SUCH-ID', '111111')).status === 423);
prodServer.close();
// The relay restarts with a different bootstrap PIN: a Super Admin exists, so it is ignored.
const restarted = createServer(createRelay({ store: prodStore, secret: SECRET, demoAccounts: false, bootstrapAdmin: { pin: '111111' } }).app);
await new Promise<void>(r => restarted.listen(0, '127.0.0.1', () => r()));
const R = `http://127.0.0.1:${(restarted.address() as { port: number }).port}`;
const loginR = (staffId: string, pin: string) => fetch(`${R}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId, pin }) });
check('once a Super Admin exists, a new bootstrap PIN neither signs in nor replaces theirs',
    (await loginR('ADMIN-01', '111111')).status === 401 && (await loginR('ADMIN-01', '135790')).status === 200);
check('…and no second admin account was made', (await prodStore.listUsers()).filter(u => u.role === 'SUPER_ADMIN').length === 1);
restarted.close();
stop();
console.log(failures === 0 ? '\nAll relay sign-in and access checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
