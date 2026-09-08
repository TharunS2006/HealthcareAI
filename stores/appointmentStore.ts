/**
 * Appointment scheduling store — NalamMesh.
 *
 * Future-dated bookings against facility slots, and the hand-off into the live OPD queue
 * on the appointment day. Follows the same discipline as the other stores: optimistic UI
 * with rollback on a failed persist, and honest toasts (never a false success).
 */

import { create } from 'zustand';
import toast from 'react-hot-toast';
import { Appointment } from '@/types/appointment';
import { QueueEntry } from '@/types/facility';
import { getAppointments, saveAppointment, updateAppointmentStatus, saveQueueEntry } from '@/lib/db';

interface AppointmentStore {
    appointments: Appointment[];
    isLoading: boolean;
    loadAppointments: () => Promise<void>;
    addAppointment: (appt: Appointment) => Promise<void>;
    changeStatus: (id: string, status: Appointment['status']) => Promise<void>;
    /** Create a live OPD queue token from a confirmed appointment. Returns the token number, or null on failure. */
    convertToToken: (
        appt: Appointment,
        patient?: { age?: number; gender?: 'M' | 'F' | 'O' }
    ) => Promise<string | null>;
}

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
    appointments: [],
    isLoading: false,

    loadAppointments: async () => {
        set({ isLoading: true });
        try {
            const rows = await getAppointments();
            set({ appointments: rows, isLoading: false });
        } catch (error) {
            console.error('Failed to load appointments:', error);
            set({ isLoading: false });
        }
    },

    addAppointment: async (appt) => {
        set(state => ({ appointments: [appt, ...state.appointments.filter(a => a.id !== appt.id)] }));
        try {
            await saveAppointment(appt);
            toast.success(`Appointment booked — ${appt.requestedDate}, ${appt.slot}`);
        } catch (error) {
            console.error('Failed to save appointment:', error);
            set(state => ({ appointments: state.appointments.filter(a => a.id !== appt.id) }));
            toast.error('Could not book the appointment — nothing saved');
        }
    },

    changeStatus: async (id, status) => {
        const previous = get().appointments;
        set(state => ({
            appointments: state.appointments.map(a => (a.id === id ? { ...a, status } : a)),
        }));
        try {
            await updateAppointmentStatus(id, status);
            toast.success(`Appointment ${status.toLowerCase()}`);
        } catch (error) {
            console.error('Failed to update appointment:', error);
            set({ appointments: previous });
            toast.error(`Could not update the appointment — no change saved`);
        }
    },

    convertToToken: async (appt, patient) => {
        if (appt.status === 'CONVERTED_TO_TOKEN' && appt.tokenId) {
            toast('This appointment is already checked in');
            return null;
        }
        // References the EXISTING patient by id — no new patient record is created.
        const token: QueueEntry = {
            id: `appt-tok-${appt.id.slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`,
            tokenNumber: `A-${Math.floor(100 + Math.random() * 900)}`,
            sequence: Date.now(),
            patientId: appt.patientId,
            patientName: appt.patientName,
            patientAge: patient?.age ?? 0,
            patientGender: patient?.gender ?? 'O',
            facilityId: appt.facilityId,
            facilityName: appt.facilityName,
            registeredAt: new Date().toISOString(),
            priority: 'ROUTINE',
            chiefComplaint: `Confirmed appointment — ${appt.department}`,
            status: 'WAITING',
            estimatedWaitMinutes: 15,
        };

        const previous = get().appointments;
        set(state => ({
            appointments: state.appointments.map(a =>
                a.id === appt.id ? { ...a, status: 'CONVERTED_TO_TOKEN', tokenId: token.id } : a
            ),
        }));

        try {
            await saveQueueEntry(token);
            await updateAppointmentStatus(appt.id, 'CONVERTED_TO_TOKEN', { tokenId: token.id });
            toast.success(`Checked in — token ${token.tokenNumber} added to the OPD queue`);
            return token.tokenNumber;
        } catch (error) {
            console.error('Failed to convert appointment to token:', error);
            set({ appointments: previous });
            toast.error('Check-in failed — no token created');
            return null;
        }
    },
}));
