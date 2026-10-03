/**
 * Seed facility resources and maintenance log.
 *
 * Numbers follow the bed totals already published in FACILITY_NETWORK, split
 * by ward, so the directory and the resources screen never disagree about how
 * big a hospital is. A few deliberate faults are seeded — the CHC's X-ray is
 * out of order, two DH ventilators are in maintenance — because a capacity
 * check that is green everywhere demonstrates nothing.
 *
 * Sub Centres have no record: they hold no beds and never receive referrals.
 */

import type { FacilityResources, MaintenanceTicket, Shift } from '@/types/resources';

/** The shift in progress at a given hour: 08–14 morning, 14–20 evening, else night. */
export function shiftAt(date: Date): Shift {
    const h = date.getHours();
    return h >= 8 && h < 14 ? 'MORNING' : h >= 14 && h < 20 ? 'EVENING' : 'NIGHT';
}

const NOW = Date.now();
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const day = (daysFromNow: number) => new Date(NOW + daysFromNow * 86_400_000).toISOString().slice(0, 10);
const shift = shiftAt(new Date(NOW));

export const SEED_RESOURCES: FacilityResources[] = [
    {
        facilityId: 'dh-district',
        wards: [
            { ward: 'GENERAL', total: 170, occupied: 130 },
            { ward: 'ICU', total: 20, occupied: 16 },
            { ward: 'MATERNITY', total: 60, occupied: 52 },
            { ward: 'PEDIATRIC', total: 25, occupied: 19 },
            { ward: 'EMERGENCY', total: 25, occupied: 18 },
        ],
        equipment: [
            { kind: 'VENTILATOR', units: 12 },
            { kind: 'OXYGEN', units: 1 },
            { kind: 'XRAY', units: 2 },
            { kind: 'ULTRASOUND', units: 2 },
            { kind: 'BLOOD_BANK', units: 1 },
            { kind: 'DIALYSIS', units: 4 },
        ],
        shift,
        staffOnDuty: [
            { specialty: 'GENERAL_MEDICINE', count: 3 },
            { specialty: 'OBSTETRICS', count: 2 },
            { specialty: 'PAEDIATRICS', count: 2 },
            { specialty: 'GENERAL_SURGERY', count: 2 },
            { specialty: 'ANAESTHESIA', count: 1 },
            { specialty: 'ORTHOPAEDICS', count: 1 },
            { specialty: 'RADIOLOGY', count: 1 },
            { specialty: 'NEPHROLOGY', count: 1 },
        ],
        updatedAt: iso(35),
        updatedBy: 'Meera Wanjari',
    },
    {
        facilityId: 'sdh-aheri',
        wards: [
            { ward: 'GENERAL', total: 40, occupied: 28 },
            { ward: 'ICU', total: 6, occupied: 4 },
            { ward: 'MATERNITY', total: 30, occupied: 24 },
            { ward: 'PEDIATRIC', total: 14, occupied: 11 },
            { ward: 'EMERGENCY', total: 10, occupied: 7 },
        ],
        equipment: [
            { kind: 'VENTILATOR', units: 2 },
            { kind: 'OXYGEN', units: 1 },
            { kind: 'XRAY', units: 1 },
            { kind: 'ULTRASOUND', units: 1 },
            { kind: 'BLOOD_BANK', units: 1 },
        ],
        shift,
        staffOnDuty: [
            { specialty: 'GENERAL_MEDICINE', count: 2 },
            { specialty: 'OBSTETRICS', count: 1 },
            { specialty: 'PAEDIATRICS', count: 1 },
            { specialty: 'GENERAL_SURGERY', count: 1 },
            { specialty: 'ANAESTHESIA', count: 1 },
            { specialty: 'ORTHOPAEDICS', count: 1 },
        ],
        updatedAt: iso(80),
        updatedBy: 'Nanda Gedam',
    },
    {
        facilityId: 'chc-etapalli',
        wards: [
            { ward: 'GENERAL', total: 14, occupied: 10 },
            { ward: 'MATERNITY', total: 12, occupied: 9 },
            { ward: 'EMERGENCY', total: 4, occupied: 2 },
        ],
        equipment: [
            { kind: 'OXYGEN', units: 1 },
            { kind: 'XRAY', units: 1 },
            { kind: 'ULTRASOUND', units: 1 },
            // First Referral Unit: a blood storage unit, not a full blood bank.
            { kind: 'BLOOD_BANK', units: 1 },
        ],
        shift,
        staffOnDuty: [
            { specialty: 'GENERAL_MEDICINE', count: 1 },
            { specialty: 'OBSTETRICS', count: 1 },
            { specialty: 'GENERAL_SURGERY', count: 1 },
            { specialty: 'ANAESTHESIA', count: 1 },
        ],
        updatedAt: iso(20),
        updatedBy: 'Rajesh Kodape',
    },
    {
        facilityId: 'phc-bhamragad',
        wards: [
            { ward: 'GENERAL', total: 6, occupied: 3 },
            { ward: 'MATERNITY', total: 4, occupied: 3 },
        ],
        equipment: [{ kind: 'OXYGEN', units: 1 }],
        shift,
        staffOnDuty: [{ specialty: 'GENERAL_MEDICINE', count: 2 }],
        updatedAt: iso(60),
        updatedBy: 'Dr. Suresh Atram',
    },
    {
        facilityId: 'phc-perimili',
        wards: [
            { ward: 'GENERAL', total: 4, occupied: 2 },
            { ward: 'MATERNITY', total: 2, occupied: 1 },
        ],
        equipment: [{ kind: 'OXYGEN', units: 1 }],
        shift,
        staffOnDuty: [{ specialty: 'GENERAL_MEDICINE', count: 1 }],
        updatedAt: iso(90),
        updatedBy: 'Dr. Anjali Borkar',
    },
];

