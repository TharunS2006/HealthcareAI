/**
 * What a supervised pilot measures (docs/pilot/VALIDATION_PROTOCOL.md), from
 * the records on this device:
 *
 *   triage    every clinician review (lib/pilot/triageReview.ts): agreement,
 *             under-triage (tool lower than the clinician — the primary safety
 *             measure), over-triage, and the share of the clinician's RED
 *             patients the tool also rated RED (sensitivity for RED)
 *   referrals minutes from referral to acknowledgement and to arrival, from the
 *             times each status change was recorded
 *
 * Nothing is estimated: a measure with no records is null and the screen says
 * "not recorded". The export is de-identified — no name, ID, phone, ABHA,
 * village or exact age — but small facilities can still make a row
 * identifiable, so it goes to the study team under the ethics approval, not out
 * in public.
 */

import type { Patient, ReferralRecord, TriageStatus } from '@/types/patient';
import { agreement, type TriageReview } from '@/lib/pilot/triageReview';
import { patientVersion } from '@/lib/sync/patientVersion';

export interface PilotScope {
    /** Facilities in the pilot chain; all when absent. */
    facilityIds?: ReadonlySet<string>;
    from?: Date;
    to?: Date;
}

export interface PilotSummary {
    reviews: number;
    agree: number;
    under: number;
    over: number;
    /** Reviews the clinician rated RED, and how many of those the tool also rated RED. */
    clinicianRed: number;
    toolRedOfClinicianRed: number;
    /** tool → clinician → count */
    matrix: Record<TriageStatus, Record<TriageStatus, number>>;
    referrals: number;
    acknowledged: number;
    arrived: number;
    escalated: number;
    medianMinutesToAcknowledge: number | null;
    medianMinutesToArrival: number | null;
    /** Referral times left out because one was recorded before the referral itself (a device clock error). */
    clockErrors: number;
}

const STATUSES: TriageStatus[] = ['RED', 'YELLOW', 'GREEN'];
const isStatus = (v: unknown): v is TriageStatus => typeof v === 'string' && (STATUSES as string[]).includes(v);
const MINUTE = 60_000;
/** A referral is linked to a review when raised within this long of it (OPD raises it at triage). */
const LINK_WINDOW = 24 * 60 * MINUTE;

function inScope(at: string | Date | undefined, facilityId: string | undefined, scope: PilotScope): boolean {
    const t = at === undefined ? NaN : new Date(at).getTime();
    if (!Number.isFinite(t)) return false;
    if (scope.facilityIds && (!facilityId || !scope.facilityIds.has(facilityId))) return false;
    if (scope.from && t < scope.from.getTime()) return false;
    if (scope.to && t > scope.to.getTime()) return false;
    return true;
}

/** Minutes between two recorded times; null if either is missing or the order is impossible (clock error). */
export function minutesBetween(start: string | Date | undefined, end: string | Date | undefined): number | null {
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / MINUTE) : null;
}

export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

interface ReviewRow { patient: Patient; review: TriageReview }

/**
 * Reviews in scope. Records arrive from other devices and the relay stores any
 * JSON with an id, so a review that is not well formed is left out rather than
 * allowed to break the screen.
 */
function reviewsIn(patients: Patient[], scope: PilotScope): ReviewRow[] {
    return patients.flatMap(patient => (Array.isArray(patient.triageReviews) ? patient.triageReviews : [])
        .filter(review => review && isStatus(review.tool) && isStatus(review.clinician) && typeof review.at === 'string' && typeof review.facilityId === 'string')
        .filter(review => inScope(review.at, review.facilityId, scope))
        .map(review => ({ patient, review })));
}

/**
 * This device's records and the district service's, one copy of each: the
 * newer patient record (lib/sync/patientVersion.ts) and the referral changed
 * last. The district store holds every record any device uploaded; the device
 * may hold changes not uploaded yet.
 */
export function mergeRecords(local: { patients: Patient[]; referrals: ReferralRecord[] }, district: { patients: Patient[]; referrals: ReferralRecord[] }): { patients: Patient[]; referrals: ReferralRecord[] } {
    const patients = new Map<string, Patient>();
    for (const p of [...district.patients, ...local.patients]) {
        if (!p || typeof p.id !== 'string') continue;
        const held = patients.get(p.id);
        if (!held || patientVersion(p) >= patientVersion(held)) patients.set(p.id, p);
    }
    const changed = (r: ReferralRecord) => {
        const t = Date.parse(r.updatedAt ?? String(r.referredAt));
        return Number.isFinite(t) ? t : 0;
    };
    const referrals = new Map<string, ReferralRecord>();
    for (const r of [...district.referrals, ...local.referrals]) {
        if (!r || typeof r.id !== 'string') continue;
        const held = referrals.get(r.id);
        if (!held || changed(r) >= changed(held)) referrals.set(r.id, r);
    }
    return { patients: [...patients.values()], referrals: [...referrals.values()] };
}

