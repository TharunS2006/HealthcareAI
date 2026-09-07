/**
 * Referral Pipeline State Store
 * Manages cross-facility continuum of care across Maharashtra tiers
 */

import { create } from 'zustand';
import { ReferralRecord } from '@/types/patient';
import { getAllReferrals, saveReferral, updateReferralStatus } from '@/lib/db';
import toast from 'react-hot-toast';

interface ReferralStore {
    referrals: ReferralRecord[];
    isLoading: boolean;

    // Actions
    loadReferrals: () => Promise<void>;
    addReferral: (referral: ReferralRecord) => Promise<void>;
    changeStatus: (id: string, status: ReferralRecord['status'], notes?: string) => Promise<void>;
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
        } catch (error) {
            console.error('Failed to save referral:', error);
            throw error;
        }
    },

    changeStatus: async (id: string, status: ReferralRecord['status'], notes?: string) => {
        const previous = get().referrals;

        set(state => ({
            referrals: state.referrals.map(r =>
                r.id === id ? { ...r, status, ...(notes && { notes }) } : r
            ),
        }));

        try {
            await updateReferralStatus(id, status, notes);
            toast.success(`Referral updated to ${status}`);
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
