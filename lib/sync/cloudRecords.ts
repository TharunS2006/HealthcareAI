/**
 * Device → cloud record transport.
 *
 * These are the calls that carry a patient's record off the device to the
 * district service, so a receiving facility can open it before the ambulance
 * arrives. They are the only place that knows the wire format; lib/sync/outbox.ts
 * decides *when* to call them and what to do when they fail.
 *
 * Two rules hold throughout:
 *
 *   - Nothing throws. A failed upload must never surface as a broken screen; the
 *     record is already safe in IndexedDB and the worker's job continues offline.
 *   - Every failure says whether retrying could help. A network blip must be
 *     retried forever (dropping a referral loses a patient); a record the server
 *     refuses as malformed must not be, or it blocks the queue behind it.
 */

import { reportingBaseUrl } from '@/lib/cloudEndpoint';
import { colourForPatient, colourForPriority } from '@/lib/care/priority';
import type { Patient, ReferralRecord } from '@/types/patient';

export type UploadOutcome =
    | { ok: true; duplicate: boolean; updated: boolean }
    /** Worth another attempt later — the record stays queued. */
    | { ok: false; retryable: true; reason: 'offline' | 'unreachable' | 'timeout' | 'server'; detail?: string }
    /** The server will never accept this as-is; retrying only blocks the queue. */
    | { ok: false; retryable: false; reason: 'rejected'; detail: string };

const TIMEOUT_MS = 15000;

