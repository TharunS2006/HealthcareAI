/**
 * Sidebar Navigation — Official Government Clinical Workstation Sidebar
 * Department of Public Health • Government of Maharashtra
 * National Health Mission (NHM) • Ayushman Bharat Digital Mission (ABDM)
 * Fully localized for English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguageStore } from '@/stores/languageStore';
import { useMeshStatus } from '@/lib/hooks/useMeshStatus';

export default function Sidebar() {
    const pathname = usePathname();
    const { language } = useLanguageStore();
    const meshStatus = useMeshStatus();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    // Station meta translations
    const stationMeta = {
        badge: isEn ? 'Station' : isHi ? 'कार्यरत केंद्र' : 'कार्यरत केंद्र',
        name: isEn ? 'PHC Bhamragad' : isHi ? 'प्रा. स्वा. केंद्र, भामरागढ़' : 'प्रा. आ. केंद्र, भामरागड',
        sub: isEn ? 'Aheri Sub-Division • Dist. Gadchiroli' : isHi ? 'अहेरी उपमंडल • जिला गढ़चिरौली' : 'अहेरी उपविभाग • जि. गडचिरोली',
        doctorLabel: isEn ? 'Medical Officer:' : isHi ? 'चिकित्सा अधिकारी:' : 'वैद्यकीय अधिकारी:',
        doctorName: isEn ? 'Dr. Suresh Atram (MO)' : isHi ? 'डॉ. सुरेश आत्राम (MO)' : 'डॉ. सुरेश आत्राम (MO)',
        meshLabel: isEn ? 'ABDM Mesh Relay' : isHi ? 'ABDM मेश रिले' : 'ABDM मेश रिले',
        online: isEn ? 'ONLINE' : isHi ? 'सक्रिय' : 'सक्रिय',
        standalone: isEn ? 'STANDALONE' : isHi ? 'स्वतंत्र' : 'स्वतंत्र',
        connecting: isEn ? 'CONNECTING' : isHi ? 'जुड़ रहा है' : 'जोडत आहे',
        compliance: isEn ? 'NIC / GIGW 3.0 Standard' : isHi ? 'NIC / GIGW 3.0 मानक' : 'NIC / GIGW 3.0 मानके',
    };

    // Reflects the actual relay socket. Records are held in IndexedDB either way, so
    // STANDALONE means "queued locally, not yet relayed" — not a failure.
    const mesh =
        meshStatus === 'ONLINE'
            ? { text: stationMeta.online, dot: 'bg-emerald-600 animate-pulse', pill: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
            : meshStatus === 'STANDALONE'
            ? { text: stationMeta.standalone, dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-900 border-amber-300' }
            : { text: stationMeta.connecting, dot: 'bg-slate-400 animate-pulse', pill: 'bg-slate-100 text-slate-700 border-slate-300' };

    // Official professional SVG icons (clean, hospital-grade)
    const navItems = [
        {
            section: isEn ? 'Clinical Care' : isHi ? 'चिकित्सीय सेवा (Clinical Care)' : 'वैद्यकीय सेवा (Clinical Care)',
        },
        {
            href: '/opd',
            label: isEn ? 'OPD Intake & Triage' : isHi ? 'ओपीडी व डिजिटल ट्राइएज' : 'ओपीडी व ट्राइएज नोंदणी',
            badge: isEn ? 'Intake' : isHi ? 'पंजीयन' : 'नोंदणी',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: '/teleconsult',
            label: isEn ? 'eSanjeevani Teleconsult' : isHi ? 'ई-संजीवनी टेलीकंसल्ट' : 'ई-संजीवनी टेलिकन्सल्ट',
            badge: isEn ? 'Live' : isHi ? 'लाइव' : 'थेट',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            href: '/queue',
            label: isEn ? 'OPD Queue Board' : isHi ? 'ओपीडी कतार बोर्ड' : 'ओपीडी रांग फलक',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            section: isEn ? 'Continuity of Care' : isHi ? 'सेवा निरंतरता (Continuity)' : 'आरोग्य सातत्य (Continuity)',
        },
        {
            href: '/dashboard',
            label: isEn ? 'District Command' : isHi ? 'जिला कमांड सेंटर' : 'जिल्हा कमांड केंद्र',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            href: '/referrals',
            label: isEn ? 'Emergency Referrals' : isHi ? 'आपातकालीन रेफरल' : 'आपत्कालीन संदर्भ सेवा',
            badge: '108/102',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            ),
        },
        {
            href: '/followup',
            label: isEn ? 'High-Risk Follow-Up' : isHi ? 'उच्च जोखिम फॉलो-अप' : 'उच्च जोखीम फॉलो-अप',
            badge: 'ANC/SAM',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
        },
        {
            section: isEn ? 'Diagnostics & Supply' : isHi ? 'निदान एवं आपूर्ति' : 'निदान व औषध पुरवठा',
        },
        {
            href: '/diagnostics',
            label: isEn ? 'Diagnostic Network' : isHi ? 'निदान व जांच नेटवर्क' : 'निदान व लॅब नेटवर्क',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
            ),
        },
        {
            href: '/medicine',
            label: isEn ? 'Essential Medicines' : isHi ? 'आवश्यक दवा स्टॉक' : 'अत्यावश्यक औषध साठा',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
            ),
        },
        {
            section: isEn ? 'Facility Network' : isHi ? 'स्वास्थ्य केंद्र नेटवर्क' : 'आरोग्य केंद्र नेटवर्क',
        },
        {
            href: '/facilities',
            label: isEn ? '4-Tier Health Centers' : isHi ? '४-स्तरीय स्वास्थ्य केंद्र' : '४-स्तरीय आरोग्य केंद्रे',
            badge: '4-Tier',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
        {
            href: '/emergency',
            label: isEn ? 'Emergency Dispatch' : isHi ? 'आपातकालीन डिस्पैच' : 'आपत्कालीन रुग्णवाहिका',
            badge: 'SOS',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            ),
            isAlert: true,
        },
    ];

    return (
        <aside
            className="w-64 bg-white border-r border-slate-300 flex flex-col flex-shrink-0 min-h-[calc(100vh-160px)] hidden md:flex font-sans select-none"
            role="navigation"
            aria-label="Clinical Workstation Navigation"
        >
            {/* Government Official Cadre Station Header */}
            <div className="p-3.5 bg-[#F8FAFC] border-b border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {stationMeta.badge}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono">
                        MH-GAD-04
                    </span>
                </div>
                <strong className="text-xs font-black text-[#1F3A6E] block leading-tight">
                    {stationMeta.name}
                </strong>
                <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                    {stationMeta.sub}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium">{stationMeta.doctorLabel}</span>
                    <strong className="text-slate-800 font-bold">{stationMeta.doctorName}</strong>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-2.5 py-2.5 space-y-0.5 overflow-y-auto">
                {navItems.map((item, idx) => {
                    if ('section' in item) {
                        return (
                            <div
                                key={`section-${idx}`}
                                className="px-2 pt-3 pb-1 text-[9.5px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100"
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
                                    ? 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                                    : isActive
                                    ? 'bg-[#1F3A6E] text-white font-bold shadow-sm'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-[#1F3A6E]'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`${isActive ? 'text-white' : item.isAlert ? 'text-red-700' : 'text-slate-500'}`} aria-hidden="true">
                                    {item.icon}
                                </span>
                                <span className="truncate max-w-[145px]">
                                    {item.label}
                                </span>
                            </div>
                            {item.badge && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
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

            {/* Official Telemetry & ABDM Certified Footer */}
            <div className="p-3 bg-[#F8FAFC] border-t border-slate-200 text-[10px] text-slate-600 space-y-1">
                <div className="flex items-center justify-between" role="status" aria-live="polite">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className={`w-2 h-2 rounded-full ${mesh.dot}`} />
                        {stationMeta.meshLabel}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 border rounded font-bold font-mono ${mesh.pill}`}>
                        {mesh.text}
                    </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[9px] pt-1 border-t border-slate-200/60">
                    <span>HFR ID: MH-GAD-0042</span>
                    <span className="font-bold text-[#1F3A6E]">{stationMeta.compliance}</span>
                </div>
            </div>
        </aside>
    );
}
