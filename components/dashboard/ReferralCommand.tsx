/**
 * Referral Command — the live half of the Command Center.
 *
 * Facilities on a map with their bed occupancy, the referrals moving between
 * them, pending Emergencies, escalation alerts and referral volumes. Drawn as
 * SVG from the facilities' own coordinates rather than on map tiles, so it
 * works with no internet — the condition this system is built for.
 *
 * `scopeFacilityId` narrows everything to one facility: a Hospital Admin's
 * read-only view of their own hospital.
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import GovPanel from '@/components/gov/GovPanel';
import { useReferralStore } from '@/stores/referralStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { useAvailability, useNow } from '@/lib/capacity/useAvailability';
import { equipmentDown, occupancyPct } from '@/lib/capacity/availability';
import * as wf from '@/lib/referrals/workflow';
import { REFERRAL_STATUSES } from '@/types/referral';
import { EQUIPMENT_LABELS } from '@/types/resources';
import type { ReferralRecord } from '@/types/patient';
import { PriorityBadge, StatusBadge } from '@/components/referrals/Badges';
import { clockTime, duration } from '@/lib/utils/time';
import { shortFacilityName } from '@/lib/utils/facilityName';

const DAY = 86_400_000;

function occupancyColour(pct: number | null): string {
    if (pct === null) return '#94A3B8';
    if (pct >= 90) return '#B91C1C';
    if (pct >= 75) return '#D97706';
    return '#15803D';
}

export default function ReferralCommand({ scopeFacilityId }: { scopeFacilityId?: string }) {
    const allReferrals = useReferralStore(s => s.referrals);
    const stored = useFacilityStore(s => s.facilities);
    const facilities = stored.length ? stored : FACILITY_NETWORK;
    const availabilityOf = useAvailability();
    const now = useNow(30_000);

    const referrals = useMemo(
        () => allReferrals.filter(r =>
            r.status !== 'CREATED' &&
            (!scopeFacilityId || r.fromFacilityId === scopeFacilityId || r.toFacilityId === scopeFacilityId)),
        [allReferrals, scopeFacilityId]
    );
    const shown = scopeFacilityId ? facilities.filter(f => f.id === scopeFacilityId) : facilities.filter(f => f.type !== 'SC');

    const today = referrals.filter(r => now - Date.parse(String(r.referredAt)) < DAY);
    const awaiting = referrals.filter(r => wf.phaseOf(r.status) === 'AWAITING');
    const pendingEmergencies = referrals
        .filter(r => r.priority === 'EMERGENCY' && ['SENT', 'DELIVERED', 'ACKNOWLEDGED'].includes(r.status))
        .sort((a, b) => Date.parse(String(a.referredAt)) - Date.parse(String(b.referredAt)));
    const escalated = referrals.filter(r => r.escalation && ['SENT', 'DELIVERED'].includes(r.status));
    const released = referrals.filter(r => r.reservation?.releaseReason === 'EXPIRED' && now - Date.parse(r.reservation.releasedAt ?? '') < DAY);
    const rejectedOpen = referrals.filter(r => r.status === 'REJECTED');

    const beds = shown.reduce(
        (acc, f) => {
            const a = availabilityOf(f.id);
            return { total: acc.total + a.totalBeds, available: acc.available + a.availableBeds, reserved: acc.reserved + a.reservedBeds };
        },
        { total: 0, available: 0, reserved: 0 }
    );

    // ── map geometry ───────────────────────────────────────────────────────
    const W = 560, H = 360, PAD = 40;
    const mapFacilities = scopeFacilityId
        ? facilities.filter(f => f.id === scopeFacilityId || referrals.some(r => r.fromFacilityId === f.id || r.toFacilityId === f.id))
        : facilities;
    const lats = mapFacilities.map(f => f.location.lat), lngs = mapFacilities.map(f => f.location.lng);
    // Schematic placement: half true geography, half rank order. Villages a few
    // km apart would otherwise sit on top of each other beside a hospital 100 km
    // away; blending keeps every facility on the correct side of every other
    // while giving each one room for its label.
    const spread = (values: number[]) => {
        const min = Math.min(...values), span = Math.max(0.01, Math.max(...values) - min);
        const ranks = [...new Set(values)].sort((a, b) => a - b);
        return (v: number) => 0.5 * ((v - min) / span) + 0.5 * (ranks.length <= 1 ? 0.5 : ranks.indexOf(v) / (ranks.length - 1));
    };
    const sx = spread(lngs), sy = spread(lats);
    const x = (lng: number) => PAD + sx(lng) * (W - 2 * PAD);
    const y = (lat: number) => H - PAD - sy(lat) * (H - 2 * PAD);
    const anchor = (px: number) => (px < W * 0.18 ? 'start' : px > W * 0.82 ? 'end' : 'middle');
    const labelX = (px: number, r: number) => (px < W * 0.18 ? px - r : px > W * 0.82 ? px + r : px);
    const pos = new Map(mapFacilities.map(f => [f.id, { x: x(f.location.lng), y: y(f.location.lat) }]));
    const flows = referrals.filter(r => wf.isOpenReferral(r.status) || r.status === 'PATIENT_ARRIVED');

    const statusCounts = REFERRAL_STATUSES.filter(s => s !== 'CREATED').map(s => ({ status: s, count: referrals.filter(r => r.status === s).length }));
    const maxCount = Math.max(1, ...statusCounts.map(s => s.count));

    const tiles: Array<[string, string | number, string]> = [
        ['Referrals (24 h)', today.length, 'border-l-[#1F3A6E]'],
        ['Awaiting response', awaiting.length, 'border-l-blue-600'],
        ['Pending emergencies', pendingEmergencies.length, pendingEmergencies.length ? 'border-l-red-600' : 'border-l-emerald-600'],
        ['Escalation alerts', escalated.length, escalated.length ? 'border-l-red-600' : 'border-l-emerald-600'],
        ['Beds free', `${beds.available} / ${beds.total}`, 'border-l-emerald-600'],
        ['Held for arrivals', beds.reserved, 'border-l-teal-600'],
    ];

    const link = (r: ReferralRecord) => `/referrals?id=${encodeURIComponent(r.id)}`;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                {tiles.map(([label, value, bar]) => (
                    <div key={label} className={`bg-white border border-[#B9C5D6] border-l-4 ${bar} px-3 py-2`}>
                        <span className="block text-[10px] font-bold uppercase text-slate-600">{label}</span>
                        <strong className="block text-xl text-[#1F3A6E]">{value}</strong>
                    </div>
                ))}
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
                <GovPanel title="Facility network — live" meta="bed occupancy · referrals in motion">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-[#F8FAFC] border border-slate-200" role="img" aria-label="Map of facilities with bed occupancy and referrals in motion">
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#1F3A6E" />
                            </marker>
                            <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#B91C1C" />
                            </marker>
                        </defs>
                        {/* Parent links: the referral hierarchy */}
                        {mapFacilities.filter(f => f.parentFacilityId && pos.has(f.parentFacilityId)).map(f => {
                            const a = pos.get(f.id)!, b = pos.get(f.parentFacilityId!)!;
                            return <line key={`h-${f.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#CBD5E1" strokeDasharray="3 3" />;
                        })}
                        {/* Referrals in motion */}
                        {flows.map(r => {
                            const a = pos.get(r.fromFacilityId), b = pos.get(r.toFacilityId);
                            if (!a || !b) return null;
                            const emergency = r.priority === 'EMERGENCY';
                            return (
                                <line key={`f-${r.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                    stroke={emergency ? '#B91C1C' : '#1F3A6E'} strokeWidth={emergency ? 2.2 : 1.4}
                                    markerEnd={`url(#${emergency ? 'arrow-red' : 'arrow'})`} opacity={0.85}>
                                    <title>{`${r.patientName}: ${shortFacilityName(r.fromFacilityName)} → ${shortFacilityName(r.toFacilityName)} (${wf.STATUS_LABELS[r.status]})`}</title>
                                </line>
                            );
                        })}
                        {mapFacilities.map(f => {
                            const p = pos.get(f.id)!;
                            const a = availabilityOf(f.id);
                            const pct = occupancyPct(a);
                            const radius = f.type === 'DH' ? 13 : f.type === 'SDH' ? 11 : f.type === 'CHC' ? 10 : f.type === 'PHC' ? 8 : 6;
                            const alert = pendingEmergencies.some(r => r.toFacilityId === f.id);
                            return (
                                <g key={f.id}>
                                    {alert && <circle cx={p.x} cy={p.y} r={radius + 6} fill="none" stroke="#B91C1C" strokeWidth={2} className="animate-pulse" />}
                                    <circle cx={p.x} cy={p.y} r={radius} fill={f.type === 'SC' ? '#FFFFFF' : occupancyColour(pct)} stroke="#1F3A6E" strokeWidth={1.5}>
                                        <title>{`${f.name}${pct !== null ? ` — ${pct}% occupied, ${a.availableBeds} beds free` : ''}`}</title>
                                    </circle>
                                    <text x={labelX(p.x, radius)} y={p.y - radius - 4} textAnchor={anchor(p.x)} fontSize="10" fontWeight="700" fill="#1F3A6E">
                                        {shortFacilityName(f.name)}
                                    </text>
                                    {pct !== null && (
                                        <text x={labelX(p.x, radius)} y={p.y + radius + 11} textAnchor={anchor(p.x)} fontSize="9" fill="#334155">{pct}% · {a.availableBeds} free</text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                        Schematic — relative positions, not to scale. Dot colour: occupancy (green &lt;75%, amber 75–89%, red ≥90%; grey not reported; white Sub Centre). Red arrows: Emergency referrals in motion. Ringed: an unanswered Emergency is waiting there.
                    </p>
                </GovPanel>

                <div className="space-y-3">
                    <GovPanel title="Pending emergencies" meta={`${pendingEmergencies.length}`} flush>
                        {pendingEmergencies.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] text-slate-600">No Emergency referral is waiting for an answer.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200">
                                {pendingEmergencies.map(r => (
                                    <li key={r.id}>
                                        <Link href={link(r)} className="block px-3 py-2 hover:bg-slate-50 text-[12px]">
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <StatusBadge status={r.status} />
                                                <strong>{r.patientName}</strong>
                                                <span className="text-slate-600">{shortFacilityName(r.fromFacilityName)} → {shortFacilityName(r.toFacilityName)}</span>
                                            </span>
                                            <span className={`block text-[11px] font-semibold ${r.escalation ? 'text-red-700' : 'text-slate-600'}`}>
                                                Waiting {duration(now - Date.parse(wf.lastEvent(r, 'SEND')?.at ?? String(r.referredAt)))}
                                                {r.escalation ? ` · escalated to DHO (alert ${r.escalation.level})` : ''}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </GovPanel>

                    <GovPanel title="Escalation alerts" meta="last 24 h" flush>
                        {escalated.length + released.length + rejectedOpen.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] text-slate-600">No alerts.</p>
                        ) : (
                            <ul className="divide-y divide-slate-200 text-[12px]">
                                {escalated.map(r => (
                                    <li key={`e-${r.id}`} className="px-3 py-2">
                                        <Link href={link(r)} className="text-red-800 font-semibold hover:underline">
                                            Unacknowledged Emergency · {r.patientName} at {shortFacilityName(r.toFacilityName)} since {clockTime(wf.lastEvent(r, 'SEND')?.at)}
                                        </Link>
                                    </li>
                                ))}
                                {released.map(r => (
                                    <li key={`r-${r.id}`} className="px-3 py-2">
                                        <Link href={link(r)} className="text-amber-900 font-semibold hover:underline">
                                            Bed released — {r.patientName} did not arrive at {shortFacilityName(r.toFacilityName)} ({clockTime(r.reservation?.releasedAt)})
                                        </Link>
                                    </li>
                                ))}
                                {rejectedOpen.map(r => (
                                    <li key={`j-${r.id}`} className="px-3 py-2">
                                        <Link href={link(r)} className="text-slate-800 font-semibold hover:underline">
                                            Rejected, not yet re-routed · {r.patientName} ({shortFacilityName(r.fromFacilityName)})
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </GovPanel>
                </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
                <GovPanel title="Bed occupancy by facility" flush>
                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Facility network table">
                        <table className="gov-table w-full text-[12px]">
                            <thead>
                                <tr>
                                    <th className="text-left">Facility</th>
                                    <th>Beds</th>
                                    <th>Occupied</th>
                                    <th>Held</th>
                                    <th>Free</th>
                                    <th className="text-left">Occupancy</th>
                                    <th className="text-left">Equipment down</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(f => {
                                    const a = availabilityOf(f.id);
                                    const pct = occupancyPct(a);
                                    const down = equipmentDown(a);
                                    return (
                                        <tr key={f.id}>
                                            <td className="font-semibold">{shortFacilityName(f.name)} <span className="text-[10px] text-slate-600">{f.type}</span></td>
                                            {a.reported ? (
                                                <>
                                                    <td className="text-center">{a.totalBeds}</td>
                                                    <td className="text-center">{a.occupiedBeds}</td>
                                                    <td className="text-center">{a.reservedBeds}</td>
                                                    <td className="text-center font-bold">{a.availableBeds}</td>
                                                    <td>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-20 h-2 bg-slate-200">
                                                                <div className="h-2" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: occupancyColour(pct) }} />
                                                            </div>
                                                            <span>{pct}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-[11px]">{down.length ? down.map(d => EQUIPMENT_LABELS[d.kind]).join(', ') : '—'}</td>
                                                </>
                                            ) : (
                                                <td colSpan={6} className="text-slate-600">Not reported</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </GovPanel>

                <GovPanel title="Referral volumes by status" meta={`${referrals.length} total`}>
                    <ul className="space-y-1">
                        {statusCounts.map(({ status, count }) => (
                            <li key={status} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-[11px]">
                                <span className="text-slate-700">{wf.STATUS_LABELS[status]}</span>
                                <div className="h-2.5 bg-slate-100">
                                    <div className="h-2.5 bg-[#1F3A6E]" style={{ width: `${(count / maxCount) * 100}%` }} />
                                </div>
                                <strong className="text-right text-[#1F3A6E]">{count}</strong>
                            </li>
                        ))}
                    </ul>
                    {!scopeFacilityId && (
                        <div className="mt-3 border-t border-slate-200 pt-2">
                            <p className="text-[11px] font-bold text-slate-600 mb-1">Open referrals by receiving facility</p>
                            <ul className="space-y-0.5 text-[11px]">
                                {facilities.filter(f => f.type !== 'SC').map(f => {
                                    const open = referrals.filter(r => r.toFacilityId === f.id && wf.isOpenReferral(r.status));
                                    if (open.length === 0) return null;
                                    return (
                                        <li key={f.id} className="flex justify-between">
                                            <span>{shortFacilityName(f.name)}</span>
                                            <span className="flex items-center gap-1">
                                                {open.some(r => r.priority === 'EMERGENCY') && <PriorityBadge priority="EMERGENCY" />}
                                                <strong>{open.length}</strong>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </GovPanel>
            </div>
        </div>
    );
}
