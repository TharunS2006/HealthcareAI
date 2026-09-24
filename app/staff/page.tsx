/**
 * Staff workspace home — the modules this role may open, and the few numbers
 * that need attention now. Every figure is counted from the records on this
 * device for this user's facility; nothing here is a display constant.
 */

'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import Icon, { IconName } from '@/components/gov/Icon';
import { useSession } from '@/lib/auth/session';
import { canAccessRoute, isDistrictWide, ROLE_LABELS } from '@/lib/auth/permissions';
import { useReferralStore } from '@/stores/referralStore';
import { useResourceStore } from '@/stores/resourceStore';
import { usePatientStore } from '@/stores/patientStore';
import * as wf from '@/lib/referrals/workflow';

const MODULES: { href: string; label: string; icon: IconName; desc: string }[] = [
    { href: '/my-dashboard', label: 'My Dashboard', icon: 'chart-bar', desc: 'Patients registered today, your referrals and follow-ups' },
    { href: '/referrals', label: 'Referrals', icon: 'ambulance', desc: 'Raise, receive, accept and track referrals between facilities' },
    { href: '/opd', label: 'OPD Intake & Triage', icon: 'stethoscope', desc: 'Register a patient and record vitals' },
    { href: '/facility-resources', label: 'Beds & Equipment', icon: 'hospital', desc: 'Ward beds, critical equipment, staff on duty, maintenance log' },
    { href: '/dashboard', label: 'Command Center', icon: 'chart-bar', desc: 'Live facilities, referrals, bed occupancy and escalations' },
    { href: '/incoming', label: 'Pre-Arrival Board', icon: 'ambulance', desc: 'Patients on their way and what to have ready' },
    { href: '/teleconsult', label: 'Teleconsult', icon: 'video', desc: 'Assisted consultation with a specialist' },
    { href: '/followup', label: 'High-Risk Follow-Up', icon: 'clipboard', desc: 'ANC, child and chronic-disease recalls' },
    { href: '/diagnostics', label: 'Diagnostics', icon: 'flask', desc: 'Order tests and record results' },
    { href: '/medicine', label: 'Essential Medicines', icon: 'pill', desc: 'Facility stock and restocking' },
    { href: '/queue', label: 'OPD Queue', icon: 'ticket', desc: 'Token queue and calling' },
    { href: '/audit', label: 'Audit Trail', icon: 'clipboard', desc: 'Who did what, when, at which facility' },
    { href: '/admin', label: 'Users, Roles & Facilities', icon: 'clinician', desc: 'Manage staff, postings and the facility directory' },
    { href: '/demo/simulation', label: 'Two-User Simulation', icon: 'video', desc: 'ANM and Medical Officer side by side' },
];

export default function StaffHome() {
    const session = useSession();
    const referrals = useReferralStore(s => s.referrals);
    const notifications = useReferralStore(s => s.notifications);
    const tickets = useResourceStore(s => s.tickets);
    const patients = usePatientStore(s => s.patients);
    const loadPatients = usePatientStore(s => s.loadPatients);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const counts = useMemo(() => {
        if (!session) return [];
        const districtWide = isDistrictWide(session.role);
        const mineTo = referrals.filter(r => (districtWide || r.toFacilityId === session.facilityId) && r.status !== 'CREATED');
        const awaiting = mineTo.filter(r => wf.phaseOf(r.status) === 'AWAITING');
        const emergencies = awaiting.filter(r => r.priority === 'EMERGENCY');
        const unread = notifications.filter(n => n.recipient_user_id === session.userId && !n.is_read);
        const openTickets = tickets.filter(t => t.status !== 'RESOLVED' && (districtWide || t.facilityId === session.facilityId));
        const today = new Date().toDateString();
        const registered = patients.filter(p => (districtWide || p.registeredAtFacilityId === session.facilityId) && new Date(p.timestamp).toDateString() === today);
        return [
            { label: districtWide ? 'Referrals awaiting a response' : 'Incoming referrals awaiting you', value: awaiting.length },
            { label: 'Unanswered emergencies', value: emergencies.length, alert: emergencies.length > 0 },
            { label: 'Unread notifications', value: unread.length },
            { label: 'Open maintenance issues', value: openTickets.length },
            { label: 'Patients registered today', value: registered.length },
        ];
    }, [session, referrals, notifications, tickets, patients]);

    if (!session) return null;
    const modules = MODULES.filter(m => canAccessRoute(session.role, m.href));

    return (
        <div className="space-y-5">
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{ROLE_LABELS[session.role]} · {session.facilityName}</p>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">Welcome, {session.name}</h1>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                {counts.map(c => (
                    <div key={c.label} className={`bg-white border border-[#B9C5D6] border-l-4 ${c.alert ? 'border-l-red-600' : 'border-l-[#1F3A6E]'} px-3 py-2`}>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">{c.label}</span>
                        <strong className={`block text-2xl ${c.alert ? 'text-red-700' : 'text-[#1F3A6E]'}`}>{c.value}</strong>
                    </div>
                ))}
            </div>

            <div>
                <h2 className="text-xs font-black text-[#1F3A6E] uppercase tracking-wider mb-2">Your modules</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {modules.map(m => (
                        <Link key={m.href} href={m.href} className="group bg-white border border-[#B9C5D6] hover:border-[#1F3A6E] p-3 flex items-start gap-3">
                            <Icon name={m.icon} className="w-5 h-5 flex-shrink-0 text-[#1F3A6E]" />
                            <span>
                                <strong className="block text-sm text-[#1F3A6E] group-hover:underline">{m.label}</strong>
                                <span className="block text-xs text-slate-600">{m.desc}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
