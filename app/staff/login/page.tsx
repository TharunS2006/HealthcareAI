/**
 * Staff sign-in — role, posting, person, PIN.
 *
 * The PIN is verified (lib/auth/signIn.ts): by the mesh relay when it can be
 * reached, which returns the token the network requires, else on this device.
 * What sign-in establishes is the session every other screen relies on — the
 * role (what you may do) and the facility (whose patients). Postings offered
 * follow the role's tier, and the person must exist in the staff directory at
 * that posting, so a session can never claim a role at a facility that has no
 * such post.
 */

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDirectoryStore } from '@/stores/directoryStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { DEMO_LOGIN_USER_IDS, DEMO_PIN, type StaffUser } from '@/lib/auth/users';
import { signInStaff, signInWithStaffId } from '@/lib/auth/signIn';
import { PRODUCTION } from '@/lib/config/mode';
import {
    ROLE_FACILITY_TIERS,
    ROLE_HOME,
    ROLE_LABELS,
    ROLE_POSTING_LABEL,
    STAFF_ROLES,
    canAccessRoute,
    type StaffRole,
} from '@/lib/auth/permissions';
import Icon from '@/components/gov/Icon';
import { useSessionRestored } from '@/components/auth/RouteGuard';
import toast from 'react-hot-toast';

