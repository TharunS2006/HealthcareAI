/**
 * Sidebar Navigation Component — NalamMesh Rural Public Healthcare
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import LanguageSelector from '@/components/shared/LanguageSelector';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';

export default function Sidebar() {
    const pathname = usePathname();
    const { language } = useLanguageStore();

    const navItems = [
        {
            href: '/',
            label: t('navHome', language),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
        },
        {
            href: '/opd',
            label: t('navOpd', language),
            badge: 'Intake',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: '/dashboard',
            label: t('navDashboard', language),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
        },
        {
            href: '/referrals',
            label: t('navReferrals', language),
            badge: 'Pipeline',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            ),
        },
        {
            href: '/queue',
            label: t('navQueue', language),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            href: '/teleconsult',
            label: t('navTeleconsult', language),
            badge: 'Live',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            href: '/medicine',
            label: t('navMedicine', language),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
        },
    ];

    return (
        <aside className="w-64 bg-white border-r border-border-subtle h-screen flex flex-col fixed left-0 top-0 z-30 hidden md:flex">
            {/* Header / Logo */}
            <div className="p-5 border-b border-border-subtle">
                <Logo size="md" />
                <div className="mt-3">
                    <LanguageSelector />
                </div>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <div className="px-3 pb-2 text-[10px] font-bold text-txt-muted uppercase tracking-wider">
                    Rural Public Health Modules
                </div>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                                isActive
                                    ? 'bg-emerald-deep text-white shadow-md shadow-emerald-deep/20 font-semibold'
                                    : 'text-txt-secondary hover:text-emerald-deep hover:bg-teal-50/50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={isActive ? 'text-teal-accent' : 'text-txt-muted'}>
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </div>
                            {item.badge && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700'
                                }`}>
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Status / District Badge */}
            <div className="p-4 border-t border-border-subtle bg-gray-50/60">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-deep">PHC Bhamragad</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                        MH-GAD
                    </span>
                </div>
                <p className="text-[11px] text-txt-muted truncate">
                    Dist. Gadchiroli • Aheri Division
                </p>
            </div>
        </aside>
    );
}
