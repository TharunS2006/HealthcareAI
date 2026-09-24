/**
 * Data Inspector — NalamMesh
 *
 * The screen that turns the project's central claim into something a visitor can
 * check instead of take on trust. NalamMesh says a record is captured on a device
 * with no network, held in that device's own database, and uploaded to the
 * district service when connectivity returns. Every other screen shows the
 * *consequences* of that — a queue, a board, a scorecard. This one shows the two
 * databases themselves, side by side, with the raw rows.
 *
 * Three things it must get right:
 *
 *   - An unreachable cloud must never render as an empty cloud. "Nothing has
 *     been uploaded" and "I could not ask" are opposite claims, and a judge
 *     reading the wrong one concludes the sync does not work.
 *   - The device column must never fall back to seed data. Other readers in
 *     lib/db.ts substitute seeds for an empty store so screens are never blank;
 *     here an empty store is a fact worth reporting, so inspectStores does not.
 *   - The match between the two sides has to be computed from the ids actually
 *     present on both, not asserted in prose. A record that exists in both
 *     databases is the whole demonstration.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { inspectStores, type StoreSnapshot } from '@/lib/db';
import { getOutboxDepth } from '@/lib/sync/outbox';
import { fetchStore, type StoreDump } from '@/lib/sync/cloudRecords';
import { reportingBaseUrl } from '@/lib/cloudEndpoint';

/** How often both sides are re-read, so an upload appears without a click. */
const POLL_MS = 15_000;

type CloudState =
    | { kind: 'loading' }
    | { kind: 'ok'; store: StoreDump; at: number }
    | { kind: 'error'; reason: 'offline' | 'unreachable' | 'timeout' | 'error' | 'forbidden'; at: number };

// 'unreachable' is worded by CloudUnavailable instead, because it is the only
// reason where naming the address is what tells the operator what to fix.
const CLOUD_REASON: Record<'offline' | 'timeout' | 'error' | 'forbidden', string> = {
    offline: 'This device is offline, so the district store cannot be read.',
    forbidden: 'The district record service refused this role — the full store is open to the District Health Officer and Super Admin only.',
    timeout: 'The district record service took too long to answer.',
    error: 'The district record service returned an unexpected response.',
};

/** Human names for the IndexedDB object stores, which are camelCase on disk. */
const STORE_LABELS: Record<string, string> = {
    appointments: 'Appointments',
    auditLog: 'Audit trail',
    diagnostics: 'Diagnostic orders',
    facilities: 'Facility directory',
    medicineStock: 'Medicine stock',
    patients: 'Patients',
    queue: 'OPD queue tokens',
    referrals: 'Referrals',
    syncQueue: 'Sync queue',
};

