/**
 * Referral state for the whole app — referrals, their notifications, and the
 * delivery status of each one.
 *
 * Every change goes the same way:
 *
 *   1. lib/referrals/workflow decides whether it is allowed and what it becomes
 *   2. it is written to IndexedDB (and audited there) — a failed write stops
 *      here and the screen says so; nothing is shown that was not stored
 *   3. the notifications it produced are stored
 *   4. it is published: other tabs at once, other devices through the relay,
 *      and the district cloud through the outbox
 *
 * Delivery is honest. A referral stays CREATED until something confirms it
 * left this device — the relay acknowledging it, or a user at the receiving
 * facility receiving it on a connected session. It is never marked SENT just
 * because it was saved.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import * as wf from '@/lib/referrals/workflow';
import type { ActionInput, FacilityRef, NewReferralInput } from '@/lib/referrals/workflow';
import { REFERRAL_TIMING } from '@/lib/referrals/config';
import {
    getAllReferrals,
    getNotifications,
    markNotificationsRead,
    saveNotifications,
    saveReferral,
} from '@/lib/db';
import { actorOf } from '@/lib/auth/session';
import { publishReferral, wireOf, type RelayOutcome, type WireActor } from '@/lib/referrals/transport';
import { queueReferral } from '@/lib/sync/outbox';
import { useDirectoryStore } from './directoryStore';
import { useResourceStore } from './resourceStore';
import type { StaffSession } from './authStore';
import type { ReferralRecord } from '@/types/patient';
import type { NotificationRecord } from '@/types/referral';

export type StoreResult<T = ReferralRecord> =
    | { ok: true; value: T; warning?: string }
    | { ok: false; message: string };

export interface DeliveryState {
    status: RelayOutcome['status'];
    reason?: string;
    at: string;
}

const PUSHED_AT_KEY = 'nalammesh-referrals-pushed-at';

/** Referrals being opened right now — two views of one referral must not record two openings. */
const opening = new Set<string>();

const wire = (s: StaffSession | null): WireActor | null => wireOf(s);

/**
 * Changes the relay deferred: this referral also holds another user's change
 * that has not reached the network under their own sign-in yet. Retried as the
 * user who made them (the tab's user, or a simulation pane's), backing off from
 * 3 s to a minute, until the relay accepts or refuses — then forgotten.
 */
const RETRY_FIRST_MS = 3000;
const RETRY_MAX_MS = 60_000;
const RETRY_GIVE_UP_AFTER = 30;
const deferred = new Map<string, { actor: WireActor | null; attempts: number; timer: ReturnType<typeof setTimeout> }>();

const byNewest = (a: NotificationRecord, b: NotificationRecord) => Date.parse(b.created_at) - Date.parse(a.created_at);

function referralId(): string {
    const d = new Date();
    const ymd = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `REF-${ymd}-${uuidv4().slice(0, 5).toUpperCase()}`;
}

interface ReferralStore {
    referrals: ReferralRecord[];
    notifications: NotificationRecord[];
    delivery: Record<string, DeliveryState>;
    isLoading: boolean;
    loaded: boolean;

    loadReferrals: () => Promise<void>;
    /**
     * Raise a referral. With no session — the public 108 / 102 SOS screen — it is
     * raised by the automatic dispatch actor instead of a named user.
     */
    create: (input: Omit<NewReferralInput, 'id' | 'eventId' | 'at'>, session: StaffSession | null) => Promise<StoreResult>;
    act: (
        referralId: string,
        input: Omit<ActionInput, 'actor' | 'at' | 'eventId'> & { eventId?: string },
        session: StaffSession
    ) => Promise<StoreResult>;
    /** The receiver opened it: SENT → DELIVERED. A no-op for anyone else. */
    open: (referralId: string, session: StaffSession) => Promise<void>;
    comment: (referralId: string, text: string, session: StaffSession) => Promise<StoreResult>;
    escalateOnward: (
        referralId: string,
        target: FacilityRef,
        reason: string,
        priority: ReferralRecord['priority'],
        session: StaffSession
    ) => Promise<StoreResult>;
    /** Record that a CREATED referral left the device (relay ack, or received by a peer at the target). */
    /** `actor`: who publishes the "sent" step — the creator whose publish was acknowledged; the tab's user by default. */
    confirmDelivery: (referralId: string, via: 'RELAY' | 'LOCAL_PEER', receivedBy?: string, actor?: WireActor | null) => Promise<void>;
    markRead: (ids: string[]) => Promise<void>;
    ingest: (referral: ReferralRecord, notifications: NotificationRecord[]) => Promise<void>;
    /** Run the escalation / reservation clock. Returns how many referrals it changed. */
    sweep: (
        now?: number,
        options?: { timing?: { EMERGENCY_ACK_MINUTES: number; EMERGENCY_REALERT_MINUTES: number }; note?: string; onlyIds?: string[] }
    ) => Promise<number>;
    /** Re-offer to the relay whatever it has not acknowledged yet. */
    pushPending: () => Promise<void>;
}

