/**
 * Sidebar Navigation — NalamMesh Authentic Government Clinical Sidebar
 * Government of Maharashtra • Department of Public Health
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguageStore } from '@/stores/languageStore';

export default function Sidebar() {
    const pathname = usePathname();
    const { language } = useLanguageStore();

    const navItems = [
        {
            section: language === 'en' ? 'Clinical Care' : 'वैद्यकीय सेवा (Clinical)',
        },
        {
            href: '/opd',
            labelMr: 'ओपीडी व ट्राइएज नोंदणी',
            labelEn: 'OPD Intake & Triage',
            badge: 'Intake',
            icon: '🩺',
        },
        {
            href: '/teleconsult',
            labelMr: 'ई-संजीवनी टेलिकन्सल्ट',
            labelEn: 'Teleconsultation Link',
            badge: 'Live',
            icon: '📹',
        },
        {
            href: '/queue',
            labelMr: 'ओपीडी रांग व टोकन',
            labelEn: 'OPD Queue Board',
            icon: '🎟️',
        },
        {
            section: language === 'en' ? 'Continuity of Care' : 'आरोग्य सातत्य (Continuity)',
        },
        {
            href: '/dashboard',
            labelMr: 'जिल्हा आरोग्य डॅशबोर्ड',
            labelEn: 'District Command',
            icon: '📊',
        },
        {
            href: '/referrals',
            labelMr: '१०८ / १०२ रुग्ण रेफरल',
            labelEn: 'Emergency Referrals',
            badge: '108/102',
            icon: '🚑',
        },
        {
            href: '/followup',
            labelMr: 'उच्च जोखीम पाठपुरावा',
            labelEn: 'High-Risk Follow-Up',
            badge: 'ANC/SAM',
            icon: '⚠️',
        },
        {
            section: language === 'en' ? 'Diagnostics & Supply' : 'निदान व औषध पुरवठा',
        },
        {
            href: '/diagnostics',
            labelMr: 'लॅब चाचण्या व नमुने',
            labelEn: 'Diagnostic Network',
            icon: '🧪',
        },
        {
            href: '/medicine',
            labelMr: 'आवश्यक औषध साठा',
            labelEn: 'Essential Medicines',
            icon: '💊',
        },
        {
            section: language === 'en' ? 'Network & Operations' : 'नेटवर्क व सुविधा',
        },
        {
            href: '/facilities',
            labelMr: '४-स्तरीय आरोग्य केंद्रे',
            labelEn: '4-Tier Health Centers',
            badge: '4-Tier',
            icon: '🏥',
        },
        {
            href: '/emergency',
            labelMr: 'आपत्कालीन एस्केलेशन',
            labelEn: 'Emergency Dispatch',
            badge: 'SOS',
            icon: '🚨',
            isAlert: true,
        },
    ];

    return (
        <aside
            className="w-64 bg-white border-r border-slate-300 flex flex-col flex-shrink-0 min-h-[calc(100vh-160px)] hidden md:flex font-sans"
            role="navigation"
            aria-label="Clinical Workstation Navigation"
        >
            {/* Cadre Station Header */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        कार्यरत केंद्र / Station
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded">
                        MH-GAD-04
                    </span>
                </div>
                <strong className="text-xs font-black text-[#1F3A6E] block leading-tight">
                    प्रा. आ. केंद्र, भामरागड
                </strong>
                <p className="text-[10px] text-slate-500 mt-0.5">
                    PHC Bhamragad • अहेरी उपविभाग, गडचिरोली
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-600 font-medium">वैद्यकीय अधिकारी:</span>
                    <strong className="text-slate-800">डॉ. सुरेश आत्राम</strong>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
                {navItems.map((item, idx) => {
                    if ('section' in item) {
                        return (
                            <div
                                key={`section-${idx}`}
                                className="px-2 pt-3 pb-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100"
                            >
                                {item.section}
                            </div>
                        );
                    }

                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-2.5 py-2 rounded text-xs font-semibold transition-colors ${
                                item.isAlert
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                    : isActive
                                    ? 'bg-[#1F3A6E] text-white font-bold shadow-sm'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#1F3A6E]'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm" aria-hidden="true">{item.icon}</span>
                                <span className="truncate max-w-[145px]">
                                    {language === 'en' ? item.labelEn : item.labelMr}
                                </span>
                            </div>
                            {item.badge && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    isActive
                                        ? 'bg-white/20 text-white'
                                        : item.isAlert
                                        ? 'bg-red-600 text-white'
                                        : 'bg-slate-200 text-slate-800'
                                }`}>
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* System Telemetry Bar */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ABDM मेश रिले
                    </span>
                    <strong className="text-emerald-700 font-bold">सक्रिय (ONLINE)</strong>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                    <span>सिग्नल सामर्थ्य:</span>
                    <span>94% (Bluetooth / Wi-Fi)</span>
                </div>
            </div>
        </aside>
    );
}
