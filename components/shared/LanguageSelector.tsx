/**
 * Language Selector Dropdown (English, Tamil, Hindi)
 * Styled for dark sidebar & glassmorphism interfaces
 */

'use client';

import { useState, useEffect } from 'react';
import { useLanguageStore, Language } from '@/stores/languageStore';

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguageStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const languages: Array<{ code: Language; label: string; flag: string }> = [
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
        { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    ];

    if (!mounted) {
        return (
            <div className="flex items-center justify-between gap-1 bg-white/10 p-1 rounded-xl border border-white/10 text-xs h-9">
                <div className="w-full text-center text-teal-100/50 text-[10px]">Loading languages...</div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-1 bg-white/10 p-1 rounded-xl border border-white/10 text-xs">
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex-1 py-1 px-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1 text-[11px] ${
                        language === lang.code
                            ? 'bg-teal-accent text-white shadow-md font-bold'
                            : 'text-teal-100/70 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                </button>
            ))}
        </div>
    );
}
