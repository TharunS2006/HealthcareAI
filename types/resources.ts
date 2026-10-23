/**
 * Facility resources — what a receiving hospital actually has free right now.
 *
 * Acceptance is decided against these, not against a button. Two derived
 * quantities are deliberately NOT stored here:
 *
 *   - beds under maintenance, and equipment status, come from open
 *     MaintenanceTickets. Reporting an issue removes the capacity and resolving
 *     it returns it, with no second number to keep in step.
 *   - reserved beds come from referrals holding a reservation. A bed is
 *     reserved because a referral says so; a counter could drift from that.
 *
 * See lib/capacity/availability.ts for how available = total − occupied −
 * maintenance − reserved is computed.
 */

export type WardType = 'GENERAL' | 'ICU' | 'MATERNITY' | 'PEDIATRIC' | 'EMERGENCY';

export const WARD_TYPES: readonly WardType[] = ['GENERAL', 'ICU', 'MATERNITY', 'PEDIATRIC', 'EMERGENCY'];

export const WARD_LABELS: Record<WardType, string> = {
    GENERAL: 'General',
    ICU: 'ICU',
    MATERNITY: 'Maternity',
    PEDIATRIC: 'Paediatric',
    EMERGENCY: 'Emergency',
};

export type EquipmentKind = 'VENTILATOR' | 'OXYGEN' | 'XRAY' | 'ULTRASOUND' | 'BLOOD_BANK' | 'DIALYSIS';

export const EQUIPMENT_KINDS: readonly EquipmentKind[] = ['VENTILATOR', 'OXYGEN', 'XRAY', 'ULTRASOUND', 'BLOOD_BANK', 'DIALYSIS'];

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
    VENTILATOR: 'Ventilator',
    OXYGEN: 'Oxygen supply',
    XRAY: 'X-ray',
    ULTRASOUND: 'Ultrasound',
    BLOOD_BANK: 'Blood bank',
    DIALYSIS: 'Dialysis',
};

export type EquipmentStatus = 'WORKING' | 'UNDER_MAINTENANCE' | 'OUT_OF_ORDER';

export type Specialty =
    | 'GENERAL_MEDICINE'
    | 'OBSTETRICS'
    | 'PAEDIATRICS'
    | 'GENERAL_SURGERY'
    | 'ANAESTHESIA'
    | 'ORTHOPAEDICS'
    | 'RADIOLOGY'
    | 'NEPHROLOGY';

export const SPECIALTIES: readonly Specialty[] = [
    'GENERAL_MEDICINE',
    'OBSTETRICS',
    'PAEDIATRICS',
    'GENERAL_SURGERY',
    'ANAESTHESIA',
    'ORTHOPAEDICS',
    'RADIOLOGY',
    'NEPHROLOGY',
];

export const SPECIALTY_LABELS: Record<Specialty, string> = {
    GENERAL_MEDICINE: 'General Medicine',
    OBSTETRICS: 'Obstetrics & Gynaecology',
    PAEDIATRICS: 'Paediatrics',
    GENERAL_SURGERY: 'General Surgery',
    ANAESTHESIA: 'Anaesthesia',
    ORTHOPAEDICS: 'Orthopaedics',
    RADIOLOGY: 'Radiology',
    NEPHROLOGY: 'Nephrology',
};

export type Shift = 'MORNING' | 'EVENING' | 'NIGHT';

export interface WardBeds {
    ward: WardType;
    total: number;
    /** Patients physically in beds. Admission and discharge move this. */
    occupied: number;
}

export interface EquipmentLine {
    kind: EquipmentKind;
    /** How many units the facility holds, working or not. */
    units: number;
}

export interface StaffOnDuty {
    specialty: Specialty;
    count: number;
}

export interface FacilityResources {
    facilityId: string;
    wards: WardBeds[];
    equipment: EquipmentLine[];
    shift: Shift;
    staffOnDuty: StaffOnDuty[];
    updatedAt: string;
    updatedBy: string;
}

export type MaintenanceTarget =
    | { kind: 'EQUIPMENT'; equipment: EquipmentKind }
    | { kind: 'BEDS'; ward: WardType };

export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED';

export interface MaintenanceTicket {
    id: string;
    facilityId: string;
    target: MaintenanceTarget;
    /** Units (or beds) taken out of service by this issue. */
    units: number;
    severity: Exclude<EquipmentStatus, 'WORKING'>;
    description: string;
    status: MaintenanceStatus;
    reportedAt: string;
    reportedBy: string;
    assignedTo?: string;
    assignedAt?: string;
    /** YYYY-MM-DD */
    expectedRepairDate?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNote?: string;
}
