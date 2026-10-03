/**
 * Live availability for every facility, recomputed whenever beds, tickets or
 * referrals change on this device — and at least every 30 seconds, so a
 * reservation that runs out frees its bed on screen without a reload.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useResourceStore } from '@/stores/resourceStore';
import { useReferralStore } from '@/stores/referralStore';
import { availabilityFor, type FacilityAvailability } from './availability';

export function useNow(intervalMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

export function useAvailability(): (facilityId: string) => FacilityAvailability {
    const resources = useResourceStore(s => s.resources);
    const tickets = useResourceStore(s => s.tickets);
    const referrals = useReferralStore(s => s.referrals);
    const now = useNow();

    const cache = useMemo(() => new Map<string, FacilityAvailability>(), [resources, tickets, referrals, now]); // eslint-disable-line react-hooks/exhaustive-deps

    return useCallback(
        (facilityId: string) => {
            const hit = cache.get(facilityId);
            if (hit) return hit;
            const computed = availabilityFor(
                facilityId,
                resources.find(r => r.facilityId === facilityId),
                tickets,
                referrals,
                now
            );
            cache.set(facilityId, computed);
            return computed;
        },
        [cache, resources, tickets, referrals, now]
    );
}
