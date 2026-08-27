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

        // 1. Complete previous consultation if any
        if (currentServing) {
            await updateQueueStatus(currentServing.id, 'COMPLETED');
        }

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
        await updateQueueStatus(nextPatient.id, 'IN_CONSULTATION', doctorName);

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
        set(state => ({
            queue: state.queue.map(q =>
                q.id === id ? { ...q, priority: 'EMERGENCY' as const } : q
            ),
        }));
        const entry = get().queue.find(q => q.id === id);
        if (entry) {
            await saveQueueEntry({ ...entry, priority: 'EMERGENCY' });
            toast.success(`Priority Override applied for Token ${entry.tokenNumber}`);
        }
    },

    updateEntryStatus: async (id: string, status: QueueEntry['status']) => {
        set(state => ({
            queue: state.queue.map(q => q.id === id ? { ...q, status } : q),
            currentServing: (get().currentServing?.id === id && status === 'COMPLETED') ? null : get().currentServing
        }));
        await updateQueueStatus(id, status);
    }
}));
