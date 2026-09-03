/**
 * GovHeader — GIGW-compliant Government of India header
 * Supports both Citizen (public) and Staff (authenticated) modes.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AccessibilityToolbar from './AccessibilityToolbar';

interface GovHeaderProps {
    mode: 'citizen' | 'staff';
    /** Staff: current user's role badge */
    roleBadge?: string;
    /** Staff: current facility name */
    facilityName?: string;
}

export default function GovHeader({ mode, roleBadge, facilityName }: GovHeaderProps) {
    const [locale, setLocale] = useState<'en' | 'hi' | 'ta'>('en');

    useEffect(() => {
        const saved = localStorage.getItem('gs-locale') as 'en' | 'hi' | 'ta' | null;
        if (saved) setLocale(saved);
    }, []);

    const handleLocaleChange = (newLocale: 'en' | 'hi' | 'ta') => {
        setLocale(newLocale);
        localStorage.setItem('gs-locale', newLocale);
        document.documentElement.lang = newLocale;
    };

    const titles: Record<string, { primary: string; sub: string }> = {
        en: { primary: 'NalamMesh', sub: 'Integrated Rural Public Healthcare Access & Quality Platform' },
        hi: { primary: 'नलममेश (NalamMesh)', sub: 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — महाराष्ट्र शासन' },
        ta: { primary: 'நலம்மெஷ் (NalamMesh)', sub: 'கிராமப்புற பொது சுகாதார ஒருங்கிணைந்த தளம் — அரசு தளம்' },
    };

    const govLabel: Record<string, string> = {
        en: 'Government of Maharashtra • Public Health Department | National Health Mission (NHM)',
        hi: 'सार्वजनिक आरोग्य विभाग • महाराष्ट्र शासन | राष्ट्रीय आरोग्य अभियान (NHM)',
        ta: 'பொது சுகாதாரத் துறை • தேசிய சுகாதார இயக்கம் (NHM)',
    };

    return (
        <header className="bg-white border-b border-border-subtle sticky top-0 z-40">
            {/* Government identification bar */}
            <div className="bg-gov-navy-dark text-white">
                <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                        {/* Ashoka Chakra / Emblem placeholder */}
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold" aria-label="Government Emblem">
                            🏛️
                        </div>
                        <span className="font-medium tracking-wide">
                            {govLabel[locale]}
                        </span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1">
                        {/* Language Switcher */}
                        {(['en', 'hi', 'ta'] as const).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => handleLocaleChange(lang)}
                                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                                    locale === lang
                                        ? 'bg-white text-gov-navy-dark'
                                        : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                                aria-label={`Switch to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Tamil'}`}
                                aria-pressed={locale === lang}
                            >
                                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'தமிழ்'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main header bar */}
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <Link href={mode === 'staff' ? '/staff' : '/'} className="flex items-center gap-3 min-w-0">
                    {/* Portal icon */}
                    <div className="w-10 h-10 bg-gov-navy rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-lg font-bold">GS</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-gov-navy leading-tight truncate">
                            {titles[locale].primary}
                        </h1>
                        <p className="text-xs text-txt-secondary truncate">
                            {titles[locale].sub}
                        </p>
                    </div>
                </Link>

                <div className="flex items-center gap-3">
                    <AccessibilityToolbar />

                    {mode === 'staff' && roleBadge && (
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-xs font-bold text-gov-navy bg-gov-blue-bg px-2.5 py-1 rounded-full">
                                {roleBadge}
                            </span>
                            {facilityName && (
                                <span className="text-xs text-txt-secondary">
                                    @ {facilityName}
                                </span>
                            )}
                        </div>
                    )}

                    {mode === 'citizen' ? (
                        <Link
                            href="/login"
                            className="gov-btn gov-btn-primary text-sm"
                        >
                            Login / ABHA
                        </Link>
                    ) : (
                        <Link
                            href="/staff/login"
                            className="gov-btn gov-btn-ghost text-sm"
                        >
                            Logout
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
