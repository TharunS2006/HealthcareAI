/**
 * Accountability Audit Trail — NalamMesh (the rural healthcare access problem, Module: Accountability)
 *
 * Read-only view of every recorded action — referral lifecycle, bed and equipment
 * changes, maintenance, user administration, sign-ins, queue and stock — with who acted,
 * at which facility, when, and the before→after change. Open to the District Health
 * Officer and Super Admin (audit:view, lib/auth/permissions.ts). Data is this device's
 * IndexedDB auditLog store; referral events received from other devices are recorded
 * here too, under the user who took them.
 *
 * Below it, the district record service's access log: every request it answered for
 * identified records (uploads, pre-arrival board and Data Inspector reads), refused
 * ones included, under the user their session token names. */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { getAuditLog } from '@/lib/db';
import { fetchAccessLog, type AccessLogEntry, type AccessLogResult } from '@/lib/sync/cloudRecords';
import { reportingBaseUrl } from '@/lib/cloudEndpoint';
import { AuditLogEntry } from '@/types/facility';
import { useSession } from '@/lib/auth/session';
import { can, ROLE_LABELS, isStaffRole } from '@/lib/auth/permissions';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import Link from 'next/link';

type EntityFilter = 'ALL' | AuditLogEntry['entityType'];
type AccessFailure = Extract<AccessLogResult, { ok: false }>['reason'];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});
const facilityName = (id?: string | null) => (id ? FACILITY_NETWORK.find(f => f.id === id)?.name ?? id : 'District / system');

