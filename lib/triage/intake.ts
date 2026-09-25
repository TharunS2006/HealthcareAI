/**
 * OPD intake: what the worker typed, turned into a patient's vitals — or a
 * list of what is missing or impossible.
 *
 * Nothing is invented. A reading the worker did not take is absent, never a
 * healthy default: triage run on a made-up SpO2 of 96% or a blood pressure of
 * 120/80 can send a sick patient home. The readings every OPD triage needs
 * (SpO2, pulse, both blood-pressure numbers, respiratory rate, AVPU) must be
 * entered; temperature and glucose are recorded only if measured.
 *
 * scripts/verify-intake.mts checks this.
 */

import type { Vitals } from '@/types/patient';

export type Avpu = NonNullable<Vitals['consciousness']>;

/** The form's fields, as typed. */
export interface IntakeDraft {
    spo2: string;
    pulse: string;
    systolic: string;
    diastolic: string;
    respiratoryRate: string;
    temperature: string;
    glucose: string;
    avpu: Avpu | '';
    pregnant: boolean;
    gestationalWeeks: string;
    child: boolean;
    childAgeMonths: string;
    complaint: string;
}

export const EMPTY_INTAKE: IntakeDraft = {
    spo2: '', pulse: '', systolic: '', diastolic: '', respiratoryRate: '',
    temperature: '', glucose: '', avpu: '',
    pregnant: false, gestationalWeeks: '', child: false, childAgeMonths: '', complaint: '',
};

/** What a field needs to be — the key names the field for the form. */
export interface IntakeProblem {
    field: keyof IntakeDraft;
    message: string;
}

/**
 * Plausible ranges for a living patient. Wide on purpose: they reject a typing
 * slip (SpO2 900, BP 12/80), never a critically ill patient's real reading.
 */
const RANGES = {
    spo2: [50, 100, 'SpO2 (%)'],
    pulse: [20, 250, 'Pulse (beats/min)'],
    systolic: [50, 260, 'Systolic BP (mmHg)'],
    diastolic: [20, 180, 'Diastolic BP (mmHg)'],
    respiratoryRate: [4, 80, 'Respiratory rate (/min)'],
    temperature: [90, 110, 'Temperature (°F)'],
    glucose: [20, 700, 'Blood glucose (mg/dL)'],
    gestationalWeeks: [4, 44, 'Weeks of pregnancy'],
    childAgeMonths: [0, 60, 'Child age (months)'],
} as const;

type RangedField = keyof typeof RANGES;

function read(draft: IntakeDraft, field: RangedField, required: boolean, problems: IntakeProblem[]): number | undefined {
    const raw = String(draft[field]).trim();
    const [min, max, label] = RANGES[field];
    if (raw === '') {
        if (required) problems.push({ field, message: `${label} — not entered` });
        return undefined;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
        problems.push({ field, message: `${label} — ${raw} is outside ${min}–${max}` });
        return undefined;
    }
    return value;
}

/** Parse and check the intake. Vitals only when there is nothing to fix. */
export function readIntake(draft: IntakeDraft): { vitals: Vitals | null; problems: IntakeProblem[] } {
    const problems: IntakeProblem[] = [];
    const spo2 = read(draft, 'spo2', true, problems);
    const heartRate = read(draft, 'pulse', true, problems);
    const systolic = read(draft, 'systolic', true, problems);
    const diastolic = read(draft, 'diastolic', true, problems);
    const respiratoryRate = read(draft, 'respiratoryRate', true, problems);
    const temperature = read(draft, 'temperature', false, problems);
    const bloodGlucose = read(draft, 'glucose', false, problems);
    const gestationalWeeks = draft.pregnant ? read(draft, 'gestationalWeeks', false, problems) : undefined;
    const childAgeMonths = draft.child ? read(draft, 'childAgeMonths', true, problems) : undefined;

    if (systolic !== undefined && diastolic !== undefined && diastolic >= systolic) {
        problems.push({ field: 'diastolic', message: `Blood pressure ${systolic}/${diastolic} — diastolic must be lower than systolic` });
    }
    if (!draft.avpu) problems.push({ field: 'avpu', message: 'Consciousness (AVPU) — not chosen' });
    if (draft.pregnant && draft.child) problems.push({ field: 'child', message: 'A patient cannot be both pregnant and an under-five child' });

    if (problems.length > 0 || spo2 === undefined || heartRate === undefined || systolic === undefined || diastolic === undefined || respiratoryRate === undefined || !draft.avpu) {
        return { vitals: null, problems };
    }

    const vitals: Vitals = {
        spo2,
        heartRate,
        bloodPressure: { systolic, diastolic },
        respiratoryRate,
        consciousness: draft.avpu,
        injuryType: draft.complaint.trim(),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(bloodGlucose !== undefined ? { bloodGlucose } : {}),
        ...(draft.pregnant ? { isPregnant: true, ...(gestationalWeeks !== undefined ? { gestationalWeeks } : {}) } : {}),
        ...(childAgeMonths !== undefined ? { childAgeMonths } : {}),
    };
    return { vitals, problems };
}
