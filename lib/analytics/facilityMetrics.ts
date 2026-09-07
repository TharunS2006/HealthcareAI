/**
 * Facility scorecards, travel-burden savings, and danger-sign escalation telemetry.
 *
 * Everything here is derived from data the app actually holds (facility staffing/bed
 * records, patient triage outcomes, referral status). Nothing is a fixed display
 * number — if the underlying records change, these move with them.
 *
 * Deliberately NOT claimed anywhere in this module: "lives saved". Software cannot
 * attribute a survival to itself. What is measurable, and what these functions report,
 * is whether a detected danger sign actually reached definitive care — the care-cascade
 * gap that avoidable-mortality reviews (MDSR/CDR) are built around.
 */

import { Facility, FacilityType } from '@/types/facility';
import { Patient, ReferralRecord } from '@/types/patient';

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

/**
 * Average sustained speed for a 108/102 ambulance on Gadchiroli's tribal road network.
 * Deliberately well below highway speed: these are single-lane forest roads, partly
 * unmetalled, with monsoon washouts and nallah crossings. Used only for planning
 * estimates shown alongside real distances, never for dispatch decisions.
 */
const RURAL_ROAD_SPEED_KMPH = 30;

/**
 * Road distance runs longer than straight-line distance. 1.4 is a standard detour
 * index for hilly/forested terrain — applied so estimates lean conservative (longer)
 * rather than promising a patient a shorter journey than they will actually make.
 */
const TERRAIN_DETOUR_FACTOR = 1.4;

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two GPS points, in kilometres. */
export function haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated road distance (km) between two facilities, terrain-adjusted. */
export function roadDistanceKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    return haversineKm(a, b) * TERRAIN_DETOUR_FACTOR;
}

/** Estimated one-way travel time in minutes for a given road distance. */
export function travelMinutes(distanceKm: number): number {
    return (distanceKm / RURAL_ROAD_SPEED_KMPH) * 60;
}

// ---------------------------------------------------------------------------
// Travel burden avoided
// ---------------------------------------------------------------------------

export interface TravelSavings {
    /** Episodes resolved at or below CHC level instead of travelling to the district HQ. */
    episodesResolvedLocally: number;
    /** Round-trip kilometres patients did not have to travel. */
    kilometresAvoided: number;
    /** Round-trip travel hours avoided across all those episodes. */
    hoursAvoided: number;
    /** Mean round-trip hours avoided per episode. */
    averageHoursPerEpisode: number;
}

/**
 * Travel burden avoided by resolving an episode at the patient's nearest facility
 * instead of the district hospital.
 *
 * Counts only episodes that genuinely ended locally: a patient with no referral raised.
 * A patient who was referred onward travelled anyway, so they are excluded rather than
 * counted as a saving — otherwise the number flatters the system by claiming journeys
 * it did not prevent.
 *
 * Saving per episode is the round-trip difference between the journey to the district
 * hospital (the pre-existing "go to Gadchiroli for everything" pattern) and the journey
 * to the peripheral facility that actually served them, measured from the patient's own
 * recorded GPS position.
 */
export function computeTravelSavings(
    patients: Patient[],
    referrals: ReferralRecord[],
    facilities: Facility[]
): TravelSavings {
    const districtHospital = facilities.find(f => f.type === 'DH');
    const empty: TravelSavings = {
        episodesResolvedLocally: 0,
        kilometresAvoided: 0,
        hoursAvoided: 0,
        averageHoursPerEpisode: 0,
    };
    if (!districtHospital) return empty;

    const peripheralTiers: FacilityType[] = ['SC', 'PHC', 'CHC'];
    const peripheral = facilities.filter(f => peripheralTiers.includes(f.type));
    if (peripheral.length === 0) return empty;

    // A patient with any referral raised is one who still had to travel onward.
    const referredPatientIds = new Set(referrals.map(r => r.patientId));

    let kilometresAvoided = 0;
    let episodes = 0;

    for (const patient of patients) {
        if (referredPatientIds.has(patient.id)) continue;
        if (!patient.gps) continue;

        const toDistrict = roadDistanceKm(patient.gps, districtHospital.location);
        const toNearestLocal = Math.min(
            ...peripheral.map(f => roadDistanceKm(patient.gps, f.location))
        );

        // Only a saving if the local facility really is closer than the district HQ.
        const savedOneWay = toDistrict - toNearestLocal;
        if (savedOneWay <= 0) continue;

        kilometresAvoided += savedOneWay * 2; // there and back
        episodes += 1;
    }

    const hoursAvoided = travelMinutes(kilometresAvoided) / 60;

    return {
        episodesResolvedLocally: episodes,
        kilometresAvoided,
        hoursAvoided,
        averageHoursPerEpisode: episodes === 0 ? 0 : hoursAvoided / episodes,
    };
}

