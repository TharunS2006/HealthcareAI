/**
 * The clinician's own triage, recorded beside NalamMesh's.
 *
 * After the tool gives RED / YELLOW / GREEN, the health worker or Medical
 * Officer who examined the patient records the acuity they decided on. That is
 * what lets a supervised pilot measure the tool (docs/pilot/VALIDATION_PROTOCOL.md):
 * how often it rated a patient lower than the clinician did (under-triage, the
 * dangerous error) and how often higher (over-triage).
 *
 * Raise only, like the danger-sign rules: when the clinician's acuity is higher
 * the record's urgency is raised to it; when it is lower the review is kept for
 * the study but the record keeps the higher urgency — the clinician's own
 * decision on care stands either way, and the app never talks a patient down.
 */

import type { Patient, TriagePriority, TriageStatus } from '@/types/patient';
import type { TriageDecisionSource } from '@/lib/triage/model';
import type { StaffRole } from '@/lib/auth/permissions';

export interface TriageReview {
    /** When the clinician recorded their acuity. */
    at: string;
    facilityId: string;
    /** What NalamMesh said, and how it decided. */
    tool: TriageStatus;
    decisionSource: TriageDecisionSource;
    /** What the clinician decided after examining the patient. */
    clinician: TriageStatus;
    reviewerId: string;
    reviewerRole: StaffRole;
    reviewerName?: string;
}

export type Agreement = 'AGREE' | 'UNDER' | 'OVER';

const RANK: Record<TriageStatus, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
const PRIORITY: Record<TriageStatus, TriagePriority> = { RED: 'EMERGENCY', YELLOW: 'URGENT', GREEN: 'ROUTINE' };

/** UNDER: the tool rated the patient less urgent than the clinician did. */
export function agreement(tool: TriageStatus, clinician: TriageStatus): Agreement {
    if (RANK[tool] === RANK[clinician]) return 'AGREE';
    return RANK[tool] < RANK[clinician] ? 'UNDER' : 'OVER';
}

/** The record with the review added, its urgency raised if the clinician's is higher. */
export function applyReview(patient: Patient, review: TriageReview): Patient {
    const raise = RANK[review.clinician] > RANK[patient.triageStatus];
    return {
        ...patient,
        isSynced: false,
        triageReviews: [...(patient.triageReviews ?? []), review],
        ...(raise ? { triageStatus: review.clinician, triagePriority: PRIORITY[review.clinician] } : {}),
    };
}
