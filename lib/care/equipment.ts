/**
 * Pre-arrival readiness — what the receiving facility should have ready.
 *
 * This is the point of uploading records at all. A referral tells a district
 * hospital that someone is coming; the record behind it tells them *what to set
 * up* before the ambulance doors open. The difference is a warmer that is
 * already at temperature versus one switched on after the baby arrives.
 *
 * Three rules govern everything below.
 *
 *   1. **Preparation, never prescription.** Every item names a thing to make
 *      ready — a bay, a machine, a tray, a team. Nothing here states a dose, a
 *      route or a rate. The clinician who receives the patient decides
 *      treatment; this list only means they are not hunting for equipment while
 *      deciding. Where a protocol drug is unavoidable (magnesium sulphate for
 *      eclampsia) it is named as a tray to prepare, with no quantity.
 *
 *   2. **Over-preparing is the safe error.** A rule fires on the *suspicion*,
 *      not the confirmed diagnosis, and missing data escalates rather than
 *      clears: a RED referral whose patient record has not arrived still yields
 *      the resuscitation set, because the alternative is a board that looks
 *      calm because it knows nothing.
 *
 *   3. **A gap is stated, never implied.** Cross-referencing what the facility
 *      actually has is only useful if "we could not tell" is distinguishable
 *      from "they have it". Hence the three-state readiness below — an unknown
 *      facility yields UNKNOWN for every item, never a reassuring tick.
 *
 * All of this runs on the device. The district service stores records and hands
 * them back; it holds no clinical logic, so a rule fixed here is fixed for every
 * facility on the next page load rather than on the next backend deployment.
 *
 * Verified by scripts/verify-equipment.mts.
 */

import type { Facility } from '@/types/facility';
import type { HighRiskFlag, Patient, ReferralRecord, TriageStatus } from '@/types/patient';
import { COLOUR_RANK, colourForPatient, colourForPriority } from './priority';

/** How soon the item has to be in place. */
export type NeedUrgency = 'IMMEDIATE' | 'ON_ARRIVAL';

export interface EquipmentNeed {
    /** Stable key; also the de-duplication identity. */
    id: string;
    label: string;
    /** Why this fired, in the receiving clinician's terms. Always shown. */
    reason: string;
    urgency: NeedUrgency;
    /**
     * Patterns that mean "this facility already has it", tested against the
     * facility's equipment and services lines together. Several alternatives
     * because the same capability is written differently at every tier —
     * "Radiant Warmers" at a CHC, "Newborn Stabilization Unit (NBSU)" at an SDH.
     */
    match: RegExp[];
}

/** Whether the receiving facility can meet a need. */
export type ReadinessState = 'READY' | 'GAP' | 'UNKNOWN';

export interface ReadinessItem {
    need: EquipmentNeed;
    state: ReadinessState;
    /** The facility line that satisfied it, for the "how do you know" question. */
    matchedOn?: string;
}

export interface ReadinessReport {
    items: ReadinessItem[];
    gaps: number;
    unknowns: number;
    /**
     * True when the patient record has not reached the cloud yet, so this list
     * was derived from the referral alone. The UI must say so — a short list
     * because there is little data looks identical to a short list because the
     * patient is stable.
     */
    fromReferralOnly: boolean;
}

// ── the catalogue ────────────────────────────────────────────────────────────
// Kept as one table so the whole clinical surface of this feature is readable in
// one screen. `reason` is filled in by the rule that fires it, because the same
// item is needed for different reasons (oxygen for hypoxia, oxygen for shock).

type NeedSpec = Omit<EquipmentNeed, 'reason'>;