export const SEED_MAINTENANCE: MaintenanceTicket[] = [
    {
        id: 'mt-001',
        facilityId: 'chc-etapalli',
        target: { kind: 'EQUIPMENT', equipment: 'XRAY' },
        units: 1,
        severity: 'OUT_OF_ORDER',
        description: 'X-ray tube failure — exposures come out blank',
        status: 'ASSIGNED',
        reportedAt: iso(2 * 24 * 60),
        reportedBy: 'Rajesh Kodape',
        assignedTo: 'District Biomedical Engineer',
        assignedAt: iso(2 * 24 * 60 - 90),
        expectedRepairDate: day(3),
    },
    {
        id: 'mt-002',
        facilityId: 'dh-district',
        target: { kind: 'EQUIPMENT', equipment: 'VENTILATOR' },
        units: 2,
        severity: 'UNDER_MAINTENANCE',
        description: 'Preventive maintenance — flow sensor calibration',
        status: 'OPEN',
        reportedAt: iso(5 * 60),
        reportedBy: 'Meera Wanjari',
        expectedRepairDate: day(1),
    },
    {
        id: 'mt-003',
        facilityId: 'dh-district',
        target: { kind: 'EQUIPMENT', equipment: 'DIALYSIS' },
        units: 1,
        severity: 'OUT_OF_ORDER',
        description: 'RO water plant fault on dialysis station 3',
        status: 'ASSIGNED',
        reportedAt: iso(26 * 60),
        reportedBy: 'Meera Wanjari',
        assignedTo: 'Vendor service engineer',
        assignedAt: iso(24 * 60),
        expectedRepairDate: day(5),
    },
    {
        id: 'mt-004',
        facilityId: 'dh-district',
        target: { kind: 'BEDS', ward: 'ICU' },
        units: 1,
        severity: 'UNDER_MAINTENANCE',
        description: 'ICU bed 7 — motor fault, cannot tilt',
        status: 'OPEN',
        reportedAt: iso(3 * 60),
        reportedBy: 'Meera Wanjari',
    },
    {
        id: 'mt-005',
        facilityId: 'sdh-aheri',
        target: { kind: 'EQUIPMENT', equipment: 'ULTRASOUND' },
        units: 1,
        severity: 'UNDER_MAINTENANCE',
        description: 'Convex probe cracked',
        status: 'RESOLVED',
        reportedAt: iso(3 * 24 * 60),
        reportedBy: 'Nanda Gedam',
        assignedTo: 'Vendor service engineer',
        assignedAt: iso(3 * 24 * 60 - 60),
        resolvedAt: iso(24 * 60),
        resolvedBy: 'Nanda Gedam',
        resolutionNote: 'Probe replaced under warranty',
    },
];
