/**
 * Zustand state management for longitudinal patient records
 * Optimistic UI updates, offline-first IndexedDB persistence & mesh sync
 */

import { create } from 'zustand';
import { Patient } from '@/types/patient';
import { savePatient, getAllPatients, getUnsyncedPatients, resetToDefaultSeed } from '@/lib/db';
import toast from 'react-hot-toast';

interface PatientStore {
    patients: Patient[];
    unsyncedCount: number;
    isLoading: boolean;
    selectedPatient: Patient | null;

    // Actions
    setSelectedPatient: (patient: Patient | null) => void;
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
    selectedPatient: null,

    setSelectedPatient: (patient) => set({ selectedPatient: patient }),

    initSocket: async () => {
        try {
            const { getSocket } = await import('@/lib/socket');
            const socket = getSocket();

            socket.off('patient:sync');
            socket.on('patient:sync', (patient: Patient) => {
                set(state => {
                    const exists = state.patients.find(p => p.id === patient.id);
                    if (exists && new Date(exists.timestamp) >= new Date(patient.timestamp)) {
                        return state;
                    }
                    const others = state.patients.filter(p => p.id !== patient.id);
                    toast.success(`Sync: Patient record #${patient.id.slice(-4)} updated`);
                    return { patients: [patient, ...others] };
                });
                savePatient(patient).catch(console.error);
            });

            socket.off('data:reset');
            socket.on('data:reset', () => {
                resetToDefaultSeed().then(() => {
                    get().loadPatients();
                    toast.success('System Data Reset Received');
                });
            });
        } catch (error) {
            console.error('Socket init failed:', error);
        }
    },

    resetData: async () => {
        try {
            await resetToDefaultSeed();
            await get().loadPatients();
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('data:reset');
            } catch (err) {
                console.warn('Socket reset emit failed:', err);
            }
            toast.success('Reset to Maharashtra Rural Benchmark Data');
        } catch (error) {
            console.error('Failed to reset data:', error);
        }
    },

    addPatient: async (patient: Patient) => {
        set(state => ({
            patients: [patient, ...state.patients.filter(p => p.id !== patient.id)],
            unsyncedCount: state.unsyncedCount + 1,
        }));

        try {
            await savePatient(patient);
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('patient:sync', patient);
            } catch (err) {
                console.warn('Socket emit failed:', err);
            }
        } catch (error) {
            console.error('Failed to save patient:', error);
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
        try {
            const unsynced = await getUnsyncedPatients();
            set({ unsyncedCount: unsynced.length });
        } catch {
            set({ unsyncedCount: 0 });
        }
    },
}));
