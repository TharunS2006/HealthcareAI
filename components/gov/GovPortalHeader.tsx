/**
 * GovPortalHeader — Authentic Indian Government (NIC / GIGW 3.0) Master Header
 * Official portal header for NalamMesh — Government of Maharashtra & NHM
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
        { href: '/', labelMr: 'मुख्य पृष्ठ', labelEn: 'Home' },
        { href: '/opd', labelMr: 'ओपीडी व ट्राइएज', labelEn: 'OPD Triage' },
        { href: '/dashboard', labelMr: 'जिल्हा डॅशबोर्ड', labelEn: 'Command Center' },
        { href: '/followup', labelMr: 'उच्च जोखीम', labelEn: 'High-Risk Recalls' },
        { href: '/diagnostics', labelMr: 'लॅब निदान', labelEn: 'Diagnostics' },
        { href: '/medicine', labelMr: 'औषध साठा', labelEn: 'Medicine Stock' },
        { href: '/referrals', labelMr: 'रुग्ण रेफरल (108)', labelEn: 'Referrals (108)' },
        { href: '/queue', labelMr: 'रांग व टोकन', labelEn: 'OPD Queue' },
        { href: '/teleconsult', labelMr: 'ई-संजीवनी', labelEn: 'Teleconsult' },
        { href: '/facilities', labelMr: 'आरोग्य केंद्रे', labelEn: 'Facilities (4-Tier)' },
        { href: '/emergency', labelMr: '🚨 आपत्कालीन SOS', labelEn: '🚨 Emergency SOS', isAlert: true },
    ];

    return (
        <header className="w-full bg-white border-b border-slate-300 font-sans select-none sticky top-0 z-50 shadow-sm">
            {/* Top GIGW Accessibility & National Identification Strip */}
            <div className="bg-[#11223F] text-white border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 font-medium tracking-wide">
                        <span className="text-amber-400 font-bold">महाराष्ट्र शासन</span>
                        <span className="text-slate-400">|</span>
                        <span>Government of Maharashtra</span>
                        <span className="hidden md:inline text-slate-400">|</span>
                        <span className="hidden md:inline text-slate-300 font-semibold">सार्वजनिक आरोग्य विभाग (Public Health Department)</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
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
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    language === 'mr' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                मराठी
                            </button>
                            <button
                                onClick={() => setLanguage('hi')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    language === 'hi' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                हिन्दी
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    language === 'en' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
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
                                    नलममेश <span className="text-[#B45309] font-extrabold">(NalamMesh)</span>
                                </span>
                                <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-bold bg-[#E8F5E9] text-[#138808] border border-[#A5D6A7] rounded">
                                    NHM Maharashtra
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-slate-700 leading-snug">
                                एकात्मिक ग्रामीण सार्वजनिक आरोग्य सेवा, सातत्य व गुणवत्ता मंच
                            </p>
                            <p className="text-[10px] text-slate-500 hidden sm:block">
                                National Rural Health Digital Public Infrastructure • Government of Maharashtra • ABDM Certified
                            </p>
                        </div>
                    </div>

                    {/* Right: National Programs & Emergency Dispatch Box */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center sm:justify-end text-xs">
                        {/* 24x7 Helpline Pills */}
                        <div className="hidden md:flex items-center gap-2 border border-slate-200 rounded p-1.5 bg-slate-50 text-[11px]">
                            <div className="text-center px-2 border-r border-slate-200">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">रुग्णवाहिका / Ambulance</span>
                                <strong className="text-red-700 font-extrabold text-xs">📞 108</strong>
                            </div>
                            <div className="text-center px-2 border-r border-slate-200">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">माता व बाल / 102</span>
                                <strong className="text-emerald-800 font-extrabold text-xs">📞 102</strong>
                            </div>
                            <div className="text-center px-2">
                                <span className="block text-[9px] text-slate-500 font-bold uppercase">आरोग्य सल्ला / Helpline</span>
                                <strong className="text-blue-800 font-extrabold text-xs">📞 104</strong>
                            </div>
                        </div>

                        {/* Staff / ABHA Login */}
                        <div className="flex items-center gap-1.5">
                            <Link
                                href="/login"
                                className="px-3 py-1.5 bg-white border border-[#1F3A6E] text-[#1F3A6E] hover:bg-[#F0F4FA] font-bold text-xs rounded transition-colors"
                            >
                                ABHA / Citizen
                            </Link>
                            <Link
                                href="/staff/login"
                                className="px-3 py-1.5 bg-[#1F3A6E] hover:bg-[#16294E] text-white font-bold text-xs rounded transition-colors shadow-sm"
                            >
                                Staff Login →
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
                                        ? 'bg-red-700 hover:bg-red-800 text-white border-red-500 px-3.5 animate-pulse'
                                        : isActive
                                        ? 'bg-[#16294E] text-amber-300 border-amber-400 font-extrabold shadow-sm'
                                        : 'text-slate-100 hover:bg-[#284B8C] hover:text-white border-transparent'
                                }`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <span>{language === 'en' ? link.labelEn : link.labelMr}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Official Announcement / Circular Marquee Strip */}
            <div className="bg-[#FFFBEB] border-b border-[#FDE68A] text-[#92400E] px-4 py-1 text-xs flex items-center gap-2 overflow-hidden">
                <span className="font-extrabold bg-[#F59E0B] text-slate-950 px-2 py-0.5 rounded text-[10px] uppercase flex-shrink-0">
                    महत्वाच्या सूचना
                </span>
                <div className="truncate text-[11px] font-medium">
                    24×7 CEmONC व BEmONC आपत्कालीन प्रसूती सेवा SDH अहेरी व DH गडचिरोली येथे पूर्णतः सक्रिय. 108 रुग्णवाहिका जीपीएस ट्रॅकिंग व ABHA आधारित टेलिमेडिसिन सुरू.
                </div>
            </div>
        </header>
    );
}
