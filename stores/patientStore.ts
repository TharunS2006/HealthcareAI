/**
 * Zustand state management for longitudinal patient records
 * Optimistic UI updates, offline-first IndexedDB persistence & mesh sync */

import { create } from 'zustand';
import { Patient } from '@/types/patient';
import { savePatient, getAllPatients, getPatient, getUnsyncedPatients, resetToDefaultSeed } from '@/lib/db';
import { PRODUCTION } from '@/lib/config/mode';
import { queuePatient } from '@/lib/sync/outbox';
import { isNewerPatient, stampChange } from '@/lib/sync/patientVersion';
import { useAuthStore } from '@/stores/authStore';
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

/** The sign-in subscription behind patient catch-up; replaced if the socket is set up again. */
let unsubscribeSession: (() => void) | undefined;

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
            // record was created never receives it. On every (re)connect and every
            // sign-in we ask the relay for everything newer than this user last saw
            // and merge it in. The relay sends only the records this user may hold.
            //
            // The cursor is per user: on a shared device one user's progress must
            // not stand for another's, and a batch is filed under the user the relay
            // says it was for — never under nobody, so a signed-out request cannot
            // move anyone's cursor past records they have not received.
            const LAST_SYNC_KEY = 'nalammesh-last-sync-at';
            const cursorKey = (userId: string) => `${LAST_SYNC_KEY}:${userId}`;
            const readLastSync = (userId: string): number => {
                try { return Number(localStorage.getItem(cursorKey(userId))) || 0; } catch { return 0; }
            };
            const writeLastSync = (userId: string, t: number): void => {
                try { localStorage.setItem(cursorKey(userId), String(t)); } catch { /* private mode */ }
            };

            const requestCatchUp = () => {
                const session = useAuthStore.getState().session;
                if (!session?.token) return;
                // Identify first, so the relay answers for this user, not for whoever
                // the socket was a moment ago.
                socket.emit('session:identify', { token: session.token });
                socket.emit('sync:request', { since: readLastSync(session.userId) });
            };

            socket.off('sync:batch');
            socket.on('sync:batch', async (data: { patients: Patient[]; serverTime?: number; userId?: string }) => {
                const incoming = Array.isArray(data?.patients) ? data.patients : [];
                const fileUnder = (t: number | undefined) => {
                    if (data?.userId && typeof t === 'number') writeLastSync(data.userId, t);
                };
                if (incoming.length === 0) {
                    fileUnder(data?.serverTime);
                    return;
                }

                let applied = 0;
                for (const patient of incoming) {
                    // Against the stored copy too: the screen may not have loaded it yet.
                    const existing = get().patients.find(p => p.id === patient.id) ?? (await getPatient(patient.id).catch(() => undefined));
                    // Same last-write-wins guard the live path uses.
                    if (!isNewerPatient(patient, existing)) continue;
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
                fileUnder(data?.serverTime);
            });

            socket.off('connect', requestCatchUp);
            socket.on('connect', requestCatchUp);
            if (socket.connected) requestCatchUp();
            unsubscribeSession?.();
            unsubscribeSession = useAuthStore.subscribe((state, previous) => {
                if (state.session?.userId !== previous.session?.userId || state.session?.token !== previous.session?.token) requestCatchUp();
            });

            socket.off('patient:sync');
            socket.on('patient:sync', async (patient: Patient) => {
                // Only a newer copy is kept — on screen and on disk alike, so a
                // reload cannot bring back an older copy the screen refused.
                const held = get().patients.find(p => p.id === patient.id) ?? (await getPatient(patient.id).catch(() => undefined));
                if (!isNewerPatient(patient, held)) return;
                try {
                    await savePatient(patient);
                } catch (err) {
                    console.error('Live sync: failed to persist', patient.id, err);
                    return;
                }
                set(state => ({ patients: [patient, ...state.patients.filter(p => p.id !== patient.id)] }));
                toast.success(`Sync: Patient record #${patient.id.slice(-4)} updated`);
            });

            socket.off('data:reset');
            socket.on('data:reset', () => {
                // A production device holds real records; no broadcast wipes it.
                if (PRODUCTION) return;
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
        if (PRODUCTION) {
            toast.error('Resetting to demonstration data is not available in a production build');
            return;
        }
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
            toast.success('Reset to Maharashtra Rural Benchmark Data');
        } catch (error) {
            console.error('Failed to reset data:', error);
            toast.error('The reset did not complete — the data on this device may be partly reset. Reload and try again.');
        }
    },

    addPatient: async (incoming: Patient) => {
        // Also used to save an edit (a follow-up visit, say): either way this
        // is a change made here now, and other devices must see it as newer.
        const patient = stampChange(incoming);
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

    updatePatient: async (changed: Patient) => {
        const updatedPatient = stampChange(changed);
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
