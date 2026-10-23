/**
 * Durable upload outbox.
 *
 * The device is the source of truth and works with no network at all. This is
 * the part that notices connectivity has come back and pushes what was recorded
 * meanwhile up to the district cloud, so the receiving hospital can see who is
 * coming and ready equipment before the ambulance arrives.
 *
 * Design constraints, in order of importance:
 *
 *   1. It cannot break the offline path. Every entry point is fire-and-forget
 *      and swallows its own errors; a store that enqueues never awaits a network
 *      call, so killing the backend changes nothing about using the app.
 *   2. It cannot silently lose a record. Retryable failures stay queued forever
 *      with backoff — a referral dropped after N attempts is a patient nobody is
 *      expecting. Only a record the server permanently refuses leaves the queue,
 *      and that is surfaced to the worker rather than logged and forgotten.
 *   3. It cannot reorder history. Items upload oldest-change-first, one at a
 *      time, because the server resolves conflicts last-write-wins.
 */

import {
    addToSyncQueue,
    getPatient,
    getSyncQueue,
    getSyncQueueDepth,
    removeFromSyncQueue,
} from '@/lib/db';
import type { Patient, ReferralRecord, SyncQueueItem } from '@/types/patient';
import { hasCloudIdentity, uploadCareReferral, uploadPatientRecord } from './cloudRecords';

/** Backoff: 5s, 15s, 45s, … capped at 5 min so a long outage stays cheap but responsive. */
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 5 * 60 * 1000;
/** Heartbeat for the case where `online` never fires (captive portal, flaky link). */
const SWEEP_INTERVAL_MS = 60 * 1000;

function backoffMs(retryCount: number): number {
    return Math.min(BASE_DELAY_MS * Math.pow(3, retryCount), MAX_DELAY_MS);
}

// ── observers ────────────────────────────────────────────────────────────────
// The queue depth is shown to the worker ("3 records waiting to upload"), so the
// UI needs to know when it changes without polling IndexedDB on a timer.

type DepthListener = (depth: number) => void;
const listeners = new Set<DepthListener>();

export function onOutboxChange(listener: DepthListener): () => void {
    listeners.add(listener);
    void getSyncQueueDepth().then(listener).catch(() => {/* depth is cosmetic */});
    return () => listeners.delete(listener);
}

async function notify(): Promise<void> {
    if (listeners.size === 0) return;
    try {
        const depth = await getSyncQueueDepth();
        listeners.forEach((l) => l(depth));
    } catch {
        // A failed count must not take down a flush.
    }
}

export async function getOutboxDepth(): Promise<number> {
    try {
        return await getSyncQueueDepth();
    } catch {
        return 0;
    }
}

// ── enqueueing ───────────────────────────────────────────────────────────────

async function enqueue(item: SyncQueueItem): Promise<void> {
    try {
        await addToSyncQueue(item);
        await notify();
        // Opportunistic: if we happen to be online, this record leaves immediately.
        // Deliberately not awaited — the caller is a UI action, not a network op.
        void flushOutbox();
    } catch (err) {
        // The record is already persisted in its own store; failing to queue the
        // *upload* costs cloud visibility, never the record itself.
        console.warn('[outbox] could not queue record for upload:', err);
    }
}

/**
 * Queue a patient record for the cloud.
 *
 * The queue is keyed by entity, so repeated edits to the same patient collapse
 * into one pending upload carrying the latest version — a worker correcting a
 * vital three times does not send three records.
 */
export function queuePatient(patient: Patient): Promise<void> {
    return enqueue({
        id: `patient:${patient.id}`,
        patientId: patient.id,
        entityType: 'PATIENT',
        data: patient,
        retryCount: 0,
        createdAt: new Date().toISOString(),
    });
}

/**
 * Queue a referral, and the patient record it refers to.
 *
 * Both are sent because the referral alone is only a name and a reason. What
 * lets the receiving team ready the right equipment is the record behind it —
 * vitals, risk flags, history. The two upload independently, so if one arrives
 * without the other the board still shows that someone is coming.
 */
export async function queueReferral(referral: ReferralRecord): Promise<void> {
    await enqueue({
        id: `referral:${referral.id}`,
        patientId: referral.patientId,
        entityType: 'REFERRAL',
        data: referral,
        retryCount: 0,
        createdAt: new Date().toISOString(),
    });

    try {
        const patient = await getPatient(referral.patientId);
        if (patient) await queuePatient(patient);
    } catch (err) {
        // The referral is already queued; the hand-off happens either way, just
        // with less detail for the receiving team.
        console.warn('[outbox] could not attach the patient record to a referral:', err);
    }
}

/** Where a record has got to on its way to the district cloud. */
export type UploadStatus =
    /** Still on this device, waiting for connectivity or its next retry. */
    | 'PENDING'
    /** The cloud refused it. It is kept, but it will not arrive without a fix. */
    | 'BLOCKED'
    /** It reached the district service and is visible to the receiving facility. */
    | 'UPLOADED'
    /** The queue could not be read — say so rather than claiming either outcome. */
    | 'UNKNOWN';

/**
 * Whether a specific record has reached the cloud yet.
 *
 * Screens that tell a worker "the receiving hospital can see this" have to read
 * this rather than assume it: enqueueing is instant and always succeeds, while
 * the upload behind it may be minutes away or not happen at all. An item leaves
 * the queue only on a confirmed 2xx, so absence is the one safe positive signal.
 */
