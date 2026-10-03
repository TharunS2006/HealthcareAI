/**
 * The referral board for one session — what it sent, what it received, and
 * where each stands. Columns follow the lifecycle: awaiting an answer,
 * accepted (bed held / in transit), at the facility, closed.
 *
 * Rows are exactly those canViewReferral() allows, so a Sub Centre sees its own
 * referrals, a PHC sees what it sent and received, a Specialist sees accepted
 * patients only, and the District Health Officer sees the district.
 */

'use client';

import { useMemo, useState } from 'react';
import { useReferralStore } from '@/stores/referralStore';
import type { StaffSession } from '@/stores/authStore';
import { can, isDistrictWide } from '@/lib/auth/permissions';
import * as wf from '@/lib/referrals/workflow';
import { useNow } from '@/lib/capacity/useAvailability';
import { REJECT_REASON_LABELS } from '@/types/referral';
import type { ReferralRecord } from '@/types/patient';
import { clockTime, timeAgo } from '@/lib/utils/time';
import { shortFacilityName } from '@/lib/utils/facilityName';
import { PriorityBadge, StatusBadge } from './Badges';

type Scope = 'INCOMING' | 'OUTGOING' | 'ALL';

interface Props {
    session: StaffSession;
    selectedId?: string | null;
    onOpen: (referralId: string) => void;
    /** One column instead of four — narrow panes and phones. */
    compact?: boolean;
}

const COLUMNS: Array<{ phase: wf.ReferralPhase; title: string; bar: string }> = [
    { phase: 'AWAITING', title: 'Awaiting response', bar: 'border-t-blue-600' },
    { phase: 'ACCEPTED', title: 'Accepted · bed held / en route', bar: 'border-t-teal-600' },
    { phase: 'AT_FACILITY', title: 'At receiving facility', bar: 'border-t-emerald-600' },
    { phase: 'CLOSED', title: 'Closed · discharged / rejected', bar: 'border-t-slate-400' },
];

const PRIORITY_RANK: Record<ReferralRecord['priority'], number> = { EMERGENCY: 0, URGENT: 1, SEMI_URGENT: 2, ROUTINE: 3 };

