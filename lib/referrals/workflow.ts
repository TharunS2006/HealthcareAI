/**
 * The referral lifecycle — the only place a referral changes state.
 *
 *   CREATED → SENT → DELIVERED → ACKNOWLEDGED → ACCEPTED / REJECTED
 *           → PATIENT_ARRIVED → ADMITTED → DISCHARGED
 *
 * Every screen, the IndexedDB service, the escalation clock and the mesh relay
 * go through these functions, so "can a Medical Officer accept a referral that
 * was never opened?" has one answer, checked in one place, and pinned by
 * scripts/verify-referral-flow.mts.
 *
 * Each function is pure: it takes a referral and returns a new one plus the
 * timeline event that explains the change, or a refusal naming why. Nothing
 * here touches storage, the network or the clock — the caller passes `at` —
 * which is what lets the relay run the same rules on events from other
 * devices, and lets the verify script replay a whole referral in memory.
 *
 * Imports are relative and type-only outside lib/, because server/mesh-server.ts
 * loads this file directly.
 */

import { can, isDistrictWide, type Permission, type StaffRole } from '../auth/permissions';
import type { StaffUser } from '../auth/users';
import type { FacilityType, ReferralRecord, TriagePriority, Vitals } from '../../types/patient';
import type {
    NotificationRecord,
    NotificationType,
    ReferralAction,
    ReferralActor,
    ReferralComment,
    ReferralEvent,
    ReferralStatus,
    RejectReasonCode,
} from '../../types/referral';
import { REJECT_REASON_LABELS } from '../../types/referral';
import type { WardType } from '../../types/resources';
import { WARD_LABELS } from '../../types/resources';
import { requirementsFor } from '../capacity/requirements';
import { remapRetiredFacilityIds } from '../data/facilityIds';
import { REFERRAL_TIMING } from './config';

// ── labels ───────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ReferralStatus, string> = {
    CREATED: 'Created — not yet sent',
    SENT: 'Sent',
    DELIVERED: 'Delivered (seen)',
    ACKNOWLEDGED: 'Acknowledged',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    PATIENT_ARRIVED: 'Patient arrived',
    ADMITTED: 'Admitted',
    DISCHARGED: 'Discharged',
};

export const ACTION_LABELS: Record<ReferralAction, string> = {
    CREATE: 'Referral created',
    SEND: 'Sent',
    OPEN: 'Opened by receiving facility',
    ACKNOWLEDGE: 'Acknowledged',
    ACCEPT: 'Accepted',
    REJECT: 'Rejected',
    REROUTE: 'Re-routed',
    DISPATCH: 'Patient dispatched',
    RESERVE_BED: 'Bed reserved',
    MARK_ARRIVED: 'Patient arrived',
    ADMIT: 'Admitted',
    DISCHARGE: 'Discharged',
    ESCALATE_ONWARD: 'Escalated onward',
    TREATMENT_NOTE: 'Treatment note',
    EMERGENCY_ESCALATION: 'Escalated — no acknowledgement',
    RESERVATION_EXPIRED: 'Bed reservation expired',
};

/** The four board columns the statuses fall into. */
export type ReferralPhase = 'AWAITING' | 'ACCEPTED' | 'AT_FACILITY' | 'CLOSED';

export function phaseOf(status: ReferralStatus): ReferralPhase {
    switch (status) {
        case 'CREATED':
        case 'SENT':
        case 'DELIVERED':
        case 'ACKNOWLEDGED':
            return 'AWAITING';
        case 'ACCEPTED':
            return 'ACCEPTED';
        case 'PATIENT_ARRIVED':
        case 'ADMITTED':
            return 'AT_FACILITY';
        default:
            return 'CLOSED';
    }
}

/** Still in motion — not yet admitted, discharged or rejected. */
export function isOpenReferral(status: ReferralStatus): boolean {
    return phaseOf(status) === 'AWAITING' || status === 'ACCEPTED';
}

// ── rules ────────────────────────────────────────────────────────────────────

type Side = 'SENDER' | 'RECEIVER' | 'SYSTEM';

interface ActionRule {
    permission: Permission | null;
    side: Side;
    from: readonly ReferralStatus[];
    /** 'SAME' for actions that record something without moving the status. */
    to: ReferralStatus | 'SAME';
}

export const ACTION_RULES: Record<ReferralAction, ActionRule> = {
    CREATE: { permission: 'referral:create', side: 'SENDER', from: [], to: 'CREATED' },
    SEND: { permission: 'referral:create', side: 'SENDER', from: ['CREATED'], to: 'SENT' },
    OPEN: { permission: 'referral:receive', side: 'RECEIVER', from: ['SENT'], to: 'DELIVERED' },
    ACKNOWLEDGE: { permission: 'referral:acknowledge', side: 'RECEIVER', from: ['DELIVERED'], to: 'ACKNOWLEDGED' },
    ACCEPT: { permission: 'referral:accept_reject', side: 'RECEIVER', from: ['DELIVERED', 'ACKNOWLEDGED'], to: 'ACCEPTED' },
    REJECT: { permission: 'referral:accept_reject', side: 'RECEIVER', from: ['DELIVERED', 'ACKNOWLEDGED'], to: 'REJECTED' },
    REROUTE: { permission: 'referral:create', side: 'SENDER', from: ['REJECTED'], to: 'CREATED' },
    DISPATCH: { permission: 'referral:create', side: 'SENDER', from: ['ACCEPTED'], to: 'SAME' },
    RESERVE_BED: { permission: 'referral:accept_reject', side: 'RECEIVER', from: ['ACCEPTED'], to: 'SAME' },
    MARK_ARRIVED: { permission: 'referral:arrival', side: 'RECEIVER', from: ['ACCEPTED'], to: 'PATIENT_ARRIVED' },
    ADMIT: { permission: 'referral:arrival', side: 'RECEIVER', from: ['PATIENT_ARRIVED'], to: 'ADMITTED' },
    DISCHARGE: { permission: 'referral:discharge', side: 'RECEIVER', from: ['ADMITTED'], to: 'DISCHARGED' },
    ESCALATE_ONWARD: { permission: 'referral:escalate', side: 'RECEIVER', from: ['ACCEPTED', 'PATIENT_ARRIVED', 'ADMITTED'], to: 'SAME' },
    TREATMENT_NOTE: { permission: 'treatment:notes', side: 'RECEIVER', from: ['PATIENT_ARRIVED', 'ADMITTED'], to: 'SAME' },
    EMERGENCY_ESCALATION: { permission: null, side: 'SYSTEM', from: ['SENT', 'DELIVERED'], to: 'SAME' },
    RESERVATION_EXPIRED: { permission: null, side: 'SYSTEM', from: ['ACCEPTED'], to: 'SAME' },
};

