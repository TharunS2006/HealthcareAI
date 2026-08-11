/**
 * Vitals entry form component - Modern Medcare
 * Advanced Triage Interface with Voice Input, Glassmorphism & Micro-animations
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vitals } from '@/types/patient';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';

interface VitalsFormProps {
    onSubmit: (vitals: Vitals) => void;
    onVoiceInput?: () => void;
}

export default function VitalsForm({ onSubmit, onVoiceInput }: VitalsFormProps) {
    const [vitals, setVitals] = useState<Vitals>({
        spo2: 95,
        heartRate: 80, // Displayed as Pulse Rate
        bloodPressure: { systolic: 120, diastolic: 80 },
        consciousness: 'ALERT',
        injuryType: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);

    const voice = useVoiceInput();

    // Apply parsed voice vitals to form
    useEffect(() => {
        if (!voice.parsedVitals) return;
        const p = voice.parsedVitals;

        setVitals(prev => ({
            ...prev,
            ...(p.spo2 !== undefined && { spo2: p.spo2 }),
            ...(p.heartRate !== undefined && { heartRate: p.heartRate }),
            ...(p.systolic !== undefined && p.diastolic !== undefined && {
                bloodPressure: { systolic: p.systolic, diastolic: p.diastolic }
            }),
            ...(p.consciousness && { consciousness: p.consciousness }),
            ...(p.injuryType && { injuryType: p.injuryType }),
        }));
    }, [voice.parsedVitals]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (vitals.spo2 < 0 || vitals.spo2 > 100) newErrors.spo2 = 'Invalid SpO2';
        if (vitals.heartRate < 20 || vitals.heartRate > 250) newErrors.heartRate = 'Invalid Pulse';
        if (!vitals.injuryType.trim()) newErrors.injuryType = 'Required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) onSubmit(vitals);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08 }
        }
    };

    const itemVariants = {
        hidden: { y: 15, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 120 }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 relative">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
            >
                {/* Section 1: Core Vitals */}
                <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-8">
                    {/* SpO2 */}
                    <div className="surface-card p-6 border-l-4 border-l-teal-accent relative overflow-hidden group">
                        <div className="absolute top-3 right-4 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
                            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <label className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide flex justify-between">
                            Oxygen Saturation (SpO2)
                            <span className="text-xs text-txt-muted bg-white px-2 py-0.5 rounded-full border font-medium normal-case tracking-normal">Normal: 95-100%</span>
                        </label>
                        <div className="flex items-center gap-6 relative z-10">
                            <input
                                type="range"
                                min="60"
                                max="100"
                                value={vitals.spo2}
                                onChange={(e) => setVitals({ ...vitals, spo2: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-accent"
                            />
                            <div className={`text-4xl font-bold font-mono w-24 text-right transition-colors ${vitals.spo2 < 90 ? 'text-status-red' : 'text-emerald-deep'}`}>
                                {vitals.spo2}%
                            </div>
                        </div>
                    </div>

                    {/* Pulse Rate */}
                    <div className="surface-card p-6 border-l-4 border-l-status-red relative overflow-hidden group">
                        <div className="absolute top-3 right-4 opacity-[0.06] group-hover:opacity-[0.10] transition-opacity">
                            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2l3-9 4 18 3-9h2" />
                            </svg>
                        </div>
                        <label className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide flex justify-between">
                            Pulse Rate (BPM)
                            <span className="text-xs text-txt-muted bg-white px-2 py-0.5 rounded-full border font-medium normal-case tracking-normal">Normal: 60-100</span>
                        </label>
                        <div className="flex items-center gap-6 relative z-10">
                            <input
                                type="range"
                                min="30"
                                max="200"
                                value={vitals.heartRate}
                                onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-status-red"
                            />
                            <div className={`text-4xl font-bold font-mono w-24 text-right transition-colors ${vitals.heartRate > 100 || vitals.heartRate < 50 ? 'text-status-yellow' : 'text-emerald-deep'}`}>
                                {vitals.heartRate}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Section 2: Blood Pressure & Consciousness */}
                <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-8">
                    {/* Blood Pressure */}
                    <div className="surface-card p-6 border-l-4 border-l-indigo-400">
                        <label className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide">
                            Blood Pressure (mmHg)
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <span className="text-xs text-txt-muted mb-1 block">Systolic</span>
                                <input
                                    type="number"
                                    value={vitals.bloodPressure?.systolic}
                                    onChange={(e) => setVitals({ ...vitals, bloodPressure: { ...vitals.bloodPressure!, systolic: parseInt(e.target.value) } })}
                                    className="w-full text-2xl font-mono font-bold text-center p-3 bg-white border border-border-active rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
                                />
                            </div>
                            <span className="text-2xl text-txt-muted font-light">/</span>
                            <div className="flex-1">
                                <span className="text-xs text-txt-muted mb-1 block">Diastolic</span>
                                <input
                                    type="number"
                                    value={vitals.bloodPressure?.diastolic}
                                    onChange={(e) => setVitals({ ...vitals, bloodPressure: { ...vitals.bloodPressure!, diastolic: parseInt(e.target.value) } })}
                                    className="w-full text-2xl font-mono font-bold text-center p-3 bg-white border border-border-active rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Consciousness (AVPU) */}
                    <div className="surface-card p-6 border-t-4 border-t-purple-400">
                        <label className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide">
                            Consciousness (AVPU)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'].map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setVitals({ ...vitals, consciousness: status as any })}
                                    className={`p-3 rounded-xl font-bold text-sm transition-all border-2 ${vitals.consciousness === status
                                            ? 'bg-emerald-deep text-white border-emerald-deep shadow-lg scale-[1.03]'
                                            : 'bg-white text-txt-secondary border-border-subtle hover:border-emerald-200'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Section 3: Clinical Notes */}
                <motion.div variants={itemVariants} className="space-y-3">
                    <label className="text-sm font-bold text-emerald-deep uppercase tracking-wide">
                        Clinical Notes / Pattern
                    </label>
                    <div className="relative group">
                        <textarea
                            value={vitals.injuryType}
                            onChange={(e) => setVitals({ ...vitals, injuryType: e.target.value })}
                            onFocus={() => setFocusedField('notes')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="Describe injury mechanism, visible wounds, or patient complaints..."
                            rows={3}
                            className={`w-full px-6 py-4 bg-white border-2 rounded-2xl text-txt-primary focus:outline-none transition-all resize-none shadow-sm ${focusedField === 'notes'
                                    ? 'border-teal-accent ring-4 ring-teal-accent/10 shadow-lg'
                                    : 'border-border-subtle'
                                }`}
                        />
                        {onVoiceInput && (
                            <button
                                type="button"
                                onClick={onVoiceInput}
                                className="absolute right-4 bottom-4 p-2 text-white bg-teal-accent rounded-full shadow-lg hover:scale-110 transition-transform"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {errors.injuryType && <p className="text-status-red text-sm font-semibold">{errors.injuryType}</p>}
                </motion.div>

                {/* Submit Action */}
                <motion.button
                    variants={itemVariants}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    className="w-full py-4 bg-emerald-deep text-white text-base font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-emerald-dark transition-all flex items-center justify-center gap-2.5 tracking-wide"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Run Triage Analysis</span>
                </motion.button>
            </motion.div>
        </form>
    );
}
