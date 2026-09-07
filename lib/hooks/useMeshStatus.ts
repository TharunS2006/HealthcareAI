/**
 * Mesh Relay Status Hook
 * Reports the real socket state of the ABDM mesh relay, for UI that must not claim
 * a sync path exists when it does not. See lib/socket.ts for why.
 */

'use client';

import { useEffect, useState } from 'react';
import type { MeshStatus } from '@/lib/socket';

export function useMeshStatus(): MeshStatus {
    /**
     * Server render and first client render must agree, so both start at CONNECTING and
     * the real value arrives after mount. Reading the live status during render would
     * differ between server and client and cost a full hydration re-render.
     */
    const [status, setStatus] = useState<MeshStatus>('CONNECTING');

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;

        // Dynamic import keeps socket.io-client out of the bundle of every page that
        // renders the sidebar; SocketInit has already loaded it by this point anyway.
        import('@/lib/socket')
            .then(({ getMeshStatus, subscribeMeshStatus }) => {
                if (cancelled) return;
                setStatus(getMeshStatus());
                unsubscribe = subscribeMeshStatus(setStatus);
            })
            .catch(() => {
                // Chunk unreachable (offline, not precached) — we are definitively standalone.
                if (!cancelled) setStatus('STANDALONE');
            });

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, []);

    return status;
}
