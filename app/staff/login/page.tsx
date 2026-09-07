/**
 * Staff Authentication Portal — Module 0 (SIH PS#26133)
 * Role-Based Access Control (RBAC) login for government healthcare cadre.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';

export default function StaffLoginPage() {
    const router = useRouter();
    const [role, setRole] = useState('MO');
    const [facilityId, setFacilityId] = useState('phc-bhamragad');
    const [staffId, setStaffId] = useState('MO-GAD-4412');
    const [pin, setPin] = useState('1234');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success(`Welcome Dr. Suresh Atram (Medical Officer @ PHC Bhamragad)`, { icon: <Icon name="clinician" className="w-4 h-4" /> });
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
                        National Health Mission (NHM) • Government of Maharashtra
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Staff Cadre / Role
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-medium"
                        >
                            <option value="ASHA">ASHA / Frontline Health Worker (Field)</option>
                            <option value="ANM">ANM / CHO (Sub-Centre Level)</option>
                            <option value="MO">Medical Officer (PHC / CHC Level)</option>
                            <option value="SPECIALIST">Specialist Doctor (District Hospital)</option>
                            <option value="PHARMACIST">Pharmacist (Facility Pharmacy)</option>
                            <option value="LAB_TECH">Lab Technician (Diagnostic Center)</option>
                            <option value="DHO">District Health Officer (DHO Command)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Assigned Public Health Facility
                        </label>
                        <select
                            value={facilityId}
                            onChange={(e) => setFacilityId(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-medium"
                        >
                            {MAHARASHTRA_FACILITIES.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} ({f.type} — {f.district})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Government Staff ID / License Number
                        </label>
                        <input
                            type="text"
                            value={staffId}
                            onChange={(e) => setStaffId(e.target.value)}
                            placeholder="e.g. MO-GAD-4412"
                            className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-mono"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                            Security PIN / Password
                        </label>
                        <input
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

                <div className="pt-2 text-center border-t border-border-subtle">
                    <Link href="/login" className="text-xs font-bold text-txt-secondary hover:text-gov-navy">
                        ← Back to Citizen / Patient Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
