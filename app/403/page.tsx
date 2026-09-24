/**
 * 403 — Not permitted.
 *
 * Where the route guard sends anyone who opens a page their role may not use.
 * It names what was asked for, the right it needs, who holds that right and
 * who the visitor is signed in as — so "wrong posting", "wrong role" and "not
 * signed in" read as three different problems, because they are.
 */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GovPanel from '@/components/gov/GovPanel';
import { useAuthStore } from '@/stores/authStore';
import {
    ROLE_HOME,
    ROLE_LABELS,
    STAFF_ROLES,
    can,
    requiredPermissionForRoute,
} from '@/lib/auth/permissions';

function NotPermitted() {
    const params = useSearchParams();
    const from = params?.get('from') ?? '';
    const session = useAuthStore(s => s.session);
    const needed = from ? requiredPermissionForRoute(from) : null;
    const holders = needed ? STAFF_ROLES.filter(r => can(r, needed)) : [];
    const signIn = `/staff/login${from ? `?next=${encodeURIComponent(from)}` : ''}`;

    return (
        <div className="max-w-2xl mx-auto px-4 py-10">
            <GovPanel title="403 — Not permitted" meta="Access control">
                <div className="space-y-4 text-sm text-slate-700">
                    <p className="text-base font-bold text-[#1F3A6E]">
                        {session ? 'Your role cannot open this page.' : 'Sign in with a staff account to open this page.'}
                    </p>

                    <table className="gov-table w-full text-xs">
                        <tbody>
                            {from && (
                                <tr>
                                    <th className="text-left w-44">Page requested</th>
                                    <td className="font-mono">{from}</td>
                                </tr>
                            )}
                            {needed && (
                                <tr>
                                    <th className="text-left">Right required</th>
                                    <td className="font-mono">{needed}</td>
                                </tr>
                            )}
                            {holders.length > 0 && (
                                <tr>
                                    <th className="text-left">Held by</th>
                                    <td>{holders.map(r => ROLE_LABELS[r]).join(', ')}</td>
                                </tr>
                            )}
                            <tr>
                                <th className="text-left">You are signed in as</th>
                                <td>
                                    {session
                                        ? `${session.name} — ${ROLE_LABELS[session.role]}, ${session.facilityName}`
                                        : 'Not signed in'}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex flex-wrap gap-2 pt-1">
                        {session ? (
                            <Link href={ROLE_HOME[session.role]} className="gov-btn gov-btn-primary text-xs">
                                Go to my workspace
                            </Link>
                        ) : null}
                        <Link href={signIn} className={`gov-btn ${session ? 'gov-btn-secondary' : 'gov-btn-primary'} text-xs`}>
                            {session ? 'Sign in as a different user' : 'Staff sign in'}
                        </Link>
                        <Link href="/" className="gov-btn gov-btn-ghost text-xs">
                            Citizen portal home
                        </Link>
                    </div>

                    <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                        Access is decided by role and posting as configured in the permissions file. If your
                        posting is wrong, ask the Super Admin to correct it in User Management.
                    </p>
                </div>
            </GovPanel>
        </div>
    );
}

export default function ForbiddenPage() {
    return (
        <Suspense fallback={<div className="py-24 text-center text-xs text-slate-500">Loading…</div>}>
            <NotPermitted />
        </Suspense>
    );
}
