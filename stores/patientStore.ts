/**
 * Zustand state management for patient records
 * Provides optimistic UI updates and sync status tracking
 */

import { create } from 'zustand';
import { Patient } from '@/types/patient';
import { savePatient, getAllPatients, getUnsyncedPatients } from '@/lib/db';
import toast from 'react-hot-toast';

interface PatientStore {
    patients: Patient[];
    unsyncedCount: number;
    isLoading: boolean;

    // Actions
    addPatient: (patient: Patient) => Promise<void>;
    updatePatient: (patient: Patient) => Promise<void>;
    loadPatients: () => Promise<void>;
    updateSyncStatus: (patientId: string, synced: boolean) => Promise<void>;
    refreshUnsyncedCount: () => Promise<void>;
    resetData: () => Promise<void>;
    initSocket: () => Promise<void>;
}

export const usePatientStore = create<PatientStore>((set, get) => ({
    patients: [],
    unsyncedCount: 0,
    isLoading: false,

    // Initialize socket listeners
    initSocket: async () => {
        try {
            const { getSocket } = await import('@/lib/socket');
            const socket = getSocket();

            socket.off('patient:sync'); // Remove old listeners
            socket.on('patient:sync', (patient: Patient) => {
                console.log('Received patient sync:', patient.id);
                set(state => {
                    const exists = state.patients.find(p => p.id === patient.id);
                    if (exists && new Date(exists.timestamp) >= new Date(patient.timestamp)) {
                        return state; // Ignore older/duplicate
                    }
                    const others = state.patients.filter(p => p.id !== patient.id);

                    // Show confirmation toast
                    toast.success(`Remote Sync: Patient #${patient.id.slice(0, 4)} received`);

                    return { patients: [patient, ...others] };
                });
                // Also save to DB
                savePatient(patient).catch(console.error);
            });

            // Listen for global reset
            socket.off('data:reset');
            socket.on('data:reset', () => {
                console.log('Received global reset command');
                toast.success('Remote Sync: System Data Reset');

                // Perform local reset of store and DB
                import('@/lib/db').then(({ clearAllPatients }) => {
                    clearAllPatients().catch(console.error);
                });
                set({ patients: [], unsyncedCount: 0 });
            });
        } catch (error) {
            console.error('Socket init failed:', error);
        }
    },

    resetData: async () => {
        try {
            const { clearAllPatients } = await import('@/lib/db');
            await clearAllPatients();
            set({ patients: [], unsyncedCount: 0 });

            // Emit global reset to others
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('data:reset');
            } catch (err) {
                console.warn('Socket reset emit failed:', err);
            }
        } catch (error) {
            console.error('Failed to reset data:', error);
        }
    },

    addPatient: async (patient: Patient) => {
        // Optimistic UI update
        set(state => ({
            patients: [patient, ...state.patients],
            unsyncedCount: state.unsyncedCount + 1,
        }));

        try {
            await savePatient(patient);

            // Emit sync event
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('patient:sync', patient);
            } catch (err) {
                console.warn('Socket emit failed:', err);
            }

        } catch (error) {
            console.error('Failed to save patient:', error);
            // Rollback on error
            set(state => ({
                patients: state.patients.filter(p => p.id !== patient.id),
                unsyncedCount: Math.max(0, state.unsyncedCount - 1),
            }));
            throw error;
        }
    },

    loadPatients: async () => {
        set({ isLoading: true });
        try {
            const patients = await getAllPatients();
            set({ patients, isLoading: false });
            await get().refreshUnsyncedCount();
        } catch (error) {
            console.error('Failed to load patients:', error);
            set({ isLoading: false });
        }
    },

    updateSyncStatus: async (patientId: string, synced: boolean) => {
        set(state => ({
            patients: state.patients.map(p =>
                p.id === patientId ? { ...p, isSynced: synced } : p
            ),
        }));

        const patient = get().patients.find(p => p.id === patientId);
        if (patient) {
            await savePatient({ ...patient, isSynced: synced });
            await get().refreshUnsyncedCount();
        }
    },

    updatePatient: async (updatedPatient: Patient) => {
        set(state => ({
            patients: state.patients.map(p =>
                p.id === updatedPatient.id ? updatedPatient : p
            ),
        }));

        try {
            await savePatient(updatedPatient);
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('patient:sync', updatedPatient);
            } catch (err) {
                console.warn('Socket emit update failed:', err);
            }
        } catch (error) {
            console.error('Failed to update patient:', error);
        }
    },

    refreshUnsyncedCount: async () => {
        const unsynced = await getUnsyncedPatients();
        set({ unsyncedCount: unsynced.length });
    },
}));
