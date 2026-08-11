/**
 * Landing Page - NalamMesh
 * Entry point for different roles: Triage, Command, Ambulance
 */

'use client';

import Link from 'next/link';
import Logo from '@/components/shared/Logo';
import { motion } from 'framer-motion';

export default function Home() {
    return (
        <main className="min-h-screen bg-bg-page flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
            {/* Subtle geometric background — not the standard radial blob */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-[10%] left-[5%] w-[600px] h-[1px] bg-gradient-to-r from-transparent via-teal-accent/20 to-transparent rotate-[25deg]" />
                <div className="absolute top-[30%] right-[10%] w-[400px] h-[1px] bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent -rotate-[15deg]" />
                <div className="absolute bottom-[20%] left-[15%] w-[500px] h-[1px] bg-gradient-to-r from-transparent via-teal-accent/10 to-transparent rotate-[35deg]" />
            </div>

            {/* Logo / Branding — tighter, less template-like */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-14 relative z-10"
            >
                <Logo size="lg" className="mb-5" />
                <p className="text-txt-secondary text-base max-w-md mx-auto leading-relaxed">
                    Offline-first mesh networking for disaster medical coordination.
                    AI triage, real-time tracking, zero-infrastructure deployment.
                </p>
            </motion.div>

            {/* Asymmetric layout — featured card + two smaller cards */}
            <div className="w-full max-w-5xl px-4">
                <div className="grid md:grid-cols-5 gap-5">

                    {/* Featured: Triage Station — spans 3 cols */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.45 }}
                        className="md:col-span-3"
                    >
                        <Link href="/triage" className="group block h-full">
                            <div className="surface-card h-full p-8 md:p-10 border-l-4 border-l-teal-accent hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                {/* Subtle corner accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-accent/5 to-transparent rounded-bl-[80px]" />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Primary Entry Point</span>
                                    </div>

                                    <h2 className="text-2xl font-bold text-emerald-deep mb-2 group-hover:text-teal-700 transition-colors">
                                        Triage Station
                                    </h2>
                                    <p className="text-txt-secondary mb-6 leading-relaxed max-w-md">
                                        Capture vitals, run on-device AI classification, and generate patient records.
                                        Works fully offline with mesh sync.
                                    </p>

                                    <div className="flex items-center gap-4 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 text-teal-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
                                            Open Interface <span className="text-lg">→</span>
                                        </span>
                                        <div className="hidden sm:flex items-center gap-3 text-xs text-txt-muted">
                                            <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                Edge AI
                                            </span>
                                            <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                Voice Input
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Right column: stacked cards */}
                    <div className="md:col-span-2 flex flex-col gap-5">
                        {/* Command Center */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.45 }}
                        >
                            <Link href="/dashboard" className="group block">
                                <div className="surface-card p-6 border-l-4 border-l-emerald-deep hover:shadow-xl transition-all duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-emerald-700 transition-colors">
                                                Command Center
                                            </h2>
                                            <p className="text-txt-secondary text-sm leading-relaxed">
                                                Live patient map, hospital capacity, triage distribution.
                                            </p>
                                        </div>
                                        <span className="text-emerald-deep/40 group-hover:text-emerald-deep group-hover:translate-x-1 transition-all mt-3 text-lg">→</span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>

                        {/* Ambulance Crew */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.45 }}
                        >
                            <Link href="/ambulance" className="group block">
                                <div className="surface-card p-6 border-l-4 border-l-amber-500 hover:shadow-xl transition-all duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0l2 2h2a1 1 0 001-1v-5a1 1 0 00-.29-.71l-3-3A1 1 0 0014 9h-1m-6 8h.01M17 16h.01" />
                                                </svg>
                                            </div>
                                            <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-amber-700 transition-colors">
                                                Ambulance Crew
                                            </h2>
                                            <p className="text-txt-secondary text-sm leading-relaxed">
                                                Transport tasks, routing, hospital handover protocols.
                                            </p>
                                        </div>
                                        <span className="text-amber-500/40 group-hover:text-amber-600 group-hover:translate-x-1 transition-all mt-3 text-lg">→</span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>

                        {/* Mesh Network — subtle tertiary link */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.45 }}
                        >
                            <Link href="/mesh-demo" className="group block">
                                <div className="px-6 py-4 rounded-xl border border-dashed border-border-active hover:border-teal-accent/40 hover:bg-white/60 transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-4 h-4 text-txt-muted group-hover:text-teal-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span className="text-sm font-medium text-txt-secondary group-hover:text-emerald-deep transition-colors">
                                            View Network Topology
                                        </span>
                                        <span className="ml-auto text-xs text-txt-muted group-hover:text-teal-accent transition-colors">→</span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </main>
    );
}