// ---------------------------------------------------------------------------
// Danger-sign escalation telemetry
// ---------------------------------------------------------------------------

export interface DangerSignTelemetry {
    /** Cases carrying a clinical danger sign (RED triage or a high-risk flag). */
    dangerSignsDetected: number;
    /** Of those, how many had an escalation raised (referral to a higher tier). */
    escalated: number;
    /** Of those escalated, how many reached and were admitted at the receiving facility. */
    reachedDefinitiveCare: number;
    /** Detected danger signs with no escalation yet — the actionable backlog. */
    awaitingEscalation: number;
    /** Escalated but still in the pipeline (not yet admitted, not rejected). */
    inTransit: number;
    /** escalated / detected, as a percentage. */
    escalationRate: number;
    /** reachedDefinitiveCare / escalated, as a percentage (referral completion). */
    completionRate: number;
}

/**
 * The maternal/child mortality-prevention cascade, measured end to end:
 * danger sign detected → escalation raised → definitive care reached.
 *
 * The number that matters operationally is `awaitingEscalation`: a danger sign that
 * was detected but never acted on is precisely the failure mode maternal and child
 * death reviews keep surfacing, and it is the one a DHO can still do something about
 * today. It is surfaced as a gap to close, not folded into a success percentage.
 */
export function computeDangerSignTelemetry(
    patients: Patient[],
    referrals: ReferralRecord[]
): DangerSignTelemetry {
    const hasDangerSign = (p: Patient): boolean =>
        p.triageStatus === 'RED' || (p.highRiskFlags?.length ?? 0) > 0;

    const flagged = patients.filter(hasDangerSign);

    const referralsByPatient = new Map<string, ReferralRecord[]>();
    for (const referral of referrals) {
        const list = referralsByPatient.get(referral.patientId);
        if (list) list.push(referral);
        else referralsByPatient.set(referral.patientId, [referral]);
    }

    let escalated = 0;
    let reachedDefinitiveCare = 0;
    let inTransit = 0;

    for (const patient of flagged) {
        const patientReferrals = referralsByPatient.get(patient.id);
        if (!patientReferrals || patientReferrals.length === 0) continue;

        escalated += 1;

        if (patientReferrals.some(r => r.status === 'COMPLETED')) {
            reachedDefinitiveCare += 1;
        } else if (
            patientReferrals.some(
                r => r.status === 'INITIATED' || r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT'
            )
        ) {
            inTransit += 1;
        }
    }

    const detected = flagged.length;
    const pct = (numerator: number, denominator: number): number =>
        denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);

    return {
        dangerSignsDetected: detected,
        escalated,
        reachedDefinitiveCare,
        awaitingEscalation: detected - escalated,
        inTransit,
        escalationRate: pct(escalated, detected),
        completionRate: pct(reachedDefinitiveCare, escalated),
    };
}

// ---------------------------------------------------------------------------
// Facility scorecards
// ---------------------------------------------------------------------------

/**
 * A mandated capability, plus the words facilities actually use for it on the ground.
 *
 * Facility service lists are written in real clinical language ("24x7 Delivery Care
 * (BEmONC)", "Routine Diagnostics", "First Contact Care"), not in the vocabulary of the
 * standard. Matching the standard's term literally reports a CHC as having no OPD,
 * which is both wrong and the kind of thing that discredits the whole scorecard — so
 * each capability carries its recognised synonyms.
 */
interface EssentialCapability {
    label: string;
    aliases: string[];
}