const N = {
    RESUS_BAY: {
        id: 'resus-bay',
        label: 'Resuscitation bay + emergency team standing by',
        urgency: 'IMMEDIATE',
        match: [/24x7 emergency/i, /emergency (care|bay|room)/i, /casualty/i],
    },
    OXYGEN: {
        id: 'oxygen',
        label: 'Oxygen delivery point (mask / concentrator)',
        urgency: 'IMMEDIATE',
        match: [/oxygen/i],
    },
    AIRWAY: {
        id: 'airway',
        label: 'Airway kit, suction and ventilator standby',
        urgency: 'IMMEDIATE',
        match: [/ventilator/i, /suction/i, /anaesthe/i],
    },
    MONITOR: {
        id: 'monitor',
        label: 'Multi-para monitor / pulse oximeter at the bedside',
        urgency: 'IMMEDIATE',
        // A ventilated or intensive-care bed is never run without monitoring, so
        // those lines count — otherwise a District Hospital with twelve
        // ventilators reads as having no monitor, and a true gap elsewhere gets
        // lost among false ones.
        match: [/monitor/i, /oximeter/i, /multi-?para/i, /ventilator/i, /\bicu\b/i, /intensive care/i, /sncu/i],
    },
    IV_ACCESS: {
        id: 'iv-access',
        label: 'Large-bore IV access and warmed IV fluids',
        urgency: 'IMMEDIATE',
        match: [/iv fluid/i, /infusion/i, /emergency care/i, /24x7 emergency/i],
    },
    BLOOD: {
        id: 'blood',
        label: 'Blood bank alerted — group and cross-match',
        urgency: 'IMMEDIATE',
        match: [/blood bank/i, /blood storage/i],
    },
    ECG_DEFIB: {
        id: 'ecg-defib',
        label: 'ECG machine and defibrillator at the bedside',
        urgency: 'IMMEDIATE',
        match: [/ecg/i, /defibrillat/i],
    },
    ECLAMPSIA_TRAY: {
        id: 'eclampsia-tray',
        label: 'Eclampsia tray — magnesium sulphate protocol, catheter, reflex chart',
        urgency: 'IMMEDIATE',
        match: [/cemonc/i, /emergency obstetric/i, /obstetric/i],
    },
    OBSTETRIC_THEATRE: {
        id: 'obstetric-theatre',
        label: 'Obstetric theatre and CEmONC team on call',
        urgency: 'IMMEDIATE',
        match: [/cemonc/i, /emergency obstetric/i, /general surgery/i, /obstetric/i, /first referral unit/i],
    },
    LABOUR_ROOM: {
        id: 'labour-room',
        label: 'Labour room and delivery kit prepared',
        urgency: 'ON_ARRIVAL',
        match: [/delivery/i, /labour/i, /bemonc/i, /cemonc/i, /obstetric/i],
    },
    RADIANT_WARMER: {
        id: 'radiant-warmer',
        label: 'Radiant warmer / newborn corner switched on',
        urgency: 'IMMEDIATE',
        match: [/radiant warmer/i, /newborn/i, /nbsu/i, /sncu/i, /phototherapy/i],
    },
    NEBULISER: {
        id: 'nebuliser',
        label: 'Nebuliser set up',
        urgency: 'ON_ARRIVAL',
        match: [/nebuli/i],
    },
    GLUCOSE: {
        id: 'glucose',
        label: 'Glucometer and dextrose/insulin trolley ready',
        urgency: 'IMMEDIATE',
        match: [/glucomet/i, /biochemistry/i, /lab analyzer/i, /routine diagnostics/i, /basic lab/i],
    },
    XRAY: {
        id: 'xray',
        label: 'X-ray on standby',
        urgency: 'ON_ARRIVAL',
        match: [/x-?ray/i],
    },
    CT: {
        id: 'ct',
        label: 'CT scanner slot held open',
        urgency: 'IMMEDIATE',
        match: [/ct scan/i, /ct scanner/i],
    },
    ULTRASOUND: {
        id: 'ultrasound',
        label: 'Ultrasound available at the bedside',
        urgency: 'ON_ARRIVAL',
        match: [/ultrasound/i, /doppler/i],
    },
    TRAUMA_SET: {
        id: 'trauma-set',
        label: 'Trauma set — splints, collar, dressing and suture tray',
        urgency: 'IMMEDIATE',
        match: [/general surgery/i, /orthoped/i, /24x7 emergency/i, /emergency care/i],
    },
    ANTIVENOM: {
        id: 'antivenom',
        label: 'Anti-snake venom stock confirmed, with an airway kit alongside',
        urgency: 'IMMEDIATE',
        match: [/anti-?snake/i, /asv\b/i, /24x7 emergency/i],
    },
    POISONING_KIT: {
        id: 'poisoning-kit',
        label: 'Poisoning corner — lavage set and activated charcoal',
        urgency: 'IMMEDIATE',
        match: [/24x7 emergency/i, /emergency care/i, /casualty/i],
    },
    SEIZURE_TRAY: {
        id: 'seizure-tray',
        label: 'Anticonvulsant tray and padded bed',
        urgency: 'IMMEDIATE',
        match: [/24x7 emergency/i, /emergency care/i, /general medicine/i],
    },
    BURN_CARE: {
        id: 'burn-care',
        label: 'Burns dressing set and fluid-resuscitation chart',
        urgency: 'IMMEDIATE',
        match: [/burn/i, /general surgery/i, /24x7 emergency/i],
    },
    REHYDRATION: {
        id: 'rehydration',
        label: 'ORS corner and IV rehydration line',
        urgency: 'ON_ARRIVAL',
        match: [/rehydration/i, /ors/i, /iv fluid/i, /inpatient/i],
    },
    ISOLATION: {
        id: 'isolation',
        label: 'Airborne-isolation bed and N95 masks for staff',
        urgency: 'ON_ARRIVAL',
        match: [/isolation/i, /\btb\b/i, /tuberculosis/i, /dots/i],
    },
    NUTRITION: {
        id: 'nutrition',
        label: 'Nutritional rehabilitation — MUAC tape, weighing scale, therapeutic feeds',
        urgency: 'ON_ARRIVAL',
        match: [/nutrition/i, /muac/i, /nrc\b/i, /malnutrition/i, /pediatric/i],
    },
    PAEDIATRIC_BED: {
        id: 'paediatric-bed',
        label: 'Paediatric bed with child-sized airway and IV sets',
        urgency: 'ON_ARRIVAL',
        match: [/pediatric/i, /paediatric/i, /sncu/i, /child/i],
    },
    BP_REVIEW: {
        id: 'bp-review',
        label: 'BP chart and antihypertensive review by the duty physician',
        urgency: 'ON_ARRIVAL',
        match: [/general medicine/i, /ncd/i, /opd/i, /inpatient/i],
    },
} satisfies Record<string, NeedSpec>;

