/**
 * Staff Authentication Portal — Module 0
 *
 * Mock sign-in for the government healthcare cadre. It records two things, and
 * both matter: the *cadre*, which decides what the user may do, and the
 * *facility*, which decides whose patients they may do it to. A session with a
 * role but no posting passes every capability check its role allows while
 * belonging to no facility at all — so the facility picker here is not a
 * cosmetic field, and the session type requires it.
 *
 * The cadre list is generated from ROLE_LABELS rather than typed out, so a role
 * added to lib/auth/permissions.ts is signable-in the same day instead of
 * existing in the permission table but nowhere a human can reach it.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS, ROLE_FACILITY_TIERS, type StaffRole } from '@/lib/auth/permissions';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';

/** Cadres in hierarchy order — field, then facility, then district, then system. */
const ROLE_ORDER: StaffRole[] = [
    'ASHA',
    'ANM',
    'MO',
    'SPECIALIST',
    'HOSPITAL_ADMIN',
    'PHARMACIST',
    'LAB_TECH',
    'DHO',
    'SUPER_ADMIN',
];

/** Facilities a cadre can plausibly be posted at. An empty tier list means district-wide. */
function postingsFor(role: StaffRole) {
    const tiers = ROLE_FACILITY_TIERS[role];
    if (tiers.length === 0) return FACILITY_NETWORK;
    const eligible = FACILITY_NETWORK.filter(f => tiers.includes(f.type));
    // Never return an empty picker: a cadre with no matching facility in the
    // seed data would otherwise be impossible to sign in as, and a login screen
    // that silently refuses a valid role is worse than one that offers a
    // slightly odd posting.
    return eligible.length > 0 ? eligible : FACILITY_NETWORK;
}

/** A plausible service number, so switching cadre does not leave an MO's ID on an ANM. */
function suggestStaffId(role: StaffRole) {
    return `${role.replace('_', '-')}-GAD-${(1000 + (role.length * 371) % 8999).toString()}`;
}

export default function StaffLoginPage() {
    const router = useRouter();
    const login = useAuthStore(s => s.login);

    const [role, setRole] = useState<StaffRole>('MO');
    const [facilityId, setFacilityId] = useState('phc-bhamragad');
    const [staffId, setStaffId] = useState('MO-GAD-4412');
    const [staffIdEdited, setStaffIdEdited] = useState(false);
    const [pin, setPin] = useState('1234');

    const postings = useMemo(() => postingsFor(role), [role]);
    const facility = postings.find(f => f.id === facilityId) ?? postings[0];

    const handleRoleChange = (next: StaffRole) => {
        setRole(next);
        // Re-anchor the posting to the new cadre's tier. Leaving a Sub Centre
        // selected while the cadre reads "Medical Officer (PHC)" would submit a
        // posting the hierarchy does not have.
        const nextPostings = postingsFor(next);
        if (!nextPostings.some(f => f.id === facilityId)) {
            setFacilityId(nextPostings[0].id);
        }
        if (!staffIdEdited) setStaffId(suggestStaffId(next));
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!facility) {
            toast.error('No facility selected — cannot open a session without a posting.');
            return;
        }
        // Persist role *and* posting: mutations are attributed to the staff ID,
        // and every facility-scoped view reads facilityId off this session.
        login({
            role,
            staffId,
            facilityId: facility.id,
            facilityName: facility.name,
            facilityType: facility.type,
        });
        toast.success(`Signed in as ${ROLE_LABELS[role]} — ${facility.name}`, {
            icon: <Icon name="clinician" className="w-4 h-4" />,
        });
        router.push('/staff');
    };

    return (
        <div className="max-w-md mx-auto px-4 py-12">
            <div className="surface-card p-6 sm:p-8 space-y-6">
                <div className="text-center">
                    <div className="w-12 h-12 bg-gov-navy text-white rounded flex items-center justify-center mx-auto mb-3">
                        <Icon name="clinician" className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-gov-navy">Healthcare Staff Portal Login</h1>
                    <p className="text-xs text-txt-secondary mt-1">
                        National Health Mission (NHM) • Government of India
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="staff-role" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Staff Cadre / Role
                        </label>
                        <select
                            id="staff-role"
                            value={role}
                            onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-medium"
                        >
                            {ROLE_ORDER.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="staff-facility" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Assigned Public Health Facility
                        </label>
                        <select
                            id="staff-facility"
                            value={facility?.id ?? ''}
                            onChange={(e) => setFacilityId(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-medium"
                        >
                            {postings.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} ({f.type} — {f.district})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-txt-secondary mt-1">
                            {ROLE_FACILITY_TIERS[role].length === 0
                                ? 'District-level cadre — reads every facility in the district.'
                                : `Postings shown for this cadre: ${ROLE_FACILITY_TIERS[role].join(', ')}. You will see only this facility's data.`}
                        </p>
                    </div>

                    <div>
                        <label htmlFor="staff-id" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Government Staff ID / License Number
                        </label>
                        <input
                            id="staff-id"
                            type="text"
                            value={staffId}
                            onChange={(e) => { setStaffId(e.target.value); setStaffIdEdited(true); }}
                            placeholder="e.g. MO-GAD-4412"
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-mono"
                            required
                        />
                        <p className="text-[11px] text-txt-secondary mt-1">
                            Recorded against every action you take in the audit trail.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="staff-pin" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Security PIN / Password
                        </label>
                        <input
                            id="staff-pin"
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="••••"
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5"
                    >
                        Sign In to Staff Workspace →
                    </button>
                </form>

                <p className="text-[11px] text-txt-secondary bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                    <strong className="text-amber-900">Demonstration sign-in.</strong> The PIN is not
                    checked and the session is held in this browser only. Access control here models
                    the cadre hierarchy correctly; it is not a substitute for server-side
                    authentication, which belongs with the district service.
                </p>

                <div className="pt-2 text-center border-t border-border-subtle">
                    <Link href="/login" className="text-xs font-bold text-txt-secondary hover:text-gov-navy">
                        ← Back to Citizen / Patient Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
