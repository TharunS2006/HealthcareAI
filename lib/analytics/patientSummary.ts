/**
 * One line describing why a patient is on the high-risk list — from their own
 * record.
 *
 * The District Health Command used to pick this line by the patient's first
 * name: anyone called Sunita was shown with severe gestational hypertension,
 * anyone called Ramesh with a diabetic foot ulcer. On real records that is a
 * false clinical statement about a real person. The line now comes only from
 * what was recorded for this patient: the latest visit's complaint, then the
 * notes on their high-risk flags, then the injury recorded with their vitals,
 * then their notes. With none of those it is empty, and the screen shows the
 * vitals alone. scripts/verify-metrics.mts checks it.
 */

import type { Patient } from '@/types/patient';

const FLAG_LABEL: Record<string, string> = {
    MATERNAL: 'High-risk pregnancy',
    CHILD_U5: 'Child under five',
    NCD_DIABETES: 'Diabetes',
    NCD_HYPERTENSION: 'Hypertension',
    TB: 'Tuberculosis',
    MALNUTRITION: 'Malnutrition',
    OTHER: 'High-risk',
};

const time = (v: Date | string | undefined) => {
    const t = v === undefined ? NaN : new Date(v).getTime();
    return Number.isFinite(t) ? t : -Infinity;
};

export function clinicalSummary(patient: Pick<Patient, 'visits' | 'highRiskFlags' | 'vitals' | 'notes'>): string {
    const latest = [...(patient.visits ?? [])].sort((a, b) => time(b.date) - time(a.date))[0];
    if (latest?.chiefComplaint?.trim()) return latest.chiefComplaint.trim();

    const flags = (patient.highRiskFlags ?? [])
        .map(f => (f.notes?.trim() ? `${FLAG_LABEL[f.type] ?? f.type}: ${f.notes.trim()}` : FLAG_LABEL[f.type] ?? f.type))
        .filter(Boolean);
    if (flags.length) return flags.join(' · ');

    const injury = patient.vitals?.injuryType?.trim();
    if (injury) return injury;
    return patient.notes?.trim() ?? '';
}