// ── rules ────────────────────────────────────────────────────────────────────

/** Collects needs without duplicating them; the first reason given wins. */
class NeedSet {
    private readonly byId = new Map<string, EquipmentNeed>();

    add(spec: NeedSpec, reason: string): void {
        const existing = this.byId.get(spec.id);
        if (existing) {
            // Same item, second reason. Keep the earlier wording but never let a
            // later ON_ARRIVAL rule relax an IMMEDIATE one.
            if (spec.urgency === 'IMMEDIATE') existing.urgency = 'IMMEDIATE';
            return;
        }
        this.byId.set(spec.id, { ...spec, reason });
    }

    list(): EquipmentNeed[] {
        // IMMEDIATE first, then stable insertion order within each band, so the
        // top of the printed list is what has to exist before the doors open.
        const all = [...this.byId.values()];
        return [
            ...all.filter((n) => n.urgency === 'IMMEDIATE'),
            ...all.filter((n) => n.urgency === 'ON_ARRIVAL'),
        ];
    }
}

/** Keyword rules over the free-text complaint, reason and clinical summary. */
const TEXT_RULES: Array<{ pattern: RegExp; needs: Array<[NeedSpec, string]> }> = [
    {
        pattern: /trauma|accident|rta\b|fall|fracture|crush|head injury|road traffic/i,
        needs: [
            [N.TRAUMA_SET, 'Trauma mentioned in the referral'],
            [N.XRAY, 'Trauma — imaging likely on arrival'],
            [N.BLOOD, 'Trauma — cross-match ahead of possible haemorrhage'],
        ],
    },
    {
        pattern: /bleed|haemorrhage|hemorrhage|pph\b|blood loss/i,
        needs: [
            [N.BLOOD, 'Bleeding reported — blood must be ready, not ordered on arrival'],
            [N.IV_ACCESS, 'Bleeding reported — volume replacement'],
        ],
    },
    {
        pattern: /chest pain|cardiac|heart attack|mi\b|angina|palpitation/i,
        needs: [[N.ECG_DEFIB, 'Cardiac symptoms in the referral']],
    },
    {
        pattern: /stroke|paralysis|hemiplegia|slurred speech|facial droop|unconscious/i,
        needs: [
            [N.CT, 'Stroke or altered consciousness — imaging decides treatment and is time-critical'],
            [N.AIRWAY, 'Stroke or altered consciousness — airway at risk'],
        ],
    },
    {
        pattern: /seizure|convulsion|fit\b|eclampsia|epilep/i,
        needs: [
            [N.SEIZURE_TRAY, 'Seizure activity reported'],
            [N.AIRWAY, 'Seizure activity — airway protection'],
        ],
    },
    {
        pattern: /snake|scorpion|sting|envenom/i,
        needs: [[N.ANTIVENOM, 'Bite or sting reported']],
    },
    {
        pattern: /poison|pesticide|organophosph|overdose|ingest/i,
        needs: [
            [N.POISONING_KIT, 'Poisoning or overdose reported'],
            [N.AIRWAY, 'Poisoning — airway and ventilation at risk'],
        ],
    },
    {
        pattern: /burn|scald|flame/i,
        needs: [
            [N.BURN_CARE, 'Burn injury reported'],
            [N.IV_ACCESS, 'Burn injury — fluid resuscitation'],
        ],
    },
    {
        pattern: /diarrh|vomit|dehydrat|cholera|gastroenter/i,
        needs: [[N.REHYDRATION, 'Fluid loss reported']],
    },
    {
        pattern: /asthma|wheez|breathless|respiratory distress|copd|pneumonia/i,
        needs: [
            [N.NEBULISER, 'Respiratory distress reported'],
            [N.OXYGEN, 'Respiratory distress reported'],
        ],
    },
    {
        pattern: /\btb\b|tuberculosis|koch|haemoptysis|hemoptysis/i,
        needs: [[N.ISOLATION, 'Possible tuberculosis — protect the ward and staff']],
    },
    {
        pattern: /labour|labor pain|delivery|obstructed|breech|antenatal|pregnan|gestation/i,
        needs: [[N.LABOUR_ROOM, 'Obstetric case in the referral']],
    },
    {
        pattern: /newborn|neonat|preterm|baby|infant/i,
        needs: [[N.RADIANT_WARMER, 'Newborn or preterm infant']],
    },
];

