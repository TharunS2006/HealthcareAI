/**
 * 403 — Not permitted.
 *
 * Reached when a signed-in cadre opens a route their role does not carry the
 * permission for, and when a signed-out visitor opens a staff route at all.
 *
 * The page names the cadre, the facility and the capability that was missing.
 * A bare "access denied" leaves the user unable to tell a misconfigured posting
 * from a role that genuinely never had the right, and in a district with one
 * DHO and forty Sub Centres that difference is a phone call either way.
 */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS, requiredPermissionForRoute } from '@/lib/auth/permissions';

function ForbiddenBody() {
    const params = useSearchParams();
    const { role, staffId, facilityName } = useAuthStore();

    // The route that was refused, passed by the guard so this page can say what
    // was actually being opened rather than "a page".
    const attempted = params.get('from') ?? '';
    const missing = attempted ? requiredPermissionForRoute(attempted) : null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                        Government of India • Public Health — Access Control
                    </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">
                    403 — Not permitted
                </h1>
                <p className="text-xs text-txt-secondary mt-0.5">
                    Your cadre does not carry the right required for this module.
                </p>
            </div>

            <div className="surface-card p-5 sm:p-6 space-y-4 border-l-4 border-l-red-600">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                        <dt className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                            Signed in as
                        </dt>
                        <dd className="font-semibold text-txt-primary mt-0.5">
                            {role ? ROLE_LABELS[role] : 'Not signed in'}
                            {staffId && (
                                <span className="font-mono text-xs text-txt-secondary ml-1.5">({staffId})</span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                            Posted at
                        </dt>
                        <dd className="font-semibold text-txt-primary mt-0.5">
                            {facilityName ?? '—'}
                        </dd>
                    </div>
                    {attempted && (
                        <div>
                            <dt className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                                Module requested
                            </dt>
                            <dd className="font-mono text-xs text-txt-primary mt-1">{attempted}</dd>
                        </div>
                    )}
                    {missing && (
                        <div>
                            <dt className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                                Right required
                            </dt>
                            <dd className="font-mono text-xs text-red-700 font-bold mt-1">{missing}</dd>
                        </div>
                    )}
                </dl>

                <p className="text-sm text-txt-secondary border-t border-border-subtle pt-4">
                    {role
                        ? 'If this module is part of your duties, your posting or cadre is recorded incorrectly. Ask your District Health Officer to correct it — this screen will not let you proceed without it.'
                        : 'Sign in with a staff cadre to continue. Citizen services remain available without signing in.'}
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                    <Link href="/staff/login" className="gov-btn gov-btn-primary text-sm font-bold">
                        {role ? 'Switch cadre' : 'Sign in'}
                    </Link>
                    <Link href="/" className="gov-btn text-sm font-bold">
                        Return to portal home
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function ForbiddenPage() {
    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />
                {/* useSearchParams needs a Suspense boundary to prerender under
                    output: 'export' — without it the whole route deopts. */}
                <Suspense fallback={null}>
                    <ForbiddenBody />
                </Suspense>
            </main>
        </div>
    );
}