const CAPABILITY = {
    outpatient: {
        label: 'Outpatient (OPD)',
        aliases: ['opd', 'outpatient', 'first contact care', 'general medicine', 'basic triage', 'basic emergency care'],
    },
    emergency: {
        label: 'Emergency Care',
        aliases: ['emergency', 'casualty', 'trauma', 'fru', 'first referral unit'],
    },
    surgery: {
        label: 'Surgery',
        aliases: ['surgery', 'surgical', 'operation theatre', 'ot'],
    },
    bloodBank: {
        label: 'Blood Bank',
        aliases: ['blood bank', 'blood storage'],
    },
    criticalCare: {
        label: 'Critical / Newborn Care',
        aliases: ['icu', 'sncu', 'nbsu', 'intensive', 'ventilator', 'stabilization', 'dialysis'],
    },
    obstetricCare: {
        label: 'Emergency Obstetric Care',
        aliases: ['cemonc', 'bemonc', 'obstetric', 'delivery', 'deliveries', 'maternity', 'labour'],
    },
    laboratory: {
        label: 'Laboratory / Diagnostics',
        aliases: ['lab', 'laboratory', 'diagnostic', 'diagnostics', 'screening', 'analyzer', 'pathology'],
    },
    antenatal: {
        label: 'Antenatal Care',
        aliases: ['anc', 'antenatal', 'maternal', 'postnatal'],
    },
    immunization: {
        label: 'Immunization',
        aliases: ['immunization', 'immunisation', 'vaccination', 'vaccine'],
    },
} as const satisfies Record<string, EssentialCapability>;

/**
 * Indian Public Health Standards staffing and service expectations per tier.
 * Sourced from the IPHS 2022 norms the rest of the app is written against; a facility
 * is scored against the standard for *its own* tier, so a Sub-Centre is never marked
 * down for lacking a surgeon it was never meant to have.
 */
const IPHS_NORMS: Record<
    FacilityType,
    { doctors: number; nurses: number; ambulances: number; essentialServices: EssentialCapability[] }
> = {
    DH: {
        doctors: 20,
        nurses: 60,
        ambulances: 5,
        essentialServices: [
            CAPABILITY.outpatient,
            CAPABILITY.emergency,
            CAPABILITY.surgery,
            CAPABILITY.bloodBank,
            CAPABILITY.criticalCare,
        ],
    },
    SDH: {
        doctors: 10,
        nurses: 25,
        ambulances: 3,
        essentialServices: [
            CAPABILITY.emergency,
            CAPABILITY.obstetricCare,
            CAPABILITY.surgery,
            CAPABILITY.bloodBank,
        ],
    },
    CHC: {
        doctors: 4,
        nurses: 12,
        ambulances: 2,
        essentialServices: [
            CAPABILITY.outpatient,
            CAPABILITY.obstetricCare,
            CAPABILITY.laboratory,
        ],
    },
    PHC: {
        doctors: 2,
        nurses: 5,
        ambulances: 1,
        essentialServices: [
            CAPABILITY.outpatient,
            CAPABILITY.obstetricCare,
            CAPABILITY.laboratory,
        ],
    },
    SC: {
        doctors: 0,
        nurses: 1,
        ambulances: 0,
        essentialServices: [
            CAPABILITY.antenatal,
            CAPABILITY.immunization,
        ],
    },
};

/** True when any of the facility's listed services names this capability. */
function facilityHasCapability(facility: Facility, capability: EssentialCapability): boolean {
    const listed = facility.services.map(s => s.toLowerCase());
    return capability.aliases.some(alias => listed.some(service => service.includes(alias)));
}

export interface ScorecardComponent {
    label: string;
    /** 0-100 for this dimension. */
    score: number;
    /** Human-readable actual-vs-expected, e.g. "2 / 2 MOs". */
    detail: string;
}

