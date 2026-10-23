/**
 * Inside the Android app, Capacitor answers every path without a file
 * extension with the root index.html. A page loaded at /facilities — a reload
 * after the WebView was restored, or a link opened into the app — therefore
 * shows the home screen under the /facilities address.
 *
 * The route's own files are served normally, so a client-side navigation
 * renders the right screen — but Next's router ignores a navigation to the
 * address it believes it is already on. So this navigates once to the same
 * address with a marker (?opened=app), which it must fetch, then removes the
 * marker from the address bar. Checked on the Android emulator.
 *
 * Runs once, on the first render of the app shell, and only in the native app;
 * on the web every page is served its own HTML.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

const MARKER = 'opened';

export default function NativeDeepLink() {
    const router = useRouter();
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        const { pathname, search, hash } = window.location;
        if (pathname === '/' || pathname === '/index.html') return;
        const params = new URLSearchParams(search);
        params.set(MARKER, 'app');
        router.replace(`${pathname}?${params.toString()}${hash}`);
        // Once the route has rendered, put the address back as it was.
        let tries = 0;
        const tidy = window.setInterval(() => {
            const now = new URLSearchParams(window.location.search);
            if (now.get(MARKER) === 'app') {
                now.delete(MARKER);
                const rest = now.toString();
                window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
                window.clearInterval(tidy);
            } else if (++tries > 50) {
                window.clearInterval(tidy);
            }
        }, 100);
        return () => window.clearInterval(tidy);
    }, [router]); // the router is stable: this runs once, for the address the app opened at
    return null;
}