/** Actions the SYSTEM actor may take besides the clock's own: 108 dispatch raises and sends. */
const SYSTEM_MAY: readonly ReferralAction[] = ['CREATE', 'SEND', 'EMERGENCY_ESCALATION', 'RESERVATION_EXPIRED'];

export type WorkflowErrorCode =
    | 'FORBIDDEN'
    | 'WRONG_FACILITY'
    | 'ILLEGAL_TRANSITION'
    | 'MISSING_REASON'
    | 'NO_CAPACITY'
    | 'INVALID';

export type Refusal = { ok: false; code: WorkflowErrorCode; message: string };

export interface ResourceDelta {
    facilityId: string;
    ward: WardType;
    occupied: 1 | -1;
}

export type WorkflowResult =
    | { ok: true; referral: ReferralRecord; event: ReferralEvent; resourceDelta?: ResourceDelta }
    | Refusal;

const refuse = (code: WorkflowErrorCode, message: string): Refusal => ({ ok: false, code, message });

// ── who may act ──────────────────────────────────────────────────────────────

export function actorFromUser(user: StaffUser, facilityName?: string): ReferralActor {
    return { userId: user.id, name: user.name, role: user.role, facilityId: user.facilityId, facilityName };
}

export const SYSTEM_ACTOR: ReferralActor = {
    userId: 'system',
    name: 'NalamMesh (automatic)',
    role: 'SYSTEM',
    facilityId: null,
};

/** Is the actor on the side of the referral this rule belongs to? */
function onSide(side: Side, actor: ReferralActor, ref: ReferralRecord): boolean {
    if (side === 'SYSTEM') return actor.role === 'SYSTEM';
    if (actor.role === 'SYSTEM') return false;
    if (!actor.facilityId) return false;
    if (side === 'SENDER') return actor.facilityId === ref.fromFacilityId;
    return actor.facilityId === ref.toFacilityId;
}

/** Permission + facility + status, without action-specific payload checks. */
function checkRule(action: ReferralAction, actor: ReferralActor, ref: ReferralRecord): Refusal | null {
    const rule = ACTION_RULES[action];
    if (actor.role === 'SYSTEM') {
        if (!SYSTEM_MAY.includes(action)) return refuse('FORBIDDEN', `${ACTION_LABELS[action]} needs a signed-in user`);
    } else {
        if (rule.permission === null) return refuse('FORBIDDEN', `${ACTION_LABELS[action]} is automatic and cannot be done by hand`);
        if (!can(actor.role, rule.permission)) {
            return refuse('FORBIDDEN', `${actor.role} may not ${ACTION_LABELS[action].toLowerCase()} (needs ${rule.permission})`);
        }
        if (!onSide(rule.side, actor, ref)) {
            return refuse(
                'WRONG_FACILITY',
                rule.side === 'SENDER'
                    ? `Only ${ref.fromFacilityName} can do this`
                    : `Only ${ref.toFacilityName} can do this`
            );
        }
    }
    if (!rule.from.includes(ref.status)) {
        return refuse('ILLEGAL_TRANSITION', `${ACTION_LABELS[action]} is not possible while the referral is ${STATUS_LABELS[ref.status].toLowerCase()}`);
    }
    return null;
}

/**
 * May this user see this referral at all?
 *
 * Sender and receiver both see it — the Sub Centre keeps following its patient
 * after the PHC has it. Receivers do not see a referral still CREATED on the
 * sender's device: it has not reached them yet, and showing it would claim a
 * delivery that has not happened. A Specialist sees a referral only once it is
 * accepted ("view accepted patients"). A facility that rejected a referral
 * keeps read access to it after it is re-routed.
 */
export function canViewReferral(
    viewer: { role: StaffRole | null; facilityId: string | null },
    ref: ReferralRecord
): boolean {
    if (!can(viewer.role, 'referral:view')) return false;
    if (isDistrictWide(viewer.role)) return ref.status !== 'CREATED' || ref.fromFacilityId === viewer.facilityId;
    const own = viewer.facilityId;
    if (!own) return false;
    if (ref.fromFacilityId === own) return true;
    if (ref.toFacilityId === own) {
        if (ref.status === 'CREATED') return false;
        if (can(viewer.role, 'referral:receive')) return true;
        return ['ACCEPTED', 'PATIENT_ARRIVED', 'ADMITTED', 'DISCHARGED'].includes(ref.status);
    }
    return Boolean(ref.routeHistory?.some(h => h.facilityId === own) && can(viewer.role, 'referral:receive'));
}

/** Buttons this actor should be offered right now. OPEN and SEND happen on their own. */
export function availableActions(actor: ReferralActor, ref: ReferralRecord, now: number): ReferralAction[] {
    const manual: ReferralAction[] = [
        'ACKNOWLEDGE', 'ACCEPT', 'REJECT', 'REROUTE', 'DISPATCH', 'RESERVE_BED',
        'MARK_ARRIVED', 'ADMIT', 'DISCHARGE', 'ESCALATE_ONWARD', 'TREATMENT_NOTE',
    ];
    return manual.filter(action => {
        if (checkRule(action, actor, ref)) return false;
        if (action === 'DISPATCH') return !ref.inTransitAt;
        if (action === 'RESERVE_BED') {
            const bedNeeded = Boolean(requirementsFor(requirementInputOf(ref)).bed);
            const held = ref.reservation?.state === 'HELD' && Date.parse(ref.reservation.expiresAt) > now;
            return bedNeeded && !held;
        }
        if (action === 'ESCALATE_ONWARD') return !ref.onwardReferralId;
        return true;
    });
}

