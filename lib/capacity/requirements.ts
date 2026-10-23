/**
 * What a referral needs from the facility that takes it — a bed of the right
 * kind, the equipment the case depends on, and a specialist on duty.
 *
 * This is the left-hand column of the capacity check: "required" against
 * "available". It reads the referral's reason, urgency and vitals, and it
 * follows the same rule as lib/care/equipment.ts — over-asking is the safe
 * error. A requirement that turns out unnecessary costs the admin a glance; a
 * missing one lets a facility with its ventilator in pieces accept a patient
 * who will need it within the hour.
 *
 * Pure and dependency-free (types only), because the mesh relay imports it
 * through lib/referrals/workflow.ts to enforce acceptance rules server-side.
 * Verified by scripts/verify-capacity.mts.
 */

import type { TriagePriority, Vitals } from '../../types/patient';
import type { EquipmentKind, Specialty, WardType } from '../../types/resources';

export interface BedRequirement {
    ward: WardType;
    reason: string;
}

export interface EquipmentRequirement {
    kind: EquipmentKind;
    reason: string;
}

export interface SpecialistRequirement {
    specialty: Specialty;
    reason: string;
}

export interface ResourceRequirements {
    /** null when the referral is outpatient work (a test, a scheduled review). */
    bed: BedRequirement | null;
    equipment: EquipmentRequirement[];
    specialists: SpecialistRequirement[];
}

export interface RequirementInput {
    reason: string;
    priority: TriagePriority;
    clinicalSummary?: string;
    vitals?: Vitals;
    patientAge?: number;
}

const MATERNAL = /pregnan|antenatal|\banc\b|eclampsia|gestation|obstetric|labou?r\b|\bpph\b|postpartum|post-partum|delivery|cemonc|bemonc|primigravida|multigravida/i;
const MATERNAL_BLEED = /eclampsia|\bpph\b|haemorrhage|hemorrhage|bleed|placenta|abruption/i;
const PAEDIATRIC = /\bchild\b|infant|\bbaby\b|neonat|newborn|\bsam\b|malnutrition|paediatric|pediatric|\bsncu\b|\bnrc\b/i;
const RESPIRATORY = /respiratory distress|pneumonia|breathless|short(ness)? of breath|hypoxi|fast breathing|chest indrawing|asthma|copd|\bspo2\b/i;
const CRITICAL_AIRWAY = /ventilat|respiratory failure|intubat|apnoea|apnea|neuroparalytic|krait|ptosis/i;
const TRAUMA = /fracture|trauma|accident|\brta\b|\bfall\b|injur|burn|assault|crush/i;
const FRACTURE = /fracture|dislocation|orthop/i;
const SURGICAL = /debridement|surg|ulcer|abscess|appendic|hernia|obstruction|laparotomy|acute abdomen/i;
const CARDIAC = /chest pain|myocard|\bmi\b|cardiac|arrhythm|heart failure|\bstemi\b/i;
const RENAL = /dialysis|renal failure|kidney failure|\baki\b|\bckd\b|uraemi|uremi/i;
const BLOOD_LOSS = /transfusion|haemorrhage|hemorrhage|bleeding|severe ana?emia|blood loss|\bhb\s*<\s*[5-7]/i;
const XRAY = /x-?ray|radiograph/i;
const ULTRASOUND = /ultrasound|\busg\b|sonograph|doppler/i;
/** Outpatient work: a test, a scheduled review. No bed unless something else asks for one. */
const OUTPATIENT = /cbnaat|genexpert|sputum|\btest\b|investigation|review|follow-?up|screening/i;

/**
 * Derive what the receiving facility must have for this referral.
 *
 * Ward precedence runs from most to least specific capability — a pregnant
 * woman in respiratory distress still needs the maternity ward's team — and
 * ends at the Emergency ward for any Emergency with nothing more specific.
 */