/** Dates cross the wire as ISO strings; the app stores them either way. */
function toIso(value: Date | string | undefined, fallback: string): string {
    if (!value) return fallback;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

/**
 * The device tracks a referral the referring clinician rejected; the cloud only
 * distinguishes "still coming" from "not coming". REJECTED maps to CANCELLED so
 * the case leaves the receiving facility's board rather than being rejected at
 * the schema boundary and retried forever.
 */
function wireStatus(status: ReferralRecord['status']): string {
    return status === 'REJECTED' ? 'CANCELLED' : status;
}

async function post(path: string, body: unknown): Promise<UploadOutcome> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { ok: false, retryable: true, reason: 'offline' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${reportingBaseUrl()}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (response.ok) {
            const receipt = (await response.json().catch(() => ({}))) as {
                duplicate?: boolean;
                updated?: boolean;
            };
            return { ok: true, duplicate: Boolean(receipt.duplicate), updated: Boolean(receipt.updated) };
        }

        // 408 and 429 are the server asking for patience, not refusing the record.
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
            const detail = await response.text().catch(() => '');
            return {
                ok: false,
                retryable: false,
                reason: 'rejected',
                detail: `HTTP ${response.status} ${detail.slice(0, 300)}`.trim(),
            };
        }
        return { ok: false, retryable: true, reason: 'server', detail: `HTTP ${response.status}` };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { ok: false, retryable: true, reason: 'timeout' };
        }
        return { ok: false, retryable: true, reason: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Which facility this record belongs to, for the service's column projection.
 *
 * A patient has no facility of their own — they are attached to one by the visit
 * that recorded them or by the referral moving them. The active referral wins
 * because it is the more recent of the two; the latest visit is the fallback for
 * a patient uploaded before anyone referred them. Null is a legitimate answer
 * (a record captured in the field, not yet at any facility) and only costs the
 * ability to filter by it — the board joins on the referral, not on this.
 */
function originFacility(patient: Patient): string | null {
    if (patient.activeReferral?.fromFacilityId) return patient.activeReferral.fromFacilityId;
    const visits = patient.visits;
    if (!visits || visits.length === 0) return null;
    const latest = visits.reduce((a, b) =>
        new Date(b.date).getTime() > new Date(a.date).getTime() ? b : a
    );
    return latest.facilityId ?? null;
}

/**
 * Upload a full patient record.
 *
 * `changedAt` is when the worker made the change on this device, which is what
 * the server orders versions by — not the upload time, which would let a
 * reconnecting device overwrite newer data with a day-old copy.
 */
export function uploadPatientRecord(patient: Patient, changedAt: string): Promise<UploadOutcome> {
    return post('/api/v1/records/patients', {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        facility_id: originFacility(patient),
        // The cloud speaks the three-colour triage scale; see lib/care/priority.ts
        // for why the conversion may only ever raise urgency.
        triage_priority: colourForPatient(patient),
        updated_at: changedAt,
        // The record itself, verbatim. The fields above are only what the service
        // sorts and filters on; this is what the receiving clinician reads.
        payload: patient,
    });
}

export function uploadCareReferral(referral: ReferralRecord, changedAt: string): Promise<UploadOutcome> {
    return post('/api/v1/records/referrals', {
        id: referral.id,
        patient_id: referral.patientId,
        from_facility_id: referral.fromFacilityId,
        to_facility_id: referral.toFacilityId,
        status: wireStatus(referral.status),
        priority: colourForPriority(referral.priority),
        reason: referral.reason ?? null,
        clinical_summary: referral.clinicalSummary ?? null,
        transport_mode: referral.transportMode ?? null,
        eta_minutes: typeof referral.etaMinutes === 'number' ? referral.etaMinutes : null,
        raised_at: toIso(referral.referredAt, changedAt),
        updated_at: changedAt,
        payload: referral,
    });
}

export interface IncomingCase {
    referral: ReferralRecord;
    /** Null when the referral reached the cloud before the patient record did. */
    patient: Patient | null;
    eta_minutes: number | null;
    raised_at: string;
    priority: string;
    status: string;
}

export type IncomingResult =
    | { ok: true; cases: IncomingCase[] }
    | { ok: false; reason: 'offline' | 'unreachable' | 'timeout' | 'error' };

/**
 * What is currently en route to a facility.
 *
 * Read-only and cloud-only by nature: these are cases raised on *other* devices,
 * so there is nothing local to fall back to. A failure returns a reason for the
 * screen to show — never an empty list, which would read as "nobody is coming".
 */
export async function fetchIncoming(facilityId: string): Promise<IncomingResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { ok: false, reason: 'offline' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${reportingBaseUrl()}/api/v1/records/incoming?facility_id=${encodeURIComponent(facilityId)}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return { ok: false, reason: 'error' };

        const data = (await response.json()) as { cases?: IncomingCase[] };
        return { ok: true, cases: Array.isArray(data.cases) ? data.cases : [] };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { ok: false, reason: 'timeout' };
        }
        return { ok: false, reason: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}

// ── store inspection ─────────────────────────────────────────────────────────

export interface StoredPatient {
    id: string;
    name: string;
    age: number;
    gender: string;
    facility_id: string | null;
    triage_priority: string | null;
    updated_at: string;
    received_at: string;
    payload: Patient;
}

export interface StoredReferral {
    id: string;
    patient_id: string;
    from_facility_id: string;
    to_facility_id: string;
    status: string;
    priority: string;
    reason: string | null;
    eta_minutes: number | null;
    raised_at: string;
    updated_at: string;
    received_at: string;
    payload: ReferralRecord;
}

export interface StoreDump {
    generated_at: string;
    limit: number;
    patient_records_total: number;
    patient_records_shown: number;
    care_referrals_total: number;
    care_referrals_shown: number;
    patient_records: StoredPatient[];
    care_referrals: StoredReferral[];
}

export type StoreResult =
    | { ok: true; store: StoreDump }
    | { ok: false; reason: 'offline' | 'unreachable' | 'timeout' | 'error' };

/**
 * Everything the district record store is currently holding.
 *
 * Backs the Data Inspector screen. Like fetchIncoming it is cloud-only with no
 * local fallback, and a failure returns a reason rather than an empty store —
 * "the cloud has no records" and "I could not reach the cloud" are opposite
 * claims about the same screen, and only one of them is ever true.
 */
export async function fetchStore(limit = 50): Promise<StoreResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { ok: false, reason: 'offline' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${reportingBaseUrl()}/api/v1/store?limit=${encodeURIComponent(String(limit))}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return { ok: false, reason: 'error' };

        const data = (await response.json()) as Partial<StoreDump>;
        // A malformed body must not render as an empty-but-healthy store, so the
        // arrays are the thing checked, not the status code alone.
        if (!Array.isArray(data.patient_records) || !Array.isArray(data.care_referrals)) {
            return { ok: false, reason: 'error' };
        }
        return { ok: true, store: data as StoreDump };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { ok: false, reason: 'timeout' };
        }
        return { ok: false, reason: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}
