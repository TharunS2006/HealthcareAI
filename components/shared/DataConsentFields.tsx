'use client';

/**
 * The data notice and consent step on a registration form
 * (lib/consent/dataConsent.ts). The worker reads the notice to the patient in
 * the language they understand, then records the basis: the patient's consent,
 * a parent's or guardian's, or a medical emergency (consent taken later).
 */

import { LANGUAGE_NAME, NOTICE, type ConsentBasis, type ConsentDraft, type DataConsent, type NoticeLanguage } from '@/lib/consent/dataConsent';

const T: Record<NoticeLanguage, {
    legend: string; readNotice: string; readIn: string; consent: string; guardian: string; emergency: string;
    guardianName: string; relation: string; declined: string; onRecord: string;
}> = {
    en: {
        legend: 'Data notice and consent (DPDP Act 2023)',
        readNotice: 'Read this notice to the patient',
        readIn: 'Notice read in',
        consent: 'Notice read — the patient consents',
        guardian: 'Notice read — a parent or guardian consents (needed under 18)',
        emergency: 'Medical emergency — give the notice and record consent later',
        guardianName: 'Parent’s or guardian’s name',
        relation: 'Relationship to the patient',
        declined: 'If the patient declines, do not register them here: treat them and write the visit on paper.',
        onRecord: 'Consent on record',
    },
    hi: {
        legend: 'डेटा सूचना और सहमति (DPDP अधिनियम 2023)',
        readNotice: 'यह सूचना रोगी को पढ़कर सुनाएँ',
        readIn: 'सूचना इस भाषा में पढ़ी गई',
        consent: 'सूचना पढ़ी गई — रोगी सहमत है',
        guardian: 'सूचना पढ़ी गई — माता-पिता या अभिभावक सहमत हैं (18 से कम उम्र में आवश्यक)',
        emergency: 'चिकित्सा आपात स्थिति — सूचना और सहमति बाद में दर्ज करें',
        guardianName: 'माता-पिता या अभिभावक का नाम',
        relation: 'रोगी से संबंध',
        declined: 'यदि रोगी मना करे, तो यहाँ पंजीकरण न करें: इलाज करें और जानकारी कागज़ पर लिखें।',
        onRecord: 'सहमति दर्ज है',
    },
    mr: {
        legend: 'डेटा सूचना आणि संमती (DPDP कायदा 2023)',
        readNotice: 'ही सूचना रुग्णाला वाचून दाखवा',
        readIn: 'सूचना या भाषेत वाचली',
        consent: 'सूचना वाचली — रुग्णाची संमती आहे',
        guardian: 'सूचना वाचली — पालक किंवा संरक्षकांची संमती आहे (18 वर्षांखालील रुग्णासाठी आवश्यक)',
        emergency: 'वैद्यकीय आणीबाणी — सूचना व संमती नंतर नोंदवा',
        guardianName: 'पालक किंवा संरक्षकाचे नाव',
        relation: 'रुग्णाशी नाते',
        declined: 'रुग्णाने नकार दिल्यास येथे नोंदणी करू नका: उपचार करा आणि भेटीची माहिती कागदावर लिहा.',
        onRecord: 'संमती नोंदवलेली आहे',
    },
};

const BASIS_LABEL: Record<ConsentBasis, Record<NoticeLanguage, string>> = {
    CONSENT: { en: 'patient’s consent', hi: 'रोगी की सहमति', mr: 'रुग्णाची संमती' },
    GUARDIAN_CONSENT: { en: 'guardian’s consent', hi: 'अभिभावक की सहमति', mr: 'पालकांची संमती' },
    MEDICAL_EMERGENCY: { en: 'medical emergency — consent pending', hi: 'चिकित्सा आपात स्थिति — सहमति बाकी', mr: 'वैद्यकीय आणीबाणी — संमती बाकी' },
};

