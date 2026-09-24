/**
 * Boots the Capacitor native shell (status bar, splash, back button).
 * Renders nothing; safe to mount on the web.
 */

'use client';

import { useEffect } from 'react';
import { initNativeShell } from '@/lib/native';

export default function NativeInit() {
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        let cancelled = false;
        initNativeShell()
            .then((fn) => { if (cancelled) fn(); else cleanup = fn; })
            .catch((err) => console.warn('[Native] init failed:', err));
        return () => { cancelled = true; cleanup?.(); };
    }, []);

    return null;
}