// ── creating ─────────────────────────────────────────────────────────────────

export interface FacilityRef {
    id: string;
    name: string;
    type: FacilityType;
}

export interface NewReferralInput {
    id: string;
    eventId: string;
    at: string;
    patient: { id: string; name: string; age: number; gender: 'M' | 'F' | 'O' };
    from: FacilityRef;
    to: FacilityRef;
    reason: string;
    priority: TriagePriority;
    transportMode: ReferralRecord['transportMode'];
    clinicalSummary?: string;
    vitals?: Vitals;
    parentReferralId?: string;
    /** 108 / 102 dispatch: the ambulance is already on its way as the referral is raised. */
    dispatch?: { vehicleNo?: string; etaMinutes?: number };
}

export function createReferral(input: NewReferralInput, actor: ReferralActor): WorkflowResult {
    if (actor.role !== 'SYSTEM') {
        if (!can(actor.role, 'referral:create')) return refuse('FORBIDDEN', `${actor.role} may not create referrals`);
        if (actor.facilityId !== input.from.id) return refuse('WRONG_FACILITY', 'A referral is raised from your own facility');
    }
    if (input.to.id === input.from.id) return refuse('INVALID', 'Choose a different facility to refer to');
    if (input.to.type === 'SC') return refuse('INVALID', 'A Sub Centre does not receive referrals');
    if (input.reason.trim().length < 3) return refuse('MISSING_REASON', 'Enter the clinical reason for referral');

    const event: ReferralEvent = {
        id: input.eventId,
        action: 'CREATE',
        fromStatus: null,
        toStatus: 'CREATED',
        at: input.at,
        actor,
        note: `${input.priority} referral to ${input.to.name}${input.dispatch ? ' — ambulance already dispatched' : ''}`,
    };
    const referral: ReferralRecord = {
        id: input.id,
        patientId: input.patient.id,
        patientName: input.patient.name,
        patientAge: input.patient.age,
        patientGender: input.patient.gender,
        fromFacilityId: input.from.id,
        fromFacilityName: input.from.name,
        fromFacilityType: input.from.type,
        toFacilityId: input.to.id,
        toFacilityName: input.to.name,
        toFacilityType: input.to.type,
        reason: input.reason.trim(),
        priority: input.priority,
        status: 'CREATED',
        referredBy: actor.name,
        referredByUserId: actor.userId,
        referredAt: input.at,
        updatedAt: input.at,
        lastUpdatedAt: input.at,
        transportMode: input.transportMode,
        clinicalSummary: input.clinicalSummary,
        vitalsAtReferral: input.vitals,
        parentReferralId: input.parentReferralId,
        timeline: [event],
        comments: [],
        ...(input.dispatch
            ? {
                inTransitAt: input.at,
                ...(input.dispatch.vehicleNo ? { ambulanceVehicleNo: input.dispatch.vehicleNo } : {}),
                ...(typeof input.dispatch.etaMinutes === 'number' ? { etaMinutes: input.dispatch.etaMinutes } : {}),
            }
            : {}),
    };
    return { ok: true, referral, event };
}

// ── acting ───────────────────────────────────────────────────────────────────

export interface ActionInput {
    action: Exclude<ReferralAction, 'CREATE'>;
    actor: ReferralActor;
    at: string;
    eventId: string;
    note?: string;
    reject?: { code: RejectReasonCode; detail?: string };
    reroute?: FacilityRef;
    /** ACCEPT / RESERVE_BED: the bed the caller found free. */
    reservation?: { ward: WardType; label: string; handoverInstructions: string };
    /** ACCEPT when no bed is free: accept anyway, on the record, with a reason. */
    override?: { reason: string };
    dispatch?: { vehicleNo?: string; etaMinutes?: number };
    sentVia?: 'RELAY' | 'LOCAL_PEER';
    onward?: { referralId: string; facilityName: string };
    escalationLevel?: number;
    /**
     * ADMIT with no bed held: the ward the caller resolved at this facility
     * (a PHC takes an emergency into its General ward). Ignored when a bed is held.
     */
    admitWard?: WardType;
}

const addHours = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 3_600_000).toISOString();

export function requirementInputOf(ref: ReferralRecord) {
    return {
        reason: ref.reason,
        priority: ref.priority,
        clinicalSummary: ref.clinicalSummary,
        vitals: ref.vitalsAtReferral,
        patientAge: ref.patientAge,
    };
}

