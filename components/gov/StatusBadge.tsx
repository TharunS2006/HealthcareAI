/**
 * StatusBadge — Enum-driven status badges with accessible text + color
 * Color is NEVER the only signal (GIGW/WCAG requirement).
 */

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    // Queue
    WAITING: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    CALLED: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    SERVED: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    NO_SHOW: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
    // Referral
    REFERRED: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    ACKNOWLEDGED: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    PATIENT_TRAVELING: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
    REACHED: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
    CONSULTED: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    COMPLETED: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    // Diagnostics
    ORDERED: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    SAMPLE_COLLECTED: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    PROCESSING: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    IN_PROGRESS: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    RESULT_READY: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
    DELIVERED: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    // Stock
    AVAILABLE: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    LOW_STOCK: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    OUT_OF_STOCK: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    // Follow-up
    DUE: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    OVERDUE: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    SKIPPED: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    // Triage
    ROUTINE: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    PRIORITY: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    EMERGENCY: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    // Generic
    ACTIVE: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
    INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
};

const DEFAULT_STYLE = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const style = STATUS_STYLES[status] || DEFAULT_STYLE;
    const label = status.replace(/_/g, ' ');

    return (
        <span
            className={`inline-flex items-center font-bold rounded-full border ${style.bg} ${style.text} ${style.border} ${
                size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'
            }`}
            role="status"
        >
            {label}
        </span>
    );
}