export default function DataInspectorPage() {
    const [local, setLocal] = useState<StoreSnapshot[] | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [outbox, setOutbox] = useState<number | null>(null);
    const [cloud, setCloud] = useState<CloudState>({ kind: 'loading' });
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [online, setOnline] = useState(true);

    const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

    const reload = useCallback(async () => {
        // IndexedDB is the one source here that cannot be down — but it can be
        // blocked (private browsing, a failed upgrade), and a blank column with
        // no explanation would read as "the device holds nothing".
        try {
            setLocal(await inspectStores(25));
            setLocalError(null);
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'IndexedDB could not be opened.');
        }
        try {
            setOutbox(await getOutboxDepth());
        } catch {
            setOutbox(null);
        }

        const result = await fetchStore(50);
        if (result.ok) setCloud({ kind: 'ok', store: result.store, at: Date.now() });
        else setCloud({ kind: 'error', reason: result.reason, at: Date.now() });
    }, []);

    useEffect(() => {
        void reload();
        const poll = setInterval(() => void reload(), POLL_MS);
        return () => clearInterval(poll);
    }, [reload]);

    useEffect(() => {
        const sync = () => setOnline(navigator.onLine);
        sync();
        window.addEventListener('online', sync);
        window.addEventListener('offline', sync);
        return () => {
            window.removeEventListener('online', sync);
            window.removeEventListener('offline', sync);
        };
    }, []);

    const deviceRows = useMemo(
        () => (local ?? []).reduce((sum, s) => sum + s.count, 0),
        [local]
    );

    /** Patient ids this device holds, used to mark which cloud rows came from here. */
    const localPatientIds = useMemo(() => {
        const patients = (local ?? []).find((s) => s.name === 'patients');
        const ids = (patients?.rows ?? []).map((r) => (r as { id?: string }).id).filter(Boolean);
        return new Set(ids as string[]);
    }, [local]);

    const cloudStore = cloud.kind === 'ok' ? cloud.store : null;
    const matched = useMemo(() => {
        if (!cloudStore) return 0;
        return cloudStore.patient_records.filter((r) => localPatientIds.has(r.id)).length;
    }, [cloudStore, localPatientIds]);

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />

                <div className="max-w-7xl mx-auto space-y-5">

                    {/* Header */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-gov-green' : 'bg-gov-amber'}`} />
                                <span className="text-xs font-bold text-gov-navy uppercase tracking-wider">
                                    {online ? 'Device online' : 'Device offline — on-device data below is still live'}
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Data Inspector
                            </h1>
                            <p className="text-xs text-txt-secondary mt-1 max-w-3xl">
                                The two databases NalamMesh runs on, shown raw. On the left, this device&apos;s own
                                IndexedDB — written and read with no network at all. On the right, the district
                                record store this device uploads to once connectivity returns. A record present in
                                both is a record that survived the trip.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="border border-gov-navy bg-gov-navy px-4 py-2 text-sm font-bold text-white hover:bg-gov-navy-hover"
                        >
                            Refresh both
                        </button>
                    </div>

                    <SummaryStrip
                        deviceRows={deviceRows}
                        deviceStores={local?.length ?? 0}
                        outbox={outbox}
                        cloud={cloud}
                        matched={matched}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

                        {/* ── device ─────────────────────────────────────── */}
                        <section className="border border-border-subtle bg-white">
                            <PanelHeader
                                eyebrow="Tier 1 — this device"
                                title="IndexedDB · nalammesh-rural-db"
                                note="Written offline. Survives a reload, a restart and a flight-mode day."
                            />

                            {localError && (
                                <p className="border-b border-gov-red bg-gov-red-bg px-4 py-3 text-xs text-gov-red">
                                    <span className="font-bold">This device&apos;s database could not be read.</span>{' '}
                                    {localError} The stores below are not a picture of what is stored — they are
                                    a picture of a failed read.
                                </p>
                            )}

                            {local === null && !localError && (
                                <p className="px-4 py-6 text-sm text-txt-muted">Reading this device&apos;s stores…</p>
                            )}

                            {local?.map((snapshot) => (
                                <StoreRow
                                    key={snapshot.name}
                                    label={STORE_LABELS[snapshot.name] ?? snapshot.name}
                                    technical={snapshot.name}
                                    count={snapshot.count}
                                    truncated={snapshot.truncated}
                                    shown={snapshot.rows.length}
                                    isOpen={Boolean(open[`local:${snapshot.name}`])}
                                    onToggle={() => toggle(`local:${snapshot.name}`)}
                                    rows={snapshot.rows}
                                />
                            ))}
                        </section>

                        {/* ── cloud ──────────────────────────────────────── */}
                        <section className="border border-border-subtle bg-white">
                            <PanelHeader
                                eyebrow="Tier 3 — district cloud"
                                title="SQLite · district.db"
                                note={`Served by the reporting service at ${reportingBaseUrl()}`}
                            />

                            {cloud.kind === 'loading' && (
                                <p className="px-4 py-6 text-sm text-txt-muted">Asking the district record service…</p>
                            )}

                            {cloud.kind === 'error' && <CloudUnavailable reason={cloud.reason} />}

                            {cloudStore && (
                                <>
                                    <StoreRow
                                        label="Patient records"
                                        technical="patient_records"
                                        count={cloudStore.patient_records_total}
                                        shown={cloudStore.patient_records.length}
                                        truncated={cloudStore.patient_records_total > cloudStore.patient_records.length}
                                        isOpen={Boolean(open['cloud:patients'])}
                                        onToggle={() => toggle('cloud:patients')}
                                        rows={cloudStore.patient_records}
                                        tagFor={(row) =>
                                            localPatientIds.has((row as { id: string }).id)
                                                ? { text: 'Also on this device', tone: 'match' as const }
                                                : { text: 'From another device', tone: 'other' as const }
                                        }
                                    />
                                    <StoreRow
                                        label="Care referrals"
                                        technical="care_referrals"
                                        count={cloudStore.care_referrals_total}
                                        shown={cloudStore.care_referrals.length}
                                        truncated={cloudStore.care_referrals_total > cloudStore.care_referrals.length}
                                        isOpen={Boolean(open['cloud:referrals'])}
                                        onToggle={() => toggle('cloud:referrals')}
                                        rows={cloudStore.care_referrals}
                                    />
                                    <p className="border-t border-border-subtle px-4 py-3 text-[0.6875rem] leading-relaxed text-txt-muted">
                                        Each row carries both the columns the service indexes on and the{' '}
                                        <code className="font-mono">payload</code> the device actually sent. They are
                                        shown together on purpose: it is the payload that shows nothing was reshaped
                                        in transit.
                                    </p>
                                </>
                            )}
                        </section>
                    </div>

                    <WhatThisShows />
                </div>
            </main>
        </div>
    );
}

