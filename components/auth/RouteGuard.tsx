/**
 * Route guard — one gate in front of every page.
 *
 * Mounted once in the root layout, so a new screen is protected by being listed
 * in lib/auth/permissions.ts, not by remembering to paste a check into it. A
 * gate each page opts into is a gate somebody eventually forgets.
 *
 * HONEST LIMITS
 * -------------
 * This runs in the browser. The app is a static export — no middleware, no
 * server render to refuse the request — so this stops the wrong role from
 * *using* a module, not from reading the JavaScript behind it. Enforcement
 * that matters sits with the data: the mesh relay and the district service
 * apply the same permission names to every request they answer.
 *
 * TWO THINGS IT MUST NOT DO
 * -------------------------
 * 1. Bounce a signed-in user during hydration. The session is read from
 *    sessionStorage after mount, so for the first frames there is no session
 *    even for a District Health Officer. Guarded routes wait for that read
 *    before deciding anything.
 * 2. Delay public pages. Citizen pages are the larger half of the portal and
 *    must render straight from the prerendered HTML, so a path with no
 *    permission attached passes through untouched.
 */

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { canAccessRoute, requiredPermissionForRoute } from '@/lib/auth/permissions';

/** True once the session has been read from storage, so "no session" can be trusted. */
export function useSessionRestored(): boolean {
    const [restored, setRestored] = useState(false);

    useEffect(() => {
        if (useAuthStore.persist.hasHydrated()) {
            setRestored(true);
            return;
        }
        const unsubscribe = useAuthStore.persist.onFinishHydration(() => setRestored(true));
        // rehydrate() finishes even when storage is empty or refused (private
        // window), so a browser that blocks it lands on "signed out" rather
        // than hanging on "restoring".
        void useAuthStore.persist.rehydrate();
        return unsubscribe;
    }, []);

    return restored;
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? '/';
    const router = useRouter();
    const role = useAuthStore(s => s.session?.role ?? null);
    const restored = useSessionRestored();

    const required = requiredPermissionForRoute(pathname);
    const permitted = canAccessRoute(role, pathname);
    const shouldRedirect = required !== null && restored && !permitted;

    useEffect(() => {
        if (!shouldRedirect) return;
        // replace, not push: a refused page must not sit in history where Back
        // walks straight into another redirect.
        router.replace(`/403?from=${encodeURIComponent(pathname)}`);
    }, [shouldRedirect, pathname, router]);

    if (required === null) return <>{children}</>;

    if (!restored || !permitted) {
        // Never render the guarded page while undecided or refused: flashing a
        // district bed board for one frame shows exactly what was not allowed.
        return (
            <div className="flex items-center justify-center py-24 px-4" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-slate-500">
                    {!restored ? 'Checking your session…' : 'Not permitted — redirecting…'}
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
