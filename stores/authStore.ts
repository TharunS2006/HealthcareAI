/**
 * Staff session — who is signed in on this tab, at which facility.
 *
 * Signing in checks the user's PIN (lib/auth/signIn.ts). Online, the mesh
 * relay checks it and returns a signed token that the relay and the district
 * service require on every request; offline, this device checks it and the
 * session has no token until the user re-enters their PIN while connected —
 * until then nothing it does reaches the network. The session carries a
 * *facility*, not just a role. Almost every rule in this app is two questions — "may this role do
 * this" and "to whose patients" — and the second cannot be answered from a
 * role. The permission model lives in lib/auth/permissions.ts; this file only
 * holds the session and decides nothing.
 *
 * Stored in sessionStorage, not localStorage: each browser tab is its own
 * session. That is what lets a Sub Centre ANM and a PHC Medical Officer be
 * signed in side by side in two tabs of one machine for a demo, and it means a
 * shared clinic device forgets the user when the tab is closed. A tab left
 * open but unused locks (lib/auth/idleLock.ts, components/auth/SessionLock.tsx)
 * until the same user re-enters their PIN; `locked` is part of the stored
 * session, so a reload does not unlock it.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { logAudit, setCurrentActor } from '@/lib/db';
import { clearIdleClock, resetIdleClock } from '@/lib/auth/idleLock';
import type { FacilityType } from '@/types/patient';
import type { StaffRole } from '@/lib/auth/permissions';

export type { StaffRole };

export interface StaffSession {
    userId: string;
    name: string;
    role: StaffRole;
    staffId: string;
    /** null for district and system roles. */
    facilityId: string | null;
    /** The posting as shown — a facility name, or "District Health Office". */
    facilityName: string;
    facilityType: FacilityType | null;
    signedInAt: string;
    /** Signed session token from the relay; absent after an offline sign-in or once it expires. */
    token?: string;
    /** When the token stops being accepted, Unix ms. */
    tokenExpiresAt?: number;
    /** Locked for inactivity: the screen is covered until the PIN is re-entered. */
    locked?: boolean;
}

interface AuthState {
    session: StaffSession | null;
    login: (session: Omit<StaffSession, 'signedInAt'>) => void;
    logout: () => void;
    /** Attach a token after re-entering the PIN while connected. */
    setToken: (token: string, expiresAt: number) => void;
    /** The relay no longer accepts the token (expired, or the user was changed). */
    dropToken: () => void;
    /** Cover the screen after inactivity; the session and its token are kept. */
    lock: () => void;
    /** The PIN was re-entered: uncover the screen and restart the idle clock. */
    unlock: () => void;
}

const attribute = (s: StaffSession | null) => {
    if (s) setCurrentActor(s.userId, s.role, s.name, s.facilityId);
    else setCurrentActor('system', 'SYSTEM');
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            session: null,

            login: (input) => {
                const session: StaffSession = { ...input, signedInAt: new Date().toISOString() };
                // Attribute the audit trail before the session is readable, so a
                // write fired by a screen reacting to the login cannot land under
                // the previous user.
                attribute(session);
                resetIdleClock();
                set({ session });
                void logAudit('SESSION', session.userId, 'SIGN IN', { after: { role: session.role, facility: session.facilityId } });
            },

            setToken: (token, tokenExpiresAt) => {
                const current = get().session;
                if (current) set({ session: { ...current, token, tokenExpiresAt } });
            },

            dropToken: () => {
                const current = get().session;
                if (current?.token) set({ session: { ...current, token: undefined, tokenExpiresAt: undefined } });
            },

            lock: () => {
                const current = get().session;
                if (!current || current.locked) return;
                set({ session: { ...current, locked: true } });
                void logAudit('SESSION', current.userId, 'LOCKED (INACTIVE)');
            },

            unlock: () => {
                const current = get().session;
                if (!current?.locked) return;
                resetIdleClock();
                set({ session: { ...current, locked: false } });
                void logAudit('SESSION', current.userId, 'UNLOCKED (PIN RE-ENTERED)');
            },

            logout: () => {
                const previous = get().session;
                if (previous) void logAudit('SESSION', previous.userId, 'SIGN OUT', { after: { role: previous.role } });
                attribute(null);
                clearIdleClock();
                set({ session: null });
            },
        }),
        {
            name: 'nalammesh-staff-session',
            storage: createJSONStorage(() => sessionStorage),
            // Read storage on an explicit call rather than at import. The app is a
            // static export: prerendered HTML has no session in it, so hydrating at
            // import would make the first client render disagree with the server
            // markup. components/auth/RouteGuard.tsx triggers the read.
            skipHydration: true,
            // v3: the six-role model. v4: PIN-verified sign-in — a session from
            // before was never verified, so it is discarded and the user signs
            // in again rather than carrying on unproven.
            version: 4,
            migrate: (persisted, fromVersion) =>
                (fromVersion < 4 ? { session: null } : persisted) as AuthState,
            partialize: (state) => ({ session: state.session }) as AuthState,
            onRehydrateStorage: () => (state) => attribute(state?.session ?? null),
        }
    )
);
