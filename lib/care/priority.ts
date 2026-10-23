/**
 * Bridging the app's two urgency vocabularies.
 *
 * The app carries both, for good reasons, and they are not the same scale:
 *
 *   - `TriageStatus`  — RED / YELLOW / GREEN. The clinical triage colour a
 *     patient is assigned at intake. This is what the triage model outputs.
 *   - `TriagePriority` — EMERGENCY / URGENT / SEMI_URGENT / ROUTINE. The
 *     four-level queue and referral priority, used for ordering work.
 *
 * The district cloud speaks only the three-colour scale, so a referral has to
 * be converted before it can be uploaded. Compressing four levels into three
 * means merging two of them, and the direction of that merge is a clinical
 * decision, not a formatting one: the colour decides where a case sits on the
 * receiving facility's board and what they make ready before arrival.
 *
 * So the rule is the same one the assistant's referral guidance follows —
 * **the mapping may raise urgency, never lower it**. SEMI_URGENT, the level
 * with no exact colour of its own, rounds up to YELLOW rather than down to
 * GREEN. Being ready for a patient who turns out to be stable costs a cleared
 * bed; the opposite costs more.
 *
 * Verified by scripts/verify-equipment.mts.
 */

import type { TriagePriority, TriageStatus } from '@/types/patient';

const PRIORITY_TO_COLOUR: Record<TriagePriority, TriageStatus> = {
    EMERGENCY: 'RED',
    URGENT: 'YELLOW',
    SEMI_URGENT: 'YELLOW', // rounds up — see above
    ROUTINE: 'GREEN',
};

/** Rank for sorting: 0 is most urgent. */
export const COLOUR_RANK: Record<TriageStatus, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

/**
 * The triage colour a four-level priority corresponds to.
 *
 * An unrecognised value returns RED. A referral whose priority cannot be read
 * is not a routine case — it is a case with unknown urgency, and the only safe
 * assumption on a pre-arrival board is the most urgent one.
 */
export function colourForPriority(priority: TriagePriority | string | undefined): TriageStatus {
    if (!priority) return 'RED';
    return PRIORITY_TO_COLOUR[priority as TriagePriority] ?? 'RED';
}

/**
 * The triage colour of a patient record.
 *
 * `triageStatus` is already a colour and is the assessment of record, so it
 * wins. `triagePriority` is only consulted when no triage has been recorded.
 */
export function colourForPatient(patient: {
    triageStatus?: TriageStatus | string;
    triagePriority?: TriagePriority | string;
}): TriageStatus {
    const status = patient.triageStatus;
    if (status === 'RED' || status === 'YELLOW' || status === 'GREEN') return status;
    return colourForPriority(patient.triagePriority);
}
