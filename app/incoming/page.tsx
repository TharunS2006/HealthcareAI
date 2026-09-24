/**
 * Pre-Arrival Preparation Board — NalamMesh
 *
 * The receiving end of the offline-first chain. A record is captured on a device
 * with no network, held there, and uploaded to the district service the moment
 * connectivity returns. This screen is what the hospital opens: who is on the
 * way, how urgent, how long until they arrive, and — from the record itself —
 * what should already be set up when the ambulance doors open.
 *
 * Two things this page must never do:
 *
 *   - Show an empty board because the cloud could not be reached. An empty list
 *     and an unreachable service look identical to a nurse glancing at a screen,
 *     so the failure is stated in place of the list, with what to do instead.
 *   - Present a referral-only case as a complete one. When the patient record
 *     has not arrived yet the preparation list is thinner, and the card says so
 *     rather than letting the thinness read as "this patient is stable".
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { fetchIncoming, type IncomingCase } from '@/lib/sync/cloudRecords';
import { prepareFor, type ReadinessItem, type ReadinessReport } from '@/lib/care/equipment';
import { colourForPatient, colourForPriority, COLOUR_RANK } from '@/lib/care/priority';
import type { TriageStatus } from '@/types/patient';
import { useSession } from '@/lib/auth/session';
import { isDistrictWide } from '@/lib/auth/permissions';

/** How often the board re-asks the district service. */
const POLL_MS = 20_000;

type LoadState =
    | { kind: 'loading' }
    | { kind: 'ok'; cases: IncomingCase[]; at: number }
    | { kind: 'error'; reason: 'offline' | 'unreachable' | 'timeout' | 'error' | 'forbidden'; at: number };

const REASON_TEXT: Record<'offline' | 'unreachable' | 'timeout' | 'error' | 'forbidden', string> = {
    offline: 'This device is offline, so the board cannot be refreshed.',
    forbidden: 'The district record service refused this request for your role or facility.',
    unreachable: 'The district record service is not responding.',
    timeout: 'The district record service took too long to answer.',
    error: 'The district record service returned an unexpected response.',
};

const COLOUR_STYLE: Record<TriageStatus, { bar: string; chip: string; label: string }> = {
    RED: { bar: 'bg-gov-red', chip: 'bg-gov-red-bg text-gov-red border-gov-red', label: 'RED — Emergency' },
    YELLOW: { bar: 'bg-gov-saffron-dark', chip: 'bg-gov-amber-bg text-gov-amber border-gov-amber', label: 'YELLOW — Urgent' },
    GREEN: { bar: 'bg-gov-green', chip: 'bg-gov-green-bg text-gov-green border-gov-green-border', label: 'GREEN — Stable' },
};

