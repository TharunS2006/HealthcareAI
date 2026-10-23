import type { NotificationType } from '@/types/referral';

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
    REFERRAL_RECEIVED: 'New referral',
    REFERRAL_SEEN: 'Seen by receiver',
    REFERRAL_ACKNOWLEDGED: 'Acknowledged',
    REFERRAL_ACCEPTED: 'Accepted',
    REFERRAL_REJECTED: 'Rejected',
    REFERRAL_REROUTED: 'Re-routed',
    PATIENT_DISPATCHED: 'Patient dispatched',
    BED_RESERVED: 'Bed reserved',
    PATIENT_ARRIVED: 'Patient arrived',
    PATIENT_ADMITTED: 'Admitted',
    PATIENT_DISCHARGED: 'Discharged',
    ONWARD_REFERRAL: 'Escalated onward',
    COMMENT: 'Comment',
    EMERGENCY_REMINDER: 'Unacknowledged emergency',
    EMERGENCY_ESCALATION: 'Escalation',
    RESERVATION_EXPIRED: 'Bed released',
};

/** Colour carries meaning here only alongside the text label (GIGW). */
export function notificationTone(type: NotificationType): string {
    switch (type) {
        case 'EMERGENCY_REMINDER':
        case 'EMERGENCY_ESCALATION':
        case 'REFERRAL_REJECTED':
            return 'bg-red-50 text-red-800 border-red-300';
        case 'RESERVATION_EXPIRED':
            return 'bg-amber-50 text-amber-900 border-amber-300';
        case 'REFERRAL_ACCEPTED':
        case 'BED_RESERVED':
        case 'PATIENT_ADMITTED':
        case 'PATIENT_ARRIVED':
            return 'bg-emerald-50 text-emerald-800 border-emerald-300';
        case 'REFERRAL_RECEIVED':
            return 'bg-blue-50 text-blue-800 border-blue-300';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-300';
    }
}
