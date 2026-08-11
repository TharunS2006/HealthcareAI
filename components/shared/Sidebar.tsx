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

export default function Sidebar() {
    const pathname = usePathname();
    const { language } = useLanguageStore();

    const navItems = [
        {
            name: t('navCommand', language), path: '/dashboard', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            )
        },
        {
            name: t('navTriage', language), path: '/triage', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        },
        {
            name: t('navTopology', language), path: '/mesh-demo', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )
        },
        {
            name: t('navAmbulance', language), path: '/ambulance', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0l2 2h2a1 1 0 001-1v-5a1 1 0 00-.29-.71l-3-3A1 1 0 0014 9h-1m-6 8h.01M17 16h.01" />
                </svg>
            )
        },
    ];

    return (
        <>
            <MobileMenu />
            <aside className="fixed top-0 left-0 w-64 h-screen bg-emerald-deep text-white shadow-2xl z-50 hidden md:flex flex-col">
                {/* Logo Area */}
                <div className="p-6 pl-5 pb-4">
                    <Logo variant="light" size="sm" />
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2 mt-8">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
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
                                        <span className="font-medium text-sm">{item.name}</span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Status & Language Selector */}
                <div className="p-6 space-y-3">
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
                        onClick={async () => {
                            if (window.confirm('Are you sure you want to delete ALL patient data?')) {
                                const { usePatientStore } = await import('@/stores/patientStore');
                                await usePatientStore.getState().resetData();
                                window.location.reload();
                            }
                        }}
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
