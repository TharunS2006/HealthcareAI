/**
 * Language Selector component — Marathi, Hindi, English, Tamil, Telugu, Bengali
 */

'use client';

import { useLanguageStore, Language } from '@/stores/languageStore';

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguageStore();

    const languages: { code: Language; label: string; sub: string }[] = [
        { code: 'mr', label: 'मराठी', sub: 'MR' },
        { code: 'hi', label: 'हिन्दी', sub: 'HI' },
        { code: 'en', label: 'English', sub: 'EN' },
        { code: 'ta', label: 'தமிழ்', sub: 'TA' },
        { code: 'te', label: 'తెలుగు', sub: 'TE' },
        { code: 'bn', label: 'বাংলা', sub: 'BN' },
    ];

    return (
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-border-subtle p-1 rounded-xl shadow-sm overflow-x-auto max-w-full">
            {languages.map((l) => (
                <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        language === l.code
                            ? 'bg-emerald-deep text-white shadow-sm'
                            : 'text-txt-secondary hover:text-emerald-deep hover:bg-teal-50/50'
                    }`}
                    title={l.label}
                >
                    <span>{l.label}</span>
                </button>
            ))}
        </div>
    );
}
