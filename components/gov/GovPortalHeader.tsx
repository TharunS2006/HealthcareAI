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
        { href: '/', label: isEn ? 'Home' : isHi ? 'मुख्य पोर्टल' : 'मुख्य पोर्टल' },
        { href: '/opd', label: isEn ? 'OPD Triage' : isHi ? 'ओपीडी ट्राइएज' : 'ओपीडी ट्राइएज' },
        { href: '/dashboard', label: isEn ? 'Command Center' : isHi ? 'जिला कमांड सेंटर' : 'जिल्हा कमांड केंद्र' },
        { href: '/followup', label: isEn ? 'High-Risk Recalls' : isHi ? 'उच्च जोखिम फॉलो-अप' : 'उच्च जोखीम फॉलो-अप' },
        { href: '/diagnostics', label: isEn ? 'Diagnostics' : isHi ? 'निदान व परीक्षण' : 'निदान व लॅब' },
        { href: '/medicine', label: isEn ? 'Medicine Stock' : isHi ? 'दवा स्टॉक' : 'औषध साठा' },
        { href: '/referrals', label: isEn ? 'Referrals (108)' : isHi ? 'रेफरल सेवा (१०८)' : 'रेफरल सेवा (१०८)' },
        { href: '/queue', label: isEn ? 'OPD Queue' : isHi ? 'ओपीडी कतार' : 'ओपीडी रांग' },
        { href: '/teleconsult', label: isEn ? 'Teleconsult' : isHi ? 'ई-संजीवनी' : 'ई-संजीवनी' },
        { href: '/facilities', label: isEn ? 'Facilities (4-Tier)' : isHi ? 'स्वास्थ्य केंद्र (४-स्तरीय)' : 'आरोग्य केंद्रे (४-स्तर)' },
        { href: '/emergency', label: isEn ? 'Emergency SOS' : isHi ? 'आपातकालीन SOS' : 'तातडीची मदत SOS', isAlert: true },
    ];

    const i18nTexts = {
        stateGov: isEn ? 'Government of Maharashtra' : isHi ? 'महाराष्ट्र सरकार' : 'महाराष्ट्र शासन',
        dept: isEn ? 'Public Health Department | National Health Mission' : isHi ? 'लोक स्वास्थ्य विभाग | राष्ट्रीय स्वास्थ्य मिशन (NHM)' : 'सार्वजनिक आरोग्य विभाग | राष्ट्रीय आरोग्य अभियान (NHM)',
        title: isEn ? 'NalamMesh' : 'नलममेश',
        badge: isEn ? 'NHM Maharashtra' : isHi ? 'NHM महाराष्ट्र' : 'NHM महाराष्ट्र',
        subTitle: isEn
            ? 'Integrated Rural Public Healthcare Access, Continuity & Quality Platform'
            : isHi
            ? 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — लोक स्वास्थ्य विभाग'
            : 'ग्रामीण सार्वजनिक आरोग्य सेवा एकात्मिक मंच — सार्वजनिक आरोग्य विभाग',
        subText: isEn
            ? 'National Rural Health Digital Public Infrastructure • Government of Maharashtra • ABDM-Aligned (FHIR R4)'
            : isHi
            ? 'राष्ट्रीय ग्रामीण स्वास्थ्य डिजिटल सार्वजनिक अवसंरचना • महाराष्ट्र सरकार • ABDM-संरेखित (FHIR R4)'
            : 'राष्ट्रीय ग्रामीण आरोग्य डिजिटल सार्वजनिक पायाभूत सुविधा • महाराष्ट्र शासन • ABDM-संरेखित (FHIR R4)',
        ambLabel: isEn ? 'Ambulance' : isHi ? 'एम्बुलेंस' : 'रुग्णवाहिका',
        maternalLabel: isEn ? 'Maternal / 102' : isHi ? 'जननी-शिशु / १०२' : 'माता व बाल / १०२',
        helplineLabel: isEn ? 'Health Helpline' : isHi ? 'स्वास्थ्य हेल्पलाइन' : 'आरोग्य हेल्पलाइन',
        citizenLogin: isEn ? 'ABHA / Citizen' : isHi ? 'ABHA / नागरिक' : 'ABHA / नागरिक',
        staffLogin: isEn ? 'Staff Login →' : isHi ? 'कर्मचारी लॉगिन →' : 'कर्मचारी लॉगिन →',
        noticeLabel: isEn ? 'IMPORTANT NOTICE' : isHi ? 'महत्वपूर्ण सूचना' : 'महत्त्वाची सूचना',
        noticeText: isEn
            ? '24×7 CEmONC & BEmONC Emergency Obstetric Services fully operational at SDH Aheri and DH Gadchiroli. Live 108 Ambulance GPS tracking active.'
            : isHi
            ? 'उप-जिला अस्पताल अहेरी और जिला अस्पताल गढ़चिरौली में २४ घंटे आपातकालीन प्रसूति सेवाएं (CEmONC व BEmONC) पूर्णतः सक्रिय हैं। १०८ एम्बुलेंस का लाइव जीपीएस ट्रैकिंग चालू है।'
            : 'उपजिल्हा रुग्णालय अहेरी व जिल्हा रुग्णालय गडचिरोली येथे २४ तास आपत्कालीन प्रसूती सेवा (CEmONC व BEmONC) पूर्णपणे सुरू आहेत. १०८ रुग्णवाहिकांचे थेट जीपीएस ट्रॅकिंग सक्रिय आहे.',
    };

    return (
        <header className="w-full bg-white border-b border-slate-300 font-sans select-none sticky top-0 z-50 shadow-sm">
            {/* Authentic Indian National Tricolor Ribbon */}
            <div className="h-1 w-full flex">
                <div className="w-1/3 bg-[#FF9933]" />
                <div className="w-1/3 bg-white" />
                <div className="w-1/3 bg-[#138808]" />
            </div>

            {/* Top GIGW Accessibility & National Identification Strip */}
            <div className="bg-[#11223F] text-white border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 font-medium tracking-wide">
                        <span className="text-amber-400 font-bold">{i18nTexts.stateGov}</span>
                        <span className="text-slate-400">|</span>
                        <span>{i18nTexts.dept}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Skip link lives once in app/layout.tsx — a second one competes as a landmark. */}
                        <button
                            onClick={toggleFontSize}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer"
                            title="Text Size Toggle (A / A+)"
                        >
                            {fontSize === 'normal' ? 'A+' : 'A'}
                        </button>
                        <button
                            onClick={toggleContrast}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 cursor-pointer"
                            title="High Contrast Mode"
                        >
                            {isEn ? 'A' : 'अ'}
                        </button>
                        <span className="text-slate-500">|</span>
                        {/* Language switcher */}
                        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded border border-slate-700">
                            <button
                                onClick={() => setLanguage('mr')}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                    language === 'mr' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                मराठी
                            </button>
                            <button
                                onClick={() => setLanguage('hi')}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                    language === 'hi' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                हिन्दी
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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
                    {/* Left: Official State Emblem & Portal Title (Single, Authentic Seal) */}
                    <div className="flex items-center gap-3">
                        <StateEmblem size={44} />

                        <div className="border-l border-slate-300 pl-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">
                                    {i18nTexts.title}
                                </span>
                                <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-bold bg-[#1F3A6E] text-white rounded">
                                    {i18nTexts.badge}
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-800 leading-snug">
                                {i18nTexts.subTitle}
                            </p>
                            <p className="text-[10px] text-slate-500 hidden sm:block">
                                {i18nTexts.subText}
                            </p>
                        </div>
                    </div>

                    {/* Right: Helplines & Login Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-end text-xs">
                        {/* 24x7 Helpline Bar */}
                        <div className="hidden md:flex items-center gap-2 border border-slate-300 rounded p-1 bg-white text-[11px]">
                            <div className="text-center px-2.5 border-r border-slate-200 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <div>
                                    <span className="block text-[8.5px] text-slate-500 font-bold uppercase">{i18nTexts.ambLabel}</span>
                                    <strong className="text-red-700 font-black text-xs">108</strong>
                                </div>
                            </div>
                            <div className="text-center px-2.5 border-r border-slate-200 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <div>
                                    <span className="block text-[8.5px] text-slate-500 font-bold uppercase">{i18nTexts.maternalLabel}</span>
                                    <strong className="text-emerald-800 font-black text-xs">102</strong>
                                </div>
                            </div>
                            <div className="text-center px-2.5 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-[#1F3A6E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <span className="block text-[8.5px] text-slate-500 font-bold uppercase">{i18nTexts.helplineLabel}</span>
                                    <strong className="text-[#1F3A6E] font-black text-xs">104</strong>
                                </div>
                            </div>
                        </div>

                        {/* Staff / ABHA Login */}
                        <div className="flex items-center gap-1.5">
                            <Link
                                href="/login"
                                className="px-3 py-1.5 bg-white border border-[#1F3A6E] text-[#1F3A6E] hover:bg-slate-50 font-bold text-xs rounded transition-colors"
                            >
                                {i18nTexts.citizenLogin}
                            </Link>
                            <Link
                                href="/staff/login"
                                className="px-3 py-1.5 bg-[#1F3A6E] hover:bg-[#16294E] text-white font-bold text-xs rounded transition-colors shadow-none"
                            >
                                {i18nTexts.staffLogin}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Official Primary Government Navigation Bar (NIC Style) */}
            <nav className="bg-[#1F3A6E] text-white overflow-x-auto" aria-label="Official Government Navigation">
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

            {/* Official Announcement / Circular Strip */}
            <div className="bg-[#FFFBEB] border-b border-[#FDE68A] text-[#92400E] px-4 py-1.5 text-xs flex items-center gap-2 overflow-hidden">
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