const FLAG_RULES: Record<HighRiskFlag['type'], Array<[NeedSpec, string]>> = {
    MATERNAL: [[N.LABOUR_ROOM, 'Registered high-risk maternal case']],
    CHILD_U5: [[N.PAEDIATRIC_BED, 'Registered under-five case']],
    MALNUTRITION: [[N.NUTRITION, 'Registered severe malnutrition']],
    TB: [[N.ISOLATION, 'Registered TB case']],
    NCD_DIABETES: [[N.GLUCOSE, 'Registered diabetic — glucose swings on arrival']],
    NCD_HYPERTENSION: [[N.BP_REVIEW, 'Registered hypertensive']],
    OTHER: [],
};

/** The more urgent of two triage colours; null means "no opinion". */
function mostUrgent(a: TriageStatus, b: TriageStatus | null): TriageStatus {
    if (!b) return a;
    return COLOUR_RANK[b] < COLOUR_RANK[a] ? b : a;
}

/**
 * What the receiving facility should make ready for this case.
 *
 * `patient` is null when the referral reached the cloud but the record behind it
 * has not yet — a real state, not an error, and the list falls back to what the
 * referral itself says.
 */
export function requiredEquipment(
    referral: Pick<ReferralRecord, 'priority' | 'reason' | 'clinicalSummary'>,
    patient: Patient | null
): EquipmentNeed[] {
    const set = new NeedSet();

    // Two opinions exist about how urgent this is: the colour the device
    // assigned the patient, and the priority the referring clinician put on the
    // referral. They can disagree — a patient triaged GREEN at intake who
    // deteriorated is referred EMERGENCY, and the record may be the older of the
    // two. The more urgent one wins, for the same reason the four-to-three
    // mapping rounds up: readiness may be raised by either source, never lowered
    // by one of them.
    const colour: TriageStatus = mostUrgent(
        colourForPriority(referral.priority),
        patient ? colourForPatient(patient) : null
    );

    // 1. Urgency floor. A RED case gets the resuscitation set whatever else is
    //    or is not known about it.
    if (colour === 'RED') {
        set.add(N.RESUS_BAY, 'RED triage — the case is resuscitation-first until proven otherwise');
        set.add(N.OXYGEN, 'RED triage — oxygen ready before assessment');
        set.add(N.MONITOR, 'RED triage — continuous observation from arrival');
        set.add(N.IV_ACCESS, 'RED triage — access established immediately');
    } else if (colour === 'YELLOW') {
        set.add(N.MONITOR, 'YELLOW triage — vitals watched, not spot-checked');
    }

    // 2. Free text. Read the referral's own words plus, when present, the
    //    complaint recorded on the device.
    const text = [referral.reason, referral.clinicalSummary, patient?.vitals?.injuryType, patient?.notes]
        .filter(Boolean)
        .join(' \n ');
    for (const rule of TEXT_RULES) {
        if (rule.pattern.test(text)) {
            for (const [spec, reason] of rule.needs) set.add(spec, reason);
        }
    }

    // 3. Registered high-risk flags — the longitudinal record, not this episode.
    for (const flag of patient?.highRiskFlags ?? []) {
        for (const [spec, reason] of FLAG_RULES[flag.type] ?? []) set.add(spec, reason);
    }

    // 4. Measured vitals. Last, so a number can escalate an item that the text
    //    already asked for at a lower urgency.
    const v = patient?.vitals;
    if (v) {
        if (typeof v.spo2 === 'number' && v.spo2 > 0) {
            if (v.spo2 < 90) {
                set.add(N.OXYGEN, `SpO₂ ${v.spo2}% — severe hypoxia`);
                set.add(N.AIRWAY, `SpO₂ ${v.spo2}% — may need ventilatory support`);
            } else if (v.spo2 < 94) {
                set.add(N.OXYGEN, `SpO₂ ${v.spo2}% — below the safe threshold`);
            }
        }

        const sys = v.bloodPressure?.systolic;
        const dia = v.bloodPressure?.diastolic;
        if (typeof sys === 'number' && sys > 0 && sys < 90) {
            set.add(N.IV_ACCESS, `Systolic ${sys} mmHg — shock`);
            set.add(N.MONITOR, `Systolic ${sys} mmHg — shock`);
        }
        const severeHypertension =
            (typeof sys === 'number' && sys >= 160) || (typeof dia === 'number' && dia >= 110);
        if (severeHypertension) {
            if (v.isPregnant) {
                set.add(N.ECLAMPSIA_TRAY, `BP ${sys}/${dia} mmHg in pregnancy — pre-eclampsia`);
                set.add(N.OBSTETRIC_THEATRE, `BP ${sys}/${dia} mmHg in pregnancy — delivery may be the treatment`);
                set.add(N.RADIANT_WARMER, 'Pre-eclampsia — be ready for an early newborn');
            } else {
                set.add(N.BP_REVIEW, `BP ${sys}/${dia} mmHg — severe hypertension`);
            }
        }

        if (typeof v.heartRate === 'number' && v.heartRate > 0) {
            if (v.heartRate > 120) {
                set.add(N.MONITOR, `Pulse ${v.heartRate}/min — tachycardia`);
                set.add(N.IV_ACCESS, `Pulse ${v.heartRate}/min — tachycardia`);
            } else if (v.heartRate < 50) {
                set.add(N.ECG_DEFIB, `Pulse ${v.heartRate}/min — bradycardia`);
            }
        }

        if (v.consciousness && v.consciousness !== 'ALERT') {
            set.add(N.AIRWAY, `Consciousness: ${v.consciousness} — airway not self-protected`);
            set.add(N.MONITOR, `Consciousness: ${v.consciousness}`);
            set.add(N.GLUCOSE, 'Altered consciousness — hypoglycaemia is the reversible cause to exclude first');
        }

        if (typeof v.bloodGlucose === 'number' && v.bloodGlucose > 0) {
            if (v.bloodGlucose < 70) set.add(N.GLUCOSE, `Blood glucose ${v.bloodGlucose} mg/dL — hypoglycaemia`);
            else if (v.bloodGlucose > 300) set.add(N.GLUCOSE, `Blood glucose ${v.bloodGlucose} mg/dL — hyperglycaemia`);
        }

        if (typeof v.respiratoryRate === 'number' && v.respiratoryRate > 24) {
            set.add(N.OXYGEN, `Respiratory rate ${v.respiratoryRate}/min — tachypnoea`);
            set.add(N.NEBULISER, `Respiratory rate ${v.respiratoryRate}/min — tachypnoea`);
        }

        if (typeof v.temperature === 'number' && v.temperature >= 102) {
            set.add(N.IV_ACCESS, `Temperature ${v.temperature}°F — high fever`);
        }

        if (v.isPregnant) {
            set.add(N.LABOUR_ROOM, 'Pregnancy recorded on the device');
            set.add(N.ULTRASOUND, 'Pregnancy recorded — fetal assessment on arrival');
            if (typeof v.gestationalWeeks === 'number' && v.gestationalWeeks > 0 && v.gestationalWeeks < 37) {
                set.add(N.RADIANT_WARMER, `${v.gestationalWeeks} weeks — preterm delivery possible`);
            }
        }

        if (typeof v.childAgeMonths === 'number' && v.childAgeMonths >= 0 && v.childAgeMonths < 60) {
            set.add(N.PAEDIATRIC_BED, `Child aged ${v.childAgeMonths} months`);
        }
    }

    return set.list();
}