export function applyAction(ref: ReferralRecord, input: ActionInput): WorkflowResult {
    const refused = checkRule(input.action, input.actor, ref);
    if (refused) return refused;

    const rule = ACTION_RULES[input.action];
    const toStatus: ReferralStatus = rule.to === 'SAME' ? ref.status : rule.to;
    const next: ReferralRecord = {
        ...ref,
        timeline: [...ref.timeline],
        comments: [...ref.comments],
        status: toStatus,
        updatedAt: input.at,
        lastUpdatedAt: input.at,
    };
    let note = input.note?.trim() || undefined;
    let resourceDelta: ResourceDelta | undefined;

    switch (input.action) {
        case 'SEND':
            next.sentVia = input.sentVia ?? 'RELAY';
            note = note ?? (next.sentVia === 'RELAY'
                ? 'Accepted by the mesh relay'
                : `Received by a ${ref.toFacilityName} user on this device`);
            break;

        case 'OPEN':
            next.deliveredAt = input.at;
            note = note ?? `Seen by ${ref.toFacilityName}`;
            break;

        case 'ACKNOWLEDGE':
            next.acknowledgedAt = input.at;
            break;

        case 'ACCEPT': {
            const bedNeeded = Boolean(requirementsFor(requirementInputOf(ref)).bed);
            const overrideReason = input.override?.reason.trim() ?? '';
            if (bedNeeded && !input.reservation && overrideReason.length < 5) {
                return refuse('NO_CAPACITY', 'No bed is free for this patient — reserve one, or accept on override with a reason');
            }
            next.acceptedAt = input.at;
            const parts: string[] = [];
            if (input.reservation) {
                next.reservation = {
                    facilityId: ref.toFacilityId,
                    ward: input.reservation.ward,
                    label: input.reservation.label,
                    reservedAt: input.at,
                    expiresAt: addHours(input.at, REFERRAL_TIMING.RESERVATION_HOLD_HOURS),
                    state: 'HELD',
                    handoverInstructions: input.reservation.handoverInstructions,
                };
                parts.push(`${input.reservation.label} — held ${REFERRAL_TIMING.RESERVATION_HOLD_HOURS} h`);
            } else if (!bedNeeded) {
                parts.push('Outpatient referral — no bed required');
            }
            // An override is recorded whenever one was given — with a held bed
            // too, when what fell short was equipment or a specialist.
            if (overrideReason) {
                next.capacityOverride = { reason: overrideReason, byName: input.actor.name, at: input.at };
                parts.push(input.reservation ? `Accepted despite a shortfall: ${overrideReason}` : `Accepted without a reserved bed: ${overrideReason}`);
            }
            note = [note, ...parts].filter(Boolean).join(' · ');
            break;
        }

        case 'REJECT': {
            if (!input.reject) return refuse('MISSING_REASON', 'Choose a reason for rejecting');
            const detail = input.reject.detail?.trim();
            if (input.reject.code === 'OTHER' && !detail) return refuse('MISSING_REASON', 'Describe the reason for rejecting');
            next.rejectedAt = input.at;
            next.rejection = {
                code: input.reject.code,
                detail,
                at: input.at,
                byName: input.actor.name,
                facilityId: ref.toFacilityId,
                facilityName: ref.toFacilityName,
            };
            note = `${REJECT_REASON_LABELS[input.reject.code]}${detail ? ` — ${detail}` : ''}`;
            break;
        }

        case 'REROUTE': {
            const target = input.reroute;
            if (!target) return refuse('INVALID', 'Choose the facility to re-route to');
            if (target.id === ref.toFacilityId) return refuse('INVALID', `${ref.toFacilityName} has just declined this referral`);
            if (target.id === ref.fromFacilityId) return refuse('INVALID', 'Choose a different facility to refer to');
            if (target.type === 'SC') return refuse('INVALID', 'A Sub Centre does not receive referrals');
            next.routeHistory = [
                ...(ref.routeHistory ?? []),
                {
                    facilityId: ref.toFacilityId,
                    facilityName: ref.toFacilityName,
                    rejectedAt: ref.rejection?.at ?? ref.rejectedAt ?? input.at,
                    code: ref.rejection?.code ?? 'OTHER',
                    detail: ref.rejection?.detail,
                },
            ];
            next.toFacilityId = target.id;
            next.toFacilityName = target.name;
            next.toFacilityType = target.type;
            // A new receiver starts a new conversation: its own delivery, its
            // own acknowledgement clock.
            next.rejection = undefined;
            next.rejectedAt = undefined;
            next.deliveredAt = undefined;
            next.acknowledgedAt = undefined;
            next.escalation = undefined;
            next.sentVia = undefined;
            note = `Re-routed from ${ref.toFacilityName} to ${target.name}`;
            break;
        }

        case 'DISPATCH': {
            if (ref.inTransitAt) return refuse('ILLEGAL_TRANSITION', 'The patient has already been dispatched');
            const vehicle = input.dispatch?.vehicleNo?.trim();
            const byAmbulance = ref.transportMode === 'AMBULANCE_108' || ref.transportMode === 'AMBULANCE_102';
            if (byAmbulance && !vehicle) return refuse('INVALID', 'Enter the ambulance vehicle number');
            const eta = input.dispatch?.etaMinutes;
            if (eta !== undefined && (!Number.isFinite(eta) || eta < 0)) return refuse('INVALID', 'ETA must be a positive number of minutes');
            next.inTransitAt = input.at;
            if (vehicle) next.ambulanceVehicleNo = vehicle;
            if (eta !== undefined) next.etaMinutes = eta;
            note = [vehicle ? `Vehicle ${vehicle}` : 'Own transport', eta !== undefined ? `ETA ${eta} min` : null]
                .filter(Boolean)
                .join(' · ');
            break;
        }

        case 'RESERVE_BED': {
            if (!input.reservation) return refuse('NO_CAPACITY', 'No bed is free to reserve');
            const held = ref.reservation?.state === 'HELD' && Date.parse(ref.reservation.expiresAt) > Date.parse(input.at);
            if (held) return refuse('ILLEGAL_TRANSITION', 'A bed is already held for this patient');
            next.reservation = {
                facilityId: ref.toFacilityId,
                ward: input.reservation.ward,
                label: input.reservation.label,
                reservedAt: input.at,
                expiresAt: addHours(input.at, REFERRAL_TIMING.RESERVATION_HOLD_HOURS),
                state: 'HELD',
                handoverInstructions: input.reservation.handoverInstructions,
            };
            note = input.reservation.label;
            break;
        }

        case 'MARK_ARRIVED':
            next.arrivedAt = input.at;
            break;

        case 'ADMIT': {
            const heldWard = ref.reservation && ref.reservation.state === 'HELD' && ref.reservation.facilityId === ref.toFacilityId
                ? ref.reservation.ward
                : undefined;
            const ward = heldWard ?? input.admitWard ?? requirementsFor(requirementInputOf(ref)).bed?.ward ?? 'GENERAL';
            next.admittedAt = input.at;
            next.admittedWard = ward;
            if (heldWard && next.reservation) next.reservation = { ...next.reservation, state: 'OCCUPIED' };
            resourceDelta = { facilityId: ref.toFacilityId, ward, occupied: 1 };
            note = note ?? `${WARD_LABELS[ward]} ward${heldWard ? ' (reserved bed)' : ''}`;
            break;
        }

        case 'DISCHARGE':
            next.dischargedAt = input.at;
            next.completedAt = input.at;
            if (next.reservation && next.reservation.state !== 'RELEASED') {
                next.reservation = { ...next.reservation, state: 'RELEASED', releasedAt: input.at, releaseReason: 'DISCHARGED' };
            }
            if (ref.admittedWard) resourceDelta = { facilityId: ref.toFacilityId, ward: ref.admittedWard, occupied: -1 };
            break;

        case 'ESCALATE_ONWARD':
            if (!input.onward) return refuse('INVALID', 'The onward referral is missing');
            if (ref.onwardReferralId) return refuse('ILLEGAL_TRANSITION', 'Already escalated onward');
            next.onwardReferralId = input.onward.referralId;
            note = `Onward referral to ${input.onward.facilityName}`;
            break;

        case 'TREATMENT_NOTE':
            if (!note) return refuse('INVALID', 'Write the treatment note');
            next.treatmentNotes = [
                ...(ref.treatmentNotes ?? []),
                { id: input.eventId, at: input.at, actor: input.actor, text: note },
            ];
            break;

        case 'EMERGENCY_ESCALATION': {
            const sendEvent = lastEvent(ref, 'SEND');
            if (!sendEvent) return refuse('ILLEGAL_TRANSITION', 'Never sent, so nothing to escalate');
            const level = input.escalationLevel ?? (ref.escalation?.level ?? 0) + 1;
            next.escalation = {
                level,
                firstAt: ref.escalation?.sendEventId === sendEvent.id ? ref.escalation.firstAt : input.at,
                lastAt: input.at,
                sendEventId: sendEvent.id,
            };
            const waited = formatElapsed(Date.parse(input.at) - Date.parse(sendEvent.at));
            const extra = input.note?.trim();
            note = `No acknowledgement ${waited} after sending — ${level === 1 ? 'District Health Officer alerted' : `DHO re-alerted (alert ${level})`}${extra ? ` · ${extra}` : ''}`;
            break;
        }

        case 'RESERVATION_EXPIRED':
            if (!ref.reservation || ref.reservation.state !== 'HELD') return refuse('ILLEGAL_TRANSITION', 'No bed is held');
            next.reservation = { ...ref.reservation, state: 'RELEASED', releasedAt: input.at, releaseReason: 'EXPIRED' };
            note = `${ref.reservation.label} released — patient had not arrived within ${REFERRAL_TIMING.RESERVATION_HOLD_HOURS} h`;
            break;
    }

    const event: ReferralEvent = {
        id: input.eventId,
        action: input.action,
        fromStatus: ref.status,
        toStatus,
        at: input.at,
        actor: input.actor,
        ...(note ? { note } : {}),
    };
    next.timeline.push(event);
    return { ok: true, referral: next, event, resourceDelta };
}