// ── header strip ─────────────────────────────────────────────────────────────

function SummaryStrip({
    deviceRows,
    deviceStores,
    outbox,
    cloud,
    matched,
}: {
    deviceRows: number;
    deviceStores: number;
    outbox: number | null;
    cloud: CloudState;
    matched: number;
}) {
    const cloudRows =
        cloud.kind === 'ok'
            ? cloud.store.patient_records_total + cloud.store.care_referrals_total
            : null;

    const tiles: { label: string; value: string; note: string; tone: 'navy' | 'green' | 'amber' }[] = [
        {
            label: 'On this device',
            value: `${deviceRows}`,
            note: `rows across ${deviceStores} object stores`,
            tone: 'navy',
        },
        {
            label: 'Waiting to upload',
            value: outbox === null ? '—' : `${outbox}`,
            // A non-zero outbox is not a fault. It is the design working: the
            // record is safe on the device and will go when there is a network.
            note: outbox ? 'held on device until a network appears' : 'nothing queued',
            tone: outbox ? 'amber' : 'green',
        },
        {
            label: 'In the district cloud',
            value: cloudRows === null ? '—' : `${cloudRows}`,
            note: cloudRows === null ? 'store could not be read' : 'patient records + care referrals',
            tone: cloudRows === null ? 'amber' : 'navy',
        },
        {
            label: 'In both databases',
            value: cloud.kind === 'ok' ? `${matched}` : '—',
            note: 'patient ids present on this device and in the cloud',
            tone: matched > 0 ? 'green' : 'navy',
        },
    ];

    const toneClass = {
        navy: 'border-gov-blue-border bg-gov-blue-bg text-gov-navy',
        green: 'border-gov-green-border bg-gov-green-bg text-gov-green-dark',
        amber: 'border-gov-amber bg-gov-amber-bg text-gov-amber',
    };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((tile) => (
                <div key={tile.label} className={`border p-3 ${toneClass[tile.tone]}`}>
                    <p className="text-[0.625rem] font-bold uppercase tracking-wider opacity-80">{tile.label}</p>
                    <p className="text-2xl font-extrabold tabular-nums leading-tight mt-0.5">{tile.value}</p>
                    <p className="text-[0.6875rem] leading-snug mt-0.5 opacity-90">{tile.note}</p>
                </div>
            ))}
        </div>
    );
}

