/**
 * EmergencyFAB — Floating red emergency button visible on EVERY screen.
 * One-tap emergency escalation (M13).
 * Trilingual localization: English, Marathi, Hindi
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguageStore } from '@/stores/languageStore';

export default function EmergencyFAB() {
    const [expanded, setExpanded] = useState(false);
    const { language } = useLanguageStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    const t = {
        title: isEn ? 'Emergency Escalation' : isHi ? 'आपातकालीन सहायता' : 'तातडीची मदत (SOS)',
        desc: isEn
            ? 'This will send an emergency alert with your health summary to the nearest higher-tier facility.'
            : isHi
            ? 'यह आपके स्वास्थ्य सारांश के साथ निकटतम उच्च स्तरीय अस्पताल को आपातकालीन अलर्ट भेजेगा।'
            : 'हे तात्काळ जवळच्या उपजिल्हा/जिल्हा रुग्णालयाला आपत्कालीन सूचना पाठवेल.',
        call108: isEn ? '🚑 Call 108 Ambulance' : isHi ? '🚑 १०८ एम्बुलेंस कॉल करें' : '🚑 १०८ रुग्णवाहिका बोलवा',
        call102: isEn ? '🤰 Call 102 Maternal' : isHi ? '🤰 १०२ जननी एक्सप्रेस' : '🤰 १०२ जननी-शिशु वाहन',
        digitalAlert: isEn ? 'Send Digital Alert' : isHi ? 'डिजिटल अलर्ट भेजें' : 'डिजिटल अलर्ट पाठवा',
        cancel: isEn ? 'Cancel' : isHi ? 'रद्द करें' : 'रद्द करा',
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 emergency-fab">
            {expanded && (
                <div className="mb-3 bg-white rounded-2xl shadow-2xl border-2 border-red-500 p-4 w-72 animate-fade-in">
                    <h3 className="text-sm font-black text-red-700 mb-1">{t.title}</h3>
                    <p className="text-xs text-slate-600 mb-3">
                        {t.desc}
                    </p>
                    <div className="space-y-2">
                        <a
                            href="tel:108"
                            className="block text-center py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                        >
                            {t.call108}
                        </a>
                        <a
                            href="tel:102"
                            className="block text-center py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                        >
                            {t.call102}
                        </a>
                        <Link
                            href="/emergency"
                            className="block text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all"
                            onClick={() => setExpanded(false)}
                        >
                            {t.digitalAlert}
                        </Link>
                    </div>
                    <button
                        onClick={() => setExpanded(false)}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-700 w-full text-center py-1"
                    >
                        {t.cancel}
                    </button>
                </div>
            )}

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-14 h-14 rounded-full bg-red-600 text-white shadow-2xl hover:bg-red-700 transition-all flex items-center justify-center text-xl font-bold border-2 border-white cursor-pointer"
                aria-label="Emergency help — call 108, 102, or send digital alert"
                title={t.title}
            >
                {expanded ? '✕' : 'SOS'}
            </button>
        </div>
    );
}
