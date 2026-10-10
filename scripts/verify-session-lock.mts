/**
 * Inactivity lock and the queue's figures — `npm run verify:session-lock`
 *
 *   1. CLOCK     NEXT_PUBLIC_SESSION_IDLE_MINUTES is read safely (default 15,
 *                0 = off); "idle" means exactly the limit or more
 *   2. ACTIVITY  use of the tab moves the clock, survives a reload through
 *                sessionStorage, and does not count while the TV display has
 *                paused it — and the end of the pause is announced
 *   3. SESSION   lock keeps the session and its token, survives in storage,
 *                and only an unlock (or sign-out) clears it
 *   4. UNLOCK    the relay answers first and its refusal is final; offline the
 *                device's own copy of the PIN hash decides; a user whose hash
 *                the device does not hold cannot unlock offline
 *   5. QUEUE     the OPD figures come from the tokens' timestamps — nothing
 *                invented — and the waiting-room TV shows initials, not names
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

class MemoryStorage {
    private data = new Map<string, string>();
    getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
    setItem(key: string, value: string) { this.data.set(key, String(value)); }
    removeItem(key: string) { this.data.delete(key); }
    clear() { this.data.clear(); }
    key(i: number) { return Array.from(this.data.keys())[i] ?? null; }
    get length() { return this.data.size; }
}
const session = new MemoryStorage();
const local = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });

type Call = { url: string; body: any };
const calls: Call[] = [];
let relay: (call: Call) => Response | Promise<Response> = () => { throw new TypeError('fetch failed'); };
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: JSON.parse(String(init?.body ?? 'null')) };
    calls.push(call);
    return relay(call);
}) as typeof fetch;

const idle = await import('../lib/auth/idleLock');
const { useAuthStore } = await import('../stores/authStore');
const { unlockWithPin } = await import('../lib/auth/signIn');
const { hashPin } = await import('../lib/auth/pin');
const { queueStats, minutesWaiting, maskedName } = await import('../lib/queue/stats');

// A window that records the resume announcement — all lib/auth/idleLock.ts
// needs of one. Defined after the imports: react-hot-toast (through lib/db)
// takes any global window to mean a full browser with a document.
const dispatched: string[] = [];
Object.defineProperty(globalThis, 'window', {
    value: { dispatchEvent: (e: Event) => { dispatched.push(e.type); return true; }, location: { hostname: 'localhost', protocol: 'http:' } },
    configurable: true,
});

// ── 1. clock ────────────────────────────────────────────────────────────────
print('\n1. CLOCK');
check('unset → 15 minutes', idle.idleLockMinutes(undefined) === 15);
check('blank → 15 minutes', idle.idleLockMinutes('  ') === 15);
check('"0" → 0, locking off', idle.idleLockMinutes('0') === 0);
check('"5" → 5', idle.idleLockMinutes('5') === 5);
check('nonsense → the default, not NaN', idle.idleLockMinutes('soon') === 15);
check('negative → the default', idle.idleLockMinutes('-3') === 15);
check('the build default is 15 minutes', idle.IDLE_LOCK_MS === 15 * 60_000, String(idle.IDLE_LOCK_MS));
const T = 1_700_000_000_000;
const LIMIT = 15 * 60_000;
check('one millisecond short of the limit is not idle', !idle.isIdle(T, T + LIMIT - 1, LIMIT));
check('exactly the limit is idle', idle.isIdle(T, T + LIMIT, LIMIT));
check('locking off is never idle', !idle.isIdle(T, T + 10 * LIMIT, 0));
check('no recorded activity is not idle (nothing to measure from)', !idle.isIdle(0, T, LIMIT));

// ── 2. activity ─────────────────────────────────────────────────────────────
print('\n2. ACTIVITY');
idle.resetIdleClock(T);
check('reset records the time in memory', idle.readLastActive() === T);
check('…and in sessionStorage, for a reload', session.getItem('nalammesh-last-active') === String(T));
idle.markActive(T + 5_000);
check('activity moves the clock', idle.readLastActive() === T + 5_000);
check('…but storage is written at most every 10 s', session.getItem('nalammesh-last-active') === String(T));
idle.markActive(T + 12_000);
check('…and is written once 10 s have passed', session.getItem('nalammesh-last-active') === String(T + 12_000));
const resume = idle.pauseIdleLock();
check('the TV display pauses the clock', idle.idleLockPaused());
idle.markActive(T + 60 * 60_000);
check('activity during the pause does not count', idle.readLastActive() === T + 12_000);
resume();
check('resuming un-pauses', !idle.idleLockPaused());
check('…and announces it, so the lock checks the clock at once', dispatched.includes(idle.IDLE_RESUME_EVENT));
resume();
check('resuming twice is harmless', !idle.idleLockPaused() && dispatched.filter(e => e === idle.IDLE_RESUME_EVENT).length === 1);
const outer = idle.pauseIdleLock();
const inner = idle.pauseIdleLock();
inner();
check('two pauses need two resumes', idle.idleLockPaused());
outer();
check('…and then the clock runs', !idle.idleLockPaused());
idle.clearIdleClock();
check('sign-out forgets the clock', idle.readLastActive() === 0 && session.getItem('nalammesh-last-active') === null);

// ── 3. session ──────────────────────────────────────────────────────────────
print('\n3. SESSION');
const store = useAuthStore.getState();
store.login({
    userId: 'u-anm-kothi', name: 'Asha Test', role: 'ANM', staffId: 'ANM-01',
    facilityId: 'sc-kothi', facilityName: 'Sub Centre Kothi', facilityType: 'SC',
    token: 'tok', tokenExpiresAt: Date.now() + 3_600_000,
});
check('signing in starts the idle clock', idle.readLastActive() > 0);
useAuthStore.getState().lock();
let s = useAuthStore.getState().session;
check('lock marks the session locked', s?.locked === true);
check('…and keeps the session and its token (sync carries on)', s?.userId === 'u-anm-kothi' && s?.token === 'tok');
const persisted = JSON.parse(session.getItem('nalammesh-staff-session') ?? '{}');
check('the lock is in stored session state, so a reload stays locked', persisted?.state?.session?.locked === true,
    JSON.stringify(persisted).slice(0, 160));
useAuthStore.getState().unlock();
s = useAuthStore.getState().session;
check('unlock clears it', s?.locked === false);
useAuthStore.getState().lock();
useAuthStore.getState().logout();
check('sign-out ends a locked session entirely', useAuthStore.getState().session === null);

// ── 4. unlock ───────────────────────────────────────────────────────────────
print('\n4. UNLOCK');
const pinHash = await hashPin('2468', 1000);
const deviceCopy = {
    id: 'u-anm-kothi', name: 'Asha Test', role: 'ANM', staffId: 'ANM-01', facilityId: 'sc-kothi',
    active: true, pinHash,
} as unknown as Parameters<typeof unlockWithPin>[2];

relay = () => new Response(JSON.stringify({ token: 'fresh', expiresAt: Date.now() + 3_600_000 }), { status: 200 });
let r = await unlockWithPin('u-anm-kothi', '2468', deviceCopy);
check('relay reachable and PIN right → unlocked with a fresh token', r.ok && r.mode === 'NETWORK' && r.token === 'fresh', JSON.stringify(r));
check('…asked about the signed-in user, not anyone else', calls.at(-1)?.body?.userId === 'u-anm-kothi');

relay = () => new Response(JSON.stringify({ error: 'Wrong PIN — 4 attempts left' }), { status: 401 });
r = await unlockWithPin('u-anm-kothi', '2468', deviceCopy);
check("the relay's refusal is final — no fallback to the device's copy", !r.ok && /Wrong PIN/.test(r.message), JSON.stringify(r));

relay = () => { throw new TypeError('fetch failed'); };
r = await unlockWithPin('u-anm-kothi', '2468', deviceCopy);
check('relay unreachable → the device checks its own copy of the hash', r.ok && r.mode === 'OFFLINE', JSON.stringify(r));
r = await unlockWithPin('u-anm-kothi', '1357', deviceCopy);
check('…and refuses a wrong PIN', !r.ok && /Wrong PIN/.test(r.message), JSON.stringify(r));
r = await unlockWithPin('u-dho', '2468', undefined);
check('a user whose hash this device does not hold cannot unlock offline — told to sign out',
    !r.ok && /Sign out/.test(r.message), JSON.stringify(r));
const before = calls.length;
r = await unlockWithPin('u-anm-kothi', '2468', { ...deviceCopy!, active: false });
check('a deactivated account is refused before any network call', !r.ok && calls.length === before, JSON.stringify(r));
r = await unlockWithPin('u-anm-kothi', '12', deviceCopy);
check('a malformed PIN is refused at once', !r.ok && /4–6 digit/.test(r.message));

// ── 5. queue ────────────────────────────────────────────────────────────────
print('\n5. QUEUE');
const now = new Date(2026, 9, 10, 12, 0, 0);
const at = (h: number, m: number, day = 10) => new Date(2026, 9, day, h, m, 0).toISOString();
const tokens = [
    { status: 'COMPLETED', registeredAt: at(9, 0), calledAt: at(9, 20), completedAt: at(9, 35), consultingDoctor: 'Dr A' },
    { status: 'COMPLETED', registeredAt: at(9, 30), calledAt: at(10, 10), completedAt: at(10, 25), consultingDoctor: 'Dr B' },
    { status: 'IN_CONSULTATION', registeredAt: at(10, 0), calledAt: at(10, 30), consultingDoctor: 'Dr A' },
    { status: 'WAITING', registeredAt: at(11, 0) },
    { status: 'COMPLETED', registeredAt: at(9, 0, 9), calledAt: at(9, 50, 9), completedAt: at(10, 0, 9), consultingDoctor: 'Dr C' },
] as Parameters<typeof queueStats>[0];
const stats = queueStats(tokens, now);
check('consulted today counts only today\'s completed tokens', stats.consultedToday === 2, String(stats.consultedToday));
check('average wait is registration → call, over today\'s called tokens ((20+40+30)/3 = 30)', stats.averageWaitMinutes === 30, String(stats.averageWaitMinutes));
check('longest wait includes someone still waiting (60 min since 11:00)', stats.longestWaitMinutes === 60, String(stats.longestWaitMinutes));
check('doctors are counted once each, today only', stats.doctorsToday === 2, String(stats.doctorsToday));
const empty = queueStats([], now);
check('an empty day has no figures to invent: zero consulted, no averages',
    empty.consultedToday === 0 && empty.averageWaitMinutes === null && empty.longestWaitMinutes === null && empty.doctorsToday === null,
    JSON.stringify(empty));
check('a token waiting 45 minutes shows 45', minutesWaiting({ registeredAt: at(11, 15) }, now) === 45);
check('a bad timestamp shows nothing rather than NaN', minutesWaiting({ registeredAt: 'not a date' }, now) === null);

check('TV: three names → first name and initials', maskedName('Sunita Ramdas Kowe') === 'Sunita R. K.', maskedName('Sunita Ramdas Kowe'));
check('TV: one name is left as it is', maskedName('Lakshmi') === 'Lakshmi');
check('TV: extra spaces are ignored', maskedName('  Ravi   Atram ') === 'Ravi A.', maskedName('  Ravi   Atram '));
const devanagari = maskedName('सुनीता क्षीरसागर');
check('TV: a Devanagari initial is a whole letter, never a dangling half-letter (virama)',
    devanagari.startsWith('सुनीता ') && devanagari.endsWith('.') && !devanagari.includes('\u094D.'), devanagari);

print('');
if (failures) {
    print(`${failures} check(s) FAILED`);
    process.exit(1);
}
print('All checks passed — idle sessions lock and unlock only with the PIN, and the queue shows real figures.\n');
