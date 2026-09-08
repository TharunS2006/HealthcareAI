/**
 * Appointment scheduling model — NalamMesh (SIH PS#26133).
 *
 * PS#26133 asks for "appointment AND queue management." The walk-in token queue was the
 * only path; this adds future-dated booking against a facility's daily slot capacity, and
 * a hand-off into the live queue on the appointment day (see appointmentStore.convertToToken).
 * All local (IndexedDB) — works fully offline.
 */

export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'CONVERTED_TO_TOKEN';
export type AppointmentSource = 'ASHA_BOOKED' | 'SELF_REQUESTED';

export interface Appointment {
    id: string;
    patientId: string;
    patientName: string;      // denormalised for list display without a patient join
    facilityId: string;
    facilityName: string;
    department: string;       // e.g. "General OPD", "ANC Clinic", "Immunisation"
    requestedDate: string;    // YYYY-MM-DD (local calendar day)
    slot: string;             // one of APPOINTMENT_SLOTS
    status: AppointmentStatus;
    createdVia: AppointmentSource;
    notes?: string;
    createdAt: string;        // ISO
    tokenId?: string;         // set when converted to a live queue token
}

/** Standard OPD booking slots (same across facilities; capacity varies by staffing). */
export const APPOINTMENT_SLOTS = [
    '09:00–10:00',
    '10:00–11:00',
    '11:00–12:00',
    '12:00–13:00',
    '14:00–15:00',
    '15:00–16:00',
] as const;

/** Departments a rural facility books into. */
export const APPOINTMENT_DEPARTMENTS = [
    'General OPD',
    'ANC Clinic',
    'Immunisation',
    'NCD Clinic (BP/Sugar)',
    'Paediatrics',
] as const;
