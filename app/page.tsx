/**
 * Landing Page & Role Selection Hub — NalamMesh
 * Integrated Public Healthcare Access & Quality Platform (SIH PS#26133)
 * Designed for Government of Maharashtra
 */

'use client';

import Link from 'next/link';
import Logo from '@/components/shared/Logo';
import LanguageSelector from '@/components/shared/LanguageSelector';
import DemoModeToggle from '@/components/shared/DemoModeToggle';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { motion } from 'framer-motion';

export default function Home() {
    const { language } = useLanguageStore();

    return (
        <main className="min-h-screen bg-bg-page flex flex-col items-center justify-between p-4 sm:p-8 relative overflow-hidden">
            {/* Background geometric accents */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[8%] left-[5%] w-[650px] h-[1px] bg-gradient-to-r from-transparent via-teal-accent/25 to-transparent rotate-[20deg]" />
                <div className="absolute top-[28%] right-[8%] w-[450px] h-[1px] bg-gradient-to-r from-transparent via-emerald-600/20 to-transparent -rotate-[12deg]" />
                <div className="absolute bottom-[15%] left-[12%] w-[550px] h-[1px] bg-gradient-to-r from-transparent via-teal-accent/15 to-transparent rotate-[30deg]" />
            </div>

            {/* Top Bar with Language Selector & Demo Button */}
            <header className="w-full max-w-6xl flex justify-between items-center mb-6 pt-2">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-deep tracking-wider uppercase">
                        Govt of Maharashtra • MedTech Hub
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <DemoModeToggle />
                    <LanguageSelector />
                </div>
            </header>

            {/* Hero & Branding Section */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8 max-w-3xl"
            >
                <Logo size="lg" className="mb-4 justify-center" />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-deep tracking-tight mb-2">
                    {t('appSubtitle', language)}
                </h1>
                <p className="text-txt-secondary text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                    Empowering frontline health workers (ASHA/ANM) with on-device AI triage, longitudinal health records, cross-tier referral tracking, and zero-downtime offline mesh synchronization.
                </p>

                {/* Status Badges */}
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap text-xs">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-bold">
                        ✓ ABDM / FHIR R4 Compliant
                    </span>
                    <span className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full font-bold">
                        ✓ Offline-First IndexedDB v2
                    </span>
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-bold">
                        ✓ SC $\to$ PHC $\to$ CHC $\to$ DH Hierarchy
                    </span>
                </div>
            </motion.div>

            {/* Asymmetric Role Selection Grid (6 Core Personas) */}
            <div className="w-full max-w-6xl mb-8">
                <div className="grid md:grid-cols-6 gap-5">

                    {/* 1. Featured Primary Card: OPD Registration & Triage (Spans 4 cols on desktop) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="md:col-span-4"
                    >
                        <Link href="/opd" className="group block h-full">
                            <div className="surface-card h-full p-6 sm:p-8 border-l-4 border-l-teal-accent hover:shadow-xl transition-all duration-300 relative overflow-hidden bg-white/90">
                                <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-teal-accent/10 to-transparent rounded-bl-[100px]" />

                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        <div className="flex items-center justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-extrabold text-teal-700 uppercase tracking-wider block">Primary Entry Point</span>
                                                    <h2 className="text-2xl font-bold text-emerald-deep group-hover:text-teal-700 transition-colors">
                                                        {t('navOpd', language)}
                                                    </h2>
                                                </div>
                                            </div>
                                            <span className="text-teal-accent text-2xl group-hover:translate-x-1.5 transition-transform">→</span>
                                        </div>

                                        <p className="text-txt-secondary text-sm mb-6 leading-relaxed">
                                            Patient intake, voice vitals capture, browser-native AI triage classification (TensorFlow.js), high-risk maternal/pediatric flagging, and automated OPD queue token generation.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100 text-xs">
                                        <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                                            Edge AI Model
                                        </span>
                                        <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md font-semibold">
                                            🎙️ Voice Input (EN/MR/HI)
                                        </span>
                                        <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md font-semibold">
                                            📱 Touch Optimized (FHW)
                                        </span>
                                        <span className="ml-auto text-teal-700 font-bold group-hover:underline">
                                            Open Station →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* 2. Facility Dashboard (Spans 2 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="md:col-span-2"
                    >
                        <Link href="/dashboard" className="group block h-full">
                            <div className="surface-card h-full p-6 border-l-4 border-l-emerald-deep hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-emerald-700 transition-colors">
                                        {t('navDashboard', language)}
                                    </h2>
                                    <p className="text-txt-secondary text-xs leading-relaxed mb-4">
                                        Gadchiroli district census, high-risk maternal alerts, and Maharashtra tiered facility tree.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                    View Analytics <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>

                    {/* 3. Referral Pipeline Tracker (Spans 3 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="md:col-span-3"
                    >
                        <Link href="/referrals" className="group block h-full">
                            <div className="surface-card h-full p-6 border-l-4 border-l-amber-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-amber-700 transition-colors">
                                        {t('navReferrals', language)}
                                    </h2>
                                    <p className="text-txt-secondary text-xs leading-relaxed mb-4">
                                        5-stage Kanban referral continuum (SC $\to$ PHC $\to$ CHC $\to$ DH) with 108/102 ambulance dispatch tracking.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                    Track Referrals <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>

                    {/* 4. Queue & Token Engine (Spans 3 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.4 }}
                        className="md:col-span-3"
                    >
                        <Link href="/queue" className="group block h-full">
                            <div className="surface-card h-full p-6 border-l-4 border-l-indigo-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-indigo-700 transition-colors">
                                        {t('navQueue', language)}
                                    </h2>
                                    <p className="text-txt-secondary text-xs leading-relaxed mb-4">
                                        Real-time token calling, priority emergency overrides, and full-screen waiting room TV display.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                                    Manage Queue <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>

                    {/* 5. Assisted Teleconsultation (Spans 3 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                        className="md:col-span-3"
                    >
                        <Link href="/teleconsult" className="group block h-full">
                            <div className="surface-card h-full p-6 border-l-4 border-l-purple-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-purple-700 transition-colors">
                                        {t('navTeleconsult', language)}
                                    </h2>
                                    <p className="text-txt-secondary text-xs leading-relaxed mb-4">
                                        Assisted video/audio consultation connecting rural Sub-Centres directly with District Hospital specialists.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                                    Launch Teleconsult <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>

                    {/* 6. Medicine & Diagnostics (Spans 3 cols) */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, duration: 0.4 }}
                        className="md:col-span-3"
                    >
                        <Link href="/medicine" className="group block h-full">
                            <div className="surface-card h-full p-6 border-l-4 border-l-rose-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-rose-50 text-rose-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-emerald-deep mb-1 group-hover:text-rose-700 transition-colors">
                                        {t('navMedicine', language)}
                                    </h2>
                                    <p className="text-txt-secondary text-xs leading-relaxed mb-4">
                                        Indian Public Health Standards (IPHS) essential drug inventory, out-of-stock emergency alerts, and lab test tracking.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                                    Check Stock & Labs <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </Link>
                    </motion.div>

                </div>
            </div>

            {/* Footer Alignment */}
            <footer className="w-full max-w-6xl text-center py-4 border-t border-gray-200/80 text-xs text-txt-muted flex flex-col sm:flex-row justify-between items-center gap-2">
                <div>
                    <strong>Smart India Hackathon 2025</strong> • Problem Statement #26133
                </div>
                <div className="text-emerald-deep font-semibold">
                    Government of Maharashtra | MedTech / HealthTech
                </div>
            </footer>
        </main>
    );
}
