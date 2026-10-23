/**
 * How referral changes travel between the places a user can be.
 *
 *   another tab on this device   BroadcastChannel ('nalammesh-sync')
 *   another device on the mesh   Socket.IO through the relay — the primary path
 *   the relay over plain HTTP    polled every 10 s while the websocket is down
 *
 * Everything that arrives is handed to the stores, which merge it with what
 * the device already holds (lib/referrals/workflow mergeReferral). The
 * transport carries; it never decides which copy wins, and it never pretends
 * something was delivered: every publish reports ACKED, REFUSED (the relay's
 * role check said no) or UNAVAILABLE, and the caller shows the difference.
 *
 * Identity is the signed session token the relay issued at sign-in
 * (lib/auth/signIn.ts): `Authorization: Bearer` over HTTP, the socket's `auth`
 * on connecting. A session signed in offline has no token, so its changes stay
 * on the device (UNAVAILABLE) until the user re-enters their PIN online.
 */

import { getSocket, redialIfGaveUp, relayBaseUrl, relayUsesSockets, reportRelayReachable } from '@/lib/socket';
import { useAuthStore, type StaffSession } from '@/stores/authStore';
import { blockedAsMixedContent } from '@/lib/cloudEndpoint';
import { REFERRAL_TIMING } from './config';
import type { ReferralRecord } from '@/types/patient';
import type { NotificationRecord } from '@/types/referral';
import type { FacilityResources, MaintenanceTicket } from '@/types/resources';
import type { StaffUser } from '@/lib/auth/users';

export type SyncMessage =
    | { kind: 'referral'; referral: ReferralRecord; notifications: NotificationRecord[] }
    | { kind: 'resources'; resources: FacilityResources }
    | { kind: 'ticket'; ticket: MaintenanceTicket }
    | { kind: 'user'; user: StaffUser }
    | { kind: 'reset' };

export type RelayOutcome =
    | { status: 'ACKED' }
    | { status: 'REFUSED'; reason: string }
    /** The change includes another user's that has not reached the relay yet — retry shortly. */
    | { status: 'DEFERRED'; reason: string }
    | { status: 'UNAVAILABLE' };

/**
 * The answers with which the relay says no (server/relay/app.ts): a bad
 * request, or a role that may not do this. 401 is different — the session's
 * token is missing or no longer accepted — and is handled as "not sent yet"
 * while the user signs in again. Any other failure — a 404 from whatever else
 * is listening on the relay's port, a 5xx — means the relay never took the
 * change, which is UNAVAILABLE, not a refusal.
 */
export const RELAY_REFUSAL_STATUSES: ReadonlySet<number> = new Set([400, 403]);

/** Who is acting, and the token that proves it. */
export interface WireActor {
    userId: string;
    name: string;
    role: string;
    facilityId: string | null;
    token?: string | null;
}

/** The actor for a session — the tab's own, or a simulation pane's. */
export function wireOf(s: StaffSession | null): WireActor | null {
    return s ? { userId: s.userId, name: s.name, role: s.role, facilityId: s.facilityId, token: s.token ?? null } : null;
}

const CHANNEL_NAME = 'nalammesh-sync';
const LAST_SEEN_KEY = 'nalammesh-referral-sync-at';

let channel: BroadcastChannel | null = null;
const handlers = new Set<(message: SyncMessage) => void>();

function dispatch(message: SyncMessage): void {
    handlers.forEach(handler => {
        try {
            handler(message);
        } catch (error) {
            console.error('Sync handler failed:', error);
        }
    });
}

function getChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<SyncMessage>) => dispatch(event.data);
    }
    return channel;
}

/** Subscribe to changes arriving from other tabs, other devices or the relay. */
export function onSyncMessage(handler: (message: SyncMessage) => void): () => void {
    handlers.add(handler);
    getChannel();
    return () => {
        handlers.delete(handler);
    };
}

function tabToken(): string | null {
    const s = useAuthStore.getState().session;
    return s?.token && (s.tokenExpiresAt ?? 0) > Date.now() ? s.token : null;
}

/** Headers proving who is asking — empty when the session has no token. */
export function identityHeaders(token: string | null = tabToken()): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The relay stopped accepting this tab's token: drop it so the user is asked for their PIN. */
function tokenRejected(token: string | null): void {
    const s = useAuthStore.getState().session;
    if (token && s?.token === token) useAuthStore.getState().dropToken();
}

/**
 * How far this device has caught up with the relay — per user. What one user
 * may see is not what another may (a DHO sees every facility's referrals, an
 * MO their own), so on a shared device one user's progress must not stand for
 * another's, and nobody's moves while signed out. Null when nobody is signed in.
 */
function lastSeenKey(): string | null {
    const userId = useAuthStore.getState().session?.userId;
    return userId ? `${LAST_SEEN_KEY}:${userId}` : null;
}

