/**
 * Staff session store — persists the cadre/role chosen at staff login so the app can
 * attribute audit-log entries and gate role-restricted views (e.g. the audit trail).
 *
 * This is a local demo session, not a real identity provider: it records who the user
 * said they are so accountability features have a subject. On login it also sets the
 * audit actor in lib/db so every subsequent mutation is attributed.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setCurrentActor } from '@/lib/db';

export type StaffRole = 'ASHA' | 'ANM' | 'MO' | 'SPECIALIST' | 'PHARMACIST' | 'LAB_TECH' | 'DHO';

interface AuthState {
    role: StaffRole | null;
    staffId: string | null;
    name: string | null;
    login: (session: { role: StaffRole; staffId: string; name?: string }) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            role: null,
            staffId: null,
            name: null,
            login: ({ role, staffId, name }) => {
                setCurrentActor(staffId, role);
                set({ role, staffId, name: name ?? null });
            },
            logout: () => {
                setCurrentActor('system', 'SYSTEM');
                set({ role: null, staffId: null, name: null });
            },
        }),
        {
            name: 'nalammesh-staff-session',
            // Re-attribute the audit actor when a persisted session is restored on load.
            onRehydrateStorage: () => (state) => {
                if (state?.staffId && state.role) {
                    setCurrentActor(state.staffId, state.role);
                }
            },
        }
    )
);

/** Roles permitted to view the accountability audit trail. */
export const AUDIT_ALLOWED_ROLES: StaffRole[] = ['MO', 'SPECIALIST', 'DHO'];
