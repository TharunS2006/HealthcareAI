/**
 * Queue & Token Management State Store
 * Controls live queue calling, priority overrides, and waiting times
 */

import { create } from 'zustand';
import { QueueEntry } from '@/types/facility';
import { getQueueEntries, saveQueueEntry, updateQueueStatus } from '@/lib/db';
import toast from 'react-hot-toast';

interface QueueStore {
    queue: QueueEntry[];
    currentServing: QueueEntry | null;
    isLoading: boolean;
    selectedFacilityId: string;

    // Actions
    setSelectedFacilityId: (facilityId: string) => void;
    loadQueue: (facilityId?: string) => Promise<void>;
    addQueueEntry: (entry: QueueEntry) => Promise<void>;
    callNext: (doctorName?: string) => Promise<void>;
    prioritizeEntry: (id: string) => Promise<void>;
    updateEntryStatus: (id: string, status: QueueEntry['status']) => Promise<void>;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
    queue: [],
    currentServing: null,
    isLoading: false,
    selectedFacilityId: 'phc-bhamragad',

    setSelectedFacilityId: (facilityId: string) => {
        set({ selectedFacilityId: facilityId });
        get().loadQueue(facilityId);
    },

    loadQueue: async (facilityId?: string) => {
        set({ isLoading: true });
        try {
            const facId = facilityId || get().selectedFacilityId;
            const entries = await getQueueEntries(facId);
            const inConsult = entries.find(q => q.status === 'IN_CONSULTATION') || null;
            set({ queue: entries, currentServing: inConsult, isLoading: false });
        } catch (error) {
            console.error('Failed to load queue:', error);
            set({ isLoading: false });
        }
    },

    addQueueEntry: async (entry: QueueEntry) => {
        set(state => ({
            queue: [...state.queue, entry],
        }));
        try {
            await saveQueueEntry(entry);
            toast.success(`Token ${entry.tokenNumber} issued to ${entry.patientName}`);
        } catch (error) {
            console.error('Failed to save queue entry:', error);
            throw error;
        }
    },

    callNext: async (doctorName = 'Dr. Suresh Atram') => {
        const { queue, currentServing } = get();

        // 2. Prioritize emergency/urgent waiting patients first, then lowest sequence
        const waiting = queue.filter(q => q.status === 'WAITING');
        if (waiting.length === 0) {
            set({ currentServing: null });
            toast('No patients currently in waiting queue');
            return;
        }

        const sorted = [...waiting].sort((a, b) => {
            const prioWeight = { EMERGENCY: 0, URGENT: 1, SEMI_URGENT: 2, ROUTINE: 3 };
            const diff = prioWeight[a.priority] - prioWeight[b.priority];
            if (diff !== 0) return diff;
            return a.sequence - b.sequence;
        });

        const nextPatient = sorted[0];

        // Both writes land before anything is announced. Calling a token on screen that
        // did not persist means the next person to look at the board calls the same
        // patient again, or skips one who was never marked seen.
        try {
            if (currentServing) {
                await updateQueueStatus(currentServing.id, 'COMPLETED');
            }
            await updateQueueStatus(nextPatient.id, 'IN_CONSULTATION', doctorName);
        } catch (error) {
            console.error('Failed to advance the queue:', error);
            toast.error('Could not call the next token — queue unchanged. Please retry.');
            return;
        }

        const updatedQueue = queue.map(q => {
            if (currentServing && q.id === currentServing.id) return { ...q, status: 'COMPLETED' as const };
            if (q.id === nextPatient.id) return { ...q, status: 'IN_CONSULTATION' as const, consultingDoctor: doctorName };
            return q;
        });

        set({
            queue: updatedQueue,
            currentServing: { ...nextPatient, status: 'IN_CONSULTATION', consultingDoctor: doctorName }
        });

        toast.success(`Calling Token ${nextPatient.tokenNumber}: ${nextPatient.patientName}`);
    },

    prioritizeEntry: async (id: string) => {
        const previous = get().queue;
        const entry = previous.find(q => q.id === id);
        if (!entry) {
            toast.error('Token not found — priority unchanged');
            return;
        }

        set(state => ({
            queue: state.queue.map(q =>
                q.id === id ? { ...q, priority: 'EMERGENCY' as const } : q
            ),
        }));

        try {
            await saveQueueEntry({ ...entry, priority: 'EMERGENCY' });
            toast.success(`Priority Override applied for Token ${entry.tokenNumber}`);
        } catch (error) {
            console.error('Failed to apply priority override:', error);
            set({ queue: previous });
            toast.error(`Could not override priority for Token ${entry.tokenNumber}`);
        }
    },

    updateEntryStatus: async (id: string, status: QueueEntry['status']) => {
        const previousQueue = get().queue;
        const previousServing = get().currentServing;

        set(state => ({
            queue: state.queue.map(q => q.id === id ? { ...q, status } : q),
            currentServing: (previousServing?.id === id && status === 'COMPLETED') ? null : previousServing
        }));

        try {
            await updateQueueStatus(id, status);
        } catch (error) {
            console.error('Failed to update queue entry status:', error);
            set({ queue: previousQueue, currentServing: previousServing });
            toast.error(`Could not mark token as ${status} — no change saved`);
        }
    }
}));
