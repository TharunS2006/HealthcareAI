/**
 * One referral, in full — where it is, who did what and when, what the
 * receiving facility can offer, and the actions this user may take next.
 *
 * The buttons shown are exactly lib/referrals/workflow availableActions() for
 * the acting session, so the screen can never offer a step the rules refuse.
 * Opening the referral as its receiver records DELIVERED automatically — that
 * is what tells the sender "Seen by PHC at 10:42".
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useReferralStore, type StoreResult } from '@/stores/referralStore';
import { useFacilityStore } from '@/stores/facilityStore';
import type { StaffSession } from '@/stores/authStore';
import { actorOf } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import * as wf from '@/lib/referrals/workflow';
import { REFERRAL_TIMING } from '@/lib/referrals/config';
import { requirementsFor } from '@/lib/capacity/requirements';
import { capacityCheck, resolveWard, suggestAlternatives } from '@/lib/capacity/availability';
import { useAvailability, useNow } from '@/lib/capacity/useAvailability';
import { REJECT_REASON_LABELS, type RejectReasonCode } from '@/types/referral';
import { WARD_LABELS } from '@/types/resources';
import type { TriagePriority } from '@/types/patient';
import { clockTime, dateTime, duration, timeAgo } from '@/lib/utils/time';
import { PriorityBadge, StatusBadge } from './Badges';
import CapacityCheckPanel from '@/components/capacity/CapacityCheckPanel';
import FacilityAvailabilityList from '@/components/capacity/FacilityAvailabilityList';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import TranslatableText from '@/components/shared/TranslatableText';

interface Props {
    referralId: string;
    session: StaffSession;
    onClose?: () => void;
    onOpenReferral?: (referralId: string) => void;
}

const input = 'w-full px-2.5 py-1.5 text-[12px] bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#1F3A6E] focus:outline-none';
const btn = 'px-3 py-1.5 text-[12px] font-bold rounded border disabled:opacity-50 disabled:cursor-not-allowed';
const primary = `${btn} bg-[#1F3A6E] text-white border-[#1F3A6E] hover:bg-[#16294E]`;
const secondary = `${btn} bg-white text-[#1F3A6E] border-[#1F3A6E] hover:bg-slate-50`;
const danger = `${btn} bg-white text-red-700 border-red-400 hover:bg-red-50`;

type Panel = null | 'ACCEPT' | 'REJECT' | 'REROUTE' | 'DISPATCH' | 'DISCHARGE' | 'ESCALATE_ONWARD' | 'TREATMENT_NOTE';

export default function ReferralDetail({ referralId, session, onClose, onOpenReferral }: Props) {
    const ref = useReferralStore(s => s.referrals.find(r => r.id === referralId));
    const delivery = useReferralStore(s => s.delivery[referralId]);
    const { act, open, comment, escalateOnward, pushPending } = useReferralStore.getState();
    const stored = useFacilityStore(s => s.facilities);
    const facilities = stored.length ? stored : FACILITY_NETWORK;
    const availabilityOf = useAvailability();
    const now = useNow(15_000);

    const [panel, setPanel] = useState<Panel>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [handover, setHandover] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [rejectCode, setRejectCode] = useState<RejectReasonCode>('NO_BED');
    const [rejectDetail, setRejectDetail] = useState('');
    const [vehicle, setVehicle] = useState('');
    const [eta, setEta] = useState('');
    const [noteText, setNoteText] = useState('');
    const [commentText, setCommentText] = useState('');
    const [onwardTarget, setOnwardTarget] = useState('');
    const [onwardReason, setOnwardReason] = useState('');
    const [onwardPriority, setOnwardPriority] = useState<TriagePriority>('URGENT');

    // Opening a referral as its receiver is what delivers it.
    useEffect(() => {
        if (ref?.status === 'SENT') void open(ref.id, session);
    }, [ref?.id, ref?.status, session, open]);

    useEffect(() => {
        setPanel(null);
        setError(null);
    }, [referralId]);

    const derived = useMemo(() => {
        if (!ref) return null;
        const requirements = requirementsFor(wf.requirementInputOf(ref));
        const target = availabilityOf(ref.toFacilityId);
        const check = capacityCheck(requirements, target);
        const origin = facilities.find(f => f.id === ref.fromFacilityId) ?? FACILITY_NETWORK.find(f => f.id === ref.fromFacilityId);
        const declined = [ref.toFacilityId, ...(ref.routeHistory ?? []).map(h => h.facilityId)];
        const alternatives = origin ? suggestAlternatives(requirements, origin, facilities, availabilityOf, declined) : [];
        return { requirements, target, check, alternatives, origin };
    }, [ref, facilities, availabilityOf]);

    if (!ref || !derived) {
        return (
            <div className="border border-[#B9C5D6] bg-white p-4 text-[12px] text-slate-600">
                This referral is not on this device.
                {onClose && <button type="button" onClick={onClose} className="ml-2 underline">Close</button>}
            </div>
        );
    }

    if (!wf.canViewReferral({ role: session.role, facilityId: session.facilityId }, ref)) {
        return (
            <div className="border border-[#B9C5D6] bg-white p-4 text-[12px] text-slate-700">
                <strong className="block text-[#1F3A6E] mb-1">Not permitted</strong>
                This referral does not involve {session.facilityName}, so it is not shown to {ROLE_LABELS[session.role]} users there.
                {onClose && <button type="button" onClick={onClose} className="ml-2 underline">Close</button>}
            </div>
        );
    }

    const { check, alternatives, target } = derived;
    const actor = actorOf(session);
    const actions = wf.availableActions(actor, ref, now);
    const may = (a: (typeof actions)[number]) => actions.includes(a);
    const receiverSide = session.facilityId === ref.toFacilityId;
    const toFacility = facilities.find(f => f.id === ref.toFacilityId);
    const canReserve = check.bedRequired && check.bedAvailable && Boolean(check.bedWard);
    const needsOverride = check.overall !== 'OK';
    const held = ref.reservation?.state === 'HELD' && (ref.status === 'PATIENT_ARRIVED' || Date.parse(ref.reservation.expiresAt) > now);
    // The ward admission will fill: the held bed's, else the required ward as
    // this facility actually has it (a PHC admits an emergency to General).
    const admitWard = (ref.reservation?.state === 'HELD' ? ref.reservation.ward : undefined)
        ?? (derived.requirements.bed ? resolveWard(derived.requirements.bed.ward, target).ward : 'GENERAL');

    const run = async (fn: () => Promise<StoreResult>, success: string) => {
        setBusy(true);
        setError(null);
        const result = await fn();
        setBusy(false);
        if (!result.ok) {
            setError(result.message);
            toast.error(result.message);
            return false;
        }
        if (result.warning) toast.error(result.warning, { duration: 8000 });
        else toast.success(success);
        setPanel(null);
        return true;
    };

    const defaultHandover = () => {
        const ward = check.bedWard ? `${WARD_LABELS[check.bedWard]} ward` : 'reception';
        return `Report to the ${ward} at ${ref.toFacilityName}. Bring the referral slip, ID and any reports.${toFacility?.contact ? ` Call ${toFacility.contact} on departure.` : ''}`;
    };

    const reservation = canReserve && check.bedWard
        ? {
            ward: check.bedWard,
            label: `${WARD_LABELS[check.bedWard]} ward bed`,
            handoverInstructions: handover.trim() || defaultHandover(),
        }
        : undefined;

    const onwardOptions = alternatives.filter(a => a.facility.id !== ref.toFacilityId && ['CHC', 'SDH', 'DH'].includes(a.facility.type));

    return (
        <article className="border border-[#B9C5D6] bg-white" aria-label={`Referral ${ref.id}`}>
            {/* Header */}
            <header className="bg-[#1F3A6E] text-white px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={ref.priority} />
                        <StatusBadge status={ref.status} />
                        <span className="font-mono text-[10px] text-white/80">{ref.id}</span>
                    </div>
                    <h2 className="text-[15px] font-bold mt-1 leading-tight">
                        {ref.patientName} <span className="font-normal text-white/80 text-[12px]">· {ref.patientAge} y / {ref.patientGender}</span>
                    </h2>
                </div>
                {onClose && (
                    <button type="button" onClick={onClose} className="text-white/90 hover:text-white text-lg leading-none px-1" aria-label="Close referral">
                        ×
                    </button>
                )}
            </header>

            <div className="p-3 space-y-3">
                {/* Route */}
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
                    <span className="text-slate-500">From</span>
                    <strong className="text-slate-800">{ref.fromFacilityName}</strong>
                    <span className="text-slate-500">To</span>
                    <strong className="text-[#1F3A6E]">{ref.toFacilityName}</strong>
                    <span className="text-slate-500">Raised</span>
                    <span>{dateTime(ref.referredAt)} by {ref.referredBy}</span>
                </div>
                {(ref.routeHistory?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1.5">
                        Previously declined by {ref.routeHistory!.map(h => `${h.facilityName} (${REJECT_REASON_LABELS[h.code]}${h.detail ? ` — ${h.detail}` : ''})`).join('; ')}.
                    </p>
                )}

                {/* Delivery — the sender's first question */}
                {ref.status === 'CREATED' ? (
                    <div className="border border-amber-400 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 space-y-1.5" role="status">
                        <strong className="block">Not yet sent — saved on this device only.</strong>
                        <p>
                            {delivery?.status === 'REFUSED'
                                ? `The mesh relay refused it: ${delivery.reason}.`
                                : 'No connection to the referral network has confirmed it. It will send automatically when one does.'}
                            {ref.priority === 'EMERGENCY' && ' For an Emergency, phone the receiving facility now — do not wait.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={secondary} onClick={() => void pushPending()}>Retry now</button>
                            {toFacility?.contact && (
                                <a href={`tel:${toFacility.contact.replace(/[^\d+]/g, '')}`} className={primary}>
                                    Call {ref.toFacilityName.split('—')[0].trim()} · {toFacility.contact}
                                </a>
                            )}
                        </div>
                    </div>
                ) : ref.deliveredAt ? (
                    <p className="text-[12px] bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-1.5 font-semibold">
                        Seen by {ref.toFacilityName} at {clockTime(ref.deliveredAt)} ({timeAgo(ref.deliveredAt, now)})
                        {ref.acknowledgedAt && ` · acknowledged ${clockTime(ref.acknowledgedAt)}`}
                    </p>
                ) : ref.status === 'SENT' ? (
                    <p className="text-[12px] bg-blue-50 border border-blue-200 text-blue-900 px-2 py-1.5">
                        Sent {clockTime(wf.lastEvent(ref, 'SEND')?.at)} — waiting for {ref.toFacilityName} to open it.
                    </p>
                ) : null}

                {ref.escalation && ['SENT', 'DELIVERED'].includes(ref.status) && (
                    <p className="text-[12px] bg-red-50 border border-red-300 text-red-900 px-2 py-1.5 font-semibold" role="alert">
                        Unacknowledged Emergency — escalated to the District Health Officer at {clockTime(ref.escalation.firstAt)}
                        {ref.escalation.level > 1 ? ` (alert ${ref.escalation.level})` : ''}.
                    </p>
                )}

                {ref.rejection && ref.status === 'REJECTED' && (
                    <p className="text-[12px] bg-red-50 border border-red-300 text-red-900 px-2 py-1.5">
                        <strong>Rejected by {ref.rejection.facilityName}</strong> at {clockTime(ref.rejection.at)} — {REJECT_REASON_LABELS[ref.rejection.code]}
                        {ref.rejection.detail ? `: ${ref.rejection.detail}` : ''} ({ref.rejection.byName})
                    </p>
                )}

                {ref.reservation && (
                    <div className={`text-[12px] px-2 py-1.5 border ${held ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-700'}`}>
                        {ref.reservation.state === 'HELD' && held && (
                            <>
                                <strong>Bed reserved — awaiting arrival:</strong> {ref.reservation.label} at {ref.toFacilityName}
                                {ref.status === 'ACCEPTED' && `, held until ${clockTime(ref.reservation.expiresAt)} (${duration(Date.parse(ref.reservation.expiresAt) - now)} left)`}
                                {ref.status === 'PATIENT_ARRIVED' && ' — patient has arrived'}
                            </>
                        )}
                        {ref.reservation.state === 'HELD' && !held && <strong>Reservation lapsed — releasing on the next check.</strong>}
                        {ref.reservation.state === 'OCCUPIED' && <strong>Bed occupied — {ref.reservation.label}</strong>}
                        {ref.reservation.state === 'RELEASED' && (
                            <strong>
                                Bed released {clockTime(ref.reservation.releasedAt)} —{' '}
                                {ref.reservation.releaseReason === 'EXPIRED'
                                    ? `patient had not arrived within ${REFERRAL_TIMING.RESERVATION_HOLD_HOURS} h`
                                    : ref.reservation.releaseReason === 'DISCHARGED'
                                    ? 'patient discharged'
                                    : 'reservation ended'}
                            </strong>
                        )}
                        <span className="block mt-0.5">Handover: {ref.reservation.handoverInstructions}</span>
                    </div>
                )}
                {ref.capacityOverride && (
                    <p className="text-[11px] bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1">
                        Accepted on override by {ref.capacityOverride.byName}: {ref.capacityOverride.reason}
                    </p>
                )}
                {ref.inTransitAt && ['ACCEPTED'].includes(ref.status) && (
                    <p className="text-[12px] bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1.5">
                        In transit {duration(now - Date.parse(String(ref.inTransitAt)))}
                        {ref.ambulanceVehicleNo ? ` · ${ref.ambulanceVehicleNo}` : ''}
                        {typeof ref.etaMinutes === 'number' ? ` · ETA ${ref.etaMinutes} min` : ''}
                    </p>
                )}

                {/* Clinical */}
                <section className="text-[12px] space-y-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reason for referral</h3>
                    <TranslatableText text={ref.reason} className="text-slate-800" />
                    {ref.clinicalSummary && <TranslatableText text={ref.clinicalSummary} className="text-slate-600" />}
                    {ref.vitalsAtReferral && (
                        <p className="text-[11px] text-slate-600 font-mono">
                            SpO2 {ref.vitalsAtReferral.spo2 || '—'}% · HR {ref.vitalsAtReferral.heartRate || '—'}
                            {ref.vitalsAtReferral.bloodPressure ? ` · BP ${ref.vitalsAtReferral.bloodPressure.systolic}/${ref.vitalsAtReferral.bloodPressure.diastolic}` : ''}
                            {ref.vitalsAtReferral.temperature ? ` · T ${ref.vitalsAtReferral.temperature}°F` : ''}
                            {ref.vitalsAtReferral.respiratoryRate ? ` · RR ${ref.vitalsAtReferral.respiratoryRate}` : ''}
                            {ref.vitalsAtReferral.isPregnant ? ` · pregnant${ref.vitalsAtReferral.gestationalWeeks ? ` ${ref.vitalsAtReferral.gestationalWeeks} wk` : ''}` : ''}
                        </p>
                    )}
                    <p className="text-[11px] text-slate-500">Transport: {ref.transportMode.replace(/_/g, ' ')}</p>
                </section>

                {(ref.parentReferralId || ref.onwardReferralId) && (
                    <p className="text-[11px] text-slate-700">
                        {ref.parentReferralId && (
                            <button type="button" className="underline text-[#1F3A6E] mr-3" onClick={() => onOpenReferral?.(ref.parentReferralId!)}>
                                ← Came from referral {ref.parentReferralId}
                            </button>
                        )}
                        {ref.onwardReferralId && (
                            <button type="button" className="underline text-[#1F3A6E]" onClick={() => onOpenReferral?.(ref.onwardReferralId!)}>
                                Escalated onward: {ref.onwardReferralId} →
                            </button>
                        )}
                    </p>
                )}

                {/* Capacity — shown while a decision or a bed is pending */}
                {(wf.phaseOf(ref.status) === 'AWAITING' || (ref.status === 'ACCEPTED' && !held)) && ref.status !== 'CREATED' && (
                    <CapacityCheckPanel check={check} facilityName={ref.toFacilityName} updatedAt={target.updatedAt} />
                )}

                {/* Actions */}
                {actions.length > 0 && (
                    <section className="border border-[#1F3A6E] bg-[#F8FAFC] p-2.5 space-y-2" aria-label="Actions">
                        <div className="flex flex-wrap gap-2">
                            {may('ACKNOWLEDGE') && (
                                <button type="button" disabled={busy} className={secondary} onClick={() => void run(() => act(ref.id, { action: 'ACKNOWLEDGE' }, session), 'Acknowledged — the sender has been notified')}>
                                    Acknowledge
                                </button>
                            )}
                            {may('ACCEPT') && (
                                <button type="button" disabled={busy} className={primary} onClick={() => { setPanel('ACCEPT'); setHandover(defaultHandover()); }}>
                                    Accept…
                                </button>
                            )}
                            {may('REJECT') && (
                                <button type="button" disabled={busy} className={danger} onClick={() => setPanel('REJECT')}>
                                    Reject…
                                </button>
                            )}
                            {may('REROUTE') && (
                                <button type="button" disabled={busy} className={primary} onClick={() => setPanel('REROUTE')}>
                                    Re-route to another facility…
                                </button>
                            )}
                            {may('DISPATCH') && (
                                <button type="button" disabled={busy} className={primary} onClick={() => setPanel('DISPATCH')}>
                                    Dispatch patient…
                                </button>
                            )}
                            {may('RESERVE_BED') && (
                                <button
                                    type="button"
                                    disabled={busy || !canReserve}
                                    title={canReserve ? undefined : 'No suitable bed is free right now'}
                                    className={secondary}
                                    onClick={() => void run(() => act(ref.id, { action: 'RESERVE_BED', reservation: reservation ?? undefined }, session), 'Bed reserved — the sender has been notified')}
                                >
                                    {canReserve ? `Reserve ${WARD_LABELS[check.bedWard!]} bed` : 'No bed free to reserve'}
                                </button>
                            )}
                            {may('MARK_ARRIVED') && (
                                <button type="button" disabled={busy} className={primary} onClick={() => void run(() => act(ref.id, { action: 'MARK_ARRIVED' }, session), 'Arrival recorded')}>
                                    Patient arrived
                                </button>
                            )}
                            {may('ADMIT') && (
                                <button type="button" disabled={busy} className={primary} onClick={() => void run(() => act(ref.id, { action: 'ADMIT', admitWard }, session), `Admitted — ${WARD_LABELS[admitWard]} ward bed count updated`)}>
                                    Admit to {WARD_LABELS[admitWard]} ward
                                </button>
                            )}
                            {may('DISCHARGE') && (
                                <button type="button" disabled={busy} className={secondary} onClick={() => setPanel('DISCHARGE')}>
                                    Discharge…
                                </button>
                            )}
                            {may('TREATMENT_NOTE') && (
                                <button type="button" disabled={busy} className={secondary} onClick={() => setPanel('TREATMENT_NOTE')}>
                                    Add treatment note…
                                </button>
                            )}
                            {may('ESCALATE_ONWARD') && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    className={secondary}
                                    onClick={() => {
                                        setPanel('ESCALATE_ONWARD');
                                        setOnwardReason(ref.reason);
                                        setOnwardPriority(ref.priority === 'ROUTINE' ? 'URGENT' : ref.priority);
                                        setOnwardTarget(onwardOptions[0]?.facility.id ?? '');
                                    }}
                                >
                                    Escalate to CHC / DH…
                                </button>
                            )}
                        </div>

                        {panel === 'ACCEPT' && (
                            <div className="border-t border-slate-200 pt-2 space-y-2 text-[12px]">
                                {canReserve ? (
                                    <p className="text-emerald-900 bg-emerald-50 border border-emerald-300 px-2 py-1">
                                        Accepting reserves one {WARD_LABELS[check.bedWard!]} ward bed ({target.wards[check.bedWard!]?.available} free now) for {REFERRAL_TIMING.RESERVATION_HOLD_HOURS} hours.
                                    </p>
                                ) : check.bedRequired ? (
                                    <p className="text-red-900 bg-red-50 border border-red-300 px-2 py-1">
                                        No suitable bed is free — accepting will not hold a bed for this patient.
                                    </p>
                                ) : (
                                    <p className="text-slate-700">Outpatient referral — no bed will be held.</p>
                                )}
                                {canReserve && (
                                    <label className="block">
                                        <span className="block text-[11px] font-bold text-slate-600 mb-0.5">Handover instructions for the sender</span>
                                        <textarea rows={2} value={handover} onChange={e => setHandover(e.target.value)} className={input} />
                                    </label>
                                )}
                                {needsOverride && (
                                    <label className="block">
                                        <span className="block text-[11px] font-bold text-red-800 mb-0.5">
                                            Reason for accepting despite the shortfall (recorded on the referral and in the audit log)
                                        </span>
                                        <textarea rows={2} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className={input} placeholder="e.g. Portable X-ray arranged from SDH; surgeon on call" />
                                    </label>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy || (needsOverride && overrideReason.trim().length < 5)}
                                        className={primary}
                                        onClick={() =>
                                            void run(
                                                () => act(ref.id, {
                                                    action: 'ACCEPT',
                                                    reservation: canReserve || !check.bedRequired ? (reservation ?? undefined) : undefined,
                                                    override: needsOverride ? { reason: overrideReason } : undefined,
                                                }, session),
                                                canReserve ? 'Accepted — bed reserved, sender notified' : 'Accepted — sender notified'
                                            )
                                        }
                                    >
                                        Confirm acceptance
                                    </button>
                                    <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {panel === 'REJECT' && (
                            <div className="border-t border-slate-200 pt-2 space-y-2 text-[12px]">
                                <fieldset>
                                    <legend className="text-[11px] font-bold text-slate-600 mb-1">Reason (required)</legend>
                                    <div className="grid sm:grid-cols-2 gap-1">
                                        {(Object.keys(REJECT_REASON_LABELS) as RejectReasonCode[]).map(code => (
                                            <label key={code} className="flex items-center gap-1.5">
                                                <input type="radio" name={`reject-${ref.id}`} checked={rejectCode === code} onChange={() => setRejectCode(code)} />
                                                {REJECT_REASON_LABELS[code]}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                <textarea
                                    rows={2}
                                    value={rejectDetail}
                                    onChange={e => setRejectDetail(e.target.value)}
                                    className={input}
                                    placeholder={rejectCode === 'OTHER' ? 'Describe the reason (required)' : 'Details (optional)'}
                                />
                                <div>
                                    <p className="text-[11px] font-bold text-slate-600 mb-1">Nearest facilities with capacity for this patient — the sender will see these too</p>
                                    <FacilityAvailabilityList options={alternatives.slice(0, 4)} availabilityOf={availabilityOf} />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy || (rejectCode === 'OTHER' && !rejectDetail.trim())}
                                        className={danger}
                                        onClick={() => void run(() => act(ref.id, { action: 'REJECT', reject: { code: rejectCode, detail: rejectDetail } }, session), 'Rejected — the sender has been notified')}
                                    >
                                        Confirm rejection
                                    </button>
                                    <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {panel === 'REROUTE' && (
                            <div className="border-t border-slate-200 pt-2 space-y-2 text-[12px]">
                                <p className="text-[11px] text-slate-700">Live availability, nearest first. Facilities that meet every need are listed first.</p>
                                <FacilityAvailabilityList
                                    options={alternatives}
                                    availabilityOf={availabilityOf}
                                    actionLabel="Re-route here"
                                    onAction={facilityId => {
                                        const f = facilities.find(x => x.id === facilityId);
                                        if (!f) return;
                                        void run(() => act(ref.id, { action: 'REROUTE', reroute: { id: f.id, name: f.name, type: f.type } }, session), `Re-routed to ${f.name}`);
                                    }}
                                />
                                <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                            </div>
                        )}

                        {panel === 'DISPATCH' && (
                            <div className="border-t border-slate-200 pt-2 grid sm:grid-cols-[1fr_8rem_auto] gap-2 items-end text-[12px]">
                                <label className="block">
                                    <span className="block text-[11px] font-bold text-slate-600 mb-0.5">
                                        Vehicle number {ref.transportMode.startsWith('AMBULANCE') ? '(required)' : '(optional)'}
                                    </span>
                                    <input value={vehicle} onChange={e => setVehicle(e.target.value)} className={`${input} font-mono`} placeholder="e.g. MH-33-AMB-1081" />
                                </label>
                                <label className="block">
                                    <span className="block text-[11px] font-bold text-slate-600 mb-0.5">ETA (min)</span>
                                    <input type="number" min={0} value={eta} onChange={e => setEta(e.target.value)} className={input} />
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        className={primary}
                                        onClick={() =>
                                            void run(
                                                () => act(ref.id, { action: 'DISPATCH', dispatch: { vehicleNo: vehicle, etaMinutes: eta.trim() ? Number(eta) : undefined } }, session),
                                                'Dispatched — the receiving facility has been notified'
                                            )
                                        }
                                    >
                                        Confirm
                                    </button>
                                    <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {(panel === 'DISCHARGE' || panel === 'TREATMENT_NOTE') && (
                            <div className="border-t border-slate-200 pt-2 space-y-2 text-[12px]">
                                <textarea
                                    rows={3}
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    className={input}
                                    placeholder={panel === 'DISCHARGE' ? 'Discharge summary and follow-up advice (optional)' : 'Treatment given, response, plan'}
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy || (panel === 'TREATMENT_NOTE' && !noteText.trim())}
                                        className={primary}
                                        onClick={async () => {
                                            const ok = await run(
                                                () => act(ref.id, { action: panel, note: noteText }, session),
                                                panel === 'DISCHARGE' ? 'Discharged — bed released' : 'Treatment note added'
                                            );
                                            if (ok) setNoteText('');
                                        }}
                                    >
                                        {panel === 'DISCHARGE' ? 'Confirm discharge' : 'Add note'}
                                    </button>
                                    <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {panel === 'ESCALATE_ONWARD' && (
                            <div className="border-t border-slate-200 pt-2 space-y-2 text-[12px]">
                                <p className="text-[11px] text-slate-700">Raises a new referral from {ref.toFacilityName}, linked to this one.</p>
                                <FacilityAvailabilityList
                                    options={onwardOptions}
                                    availabilityOf={availabilityOf}
                                    selectedId={onwardTarget}
                                    onSelect={setOnwardTarget}
                                    emptyText="No CHC or District Hospital is available to escalate to."
                                />
                                <div className="grid sm:grid-cols-[1fr_10rem] gap-2">
                                    <textarea rows={2} value={onwardReason} onChange={e => setOnwardReason(e.target.value)} className={input} placeholder="Reason for escalation" />
                                    <select value={onwardPriority} onChange={e => setOnwardPriority(e.target.value as TriagePriority)} className={input}>
                                        <option value="EMERGENCY">Emergency</option>
                                        <option value="URGENT">Urgent</option>
                                        <option value="ROUTINE">Routine</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={busy || !onwardTarget || onwardReason.trim().length < 3}
                                        className={primary}
                                        onClick={async () => {
                                            const f = facilities.find(x => x.id === onwardTarget);
                                            if (!f) return;
                                            setBusy(true);
                                            const result = await escalateOnward(ref.id, { id: f.id, name: f.name, type: f.type }, onwardReason, onwardPriority, session);
                                            setBusy(false);
                                            if (!result.ok) {
                                                setError(result.message);
                                                toast.error(result.message);
                                                return;
                                            }
                                            if (result.warning) toast.error(result.warning);
                                            else toast.success(`Escalated to ${f.name}`);
                                            setPanel(null);
                                            onOpenReferral?.(result.value.id);
                                        }}
                                    >
                                        Raise onward referral
                                    </button>
                                    <button type="button" className={secondary} onClick={() => setPanel(null)}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-[12px] text-red-800 bg-red-50 border border-red-300 px-2 py-1" role="alert">{error}</p>}
                    </section>
                )}

                {/* The sender sees where else to go once a referral is rejected */}
                {ref.status === 'REJECTED' && !may('REROUTE') && session.facilityId === ref.fromFacilityId && (
                    <p className="text-[11px] text-slate-600">Only staff who can raise referrals at {ref.fromFacilityName} can re-route this.</p>
                )}
                {ref.status === 'REJECTED' && receiverSide && (
                    <p className="text-[11px] text-slate-600">Waiting for {ref.fromFacilityName} to re-route this patient.</p>
                )}

                {/* Treatment notes */}
                {(ref.treatmentNotes?.length ?? 0) > 0 && (
                    <section className="space-y-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Treatment notes</h3>
                        <ul className="space-y-1.5">
                            {ref.treatmentNotes!.map(n => (
                                <li key={n.id} className="text-[12px] border-l-2 border-emerald-500 pl-2">
                                    <span className="text-[10px] text-slate-500">{dateTime(n.at)} · {n.actor.name}</span>
                                    <p className="text-slate-800">{n.text}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Timeline */}
                <section className="space-y-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Timeline</h3>
                    <ol className="border-l-2 border-[#B9C5D6] ml-1 space-y-2">
                        {ref.timeline.map(e => (
                            <li key={e.id} className="relative pl-3">
                                <span className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${e.action === 'EMERGENCY_ESCALATION' || e.action === 'REJECT' ? 'bg-red-600' : e.actor.role === 'SYSTEM' ? 'bg-slate-400' : 'bg-[#1F3A6E]'}`} />
                                <div className="text-[11px] text-slate-500">{dateTime(e.at)}</div>
                                <div className="text-[12px] text-slate-900">
                                    <strong>{wf.ACTION_LABELS[e.action]}</strong>
                                    {e.fromStatus && e.fromStatus !== e.toStatus && (
                                        <span className="text-slate-600"> · {wf.STATUS_LABELS[e.fromStatus]} → {wf.STATUS_LABELS[e.toStatus]}</span>
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-700">
                                    {e.actor.name}
                                    {e.actor.role !== 'SYSTEM' ? ` (${ROLE_LABELS[e.actor.role]}${e.actor.facilityName ? `, ${e.actor.facilityName}` : ''})` : ''}
                                </div>
                                {e.note && <div className="text-[11px] text-slate-600 italic">{e.note}</div>}
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Comments between the two facilities */}
                <section className="space-y-1.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Messages between facilities</h3>
                    {ref.comments.length === 0 && <p className="text-[11px] text-slate-500">No messages yet.</p>}
                    <ul className="space-y-1.5">
                        {ref.comments.map(c => {
                            const mine = c.actor.userId === session.userId;
                            return (
                                <li key={c.id} className={`text-[12px] px-2 py-1.5 border ${mine ? 'bg-blue-50 border-blue-200 ml-6' : 'bg-slate-50 border-slate-200 mr-6'}`}>
                                    <span className="block text-[10px] text-slate-500">
                                        {c.actor.name}{c.actor.facilityName ? ` · ${c.actor.facilityName}` : ''} · {clockTime(c.at)}
                                    </span>
                                    <TranslatableText text={c.text} />
                                </li>
                            );
                        })}
                    </ul>
                    {can(session.role, 'referral:comment') && (
                        <form
                            className="flex gap-2"
                            onSubmit={async e => {
                                e.preventDefault();
                                if (!commentText.trim()) return;
                                const result = await comment(ref.id, commentText, session);
                                if (!result.ok) toast.error(result.message);
                                else setCommentText('');
                            }}
                        >
                            <input value={commentText} onChange={e => setCommentText(e.target.value)} className={input} placeholder={`Message ${receiverSide ? ref.fromFacilityName : ref.toFacilityName}…`} />
                            <button type="submit" className={primary} disabled={!commentText.trim()}>Send</button>
                        </form>
                    )}
                </section>
            </div>
        </article>
    );
}
