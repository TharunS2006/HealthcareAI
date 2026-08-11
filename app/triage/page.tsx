/**
 * Triage Station - Modern Medcare
 * AI-Assist diagnostic interface with real GPS & confidence scoring
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Vitals, TriageStatus, GPSLocation } from '@/types/patient';
import { usePatientStore } from '@/stores/patientStore';
import Sidebar from '@/components/shared/Sidebar';
import VitalsForm from '@/components/triage/VitalsForm';
import TriageResult from '@/components/triage/TriageResult';
import SMSFallback from '@/components/shared/SMSFallback';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import { classifyTriage } from '@/lib/triage/model';

export default function TriagePage() {
    const { addPatient } = usePatientStore();
    const [step, setStep] = useState<'form' | 'processing' | 'result'>('form');
    const [currentVitals, setCurrentVitals] = useState<Vitals | null>(null);
    const [result, setResult] = useState<{ status: TriageStatus; reasoning: string; confidence: number; modelUsed?: string } | null>(null);
    const [showSMSModal, setShowSMSModal] = useState(false);
    const [gps, setGps] = useState<GPSLocation>({ lat: 13.0827, lng: 80.2707 }); // Default: Chennai
    const [gpsStatus, setGpsStatus] = useState<'pending' | 'acquired' | 'denied'>('pending');

    // Acquire real GPS on mount
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                    setGpsStatus('acquired');
                },
                () => {
                    setGpsStatus('denied');
                    toast('GPS unavailable — using default location', { icon: '📍' });
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

    const handleAnalysis = async (vitals: Vitals) => {
        setStep('processing');
        setCurrentVitals(vitals);

        try {
            const analysis = await classifyTriage(vitals);
            setResult(analysis);
            setStep('result');
        } catch (error) {
            toast.error('AI Analysis Failed');
            setStep('form');
        }
    };

    const handleSave = async () => {
        if (!currentVitals || !result) return;

        const newPatient: Patient = {
            id: uuidv4(),
            vitals: currentVitals,
            triageStatus: result.status as 'RED' | 'YELLOW' | 'GREEN',
            gps,
            timestamp: new Date(),
            isSynced: false,
        };

        await addPatient(newPatient);
        toast.success('Patient Record Saved & Synced');

        // Play alert sound for RED patients
        if (result.status === 'RED') {
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1bW2NtdH+MmJmNfnF0e4eLjId+d3N1fIaRlpKIe3R0eYOOk5KNhXl0dXuFj5STjoJ4dHZ8hpCUk42BeHR2fIaQlJONgXh0dnyGkJSTjYF4dHZ8hpCUk42BeHR2fIaQlJON');
                audio.volume = 0.3;
                audio.play().catch(() => {});
            } catch { /* silent */ }
        }

        // Reset
        setStep('form');
        setCurrentVitals(null);
        setResult(null);
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-8 overflow-y-auto h-screen relative">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-accent/5 rounded-full blur-3xl -z-10" />

                <div className="max-w-5xl mx-auto">
                    <header className="mb-8 flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-3 text-emerald-deep mb-2">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight">New Patient Entry</h1>
                            </div>
                            <p className="text-txt-secondary text-sm ml-14">
                                Step 1: Manual Vitals & AI Analysis
                            </p>
                        </div>
                        {/* GPS Status Badge */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            gpsStatus === 'acquired' ? 'bg-green-50 text-green-700 border-green-200' :
                            gpsStatus === 'denied' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                gpsStatus === 'acquired' ? 'bg-green-500' :
                                gpsStatus === 'denied' ? 'bg-yellow-500' :
                                'bg-blue-500 animate-pulse'
                            }`} />
                            {gpsStatus === 'acquired' ? `📍 ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` :
                             gpsStatus === 'denied' ? '📍 Default GPS' : '📍 Acquiring...'}
                        </div>
                    </header>

                    <div className="grid lg:grid-cols-3 gap-8 items-start">
                        {/* Main Form Area */}
                        <div className="lg:col-span-2">
                            <AnimatePresence mode="wait">
                                {step === 'form' && (
                                    <motion.div
                                        key="form"
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.02 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <VitalsForm onSubmit={handleAnalysis} />
                                    </motion.div>
                                )}

                                {step === 'processing' && (
                                    <motion.div
                                        key="processing"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="surface-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center"
                                    >
                                        <div className="relative w-28 h-28 mb-8">
                                            <div className="absolute inset-0 border-[3px] border-emerald-100 rounded-full" />
                                            <div className="absolute inset-0 border-[3px] border-emerald-500 rounded-full border-t-transparent animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <svg className="w-10 h-10 text-emerald-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-emerald-deep mb-2">Analyzing Vitals</h3>
                                        <p className="text-txt-secondary text-sm">Running on-device triage classification...</p>
                                    </motion.div>
                                )}

                                {step === 'result' && result && (
                                    <motion.div
                                        key="result"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="surface-card p-8 bg-white shadow-card border-t-4 border-emerald-500"
                                    >
                                        <TriageResult
                                            status={result.status}
                                            reasoning={result.reasoning}
                                            confidence={result.confidence}
                                            onSave={handleSave}
                                            onEdit={() => setStep('form')}
                                            onFallback={() => setShowSMSModal(true)}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Recent History / Context (Right Sidebar) */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="hidden lg:block space-y-6"
                        >
                            <div className="surface-card p-6 bg-white/80 backdrop-blur">
                                <h3 className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide border-b border-border-subtle pb-2">
                                    Triage Protocols v2.4
                                </h3>
                                <div className="space-y-4 text-sm text-txt-secondary">
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-100/50">
                                        <strong className="block text-red-800 mb-1">🔴 RED (Critical)</strong>
                                        Shock, Airway Compromise, Unresponsive (U), SpO2 &lt; 90%.
                                    </div>
                                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100/50">
                                        <strong className="block text-yellow-800 mb-1">🟡 YELLOW (Urgent)</strong>
                                        SpO2 90-94%, Voice Response (V).
                                    </div>
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-100/50">
                                        <strong className="block text-green-800 mb-1">🟢 GREEN (Stable)</strong>
                                        Walking wounded, Alert (A), minor injuries.
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            <SMSFallback
                isOpen={showSMSModal}
                onClose={() => setShowSMSModal(false)}
                patient={result && currentVitals ? {
                    id: 'temp',
                    vitals: currentVitals,
                    triageStatus: result.status,
                    gps: { lat: 13.08, lng: 80.27 }, // Mock for fallback preview
                    timestamp: new Date(),
                    isSynced: false
                } : null}
            />
        </div>
    );
}