export function lastEvent(ref: ReferralRecord, action: ReferralAction): ReferralEvent | undefined {
    for (let i = ref.timeline.length - 1; i >= 0; i--) {
        if (ref.timeline[i].action === action) return ref.timeline[i];
    }
    return undefined;
}

// ── comments ─────────────────────────────────────────────────────────────────

export function addComment(
    ref: ReferralRecord,
    actor: ReferralActor,
    text: string,
    at: string,
    id: string
): { ok: true; referral: ReferralRecord; comment: ReferralComment } | Refusal {
    if (actor.role === 'SYSTEM' || !can(actor.role, 'referral:comment')) return refuse('FORBIDDEN', 'You may not comment on referrals');
    if (!canViewReferral({ role: actor.role, facilityId: actor.facilityId }, ref)) {
        return refuse('WRONG_FACILITY', 'Only the two facilities on this referral can comment');
    }
    const body = text.trim();
    if (!body) return refuse('INVALID', 'Write a comment');
    if (body.length > 1000) return refuse('INVALID', 'Keep comments under 1000 characters');
    const comment: ReferralComment = { id, at, actor, text: body };
    return {
        ok: true,
        comment,
        referral: { ...ref, comments: [...ref.comments, comment], updatedAt: at },
    };
}

// ── notifications ────────────────────────────────────────────────────────────

/** Active users posted at a facility whose role holds the permission. */
export function usersAt(directory: readonly StaffUser[], facilityId: string, permission: Permission): StaffUser[] {
    return directory.filter(u => u.active && u.facilityId === facilityId && can(u.role, permission));
}

const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** "12 min", or "20 s" under a minute — the simulation's fast clock escalates in seconds. */
export function formatElapsed(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));
    return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function notify(
    users: readonly StaffUser[],
    event: ReferralEvent,
    ref: ReferralRecord,
    type: NotificationType,
    message: string,
    except: string
): NotificationRecord[] {
    const seen = new Set<string>();
    return users
        .filter(u => u.id !== except && !seen.has(u.id) && seen.add(u.id))
        .map(u => ({
            // Deterministic per event and recipient, so the same event arriving
            // from two devices becomes one row, not two bells.
            id: `${event.id}:${type}:${u.id}`,
            recipient_user_id: u.id,
            facility_id: u.facilityId,
            referral_id: ref.id,
            type,
            message,
            is_read: false,
            created_at: event.at,
            priority: ref.priority,
        }));
}

