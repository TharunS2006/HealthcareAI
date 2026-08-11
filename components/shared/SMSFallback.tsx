/**
 * SMS Fallback Modal
 * Activated when offline or mesh unavailable
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient } from '@/types/patient';
import { generateSMSLink } from '@/lib/sms/fallback';
import toast from 'react-hot-toast';

interface SMSFallbackProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient | null;
}

export default function SMSFallback({ isOpen, onClose, patient }: SMSFallbackProps) {
    const [sending, setSending] = useState(false);

    if (!isOpen || !patient) return null;

    const handleSend = () => {
        setSending(true);
        // Simulate "Sending" delay
        setTimeout(() => {
            // Mock sending - just show success message
            toast.success('SMS Sent Successfully (Simulated)');
            setSending(false);
            onClose();
        }, 1500);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-8 border-status-yellow relative overflow-hidden"
                >
                    {/* Background Animation */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl -z-10 animate-pulse" />

                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M12 9v4m-7.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Connection Failed</h3>
                            <p className="text-sm text-gray-500">Internet & Mesh Unreachable</p>
                        </div>
                    </div>

                    <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                        Critical patient data cannot be synced.
                        <strong className="block mt-2 text-status-yellow">Switching to GSM/SMS Fallback Protocol.</strong>
                    </p>

                    <div className="bg-gray-100 p-4 rounded-lg mb-6 font-mono text-xs text-gray-600 break-all border border-gray-200">
                        {patient.triageStatus === 'RED' ? '🔴' : '🟡'} NALAM:{patient.triageStatus}-{patient.gps.lat.toFixed(2)},{patient.gps.lng.toFixed(2)}-{patient.vitals.spo2}%...
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={sending}
                            className="flex-1 py-3 bg-status-yellow text-yellow-900 font-bold rounded-xl shadow-lg hover:bg-yellow-400 transition-all flex items-center justify-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Preparing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Send via SMS (2G)
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
