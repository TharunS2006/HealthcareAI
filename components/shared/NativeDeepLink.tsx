/**
 * Inside the Android app, Capacitor answers every path without a file
 * extension with the root index.html. A page loaded at /referrals — a reload
 * after the WebView was restored, or a link opened into the app — therefore
 * shows the home screen under the /referrals address. The route's own files
 * (/referrals.txt and its chunks) are served normally, so once the app is up a
 * client-side navigation to the same address renders the right screen.
 *
 * Runs once, on the first render of the app shell, and only in the native app;
 * on the web every page is served its own HTML.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export default function NativeDeepLink() {
    const router = useRouter();
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        const { pathname, search, hash } = window.location;
        if (pathname !== '/' && pathname !== '/index.html') router.replace(`${pathname}${search}${hash}`);
    }, [router]); // the router is stable: this runs once, for the address the app opened at
    return null;
}
