/**
 * Every page of an evaluation build says what it is: the patients, referrals
 * and staff are fictional, and the demo accounts share a public PIN. Nobody
 * should mistake the demonstration district for real records, or put a real
 * patient into it. A production build (lib/config/mode.ts) shows nothing.
 */

'use client';

import { PRODUCTION } from '@/lib/config/mode';
import { DEMO_PIN } from '@/lib/auth/users';
import { useLanguageStore } from '@/stores/languageStore';

export default function EvaluationBanner() {
    const language = useLanguageStore(s => s.language);
    if (PRODUCTION) return null;
    const text = language === 'hi'
        ? `मूल्यांकन संस्करण — दिखाए गए मरीज़, रेफरल और कर्मचारी काल्पनिक हैं; डेमो खातों का सार्वजनिक PIN ${DEMO_PIN} है। वास्तविक मरीज़ की जानकारी दर्ज न करें।`
        : language === 'mr'
        ? `मूल्यांकन आवृत्ती — दाखवलेले रुग्ण, संदर्भ व कर्मचारी काल्पनिक आहेत; डेमो खात्यांचा सार्वजनिक PIN ${DEMO_PIN} आहे. खऱ्या रुग्णाची माहिती भरू नका.`
        : `Evaluation build — the patients, referrals and staff shown are fictional, and the demo accounts use the public PIN ${DEMO_PIN}. Do not enter real patient data.`;
    return (
        <div role="note" className="bg-[#FFF4D6] border-b border-[#E3B341] text-[#5C4200] text-[11.5px] font-semibold px-4 py-1.5 text-center">
            {text}
        </div>
    );
}
