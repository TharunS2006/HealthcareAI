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
 * Identity travels with each request as x-nalammesh-* headers (HTTP) or a
 * `session:identify` event (websocket). This is mock auth — the relay checks
 * that the claimed role may do the thing, not that the claim is true — but it
 * is the same check a real backend would make with a verified token.
 */

import { getSocket, relayBaseUrl } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
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
    | { status: 'UNAVAILABLE' };

/**
 * The answers with which the relay says no (server/mesh-server.ts): a bad
 * request, no identity, or a role that may not do this. Any other failure — a
 * 404 from whatever else is listening on the relay's port, a 5xx — means the
 * relay never took the change, which is UNAVAILABLE, not a refusal.
 */
export const RELAY_REFUSAL_STATUSES: ReadonlySet<number> = new Set([400, 401, 403]);

/** Who is asking — sent with every publish so the relay can apply the role rules. */
export interface WireActor {
    userId: string;
    name: string;
    role: string;
    facilityId: string | null;
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

function tabIdentity(): WireActor | null {
    const s = useAuthStore.getState().session;
    return s ? { userId: s.userId, name: s.name, role: s.role, facilityId: s.facilityId } : null;
}

export function identityHeaders(actor: WireActor | null = tabIdentity()): Record<string, string> {
    if (!actor) return {};
    return {
        'x-nalammesh-user': actor.userId,
        'x-nalammesh-role': actor.role,
        ...(actor.facilityId ? { 'x-nalammesh-facility': actor.facilityId } : {}),
    };
}

function readLastSeen(): number {
    try {
        return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeLastSeen(value: number): void {
    try {
        localStorage.setItem(LAST_SEEN_KEY, String(value));
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

/** Send to the relay: websocket with an acknowledgement, else one HTTP attempt. */
async function toRelay(event: string, path: string, payload: object, actor: WireActor | null): Promise<RelayOutcome> {
    const socket = socketOrNull();
    if (socket?.connected) {
        return new Promise(resolve => {
            socket.timeout(5000).emit(event, { ...payload, actor }, (err: Error | null, ack?: { ok: boolean; reason?: string }) => {
                if (err) resolve({ status: 'UNAVAILABLE' });
                else if (ack?.ok) resolve({ status: 'ACKED' });
                else resolve({ status: 'REFUSED', reason: ack?.reason ?? 'Refused by the relay' });
            });
        });
    }
    try {
        const response = await fetchWithTimeout(
            `${relayBaseUrl()}${path}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...identityHeaders(actor) },
                body: JSON.stringify(payload),
            },
            4000
        );
        if (response.ok) return { status: 'ACKED' };
        if (RELAY_REFUSAL_STATUSES.has(response.status)) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            return { status: 'REFUSED', reason: body.error ?? `HTTP ${response.status}` };
        }
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

function applyBatch(batch: CatchUpBatch | undefined): void {
    if (!batch) return;
    batch.referrals?.forEach(r => dispatch({ kind: 'referral', referral: r.referral, notifications: r.notifications ?? [] }));
    batch.resources?.forEach(resources => dispatch({ kind: 'resources', resources }));
    batch.tickets?.forEach(ticket => dispatch({ kind: 'ticket', ticket }));
    batch.users?.forEach(user => dispatch({ kind: 'user', user }));
    if (typeof batch.serverTime === 'number') writeLastSeen(batch.serverTime);
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
        if (socket.connected) socket.emit('session:identify', tabIdentity());
    };
    const catchUp = () => {
        identify();
        socket.timeout(8000).emit('referral:catchup', { since: readLastSeen(), actor: tabIdentity() }, (err: Error | null, batch?: CatchUpBatch) => {
            if (!err) applyBatch(batch);
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
        if (state.session !== previous.session) {
            identify();
            if (state.session) catchUp();
        }
    });

    // Fallback: the websocket can be blocked where plain HTTP is not (some
    // proxies, some captive networks). Poll while it is down.
    const poll = setInterval(async () => {
        if (socket.connected) return;
        const identity = tabIdentity();
        if (!identity) return;
        try {
            const response = await fetchWithTimeout(
                `${relayBaseUrl()}/api/referrals/since/${readLastSeen()}`,
                { headers: identityHeaders(identity) },
                4000
            );
            if (!response.ok) return;
            applyBatch((await response.json()) as CatchUpBatch);
            onReachable();
        } catch {
            /* relay unreachable — the mesh indicator already says STANDALONE */
        }
    }, REFERRAL_TIMING.POLL_INTERVAL_MS);

    return () => {
        clearInterval(poll);
        unsubscribeSession();
        socket.off('connect', catchUp);
        socket.off('referral:update', onReferral);
        socket.off('resources:update', onResources);
        socket.off('ticket:update', onTicket);
        socket.off('user:update', onUser);
    };
}