/** Only same-site paths — a sign-in page must not become an open redirect. */
function safeNext(raw: string | null): string | null {
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
    return raw;
}

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const next = safeNext(params?.get('next') ?? null);
    const login = useAuthStore(s => s.login);
    const logout = useAuthStore(s => s.logout);
    const current = useAuthStore(s => s.session);
    const restored = useSessionRestored();
    const users = useDirectoryStore(s => s.users);
    const storedFacilities = useFacilityStore(s => s.facilities);
    const facilities = storedFacilities.length ? storedFacilities : FACILITY_NETWORK;

    const [role, setRole] = useState<StaffRole>('ANM');
    const [facilityId, setFacilityId] = useState<string>('');
    const [userId, setUserId] = useState<string>('');
    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [staffIdText, setStaffIdText] = useState('');
    const [staffIdPin, setStaffIdPin] = useState('');
    const [error, setError] = useState<string | null>(null);

    const tiers = ROLE_FACILITY_TIERS[role];
    const postings = useMemo(() => facilities.filter(f => tiers.includes(f.type)), [facilities, tiers]);
    const staff = useMemo(
        () => users.filter(u => u.active && u.role === role && (tiers.length === 0 ? u.facilityId === null : u.facilityId === facilityId)),
        [users, role, facilityId, tiers]
    );

    // Arriving from "Sign out": end the session here, on a public page — once
    // the session has been read, so a reload of this URL cannot skip it.
    useEffect(() => {
        if (params?.get('signout') !== '1' || !restored) return;
        if (current) {
            logout();
            toast.success('Signed out');
        }
        router.replace('/staff/login');
    }, [params, current, restored, logout, router]);

    // Keep the posting and the person valid for the chosen role.
    useEffect(() => {
        if (tiers.length === 0) setFacilityId('');
        else if (!postings.some(f => f.id === facilityId)) setFacilityId(postings[0]?.id ?? '');
    }, [role, tiers, postings, facilityId]);
    useEffect(() => {
        if (!staff.some(u => u.id === userId)) setUserId(staff[0]?.id ?? '');
    }, [staff, userId]);

    const signIn = async (user: StaffUser, enteredPin: string) => {
        setBusy(user.id);
        setError(null);
        const result = await signInStaff(user, enteredPin);
        setBusy(null);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        finishSignIn(user, result);
    };

    /** Staff ID and PIN: how someone signs in on a device that does not know them yet. */
    const signInByStaffId = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy('staff-id');
        setError(null);
        const result = await signInWithStaffId(staffIdText, staffIdPin, users);
        setBusy(null);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        // Keep the account on this device; the relay sends its PIN hash on the
        // next sync, so the next sign-in here can be offline.
        if (result.mode === 'NETWORK') await useDirectoryStore.getState().ingest(result.user);
        setStaffIdPin('');
        finishSignIn(result.user, result);
    };

    const finishSignIn = (user: StaffUser, result: { mode: 'NETWORK'; token: string; expiresAt: number } | { mode: 'OFFLINE' }) => {
        const facility = facilities.find(f => f.id === user.facilityId);
        login({
            userId: user.id,
            name: user.name,
            role: user.role,
            staffId: user.staffId,
            facilityId: user.facilityId,
            facilityName: facility?.name ?? ROLE_POSTING_LABEL[user.role] ?? 'Unassigned',
            facilityType: facility?.type ?? null,
            ...(result.mode === 'NETWORK' ? { token: result.token, tokenExpiresAt: result.expiresAt } : {}),
        });
        setPin('');
        if (result.mode === 'NETWORK') {
            toast.success(`Signed in as ${user.name} — ${ROLE_LABELS[user.role]}`, { icon: <Icon name="clinician" className="w-4 h-4" /> });
        } else {
            toast(`Signed in on this device only — the network could not be reached. Your work is kept here and syncs once you re-enter your PIN while connected.`, { duration: 8000 });
        }
        router.replace(next && canAccessRoute(user.role, next) ? next : ROLE_HOME[user.role]);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const user = staff.find(u => u.id === userId);
        if (!user) {
            toast.error('Choose a staff member posted here');
            return;
        }
        if (!/^\d{4,6}$/.test(pin)) {
            setError('Enter your 4–6 digit PIN');
            return;
        }
        void signIn(user, pin);
    };

    const quick = DEMO_LOGIN_USER_IDS.map(id => users.find(u => u.id === id)).filter((u): u is StaffUser => Boolean(u && u.active));
    const field = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#1F3A6E] focus:outline-none font-medium';
    const label = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_1.1fr] gap-4 items-start">
            <section className="border border-[#B9C5D6] bg-white">
                <div className="bg-[#1F3A6E] text-white px-3 py-2">
                    <h1 className="text-[13px] font-bold">Healthcare Staff Portal — Sign in</h1>
                </div>
                <form onSubmit={submit} className="p-4 space-y-4">
                    <div>
                        <label className={label} htmlFor="role">Role</label>
                        <select id="role" value={role} onChange={e => setRole(e.target.value as StaffRole)} className={field}>
                            {STAFF_ROLES.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={label} htmlFor="posting">Posting</label>
                        {tiers.length === 0 ? (
                            <p className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded text-slate-700">
                                {ROLE_POSTING_LABEL[role]} — sees every facility
                            </p>
                        ) : (
                            <select id="posting" value={facilityId} onChange={e => setFacilityId(e.target.value)} className={field}>
                                {postings.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className={label} htmlFor="user">Staff member</label>
                        {staff.length === 0 ? (
                            <p className="px-3 py-2 text-xs bg-amber-50 border border-amber-300 rounded text-amber-900">
                                Nobody is posted here in this role. The Super Admin can add them in User Management.
                            </p>
                        ) : (
                            <select id="user" value={userId} onChange={e => setUserId(e.target.value)} className={field}>
                                {staff.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} — {u.staffId}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className={label} htmlFor="pin">PIN</label>
                        <input
                            id="pin"
                            type="password"
                            inputMode="numeric"
                            autoComplete="off"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            placeholder="4–6 digits"
                            className={field}
                        />
                    </div>

                    {error && (
                        <p role="alert" className="px-3 py-2 text-xs bg-red-50 border border-red-300 rounded text-red-800">{error}</p>
                    )}

                    <button type="submit" disabled={staff.length === 0 || busy !== null} className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5 disabled:opacity-50">
                        {busy ? 'Checking PIN…' : 'Sign in →'}
                    </button>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Your PIN is checked by the referral network, which then admits only your role at your posting;
                        with no network it is checked on this device and your work syncs after you sign in online.
                        Five wrong PINs lock the account for five minutes.
                    </p>
                </form>
            </section>

            {PRODUCTION ? (
            <section className="border border-[#B9C5D6] bg-white">
                <div className="bg-[#EDF1F7] text-[#1F3A6E] border-b border-[#B9C5D6] px-3 py-2">
                    <h2 className="text-[13px] font-bold">New to this device? Sign in with your Staff ID</h2>
                </div>
                <form onSubmit={signInByStaffId} className="p-4 space-y-4">
                    <div>
                        <label className={label} htmlFor="staff-id">Staff ID</label>
                        <input id="staff-id" value={staffIdText} onChange={e => setStaffIdText(e.target.value)} autoComplete="username"
                            autoCapitalize="characters" placeholder="e.g. ANM-KOT-1021" className={`${field} font-mono`} />
                    </div>
                    <div>
                        <label className={label} htmlFor="staff-id-pin">PIN</label>
                        <input id="staff-id-pin" type="password" inputMode="numeric" autoComplete="off" value={staffIdPin}
                            onChange={e => setStaffIdPin(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="4–6 digits" className={field} />
                    </div>
                    <button type="submit" disabled={busy !== null} className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5 disabled:opacity-50">
                        {busy === 'staff-id' ? 'Checking…' : 'Sign in with Staff ID →'}
                    </button>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Your Staff ID and PIN come from the Super Admin. The first sign-in on a device needs the network;
                        after that this device knows you and you can sign in from the list, offline too.
                    </p>
                    <Link href="/login" className="text-[11px] font-bold text-[#1F3A6E] underline">
                        ← Citizen / patient login
                    </Link>
                </form>
            </section>
            ) : (
            <section className="border border-[#B9C5D6] bg-white">
                <div className="bg-[#EDF1F7] text-[#1F3A6E] border-b border-[#B9C5D6] px-3 py-2">
                    <h2 className="text-[13px] font-bold">Demo accounts — one per role · PIN {DEMO_PIN}</h2>
                </div>
                <ul className="divide-y divide-slate-200">
                    {quick.map(u => {
                        const facility = facilities.find(f => f.id === u.facilityId);
                        return (
                            <li key={u.id}>
                                <button
                                    type="button"
                                    onClick={() => void signIn(u, DEMO_PIN)}
                                    disabled={busy !== null}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3"
                                >
                                    <span className="min-w-0">
                                        <strong className="block text-[12px] text-[#1F3A6E]">{ROLE_LABELS[u.role]}</strong>
                                        <span className="block text-[11px] text-slate-600 truncate">
                                            {u.name} · {facility?.name ?? ROLE_POSTING_LABEL[u.role]}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-[11px] font-bold text-[#1F3A6E] border border-[#1F3A6E] px-2 py-1 rounded">
                                        {busy === u.id ? 'Checking…' : 'Sign in'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <div className="px-3 py-3 border-t border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <p>
                        These accounts exist for evaluation and share the public PIN {DEMO_PIN}; the buttons enter it for
                        you through the same check as the form. Accounts the Super Admin creates have their own PINs.
                    </p>
                    <p>
                        Tip: sessions are per browser tab. Sign in as the ANM in one tab and the PHC Medical Officer in
                        another to watch a referral travel between them — or use the Two-User Simulation (DHO / Super Admin).
                    </p>
                    <Link href="/login" className="font-bold text-[#1F3A6E] underline">
                        ← Citizen / patient login
                    </Link>
                </div>
            </section>
            )}
        </div>
    );
}

export default function StaffLoginPage() {
    return (
        <Suspense fallback={<div className="py-24 text-center text-xs text-slate-500">Loading sign-in…</div>}>
            <LoginForm />
        </Suspense>
    );
}