export interface FacilityScorecard {
    facilityId: string;
    facilityName: string;
    type: FacilityType;
    /** Weighted 0-100 composite. */
    score: number;
    grade: 'A' | 'B' | 'C' | 'D';
    components: ScorecardComponent[];
    /** Shortfalls worth a DHO's attention, most severe first. */
    gaps: string[];
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/** Ratio of actual to required, as a 0-100 score. A zero requirement scores full marks. */
const ratioScore = (actual: number, required: number): number =>
    required <= 0 ? 100 : clampPercent((actual / required) * 100);

/**
 * Scores one facility against the IPHS norms for its tier.
 *
 * Weights favour staffing and bed headroom because those are what actually turn a
 * patient away at the door; connectivity matters but a facility with staff and beds
 * still treats people when the mesh is down, which is the whole premise of this system.
 */
export function scoreFacility(facility: Facility): FacilityScorecard {
    const norm = IPHS_NORMS[facility.type];

    const doctorScore = ratioScore(facility.staff.doctors, norm.doctors);
    const nurseScore = ratioScore(facility.staff.nurses, norm.nurses);
    const staffingScore = clampPercent(doctorScore * 0.6 + nurseScore * 0.4);

    const totalBeds = facility.beds.total;
    const freeBeds = Math.max(0, totalBeds - facility.beds.occupied);
    // Full marks at >=25% free; a ward at capacity cannot accept the next referral.
    const bedScore = totalBeds <= 0 ? 100 : clampPercent((freeBeds / totalBeds) * 400);

    const servicesPresent = norm.essentialServices.filter(required =>
        facilityHasCapability(facility, required)
    );
    const serviceScore = norm.essentialServices.length === 0
        ? 100
        : clampPercent((servicesPresent.length / norm.essentialServices.length) * 100);

    const ambulanceScore = ratioScore(facility.ambulanceAvailable, norm.ambulances);
    const connectivityScore = facility.isOnline ? 100 : 0;

    const score = clampPercent(
        staffingScore * 0.35 +
        bedScore * 0.25 +
        serviceScore * 0.2 +
        ambulanceScore * 0.1 +
        connectivityScore * 0.1
    );

    const grade: FacilityScorecard['grade'] =
        score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';

    const components: ScorecardComponent[] = [
        {
            label: 'Staffing vs IPHS',
            score: staffingScore,
            detail: `${facility.staff.doctors}/${norm.doctors} MO · ${facility.staff.nurses}/${norm.nurses} nursing`,
        },
        {
            label: 'Bed Headroom',
            score: bedScore,
            detail: totalBeds === 0 ? 'No inpatient beds (per tier)' : `${freeBeds} free of ${totalBeds}`,
        },
        {
            label: 'Essential Services',
            score: serviceScore,
            detail: `${servicesPresent.length}/${norm.essentialServices.length} mandated services`,
        },
        {
            label: 'Emergency Transport',
            score: ambulanceScore,
            detail: `${facility.ambulanceAvailable}/${norm.ambulances} ambulance${norm.ambulances === 1 ? '' : 's'}`,
        },
        {
            label: 'Mesh Connectivity',
            score: connectivityScore,
            detail: facility.isOnline ? 'Node reporting' : 'Node offline — records queued locally',
        },
    ];

    const gaps: string[] = [];
    if (facility.staff.doctors < norm.doctors) {
        gaps.push(`Short ${norm.doctors - facility.staff.doctors} medical officer(s) against IPHS norm`);
    }
    if (facility.staff.nurses < norm.nurses) {
        gaps.push(`Short ${norm.nurses - facility.staff.nurses} nursing staff against IPHS norm`);
    }
    if (totalBeds > 0 && freeBeds / totalBeds < 0.1) {
        gaps.push(`Bed occupancy critical — only ${freeBeds} bed(s) free of ${totalBeds}`);
    }
    const missingServices = norm.essentialServices.filter(s => !servicesPresent.includes(s));
    if (missingServices.length > 0) {
        gaps.push(`Missing mandated service(s): ${missingServices.map(s => s.label).join(', ')}`);
    }
    if (facility.ambulanceAvailable < norm.ambulances) {
        gaps.push(`Below ambulance norm (${facility.ambulanceAvailable} of ${norm.ambulances})`);
    }
    if (!facility.isOnline) {
        gaps.push('Mesh node offline — cross-facility records not syncing');
    }

    return {
        facilityId: facility.id,
        facilityName: facility.name,
        type: facility.type,
        score,
        grade,
        components,
        gaps,
    };
}

/** Scorecards for every facility, weakest first — the list a DHO should act on. */
export function scoreAllFacilities(facilities: Facility[]): FacilityScorecard[] {
    return facilities.map(scoreFacility).sort((a, b) => a.score - b.score);
}
