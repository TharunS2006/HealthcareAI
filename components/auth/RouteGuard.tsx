/**
 * Route guard — one gate in front of every page.
 *
 * Mounted once in the root layout so a new screen is protected by existing in
 * lib/auth/permissions.ts, not by remembering to paste a check into it. A gate
 * each page opts into is a gate somebody eventually forgets.
 *
 * HONEST LIMITS
 * -------------
 * This runs in the browser. The app is a static export — there is no middleware
 * and no server render to refuse the request before it is answered — so this
 * stops the wrong cadre from *using* a module, not from reading the JavaScript
 * that implements it. Real enforcement has to sit on the district service
 * alongside the data; that check reuses the same permission names, so the rule
 * written here is the rule written there.
 *
 * TWO THINGS IT MUST NOT DO
 * -------------------------
 * 1. Bounce a signed-in user during hydration. The session is restored from
 *    localStorage asynchronously, so for the first frames `role` is null even
 *    for a District Health Officer. Redirecting on that null logs people out of
 *    their own dashboard on every refresh, so guarded routes wait for the store
 *    to finish rehydrating before deciding anything.
 * 2. Delay public pages. Citizen-facing pages are the larger half of this
 *    portal and must render straight from the prerendered HTML, so a path with
 *    no permission attached is passed through untouched — no waiting, no
 *    client-only render, no effect.
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { canAccessRoute, requiredPermissionForRoute } from '@/lib/auth/permissions';

/**
 * True once zustand/persist has read localStorage, so `role === null` can be
 * trusted to mean "signed out" rather than "not looked yet".
 */
function useSessionRestored(): boolean {
    // Always false on the first render, on server and client alike — the store
    // is configured skipHydration, so nothing has read localStorage yet and the
    // two renders agree. See the note in stores/authStore.ts.
    const [restored, setRestored] = useState(false);

    useEffect(() => {
        if (useAuthStore.persist.hasHydrated()) {
            setRestored(true);
            return;
        }
        const unsubscribe = useAuthStore.persist.onFinishHydration(() => setRestored(true));
        // rehydrate() resolves even when storage is empty or unreadable — a
        // private window, cleared site data — and finishHydration fires either
        // way, so a browser that refuses localStorage lands on "signed out"
        // rather than hanging on "restoring".
        void useAuthStore.persist.rehydrate();
        return unsubscribe;
    }, []);

    return restored;
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const role = useAuthStore(s => s.role);
    const restored = useSessionRestored();

    const required = requiredPermissionForRoute(pathname ?? '/');
    const permitted = canAccessRoute(role, pathname ?? '/');
    const shouldRedirect = required !== null && restored && !permitted;

    useEffect(() => {
        if (!shouldRedirect) return;
        // `from` lets the 403 page name the module and the right it needed.
        // replace, not push: a refused page must not sit in history where Back
        // walks straight into another redirect.
        router.replace(`/403?from=${encodeURIComponent(pathname ?? '')}`);
    }, [shouldRedirect, pathname, router]);

    // Unguarded path: hand through untouched so public pages keep their
    // prerendered HTML and their first paint.
    if (required === null) return <>{children}</>;

    if (!restored) {
        return (
            <div className="flex items-center justify-center py-24 px-4" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-slate-500">
                    Restoring your session…
                </p>
            </div>
        );
    }

    if (!permitted) {
        // The redirect is already queued. Render the refusal inline rather than
        // the page: flashing a district bed board for one frame before bouncing
        // shows the cadre exactly what it was not allowed to see.
        return (
            <div className="flex items-center justify-center py-24 px-4" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-slate-500">
                    Not permitted — redirecting…
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
