/**
 * Mobile Navigation Drawer & Bottom Bar — NalamMesh FHW Interface
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import LanguageSelector from '@/components/shared/LanguageSelector';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { language } = useLanguageStore();

    const navItems = [
        { href: '/', label: t('navHome', language), icon: '🏠' },
        { href: '/opd', label: t('navOpd', language), icon: '🩺' },
        { href: '/dashboard', label: t('navDashboard', language), icon: '📊' },
        { href: '/referrals', label: t('navReferrals', language), icon: '🔄' },
        { href: '/queue', label: t('navQueue', language), icon: '📋' },
        { href: '/teleconsult', label: t('navTeleconsult', language), icon: '📹' },
        { href: '/medicine', label: t('navMedicine', language), icon: '💊' },
    ];

    return (
        <>
            {/* Top Mobile Bar */}
            <div className="md:hidden flex items-center justify-between p-3 bg-white border-b border-border-subtle sticky top-0 z-40">
                <Logo size="sm" />
                <div className="flex items-center gap-2">
                    <LanguageSelector />
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 text-emerald-deep hover:bg-gray-100 rounded-lg"
                        aria-label="Toggle menu"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="md:hidden fixed inset-x-0 top-[57px] bg-white border-b border-border-subtle shadow-xl z-40 max-h-[85vh] overflow-y-auto"
                    >
                        <div className="p-4 space-y-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                                            isActive
                                                ? 'bg-emerald-deep text-white font-semibold'
                                                : 'text-txt-secondary hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className="text-lg">{item.icon}</span>
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
