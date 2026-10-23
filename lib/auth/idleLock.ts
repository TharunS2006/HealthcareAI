/**
 * Lock a signed-in session nobody is using.
 *
 * Clinic devices are shared and get left on a desk. The session lives in
 * sessionStorage, so closing the tab ends it, but a tab left open stays signed
 * in — with the queue, the referral board and every patient record a tap away.
 * After IDLE_LOCK_MS without a touch, click, key or scroll the session locks:
 * components/auth/SessionLock.tsx covers the whole screen until the same user
 * re-enters their PIN. Nothing is lost — the page underneath keeps its state,
 * and referral sync keeps running in the background.
 *
 * NEXT_PUBLIC_SESSION_IDLE_MINUTES sets the time (default 15; 0 turns locking
 * off). The last activity time is kept in sessionStorage as well as memory, so
 * reloading the tab does not reset the clock, and a phone that slept past the
 * limit is locked when it wakes.
 *
 * A screen meant to be watched rather than used — the OPD token TV display —
 * pauses the clock (pauseIdleLock). Activity during the pause does not count,
 * so leaving that screen after the limit has passed locks at once.
 *
 * @module lib/auth/idleLock
 */

const DEFAULT_IDLE_MINUTES = 15;

/** Minutes of inactivity before a session locks; 0 means never. */
export function idleLockMinutes(raw: string | undefined = process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES): number {
    if (raw === undefined || raw.trim() === '') return DEFAULT_IDLE_MINUTES;
    const minutes = Number(raw.trim());
    return Number.isFinite(minutes) && minutes >= 0 ? minutes : DEFAULT_IDLE_MINUTES;
}

export const IDLE_LOCK_MS = idleLockMinutes() * 60_000;

/** Has the session been unused for at least `idleMs`? Never, when locking is off. */
export function isIdle(lastActiveAt: number, now: number, idleMs: number = IDLE_LOCK_MS): boolean {
    return idleMs > 0 && lastActiveAt > 0 && now - lastActiveAt >= idleMs;
}

const LAST_ACTIVE_KEY = 'nalammesh-last-active';
// Writing sessionStorage on every scroll event is wasted work; the clock is
// measured in minutes, so a write at most every 10 seconds is exact enough.
const PERSIST_EVERY_MS = 10_000;

let lastActiveAt = 0;
let lastPersistedAt = 0;
let pauses = 0;

function storage(): Storage | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        return null; // storage refused (private mode, sandboxed frame)
    }
}

/** When this tab was last used — from memory, or from storage after a reload. 0 if never. */
export function readLastActive(): number {
    if (lastActiveAt) return lastActiveAt;
    const stored = Number(storage()?.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

/** Record use of the tab. Ignored while a watched screen has paused the clock. */
export function markActive(now: number = Date.now()): void {
    if (pauses > 0) return;
    lastActiveAt = now;
    if (now - lastPersistedAt >= PERSIST_EVERY_MS) {
        lastPersistedAt = now;
        try {
            storage()?.setItem(LAST_ACTIVE_KEY, String(now));
        } catch {
            /* storage full or refused: the in-memory clock still works */
        }
    }
}

/** Start the clock again from now — after an unlock or a fresh sign-in. */
export function resetIdleClock(now: number = Date.now()): void {
    lastActiveAt = now;
    lastPersistedAt = now;
    try {
        storage()?.setItem(LAST_ACTIVE_KEY, String(now));
    } catch {
        /* as above */
    }
}

/** Forget the clock entirely — on sign-out. */
export function clearIdleClock(): void {
    lastActiveAt = 0;
    lastPersistedAt = 0;
    try {
        storage()?.removeItem(LAST_ACTIVE_KEY);
    } catch {
        /* as above */
    }
}

/** Fired on window when a pause ends, so the lock can check the clock at once. */
export const IDLE_RESUME_EVENT = 'nalammesh-idle-resume';

/**
 * Pause locking while a screen is being watched, not used. Returns the resume
 * function; calling it more than once is harmless.
 */
export function pauseIdleLock(): () => void {
    pauses += 1;
    let resumed = false;
    return () => {
        if (resumed) return;
        resumed = true;
        pauses = Math.max(0, pauses - 1);
        if (pauses === 0 && typeof window !== 'undefined') window.dispatchEvent(new Event(IDLE_RESUME_EVENT));
    };
}

export function idleLockPaused(): boolean {
    return pauses > 0;
}
