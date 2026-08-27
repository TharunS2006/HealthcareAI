/**
 * NalamMesh Data Models — Rural Public Healthcare (SIH PS#26133)
 * ABDM/FHIR-compliant patient & clinical structures for tiered care
 */

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
    priority: TriagePriority;
    status: 'INITIATED' | 'ACCEPTED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED';
    referredBy: string;
    referredAt: Date | string;
    completedAt?: Date | string;
    transportMode: 'AMBULANCE_108' | 'AMBULANCE_102' | 'SELF' | 'PUBLIC_TRANSPORT';
    ambulanceVehicleNo?: string;
    clinicalSummary?: string;
    notes?: string;
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
    createdAt: Date | string;
}
