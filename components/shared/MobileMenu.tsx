/**
 * Mobile / tablet navigation
 * Native-style bottom tab bar with a "More" sheet for secondary actions.
 * Shown below the `lg` breakpoint (phones, iPad portrait, small windows).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import LanguageSelector from './LanguageSelector';
import { NAV_ITEMS, isNavActive, resetAllPatientData } from './navItems';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { hapticTap } from '@/lib/native';

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { language } = useLanguageStore();

    // Close the sheet on route change, Escape, or the Android back button.
    useEffect(() => { setIsOpen(false); }, [pathname]);
    useEffect(() => {
        if (!isOpen) return;
        const onBack = (e: Event) => { e.preventDefault(); setIsOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('nalam:back', onBack);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('nalam:back', onBack);
            window.removeEventListener('keydown', onKey);
        };
    }, [isOpen]);

    return (
        <div className="lg:hidden">
            {/* Bottom Tab Bar */}
            <nav
                aria-label="Primary"
                className="mobile-tabbar fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-border-subtle shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-safe px-safe"
            >
                <ul className="flex items-stretch justify-around max-w-2xl mx-auto">
                    {NAV_ITEMS.map((item) => {
                        const active = isNavActive(pathname, item.path);
                        return (
                            <li key={item.path} className="flex-1 min-w-0">
                                <Link
                                    href={item.path}
                                    onClick={() => hapticTap()}
                                    aria-current={active ? 'page' : undefined}
                                    className={`relative flex flex-col items-center justify-center gap-0.5 h-16 px-1 tap-target transition-colors ${active ? 'text-emerald-deep' : 'text-txt-muted'}`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="tab-active"
                                            className="absolute top-2 h-8 w-14 rounded-full bg-teal-soft"
                                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                        />
                                    )}
                                    <span className="relative h-8 flex items-center">{item.icon}</span>
                                    <span className={`relative text-[11px] leading-tight truncate max-w-full ${active ? 'font-bold' : 'font-medium'}`}>
                                        {t(item.shortLabelKey, language)}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                    <li className="flex-1 min-w-0">
                        <button
                            type="button"
                            onClick={() => { hapticTap(); setIsOpen(true); }}
                            aria-expanded={isOpen}
                            aria-haspopup="dialog"
                            className="relative w-full flex flex-col items-center justify-center gap-0.5 h-16 px-1 tap-target text-txt-muted"
                        >
                            <span className="h-8 flex items-center">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </span>
                            <span className="text-[11px] font-medium leading-tight truncate max-w-full">{t('tabMore', language)}</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* "More" bottom sheet */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-label="More options"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.6 }}
                            onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) setIsOpen(false); }}
                            className="fixed bottom-0 inset-x-0 z-50 max-w-2xl mx-auto bg-emerald-deep text-white rounded-t-3xl shadow-2xl pb-safe px-safe"
                        >
                            <div className="flex justify-center pt-3 pb-1">
                                <span className="h-1.5 w-10 rounded-full bg-white/30" />
                            </div>
                            <div className="px-5 pt-2 pb-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Logo size="sm" variant="light" />
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        aria-label="Close"
                                        className="p-2 -mr-2 rounded-full text-teal-100/80 hover:bg-white/10 tap-target"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <LanguageSelector />

                                <div className="space-y-1">
                                    <Link
                                        href="/"
                                        className="flex items-center gap-3 px-4 py-3.5 text-emerald-50 hover:bg-white/10 active:bg-white/10 rounded-xl transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                                        </svg>
                                        <span className="text-sm font-semibold">Switch Role</span>
                                    </Link>

                                    <button
                                        type="button"
                                        onClick={async () => { if (await resetAllPatientData()) setIsOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 text-red-300 hover:bg-red-500/10 active:bg-red-500/10 rounded-xl transition-colors text-left"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="text-sm font-semibold">Reset Data</span>
                                    </button>
                                </div>

                                <div className="p-3 bg-emerald-dark rounded-xl border border-white/5 flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-status-green" />
                                    <span className="text-xs font-semibold text-teal-accent">{t('systemOnline', language)}</span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
