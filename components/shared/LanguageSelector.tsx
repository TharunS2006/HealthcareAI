/**
 * Language Selector component — Official Government Portal Standard
 * Marathi (मराठी), Hindi (हिन्दी), English
 */

'use client';

import { useLanguageStore, Language } from '@/stores/languageStore';

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguageStore();

    const languages: { code: Language; label: string }[] = [
        { code: 'mr', label: 'मराठी' },
        { code: 'hi', label: 'हिन्दी' },
        { code: 'en', label: 'English' },
    ];

    return (
        <div className="flex items-center gap-1 bg-white border border-slate-300 p-0.5 rounded">
            {languages.map((l) => (
                <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        language === l.code
                            ? 'bg-[#1F3A6E] text-white shadow-none'
                            : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    title={l.label}
                >
                    <span>{l.label}</span>
                </button>
            ))}
        </div>
    );
}