export default function IncomingPage() {
    const session = useSession();
    // A facility sees what is coming to it; only district roles pick another facility.
    const pinned = session?.facilityId && !isDistrictWide(session.role) ? session.facilityId : null;
    const [facilityId, setFacilityId] = useState(pinned ?? 'dh-district');
    useEffect(() => {
        if (pinned) setFacilityId(pinned);
    }, [pinned]);
    const [state, setState] = useState<LoadState>({ kind: 'loading' });
    // A slow tick so "arrives in 12 min" counts down without a manual refresh.
    const [now, setNow] = useState(() => Date.now());

    const facility = useMemo(
        () => FACILITY_NETWORK.find((f) => f.id === facilityId) ?? null,
        [facilityId]
    );

    const load = useCallback(async () => {
        const result = await fetchIncoming(facilityId);
        if (result.ok) setState({ kind: 'ok', cases: result.cases, at: Date.now() });
        else setState({ kind: 'error', reason: result.reason, at: Date.now() });
    }, [facilityId]);

    useEffect(() => {
        setState({ kind: 'loading' });
        void load();
        const poll = setInterval(() => void load(), POLL_MS);
        return () => clearInterval(poll);
    }, [load]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    const cases = state.kind === 'ok' ? state.cases : [];

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
                                <span className="w-2.5 h-2.5 rounded-full bg-gov-red animate-pulse" />
                                <span className="text-xs font-bold text-gov-red uppercase tracking-wider">
                                    Incoming from the district record cloud
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Pre-Arrival Preparation Board
                            </h1>
                            <p className="text-xs text-txt-secondary mt-1 max-w-3xl">
                                Records captured offline on field devices upload as soon as connectivity returns.
                                This board shows what each arriving patient needs so equipment, beds and teams are
                                ready before the ambulance reaches the gate.
                            </p>
                        </div>

                        <div className="flex items-end gap-3">
                            <label className="block">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-1">
                                    Receiving facility
                                </span>
                                <select
                                    id="incoming-facility"
                                    value={facilityId}
                                    onChange={(e) => setFacilityId(e.target.value)}
                                    disabled={Boolean(pinned)}
                                    title={pinned ? 'Your own facility — other facilities are visible to district roles only' : undefined}
                                    className="border border-border-subtle bg-white px-3 py-2 text-sm min-w-[230px] disabled:bg-slate-50"
                                >
                                    {FACILITY_NETWORK.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name} ({f.type})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button onClick={() => void load()} className="gov-btn gov-btn-secondary text-sm">
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Connection line — always visible, so the board is never silently stale. */}
                    <ConnectionLine state={state} count={cases.length} />

                    {state.kind === 'error' && <CloudUnavailable reason={state.reason} />}

                    {state.kind === 'loading' && (
                        <div className="surface-card p-8 text-center text-sm text-txt-secondary">
                            Contacting the district record service…
                        </div>
                    )}

                    {state.kind === 'ok' && cases.length === 0 && (
                        <div className="surface-card p-8 text-center">
                            <p className="text-sm font-bold text-emerald-deep">No patients currently en route</p>
                            <p className="text-xs text-txt-secondary mt-1 max-w-xl mx-auto">
                                The district service has no open referral to {facility?.name ?? 'this facility'}.
                                Referrals raised on a device with no connectivity appear here once that device
                                reconnects.
                            </p>
                        </div>
                    )}

                    {state.kind === 'ok' && cases.length > 0 && (
                        <div className="space-y-4">
                            {cases.map((c) => (
                                <CaseCard key={c.referral.id} incoming={c} facility={facility} now={now} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// ── header strip ─────────────────────────────────────────────────────────────

function ConnectionLine({ state, count }: { state: LoadState; count: number }) {
    const stamp = state.kind === 'loading' ? null : new Date(state.at).toLocaleTimeString();
    const ok = state.kind === 'ok';

    return (
        <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 border px-3 py-2 text-xs ${
                ok ? 'bg-gov-blue-bg border-gov-blue-border text-gov-navy' : 'bg-gov-amber-bg border-gov-amber text-gov-amber'
            }`}
        >
            <span className="font-bold">
                {state.kind === 'loading'
                    ? 'Checking the district record service…'
                    : ok
                      ? `${count} patient${count === 1 ? '' : 's'} en route`
                      : 'Board not updating'}
            </span>
            {stamp && <span>Last checked {stamp}</span>}
            <span className="text-txt-muted">Auto-refreshes every 20 seconds</span>
        </div>
    );
}

function CloudUnavailable({ reason }: { reason: 'offline' | 'unreachable' | 'timeout' | 'error' | 'forbidden' }) {
    return (
        <div className="border border-gov-red bg-gov-red-bg p-4">
            <p className="text-sm font-extrabold text-gov-red">
                This board is not showing live data
            </p>
            <p className="text-xs text-txt-primary mt-1">
                {REASON_TEXT[reason]} Any patient dispatched in the last few minutes may not appear here.
            </p>
            <p className="text-xs text-txt-primary mt-2">
                <span className="font-bold">What to do:</span> treat the board as out of date, and confirm
                incoming cases with the referring facility by phone (108 / 102 control room) until it recovers.
                Referring devices keep their records queued, so nothing is lost — it arrives once the
                connection is restored.
            </p>
        </div>
    );
}

// ── one arriving patient ─────────────────────────────────────────────────────

function CaseCard({
    incoming,
    facility,
    now,
}: {
    incoming: IncomingCase;
    facility: { equipment: string[]; services: string[]; name: string } | null;
    now: number;
}) {
    const { referral, patient } = incoming;
    const colour: TriageStatus = patient
        ? worstOf(colourForPatient(patient), colourForPriority(referral.priority))
        : colourForPriority(referral.priority);
    const style = COLOUR_STYLE[colour];

    const report = prepareFor(referral, patient, facility);
    const eta = etaLabel(incoming, now);

    return (
        <article className="surface-card overflow-hidden">
            <div className={`h-1.5 w-full ${style.bar}`} />

            <div className="p-4 md:p-5 space-y-4">
                {/* Identity and urgency */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-extrabold text-emerald-deep">
                                {referral.patientName || patient?.name || 'Name not received'}
                            </h2>
                            <span className={`border px-2 py-0.5 text-[10px] font-extrabold ${style.chip}`}>
                                {style.label}
                            </span>
                            <span className="border border-border-subtle px-2 py-0.5 text-[10px] font-bold text-txt-secondary">
                                {referral.status}
                            </span>
                        </div>
                        <p className="text-xs text-txt-secondary mt-1">
                            {referral.patientAge ?? patient?.age ?? '—'} yrs · {genderLabel(referral.patientGender ?? patient?.gender)}
                            {' · '}from {referral.fromFacilityName || referral.fromFacilityId}
                            {referral.transportMode ? ` · ${referral.transportMode.replace('_', ' ')}` : ''}
                            {referral.ambulanceVehicleNo ? ` · ${referral.ambulanceVehicleNo}` : ''}
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-txt-muted">Arrival</div>
                        <div className="text-xl font-extrabold text-emerald-deep font-mono">{eta.headline}</div>
                        <div className="text-[10px] text-txt-muted">{eta.detail}</div>
                    </div>
                </div>

                {/* Clinical context */}
                {(referral.reason || referral.clinicalSummary) && (
                    <div className="border-l-2 border-border-subtle pl-3 space-y-1">
                        {referral.reason && (
                            <p className="text-sm text-txt-primary">{referral.reason}</p>
                        )}
                        {referral.clinicalSummary && (
                            <p className="text-xs text-txt-secondary font-mono">{referral.clinicalSummary}</p>
                        )}
                    </div>
                )}

                {/* The record itself */}
                {patient ? (
                    <PatientSnapshot patient={patient} />
                ) : (
                    <div className="border border-gov-amber bg-gov-amber-bg px-3 py-2 text-xs text-gov-amber">
                        <span className="font-extrabold">Patient record not received yet.</span>{' '}
                        The referral has arrived but the full record — vitals, history, risk flags — is still
                        queued on the referring device. The preparation list below is derived from the referral
                        text alone and is likely incomplete.
                    </div>
                )}

                <ReadinessList report={report} facilityName={facility?.name} />
            </div>
        </article>
    );
}

function worstOf(a: TriageStatus, b: TriageStatus): TriageStatus {
    return COLOUR_RANK[b] < COLOUR_RANK[a] ? b : a;
}

function genderLabel(g?: string): string {
    if (g === 'F') return 'Female';
    if (g === 'M') return 'Male';
    if (g === 'O') return 'Other';
    return 'Sex not recorded';
}

/**
 * When the patient is expected.
 *
 * `eta_minutes` is a dispatcher's estimate made at the moment of dispatch, so it
 * is counted down from `raised_at` rather than shown as a constant — a card that
 * still says "35 min" an hour later is worse than one that says the estimate has
 * passed.
 */
function etaLabel(incoming: IncomingCase, now: number): { headline: string; detail: string } {
    const raisedAt = incoming.raised_at ? new Date(incoming.raised_at).getTime() : NaN;
    const elapsedMin = Number.isFinite(raisedAt) ? Math.floor((now - raisedAt) / 60_000) : null;
    const elapsedText = elapsedMin === null
        ? 'referral time not recorded'
        : elapsedMin < 60
          ? `referred ${Math.max(0, elapsedMin)} min ago`
          : `referred ${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`;

    if (typeof incoming.eta_minutes !== 'number') {
        return { headline: 'ETA —', detail: `no estimate given · ${elapsedText}` };
    }
    if (elapsedMin === null) {
        return { headline: `${incoming.eta_minutes} min`, detail: `estimated at dispatch · ${elapsedText}` };
    }
    const remaining = incoming.eta_minutes - elapsedMin;
    if (remaining <= 0) {
        return { headline: 'Due now', detail: `estimate passed ${Math.abs(remaining)} min ago · ${elapsedText}` };
    }
    return { headline: `${remaining} min`, detail: `of a ${incoming.eta_minutes} min estimate · ${elapsedText}` };
}

// ── the record, at a glance ──────────────────────────────────────────────────

function PatientSnapshot({ patient }: { patient: NonNullable<IncomingCase['patient']> }) {
    const v = patient.vitals ?? ({} as NonNullable<IncomingCase['patient']>['vitals']);
    const bp = v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : null;

    const fields: Array<[string, string | null]> = [
        ['SpO₂', typeof v.spo2 === 'number' ? `${v.spo2}%` : null],
        ['Pulse', typeof v.heartRate === 'number' ? `${v.heartRate}/min` : null],
        ['BP', bp ? `${bp} mmHg` : null],
        ['Temp', typeof v.temperature === 'number' ? `${v.temperature}°F` : null],
        ['Resp', typeof v.respiratoryRate === 'number' ? `${v.respiratoryRate}/min` : null],
        ['Glucose', typeof v.bloodGlucose === 'number' ? `${v.bloodGlucose} mg/dL` : null],
        ['Consciousness', v.consciousness ?? null],
        ['Gestation', typeof v.gestationalWeeks === 'number' ? `${v.gestationalWeeks} weeks` : null],
    ];
    const recorded = fields.filter(([, value]) => value !== null);

    return (
        <div className="space-y-2">
            <div className="flex items-baseline gap-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-txt-muted">
                    Record received from the field device
                </h3>
                {patient.abhaId && (
                    <span className="font-mono text-[10px] text-txt-muted">ABHA {patient.abhaId}</span>
                )}
            </div>

            {recorded.length === 0 ? (
                <p className="text-xs text-gov-amber">No vitals were recorded on this record.</p>
            ) : (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                    {recorded.map(([label, value]) => (
                        <div key={label} className="border border-border-subtle px-2 py-1.5">
                            <dt className="text-[10px] uppercase tracking-wider text-txt-muted">{label}</dt>
                            <dd className="text-sm font-bold text-txt-primary font-mono">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {(patient.highRiskFlags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-txt-muted">
                        Registered risk
                    </span>
                    {patient.highRiskFlags!.map((flag, i) => (
                        <span
                            key={`${flag.type}-${i}`}
                            className="border border-gov-amber bg-gov-amber-bg px-2 py-0.5 text-[10px] font-bold text-gov-amber"
                        >
                            {flag.type.replace(/_/g, ' ')} · {flag.severity}
                        </span>
                    ))}
                </div>
            )}

            {v.injuryType && (
                <p className="text-xs text-txt-secondary">
                    <span className="font-bold text-txt-primary">Recorded complaint: </span>
                    {v.injuryType}
                </p>
            )}
        </div>
    );
}

// ── readiness checklist ──────────────────────────────────────────────────────

const STATE_STYLE: Record<ReadinessItem['state'], { chip: string; text: string }> = {
    READY: { chip: 'bg-gov-green-bg text-gov-green border-gov-green-border', text: 'Available here' },
    GAP: { chip: 'bg-gov-red-bg text-gov-red border-gov-red', text: 'Not in this facility’s list' },
    UNKNOWN: { chip: 'bg-gov-amber-bg text-gov-amber border-gov-amber', text: 'Cannot verify' },
};

function ReadinessList({ report, facilityName }: { report: ReadinessReport; facilityName?: string }) {
    if (report.items.length === 0) {
        return (
            <div className="border border-border-subtle bg-bg-surface-hover px-3 py-2 text-xs text-txt-secondary">
                <span className="font-bold text-txt-primary">No special preparation indicated.</span>{' '}
                Nothing in this referral or record meets a readiness threshold. Receive as a routine arrival.
            </div>
        );
    }

    const immediate = report.items.filter((i) => i.need.urgency === 'IMMEDIATE');
    const onArrival = report.items.filter((i) => i.need.urgency === 'ON_ARRIVAL');

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-txt-muted">
                    Prepare before arrival
                </h3>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                    {report.gaps > 0 && (
                        <span className="border border-gov-red bg-gov-red-bg px-2 py-0.5 text-gov-red">
                            {report.gaps} not available at {facilityName ?? 'this facility'}
                        </span>
                    )}
                    {report.unknowns > 0 && (
                        <span className="border border-gov-amber bg-gov-amber-bg px-2 py-0.5 text-gov-amber">
                            {report.unknowns} could not be verified
                        </span>
                    )}
                </div>
            </div>

            {report.fromReferralOnly && (
                <p className="text-[11px] text-gov-amber">
                    Derived from the referral text only — the patient record has not arrived, so this list
                    may be shorter than what the patient actually needs.
                </p>
            )}

            <NeedGroup title="Immediately — before the doors open" items={immediate} />
            <NeedGroup title="On arrival" items={onArrival} />

            {report.gaps > 0 && (
                <p className="text-[11px] text-txt-secondary">
                    Items marked not available are checked against this facility’s recorded equipment and
                    service list. Confirm locally before diverting — the list may be out of date, and a
                    diversion costs the patient time.
                </p>
            )}
        </div>
    );
}

function NeedGroup({ title, items }: { title: string; items: ReadinessItem[] }) {
    if (items.length === 0) return null;
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-txt-muted mb-1">{title}</p>
            <ul className="divide-y divide-border-subtle border border-border-subtle">
                {items.map(({ need, state, matchedOn }) => (
                    <li key={need.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-txt-primary">{need.label}</p>
                            <p className="text-[11px] text-txt-secondary">{need.reason}</p>
                            {matchedOn && (
                                <p className="text-[10px] text-txt-muted font-mono mt-0.5">on record: {matchedOn}</p>
                            )}
                        </div>
                        <span className={`shrink-0 border px-2 py-0.5 text-[10px] font-extrabold ${STATE_STYLE[state].chip}`}>
                            {STATE_STYLE[state].text}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
