/**
 * Staff session — who is signed in, at which facility, and with what rights.
 *
 * This is a local demo session, not an identity provider: it records who the
 * user said they are so accountability features have a subject. On login it
 * also sets the audit actor in lib/db, so every subsequent mutation is
 * attributed without each call site remembering to pass a name.
 *
 * The session carries a *facility*, not just a role. Almost every rule in this
 * app is really two questions — "may this cadre do this" and "to whose
 * patients" — and the second cannot be answered from a role alone. A Medical
 * Officer may accept referrals; this Medical Officer may accept the ones
 * addressed to their own PHC. Without facilityId on the session there is no
 * way to express the difference, and every officer answers every facility's
 * referrals.
 *
 * The permission model itself lives in lib/auth/permissions.ts. This file only
 * holds the session; it deliberately decides nothing.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setCurrentActor } from '@/lib/db';
import type { FacilityType } from '@/types/patient';
import {
    ROLE_PERMISSIONS,
    can as roleCan,
    isDistrictWide as roleIsDistrictWide,
    type Permission,
    type StaffRole,
} from '@/lib/auth/permissions';

// Re-exported because this module used to own the type and several screens
// still import it from here. One definition, two import paths.
export type { StaffRole, Permission };

export interface StaffSession {
    role: StaffRole;
    staffId: string;
    name?: string;
    facilityId: string;
    facilityName: string;
    facilityType: FacilityType;
}

interface AuthState {
    role: StaffRole | null;
    staffId: string | null;
    name: string | null;
    facilityId: string | null;
    facilityName: string | null;
    facilityType: FacilityType | null;
    login: (session: StaffSession) => void;
    logout: () => void;
    /** Does the signed-in cadre hold this capability? */
    can: (permission: Permission) => boolean;
    /** Does the signed-in cadre read across facilities, or only its own? */
    isDistrictWide: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            role: null,
            staffId: null,
            name: null,
            facilityId: null,
            facilityName: null,
            facilityType: null,

            login: ({ role, staffId, name, facilityId, facilityName, facilityType }) => {
                // Attribute the audit trail before the session is readable, so a
                // mutation fired by a screen reacting to the login cannot land
                // under the previous actor.
                setCurrentActor(staffId, role);
                set({
                    role,
                    staffId,
                    name: name ?? null,
                    facilityId,
                    facilityName,
                    facilityType,
                });
            },

            logout: () => {
                setCurrentActor('system', 'SYSTEM');
                set({
                    role: null,
                    staffId: null,
                    name: null,
                    facilityId: null,
                    facilityName: null,
                    facilityType: null,
                });
            },

            can: (permission) => roleCan(get().role, permission),
            isDistrictWide: () => roleIsDistrictWide(get().role),
        }),
        {
            name: 'nalammesh-staff-session',
            // Read localStorage on an explicit call rather than at import time.
            //
            // The app is a static export, so every page ships prerendered HTML
            // with no session in it. If the store hydrated itself during module
            // evaluation, the first client render would already know the cadre
            // while the server-rendered markup did not, and React would hydrate
            // two different trees — the sidebar in particular would swap its
            // whole nav mid-hydration. Deferring the read to an effect makes
            // both renders agree on "signed out", and makes hasHydrated() an
            // honest answer to "have we looked yet?" instead of one that is
            // true before anyone asked. components/auth/RouteGuard.tsx triggers
            // the read; it is mounted once in the root layout, so it runs on
            // every page.
            skipHydration: true,
            // Bumped because sessions persisted before RBAC carry no facility.
            // Such a session would pass every permission check its role allows
            // while scoping to no facility at all, so it is discarded rather
            // than migrated to a guessed posting.
            version: 2,
            migrate: (persisted, fromVersion) => {
                if (fromVersion < 2) return {} as Partial<AuthState>;
                return persisted as Partial<AuthState>;
            },
            // Re-attribute the audit actor when a persisted session is restored.
            onRehydrateStorage: () => (state) => {
                if (state?.staffId && state.role) {
                    setCurrentActor(state.staffId, state.role);
                }
            },
        }
    )
);

/**
 * Roles permitted to view the accountability audit trail.
 *
 * Derived from the permission table rather than restated, so it cannot drift
 * away from what lib/auth/permissions.ts grants.
 */
export const AUDIT_ALLOWED_ROLES: StaffRole[] = (
    Object.keys(ROLE_PERMISSIONS) as StaffRole[]
).filter(role => roleCan(role, 'audit:view'));
