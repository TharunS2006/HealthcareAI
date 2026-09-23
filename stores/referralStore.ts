/**
 * Referral Pipeline State Store
 * Manages cross-facility continuum of care across India tiers */

import { create } from 'zustand';
import { ReferralRecord } from '@/types/patient';
import { getAllReferrals, saveReferral, updateReferralStatus } from '@/lib/db';
import { queueReferral } from '@/lib/sync/outbox';
import toast from 'react-hot-toast';

interface ReferralStore {
    referrals: ReferralRecord[];
    isLoading: boolean;

    // Actions
    loadReferrals: () => Promise<void>;
    addReferral: (referral: ReferralRecord) => Promise<void>;
    changeStatus: (
        id: string,
        status: ReferralRecord['status'],
        opts?: { notes?: string; ambulanceVehicleNo?: string; etaMinutes?: number }
    ) => Promise<void>;
}

export const useReferralStore = create<ReferralStore>((set, get) => ({
    referrals: [],
    isLoading: false,

    loadReferrals: async () => {
        set({ isLoading: true });
        try {
            const refs = await getAllReferrals();
            set({ referrals: refs, isLoading: false });
        } catch (error) {
            console.error('Failed to load referrals:', error);
            set({ isLoading: false });
        }
    },

    addReferral: async (referral: ReferralRecord) => {
        set(state => ({
            referrals: [referral, ...state.referrals.filter(r => r.id !== referral.id)],
        }));
        try {
            await saveReferral(referral);
            toast.success(`Referral #${referral.id} created to ${referral.toFacilityName}`);
            try {
                const { getSocket } = await import('@/lib/socket');
                const socket = getSocket();
                socket.emit('referral:sync', referral);
            } catch (err) {
                console.warn('Socket referral emit failed:', err);
            }
            // A referral is the whole point of the cloud hand-off: it is what tells
            // the receiving facility someone is coming and what to have ready.
            // Durable and self-uploading, so being offline here costs nothing.
            void queueReferral(referral);
        } catch (error) {
            console.error('Failed to save referral:', error);
            throw error;
        }
    },

    changeStatus: async (id, status, opts) => {
        const previous = get().referrals;
        const now = new Date().toISOString();

        // Optimistic update mirrors exactly what db.updateReferralStatus will persist,
        // so the board and the stored record never disagree (rolled back on failure).
        set(state => ({
            referrals: state.referrals.map(r =>
                r.id === id
                    ? {
                        ...r,
                        status,
                        lastUpdatedAt: now,
                        ...(opts?.notes ? { notes: opts.notes } : {}),
                        ...(opts?.ambulanceVehicleNo ? { ambulanceVehicleNo: opts.ambulanceVehicleNo } : {}),
                        ...(typeof opts?.etaMinutes === 'number' ? { etaMinutes: opts.etaMinutes } : {}),
                        ...(status === 'IN_TRANSIT' && !r.inTransitAt ? { inTransitAt: now } : {}),
                        ...(status === 'COMPLETED' ? { completedAt: now } : {}),
                    }
                    : r
            ),
        }));

        try {
            await updateReferralStatus(id, status, opts);
            toast.success(`Referral updated to ${status}`);
            // Push the new status too: a receiving ward watching the incoming board
            // needs "in transit" and a revised ETA, not just the original referral.
            const stored = get().referrals.find(r => r.id === id);
            if (stored) void queueReferral(stored);
        } catch (error) {
            // Roll the board back to what is actually stored. Leaving the optimistic
            // update on screen after a failed write would tell the referring officer a
            // patient had been accepted or admitted when the record says otherwise.
            console.error('Failed to update referral status:', error);
            set({ referrals: previous });
            toast.error(`Could not update referral to ${status} — status unchanged`);
        }
    },
}));
