/**
 * OfflineBanner — Shows when navigator.onLine === false.
 * GIGW: offline state must be explicitly communicated, never silently broken.
 */

'use client';

import { useState, useEffect } from 'react';
import Icon from './Icon';

export default function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div
            className="bg-gov-amber text-gov-navy-dark px-4 py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5 w-full"
            role="alert"
            aria-live="assertive"
        >
            <Icon name="signal" className="w-4 h-4" />
            You are offline — changes will be saved locally and synced when you reconnect.
        </div>
    );
}