function referralsIn(referrals: ReferralRecord[], scope: PilotScope): ReferralRecord[] {
    return referrals.filter(r => inScope(r.referredAt, r.fromFacilityId, scope));
}

export function pilotSummary(patients: Patient[], referrals: ReferralRecord[], scope: PilotScope = {}): PilotSummary {
    const rows = reviewsIn(patients, scope);
    const matrix = Object.fromEntries(STATUSES.map(t => [t, Object.fromEntries(STATUSES.map(c => [c, 0]))])) as PilotSummary['matrix'];
    let agree = 0, under = 0, over = 0, clinicianRed = 0, toolRedOfClinicianRed = 0;
    for (const { review } of rows) {
        matrix[review.tool][review.clinician] += 1;
        const a = agreement(review.tool, review.clinician);
        if (a === 'AGREE') agree += 1; else if (a === 'UNDER') under += 1; else over += 1;
        if (review.clinician === 'RED') {
            clinicianRed += 1;
            if (review.tool === 'RED') toolRedOfClinicianRed += 1;
        }
    }
    const refs = referralsIn(referrals, scope);
    const toAck = refs.map(r => minutesBetween(r.referredAt, r.acknowledgedAt)).filter((m): m is number => m !== null);
    const toArrival = refs.map(r => minutesBetween(r.referredAt, r.arrivedAt)).filter((m): m is number => m !== null);
    const reversed = (end: string | undefined, start: string | Date) => Boolean(end) && Date.parse(String(end)) < new Date(start).getTime();
    const clockErrors = refs.reduce((n, r) => n + (reversed(r.acknowledgedAt, r.referredAt) ? 1 : 0) + (reversed(r.arrivedAt, r.referredAt) ? 1 : 0), 0);
    return {
        reviews: rows.length, agree, under, over, clinicianRed, toolRedOfClinicianRed, matrix,
        referrals: refs.length,
        acknowledged: toAck.length,
        arrived: toArrival.length,
        escalated: refs.filter(r => r.escalation).length,
        medianMinutesToAcknowledge: median(toAck),
        medianMinutesToArrival: median(toArrival),
        clockErrors,
    };
}

export function ageBand(age: number): string {
    if (!Number.isFinite(age) || age < 0) return 'unknown';
    if (age < 5) return '0-4';
    if (age < 18) return '5-17';
    if (age < 35) return '18-34';
    if (age < 50) return '35-49';
    if (age < 65) return '50-64';
    return '65+';
}

/** The referral raised for this patient nearest the review, within a day of it. */
function linkedReferral(row: ReviewRow, referrals: ReferralRecord[]): ReferralRecord | undefined {
    const at = new Date(row.review.at).getTime();
    let best: ReferralRecord | undefined;
    let bestGap = Infinity;
    for (const r of referrals) {
        if (r.patientId !== row.patient.id) continue;
        const gap = Math.abs(new Date(r.referredAt).getTime() - at);
        if (Number.isFinite(gap) && gap <= LINK_WINDOW && gap < bestGap) { best = r; bestGap = gap; }
    }
    return best;
}

export const PILOT_CSV_COLUMNS = [
    'case_no', 'review_date', 'facility_id', 'age_band', 'sex', 'pregnant',
    'tool_status', 'tool_decision_source', 'clinician_status', 'agreement', 'reviewer_role',
    'referred', 'referral_priority', 'minutes_to_acknowledge', 'minutes_to_arrival', 'admitted', 'escalated',
] as const;

/**
 * One CSV cell. A value that a spreadsheet would run as a formula (starting
 * with = + - @, tab or carriage return) is prefixed with an apostrophe:
 * synced values come from other devices and are not trusted.
 */
const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The calendar date in India (IST), where the review happened — not the UTC date. */
export function istDate(at: string): string {
    return new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** One de-identified row per clinician review, with the outcome of the referral raised for it, if any. */
export function pilotCsv(patients: Patient[], referrals: ReferralRecord[], scope: PilotScope = {}): string {
    const rows = reviewsIn(patients, scope).sort((a, b) => a.review.at.localeCompare(b.review.at));
    const lines = [PILOT_CSV_COLUMNS.join(',')];
    rows.forEach((row, i) => {
        const { patient, review } = row;
        const ref = linkedReferral(row, referrals);
        lines.push([
            i + 1,
            istDate(review.at),
            review.facilityId,
            ageBand(patient.age),
            patient.gender,
            patient.vitals?.isPregnant ? 'Y' : 'N',
            review.tool,
            review.decisionSource,
            review.clinician,
            agreement(review.tool, review.clinician),
            review.reviewerRole,
            ref ? 'Y' : 'N',
            ref?.priority ?? '',
            ref ? minutesBetween(ref.referredAt, ref.acknowledgedAt) : '',
            ref ? minutesBetween(ref.referredAt, ref.arrivedAt) : '',
            ref ? (ref.admittedAt ? 'Y' : 'N') : '',
            ref ? (ref.escalation ? 'Y' : 'N') : '',
        ].map(cell).join(','));
    });
    return `${lines.join('\n')}\n`;
}