function PanelHeader({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
    return (
        <div className="border-b border-border-subtle bg-[#F8FAFC] px-4 py-3">
            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-txt-muted">{eyebrow}</p>
            <h2 className="text-sm font-extrabold text-emerald-deep font-mono">{title}</h2>
            <p className="text-[0.6875rem] text-txt-secondary mt-0.5">{note}</p>
        </div>
    );
}

function CloudUnavailable({ reason }: { reason: 'offline' | 'unreachable' | 'timeout' | 'error' | 'forbidden' }) {
    return (
        <div className="border-b border-gov-amber bg-gov-amber-bg px-4 py-3">
            <p className="text-sm font-extrabold text-gov-amber">The district store was not read</p>
            <p className="text-xs text-txt-primary mt-1">
                {reason === 'unreachable'
                    ? `No response from the district record service at ${reportingBaseUrl()}.`
                    : CLOUD_REASON[reason]}
            </p>
            <p className="text-xs text-txt-primary mt-2">
                This panel is blank because the question could not be asked — not because the store is
                empty. The device column on the left is unaffected: it never needed the network, which is
                the point being demonstrated. Start the service with{' '}
                <code className="font-mono bg-white border border-gov-amber px-1">
                    cd backend &amp;&amp; uvicorn app.main:app --port 8000
                </code>
                .
            </p>
        </div>
    );
}

// ── one expandable store ─────────────────────────────────────────────────────

function StoreRow({
    label,
    technical,
    count,
    shown,
    truncated,
    isOpen,
    onToggle,
    rows,
    tagFor,
}: {
    label: string;
    technical: string;
    count: number;
    shown: number;
    truncated: boolean;
    isOpen: boolean;
    onToggle: () => void;
    rows: unknown[];
    tagFor?: (row: unknown) => { text: string; tone: 'match' | 'other' };
}) {
    return (
        <div className="border-b border-border-subtle last:border-b-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-surface-hover"
            >
                <span className="min-w-0">
                    <span className="block text-sm font-bold text-txt-primary">{label}</span>
                    <span className="block font-mono text-[0.6875rem] text-txt-muted">{technical}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    <span className="text-lg font-extrabold tabular-nums text-emerald-deep">{count}</span>
                    <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-gov-blue">
                        {isOpen ? 'Hide' : 'View'}
                    </span>
                </span>
            </button>

            {isOpen && (
                <div className="border-t border-border-subtle bg-[#F8FAFC] px-4 py-3 space-y-2">
                    {count === 0 && (
                        <p className="text-xs text-txt-muted">
                            This store is empty. That is the stored state, not a failed read.
                        </p>
                    )}

                    {truncated && (
                        <p className="text-[0.6875rem] text-gov-amber font-bold">
                            Showing the {shown} most recent of {count} rows.
                        </p>
                    )}

                    {rows.map((row, i) => {
                        const tag = tagFor?.(row);
                        return (
                            <details key={rowKey(row, i)} className="border border-border-subtle bg-white">
                                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gov-navy">
                                    <span className="font-mono">{rowLabel(row, i)}</span>
                                    {tag && (
                                        <span
                                            className={`ml-2 rounded-sm px-1.5 py-0.5 text-[0.625rem] font-bold ${
                                                tag.tone === 'match'
                                                    ? 'bg-gov-green-bg text-gov-green-dark'
                                                    : 'bg-gov-blue-bg text-gov-blue'
                                            }`}
                                        >
                                            {tag.text}
                                        </span>
                                    )}
                                </summary>
                                {/* The row is wide and the page must not scroll sideways, so the
                                    JSON gets its own horizontal scroller. */}
                                <pre className="overflow-x-auto border-t border-border-subtle px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-txt-primary">
{JSON.stringify(row, null, 2)}
                                </pre>
                            </details>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** A stable React key for a row of unknown shape. */
function rowKey(row: unknown, index: number): string {
    const id = (row as { id?: unknown })?.id;
    return typeof id === 'string' ? id : `row-${index}`;
}

/**
 * A one-line title for a row of unknown shape.
 *
 * Nine object stores hold nine different shapes, so this reads the few fields
 * they tend to share rather than switching on the store name — which would have
 * to be updated every time a store is added.
 */
function rowLabel(row: unknown, index: number): string {
    const r = (row ?? {}) as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : null;
    const name =
        typeof r.name === 'string'
            ? r.name
            : typeof r.patientName === 'string'
              ? r.patientName
              : typeof r.medicineName === 'string'
                ? r.medicineName
                : typeof r.action === 'string'
                  ? r.action
                  : null;

    if (id && name) return `${id} · ${name}`;
    if (id) return id;
    if (name) return name;
    return `row ${index + 1}`;
}

// ── footer ───────────────────────────────────────────────────────────────────

function WhatThisShows() {
    return (
        <section className="border border-border-subtle bg-white p-4">
            <h2 className="text-sm font-extrabold text-emerald-deep">How to read this screen</h2>
            <ol className="mt-2 space-y-1.5 text-xs text-txt-secondary list-decimal pl-4">
                <li>
                    <span className="font-bold text-txt-primary">Turn the network off</span> and register a
                    patient from OPD Intake. The device column grows immediately; the cloud column does not
                    change, and &ldquo;Waiting to upload&rdquo; goes up.
                </li>
                <li>
                    <span className="font-bold text-txt-primary">Turn the network back on.</span> Within a few
                    seconds the outbox drains, the cloud column grows by the same record, and the patient id
                    appears in both — the &ldquo;In both databases&rdquo; tile counts exactly those.
                </li>
                <li>
                    <span className="font-bold text-txt-primary">Open the row on each side.</span> The JSON is
                    the same record: captured offline on the device, stored verbatim in the district store,
                    which is what the Pre-Arrival Board then reads to prepare for the patient.
                </li>
                <li>
                    <span className="font-bold text-txt-primary">Stop the backend</span> and reload. The device
                    column is unchanged and the app keeps working — the cloud is optional by design, and this
                    screen says so in place of the cloud data rather than showing an empty store.
                </li>
            </ol>
            <p className="mt-3 border-t border-border-subtle pt-2 text-[0.6875rem] text-txt-muted">
                <span className="font-bold text-gov-amber">Note for deployment:</span> the district endpoints,
                including the one behind this screen, are unauthenticated in this build and return identified
                patient records. That is acceptable on a demo LAN and is not acceptable on a public host.
            </p>
        </section>
    );
}