export async function uploadStatusOf(
    entityType: SyncQueueItem['entityType'],
    entityId: string
): Promise<UploadStatus> {
    const key = `${entityType === 'REFERRAL' ? 'referral' : 'patient'}:${entityId}`;
    try {
        const item = (await getSyncQueue()).find((i) => i.id === key);
        if (!item) return 'UPLOADED';
        return item.blockedReason ? 'BLOCKED' : 'PENDING';
    } catch {
        return 'UNKNOWN';
    }
}

// ── flushing ─────────────────────────────────────────────────────────────────

let flushing = false;
/**
 * Set when a flush is asked for while one is running. That pass listed what was
 * due when it began, so a record queued since — an emergency referral queued a
 * moment after its patient — is not in it, and would otherwise wait for the
 * minute sweep: a minute the receiving team would not have to prepare.
 */
let flushAgain = false;

/**
 * Push everything due up to the cloud. Safe to call at any time, from anywhere:
 * it returns immediately when offline or on any error; called while a pass is
 * running, it returns at once and that pass runs again when it ends.
 *
 * Resolves to the number of records that reached the cloud in this pass.
 */
export async function flushOutbox(): Promise<number> {
    if (flushing) {
        flushAgain = true;
        return 0;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
    // Nobody signed in with a relay token: the service would answer 401 to every
    // record. They stay queued, untouched, and go up on the first flush after a
    // sign-in — ReferralRuntime flushes when the session changes.
    if (!hasCloudIdentity()) return 0;

    flushing = true;
    let sent = 0;
    try {
        const now = Date.now();
        const due = (await getSyncQueue()).filter(
            (item) =>
                !item.blockedReason &&
                (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now)
        );

        for (const item of due) {
            const changedAt = new Date(item.createdAt).toISOString();
            const outcome =
                item.entityType === 'REFERRAL'
                    ? await uploadCareReferral(item.data as ReferralRecord, changedAt)
                    : await uploadPatientRecord(item.data as Patient, changedAt);

            if (outcome.ok) {
                await removeFromSyncQueue(item.id);
                sent += 1;
                continue;
            }

            if (!outcome.retryable) {
                // The cloud refused this record outright. Retrying it every minute
                // would block every record behind it, so it is set aside — but not
                // deleted. A refusal almost always means a bug on this side, and
                // throwing the record away would destroy both the evidence and the
                // patient's hand-off. It is retried on the next app start, which is
                // when a corrected build would reach the device.
                await addToSyncQueue({
                    ...item,
                    retryCount: item.retryCount + 1,
                    blockedReason: outcome.detail,
                    lastError: outcome.reason,
                });
                console.error(
                    `[outbox] cloud refused ${item.id}; set aside until the next app start: ${outcome.detail}`
                );
                reportRejection(item, outcome.detail);
                continue;
            }

            // Retryable. Stop the whole pass on a connectivity failure rather than
            // hammering a dead endpoint once per queued record.
            await addToSyncQueue({
                ...item,
                retryCount: item.retryCount + 1,
                nextAttemptAt: new Date(now + backoffMs(item.retryCount)).toISOString(),
                lastError: outcome.reason,
            });
            if (outcome.reason === 'offline' || outcome.reason === 'unreachable') break;
        }
    } catch (err) {
        console.warn('[outbox] flush aborted:', err);
    } finally {
        flushing = false;
        await notify();
    }
    if (flushAgain) {
        flushAgain = false;
        sent += await flushOutbox();
    }
    return sent;
}

/**
 * Tell the worker when a record will never reach the cloud.
 *
 * This is the one failure the queue cannot fix by waiting, so it must not stay
 * in the console: the referring staff need to know the receiving facility will
 * not see this case and to phone ahead instead.
 */
function reportRejection(item: SyncQueueItem, detail: string): void {
    const what = item.entityType === 'REFERRAL' ? 'Referral' : 'Patient record';
    void import('react-hot-toast')
        .then(({ default: toast }) => {
            toast.error(
                `${what} could not be uploaded to the district cloud — it is saved on this device only. Inform the receiving facility directly.`,
                { duration: 8000 }
            );
        })
        .catch(() => console.error(`[outbox] ${what} ${item.id} rejected: ${detail}`));
}

/**
 * Give every set-aside record one more chance.
 *
 * Called on app start: if the refusal was caused by a bug in how this app builds
 * the upload, the build that fixes it arrives exactly here.
 */
async function retryBlocked(): Promise<void> {
    try {
        const blocked = (await getSyncQueue()).filter((item) => item.blockedReason);
        for (const item of blocked) {
            const { blockedReason, ...rest } = item;
            await addToSyncQueue({ ...rest, nextAttemptAt: undefined });
        }
        if (blocked.length > 0) {
            console.info(`[outbox] retrying ${blocked.length} previously refused record(s)`);
        }
    } catch (err) {
        console.warn('[outbox] could not requeue refused records:', err);
    }
}

// ── lifecycle ────────────────────────────────────────────────────────────────

let started = false;

/**
 * Start watching for connectivity. Idempotent; returns a stop function.
 *
 * Mounted once from the app shell. The `online` event is the main trigger — the
 * moment a device walking back into coverage can upload — with a slow sweep
 * behind it because that event is unreliable on mobile Chrome and does not fire
 * at all when the link was up but the server was down.
 */
export function startOutbox(): () => void {
    if (typeof window === 'undefined' || started) return () => {};
    started = true;

    const onOnline = () => void flushOutbox();
    const sweep = window.setInterval(() => void flushOutbox(), SWEEP_INTERVAL_MS);
    window.addEventListener('online', onOnline);

    void retryBlocked().then(() => flushOutbox());

    return () => {
        window.removeEventListener('online', onOnline);
        window.clearInterval(sweep);
        started = false;
    };
}
