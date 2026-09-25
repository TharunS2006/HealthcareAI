/**
 * NalamMesh Data Models — Rural Public Healthcare
 * ABDM/FHIR-compliant patient & clinical structures for tiered care */

import type {
    ReferralStatus,
    ReferralEvent,
    ReferralComment,
    TreatmentNote,
    ReferralRejection,
    RouteHistoryEntry,
    BedReservation,
    CapacityOverride,
    EmergencyEscalation,
} from './referral';
import type { WardType } from './resources';

export type TriageStatus = 'RED' | 'YELLOW' | 'GREEN';
export type TriagePriority = 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE';

export type FacilityType = 'SC' | 'PHC' | 'CHC' | 'SDH' | 'DH';

export interface Vitals {
    spo2: number;            // Oxygen saturation (%)
    heartRate: number;       // BPM (Pulse)
    bloodPressure?: {
        systolic: number;
        diastolic: number;
    };
    temperature?: number;    // °F (Normal: 98.6)
    respiratoryRate?: number;// Breaths/min (Normal: 12-20)
    bloodGlucose?: number;   // mg/dL (Normal Fasting: 70-100, Random: <140)
    weight?: number;         // kg
    consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
    injuryType: string;      // Chief complaint / symptoms / notes
    isPregnant?: boolean;
    gestationalWeeks?: number;
    childAgeMonths?: number;
}

export interface GPSLocation {
    lat: number;
    lng: number;
    accuracy?: number;
}

export interface PrescriptionItem {
    id: string;
    medicine: string;
    dosage: string;          // e.g. "500mg"
    frequency: string;       // e.g. "1-0-1 (Twice daily)"
    duration: string;        // e.g. "5 days"
    instructions?: string;   // e.g. "After food"
    dispensed: boolean;
}

export interface HighRiskFlag {
    type: 'MATERNAL' | 'CHILD_U5' | 'NCD_DIABETES' | 'NCD_HYPERTENSION' | 'TB' | 'MALNUTRITION' | 'OTHER';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    identifiedDate: Date | string;
    nextFollowUpDate: Date | string;
    notes?: string;
    overdueDays?: number;
    /** When a health worker last recorded a follow-up visit for this flag (lib/followup/recall.ts). */
    lastVisitAt?: Date | string;
}

export interface VisitRecord {
    visitId: string;
    patientId: string;
    facilityId: string;
    facilityName: string;
    facilityType: FacilityType;
    date: Date | string;
    chiefComplaint: string;
    vitals: Vitals;
    triageStatus: TriageStatus;
    diagnosis?: string;
    prescription?: PrescriptionItem[];
    referralId?: string;
    teleconsultId?: string;
    attendingStaff: string;
    followUpDate?: Date | string;
    notes?: string;
}

export interface ReferralRecord {
    id: string;
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: 'M' | 'F' | 'O';
    fromFacilityId: string;
    fromFacilityName: string;
    fromFacilityType: FacilityType;
    toFacilityId: string;
    toFacilityName: string;
    toFacilityType: FacilityType;
    reason: string;
    /** Urgency as the spec names it: Routine / Urgent / Emergency. */
    priority: TriagePriority;
    status: ReferralStatus;
    referredBy: string;
    referredByUserId?: string;
    referredAt: Date | string;
    /** Last change of any kind; the merge rule and the relay cache order by it. */
    updatedAt: string;
    transportMode: 'AMBULANCE_108' | 'AMBULANCE_102' | 'SELF' | 'PUBLIC_TRANSPORT';
    ambulanceVehicleNo?: string;
    clinicalSummary?: string;
    notes?: string;
    /** Vitals as recorded on the referral form, so the receiver is not reading today's values as the referral's. */
    vitalsAtReferral?: Vitals;

    // Lifecycle — every status change is an event, with who and when.
    timeline: ReferralEvent[];
    comments: ReferralComment[];
    treatmentNotes?: TreatmentNote[];
    sentVia?: 'RELAY' | 'LOCAL_PEER';
    deliveredAt?: string;       // "Seen by PHC at [time]"
    acknowledgedAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    arrivedAt?: string;
    admittedAt?: string;
    dischargedAt?: string;
    /** Kept from before the lifecycle rework; set on discharge so older readers still see a close. */
    completedAt?: Date | string;

    rejection?: ReferralRejection;
    routeHistory?: RouteHistoryEntry[];
    reservation?: BedReservation;
    /** The ward the patient was admitted to, so discharge frees the same one. */
    admittedWard?: WardType;
    capacityOverride?: CapacityOverride;
    escalation?: EmergencyEscalation;
    /** Set on a PHC referral the MO escalated onward, and on the onward one. */
    onwardReferralId?: string;
    parentReferralId?: string;

    // Transport telemetry — set when the sender dispatches the patient, so the
    // receiver sees real elapsed time rather than a static "in transit" label.
    inTransitAt?: Date | string;
    lastUpdatedAt?: Date | string;
    etaMinutes?: number;
}

export interface Patient {
    id: string;              // UUID
    abhaId?: string;         // ABDM Health ID e.g. 14-digit ABHA
    aadhaarLast4?: string;
    name: string;
    age: number;
    gender: 'M' | 'F' | 'O';
    phone?: string;
    village: string;
    tehsil: string;
    district: string;
    state?: string;
    languagePreference?: 'en' | 'hi' | 'mr';

    // Current State & Vitals
    vitals: Vitals;
    triageStatus: TriageStatus;
    triagePriority?: TriagePriority;
    transportStatus?: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED';

    // Longitudinal History
    visits?: VisitRecord[];
    activeReferral?: ReferralRecord;
    highRiskFlags?: HighRiskFlag[];

    // Sync & Audit
    gps: GPSLocation;
    isSynced: boolean;
    timestamp: Date | string;
    chw_id?: string;         // ASHA / ANM Worker ID
    chw_name?: string;
    /** The facility whose worker registered this patient — the basis of facility scoping. */
    registeredAtFacilityId?: string;
    notes?: string;
    arScanUrl?: string;
}

export interface MeshNode {
    nodeId: string;
    name: string;
    gps: GPSLocation;
    isOnline: boolean;
    lastSeen: Date;
    signalStrength: number;  // 0-100
}

export interface SyncQueueItem {
    id: string;
    patientId: string;
    entityType?: 'PATIENT' | 'VISIT' | 'REFERRAL' | 'QUEUE' | 'MEDICINE';
    data: any;
    retryCount: number;
    /**
     * When the change was made on this device — not when it was uploaded.
     *
     * The cloud resolves conflicts last-write-wins on this value, so it has to be
     * the moment the worker recorded the change. A device that was offline for a
     * day and reconnects then carries an honestly old timestamp, and the cloud
     * keeps the newer copy instead of being overwritten by the replay.
     */
    createdAt: Date | string;
    /** Earliest time the outbox may retry this item (exponential backoff). */
    nextAttemptAt?: string;
    /** Last failure reason, kept so a stuck item can be explained rather than guessed at. */
    lastError?: string;
    /**
     * Set when the cloud refused the record outright (a schema mismatch, say).
     * Such an item is skipped so it cannot block the records behind it, but it
     * is never deleted: a refusal is usually a bug in this app, and deleting
     * the record would destroy the evidence and the patient's hand-off with it.
     * Cleared on app start, so a fixed build retries it.
     */
    blockedReason?: string;
}
