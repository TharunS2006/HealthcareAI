/**
 * High-risk follow-up: the recall list, built from patients' own records.
 *
 * Every task is one high-risk flag on one patient (types/patient.ts
 * HighRiskFlag): its type decides the cohort, its severity the priority, its
 * next follow-up date when it is due. Recording a visit is saved on the flag
 * and moves the next date on by the cohort's interval, so the list survives a
 * reload and reads the same on every device the record reaches.
 *
 * Suggested actions are checks a field worker makes and reports — never a
 * medicine or a dose, which is the treating clinician's decision.
 *
 * scripts/verify-followup.mts checks this.
 */

import type { HighRiskFlag, Patient } from '@/types/patient';

export type Cohort = 'MATERNAL' | 'CHILD' | 'CHRONIC';

export interface RecallTask {
    id: string;
    patientId: string;
    flagIndex: number;
    patientName: string;
    age: number;
    gender: 'M' | 'F' | 'O';
    cohort: Cohort;
    condition: string;
    village: string;
    fieldWorker: string;
    /** Whole days from today to the due date: negative overdue, 0 today; null when no date is set. */
    dueInDays: number | null;
    dueDate: string | null;
    priority: 'CRITICAL' | 'HIGH' | 'ROUTINE';
    phone: string;
    actionNeeded: string;
    lastVisitAt: string | null;
    /** A visit has been recorded since the previous due date. */
    visited: boolean;
    registeredAtFacilityId?: string;
}

/**
 * Days between visits after one is recorded — defaults drawn from programme
 * practice (high-risk ANC under PMSMA, community follow-up of SAM, monthly NCD
 * and TB review); the next date is shown, so a worker can see and act on it.
 */
export const FOLLOW_UP_INTERVAL_DAYS: Record<Cohort, number> = { MATERNAL: 14, CHILD: 7, CHRONIC: 30 };

const COHORT_OF: Record<HighRiskFlag['type'], Cohort> = {
    MATERNAL: 'MATERNAL',
    CHILD_U5: 'CHILD',
    MALNUTRITION: 'CHILD',
    NCD_DIABETES: 'CHRONIC',
    NCD_HYPERTENSION: 'CHRONIC',
    TB: 'CHRONIC',
    OTHER: 'CHRONIC',
};

const LABEL_OF: Record<HighRiskFlag['type'], string> = {
    MATERNAL: 'High-risk pregnancy',
    CHILD_U5: 'Under-five child at risk',
    MALNUTRITION: 'Malnutrition',
    NCD_DIABETES: 'Diabetes',
    NCD_HYPERTENSION: 'Hypertension',
    TB: 'Tuberculosis treatment',
    OTHER: 'High-risk follow-up',
};

/** What the field worker checks and reports — observations, not treatment. */
const ACTION_OF: Record<HighRiskFlag['type'], string> = {
    MATERNAL: 'Check blood pressure and danger signs (headache, blurred vision, bleeding, swelling, reduced fetal movement); confirm the next ANC visit and the 102 number.',
    CHILD_U5: 'Weigh the child, count the breathing rate, check danger signs and the immunisation card.',
    MALNUTRITION: 'Measure MUAC and weight, check for swelling of both feet and appetite; refer at once if the child is unwell.',
    NCD_DIABETES: 'Check blood glucose and feet, ask whether medicines prescribed are being taken, note any symptoms for the Medical Officer.',
    NCD_HYPERTENSION: 'Check blood pressure, ask whether medicines prescribed are being taken, note headache, chest pain or breathlessness.',
    TB: 'Check that treatment doses are being taken, record weight and cough; arrange the follow-up sputum test when due.',
    OTHER: 'Visit, record vital signs and report any change to the Medical Officer.',
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function recallTasksFrom(patients: readonly Patient[], now = new Date()): RecallTask[] {
    const tasks: RecallTask[] = [];
    for (const patient of patients) {
        (patient.highRiskFlags ?? []).forEach((flag, flagIndex) => {
            const cohort = COHORT_OF[flag.type] ?? 'CHRONIC';
            const due = flag.nextFollowUpDate ? new Date(flag.nextFollowUpDate) : null;
            const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
            const last = flag.lastVisitAt ? new Date(flag.lastVisitAt) : null;
            const validLast = last && !Number.isNaN(last.getTime()) ? last : null;
            const intervalStart = validDue ? validDue.getTime() - FOLLOW_UP_INTERVAL_DAYS[cohort] * DAY : null;
            tasks.push({
                id: `${patient.id}:${flagIndex}`,
                patientId: patient.id,
                flagIndex,
                patientName: patient.name,
                age: patient.age,
                gender: patient.gender,
                cohort,
                condition: flag.notes?.trim() || LABEL_OF[flag.type],
                village: patient.village || '',
                fieldWorker: patient.chw_name || '',
                dueInDays: validDue ? Math.round((startOfDay(validDue) - startOfDay(now)) / DAY) : null,
                dueDate: validDue ? validDue.toISOString() : null,
                priority: flag.severity === 'HIGH' ? 'CRITICAL' : flag.severity === 'MEDIUM' ? 'HIGH' : 'ROUTINE',
                phone: patient.phone || '',
                actionNeeded: ACTION_OF[flag.type] ?? ACTION_OF.OTHER,
                lastVisitAt: validLast ? validLast.toISOString() : null,
                visited: Boolean(validLast && intervalStart !== null && validLast.getTime() >= intervalStart),
                registeredAtFacilityId: patient.registeredAtFacilityId,
            });
        });
    }
    // Most urgent first: overdue and due soonest, then by priority.
    const rank = { CRITICAL: 0, HIGH: 1, ROUTINE: 2 };
    return tasks.sort((a, b) =>
        Number(a.visited) - Number(b.visited)
        || (a.dueInDays ?? Infinity) - (b.dueInDays ?? Infinity)
        || rank[a.priority] - rank[b.priority]);
}

/** The patient with a visit recorded on one flag, and its next follow-up moved on. */
export function recordFollowUpVisit(patient: Patient, flagIndex: number, now = new Date()): Patient {
    const flags = patient.highRiskFlags ?? [];
    const flag = flags[flagIndex];
    if (!flag) throw new Error(`Patient ${patient.id} has no high-risk flag ${flagIndex}`);
    const cohort = COHORT_OF[flag.type] ?? 'CHRONIC';
    const next = new Date(now.getTime() + FOLLOW_UP_INTERVAL_DAYS[cohort] * DAY);
    return {
        ...patient,
        isSynced: false,
        highRiskFlags: flags.map((f, i) => (i === flagIndex ? { ...f, lastVisitAt: now.toISOString(), nextFollowUpDate: next.toISOString(), overdueDays: 0 } : f)),
    };
}