/** Who hears about this event, and what they are told. */
export function notificationsFor(ref: ReferralRecord, event: ReferralEvent, directory: readonly StaffUser[]): NotificationRecord[] {
    const senders = usersAt(directory, ref.fromFacilityId, 'referral:create');
    const receivers = usersAt(directory, ref.toFacilityId, 'referral:receive');
    // Specialists see accepted patients; they hear about them from acceptance on.
    const clinicians = usersAt(directory, ref.toFacilityId, 'treatment:notes').filter(u => !can(u.role, 'referral:receive'));
    const dho = directory.filter(u => u.active && u.role === 'DHO');
    const who = ref.patientName;
    const me = event.actor.userId;

    switch (event.action) {
        case 'SEND': {
            const rerouted = (ref.routeHistory?.length ?? 0) > 0;
            return notify(receivers, event, ref, 'REFERRAL_RECEIVED',
                `${rerouted ? 'Re-routed ' : ''}${ref.priority} referral from ${ref.fromFacilityName}: ${who} — ${clip(ref.reason)}`, me);
        }
        case 'OPEN':
            return notify(senders, event, ref, 'REFERRAL_SEEN', `Seen by ${ref.toFacilityName} at ${clock(event.at)} — ${who}`, me);
        case 'ACKNOWLEDGE':
            return notify(senders, event, ref, 'REFERRAL_ACKNOWLEDGED', `${ref.toFacilityName} acknowledged the referral for ${who}`, me);
        case 'ACCEPT': {
            const r = ref.reservation;
            const bed = r && r.state === 'HELD'
                ? `${r.label}, held until ${clock(r.expiresAt)}. Handover: ${r.handoverInstructions}`
                : ref.capacityOverride
                ? 'No bed reserved.'
                : 'No bed required.';
            const detail = ref.capacityOverride ? `${bed} Note: ${ref.capacityOverride.reason}` : bed;
            return [
                ...notify(senders, event, ref, 'REFERRAL_ACCEPTED', `${ref.toFacilityName} accepted ${who}. ${detail}`, me),
                ...notify(clinicians, event, ref, 'REFERRAL_ACCEPTED', `Accepted patient coming from ${ref.fromFacilityName}: ${who} — ${clip(ref.reason, 60)}`, me),
            ];
        }
        case 'REJECT': {
            const rj = ref.rejection;
            const why = rj ? `${REJECT_REASON_LABELS[rj.code]}${rj.detail ? ` — ${rj.detail}` : ''}` : 'no reason recorded';
            return notify(senders, event, ref, 'REFERRAL_REJECTED', `${ref.toFacilityName} rejected the referral for ${who}: ${why}. Re-route to another facility.`, me);
        }
        case 'DISPATCH':
            return notify([...receivers, ...clinicians], event, ref, 'PATIENT_DISPATCHED',
                `${who} dispatched from ${ref.fromFacilityName}${ref.ambulanceVehicleNo ? ` (${ref.ambulanceVehicleNo})` : ''}${typeof ref.etaMinutes === 'number' ? `, ETA ${ref.etaMinutes} min` : ''}`, me);
        case 'RESERVE_BED':
            return notify(senders, event, ref, 'BED_RESERVED', `${ref.toFacilityName} reserved a bed for ${who}: ${ref.reservation?.label ?? ''}`, me);
        case 'MARK_ARRIVED':
            return notify(senders, event, ref, 'PATIENT_ARRIVED', `${who} arrived at ${ref.toFacilityName} at ${clock(event.at)}`, me);
        case 'ADMIT':
            return notify(senders, event, ref, 'PATIENT_ADMITTED',
                `${who} admitted to the ${WARD_LABELS[ref.admittedWard ?? 'GENERAL']} ward at ${ref.toFacilityName}`, me);
        case 'DISCHARGE':
            return notify(senders, event, ref, 'PATIENT_DISCHARGED', `${who} discharged from ${ref.toFacilityName}`, me);
        case 'ESCALATE_ONWARD':
            return notify(senders, event, ref, 'ONWARD_REFERRAL', `${ref.toFacilityName} escalated ${who} onward — ${event.note ?? ''}`, me);
        case 'EMERGENCY_ESCALATION': {
            const waited = formatElapsed(Date.parse(event.at) - Date.parse(lastEvent(ref, 'SEND')?.at ?? event.at));
            return [
                ...notify(receivers, event, ref, 'EMERGENCY_REMINDER',
                    `Unacknowledged EMERGENCY from ${ref.fromFacilityName} for ${waited} — ${who}. Acknowledge now.`, me),
                ...notify(dho, event, ref, 'EMERGENCY_ESCALATION',
                    `EMERGENCY ${who} (${ref.fromFacilityName} → ${ref.toFacilityName}) unacknowledged for ${waited}`, me),
                ...notify(senders, event, ref, 'EMERGENCY_ESCALATION',
                    `No acknowledgement from ${ref.toFacilityName} after ${waited} — escalated to the District Health Officer`, me),
            ];
        }
        case 'RESERVATION_EXPIRED': {
            const holders = [...receivers, ...usersAt(directory, ref.toFacilityId, 'capacity:manage')];
            const msg = `Bed reservation for ${who} at ${ref.toFacilityName} expired — patient had not arrived. Bed released.`;
            return [
                ...notify(senders, event, ref, 'RESERVATION_EXPIRED', msg, me),
                ...notify(holders, event, ref, 'RESERVATION_EXPIRED', msg, me),
            ];
        }
        default:
            return [];
    }
}

/** A comment goes to the other side of the referral. */
export function notificationsForComment(ref: ReferralRecord, comment: ReferralComment, directory: readonly StaffUser[]): NotificationRecord[] {
    const fakeEvent: ReferralEvent = {
        id: comment.id,
        action: 'CREATE',
        fromStatus: ref.status,
        toStatus: ref.status,
        at: comment.at,
        actor: comment.actor,
    };
    const senders = usersAt(directory, ref.fromFacilityId, 'referral:view');
    const receivers = directory.filter(
        u => u.active && u.facilityId === ref.toFacilityId && canViewReferral({ role: u.role, facilityId: u.facilityId }, ref)
    );
    const fromSender = comment.actor.facilityId === ref.fromFacilityId;
    const fromReceiver = comment.actor.facilityId === ref.toFacilityId;
    const audience = fromSender ? receivers : fromReceiver ? senders : [...senders, ...receivers];
    const place = comment.actor.facilityName ?? (fromSender ? ref.fromFacilityName : fromReceiver ? ref.toFacilityName : 'District');
    return notify(audience, fakeEvent, ref, 'COMMENT', `${comment.actor.name} (${place}) on ${ref.patientName}: ${clip(comment.text, 80)}`, comment.actor.userId);
}

// ── the clock ────────────────────────────────────────────────────────────────

export interface SweepUpdate {
    referral: ReferralRecord;
    event: ReferralEvent;
    notifications: NotificationRecord[];
}

/**
 * Escalate unanswered Emergencies and release expired reservations.
 *
 * Run by every open app on an interval. Event ids are derived from the
 * referral and the moment being escalated, not random, so two devices running
 * the sweep at the same time produce the same event and the merge keeps one.
 */
