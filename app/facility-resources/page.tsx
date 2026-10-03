/**
 * Facility resources — beds, critical equipment, staff on duty and the
 * maintenance log for one receiving facility.
 *
 * This is the right-hand side of every capacity check. A Hospital Admin edits
 * their own facility; Super Admin can edit any; the DHO, Medical Officers and
 * Specialists read. Beds under maintenance and beds held for incoming patients
 * are never typed in — they come from open tickets and accepted referrals, so
 * resolving a ticket or releasing a reservation returns the bed by itself.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import GovPanel from '@/components/gov/GovPanel';
import { useSession } from '@/lib/auth/session';
import { can, isDistrictWide, ROLE_LABELS } from '@/lib/auth/permissions';
import { useResourceStore } from '@/stores/resourceStore';
import { useReferralStore } from '@/stores/referralStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { useAvailability, useNow } from '@/lib/capacity/useAvailability';
import { capacityCheck, holdsBed, occupancyPct } from '@/lib/capacity/availability';
import { requirementsFor } from '@/lib/capacity/requirements';
import * as wf from '@/lib/referrals/workflow';
import {
    EQUIPMENT_KINDS,
    EQUIPMENT_LABELS,
    SPECIALTIES,
    SPECIALTY_LABELS,
    WARD_LABELS,
    WARD_TYPES,
    type EquipmentKind,
    type MaintenanceTicket,
    type WardType,
} from '@/types/resources';
import { CheckMark, PriorityBadge, StatusBadge } from '@/components/referrals/Badges';
import { clockTime, dateTime, duration } from '@/lib/utils/time';

const field = 'px-2 py-1 text-[12px] bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#1F3A6E] focus:outline-none';
const btn = 'px-2.5 py-1 text-[11px] font-bold rounded border disabled:opacity-50';
const primary = `${btn} bg-[#1F3A6E] text-white border-[#1F3A6E] hover:bg-[#16294E]`;
const secondary = `${btn} bg-white text-[#1F3A6E] border-[#1F3A6E] hover:bg-slate-50`;

const report = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not save the change');

export default function FacilityResourcesPage() {
    const session = useSession();
    const resources = useResourceStore(s => s.resources);
    const tickets = useResourceStore(s => s.tickets);
    const loaded = useResourceStore(s => s.loaded);
    const store = useResourceStore.getState();
    const referrals = useReferralStore(s => s.referrals);
    const stored = useFacilityStore(s => s.facilities);
    const facilities = stored.length ? stored : FACILITY_NETWORK;
    const availabilityOf = useAvailability();
    const now = useNow(30_000);

    const selectable = useMemo(() => facilities.filter(f => f.type !== 'SC'), [facilities]);
    const pinned = session?.facilityId && !isDistrictWide(session.role) ? session.facilityId : null;
    const [facilityId, setFacilityId] = useState<string>(pinned ?? 'dh-district');
    useEffect(() => {
        if (pinned) setFacilityId(pinned);
    }, [pinned]);

    const [wardDraft, setWardDraft] = useState<Record<string, { total: string; occupied: string }>>({});
    const [ticketForm, setTicketForm] = useState<null | { target: 'BEDS' | 'EQUIPMENT'; ward: WardType; equipment: EquipmentKind; units: string; severity: MaintenanceTicket['severity']; description: string; date: string }>(null);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [assignee, setAssignee] = useState('');
    const [assignDate, setAssignDate] = useState('');
    const [resolving, setResolving] = useState<string | null>(null);
    const [resolution, setResolution] = useState('');

    if (!session) return null;

    const facility = facilities.find(f => f.id === facilityId);
    const res = resources.find(r => r.facilityId === facilityId);
    const a = availabilityOf(facilityId);
    const ownOrDistrict = isDistrictWide(session.role) || session.facilityId === facilityId;
    const manageBeds = can(session.role, 'capacity:manage') && ownOrDistrict;
    const manageMaintenance = can(session.role, 'maintenance:manage') && ownOrDistrict;
    const myTickets = tickets.filter(t => t.facilityId === facilityId);
    const openTickets = myTickets.filter(t => t.status !== 'RESOLVED');
    const pct = occupancyPct(a);

    const incoming = referrals
        .filter(r => r.toFacilityId === facilityId && ['SENT', 'DELIVERED', 'ACKNOWLEDGED'].includes(r.status))
        .sort((x, y) => (x.priority === 'EMERGENCY' ? -1 : 0) - (y.priority === 'EMERGENCY' ? -1 : 0));
    const held = referrals.filter(r => holdsBed(r, facilityId, now));

    const saveWard = async (ward: WardType) => {
        const draft = wardDraft[ward];
        if (!draft) return;
        try {
            await store.updateWard(facilityId, ward, { total: Number(draft.total), occupied: Number(draft.occupied) }, session);
            setWardDraft(d => {
                const next = { ...d };
                delete next[ward];
                return next;
            });
            toast.success(`${WARD_LABELS[ward]} ward updated`);
        } catch (e) {
            report(e);
        }
    };

    const submitTicket = async () => {
        if (!ticketForm) return;
        try {
            await store.reportIssue(
                {
                    facilityId,
                    target: ticketForm.target === 'BEDS' ? { kind: 'BEDS', ward: ticketForm.ward } : { kind: 'EQUIPMENT', equipment: ticketForm.equipment },
                    units: Number(ticketForm.units),
                    severity: ticketForm.severity,
                    description: ticketForm.description,
                    expectedRepairDate: ticketForm.date || undefined,
                },
                session
            );
            toast.success('Issue logged — capacity updated everywhere');
            setTicketForm(null);
        } catch (e) {
            report(e);
        }
    };

    const newTicket = (target: 'BEDS' | 'EQUIPMENT', equipment: EquipmentKind = 'VENTILATOR', ward: WardType = 'GENERAL') =>
        setTicketForm({ target, ward, equipment, units: '1', severity: 'UNDER_MAINTENANCE', description: '', date: '' });

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-3 md:p-5 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="bg-white border border-slate-300 p-3 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {ROLE_LABELS[session.role]} · {manageBeds || manageMaintenance ? 'can edit' : 'read only'}
                            </p>
                            <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">Beds, equipment &amp; staff</h1>
                            <p className="text-[12px] text-slate-600">
                                Available = total − occupied − under maintenance − reserved for accepted referrals. Referral acceptance is checked against these numbers.
                            </p>
                        </div>
                        {pinned ? (
                            <strong className="text-[13px] text-[#1F3A6E]">{facility?.name}</strong>
                        ) : (
                            <select value={facilityId} onChange={e => setFacilityId(e.target.value)} className={`${field} text-[13px] font-semibold`} aria-label="Facility">
                                {selectable.map(f => <option key={f.id} value={f.id}>{f.name} ({f.type})</option>)}
                            </select>
                        )}
                    </div>

                    {!loaded ? (
                        <p className="text-[12px] text-slate-500 p-6 text-center">Loading resources…</p>
                    ) : !res ? (
                        <GovPanel title="Not reported">
                            <p className="text-[12px] text-slate-700">
                                {facility?.name ?? 'This facility'} has not reported its resources. Every capacity check against it reads
                                &ldquo;not reported&rdquo; — never as free beds.
                            </p>
                        </GovPanel>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {[
                                    ['Total beds', a.totalBeds],
                                    ['Occupied', a.occupiedBeds],
                                    ['Reserved (incoming)', a.reservedBeds],
                                    ['Under maintenance', Object.values(a.wards).reduce((s, w) => s + (w?.maintenance ?? 0), 0)],
                                    ['Available now', a.availableBeds],
                                    ['Occupancy', pct === null ? '—' : `${pct}%`],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="bg-white border border-[#B9C5D6] px-3 py-2">
                                        <span className="block text-[10px] font-bold uppercase text-slate-500">{label}</span>
                                        <strong className="block text-xl text-[#1F3A6E]">{value}</strong>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Shift: {res.shift.toLowerCase()} · last updated {dateTime(res.updatedAt)} by {res.updatedBy}
                            </p>

                            {/* Referrals awaiting this facility's decision */}
                            {incoming.length > 0 && (
                                <GovPanel title="Incoming referrals awaiting a decision" meta={`${incoming.length}`} flush>
                                    <ul className="divide-y divide-slate-200">
                                        {incoming.map(r => {
                                            const check = capacityCheck(requirementsFor(wf.requirementInputOf(r)), a);
                                            return (
                                                <li key={r.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                                                    <span className="flex items-center gap-1.5 flex-wrap">
                                                        <PriorityBadge priority={r.priority} />
                                                        <StatusBadge status={r.status} />
                                                        <strong>{r.patientName}</strong>
                                                        <span className="text-slate-600">from {r.fromFacilityName}</span>
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <CheckMark state={check.overall} />
                                                        <Link href={`/referrals?id=${encodeURIComponent(r.id)}`} className={primary}>Open &amp; decide</Link>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </GovPanel>
                            )}

                            {/* Beds */}
                            <GovPanel title="Beds by ward" meta={manageBeds ? 'Edit total and occupied; maintenance and reservations are automatic' : undefined} flush>
                                <div className="overflow-x-auto">
                                    <table className="gov-table w-full text-[12px]">
                                        <thead>
                                            <tr>
                                                <th className="text-left">Ward</th>
                                                <th>Total</th>
                                                <th>Occupied</th>
                                                <th>Under maintenance</th>
                                                <th>Reserved</th>
                                                <th>Available</th>
                                                {manageBeds && <th />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {WARD_TYPES.filter(w => res.wards.some(x => x.ward === w) || manageBeds).map(w => {
                                                const line = a.wards[w];
                                                const draft = wardDraft[w];
                                                return (
                                                    <tr key={w}>
                                                        <td className="font-semibold">{WARD_LABELS[w]}</td>
                                                        <td className="text-center">
                                                            {manageBeds ? (
                                                                <input
                                                                    aria-label={`${WARD_LABELS[w]} total beds`}
                                                                    className={`${field} w-16 text-center`}
                                                                    inputMode="numeric"
                                                                    value={draft?.total ?? String(line?.total ?? 0)}
                                                                    onChange={e => setWardDraft(d => ({ ...d, [w]: { total: e.target.value, occupied: d[w]?.occupied ?? String(line?.occupied ?? 0) } }))}
                                                                />
                                                            ) : line?.total ?? 0}
                                                        </td>
                                                        <td className="text-center">
                                                            {manageBeds ? (
                                                                <input
                                                                    aria-label={`${WARD_LABELS[w]} occupied beds`}
                                                                    className={`${field} w-16 text-center`}
                                                                    inputMode="numeric"
                                                                    value={draft?.occupied ?? String(line?.occupied ?? 0)}
                                                                    onChange={e => setWardDraft(d => ({ ...d, [w]: { occupied: e.target.value, total: d[w]?.total ?? String(line?.total ?? 0) } }))}
                                                                />
                                                            ) : line?.occupied ?? 0}
                                                        </td>
                                                        <td className="text-center">{line?.maintenance ?? 0}</td>
                                                        <td className="text-center">{line?.reserved ?? 0}</td>
                                                        <td className={`text-center font-bold ${line && line.available === 0 && line.total > 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                                                            {line ? line.available : '—'}
                                                            {line && line.overBy > 0 && <span className="block text-[10px] text-red-700">over by {line.overBy}</span>}
                                                        </td>
                                                        {manageBeds && (
                                                            <td className="text-right whitespace-nowrap">
                                                                {draft && <button type="button" className={primary} onClick={() => void saveWard(w)}>Save</button>}
                                                                {manageMaintenance && line && line.total > 0 && (
                                                                    <button type="button" className={`${secondary} ml-1`} onClick={() => newTicket('BEDS', 'VENTILATOR', w)}>Beds out of service…</button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </GovPanel>

                            {held.length > 0 && (
                                <GovPanel title="Beds reserved for incoming patients" meta={`${held.length}`} flush>
                                    <ul className="divide-y divide-slate-200">
                                        {held.map(r => (
                                            <li key={r.id} className="px-3 py-2 text-[12px] flex flex-wrap justify-between gap-2">
                                                <span>
                                                    <strong>{r.patientName}</strong> · {WARD_LABELS[r.reservation!.ward]} · from {r.fromFacilityName}
                                                </span>
                                                <span className="text-slate-600">
                                                    {r.status === 'PATIENT_ARRIVED'
                                                        ? 'Arrived — awaiting admission'
                                                        : `Reserved – awaiting arrival · held until ${clockTime(r.reservation!.expiresAt)} (${duration(Date.parse(r.reservation!.expiresAt) - now)} left)`}
                                                    {' · '}
                                                    <Link href={`/referrals?id=${encodeURIComponent(r.id)}`} className="underline text-[#1F3A6E]">open</Link>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </GovPanel>
                            )}

                            {/* Equipment */}
                            <GovPanel title="Critical equipment" flush>
                                <div className="overflow-x-auto">
                                    <table className="gov-table w-full text-[12px]">
                                        <thead>
                                            <tr>
                                                <th className="text-left">Equipment</th>
                                                <th>Units</th>
                                                <th>Working</th>
                                                <th>Under maintenance</th>
                                                <th>Out of order</th>
                                                <th className="text-left">Status</th>
                                                <th className="text-left">Expected repair</th>
                                                {manageMaintenance && <th />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {EQUIPMENT_KINDS.map(kind => {
                                                const e = a.equipment[kind];
                                                return (
                                                    <tr key={kind}>
                                                        <td className="font-semibold">{EQUIPMENT_LABELS[kind]}</td>
                                                        {e ? (
                                                            <>
                                                                <td className="text-center">{e.units}</td>
                                                                <td className="text-center font-bold">{e.working}</td>
                                                                <td className="text-center">{e.underMaintenance}</td>
                                                                <td className="text-center">{e.outOfOrder}</td>
                                                                <td>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 border rounded ${
                                                                        e.working === 0 ? 'bg-red-50 text-red-800 border-red-300'
                                                                            : e.working < e.units ? 'bg-amber-50 text-amber-900 border-amber-300'
                                                                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                                                                        {e.working === 0 ? (e.status === 'OUT_OF_ORDER' ? 'Out of order' : 'Under maintenance') : e.working < e.units ? 'Working (partial)' : 'Working'}
                                                                    </span>
                                                                </td>
                                                                <td>{e.expectedRepairDate ?? '—'}</td>
                                                            </>
                                                        ) : (
                                                            <td colSpan={6} className="text-slate-500">Not held at this facility</td>
                                                        )}
                                                        {manageMaintenance && (
                                                            <td className="text-right">
                                                                {e && <button type="button" className={secondary} onClick={() => newTicket('EQUIPMENT', kind)}>Report issue…</button>}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </GovPanel>

                            {/* Staff on duty */}
                            <GovPanel title={`Staff on duty — ${res.shift.toLowerCase()} shift`} flush>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-slate-200">
                                    {SPECIALTIES.map(sp => {
                                        const count = a.staff[sp] ?? 0;
                                        return (
                                            <div key={sp} className="px-3 py-2 flex items-center justify-between gap-2 text-[12px] border-b border-slate-100">
                                                <span>{SPECIALTY_LABELS[sp]}</span>
                                                {manageBeds ? (
                                                    <span className="flex items-center gap-1">
                                                        <button type="button" className={secondary} aria-label={`Fewer ${SPECIALTY_LABELS[sp]}`} disabled={count === 0}
                                                            onClick={() => store.setStaffOnDuty(facilityId, sp, count - 1, session).catch(report)}>−</button>
                                                        <strong className="w-6 text-center">{count}</strong>
                                                        <button type="button" className={secondary} aria-label={`More ${SPECIALTY_LABELS[sp]}`}
                                                            onClick={() => store.setStaffOnDuty(facilityId, sp, count + 1, session).catch(report)}>+</button>
                                                    </span>
                                                ) : (
                                                    <strong className={count === 0 ? 'text-slate-400' : 'text-[#1F3A6E]'}>{count}</strong>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </GovPanel>

                            {/* Maintenance log */}
                            <GovPanel title="Maintenance log" meta={`${openTickets.length} open`} flush>
                                {manageMaintenance && !ticketForm && (
                                    <div className="px-3 pt-2">
                                        <button type="button" className={primary} onClick={() => newTicket('EQUIPMENT')}>+ Report an issue</button>
                                    </div>
                                )}
                                {ticketForm && (
                                    <div className="m-3 p-3 border border-[#1F3A6E] bg-[#F8FAFC] grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[12px]">
                                        <label>
                                            <span className="block text-[11px] font-bold text-slate-600">Affects</span>
                                            <select className={`${field} w-full`} value={ticketForm.target} onChange={e => setTicketForm({ ...ticketForm, target: e.target.value as 'BEDS' | 'EQUIPMENT' })}>
                                                <option value="EQUIPMENT">Equipment</option>
                                                <option value="BEDS">Beds</option>
                                            </select>
                                        </label>
                                        {ticketForm.target === 'EQUIPMENT' ? (
                                            <label>
                                                <span className="block text-[11px] font-bold text-slate-600">Equipment</span>
                                                <select className={`${field} w-full`} value={ticketForm.equipment} onChange={e => setTicketForm({ ...ticketForm, equipment: e.target.value as EquipmentKind })}>
                                                    {res.equipment.map(eq => <option key={eq.kind} value={eq.kind}>{EQUIPMENT_LABELS[eq.kind]}</option>)}
                                                </select>
                                            </label>
                                        ) : (
                                            <label>
                                                <span className="block text-[11px] font-bold text-slate-600">Ward</span>
                                                <select className={`${field} w-full`} value={ticketForm.ward} onChange={e => setTicketForm({ ...ticketForm, ward: e.target.value as WardType })}>
                                                    {res.wards.map(w => <option key={w.ward} value={w.ward}>{WARD_LABELS[w.ward]}</option>)}
                                                </select>
                                            </label>
                                        )}
                                        <label>
                                            <span className="block text-[11px] font-bold text-slate-600">{ticketForm.target === 'BEDS' ? 'Beds out of service' : 'Units affected'}</span>
                                            <input className={`${field} w-full`} inputMode="numeric" value={ticketForm.units} onChange={e => setTicketForm({ ...ticketForm, units: e.target.value })} />
                                        </label>
                                        <label>
                                            <span className="block text-[11px] font-bold text-slate-600">Status</span>
                                            <select className={`${field} w-full`} value={ticketForm.severity} onChange={e => setTicketForm({ ...ticketForm, severity: e.target.value as MaintenanceTicket['severity'] })}>
                                                <option value="UNDER_MAINTENANCE">Under maintenance</option>
                                                <option value="OUT_OF_ORDER">Out of order</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span className="block text-[11px] font-bold text-slate-600">Expected repair date</span>
                                            <input type="date" className={`${field} w-full`} value={ticketForm.date} onChange={e => setTicketForm({ ...ticketForm, date: e.target.value })} />
                                        </label>
                                        <label className="sm:col-span-2 lg:col-span-3">
                                            <span className="block text-[11px] font-bold text-slate-600">What is wrong</span>
                                            <input className={`${field} w-full`} value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="e.g. Oxygen sensor failure — alarms continuously" />
                                        </label>
                                        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                                            <button type="button" className={primary} onClick={() => void submitTicket()}>Log issue</button>
                                            <button type="button" className={secondary} onClick={() => setTicketForm(null)}>Cancel</button>
                                        </div>
                                    </div>
                                )}
                                {myTickets.length === 0 ? (
                                    <p className="px-3 py-3 text-[12px] text-slate-500">No issues logged.</p>
                                ) : (
                                    <ul className="divide-y divide-slate-200">
                                        {[...openTickets, ...myTickets.filter(t => t.status === 'RESOLVED')].map(t => (
                                            <li key={t.id} className="px-3 py-2 text-[12px] space-y-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 border rounded ${
                                                            t.status === 'RESOLVED' ? 'bg-slate-100 text-slate-700 border-slate-300'
                                                                : t.severity === 'OUT_OF_ORDER' ? 'bg-red-50 text-red-800 border-red-300'
                                                                : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
                                                            {t.status === 'RESOLVED' ? 'Resolved' : t.status === 'ASSIGNED' ? 'Assigned' : 'Open'} · {t.severity === 'OUT_OF_ORDER' ? 'Out of order' : 'Under maintenance'}
                                                        </span>
                                                        <strong>
                                                            {t.target.kind === 'BEDS' ? `${WARD_LABELS[t.target.ward]} beds` : EQUIPMENT_LABELS[t.target.equipment]} × {t.units}
                                                        </strong>
                                                        <span className="text-slate-600">{t.description}</span>
                                                    </span>
                                                    {manageMaintenance && t.status !== 'RESOLVED' && (
                                                        <span className="flex gap-1">
                                                            <button type="button" className={secondary} onClick={() => { setAssigning(t.id); setAssignee(t.assignedTo ?? ''); setAssignDate(t.expectedRepairDate ?? ''); }}>Assign…</button>
                                                            <button type="button" className={primary} onClick={() => { setResolving(t.id); setResolution(''); }}>Mark resolved…</button>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500">
                                                    Reported {dateTime(t.reportedAt)} by {t.reportedBy}
                                                    {t.assignedTo ? ` · assigned to ${t.assignedTo}` : ''}
                                                    {t.expectedRepairDate ? ` · repair expected ${t.expectedRepairDate}` : ''}
                                                    {t.resolvedAt ? ` · resolved ${dateTime(t.resolvedAt)} by ${t.resolvedBy}${t.resolutionNote ? ` — ${t.resolutionNote}` : ''}` : ''}
                                                </p>
                                                {assigning === t.id && (
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <input className={field} value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Assign to (name / agency)" />
                                                        <input type="date" className={field} value={assignDate} onChange={e => setAssignDate(e.target.value)} aria-label="Expected repair date" />
                                                        <button type="button" className={primary} onClick={() => store.assignIssue(t.id, assignee, assignDate || undefined, session).then(() => { setAssigning(null); toast.success('Assigned'); }).catch(report)}>Save</button>
                                                        <button type="button" className={secondary} onClick={() => setAssigning(null)}>Cancel</button>
                                                    </div>
                                                )}
                                                {resolving === t.id && (
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <input className={`${field} flex-1 min-w-[12rem]`} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="What was done (optional)" />
                                                        <button type="button" className={primary} onClick={() => store.resolveIssue(t.id, resolution, session).then(() => { setResolving(null); toast.success('Resolved — capacity restored'); }).catch(report)}>Confirm resolved</button>
                                                        <button type="button" className={secondary} onClick={() => setResolving(null)}>Cancel</button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </GovPanel>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