export default function AuditPage() {
    const session = useSession();
    const role = session?.role ?? null;
    const staffId = session?.staffId ?? null;
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<EntityFilter>('ALL');
    const [facility, setFacility] = useState<string>('ALL');

    const permitted = can(role, 'audit:view');

    useEffect(() => {
        if (!permitted) { setLoading(false); return; }
        let alive = true;
        getAuditLog(500)
            .then(rows => { if (alive) { setEntries(rows); setLoading(false); } })
            .catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [permitted]);

    const filtered = useMemo(
        () => entries
            .filter(e => filter === 'ALL' || e.entityType === filter)
            .filter(e => facility === 'ALL' || e.actorFacilityId === facility),
        [entries, filter, facility]
    );

    const summarise = (json?: string): string => {
        if (!json) return '';
        try {
            const obj = JSON.parse(json);
            return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
        } catch { return json; }
    };

    const badgeFor = (t: AuditLogEntry['entityType']) =>
        t === 'REFERRAL' ? 'bg-teal-100 text-teal-800'
        : t === 'QUEUE' ? 'bg-indigo-100 text-indigo-800'
        : t === 'MEDICINE' ? 'bg-amber-100 text-amber-800'
        : t === 'RESOURCES' || t === 'MAINTENANCE' ? 'bg-blue-100 text-blue-800'
        : t === 'USER' || t === 'FACILITY' || t === 'SESSION' ? 'bg-purple-100 text-purple-800'
        : 'bg-slate-100 text-slate-700';

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#1F3A6E]" />
                            <span className="text-xs font-bold text-[#1F3A6E] uppercase tracking-wider">
                                Government of Maharashtra • Public Health — Accountability
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">
                            Accountability Audit Trail
                        </h1>
                        <p className="text-xs text-txt-secondary mt-0.5">
                            Every recorded action — who, at which facility, when, and what changed
                        </p>
                    </div>

                    {!permitted ? (
                        <div className="surface-card p-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-[#1F3A6E]">Restricted view</h2>
                            <p className="text-sm text-txt-secondary mt-1 max-w-md mx-auto">
                                The audit trail is available to the District Health Officer and Super Admin
                                {role ? ` — you are signed in as ${ROLE_LABELS[role]}.` : '.'} {' '}
                                {!role && <>Please <Link href="/staff/login" className="text-[#1F3A6E] underline font-bold">sign in</Link> with an authorised role.</>}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Filter pills */}
                            <div className="surface-card p-3 flex flex-wrap items-center gap-1.5">
                                {(['ALL', 'REFERRAL', 'RESOURCES', 'MAINTENANCE', 'USER', 'FACILITY', 'SESSION', 'QUEUE', 'MEDICINE', 'PATIENT', 'APPOINTMENT'] as EntityFilter[]).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            filter === f ? 'bg-[#1F3A6E] text-white shadow-sm' : 'bg-gray-100 text-txt-secondary hover:bg-gray-200'
                                        }`}
                                    >
                                        {f}{f !== 'ALL' && ` (${entries.filter(e => e.entityType === f).length})`}
                                    </button>
                                ))}
                                <select value={facility} onChange={e => setFacility(e.target.value)} className="ml-auto px-2 py-1 text-[11px] border border-slate-300 rounded" aria-label="Facility">
                                    <option value="ALL">All facilities</option>
                                    {FACILITY_NETWORK.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                <span className="text-[11px] text-txt-muted">
                                    Signed in as <strong>{role ? ROLE_LABELS[role] : '—'}</strong>{staffId ? ` · ${staffId}` : ''} · {filtered.length} of {entries.length} entries
                                </span>
                            </div>

                            {loading ? (
                                <div className="surface-card p-8 text-center text-sm text-txt-secondary">Loading audit trail…</div>
                            ) : filtered.length === 0 ? (
                                <div className="surface-card p-8 text-center text-sm text-txt-secondary">
                                    No audit entries yet. Actions like accepting a referral, calling a queue token, or
                                    updating medicine stock will appear here.
                                </div>
                            ) : (
                                <div className="surface-card overflow-x-auto" tabIndex={0} role="region" aria-label="Audit trail on this device">
                                    <table className="gov-table w-full">
                                        <thead>
                                            <tr>
                                                <th>When</th>
                                                <th>Who</th>
                                                <th>Facility</th>
                                                <th>Entity</th>
                                                <th>Action</th>
                                                <th>Before → After</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(e => (
                                                <tr key={e.id}>
                                                    <td className="whitespace-nowrap text-xs">{fmt(e.timestamp)}</td>
                                                    <td className="text-xs">
                                                        <span className="font-semibold">{e.actorName ?? e.actorId}</span>
                                                        <span className="block text-[10px] text-txt-muted">
                                                            {isStaffRole(e.actorRole) ? ROLE_LABELS[e.actorRole] : e.actorRole} · <span className="font-mono">{e.actorId}</span>
                                                        </span>
                                                    </td>
                                                    <td className="text-[11px]">{facilityName(e.actorFacilityId)}</td>
                                                    <td>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeFor(e.entityType)}`}>
                                                            {e.entityType}
                                                        </span>
                                                        <span className="block text-[10px] text-txt-muted font-mono mt-0.5">{e.entityId}</span>
                                                    </td>
                                                    <td className="text-xs font-semibold">{e.action}</td>
                                                    <td className="text-[11px] text-txt-secondary">
                                                        {e.before && <span className="line-through text-txt-muted">{summarise(e.before)}</span>}
                                                        {e.before && ' → '}
                                                        <span>{summarise(e.after)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <DistrictAccessLog />
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

// ── the district record service's access log ─────────────────────────────────

// 'unreachable' is worded in the component, with the address, as on the Data Inspector.
const ACCESS_REASON: Record<Exclude<AccessFailure, 'unreachable'>, string> = {
    offline: 'This device is offline, so the district record service’s log cannot be read.',
    forbidden: 'The district record service refused this role — its access log is open to the District Health Officer and Super Admin only.',
    'no-session': 'You are signed in on this device only, so the district record service cannot confirm who is asking. Sign in again with your PIN while the relay is reachable.',
    timeout: 'The district record service took too long to answer.',
    error: 'The district record service returned an unexpected response.',
};

function outcome(status: number): { label: string; tone: string } {
    if (status < 300) return { label: 'Answered', tone: 'bg-emerald-100 text-emerald-800' };
    if (status === 401) return { label: 'Not signed in', tone: 'bg-red-100 text-red-800' };
    if (status === 403) return { label: 'Refused', tone: 'bg-red-100 text-red-800' };
    if (status === 413) return { label: 'Too large', tone: 'bg-amber-100 text-amber-900' };
    if (status < 500) return { label: 'Rejected', tone: 'bg-amber-100 text-amber-900' };
    return { label: 'Server error', tone: 'bg-red-100 text-red-800' };
}

function DistrictAccessLog() {
    const [state, setState] = useState<
        { kind: 'loading' } | { kind: 'ok'; entries: AccessLogEntry[] } | { kind: 'error'; reason: AccessFailure }
    >({ kind: 'loading' });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        fetchAccessLog(200).then(result => {
            if (alive) setState(result.ok ? { kind: 'ok', entries: result.entries } : { kind: 'error', reason: result.reason });
        });
        return () => { alive = false; };
    }, [attempt]);

    const refresh = () => { setState({ kind: 'loading' }); setAttempt(a => a + 1); };

    return (
        <section className="space-y-3" aria-labelledby="district-access-log">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 id="district-access-log" className="text-lg font-extrabold text-[#1F3A6E]">District record service: who read whose record</h2>
                    <p className="text-xs text-txt-secondary mt-0.5 max-w-3xl">
                        Every request the district service answered for identified records — uploads, pre-arrival board and
                        Data Inspector reads — under the user their session token names. Refused attempts are listed too.
                        Kept by the service, not this device.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={state.kind === 'loading'}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1F3A6E] text-white disabled:opacity-60"
                >
                    {state.kind === 'loading' ? 'Reading…' : 'Refresh'}
                </button>
            </div>

            {state.kind === 'loading' ? (
                <div className="surface-card p-6 text-center text-sm text-txt-secondary">Reading the district service’s access log…</div>
            ) : state.kind === 'error' ? (
                <div className="surface-card border-l-4 border-gov-amber bg-gov-amber-bg p-4" role="status">
                    <p className="text-sm font-extrabold text-gov-amber">The district access log was not read</p>
                    <p className="text-xs text-txt-primary mt-1">
                        {state.reason === 'unreachable'
                            ? `No response from the district record service at ${reportingBaseUrl()}.`
                            : ACCESS_REASON[state.reason]}
                    </p>
                    <p className="text-xs text-txt-primary mt-1">
                        This says nothing about what the log holds — it could not be asked. The trail above is unaffected.
                    </p>
                </div>
            ) : state.entries.length === 0 ? (
                <div className="surface-card p-6 text-center text-sm text-txt-secondary">
                    The district service has answered no requests for records yet.
                </div>
            ) : (
                <div className="surface-card overflow-x-auto" tabIndex={0} role="region" aria-label="District record service access log">
                    <table className="gov-table w-full">
                        <caption className="sr-only">Latest {state.entries.length} requests to the district record service, newest first</caption>
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Who</th>
                                <th>Request</th>
                                <th>Result</th>
                                <th>Records</th>
                                <th>From</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.entries.map((e, i) => {
                                const result = outcome(e.status);
                                return (
                                    <tr key={`${e.at}-${i}`}>
                                        <td className="whitespace-nowrap text-xs">{fmt(e.at)}</td>
                                        <td className="text-xs">
                                            {e.user_id ? (
                                                <>
                                                    <span className="font-mono font-semibold">{e.user_id}</span>
                                                    <span className="block text-[10px] text-txt-muted">
                                                        {isStaffRole(e.role) ? ROLE_LABELS[e.role] : e.role ?? '—'}
                                                        {e.facility_id ? ` · ${facilityName(e.facility_id)}` : ''}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-txt-muted">No valid session</span>
                                            )}
                                        </td>
                                        <td className="text-[11px] font-mono break-all">
                                            {e.method} {e.path}{e.query ? `?${e.query}` : ''}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${result.tone}`}>
                                                {result.label} · {e.status}
                                            </span>
                                        </td>
                                        <td className="text-[11px] text-txt-secondary">{e.detail ?? '—'}</td>
                                        <td className="text-[11px] font-mono text-txt-muted">{e.client ?? '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