function readLastSeen(key: string | null = lastSeenKey()): number {
    if (!key) return 0;
    try {
        return Number(localStorage.getItem(key)) || 0;
    } catch {
        return 0;
    }
}

function writeLastSeen(key: string | null, value: number): void {
    if (!key) return;
    try {
        localStorage.setItem(key, String(value));
    } catch {
        /* private mode — the next catch-up simply asks for more */
    }
}

function socketOrNull() {
    try {
        return getSocket();
    } catch {
        return null;
    }
}

export function relayConnected(): boolean {
    return Boolean(socketOrNull()?.connected);
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    // Fails the way fetch would, without the browser's console error each retry.
    if (blockedAsMixedContent(url)) throw new TypeError(`Blocked by the browser: ${url} is plain HTTP from an HTTPS page`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Send to the relay as `actor`: over the tab's websocket when the actor is the
 * tab's own user, otherwise (and when the socket is down) over HTTP with the
 * actor's own token. No token, nothing sent — the change waits on this device.
 */
async function toRelay(event: string, path: string, payload: object, actor: WireActor | null): Promise<RelayOutcome> {
    const own = tabToken();
    const token = actor ? (actor.token ?? null) : own;
    if (!token) return { status: 'UNAVAILABLE' };
    const socket = socketOrNull();
    if (socket?.connected && token === own) {
        return new Promise(resolve => {
            socket.timeout(5000).emit(event, payload, (err: Error | null, ack?: { ok: boolean; reason?: string; retry?: boolean }) => {
                if (err) resolve({ status: 'UNAVAILABLE' });
                else if (ack?.ok) resolve({ status: 'ACKED' });
                else if (ack?.retry) resolve({ status: 'DEFERRED', reason: ack.reason ?? 'Waiting for another change to arrive' });
                else resolve({ status: 'REFUSED', reason: ack?.reason ?? 'Refused by the relay' });
            });
        });
    }
    try {
        const response = await fetchWithTimeout(
            `${relayBaseUrl()}${path}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...identityHeaders(token) },
                body: JSON.stringify(payload),
            },
            6000
        );
        if (response.ok) return { status: 'ACKED' };
        const body = (await response.json().catch(() => ({}))) as { error?: string; retry?: boolean };
        if (response.status === 401) {
            tokenRejected(token);
            return { status: 'UNAVAILABLE' };
        }
        if (response.status === 409 && body.retry) return { status: 'DEFERRED', reason: body.error ?? 'Waiting for another change to arrive' };
        if (RELAY_REFUSAL_STATUSES.has(response.status)) return { status: 'REFUSED', reason: body.error ?? `HTTP ${response.status}` };
        return { status: 'UNAVAILABLE' };
    } catch {
        return { status: 'UNAVAILABLE' };
    }
}

/**
 * Publish a referral and the notifications its latest change produced.
 * Other tabs always get it; the relay's answer is returned.
 */
export function publishReferral(
    referral: ReferralRecord,
    notifications: NotificationRecord[],
    actor: WireActor | null
): Promise<RelayOutcome> {
    getChannel()?.postMessage({ kind: 'referral', referral, notifications } satisfies SyncMessage);
    return toRelay('referral:publish', '/api/referrals/publish', { referral, notifications }, actor);
}

export function publishResources(resources: FacilityResources, actor: WireActor | null, reason: 'MANAGE' | 'OCCUPANCY'): Promise<RelayOutcome> {
    getChannel()?.postMessage({ kind: 'resources', resources } satisfies SyncMessage);
    return toRelay('resources:publish', '/api/resources/publish', { resources, reason }, actor);
}

export function publishTicket(ticket: MaintenanceTicket, actor: WireActor | null): Promise<RelayOutcome> {
    getChannel()?.postMessage({ kind: 'ticket', ticket } satisfies SyncMessage);
    return toRelay('ticket:publish', '/api/tickets/publish', { ticket }, actor);
}

export function publishUser(user: StaffUser, actor: WireActor | null): Promise<RelayOutcome> {
    getChannel()?.postMessage({ kind: 'user', user } satisfies SyncMessage);
    return toRelay('user:publish', '/api/users/publish', { user }, actor);
}

/**
 * The demo data was reset on this device. Every store in this tab reloads, and
 * so does every other tab (they share this device's IndexedDB). Other devices
 * hear about it through the relay's existing data:reset broadcast.
 */
export function announceReset(): void {
    dispatch({ kind: 'reset' });
    getChannel()?.postMessage({ kind: 'reset' } satisfies SyncMessage);
}

interface CatchUpBatch {
    referrals?: Array<{ referral: ReferralRecord; notifications: NotificationRecord[] }>;
    resources?: FacilityResources[];
    tickets?: MaintenanceTicket[];
    users?: StaffUser[];
    serverTime?: number;
}

/** Apply what the relay sent; `cursor` is the key of the user who asked, read when they asked. */
function applyBatch(batch: CatchUpBatch | undefined, cursor: string | null): void {
    if (!batch) return;
    batch.referrals?.forEach(r => dispatch({ kind: 'referral', referral: r.referral, notifications: r.notifications ?? [] }));
    batch.resources?.forEach(resources => dispatch({ kind: 'resources', resources }));
    batch.tickets?.forEach(ticket => dispatch({ kind: 'ticket', ticket }));
    batch.users?.forEach(user => dispatch({ kind: 'user', user }));
    if (typeof batch.serverTime === 'number') writeLastSeen(cursor, batch.serverTime);
}

/**
 * Start listening. Called once, by the app shell.
 *
 * `onReachable` runs whenever the relay is reached — on (re)connect, and on a
 * successful HTTP poll — so the referral store can push what it made while
 * the relay was away (referrals still CREATED, changes since last push).
 */
export function startTransport(onReachable: () => void): () => void {
    getChannel();
    const socket = socketOrNull();
    if (!socket) return () => undefined;

    const identify = () => {
        if (socket.connected) socket.emit('session:identify', { token: tabToken() });
    };
    const catchUp = () => {
        identify();
        const cursor = lastSeenKey();
        socket.timeout(8000).emit('referral:catchup', { since: readLastSeen(cursor) }, (err: Error | null, batch?: CatchUpBatch) => {
            if (!err) applyBatch(batch, cursor);
        });
        onReachable();
    };

    const onReferral = (m: { referral: ReferralRecord; notifications?: NotificationRecord[] }) =>
        dispatch({ kind: 'referral', referral: m.referral, notifications: m.notifications ?? [] });
    const onResources = (m: { resources: FacilityResources }) => dispatch({ kind: 'resources', resources: m.resources });
    const onTicket = (m: { ticket: MaintenanceTicket }) => dispatch({ kind: 'ticket', ticket: m.ticket });
    const onUser = (m: { user: StaffUser }) => dispatch({ kind: 'user', user: m.user });

    socket.on('connect', catchUp);
    socket.on('referral:update', onReferral);
    socket.on('resources:update', onResources);
    socket.on('ticket:update', onTicket);
    socket.on('user:update', onUser);
    if (socket.connected) catchUp();

    // Re-identify whenever the tab's user changes, so the relay scopes what it
    // forwards to this socket to what this user may see.
    const unsubscribeSession = useAuthStore.subscribe((state, previous) => {
        if (state.session?.userId !== previous.session?.userId || state.session?.token !== previous.session?.token) {
            identify();
            if (state.session) catchUp();
            if (!socket.connected) void poll();
        }
    });

    // The websocket can be blocked where plain HTTP is not (some proxies, some
    // captive networks), and a hosted relay has none: poll while it is down.
    // With no token there is nothing to fetch, so the poll only checks the
    // relay is there — which is what offers the user a network sign-in.
    let polling = false;
    const poll = async () => {
        if (socket.connected || polling) return;
        polling = true;
        const token = tabToken();
        try {
            // socket.io gives up after a few failed attempts; when the relay is
            // back, dial again rather than stay standalone until a reload. Never
            // while socket.io is still dialling itself (lib/socket.ts).
            const redial = () => { if (relayUsesSockets()) redialIfGaveUp(); };
            if (!token) {
                const health = await fetchWithTimeout(`${relayBaseUrl()}/health`, {}, 4000);
                if (!relayUsesSockets()) reportRelayReachable(health.ok);
                if (health.ok) redial();
                return;
            }
            const cursor = lastSeenKey();
            const response = await fetchWithTimeout(
                `${relayBaseUrl()}/api/referrals/since/${readLastSeen(cursor)}`,
                { headers: identityHeaders(token) },
                6000
            );
            if (!relayUsesSockets()) reportRelayReachable(response.ok || response.status === 401 || response.status === 403);
            if (response.status === 401) return tokenRejected(token);
            if (!response.ok) return;
            redial();
            applyBatch((await response.json()) as CatchUpBatch, cursor);
            onReachable();
        } catch {
            if (!relayUsesSockets()) reportRelayReachable(false);
        } finally {
            polling = false;
        }
    };
    void poll();
    const pollTimer = setInterval(() => void poll(), REFERRAL_TIMING.POLL_INTERVAL_MS);

    return () => {
        clearInterval(pollTimer);
        unsubscribeSession();
        socket.off('connect', catchUp);
        socket.off('referral:update', onReferral);
        socket.off('resources:update', onResources);
        socket.off('ticket:update', onTicket);
        socket.off('user:update', onUser);
    };
}
