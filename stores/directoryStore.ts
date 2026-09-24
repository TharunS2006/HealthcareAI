/**
 * Staff directory — who works where, in what role.
 *
 * The referral store reads it to address notifications ("the PHC's Medical
 * Officer" is whoever is posted there with the right role today), the sign-in
 * screen lists it, and Super Admin edits it at /admin. Changes are published to
 * other tabs and devices so a newly posted officer starts receiving referrals
 * everywhere, not just on the admin's screen.
 */

import { create } from 'zustand';
import toast from 'react-hot-toast';
import { getUsers, saveUser, storeFromMesh } from '@/lib/db';
import { SEED_USERS, type StaffUser } from '@/lib/auth/users';
import { publishUser, type WireActor } from '@/lib/referrals/transport';

interface DirectoryStore {
    users: StaffUser[];
    loaded: boolean;
    load: () => Promise<void>;
    /** Super Admin: add or change a user. Throws on a failed write. */
    upsert: (user: StaffUser, actor: WireActor) => Promise<void>;
    /** A user record changed on another tab or device. */
    ingest: (user: StaffUser) => Promise<void>;
}

export const useDirectoryStore = create<DirectoryStore>((set, get) => ({
    // Seeded users until IndexedDB answers, so the sign-in screen is usable at once.
    users: SEED_USERS,
    loaded: false,

    load: async () => {
        try {
            set({ users: await getUsers(), loaded: true });
        } catch (error) {
            console.error('Failed to load staff directory:', error);
            toast.error('Could not read the staff directory on this device — showing the default roster');
            set({ loaded: true });
        }
    },

    upsert: async (user, actor) => {
        await saveUser(user);
        set(state => ({ users: [...state.users.filter(u => u.id !== user.id), user] }));
        void publishUser(user, actor);
    },

    ingest: async (user) => {
        const existing = get().users.find(u => u.id === user.id);
        if (existing && JSON.stringify(existing) === JSON.stringify(user)) return;
        try {
            await storeFromMesh('users', user);
        } catch (error) {
            console.error('Failed to store a directory change from the mesh:', error);
            return;
        }
        set(state => ({ users: [...state.users.filter(u => u.id !== user.id), user] }));
    },
}));
