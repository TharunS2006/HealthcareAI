/**
 * Referral lifecycle between facilities — statuses, the timeline, comments,
 * notifications and bed reservations.
 *
 *   CREATED → SENT → DELIVERED → ACKNOWLEDGED → ACCEPTED / REJECTED
 *           → PATIENT_ARRIVED → ADMITTED → DISCHARGED
 *
 * The record lives in types/patient.ts (ReferralRecord) because a dozen screens
 * already import it from there; the pieces it is built from live here. The
 * rules that move a referral between these states are in
 * lib/referrals/workflow.ts, and nowhere else.
 */

import type { StaffRole } from '@/lib/auth/permissions';
import type { WardType } from './resources';

export type ReferralStatus =
    | 'CREATED'          // saved on the referring device, not yet on the network
    | 'SENT'             // accepted by the network (relay, or a peer at the receiving facility)
    | 'DELIVERED'        // opened by a user at the receiving facility
    | 'ACKNOWLEDGED'     // receiver has confirmed they are handling it
    | 'ACCEPTED'         // receiver will take the patient (bed held if one was free)
    | 'REJECTED'         // receiver declined, with a reason; sender may re-route
    | 'PATIENT_ARRIVED'
    | 'ADMITTED'
    | 'DISCHARGED';

export const REFERRAL_STATUSES: readonly ReferralStatus[] = [
    'CREATED',
    'SENT',
    'DELIVERED',
    'ACKNOWLEDGED',
    'ACCEPTED',
    'REJECTED',
    'PATIENT_ARRIVED',
    'ADMITTED',
    'DISCHARGED',
];

export type ReferralAction =
    | 'CREATE'
    | 'SEND'
    | 'OPEN'                 // receiver opened it → DELIVERED
    | 'ACKNOWLEDGE'
    | 'ACCEPT'
    | 'REJECT'
    | 'REROUTE'              // sender re-targets a rejected referral → CREATED, then sent again
    | 'DISPATCH'             // sender puts the patient in transport (status unchanged)
    | 'RESERVE_BED'          // receiver holds a bed again after one expired
    | 'MARK_ARRIVED'
    | 'ADMIT'
    | 'DISCHARGE'
    | 'ESCALATE_ONWARD'      // MO raises a follow-on referral to CHC / DH
    | 'TREATMENT_NOTE'
    | 'EMERGENCY_ESCALATION' // system: an Emergency went unacknowledged too long
    | 'RESERVATION_EXPIRED'; // system: a held bed was released

/** Who did it. SYSTEM is the escalation / expiry clock and 108 dispatch. */
export interface ReferralActor {
    userId: string;
    name: string;
    role: StaffRole | 'SYSTEM';
    facilityId: string | null;
    facilityName?: string;
}

export interface ReferralEvent {
    /** Deterministic for system events, so two devices sweeping at once collapse to one. */
    id: string;
    action: ReferralAction;
    fromStatus: ReferralStatus | null;
    toStatus: ReferralStatus;
    at: string;
    actor: ReferralActor;
    note?: string;
}

export interface ReferralComment {
    id: string;
    at: string;
    actor: ReferralActor;
    text: string;
}

export interface TreatmentNote {
    id: string;
    at: string;
    actor: ReferralActor;
    text: string;
}

export type RejectReasonCode = 'NO_BED' | 'EQUIPMENT_MAINTENANCE' | 'SPECIALIST_UNAVAILABLE' | 'OTHER';

export const REJECT_REASON_LABELS: Record<RejectReasonCode, string> = {
    NO_BED: 'No bed available',
    EQUIPMENT_MAINTENANCE: 'Equipment under maintenance',
    SPECIALIST_UNAVAILABLE: 'Specialist unavailable',
    OTHER: 'Other',
};

export interface ReferralRejection {
    code: RejectReasonCode;
    detail?: string;
    at: string;
    byName: string;
    facilityId: string;
    facilityName: string;
}

/** A facility that declined this referral before it was re-routed. */
export interface RouteHistoryEntry {
    facilityId: string;
    facilityName: string;
    rejectedAt: string;
    code: RejectReasonCode;
    detail?: string;
}

export type ReservationState = 'HELD' | 'OCCUPIED' | 'RELEASED';

export interface BedReservation {
    facilityId: string;
    ward: WardType;
    /** Human label for the handover, e.g. "Maternity — bed held (1 of 3 free)". */
    label: string;
    reservedAt: string;
    /** After this, an un-arrived patient's bed goes back to the pool. */
    expiresAt: string;
    state: ReservationState;
    releasedAt?: string;
    releaseReason?: 'EXPIRED' | 'DISCHARGED' | 'REJECTED';
    handoverInstructions: string;
}

export interface CapacityOverride {
    reason: string;
    byName: string;
    at: string;
}

export interface EmergencyEscalation {
    /** 1 = first alert to the DHO; each later sweep past the interval re-notifies. */
    level: number;
    firstAt: string;
    lastAt: string;
    /** The SEND this escalation counts from. A re-route sends again and starts a fresh clock. */
    sendEventId: string;
}

export type NotificationType =
    | 'REFERRAL_RECEIVED'
    | 'REFERRAL_SEEN'
    | 'REFERRAL_ACKNOWLEDGED'
    | 'REFERRAL_ACCEPTED'
    | 'REFERRAL_REJECTED'
    | 'REFERRAL_REROUTED'
    | 'PATIENT_DISPATCHED'
    | 'BED_RESERVED'
    | 'PATIENT_ARRIVED'
    | 'PATIENT_ADMITTED'
    | 'PATIENT_DISCHARGED'
    | 'ONWARD_REFERRAL'
    | 'COMMENT'
    | 'EMERGENCY_REMINDER'
    | 'EMERGENCY_ESCALATION'
    | 'RESERVATION_EXPIRED';

/**
 * One row of the notifications table. Field names follow the table as
 * specified (snake_case) so the row maps onto a SQL `notifications` table
 * one-to-one when a real backend replaces IndexedDB.
 */
export interface NotificationRecord {
    id: string;
    recipient_user_id: string;
    facility_id: string | null;
    referral_id: string;
    type: NotificationType;
    message: string;
    is_read: boolean;
    created_at: string;
    /** Emergency notifications may sound; the rest never do. */
    priority: 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE';
}
