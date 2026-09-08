/**
 * Facility, Queue, Teleconsult & Inventory Data Models
 * Supporting Maharashtra Public Healthcare Hierarchy (SC -> PHC -> CHC -> SDH -> DH)
 */

import { FacilityType, GPSLocation, TriagePriority, Vitals } from './patient';

export type { FacilityType };

export interface StaffInfo {
    doctors: number;
    nurses: number;
    ashaWorkers: number;
    anmWorkers: number;
    pharmacists: number;
    labTechnicians: number;
}

export interface BedCapacity {
    total: number;
    occupied: number;
    icu?: { total: number; occupied: number };
    maternity?: { total: number; occupied: number };
    emergency?: { total: number; occupied: number };
}

export interface Facility {
    id: string;
    name: string;
    nameMarathi?: string;
    type: FacilityType;
    parentFacilityId?: string;      // Higher referral facility
    district: string;
    tehsil: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    contact: string;
    medicalOfficerInCharge: string;
    staff: StaffInfo;
    beds: BedCapacity;
    services: string[];             // e.g. "OPD", "24x7 Delivery", "Basic Lab", "X-Ray"
    equipment: string[];            // e.g. "ECG Machine", "Radiant Warmer", "Oxygen Concentrator"
    operatingHours: string;
    ambulanceAvailable: number;
    meshNodeId?: string;
    isOnline: boolean;
}

export interface QueueEntry {
    id: string;
    tokenNumber: string;            // e.g. "T-042"
    sequence: number;
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: 'M' | 'F' | 'O';
    facilityId: string;
    facilityName: string;
    registeredAt: Date | string;
    calledAt?: Date | string;
    completedAt?: Date | string;
    priority: TriagePriority;
    chiefComplaint: string;
    status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'REFERRED' | 'NO_SHOW';
    consultingDoctor?: string;
    roomNo?: string;
    estimatedWaitMinutes: number;
}

export interface MedicineStockItem {
    id: string;
    facilityId: string;
    facilityName: string;
    name: string;
    category: 'Analgesic' | 'Antibiotic' | 'Maternal/ANC' | 'Anti-diabetic' | 'Cardiovascular' | 'Rehydration' | 'Respiratory' | 'Supplement' | 'Emergency';
    dosageForm: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'IV Fluid' | 'Ointment' | 'Packet';
    currentStock: number;
    unit: string;                    // "tabs", "vials", "bottles", "packs"
    minimumRequiredStock: number;
    isEssentialIPHS: boolean;        // Indian Public Health Standards compliance
    batchNumber: string;
    expiryDate: string;              // YYYY-MM-DD
    status: 'ADEQUATE' | 'LOW' | 'OUT_OF_STOCK' | 'NEAR_EXPIRY';
    lastRestocked: string;
}

export interface DiagnosticOrder {
    id: string;
    patientId: string;
    patientName: string;
    patientAge: number;
    facilityId: string;
    facilityName: string;
    testName: string;
    category: 'Hematology' | 'Biochemistry' | 'Microbiology/Sputum' | 'Urine' | 'Rapid Test' | 'Radiology';
    orderedBy: string;
    orderedAt: Date | string;
    status: 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    resultSummary?: string;
    isAbnormal?: boolean;
    completedAt?: Date | string;
    normalRange?: string;
    labNotes?: string;
}

export interface TeleconsultSession {
    id: string;
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: 'M' | 'F' | 'O';
    initiatingFacilityId: string;
    initiatingFacilityName: string;
    initiatorRole: 'ASHA' | 'ANM' | 'CHO' | 'Medical Officer';
    initiatorName: string;
    specialistDoctorId: string;
    specialistDoctorName: string;
    specialistHospital: string;
    specialty: string;
    scheduledTime: Date | string;
    status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    reasonForConsult: string;
    currentVitals: Vitals;
    consultationNotes?: string;
    specialistDiagnosis?: string;
    prescriptionGenerated?: Array<{
        medicine: string;
        dosage: string;
        frequency: string;
        duration: string;
    }>;
    referralRecommended?: boolean;
    isLowBandwidthMode?: boolean;
}

/**
 * Accountability audit entry. Every mutation a clinician acts on (referral status,
 * queue movement, medicine stock) writes one of these, so the public system can answer
 * "who changed this, when, and from what to what." Snapshots are small JSON strings.
 */
export interface AuditLogEntry {
    id: string;
    entityType: 'PATIENT' | 'REFERRAL' | 'QUEUE' | 'MEDICINE';
    entityId: string;
    action: string;              // e.g. "CREATE", "STATUS → IN_TRANSIT", "STOCK_UPDATE"
    actorId: string;             // staff id, or "system" when unattributed
    actorRole: string;           // e.g. "MO", "DHO", "SYSTEM"
    timestamp: string;           // ISO
    before?: string;             // JSON snapshot of the changed fields, pre-change
    after?: string;              // JSON snapshot, post-change
}
