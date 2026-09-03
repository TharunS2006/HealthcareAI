/**
 * GovPortalHeader — Authentic Indian Government (NIC / GIGW 3.0) Master Header
 * Official portal header for NalamMesh — Government of Maharashtra & NHM
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StateEmblem from '@/components/gov/StateEmblem';
import { useLanguageStore } from '@/stores/languageStore';
import { useState, useEffect } from 'react';

export default function GovPortalHeader() {
    const pathname = usePathname();
    const { language, setLanguage } = useLanguageStore();
    const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
    const [highContrast, setHighContrast] = useState(false);

    const isEn = language === 'en';
    const isHi = language === 'hi';

    useEffect(() => {
        const savedSize = localStorage.getItem('gov-font-size');
        const savedContrast = localStorage.getItem('gov-contrast');
        if (savedSize === 'large') {
            setFontSize('large');
            document.documentElement.classList.add('text-lg-scale');
        }
        if (savedContrast === 'true') {
            setHighContrast(true);
            document.documentElement.setAttribute('data-contrast', 'high');
        }
    }, []);

    const toggleFontSize = () => {
        const next = fontSize === 'normal' ? 'large' : 'normal';
        setFontSize(next);
        if (next === 'large') {
            document.documentElement.classList.add('text-lg-scale');
            localStorage.setItem('gov-font-size', 'large');
        } else {
            document.documentElement.classList.remove('text-lg-scale');
            localStorage.setItem('gov-font-size', 'normal');
        }
    };

    const toggleContrast = () => {
        const next = !highContrast;
        setHighContrast(next);
        if (next) {
            document.documentElement.setAttribute('data-contrast', 'high');
            localStorage.setItem('gov-contrast', 'true');
        } else {
            document.documentElement.removeAttribute('data-contrast');
            localStorage.setItem('gov-contrast', 'false');
        }
    };

    const navLinks = [
        { href: '/', label: isEn ? 'Home' : isHi ? 'मुख्य पृष्ठ' : 'मुख्य पृष्ठ' },
        { href: '/opd', label: isEn ? 'OPD Triage' : isHi ? 'ओपीडी व ट्राइएज' : 'ओपीडी व ट्राइएज' },
        { href: '/dashboard', label: isEn ? 'Command Center' : isHi ? 'जिला डैशबोर्ड' : 'जिल्हा डॅशबोर्ड' },
        { href: '/followup', label: isEn ? 'High-Risk Recalls' : isHi ? 'उच्च जोखिम फॉलो-अप' : 'उच्च जोखीम' },
        { href: '/diagnostics', label: isEn ? 'Diagnostics' : isHi ? 'लैब निदान' : 'लॅब निदान' },
        { href: '/medicine', label: isEn ? 'Medicine Stock' : isHi ? 'दवा स्टॉक' : 'औषध साठा' },
        { href: '/referrals', label: isEn ? 'Referrals (108)' : isHi ? 'रेफरल (108)' : 'रुग्ण रेफरल (108)' },
        { href: '/queue', label: isEn ? 'OPD Queue' : isHi ? 'कतार व टोकन' : 'रांग व टोकन' },
        { href: '/teleconsult', label: isEn ? 'Teleconsult' : isHi ? 'ई-संजीवनी' : 'ई-संजीवनी' },
        { href: '/facilities', label: isEn ? 'Facilities (4-Tier)' : isHi ? 'स्वास्थ्य केंद्र' : 'आरोग्य केंद्रे' },
        { href: '/emergency', label: isEn ? 'Emergency SOS' : isHi ? 'आपातकालीन SOS' : 'आपत्कालीन SOS', isAlert: true },
    ];

    const i18nTexts = {
        stateGov: isEn ? 'Government of Maharashtra' : isHi ? 'महाराष्ट्र सरकार' : 'महाराष्ट्र शासन',
        dept: isEn ? 'Public Health Department | National Health Mission' : isHi ? 'सार्वजनिक स्वास्थ्य विभाग | राष्ट्रीय स्वास्थ्य मिशन' : 'सार्वजनिक आरोग्य विभाग | राष्ट्रीय आरोग्य अभियान (NHM)',
        title: isEn ? 'NalamMesh' : 'नलममेश',
        badge: isEn ? 'NHM Maharashtra' : 'NHM महाराष्ट्र',
        subTitle: isEn
            ? 'Integrated Rural Public Healthcare Access, Continuity & Quality Platform'
            : isHi
            ? 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — महाराष्ट्र सरकार'
            : 'एकात्मिक ग्रामीण सार्वजनिक आरोग्य सेवा, सातत्य व गुणवत्ता मंच',
        subText: isEn
            ? 'National Rural Health Digital Public Infrastructure • Government of Maharashtra • ABDM Certified'
            : isHi
            ? 'राष्ट्रीय ग्रामीण स्वास्थ्य डिजिटल अवसंरचना • महाराष्ट्र शासन • ABDM प्रमाणित'
            : 'राष्ट्रीय ग्रामीण आरोग्य डिजिटल पायाभूत सुविधा • महाराष्ट्र शासन • ABDM प्रमाणित',
        ambLabel: isEn ? 'Ambulance' : isHi ? 'एम्बुलेंस' : 'रुग्णवाहिका',
        maternalLabel: isEn ? 'Maternal / 102' : isHi ? 'मातृ व शिशु / 102' : 'माता व बाल / 102',
        helplineLabel: isEn ? 'Health Helpline' : isHi ? 'स्वास्थ्य सलाह' : 'आरोग्य सल्ला',
        citizenLogin: isEn ? 'ABHA / Citizen' : isHi ? 'ABHA / नागरिक' : 'ABHA / नागरिक',
        staffLogin: isEn ? 'Staff Login →' : isHi ? 'कर्मचारी लॉगिन →' : 'कर्मचारी लॉगिन →',
        noticeLabel: isEn ? 'IMPORTANT NOTICE' : isHi ? 'महत्वपूर्ण सूचना' : 'महत्वाच्या सूचना',
        noticeText: isEn
            ? '24×7 CEmONC & BEmONC Emergency Obstetric Services fully operational at SDH Aheri and DH Gadchiroli. Live 108 Ambulance GPS tracking active.'
            : isHi
            ? '24×7 CEmONC और BEmONC आपातकालीन प्रसूति सेवाएं SDH अहेरी और DH गढ़चिरौली में पूरी तरह सक्रिय। 108 एम्बुलेंस जीपीएस ट्रैकिंग चालू।'
            : '२४×७ CEmONC व BEmONC आपत्कालीन प्रसूती सेवा SDH अहेरी व DH गडचिरोली येथे पूर्णतः सक्रिय. १०८ रुग्णवाहिका जीपीएस ट्रॅकिंग सुरू.',
    };

    return (
        <header className="w-full bg-white border-b border-slate-300 font-sans select-none sticky top-0 z-50 shadow-sm">
            {/* Top GIGW Accessibility & National Identification Strip */}
            <div className="bg-[#11223F] text-white border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 font-medium tracking-wide">
                        <span className="text-amber-400 font-bold">{i18nTexts.stateGov}</span>
                        <span className="text-slate-400">|</span>
                        <span>{i18nTexts.dept}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <a href="#main-content" className="skip-to-content hidden sm:inline text-xs text-slate-300 hover:text-white">
                            Skip to Main Content
                        </a>
                        <span className="hidden sm:inline text-slate-500">|</span>
                        <button
                            onClick={toggleFontSize}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600"
                            title="Text Size Toggle (A / A+)"
                        >
                            {fontSize === 'normal' ? 'A+' : 'A'}
                        </button>
                        <button
                            onClick={toggleContrast}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600"
                            title="High Contrast Mode"
                        >
                            ◐
                        </button>
                        <span className="text-slate-500">|</span>
                        {/* Language switcher */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setLanguage('mr')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                    language === 'mr' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                मराठी
                            </button>
                            <button
                                onClick={() => setLanguage('hi')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                    language === 'hi' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                हिन्दी
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                    language === 'en' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                English
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Institutional Header Bar */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Left: Official Emblem & Portal Title */}
                    <div className="flex items-center gap-3.5">
                        <StateEmblem size={44} />
                        <div className="border-l border-slate-300 pl-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">
                                    {i18nTexts.title}
                                </span>
                                <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-bold bg-[#E8F5E9] text-[#138808] border border-[#A5D6A7] rounded">
                                    {i18nTexts.badge}
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-700 leading-snug">
                                {i18nTexts.subTitle}
                            </p>
                            <p className="text-[10px] text-slate-500 hidden sm:block">
                                {i18nTexts.subText}
                            </p>
                        </div>
                    </div>

                    {/* Right: National Programs & Emergency Dispatch Box */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center sm:justify-end text-xs">
                        {/* 24x7 Helpline Pills */}
                        <div className="hidden md:flex items-center gap-2 border border-slate-200 rounded p-1.5 bg-slate-50 text-[11px]">
                            <div className="text-center px-2 border-r border-slate-200">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">{i18nTexts.ambLabel}</span>
                                <strong className="text-red-700 font-extrabold text-xs">📞 108</strong>
                            </div>
                            <div className="text-center px-2 border-r border-slate-200">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">{i18nTexts.maternalLabel}</span>
                                <strong className="text-emerald-800 font-extrabold text-xs">📞 102</strong>
                            </div>
                            <div className="text-center px-2">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">{i18nTexts.helplineLabel}</span>
                                <strong className="text-blue-800 font-extrabold text-xs">📞 104</strong>
                            </div>
                        </div>

                        {/* Staff / ABHA Login */}
                        <div className="flex items-center gap-1.5">
                            <Link
                                href="/login"
                                className="px-3 py-1.5 bg-white border border-[#1F3A6E] text-[#1F3A6E] hover:bg-[#F0F4FA] font-bold text-xs rounded transition-colors"
                            >
                                {i18nTexts.citizenLogin}
                            </Link>
                            <Link
                                href="/staff/login"
                                className="px-3 py-1.5 bg-[#1F3A6E] hover:bg-[#16294E] text-white font-bold text-xs rounded transition-colors shadow-sm"
                            >
                                {i18nTexts.staffLogin}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official Primary Government Navigation Bar (NIC Style) */}
            <nav className="bg-[#1F3A6E] text-white overflow-x-auto shadow-inner" aria-label="Official Government Navigation">
                <div className="max-w-7xl mx-auto px-2 flex items-center whitespace-nowrap">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1 ${
                                    link.isAlert
                                        ? 'bg-red-700 hover:bg-red-800 text-white border-red-500 px-3.5'
                                        : isActive
                                        ? 'bg-[#16294E] text-amber-300 border-amber-400 font-extrabold shadow-sm'
                                        : 'text-slate-100 hover:bg-[#284B8C] hover:text-white border-transparent'
                                }`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <span>{link.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Official Announcement / Circular Marquee Strip */}
            <div className="bg-[#FFFBEB] border-b border-[#FDE68A] text-[#92400E] px-4 py-1 text-xs flex items-center gap-2 overflow-hidden">
                <span className="font-extrabold bg-[#F59E0B] text-slate-950 px-2 py-0.5 rounded text-[10px] uppercase flex-shrink-0">
                    {i18nTexts.noticeLabel}
                </span>
                <div className="truncate text-[11px] font-medium">
                    {i18nTexts.noticeText}
                </div>
            </div>
        </header>
    );
}