export function sweepReferrals(
    referrals: readonly ReferralRecord[],
    now: number,
    directory: readonly StaffUser[],
    timing: { EMERGENCY_ACK_MINUTES: number; EMERGENCY_REALERT_MINUTES: number } = REFERRAL_TIMING,
    /** Appended to the timeline note — the simulation marks its fast clock this way. */
    timingNote?: string
): SweepUpdate[] {
    const at = new Date(now).toISOString();
    const updates: SweepUpdate[] = [];

    for (const ref of referrals) {
        if (ref.priority === 'EMERGENCY' && (ref.status === 'SENT' || ref.status === 'DELIVERED')) {
            const sent = lastEvent(ref, 'SEND');
            if (sent) {
                const minutes = (now - Date.parse(sent.at)) / 60_000;
                if (minutes >= timing.EMERGENCY_ACK_MINUTES) {
                    const due = Math.floor((minutes - timing.EMERGENCY_ACK_MINUTES) / timing.EMERGENCY_REALERT_MINUTES) + 1;
                    const current = ref.escalation?.sendEventId === sent.id ? ref.escalation.level : 0;
                    if (due > current) {
                        const result = applyAction(ref, {
                            action: 'EMERGENCY_ESCALATION',
                            actor: SYSTEM_ACTOR,
                            at,
                            eventId: `${ref.id}:escalate:${sent.id}:${due}`,
                            escalationLevel: due,
                            note: timingNote,
                        });
                        if (result.ok) {
                            updates.push({ referral: result.referral, event: result.event, notifications: notificationsFor(result.referral, result.event, directory) });
                            continue;
                        }
                    }
                }
            }
        }

        const r = ref.reservation;
        if (ref.status === 'ACCEPTED' && r && r.state === 'HELD' && Date.parse(r.expiresAt) <= now) {
            const result = applyAction(ref, {
                action: 'RESERVATION_EXPIRED',
                actor: SYSTEM_ACTOR,
                at,
                eventId: `${ref.id}:reservation-expired:${r.reservedAt}`,
            });
            if (result.ok) {
                updates.push({ referral: result.referral, event: result.event, notifications: notificationsFor(result.referral, result.event, directory) });
            }
        }
    }
    return updates;
}

// ── sync ─────────────────────────────────────────────────────────────────────

function unionById<T extends { id: string; at: string }>(a: readonly T[], b: readonly T[]): T[] {
    const map = new Map<string, T>();
    for (const item of [...a, ...b]) if (!map.has(item.id)) map.set(item.id, item);
    return [...map.values()].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}

const latestEventAt = (r: ReferralRecord) =>
    r.timeline.reduce((max, e) => Math.max(max, Date.parse(e.at) || 0), 0);

/**
 * Combine two copies of one referral — this device's and one from the mesh.
 *
 * Status and everything the status carries come from whichever copy has seen
 * the most recent lifecycle event. Timeline, comments and notes are unioned by
 * id, so a comment typed offline on one side is never lost to a status change
 * made on the other.
 */
export function mergeReferral(local: ReferralRecord | undefined, incoming: ReferralRecord): ReferralRecord {
    const theirs = normalizeReferral(incoming);
    if (!local) return theirs;
    const mine = normalizeReferral(local);
    const tl = latestEventAt(theirs), ml = latestEventAt(mine);
    const base = tl > ml || (tl === ml && theirs.timeline.length > mine.timeline.length) ? theirs : mine;
    const updatedAt = Date.parse(theirs.updatedAt) > Date.parse(mine.updatedAt) ? theirs.updatedAt : mine.updatedAt;
    return {
        ...base,
        updatedAt,
        timeline: unionById(mine.timeline, theirs.timeline),
        comments: unionById(mine.comments, theirs.comments),
        treatmentNotes: unionById(mine.treatmentNotes ?? [], theirs.treatmentNotes ?? []),
    };
}

/** Has the incoming copy anything this device does not already hold? */
export function isNewer(local: ReferralRecord | undefined, incoming: ReferralRecord): boolean {
    if (!local) return true;
    const ids = new Set([...local.timeline.map(e => e.id), ...local.comments.map(c => c.id), ...(local.treatmentNotes ?? []).map(n => n.id)]);
    return [...(incoming.timeline ?? []), ...(incoming.comments ?? []), ...(incoming.treatmentNotes ?? [])].some(x => !ids.has(x.id));
}

// ── records from before this lifecycle existed ───────────────────────────────

const LEGACY_STATUS: Record<string, ReferralStatus> = {
    INITIATED: 'SENT',
    ACCEPTED: 'ACCEPTED',
    IN_TRANSIT: 'ACCEPTED',
    COMPLETED: 'ADMITTED',
    REJECTED: 'REJECTED',
};

/** The step a rebuilt timeline ends on, for each status past SENT. */
const REBUILT_LAST_STEP: Partial<Record<ReferralStatus, ReferralAction>> = {
    DELIVERED: 'OPEN',
    ACKNOWLEDGED: 'ACKNOWLEDGE',
    ACCEPTED: 'ACCEPT',
    REJECTED: 'REJECT',
    PATIENT_ARRIVED: 'MARK_ARRIVED',
    ADMITTED: 'ADMIT',
    DISCHARGED: 'DISCHARGE',
};

// An abandoned development build stored events and comments in another shape
// (flat actorId / authorId, no actor object). Screens read `actor` directly, so
// such entries are recognised here rather than allowed through.
function isCurrentEvent(e: unknown): boolean {
    const ev = e as Partial<ReferralEvent> | null;
    return !!ev && typeof ev.id === 'string' && typeof ev.action === 'string' && typeof ev.toStatus === 'string'
        && typeof ev.at === 'string' && typeof ev.actor === 'object' && ev.actor !== null;
}
function isCurrentComment(c: unknown): boolean {
    const cm = c as Partial<ReferralComment> | null;
    return !!cm && typeof cm.id === 'string' && typeof cm.text === 'string' && typeof cm.actor === 'object' && cm.actor !== null;
}

/**
 * Bring any referral — one written before the lifecycle rework, or one from an
 * older device on the mesh — into the current shape.
 *
 * Old statuses map to the nearest new one (IN_TRANSIT becomes ACCEPTED with a
 * dispatch time; COMPLETED, which the old board labelled "Completed &
 * Admitted", becomes ADMITTED). The timeline is reconstructed from the
 * timestamps the old record did keep, and says so: the steps between were
 * never captured, and the timeline must not pretend they were.
 */
