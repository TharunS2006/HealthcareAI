/**
 * Staff directory — one seeded user for every role at every posting the demo
 * needs, so each feature can be exercised the moment the app opens.
 *
 * The directory decides who a notification is addressed to: "the PHC Medical
 * Officer" means every active user posted at that PHC whose role holds the
 * right permission. Super Admin edits it at /admin; the edits live in
 * IndexedDB (`users` store) and this file is only the starting point.
 *
 * Sign-in verifies a PIN against `pinHash` (lib/auth/pin.ts). The seeded
 * demo accounts share DEMO_PIN, shown on the sign-in screen for evaluation;
 * accounts the Super Admin creates get their own.
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
    /** PBKDF2 hash of the user's PIN (lib/auth/pin.ts). No hash: the user cannot sign in. */
    pinHash?: string;
    /**
     * The relay did not send this user's PIN hash to this device — they are not
     * posted here (server/relay/app.ts userFor). They sign in online only; the
     * seeded-PIN repair must never put the demo PIN back in its place.
     */
    pinHashWithheld?: boolean;
}

/** The PIN of every seeded demo account — public on purpose, printed on the sign-in screen. */
export const DEMO_PIN = '2468';

export const SEED_USERS: StaffUser[] = [
    // Sub Centres
    { id: 'u-anm-kothi', name: 'Sunita Hichami', role: 'ANM', facilityId: 'sc-kothi', staffId: 'ANM-KOT-1021', active: true, pinHash: 'pbkdf2-sha256$120000$Uk58FYYYyL6j_NaI8L_d6Q$ST-VzAFMCXP5gSD7kAF7_prdhxgyZA5tKscLR44bIsg' },
    { id: 'u-anm-govindpur', name: 'Kavita Madavi', role: 'ANM', facilityId: 'sc-govindpur', staffId: 'ANM-GOV-1022', active: true, pinHash: 'pbkdf2-sha256$120000$GGC_c3ZO1-Jt6874mWU48w$nWOxk11TEyjAdyH_RcBrNZq5uWjxCHu02ut_h9c9rF4' },

    // PHCs
    { id: 'u-mo-bhamragad', name: 'Dr. Suresh Atram', role: 'MO', facilityId: 'phc-bhamragad', staffId: 'MO-GAD-4412', active: true, pinHash: 'pbkdf2-sha256$120000$oySjVwQ1CDih6I_iKUTT2Q$HAZWM4dy45NDrews_fFKKwEG41NBq4vtamyIsQhTfRo' },
    { id: 'u-mo-perimili', name: 'Dr. Anjali Borkar', role: 'MO', facilityId: 'phc-perimili', staffId: 'MO-PER-4413', active: true, pinHash: 'pbkdf2-sha256$120000$Bl66lGQup1DkWKWgVwv9yg$L6QOn5-jhNDsLLE0rrEedKv-YEA1ym6lfDmFfV9086Q' },

    // CHC / SDH / DH — bed managers
    { id: 'u-ha-chc', name: 'Rajesh Kodape', role: 'HOSPITAL_ADMIN', facilityId: 'chc-etapalli', staffId: 'HA-CHC-7001', active: true, pinHash: 'pbkdf2-sha256$120000$pEgYVYoMTz2GgQmfBiYlQw$QKQJcQDG0Al2WlkqHS0_jClF_6-i-7AdnawYnZcxnl4' },
    { id: 'u-ha-sdh', name: 'Nanda Gedam', role: 'HOSPITAL_ADMIN', facilityId: 'sdh-aheri', staffId: 'HA-SDH-7002', active: true, pinHash: 'pbkdf2-sha256$120000$z3RwZ-NZ9js9yCp7mJqW5w$nnLi7V6CbESMItkHylJhit43V6dGKGhRCMOihRqDSUc' },
    { id: 'u-ha-dh', name: 'Meera Wanjari', role: 'HOSPITAL_ADMIN', facilityId: 'dh-district', staffId: 'HA-DH-7003', active: true, pinHash: 'pbkdf2-sha256$120000$rMkXOS6jhyZs4pDEHuYw3g$UFr82BYquZq_leZ728TD3qNh5lRryDMeWTxCA6NIea4' },

    // CHC / DH — specialists
    { id: 'u-sp-chc', name: 'Dr. Prakash Uike', role: 'SPECIALIST', facilityId: 'chc-etapalli', staffId: 'SP-CHC-5101', specialty: 'OBSTETRICS', active: true, pinHash: 'pbkdf2-sha256$120000$VArZ5EOCugajwLcAwx_wuw$8Wa_3yVhLgGW9W4zn3iuhhJsdf_fKFslWCZYHR7JXTk' },
    { id: 'u-sp-dh', name: 'Dr. Pramod Khandate', role: 'SPECIALIST', facilityId: 'dh-district', staffId: 'SP-DH-5102', specialty: 'PAEDIATRICS', active: true, pinHash: 'pbkdf2-sha256$120000$rBjEHh9qsR0fygHJWOfbJw$wKBYe0HHOX-rAufjG1EbroorTe0J34j9r9D99zfKEgw' },

    // District and system
    { id: 'u-dho', name: 'Dr. Kiran Dhurve', role: 'DHO', facilityId: null, staffId: 'DHO-DIST-0001', active: true, pinHash: 'pbkdf2-sha256$120000$YCqL5xb7LDXn7upp3IYgHw$dWlRTJ1MMIi3YXBgPiX9njtajIpnTTZjUZDmFmxbiT8' },
    { id: 'u-sa', name: 'System Administrator', role: 'SUPER_ADMIN', facilityId: null, staffId: 'SA-NIC-0001', active: true, pinHash: 'pbkdf2-sha256$120000$OPVIn2tXOeaaDN8Tc_E6zw$Axv-MUSLKi5Q4YTj_SLSvh0q2c-kqURaDdyowssYm8g' },
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
