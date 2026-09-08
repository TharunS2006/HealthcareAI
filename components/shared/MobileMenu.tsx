/**
 * Mobile Navigation Drawer & Bottom Bar — NalamMesh FHW Interface (SIH PS#26133)
 * Department of Public Health • Government of Maharashtra
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageSelector from '@/components/shared/LanguageSelector';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { language } = useLanguageStore();

    const navItems = [
        {
            href: '/',
            label: t('navHome', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
        },
        {
            href: '/opd',
            label: t('navOpd', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: '/dashboard',
            label: t('navDashboard', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            href: '/followup',
            label: t('navFollowup', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
        },
        {
            href: '/diagnostics',
            label: t('navDiagnostics', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
        },
        {
            href: '/medicine',
            label: t('navMedicine', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
            ),
        },
        {
            href: '/referrals',
            label: t('navReferrals', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            ),
        },
        {
            href: '/queue',
            label: t('navQueue', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/teleconsult',
            label: t('navTeleconsult', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            href: '/facilities',
            label: t('navFacilities', language),
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
        {
            href: '/services-info',
            label: language === 'en' ? 'Services & Entitlements' : language === 'hi' ? 'सेवाएं व अधिकार' : 'सेवा व हक्क',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: '/audit',
            label: language === 'en' ? 'Audit Trail' : 'ऑडिट ट्रेल',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2zM9 7h1" />
                </svg>
            ),
        },
    ];

    return (
        <>
            {/* Top Mobile Bar */}
            <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-slate-300 sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-700" />
                    <div>
                        <strong className="text-xs font-black text-[#1F3A6E] block leading-tight">
                            {language === 'en' ? 'NalamMesh' : 'नलममेश'}
                        </strong>
                        <span className="text-[9px] text-slate-500 font-bold block">
                            {language === 'en'
                                ? 'Govt. of Maharashtra • Public Health'
                                : language === 'hi'
                                ? 'महाराष्ट्र सरकार • सार्वजनिक स्वास्थ्य'
                                : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSelector />
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 text-[#1F3A6E] hover:bg-slate-100 rounded border border-slate-200"
                        aria-label="Toggle navigation menu"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="md:hidden fixed inset-x-0 top-[53px] bg-white border-b border-slate-300 shadow-xl z-40 max-h-[85vh] overflow-y-auto"
                    >
                        <div className="p-3 space-y-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded text-xs font-semibold transition-all ${
                                            isActive
                                                ? 'bg-[#1F3A6E] text-white font-bold'
                                                : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className={isActive ? 'text-white' : 'text-slate-500'}>
                                            {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
