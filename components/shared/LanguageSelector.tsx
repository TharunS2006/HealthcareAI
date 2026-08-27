/**
 * Language Selector component — Marathi, Hindi, English
 */

'use client';

import { useLanguageStore, Language } from '@/stores/languageStore';

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguageStore();

    const languages: { code: Language; label: string; flag: string }[] = [
        { code: 'mr', label: 'मराठी', flag: '🚩' },
        { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
        { code: 'en', label: 'English', flag: '🌐' },
    ];

    return (
        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-border-subtle p-1 rounded-xl shadow-sm">
            {languages.map((l) => (
                <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        language === l.code
                            ? 'bg-emerald-deep text-white shadow-sm'
                            : 'text-txt-secondary hover:text-emerald-deep hover:bg-gray-100/60'
                    }`}
                >
                    <span className="mr-1">{l.flag}</span>
                    {l.label}
                </button>
            ))}
        </div>
    );
}
