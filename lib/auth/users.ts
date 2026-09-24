/**
 * Staff directory — one seeded user for every role at every posting the demo
 * needs, so each feature can be exercised the moment the app opens.
 *
 * The directory decides who a notification is addressed to: "the PHC Medical
 * Officer" means every active user posted at that PHC whose role holds the
 * right permission. Super Admin edits it at /admin; the edits live in
 * IndexedDB (`users` store) and this file is only the starting point.
 *
 * Mock auth: there are no passwords. Sign-in chooses one of these users.
 */

import type { StaffRole } from './permissions';
import type { Specialty } from '@/types/resources';

export interface StaffUser {
    id: string;
    name: string;
    role: StaffRole;
    /** null for district and system roles, which have no single facility. */
    facilityId: string | null;
    staffId: string;
    specialty?: Specialty;
    active: boolean;
}

export const SEED_USERS: StaffUser[] = [
    // Sub Centres
    { id: 'u-anm-kothi', name: 'Sunita Hichami', role: 'ANM', facilityId: 'sc-kothi', staffId: 'ANM-KOT-1021', active: true },
    { id: 'u-anm-govindpur', name: 'Kavita Madavi', role: 'ANM', facilityId: 'sc-govindpur', staffId: 'ANM-GOV-1022', active: true },

    // PHCs
    { id: 'u-mo-bhamragad', name: 'Dr. Suresh Atram', role: 'MO', facilityId: 'phc-bhamragad', staffId: 'MO-GAD-4412', active: true },
    { id: 'u-mo-perimili', name: 'Dr. Anjali Borkar', role: 'MO', facilityId: 'phc-perimili', staffId: 'MO-PER-4413', active: true },

    // CHC / SDH / DH — bed managers
    { id: 'u-ha-chc', name: 'Rajesh Kodape', role: 'HOSPITAL_ADMIN', facilityId: 'chc-etapalli', staffId: 'HA-CHC-7001', active: true },
    { id: 'u-ha-sdh', name: 'Nanda Gedam', role: 'HOSPITAL_ADMIN', facilityId: 'sdh-aheri', staffId: 'HA-SDH-7002', active: true },
    { id: 'u-ha-dh', name: 'Meera Wanjari', role: 'HOSPITAL_ADMIN', facilityId: 'dh-district', staffId: 'HA-DH-7003', active: true },

    // CHC / DH — specialists
    { id: 'u-sp-chc', name: 'Dr. Prakash Uike', role: 'SPECIALIST', facilityId: 'chc-etapalli', staffId: 'SP-CHC-5101', specialty: 'OBSTETRICS', active: true },
    { id: 'u-sp-dh', name: 'Dr. Pramod Khandate', role: 'SPECIALIST', facilityId: 'dh-district', staffId: 'SP-DH-5102', specialty: 'PAEDIATRICS', active: true },

    // District and system
    { id: 'u-dho', name: 'Dr. Kiran Dhurve', role: 'DHO', facilityId: null, staffId: 'DHO-DIST-0001', active: true },
    { id: 'u-sa', name: 'System Administrator', role: 'SUPER_ADMIN', facilityId: null, staffId: 'SA-NIC-0001', active: true },
];

/** The quick-login accounts on the sign-in screen, one per role, in hierarchy order. */
export const DEMO_LOGIN_USER_IDS: readonly string[] = [
    'u-anm-kothi',
    'u-mo-bhamragad',
    'u-ha-chc',
    'u-sp-chc',
    'u-dho',
    'u-sa',
];
