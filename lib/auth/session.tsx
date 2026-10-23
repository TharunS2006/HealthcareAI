/**
 * The session a component acts as.
 *
 * Almost always that is the tab's signed-in user. The two-user simulation is
 * the exception: its left pane acts as a Sub Centre ANM and its right pane as a
 * PHC Medical Officer, in one tab. Components read the session through
 * useSession() rather than the auth store directly, and the simulation wraps
 * each pane in a SessionProvider — so the referral screens, the bell and the
 * action buttons are the very same components in both places.
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuthStore, type StaffSession } from '@/stores/authStore';
import { can, isDistrictWide, type Permission } from './permissions';
import type { ReferralActor } from '@/types/referral';

const SessionOverride = createContext<StaffSession | null | undefined>(undefined);

export function SessionProvider({ session, children }: { session: StaffSession | null; children: ReactNode }) {
    return <SessionOverride.Provider value={session}>{children}</SessionOverride.Provider>;
}

/** True inside a SessionProvider — e.g. a simulation pane rather than the tab itself. */
export function useIsSessionOverridden(): boolean {
    return useContext(SessionOverride) !== undefined;
}

export function useSession(): StaffSession | null {
    const override = useContext(SessionOverride);
    const own = useAuthStore(s => s.session);
    return override !== undefined ? override : own;
}

/** Does the acting session hold this capability? */
export function useCan(permission: Permission): boolean {
    const session = useSession();
    return can(session?.role ?? null, permission);
}

export function sessionIsDistrictWide(session: StaffSession | null): boolean {
    return isDistrictWide(session?.role ?? null);
}

/** The session as a referral actor — the identity written into timelines. */
export function actorOf(session: StaffSession): ReferralActor {
    return {
        userId: session.userId,
        name: session.name,
        role: session.role,
        facilityId: session.facilityId,
        facilityName: session.facilityName,
    };
}

/** The session as an audit actor. */
export function auditActorOf(session: StaffSession) {
    return {
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.name,
        actorFacilityId: session.facilityId,
    };
}