export const useReferralStore = create<ReferralStore>((set, get) => {
    const directory = () => useDirectoryStore.getState().users;

    /** Steps 2 and 3. Throws on a failed write so the caller can say so. */
    const persist = async (next: ReferralRecord, notifications: NotificationRecord[]) => {
        await saveReferral(next);
        const added = await saveNotifications(notifications);
        set(state => ({
            referrals: [next, ...state.referrals.filter(r => r.id !== next.id)],
            notifications: added.length ? [...added, ...state.notifications].sort(byNewest) : state.notifications,
        }));
    };

    function forgetRetry(id: string): void {
        const entry = deferred.get(id);
        if (entry) clearTimeout(entry.timer);
        deferred.delete(id);
    }

    function scheduleRetry(id: string, actor: WireActor | null): void {
        const attempts = (deferred.get(id)?.attempts ?? 0) + 1;
        forgetRetry(id);
        if (attempts > RETRY_GIVE_UP_AFTER) return; // pushPending picks it up on the next reconnect
        const delay = Math.min(RETRY_FIRST_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
        const timer = setTimeout(() => {
            const current = get().referrals.find(r => r.id === id);
            if (!current) return forgetRetry(id);
            void publishReferral(current, [], actor).then(outcome => {
                if (outcome.status === 'DEFERRED') scheduleRetry(id, actor);
                else if (outcome.status === 'UNAVAILABLE') deferred.set(id, { actor, attempts, timer: setTimeout(() => scheduleRetry(id, actor), RETRY_MAX_MS) });
                else forgetRetry(id);
                set(state => ({ delivery: { ...state.delivery, [id]: { status: outcome.status, reason: outcome.status === 'REFUSED' || outcome.status === 'DEFERRED' ? outcome.reason : undefined, at: new Date().toISOString() } } }));
                if (outcome.status === 'ACKED' && current.status === 'CREATED') void get().confirmDelivery(id, 'RELAY', undefined, actor);
            });
        }, delay);
        deferred.set(id, { actor, attempts, timer });
    }

    /** Step 4. */
    const broadcast = async (next: ReferralRecord, notifications: NotificationRecord[], actor: WireActor | null) => {
        void queueReferral(next);
        const outcome = await publishReferral(next, notifications, actor);
        set(state => ({
            delivery: {
                ...state.delivery,
                [next.id]: { status: outcome.status, reason: outcome.status === 'REFUSED' || outcome.status === 'DEFERRED' ? outcome.reason : undefined, at: new Date().toISOString() },
            },
        }));
        if (outcome.status === 'DEFERRED') scheduleRetry(next.id, actor);
        else forgetRetry(next.id);
        if (outcome.status === 'REFUSED') {
            // The relay applies the same role rules; a refusal means this device
            // and the network disagree about who may do what. Say so loudly.
            toast.error(`The mesh relay refused this change: ${outcome.reason}`, { duration: 8000 });
        }
        if (outcome.status === 'ACKED') {
            const current = get().referrals.find(r => r.id === next.id);
            if (current?.status === 'CREATED') await get().confirmDelivery(next.id, 'RELAY', undefined, actor);
        }
    };

    return {
        referrals: [],
        notifications: [],
        delivery: {},
        isLoading: false,
        loaded: false,

        loadReferrals: async () => {
            set({ isLoading: true });
            try {
                const [referrals, notifications] = await Promise.all([getAllReferrals(), getNotifications()]);
                set({ referrals, notifications, isLoading: false, loaded: true });
            } catch (error) {
                console.error('Failed to load referrals:', error);
                toast.error('Could not read referrals stored on this device');
                set({ isLoading: false, loaded: true });
            }
        },

        create: async (input, session) => {
            const actor = session ? actorOf(session) : { ...wf.SYSTEM_ACTOR, name: '108 / 102 Emergency Dispatch' };
            const result = wf.createReferral(
                { ...input, id: referralId(), eventId: uuidv4(), at: new Date().toISOString() },
                actor
            );
            if (!result.ok) return { ok: false, message: result.message };
            try {
                await persist(result.referral, []);
            } catch (error) {
                console.error('Failed to save referral:', error);
                return { ok: false, message: 'Could not save the referral on this device — nothing was sent' };
            }
            void broadcast(result.referral, [], wire(session));
            return { ok: true, value: result.referral };
        },

        act: async (referralId, input, session) => {
            const ref = get().referrals.find(r => r.id === referralId);
            if (!ref) return { ok: false, message: 'This referral is not on this device' };
            const result = wf.applyAction(ref, {
                ...input,
                actor: actorOf(session),
                at: new Date().toISOString(),
                eventId: input.eventId ?? uuidv4(),
            } as ActionInput);
            if (!result.ok) return { ok: false, message: result.message };

            const notifications = wf.notificationsFor(result.referral, result.event, directory());
            try {
                await persist(result.referral, notifications);
            } catch (error) {
                console.error('Failed to save referral change:', error);
                return { ok: false, message: `Could not save — "${wf.ACTION_LABELS[input.action]}" was not recorded` };
            }

            let warning: string | undefined;
            if (result.resourceDelta) {
                try {
                    await useResourceStore.getState().applyOccupancy(result.resourceDelta, session, referralId);
                } catch (error) {
                    warning = `${wf.ACTION_LABELS[input.action]} recorded, but the bed count was not updated: ${(error as Error).message}`;
                }
            }
            void broadcast(result.referral, notifications, wire(session));
            return { ok: true, value: result.referral, warning };
        },

        open: async (referralId, session) => {
            const ref = get().referrals.find(r => r.id === referralId);
            if (!ref || ref.status !== 'SENT' || ref.toFacilityId !== session.facilityId) return;
            if (opening.has(referralId)) return;
            opening.add(referralId);
            // One opening per delivery, whichever tab or device records it: the
            // id is derived from the send it answers, so duplicates merge away.
            const sent = wf.lastEvent(ref, 'SEND');
            const result = await get()
                .act(referralId, { action: 'OPEN', eventId: sent ? `${ref.id}:open:${sent.id}` : undefined }, session)
                .finally(() => opening.delete(referralId));
            // Opening is automatic, so a refusal (a role that receives nothing,
            // say) is not the user's error to see — but a failed write is.
            if (!result.ok && result.message.startsWith('Could not save')) toast.error(result.message);
        },

        comment: async (referralId, text, session) => {
            const ref = get().referrals.find(r => r.id === referralId);
            if (!ref) return { ok: false, message: 'This referral is not on this device' };
            const result = wf.addComment(ref, actorOf(session), text, new Date().toISOString(), uuidv4());
            if (!result.ok) return { ok: false, message: result.message };
            const notifications = wf.notificationsForComment(result.referral, result.comment, directory());
            try {
                await persist(result.referral, notifications);
            } catch {
                return { ok: false, message: 'Could not save the comment on this device' };
            }
            void broadcast(result.referral, notifications, wire(session));
            return { ok: true, value: result.referral };
        },

        escalateOnward: async (referralId, target, reason, priority, session) => {
            const ref = get().referrals.find(r => r.id === referralId);
            if (!ref) return { ok: false, message: 'This referral is not on this device' };
            if (!session.facilityId) return { ok: false, message: 'Your session has no facility' };
            const onward = await get().create(
                {
                    patient: { id: ref.patientId, name: ref.patientName, age: ref.patientAge, gender: ref.patientGender },
                    from: { id: ref.toFacilityId, name: ref.toFacilityName, type: ref.toFacilityType },
                    to: target,
                    reason,
                    priority,
                    transportMode: priority === 'EMERGENCY' ? 'AMBULANCE_108' : ref.transportMode,
                    clinicalSummary: ref.clinicalSummary,
                    vitals: ref.vitalsAtReferral,
                    parentReferralId: ref.id,
                },
                session
            );
            if (!onward.ok) return onward;
            const linked = await get().act(referralId, { action: 'ESCALATE_ONWARD', onward: { referralId: onward.value.id, facilityName: target.name } }, session);
            if (!linked.ok) {
                return { ok: true, value: onward.value, warning: `Onward referral raised, but the original could not be linked: ${linked.message}` };
            }
            return { ok: true, value: onward.value };
        },

        confirmDelivery: async (referralId, via, receivedBy, publisher = null) => {
            const ref = get().referrals.find(r => r.id === referralId);
            if (!ref || ref.status !== 'CREATED') return;
            // The send belongs to whoever raised (or re-routed) the referral.
            const trigger = [...ref.timeline].reverse().find(e => e.action === 'CREATE' || e.action === 'REROUTE');
            if (!trigger) return;
            const result = wf.applyAction(ref, {
                action: 'SEND',
                actor: trigger.actor,
                at: new Date().toISOString(),
                // One id per send, whichever device records it first.
                eventId: `${ref.id}:send:${trigger.id}`,
                sentVia: via,
                ...(receivedBy ? { note: `Received by ${receivedBy} at ${ref.toFacilityName}` } : {}),
            });
            if (!result.ok) {
                console.error('Could not record delivery:', result.message);
                return;
            }
            const notifications = wf.notificationsFor(result.referral, result.event, directory());
            try {
                await persist(result.referral, notifications);
            } catch (error) {
                console.error('Failed to save delivery:', error);
                return;
            }
            void queueReferral(result.referral);
            const outcome = await publishReferral(result.referral, notifications, publisher);
            set(state => ({ delivery: { ...state.delivery, [referralId]: { status: outcome.status, at: new Date().toISOString() } } }));
            if (outcome.status === 'DEFERRED') scheduleRetry(referralId, publisher);
        },

        markRead: async (ids) => {
            if (ids.length === 0) return;
            try {
                await markNotificationsRead(ids);
            } catch (error) {
                console.error('Failed to mark notifications read:', error);
                return;
            }
            const read = new Set(ids);
            set(state => ({ notifications: state.notifications.map(n => (read.has(n.id) ? { ...n, is_read: true } : n)) }));
        },

        ingest: async (referral, notifications) => {
            const local = get().referrals.find(r => r.id === referral.id);
            if (wf.isNewer(local, referral)) {
                const merged = wf.mergeReferral(local, referral);
                try {
                    await saveReferral(merged);
                    set(state => ({ referrals: [merged, ...state.referrals.filter(r => r.id !== merged.id)] }));
                } catch (error) {
                    console.error('Failed to store a referral from the mesh:', error);
                    toast.error(`A referral update for ${referral.patientName} could not be saved on this device`);
                    return;
                }
            }
            if (notifications.length) {
                // Re-read rather than append what was newly written: another tab
                // on this device shares the database and may already have
                // stored these rows (and marked some read), so "nothing new was
                // written" does not mean "nothing new for this tab".
                try {
                    await saveNotifications(notifications);
                    set({ notifications: await getNotifications() });
                } catch (error) {
                    console.error('Failed to store notifications from the mesh:', error);
                }
            }
        },

        sweep: async (now = Date.now(), options) => {
            const pool = options?.onlyIds ? get().referrals.filter(r => options.onlyIds!.includes(r.id)) : get().referrals;
            const updates = wf.sweepReferrals(pool, now, directory(), options?.timing ?? REFERRAL_TIMING, options?.note);
            for (const u of updates) {
                try {
                    await persist(u.referral, u.notifications);
                } catch (error) {
                    console.error('Failed to save an automatic referral change:', error);
                    continue;
                }
                void broadcast(u.referral, u.notifications, null);
            }
            return updates.length;
        },

        pushPending: async () => {
            let pushedAt = 0;
            try {
                pushedAt = Number(localStorage.getItem(PUSHED_AT_KEY)) || 0;
            } catch {
                /* private mode */
            }
            const startedAt = Date.now();
            // Referrals with a retry of their own in flight are that retry's job.
            const pending = get().referrals.filter(r => !deferred.has(r.id) && (r.status === 'CREATED' || Date.parse(r.updatedAt) > pushedAt));
            let complete = true;
            for (const ref of pending) {
                const outcome = await publishReferral(ref, [], null);
                if (outcome.status === 'UNAVAILABLE') return; // try again on the next reconnect
                // Another user's change in it has not arrived yet: carry on with the
                // rest, and keep the mark where it is so this one is pushed again.
                if (outcome.status === 'DEFERRED') complete = false;
                if (outcome.status === 'ACKED' && ref.status === 'CREATED') await get().confirmDelivery(ref.id, 'RELAY');
            }
            if (!complete) return;
            try {
                localStorage.setItem(PUSHED_AT_KEY, String(startedAt));
            } catch {
                /* private mode */
            }
        },
    };
});
