/**
 * Zustand state management for longitudinal patient records
 * Optimistic UI updates, offline-first IndexedDB persistence & mesh sync */

import { create } from 'zustand';
import { Patient } from '@/types/patient';
import { savePatient, getAllPatients, getUnsyncedPatients, resetToDefaultSeed } from '@/lib/db';
import { queuePatient } from '@/lib/sync/outbox';
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

            // ---- Catch-up sync -------------------------------------------------
            // patient:sync is a live broadcast; a device that was offline when a
            // record was created never receives it. On every (re)connect we ask the
            // relay for everything newer than we last saw and merge it in.
            const LAST_SYNC_KEY = 'nalammesh-last-sync-at';
            const readLastSync = (): number => {
                try { return Number(localStorage.getItem(LAST_SYNC_KEY)) || 0; } catch { return 0; }
            };
            const writeLastSync = (t: number): void => {
                try { localStorage.setItem(LAST_SYNC_KEY, String(t)); } catch { /* private mode */ }
            };

            const requestCatchUp = () => socket.emit('sync:request', { since: readLastSync() });

            socket.off('sync:batch');
            socket.on('sync:batch', async (data: { patients: Patient[]; serverTime: number }) => {
                const incoming = Array.isArray(data?.patients) ? data.patients : [];
                if (incoming.length === 0) {
                    writeLastSync(data?.serverTime ?? Date.now());
                    return;
                }

                let applied = 0;
                for (const patient of incoming) {
                    const existing = get().patients.find(p => p.id === patient.id);
                    // Same last-write-wins guard the live path uses.
                    if (existing && new Date(existing.timestamp) >= new Date(patient.timestamp)) continue;
                    try {
                        await savePatient(patient);
                        applied++;
                    } catch (err) {
                        console.error('Catch-up sync: failed to persist', patient.id, err);
                    }
                }

                if (applied > 0) {
                    await get().loadPatients();
                    toast.success(`Synced ${applied} record${applied === 1 ? '' : 's'} missed while offline`);
                }
                writeLastSync(data?.serverTime ?? Date.now());
            });

            socket.off('connect', requestCatchUp);
            socket.on('connect', requestCatchUp);
            if (socket.connected) requestCatchUp();

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
                resetToDefaultSeed().then(async () => {
                    get().loadPatients();
                    const { announceReset } = await import('@/lib/referrals/transport');
                    announceReset();
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
            const { announceReset } = await import('@/lib/referrals/transport');
            announceReset();
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('data:reset');
            } catch (err) {
                console.warn('Socket reset emit failed:', err);
            }
            toast.success('Reset to Rural Benchmark Data');
        } catch (error) {
            console.error('Failed to reset data:', error);
        }
    },

    addPatient: async (patient: Patient) => {
        const previous = get().patients;
        set(state => ({
            patients: [patient, ...state.patients.filter(p => p.id !== patient.id)],
            unsyncedCount: state.unsyncedCount + 1,
        }));

        try {
            await savePatient(patient);
        } catch (error) {
            // Take the optimistic row back off the screen: a patient shown as
            // registered who is not stored would vanish on the next reload.
            console.error('Failed to save patient:', error);
            set({ patients: previous, unsyncedCount: Math.max(0, get().unsyncedCount - 1) });
            throw error;
        }
        try {
            const { getSocket } = await import('@/lib/socket');
            const socket = getSocket();
            socket.emit('patient:sync', patient);
        } catch (err) {
            console.warn('Socket emit failed:', err);
        }
        // Queue for the district cloud. The socket above only reaches devices on
        // the same mesh; this is what lets a hospital in another town open the
        // record before the patient arrives. Not awaited — it is durable and
        // uploads itself whenever connectivity returns.
        void queuePatient(patient);
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
        const previous = get().patients;
        set(state => ({
            patients: state.patients.map(p =>
                p.id === updatedPatient.id ? updatedPatient : p
            ),
        }));

        try {
            await savePatient(updatedPatient);
        } catch (error) {
            // Roll back and tell the caller — a vitals update that silently
            // fails leaves the screen showing readings the record does not hold.
            console.error('Failed to update patient:', error);
            set({ patients: previous });
            throw error;
        }
        try {
            const { getSocket } = await import('@/lib/socket');
            const socket = getSocket();
            socket.emit('patient:sync', updatedPatient);
        } catch (err) {
            console.warn('Socket emit update failed:', err);
        }
        void queuePatient(updatedPatient);
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