export function consentSummary(c: DataConsent, lang: NoticeLanguage = 'en'): string {
    const when = new Date(c.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const via = c.noticeLanguage ? ` · ${LANGUAGE_NAME[c.noticeLanguage]}` : '';
    const who = c.basis === 'GUARDIAN_CONSENT' && c.guardianName ? ` (${c.guardianName}${c.guardianRelation ? `, ${c.guardianRelation}` : ''})` : '';
    return `${BASIS_LABEL[c.basis][lang]}${who}${via} · ${when}${c.recordedByName ? ` · ${c.recordedByName}` : ''}`;
}

/** Read-only line for a patient whose consent is already recorded. */
export function ConsentOnRecord({ consent, lang }: { consent: DataConsent; lang: NoticeLanguage }) {
    return (
        <p className="text-xs border border-emerald-300 bg-emerald-50 text-emerald-900 rounded px-3 py-2">
            <strong>{T[lang].onRecord}:</strong> {consentSummary(consent, lang)}
        </p>
    );
}

export default function DataConsentFields({ idPrefix, value, onChange, lang, allowEmergency = true }: {
    idPrefix: string;
    value: ConsentDraft;
    onChange: (next: ConsentDraft) => void;
    lang: NoticeLanguage;
    /** False when completing an emergency registration's consent. */
    allowEmergency?: boolean;
}) {
    const t = T[lang];
    const notice = NOTICE[value.language];
    const options: ConsentBasis[] = allowEmergency ? ['CONSENT', 'GUARDIAN_CONSENT', 'MEDICAL_EMERGENCY'] : ['CONSENT', 'GUARDIAN_CONSENT'];
    const optionLabel: Record<ConsentBasis, string> = { CONSENT: t.consent, GUARDIAN_CONSENT: t.guardian, MEDICAL_EMERGENCY: t.emergency };
    const input = 'w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1F3A6E]';

    return (
        <fieldset className="border border-slate-300 rounded p-3 space-y-2 text-xs">
            <legend className="px-1 font-black text-[#1F3A6E] text-[11px] uppercase tracking-wide">
                {t.legend} <span className="text-red-600">*</span>
            </legend>

            <div className="flex items-center gap-2">
                <label htmlFor={`${idPrefix}-notice-lang`} className="font-bold text-slate-700">{t.readIn}</label>
                <select
                    id={`${idPrefix}-notice-lang`}
                    value={value.language}
                    onChange={(e) => onChange({ ...value, language: e.target.value as NoticeLanguage })}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                >
                    {(['mr', 'hi', 'en'] as const).map((l) => <option key={l} value={l}>{LANGUAGE_NAME[l]}</option>)}
                </select>
            </div>

            <details className="bg-slate-50 border border-slate-200 rounded">
                <summary className="cursor-pointer px-2 py-1.5 font-bold text-slate-800">{t.readNotice}</summary>
                <div className="px-3 pb-2" lang={value.language}>
                    <p className="font-bold text-slate-900 mt-1">{notice.title}</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-800 mt-1">
                        {notice.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                </div>
            </details>

            <div className="space-y-1">
                {options.map((basis) => (
                    <label key={basis} className="flex items-start gap-2 cursor-pointer font-bold text-slate-800">
                        <input
                            type="radio"
                            name={`${idPrefix}-consent-basis`}
                            value={basis}
                            checked={value.basis === basis}
                            onChange={() => onChange({ ...value, basis })}
                            className="mt-0.5 w-4 h-4 accent-[#1F3A6E]"
                        />
                        <span>{optionLabel[basis]}</span>
                    </label>
                ))}
            </div>

            {value.basis === 'GUARDIAN_CONSENT' && (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor={`${idPrefix}-guardian`} className="block font-bold text-slate-700 mb-1">{t.guardianName} <span className="text-red-600">*</span></label>
                        <input id={`${idPrefix}-guardian`} type="text" value={value.guardianName} onChange={(e) => onChange({ ...value, guardianName: e.target.value })} className={input} />
                    </div>
                    <div>
                        <label htmlFor={`${idPrefix}-relation`} className="block font-bold text-slate-700 mb-1">{t.relation} <span className="text-red-600">*</span></label>
                        <input id={`${idPrefix}-relation`} type="text" value={value.guardianRelation} onChange={(e) => onChange({ ...value, guardianRelation: e.target.value })} className={input} />
                    </div>
                </div>
            )}

            <p className="text-slate-700">{t.declined}</p>
        </fieldset>
    );
}
