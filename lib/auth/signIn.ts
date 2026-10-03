/**
 * Staff sign-in: prove the PIN, get a token where the network allows.
 *
 *   relay reachable    the relay checks the PIN, counts failures, and returns
 *                      a signed token. Its "wrong PIN" and "locked" answers are
 *                      final — this device never falls back to checking the PIN
 *                      itself to get round them.
 *   relay unreachable  this device checks the PIN against the directory's hash,
 *                      with its own lockout. The session has no token: the app
 *                      works, and nothing reaches the network until the user
 *                      re-enters the PIN while connected (NetworkSignIn).
 *
 * @module lib/auth/signIn
 */

import { relayBaseUrl } from '@/lib/socket';
import { blockedAsMixedContent } from '@/lib/cloudEndpoint';
import { PIN_PATTERN, verifyPin } from './pin';
import type { StaffUser } from './users';

export type SignInResult =
    | { ok: true; mode: 'NETWORK'; token: string; expiresAt: number }
    | { ok: true; mode: 'OFFLINE' }
    | { ok: false; message: string };

const LOCAL_MAX_FAILURES = 5;
const LOCAL_LOCKOUT_MS = 5 * 60 * 1000;
const failureKey = (userId: string) => `nalammesh-pin-failures:${userId}`;

function localFailures(userId: string): { count: number; until: number } {
    try {
        const f = JSON.parse(localStorage.getItem(failureKey(userId)) ?? 'null') as { count: number; until: number } | null;
        return f && f.until > Date.now() ? f : { count: 0, until: 0 };
    } catch {
        return { count: 0, until: 0 };
    }
}

function recordLocalFailure(userId: string): number {
    const f = localFailures(userId);
    const next = { count: f.count + 1, until: f.until || Date.now() + LOCAL_LOCKOUT_MS };
    try {
        localStorage.setItem(failureKey(userId), JSON.stringify(next));
    } catch {
        /* private mode: the relay's lockout still applies online */
    }
    return next.count;
}

function clearLocalFailures(userId: string): void {
    try {
        localStorage.removeItem(failureKey(userId));
    } catch {
        /* private mode */
    }
}

type RelayAnswer =
    | { kind: 'token'; token: string; expiresAt: number }
    | { kind: 'refused'; message: string }
    | { kind: 'unreachable' };

/** Ask the relay. Only a network failure, a timeout or a relay without sign-in counts as unreachable. */
export async function relaySignIn(userId: string, pin: string, timeoutMs = 6000): Promise<RelayAnswer> {
    const url = `${relayBaseUrl()}/api/auth/login`;
    if (blockedAsMixedContent(url)) return { kind: 'unreachable' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pin }),
            signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as { token?: string; expiresAt?: number; error?: string };
        if (response.ok && body.token && body.expiresAt) return { kind: 'token', token: body.token, expiresAt: body.expiresAt };
        if (response.status === 503 || response.status >= 500 || response.status === 404) return { kind: 'unreachable' };
        return { kind: 'refused', message: body.error ?? `Sign-in refused (HTTP ${response.status})` };
    } catch {
        return { kind: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}

export async function signInStaff(user: StaffUser, pin: string): Promise<SignInResult> {
    if (!PIN_PATTERN.test(pin)) return { ok: false, message: 'Enter your 4–6 digit PIN' };
    if (!user.active) return { ok: false, message: 'This account is deactivated' };

    const answer = await relaySignIn(user.id, pin);
    if (answer.kind === 'token') {
        clearLocalFailures(user.id);
        return { ok: true, mode: 'NETWORK', token: answer.token, expiresAt: answer.expiresAt };
    }
    if (answer.kind === 'refused') return { ok: false, message: answer.message };
    return checkOnThisDevice(user, pin);
}

/** No relay: check the PIN against this device's copy of the user, with its own lockout. */
async function checkOnThisDevice(user: StaffUser, pin: string): Promise<SignInResult> {
    if (!user.active) return { ok: false, message: 'This account is deactivated' };
    if (!user.pinHash) {
        return {
            ok: false,
            message: user.pinHashWithheld
                ? 'This device cannot check your PIN offline — you are not posted at its facility. Sign in while connected to the network.'
                : 'No PIN has been set for this account — ask the Super Admin to set one',
        };
    }
    if (localFailures(user.id).count >= LOCAL_MAX_FAILURES) {
        return { ok: false, message: 'Too many wrong PINs on this device — try again in a few minutes' };
    }
    if (!(await verifyPin(pin, user.pinHash))) {
        const count = recordLocalFailure(user.id);
        return {
            ok: false,
            message: count >= LOCAL_MAX_FAILURES
                ? 'Too many wrong PINs on this device — try again in a few minutes'
                : `Wrong PIN — ${LOCAL_MAX_FAILURES - count} attempt(s) left`,
        };
    }
    clearLocalFailures(user.id);
    return { ok: true, mode: 'OFFLINE' };
}

type StaffIdAnswer =
    | { kind: 'token'; token: string; expiresAt: number; user: StaffUser }
    | { kind: 'refused'; message: string }
    | { kind: 'unreachable' };

/** Ask the relay by Staff ID — how a device that knows no one yet signs its user in. */
async function relayStaffIdSignIn(staffId: string, pin: string, timeoutMs = 6000): Promise<StaffIdAnswer> {
    const url = `${relayBaseUrl()}/api/auth/login`;
    if (blockedAsMixedContent(url)) return { kind: 'unreachable' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId, pin }),
            signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as { token?: string; expiresAt?: number; user?: StaffUser; error?: string };
        if (response.ok && body.token && body.expiresAt && body.user) return { kind: 'token', token: body.token, expiresAt: body.expiresAt, user: body.user };
        if (response.status === 503 || response.status >= 500 || response.status === 404) return { kind: 'unreachable' };
        return { kind: 'refused', message: body.error ?? `Sign-in refused (HTTP ${response.status})` };
    } catch {
        return { kind: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}

export type StaffIdSignInResult =
    | { ok: true; user: StaffUser; mode: 'NETWORK'; token: string; expiresAt: number }
    | { ok: true; user: StaffUser; mode: 'OFFLINE' }
    | { ok: false; message: string };

/**
 * Sign in with a Staff ID and PIN. Online, the relay finds the account; with
 * no relay, only someone this device already knows (with their PIN hash) can
 * sign in, exactly as by name.
 */
export async function signInWithStaffId(staffId: string, pin: string, directory: readonly StaffUser[]): Promise<StaffIdSignInResult> {
    const id = staffId.trim().toUpperCase();
    if (!id) return { ok: false, message: 'Enter your Staff ID' };
    if (!PIN_PATTERN.test(pin)) return { ok: false, message: 'Enter your 4–6 digit PIN' };
    const answer = await relayStaffIdSignIn(id, pin);
    if (answer.kind === 'token') return { ok: true, user: answer.user, mode: 'NETWORK', token: answer.token, expiresAt: answer.expiresAt };
    if (answer.kind === 'refused') return { ok: false, message: answer.message };
    const known = directory.find(u => u.staffId.trim().toUpperCase() === id);
    if (!known) return { ok: false, message: 'The network cannot be reached and this device has not seen that Staff ID — sign in once while connected.' };
    const local = await checkOnThisDevice(known, pin);
    return local.ok ? { ok: true, user: known, mode: 'OFFLINE' } : local;
}

