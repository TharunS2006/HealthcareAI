/**
 * Accountability Audit Trail — NalamMesh (SIH PS#26133, Module: Accountability)
 *
 * Read-only view of every recorded mutation (referral status, queue movement, medicine
 * stock, patient records) with who acted, when, and the before→after change. Role-gated:
 * visible only to Medical Officer / Specialist / DHO, never to ASHA/ANM field roles.
 * Data is local (IndexedDB auditLog store); no network.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { getAuditLog } from '@/lib/db';
import { AuditLogEntry } from '@/types/facility';
import { useAuthStore, AUDIT_ALLOWED_ROLES } from '@/stores/authStore';
import Link from 'next/link';

type EntityFilter = 'ALL' | AuditLogEntry['entityType'];

export default function AuditPage() {
    const { role, staffId } = useAuthStore();
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<EntityFilter>('ALL');

    const permitted = role !== null && AUDIT_ALLOWED_ROLES.includes(role);

    useEffect(() => {
        if (!permitted) { setLoading(false); return; }
        let alive = true;
        getAuditLog(300)
            .then(rows => { if (alive) { setEntries(rows); setLoading(false); } })
            .catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [permitted]);

    const filtered = useMemo(
        () => (filter === 'ALL' ? entries : entries.filter(e => e.entityType === filter)),
        [entries, filter]
    );

    const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    const summarise = (json?: string): string => {
        if (!json) return '—';
        try {
            const obj = JSON.parse(json);
            return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
        } catch { return json; }
    };

    const badgeFor = (t: AuditLogEntry['entityType']) =>
        t === 'REFERRAL' ? 'bg-teal-100 text-teal-800'
        : t === 'QUEUE' ? 'bg-indigo-100 text-indigo-800'
        : t === 'MEDICINE' ? 'bg-amber-100 text-amber-800'
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
                            Every recorded change to referrals, queue, and medicine stock — who, when, and what changed
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
                                The audit trail is available to Medical Officer, Specialist, and District Health
                                Officer roles only{role ? ` — you are signed in as ${role}.` : '.'} {' '}
                                {!role && <>Please <Link href="/staff/login" className="text-[#1F3A6E] underline font-bold">sign in</Link> with an authorised role.</>}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Filter pills */}
                            <div className="surface-card p-3 flex flex-wrap items-center gap-1.5">
                                {(['ALL', 'REFERRAL', 'QUEUE', 'MEDICINE', 'PATIENT'] as EntityFilter[]).map(f => (
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
                                <span className="ml-auto text-[11px] text-txt-muted">
                                    Signed in as <strong>{role}</strong>{staffId ? ` · ${staffId}` : ''} · {entries.length} entries
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
                                <div className="surface-card overflow-x-auto">
                                    <table className="gov-table w-full">
                                        <thead>
                                            <tr>
                                                <th>When</th>
                                                <th>Actor</th>
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
                                                        <span className="font-mono">{e.actorId}</span>
                                                        <span className="block text-[10px] text-txt-muted">{e.actorRole}</span>
                                                    </td>
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
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