// ── cross-referencing the receiving facility ─────────────────────────────────

/**
 * Judge each need against what the facility is recorded as having.
 *
 * Equipment and services are searched together because the two lists overlap by
 * convention rather than by rule: a blood bank is a "service" at the DH and a
 * "Blood Storage Unit" at the SDH, and either answer means the same thing to an
 * ambulance crew.
 *
 * `facility` is null when the receiving facility is not in this device's copy of
 * the network. Every item then reads UNKNOWN — the honest answer, and the one
 * that makes staff phone ahead instead of assuming.
 */
export function readinessFor(
    needs: EquipmentNeed[],
    facility: Pick<Facility, 'equipment' | 'services'> | null,
    options: { fromReferralOnly?: boolean } = {}
): ReadinessReport {
    const lines = facility ? [...(facility.equipment ?? []), ...(facility.services ?? [])] : null;

    const items: ReadinessItem[] = needs.map((need) => {
        if (!lines) return { need, state: 'UNKNOWN' };
        const hit = lines.find((line) => need.match.some((re) => re.test(line)));
        return hit ? { need, state: 'READY', matchedOn: hit } : { need, state: 'GAP' };
    });

    return {
        items,
        gaps: items.filter((i) => i.state === 'GAP').length,
        unknowns: items.filter((i) => i.state === 'UNKNOWN').length,
        fromReferralOnly: options.fromReferralOnly ?? false,
    };
}

/**
 * The whole derivation in one call, which is what the board uses.
 */
export function prepareFor(
    referral: Pick<ReferralRecord, 'priority' | 'reason' | 'clinicalSummary'>,
    patient: Patient | null,
    facility: Pick<Facility, 'equipment' | 'services'> | null
): ReadinessReport {
    return readinessFor(requiredEquipment(referral, patient), facility, {
        fromReferralOnly: patient === null,
    });
}
