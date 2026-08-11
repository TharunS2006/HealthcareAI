/**
 * NalamMesh Data Models
 * ABDM/FHIR-compliant patient data structures
 */

export type TriageStatus = 'RED' | 'YELLOW' | 'GREEN';

export interface Vitals {
    spo2: number; // Oxygen saturation (%)
    heartRate: number; // BPM
    injuryType: string;
    bloodPressure?: {
        systolic: number;
        diastolic: number;
    };
    consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
}

export interface GPSLocation {
    lat: number;
    lng: number;
    accuracy?: number;
}

export interface Patient {
    id: string; // UUID
    abhaId?: string; // ABDM Health ID
    vitals: Vitals;
    triageStatus: TriageStatus;
    transportStatus?: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED';
    gps: GPSLocation;
    isSynced: boolean;
    timestamp: Date;
    chw_id?: string; // Community Health Worker ID
    notes?: string;
    arScanUrl?: string; // URL to AR wound scan image
}

export interface MeshNode {
    nodeId: string;
    name: string;
    gps: GPSLocation;
    isOnline: boolean;
    lastSeen: Date;
    signalStrength: number; // 0-100
}

export interface SyncQueueItem {
    id: string;
    patientId: string;
    data: Patient;
    retryCount: number;
    createdAt: Date;
}

export interface HospitalCapacity {
    hospitalId: string;
    name: string;
    gps: GPSLocation;
    totalBeds: number;
    availableBeds: number;
    redCapacity: number; // Critical patient capacity
    yellowCapacity: number;
    greenCapacity: number;
}
