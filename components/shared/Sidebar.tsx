/**
 * Modern Sidebar Navigation
 * Deep Emerald background with Teal accents
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import MobileMenu from './MobileMenu';
import Logo from './Logo';

import LanguageSelector from './LanguageSelector';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { NAV_ITEMS, isNavActive, resetAllPatientData } from './navItems';

export default function Sidebar() {
    const pathname = usePathname();
    const { language } = useLanguageStore();

    return (
        <>
            <MobileMenu />
            <aside className="app-sidebar fixed top-0 left-0 h-screen bg-emerald-deep text-white shadow-2xl z-50 hidden lg:flex flex-col">
                {/* Logo Area */}
                <div className="p-6 pl-5 pb-4">
                    <Logo variant="light" size="sm" />
                </div>

                {/* Navigation */}
                <nav className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2 mt-8">
                    {NAV_ITEMS.map((item) => {
                        const isActive = isNavActive(pathname, item.path);
                        return (
                            <Link key={item.path} href={item.path}>
                                <div className="relative group">
                                    {isActive && (
                                        <motion.div
                                            layoutId="sidebar-active"
                                            className="absolute inset-0 bg-white/10 rounded-xl"
                                            initial={false}
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                    <div className={`relative px-4 py-3.5 flex items-center gap-3 rounded-xl transition-colors duration-200 ${isActive ? 'text-white' : 'text-teal-100/70 hover:text-white hover:bg-white/5'
                                        }`}>
                                        {item.icon}
                                        <span className="font-medium text-sm">{t(item.labelKey, language)}</span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Status & Language Selector */}
                <div className="p-6 space-y-3 shrink-0">
                    <div className="mb-2">
                        <LanguageSelector />
                    </div>

                    <Link href="/" className="flex items-center gap-3 px-4 py-2.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10 group">
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        <span className="font-bold text-sm">Switch Role</span>
                    </Link>

                    <button
                        onClick={resetAllPatientData}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 group text-left"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="font-bold text-sm">Reset Data</span>
                    </button>

                    <div className="p-3 bg-emerald-dark rounded-xl border border-white/5">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-2 rounded-full bg-status-green" />
                            <span className="text-xs font-semibold text-teal-accent">{t('systemOnline', language)}</span>
                        </div>
                        <p className="text-[10px] text-teal-100/50">Mesh Network Active</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