export function normalizeReferral(raw: ReferralRecord): ReferralRecord {
    // A device that has not upgraded yet may still name a retired facility id.
    const r = remapRetiredFacilityIds(raw);
    // Read as a plain string: records from older devices carry statuses this
    // build's type no longer has (INITIATED, IN_TRANSIT, COMPLETED).
    const rawStatus = String((r as { status: unknown }).status);
    const status: ReferralStatus = (LEGACY_STATUS[rawStatus] && !['ACCEPTED', 'REJECTED'].includes(rawStatus))
        ? LEGACY_STATUS[rawStatus]
        : (rawStatus as ReferralStatus);
    const referredAt = new Date(r.referredAt ?? Date.now()).toISOString();
    const updatedAt = r.updatedAt ?? (r.lastUpdatedAt ? new Date(r.lastUpdatedAt).toISOString() : referredAt);
    const storedTimeline: unknown[] = Array.isArray(r.timeline) ? r.timeline : [];
    const storedComments: unknown[] = Array.isArray(r.comments) ? r.comments : [];
    const comments = storedComments.filter(isCurrentComment) as ReferralComment[];
    const unreadable = !storedTimeline.every(isCurrentEvent) || comments.length < storedComments.length;

    if (storedTimeline.length > 0 && !unreadable && status === rawStatus) {
        return { ...r, status, updatedAt, comments };
    }

    const legacyActor: ReferralActor = {
        userId: 'legacy',
        name: r.referredBy || 'Unknown',
        role: 'SYSTEM',
        facilityId: r.fromFacilityId,
        facilityName: r.fromFacilityName,
    };
    const timeline: ReferralEvent[] = [
        { id: `${r.id}:legacy:create`, action: 'CREATE', fromStatus: null, toStatus: 'CREATED', at: referredAt, actor: legacyActor },
    ];
    // A referral still CREATED was never sent; its timeline must not say it was.
    if (status !== 'CREATED') {
        timeline.push({ id: `${r.id}:legacy:send`, action: 'SEND', fromStatus: 'CREATED', toStatus: 'SENT', at: referredAt, actor: legacyActor });
    }
    const action = REBUILT_LAST_STEP[status];
    if (action) {
        const at = new Date(r.completedAt ?? r.lastUpdatedAt ?? r.inTransitAt ?? referredAt).toISOString();
        timeline.push({
            id: `${r.id}:legacy:${action.toLowerCase()}`,
            action,
            fromStatus: 'SENT',
            toStatus: status,
            at,
            actor: { ...legacyActor, facilityId: r.toFacilityId, facilityName: r.toFacilityName },
            note: 'Recorded before the referral timeline existed — the steps in between were not captured.',
        });
    }
    if (unreadable) {
        const last = timeline.length - 1;
        timeline[last] = {
            ...timeline[last],
            note: 'Rebuilt from a record a development build wrote in another format — its earlier steps and comments could not be read.',
        };
    }

    return {
        ...r,
        status,
        updatedAt,
        timeline,
        comments,
        ...(rawStatus === 'IN_TRANSIT' && !r.inTransitAt ? { inTransitAt: updatedAt } : {}),
        ...(status === 'REJECTED' && !r.rejection
            ? {
                rejection: {
                    code: 'OTHER' as const,
                    detail: 'Recorded before rejection reasons were required',
                    at: updatedAt,
                    byName: 'Unknown',
                    facilityId: r.toFacilityId,
                    facilityName: r.toFacilityName,
                },
            }
            : {}),
    };
}

// ── relay-side checking ──────────────────────────────────────────────────────

/**
 * Check lifecycle events another device published. Used by the mesh relay,
 * so an event forged with a role that lacks the right — an ANM "accepting" her
 * own referral — is refused at the network rather than landing on every peer.
 *
 * `known` is the relay's last copy, or undefined if it has none; then only the
 * newest event is judged, since older history may predate the relay's cache.
 */
export function verifyPublishedReferral(known: ReferralRecord | undefined, published: ReferralRecord): { ok: true } | Refusal {
    const ref = normalizeReferral(published);
    if (!ref.timeline.length) return refuse('INVALID', 'Referral has no timeline');
    const knownIds = new Set(known?.timeline.map(e => e.id) ?? []);
    const fresh = known ? ref.timeline.filter(e => !knownIds.has(e.id)) : ref.timeline.slice(-1);

    for (const event of fresh) {
        if (event.actor.userId === 'legacy') continue;
        const rule = ACTION_RULES[event.action];
        if (!rule) return refuse('INVALID', `Unknown action ${event.action}`);
        if (event.actor.role === 'SYSTEM') {
            if (!SYSTEM_MAY.includes(event.action)) return refuse('FORBIDDEN', `${event.action} cannot be automatic`);
            continue;
        }
        if (!rule.permission || !can(event.actor.role as StaffRole, rule.permission)) {
            return refuse('FORBIDDEN', `${event.actor.role} may not ${ACTION_LABELS[event.action].toLowerCase()}`);
        }
        const fid = event.actor.facilityId;
        const receiverSide = fid === ref.toFacilityId || Boolean(ref.routeHistory?.some(h => h.facilityId === fid));
        const sideOk = rule.side === 'SENDER' ? fid === ref.fromFacilityId : receiverSide;
        if (!sideOk) return refuse('WRONG_FACILITY', `${event.actor.name} is not at the facility that may ${ACTION_LABELS[event.action].toLowerCase()}`);
        if (event.fromStatus !== null && !rule.from.includes(event.fromStatus)) {
            return refuse('ILLEGAL_TRANSITION', `${event.action} from ${event.fromStatus} is not allowed`);
        }
    }

    const knownComments = new Set(known?.comments.map(c => c.id) ?? []);
    for (const c of ref.comments.filter(c => !knownComments.has(c.id))) {
        if (c.actor.role === 'SYSTEM' || !can(c.actor.role as StaffRole, 'referral:comment')) {
            return refuse('FORBIDDEN', `${c.actor.role} may not comment on referrals`);
        }
    }
    return { ok: true };
}