export default function ReferralBoard({ session, selectedId, onOpen, compact = false }: Props) {
    const referrals = useReferralStore(s => s.referrals);
    const notifications = useReferralStore(s => s.notifications);
    const loaded = useReferralStore(s => s.loaded);
    const now = useNow(30_000);

    const districtWide = isDistrictWide(session.role);
    const receives = can(session.role, 'referral:receive') || session.role === 'SPECIALIST';
    const sends = can(session.role, 'referral:create');
    const [scope, setScope] = useState<Scope>(districtWide ? 'ALL' : receives ? 'INCOMING' : 'OUTGOING');
    const [showClosed, setShowClosed] = useState(!compact);

    const unreadByReferral = useMemo(() => {
        const map = new Map<string, number>();
        for (const n of notifications) {
            if (n.recipient_user_id === session.userId && !n.is_read) map.set(n.referral_id, (map.get(n.referral_id) ?? 0) + 1);
        }
        return map;
    }, [notifications, session.userId]);

    const visible = useMemo(() => {
        const mine = referrals.filter(r => wf.canViewReferral({ role: session.role, facilityId: session.facilityId }, r));
        const scoped = scope === 'ALL'
            ? mine
            : scope === 'INCOMING'
            ? mine.filter(r => r.toFacilityId === session.facilityId || r.routeHistory?.some(h => h.facilityId === session.facilityId))
            : mine.filter(r => r.fromFacilityId === session.facilityId);
        return scoped.sort(
            (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        );
    }, [referrals, session, scope]);

    const card = (r: ReferralRecord) => {
        const unread = unreadByReferral.get(r.id) ?? 0;
        const selected = selectedId === r.id;
        const heldUntil = r.reservation?.state === 'HELD' && r.status === 'ACCEPTED' ? r.reservation.expiresAt : null;
        return (
            <li key={r.id}>
                <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className={`w-full text-left px-2.5 py-2 border bg-white hover:border-[#1F3A6E] ${selected ? 'border-[#1F3A6E] ring-1 ring-[#1F3A6E]' : 'border-slate-200'} ${r.priority === 'EMERGENCY' && wf.phaseOf(r.status) === 'AWAITING' ? 'border-l-4 border-l-red-600' : ''}`}
                    aria-current={selected ? 'true' : undefined}
                >
                    <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                            <PriorityBadge priority={r.priority} />
                            <StatusBadge status={r.status} />
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                            {unread > 0 && <span className="inline-block min-w-[16px] text-center px-1 mr-1 rounded-full bg-blue-600 text-white text-[9px] font-bold">{unread}</span>}
                            {timeAgo(r.updatedAt, now)}
                        </span>
                    </div>
                    <strong className="block text-[13px] text-slate-900 mt-1 leading-tight">
                        {r.patientName} <span className="font-normal text-[11px] text-slate-500">{r.patientAge} y / {r.patientGender}</span>
                    </strong>
                    <span className="block text-[11px] text-slate-600">
                        {shortFacilityName(r.fromFacilityName)} → <strong className="text-[#1F3A6E]">{shortFacilityName(r.toFacilityName)}</strong>
                    </span>
                    <span className="block text-[11px] text-slate-700 line-clamp-2 mt-0.5">{r.reason}</span>
                    <span className="block text-[10px] mt-1 font-semibold">
                        {r.status === 'CREATED' && <span className="text-amber-800">Not yet sent — waiting for the network</span>}
                        {r.status === 'SENT' && <span className="text-blue-800">Sent {clockTime(wf.lastEvent(r, 'SEND')?.at)} — not opened yet</span>}
                        {r.deliveredAt && ['DELIVERED', 'ACKNOWLEDGED'].includes(r.status) && (
                            <span className="text-indigo-800">Seen by {shortFacilityName(r.toFacilityName)} at {clockTime(r.deliveredAt)}</span>
                        )}
                        {heldUntil && <span className="text-teal-800">Bed held until {clockTime(heldUntil)}{r.inTransitAt ? ' · in transit' : ''}</span>}
                        {r.status === 'REJECTED' && r.rejection && <span className="text-red-800">{REJECT_REASON_LABELS[r.rejection.code]} — re-route needed</span>}
                        {r.escalation && ['SENT', 'DELIVERED'].includes(r.status) && <span className="block text-red-700">Escalated to DHO</span>}
                    </span>
                </button>
            </li>
        );
    };

    const tabs: Array<{ key: Scope; label: string; show: boolean }> = [
        { key: 'INCOMING', label: 'Incoming', show: receives && !districtWide },
        { key: 'OUTGOING', label: 'Outgoing', show: sends },
        { key: 'ALL', label: districtWide ? 'All in district' : 'All', show: true },
    ];

    const columns = COLUMNS.filter(c => showClosed || c.phase !== 'CLOSED');

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                {tabs.filter(t => t.show).map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setScope(t.key)}
                        className={`px-2.5 py-1 text-[11px] font-bold border rounded ${scope === t.key ? 'bg-[#1F3A6E] text-white border-[#1F3A6E]' : 'bg-white text-[#1F3A6E] border-[#B9C5D6] hover:bg-slate-50'}`}
                        aria-pressed={scope === t.key}
                    >
                        {t.label}
                    </button>
                ))}
                <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-600">
                    <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Show closed
                </label>
            </div>

            {!loaded ? (
                <p className="text-[12px] text-slate-500 py-6 text-center">Loading referrals on this device…</p>
            ) : visible.length === 0 ? (
                <p className="text-[12px] text-slate-500 py-6 text-center border border-dashed border-slate-300">No referrals here.</p>
            ) : compact ? (
                <ul className="space-y-1.5">{visible.filter(r => showClosed || wf.phaseOf(r.status) !== 'CLOSED').map(card)}</ul>
            ) : (
                <div className={`grid gap-2 ${showClosed ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
                    {columns.map(col => {
                        const items = visible.filter(r => wf.phaseOf(r.status) === col.phase);
                        return (
                            <section key={col.phase} className={`border border-[#B9C5D6] border-t-4 ${col.bar} bg-[#F8FAFC]`}>
                                <h3 className="px-2.5 py-1.5 text-[11px] font-bold text-[#1F3A6E] flex items-center justify-between border-b border-slate-200">
                                    {col.title}
                                    <span className="text-[10px] font-black bg-white border border-slate-300 rounded-full px-1.5">{items.length}</span>
                                </h3>
                                <ul className="p-1.5 space-y-1.5 max-h-[70vh] overflow-y-auto">
                                    {items.length === 0 ? <li className="text-[11px] text-slate-400 text-center py-4">None</li> : items.map(card)}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
