/**
 * GovHeader — GIGW-compliant Government of India header
 * Department of Public Health • Government of Maharashtra
 * Synchronized with master useLanguageStore
 */

'use client';

import Link from 'next/link';
import AccessibilityToolbar from './AccessibilityToolbar';
import StateEmblem from './StateEmblem';
import { useLanguageStore, Language } from '@/stores/languageStore';

interface GovHeaderProps {
    mode: 'citizen' | 'staff';
    /** Staff: current user's role badge */
    roleBadge?: string;
    /** Staff: current facility name */
    facilityName?: string;
}

export default function GovHeader({ mode, roleBadge, facilityName }: GovHeaderProps) {
    const { language, setLanguage } = useLanguageStore();

    const currentLang: Language = language || 'en';

    const titles: Record<string, { primary: string; sub: string }> = {
        en: { primary: 'NalamMesh', sub: 'National Rural Public Healthcare Infrastructure • Government of Maharashtra' },
        mr: { primary: 'नलममेश', sub: 'ग्रामीण सार्वजनिक आरोग्य सेवा एकात्मिक मंच — महाराष्ट्र शासन' },
        hi: { primary: 'नलममेश', sub: 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — महाराष्ट्र सरकार' },
        ta: { primary: 'நலம்மெஷ்', sub: 'கிராமப்புற பொது சுகாதார ஒருங்கிணைந்த தளம் — அரசு தளம்' },
    };

    const govLabel: Record<string, string> = {
        en: 'Government of Maharashtra • Public Health Department | National Health Mission (NHM)',
        mr: 'सार्वजनिक आरोग्य विभाग • महाराष्ट्र शासन | राष्ट्रीय आरोग्य अभियान (NHM)',
        hi: 'सार्वजनिक स्वास्थ्य विभाग • महाराष्ट्र सरकार | राष्ट्रीय स्वास्थ्य मिशन (NHM)',
        ta: 'பொது சுகாதாரத் துறை • தேசிய சுகாதார இயக்கம் (NHM)',
    };

    const titleObj = titles[currentLang] || titles.en;
    const labelStr = govLabel[currentLang] || govLabel.en;

    return (
        <header className="bg-white border-b border-slate-300 sticky top-0 z-40">
            {/* Government identification bar */}
            <div className="bg-[#1F3A6E] text-white">
                <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                        <StateEmblem size={20} light />
                        <span className="font-bold tracking-wide text-[11px] sm:text-xs">
                            {labelStr}
                        </span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1">
                        {/* Language Switcher */}
                        {(['mr', 'hi', 'en'] as const).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                                    currentLang === lang
                                        ? 'bg-amber-400 text-slate-950 font-black'
                                        : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                                aria-label={`Switch to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Marathi'}`}
                                aria-pressed={currentLang === lang}
                            >
                                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'मराठी'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main header bar */}
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                <Link href={mode === 'staff' ? '/staff' : '/'} className="flex items-center gap-3.5 min-w-0">
                    <StateEmblem size={38} />
                    <div className="min-w-0 border-l border-slate-300 pl-3">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-black text-[#1F3A6E] leading-tight truncate">
                                {titleObj.primary}
                            </h1>
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 rounded">
                                NHM
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                            {titleObj.sub}
                        </p>
                    </div>
                </Link>

                <div className="flex items-center gap-3">
                    <AccessibilityToolbar />

                    {mode === 'staff' && roleBadge && (
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1F3A6E] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                                {roleBadge}
                            </span>
                            {facilityName && (
                                <span className="text-xs text-slate-600 font-medium">
                                    @ {facilityName}
                                </span>
                            )}
                        </div>
                    )}

                    {mode === 'citizen' ? (
                        <Link
                            href="/login"
                            className="px-3.5 py-1.5 bg-[#1F3A6E] text-white text-xs font-bold rounded hover:bg-[#162A50] shadow-sm transition-colors"
                        >
                            {currentLang === 'en' ? 'Login / ABHA ID' : 'लॉगिन / ABHA ID'}
                        </Link>
                    ) : (
                        <Link
                            href="/staff/login"
                            className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-100 transition-colors"
                        >
                            {currentLang === 'en' ? 'Logout' : 'लॉगआउट'}
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
