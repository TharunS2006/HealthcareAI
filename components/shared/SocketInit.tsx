'use client';

import { useEffect } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { startOutbox } from '@/lib/sync/outbox';

/**
 * App-shell background sync. Mounted once in the root layout.
 *
 * Two independent channels, neither of which the app depends on to function:
 * the mesh socket (device-to-device on the same LAN) and the cloud outbox
 * (records uploaded to the district service when connectivity returns, so a
 * receiving facility can prepare before the patient arrives).
 */
export default function SocketInit() {
    const { initSocket } = usePatientStore();

    useEffect(() => {
        initSocket();
    }, [initSocket]);

    useEffect(() => startOutbox(), []);

    return null;
}
