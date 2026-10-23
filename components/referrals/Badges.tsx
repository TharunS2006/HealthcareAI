/**
 * Status and urgency labels for referrals. Colour always travels with text —
 * never the only signal (GIGW / WCAG).
 */

import type { ReferralStatus } from '@/types/referral';
import type { TriagePriority } from '@/types/patient';
import { STATUS_LABELS } from '@/lib/referrals/workflow';

const STATUS_TONE: Record<ReferralStatus, string> = {
    CREATED: 'bg-amber-50 text-amber-900 border-amber-400',
    SENT: 'bg-blue-50 text-blue-800 border-blue-300',
    DELIVERED: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    ACKNOWLEDGED: 'bg-cyan-50 text-cyan-900 border-cyan-300',
    ACCEPTED: 'bg-teal-50 text-teal-800 border-teal-300',
    REJECTED: 'bg-red-50 text-red-800 border-red-300',
    PATIENT_ARRIVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    ADMITTED: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    DISCHARGED: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function StatusBadge({ status }: { status: ReferralStatus }) {
    return (
        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 border rounded whitespace-nowrap ${STATUS_TONE[status]}`}>
            {STATUS_LABELS[status]}
        </span>
    );
}

const PRIORITY_TONE: Record<TriagePriority, string> = {
    EMERGENCY: 'bg-red-600 text-white border-red-700',
    URGENT: 'bg-amber-100 text-amber-900 border-amber-400',
    SEMI_URGENT: 'bg-yellow-50 text-yellow-900 border-yellow-300',
    ROUTINE: 'bg-green-50 text-green-800 border-green-300',
};

const PRIORITY_LABEL: Record<TriagePriority, string> = {
    EMERGENCY: 'Emergency',
    URGENT: 'Urgent',
    SEMI_URGENT: 'Semi-urgent',
    ROUTINE: 'Routine',
};

export function PriorityBadge({ priority }: { priority: TriagePriority }) {
    return (
        <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 border rounded uppercase tracking-wide whitespace-nowrap ${PRIORITY_TONE[priority]}`}>
            {PRIORITY_LABEL[priority]}
        </span>
    );
}

/** OK / SHORT / UNKNOWN as a mark and a word. */
export function CheckMark({ state }: { state: 'OK' | 'SHORT' | 'UNKNOWN' }) {
    const style =
        state === 'OK'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
            : state === 'SHORT'
            ? 'bg-red-50 text-red-800 border-red-400'
            : 'bg-slate-100 text-slate-700 border-slate-300';
    const text = state === 'OK' ? '✓ Available' : state === 'SHORT' ? '✗ Short' : '? Not reported';
    return <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 border rounded whitespace-nowrap ${style}`}>{text}</span>;
}