export function requirementsFor(input: RequirementInput): ResourceRequirements {
    const text = `${input.reason} ${input.clinicalSummary ?? ''}`;
    const v = input.vitals;
    const equipment = new Map<EquipmentKind, string>();
    const specialists = new Map<Specialty, string>();
    let bed: BedRequirement | null = null;

    const isMaternal = MATERNAL.test(text) || Boolean(v?.isPregnant);
    const isChild =
        PAEDIATRIC.test(text) ||
        (typeof input.patientAge === 'number' && input.patientAge < 12) ||
        typeof v?.childAgeMonths === 'number';
    const spo2 = typeof v?.spo2 === 'number' && v.spo2 > 0 ? v.spo2 : undefined;
    const hypoxic = spo2 !== undefined && spo2 < 94;
    const criticalAirway = CRITICAL_AIRWAY.test(text) || (spo2 !== undefined && spo2 < 90);
    const isUrgent = input.priority === 'EMERGENCY' || input.priority === 'URGENT';

    if (isMaternal) {
        bed = { ward: 'MATERNITY', reason: 'Obstetric case' };
        specialists.set('OBSTETRICS', 'Obstetric case');
        if (MATERNAL_BLEED.test(text) || input.priority === 'EMERGENCY') {
            equipment.set('BLOOD_BANK', 'Obstetric emergency — blood must be available');
        }
        if (isUrgent) equipment.set('ULTRASOUND', 'Fetal and placental assessment');
    }

    if (isChild) {
        bed = bed ?? { ward: 'PEDIATRIC', reason: 'Child patient' };
        specialists.set('PAEDIATRICS', 'Child patient');
    }

    if (RESPIRATORY.test(text) || hypoxic) {
        equipment.set('OXYGEN', spo2 !== undefined ? `SpO2 ${spo2}% at referral` : 'Respiratory presentation');
    }
    if (criticalAirway) {
        equipment.set('VENTILATOR', spo2 !== undefined && spo2 < 90 ? `SpO2 ${spo2}% — may need ventilation` : 'Airway may fail');
        equipment.set('OXYGEN', equipment.get('OXYGEN') ?? 'Airway at risk');
        specialists.set('ANAESTHESIA', 'Airway management');
        // An adult with a failing airway needs intensive care; a child or a
        // mother keeps the ward whose team knows them, with the ventilator.
        if (!bed) bed = { ward: 'ICU', reason: 'Airway / ventilation risk' };
    }

    if (CARDIAC.test(text)) {
        if (!bed) bed = { ward: 'ICU', reason: 'Cardiac presentation' };
        specialists.set('GENERAL_MEDICINE', 'Cardiac presentation');
    }

    if (RENAL.test(text)) {
        equipment.set('DIALYSIS', 'Renal failure');
        specialists.set('NEPHROLOGY', 'Renal failure');
        if (!bed) bed = { ward: 'GENERAL', reason: 'Renal admission' };
    }

    if (TRAUMA.test(text)) {
        equipment.set('XRAY', 'Injury imaging');
        specialists.set(FRACTURE.test(text) ? 'ORTHOPAEDICS' : 'GENERAL_SURGERY', 'Injury');
        if (!bed) bed = { ward: 'EMERGENCY', reason: 'Trauma' };
    }

    if (SURGICAL.test(text)) {
        specialists.set('GENERAL_SURGERY', 'Surgical presentation');
        if (!bed) bed = { ward: 'GENERAL', reason: 'Surgical admission' };
    }

    if (BLOOD_LOSS.test(text)) equipment.set('BLOOD_BANK', 'Blood loss / transfusion');
    if (XRAY.test(text)) equipment.set('XRAY', 'X-ray requested');
    if (ULTRASOUND.test(text)) equipment.set('ULTRASOUND', 'Ultrasound requested');

    if (!bed) {
        const outpatientOnly = OUTPATIENT.test(text) && input.priority === 'ROUTINE';
        if (!outpatientOnly) {
            bed = input.priority === 'EMERGENCY'
                ? { ward: 'EMERGENCY', reason: 'Emergency referral' }
                : { ward: 'GENERAL', reason: 'Inpatient referral' };
        }
    }

    // Someone must receive the patient. Only added when nothing more specific
    // did, so a paediatric case is not also held up on a physician's roster.
    if (bed && specialists.size === 0) {
        specialists.set('GENERAL_MEDICINE', 'Admitting clinician');
    }

    return {
        bed,
        equipment: [...equipment].map(([kind, reason]) => ({ kind, reason })),
        specialists: [...specialists].map(([specialty, reason]) => ({ specialty, reason })),
    };
}
