/**
 * Triage Result Component - Modern Medcare
 * Clear status display with AI confidence gauge & professional typography
 */

'use client';

import { motion } from 'framer-motion';
import { TriageStatus } from '@/types/patient';

interface TriageResultProps {
    status: TriageStatus;
    reasoning: string;
    confidence?: number;
    onSave: () => void;
    onRelay?: () => void;
    onEdit: () => void;
    onFallback?: () => void;
}

export default function TriageResult({
    status,
    reasoning,
    confidence = 0.90,
    onSave,
    onRelay,
    onEdit,
    onFallback,
}: TriageResultProps) {
    const statusConfig = {
        RED: {
            bg: 'bg-status-red-bg',
            text: 'text-status-red',
            border: 'border-status-red',
            label: 'CRITICAL',
            color: '#E53E3E',
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
        },
        YELLOW: {
            bg: 'bg-status-yellow-bg',
            text: 'text-status-yellow',
            border: 'border-status-yellow',
            label: 'URGENT',
            color: '#D69E2E',
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        GREEN: {
            bg: 'bg-status-green-bg',
            text: 'text-status-green',
            border: 'border-status-green',
            label: 'STABLE',
            color: '#38A169',
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    };

    const config = statusConfig[status];
    const confPercent = Math.round(confidence * 100);

    // SVG arc for confidence gauge
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - confidence);

    return (
        <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
        >
            {/* Status Card with Confidence Gauge */}
            <div className={`${config.bg} border-2 ${config.border} rounded-2xl p-8 relative overflow-hidden`}>
                <div className="relative z-10 flex items-center gap-8">
                    {/* Left: Status */}
                    <div className="flex-1 text-center md:text-left">
                        <div className={`${config.text} mb-4`}>{config.icon}</div>
                        <h2 className={`text-3xl font-bold ${config.text} mb-2 tracking-tight`}>{config.label} PRIORITY</h2>
                        <p className="text-txt-secondary font-medium">
                            {status === 'RED' ? 'Immediate life-saving intervention required' :
                             status === 'YELLOW' ? 'Urgent attention — observation needed' :
                             'Patient is hemodynamically stable'}
                        </p>
                    </div>

                    {/* Right: Confidence Gauge */}
                    <div className="hidden md:flex flex-col items-center shrink-0">
                        <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                            {/* Background circle */}
                            <circle
                                cx="50" cy="50" r={radius}
                                fill="none"
                                stroke="currentColor"
                                className="text-gray-200"
                                strokeWidth="8"
                            />
                            {/* Progress arc */}
                            <motion.circle
                                cx="50" cy="50" r={radius}
                                fill="none"
                                stroke={config.color}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: dashOffset }}
                                transition={{ duration: 1.5, ease: 'easeOut' }}
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: '25px' }}>
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className={`text-2xl font-bold ${config.text}`}
                            >
                                {confPercent}%
                            </motion.span>
                        </div>
                        <span className="text-[10px] font-bold text-txt-muted uppercase mt-1 tracking-wider">Confidence</span>
                    </div>
                </div>

                {/* Mobile confidence bar */}
                <div className="md:hidden mt-4">
                    <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-txt-muted">Confidence</span>
                        <span className={config.text}>{confPercent}%</span>
                    </div>
                    <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${confPercent}%` }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: config.color }}
                        />
                    </div>
                </div>
            </div>

            {/* AI Analysis */}
            <div className="surface-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 bg-teal-accent rounded-full" />
                    <h3 className="font-bold text-emerald-deep">Assessment</h3>
                    <span className="ml-auto text-[10px] font-bold text-txt-muted bg-gray-100 px-2 py-0.5 rounded-full">
                        On-device • &lt;50ms
                    </span>
                </div>
                <p className="text-txt-primary leading-relaxed text-sm bg-bg-page p-4 rounded-lg border border-border-subtle">
                    {reasoning}
                </p>
            </div>

            {/* Actions */}
            <div className="grid gap-3">
                <button
                    onClick={onSave}
                    className="w-full py-3.5 bg-emerald-deep text-white font-bold rounded-xl hover:bg-emerald-800 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save & Sync Record
                </button>

                <div className="grid grid-cols-2 gap-3">
                    {onRelay && (
                        <button
                            onClick={onRelay}
                            className="py-3.5 bg-white border border-teal-accent text-teal-accent font-bold rounded-xl hover:bg-teal-50 transition-all"
                        >
                            Relay Mesh
                        </button>
                    )}
                    <button
                        onClick={onEdit}
                        className="py-3.5 bg-white border border-border-active text-txt-secondary font-bold rounded-xl hover:bg-gray-50 transition-all"
                    >
                        Edit Vitals
                    </button>
                    <button
                        onClick={onFallback}
                        className="col-span-2 py-3.5 bg-status-yellow text-yellow-900 font-bold rounded-xl shadow-sm hover:bg-yellow-400 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                        </svg>
                        Send via SMS (Offline)
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
