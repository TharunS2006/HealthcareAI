/**
 * My Dashboard — the ANM's day at a glance.
 *
 * The Command Center is for the district; this is for one Sub Centre worker:
 * who she registered today, where each of her referrals has got to, and which
 * of her patients are due a follow-up. Everything is scoped to her facility.
 */

'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import GovPanel from '@/components/gov/GovPanel';
import { useSession } from '@/lib/auth/session';
import { can, ROLE_LABELS } from '@/lib/auth/permissions';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useNow } from '@/lib/capacity/useAvailability';
import * as wf from '@/lib/referrals/workflow';
import { REJECT_REASON_LABELS } from '@/types/referral';
import { PriorityBadge, StatusBadge } from '@/components/referrals/Badges';
import { clockTime, timeAgo } from '@/lib/utils/time';
import { shortFacilityName } from '@/lib/utils/facilityName';

const DAY = 86_400_000;

function sameLocalDay(iso: string | Date, now: number): boolean {
    const a = new Date(iso);
    const b = new Date(now);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MyDashboardPage() {
    const session = useSession();
    const patients = usePatientStore(s => s.patients);
    const loadPatients = usePatientStore(s => s.loadPatients);
    const referrals = useReferralStore(s => s.referrals);
    const notifications = useReferralStore(s => s.notifications);
    const now = useNow(60_000);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const facilityId = session?.facilityId ?? null;

    const mine = useMemo(() => patients.filter(p => p.registeredAtFacilityId === facilityId), [patients, facilityId]);
    const today = mine.filter(p => sameLocalDay(p.timestamp, now));
    const sent = useMemo(
        () => referrals
            .filter(r => r.fromFacilityId === facilityId)
            .sort((a, b) => Number(wf.isOpenReferral(b.status)) - Number(wf.isOpenReferral(a.status)) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
        [referrals, facilityId]
    );
    const awaiting = sent.filter(r => wf.phaseOf(r.status) === 'AWAITING');
    const needsMe = sent.filter(r => r.status === 'REJECTED' || r.status === 'CREATED' || (r.status === 'ACCEPTED' && !r.inTransitAt));
    const followUps = useMemo(
        () => mine
            .flatMap(p => (p.highRiskFlags ?? []).map(f => ({ patient: p, flag: f, due: new Date(f.nextFollowUpDate).getTime() })))
            .filter(x => Number.isFinite(x.due) && x.due <= now + 7 * DAY)
            .sort((a, b) => a.due - b.due),
        [mine, now]
    );
    const unread = notifications.filter(n => n.recipient_user_id === session?.userId && !n.is_read).length;

    if (!session) return null;

    const statusLine = (r: (typeof sent)[number]) => {
        if (r.status === 'CREATED') return <span className="text-amber-800">Not yet sent — waiting for the network</span>;
        if (r.status === 'SENT') return <span className="text-blue-800">Sent — not opened yet</span>;
        if (r.status === 'REJECTED') return <span className="text-red-800">Rejected: {r.rejection ? REJECT_REASON_LABELS[r.rejection.code] : ''} — re-route needed</span>;
        if (r.status === 'ACCEPTED') {
            const held = r.reservation?.state === 'HELD' ? `bed held until ${clockTime(r.reservation.expiresAt)}` : 'accepted';
            return <span className="text-teal-800">{held}{r.inTransitAt ? ' · in transit' : ' · dispatch the patient'}</span>;
        }
        if (r.deliveredAt && ['DELIVERED', 'ACKNOWLEDGED'].includes(r.status)) {
            return <span className="text-indigo-800">Seen by {shortFacilityName(r.toFacilityName)} at {clockTime(r.deliveredAt)}</span>;
        }
        return <span className="text-slate-700">{wf.STATUS_LABELS[r.status]} · {timeAgo(r.updatedAt, now)}</span>;
    };

    const tiles: Array<[string, number, string]> = [
        ['Registered today', today.length, 'border-l-[#1F3A6E]'],
        ['Referrals awaiting a reply', awaiting.length, 'border-l-blue-600'],
        ['Need your action', needsMe.length, needsMe.length ? 'border-l-red-600' : 'border-l-emerald-600'],
        ['Follow-ups due (7 days)', followUps.length, 'border-l-amber-500'],
    ];

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-3 md:p-5 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-5xl mx-auto space-y-4">
                    <div className="bg-white border border-slate-300 p-3 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{ROLE_LABELS[session.role]} · {session.facilityName}</p>
                            <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">My Dashboard — {session.name}</h1>
                            <p className="text-[12px] text-slate-600">{unread} unread notification{unread === 1 ? '' : 's'} · open the bell at the top for details</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {can(session.role, 'referral:create') && <Link href="/referrals?new=1" className="gov-btn gov-btn-primary text-[12px]">+ New referral</Link>}
                            {can(session.role, 'patient:register') && <Link href="/opd" className="gov-btn gov-btn-secondary text-[12px]">Register patient</Link>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {tiles.map(([label, value, bar]) => (
                            <div key={label} className={`bg-white border border-[#B9C5D6] border-l-4 ${bar} px-3 py-2`}>
                                <span className="block text-[10px] font-bold uppercase text-slate-600">{label}</span>
                                <strong className="block text-2xl text-[#1F3A6E]">{value}</strong>
                            </div>
                        ))}
                    </div>

                    <GovPanel title="Referrals I have sent" meta={`${sent.length}`} flush>
                        {sent.length === 0 ? (
                            <p className="px-3 py-4 text-[12px] text-slate-600">No referrals sent from {session.facilityName} yet.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200">
                                {sent.slice(0, 12).map(r => (
                                    <li key={r.id}>
                                        <Link href={`/referrals?id=${encodeURIComponent(r.id)}`} className="block px-3 py-2 hover:bg-slate-50">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <PriorityBadge priority={r.priority} />
                                                <StatusBadge status={r.status} />
                                                <strong className="text-[13px]">{r.patientName}</strong>
                                                <span className="text-[11px] text-slate-600">→ {shortFacilityName(r.toFacilityName)}</span>
                                            </div>
                                            <p className="text-[11px] font-semibold mt-0.5">{statusLine(r)}</p>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </GovPanel>

                    <div className="grid md:grid-cols-2 gap-4">
                        <GovPanel title="Patients registered today" meta={`${today.length}`} flush>
                            {today.length === 0 ? (
                                <p className="px-3 py-4 text-[12px] text-slate-600">Nobody registered at {session.facilityName} today.</p>
                            ) : (
                                <ul className="divide-y divide-slate-200">
                                    {today.map(p => (
                                        <li key={p.id} className="px-3 py-2 text-[12px] flex justify-between gap-2">
                                            <span>
                                                <strong>{p.name}</strong> · {p.age} y / {p.gender} · {p.village}
                                                <span className={`ml-1.5 text-[10px] font-bold px-1 border rounded ${p.triageStatus === 'RED' ? 'bg-red-50 text-red-800 border-red-300' : p.triageStatus === 'YELLOW' ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-green-50 text-green-800 border-green-300'}`}>
                                                    {p.triageStatus}
                                                </span>
                                            </span>
                                            <span className="text-slate-600 shrink-0">{clockTime(p.timestamp)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </GovPanel>

                        <GovPanel title="Pending follow-ups" meta="overdue and next 7 days" flush>
                            {followUps.length === 0 ? (
                                <p className="px-3 py-4 text-[12px] text-slate-600">No follow-ups due.</p>
                            ) : (
                                <ul className="divide-y divide-slate-200">
                                    {followUps.slice(0, 10).map(({ patient, flag, due }) => {
                                        const overdue = due < now;
                                        return (
                                            <li key={`${patient.id}-${flag.type}`} className="px-3 py-2 text-[12px] flex justify-between gap-2">
                                                <span>
                                                    <strong>{patient.name}</strong> · {flag.type.replace(/_/g, ' ')}
                                                    {flag.notes && <span className="block text-[11px] text-slate-600">{flag.notes}</span>}
                                                </span>
                                                <span className={`shrink-0 font-bold ${overdue ? 'text-red-700' : 'text-amber-800'}`}>
                                                    {overdue ? `Overdue ${Math.max(1, Math.round((now - due) / DAY))} d` : `Due ${new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {can(session.role, 'followup:manage') && (
                                <div className="px-3 py-2 border-t border-slate-200">
                                    <Link href="/followup" className="text-[12px] font-bold underline text-[#1F3A6E]">Open the follow-up list →</Link>
                                </div>
                            )}
                        </GovPanel>
                    </div>
                </div>
            </main>
        </div>
    );
}
