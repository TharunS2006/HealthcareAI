/**
 * NalamMesh Assistant — floating decision-support widget, open to staff and public.
 *
 * Two layers, in this order:
 *   1. lib/chat/retrieve.ts — offline lookup over the app's own facility, threshold
 *      and entitlement data. Composes answers from real records, so it cannot invent
 *      a fact, and it works with the network down.
 *   2. lib/chat/cloudClient.ts — the district service's Claude endpoint, used only
 *      when Layer 1 finds nothing and the device is online.
 *
 * Open to everyone. A signed-in worker gets their cadre's answers (the navigation map
 * filters by role); a visitor with no session gets the same protocol facts plus only
 * the screens marked 'ALL', which is what a member of the public should see.
 *
 * The assistant never states a dose and never lowers a triage priority — those rules
 * are enforced in Layer 1 by composition (it only reads thresholds) and in Layer 2 by
 * the backend system prompt. Both hold regardless of who is asking.
 *
 * It sits in the corner the Emergency SOS launcher used to occupy, so it carries the
 * 108/102 numbers in its header: removing that button must not remove the fastest
 * path to an ambulance. /emergency remains in the sidebar for the full dispatch flow.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import { retrieveOffline } from '@/lib/chat/retrieve';
import { askCloud, type CloudResult } from '@/lib/chat/cloudClient';
import { renderAnswer } from '@/lib/chat/renderAnswer';
import { isInScope, outOfScopeReply } from '@/lib/chat/scopeGuard';

interface Turn {
    id: string;
    question: string;
    answer: string;
    source: string;
    layer: 'offline' | 'cloud' | 'none' | 'out-of-scope';
}

export default function ChatAssistant() {
    const { role, name } = useAuthStore();
    const { language } = useLanguageStore();

    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isEn = language === 'en';
    const isHi = language === 'hi';
    // Drives the wording only. Both audiences get the same facts and the same
    // no-dose / escalate-only guarantees; a visitor is not told to go ask the
    // Medical Officer they do not have.
    const isStaff = Boolean(role);

    const t = {
        launch: isEn ? 'Ask the NalamMesh Assistant' : isHi ? 'नलममेश सहायक से पूछें' : 'नलममेश सहाय्यकाला विचारा',
        title: isEn ? 'NalamMesh Assistant' : isHi ? 'नलममेश सहायक' : 'नलममेश सहाय्यक',
        subtitle: isStaff
            ? (isEn ? 'Protocol decision support for health staff' : isHi ? 'स्वास्थ्य कर्मियों हेतु प्रोटोकॉल सहायता' : 'आरोग्य कर्मचाऱ्यांसाठी प्रोटोकॉल सहाय्य')
            : (isEn ? 'Health information from this portal\'s own records' : isHi ? 'इसी पोर्टल के अभिलेखों से स्वास्थ्य जानकारी' : 'याच पोर्टलच्या नोंदींमधून आरोग्य माहिती'),
        // The SOS launcher used to live in this corner. Its numbers stay on screen.
        emergency: isEn ? 'Medical emergency? Call 108 (ambulance) or 102 (maternity).' : isHi ? 'आपातकाल? 108 (एम्बुलेंस) या 102 (प्रसूति) पर कॉल करें।' : 'तातडीची स्थिती? 108 (रुग्णवाहिका) किंवा 102 (प्रसूती) वर कॉल करा.',
        emergencyLink: isEn ? 'Open emergency dispatch' : isHi ? 'आपातकालीन डिस्पैच खोलें' : 'आपत्कालीन डिस्पॅच उघडा',
        close: isEn ? 'Close assistant' : isHi ? 'सहायक बंद करें' : 'सहाय्यक बंद करा',
        placeholder: isEn ? 'e.g. Where do I refer a RED case?' : isHi ? 'जैसे: RED केस कहाँ रेफर करें?' : 'उदा. RED रुग्ण कुठे संदर्भित करावा?',
        send: isEn ? 'Ask' : isHi ? 'पूछें' : 'विचारा',
        thinking: isEn ? 'Checking protocols…' : isHi ? 'प्रोटोकॉल देखे जा रहे हैं…' : 'प्रोटोकॉल तपासत आहे…',
        sourceLabel: isEn ? 'Source' : isHi ? 'स्रोत' : 'स्रोत',
        offlineBadge: isEn ? 'Offline — app data' : isHi ? 'ऑफलाइन — ऐप डेटा' : 'ऑफलाइन — अ‍ॅप डेटा',
        cloudBadge: isEn ? 'Cloud assistant' : isHi ? 'क्लाउड सहायक' : 'क्लाउड सहाय्यक',
        // A turn that answered nothing must not wear the app-data badge — the
        // provenance line is the one thing a reader uses to weigh the answer.
        noAnswerBadge: isEn ? 'No entry found' : isHi ? 'कोई जानकारी नहीं' : 'नोंद सापडली नाही',
        greeting: isStaff
            ? (isEn
                ? 'Ask about danger-sign thresholds, referral routing, facility services, entitlements or clinic schedules. Answers come from this app\'s own data.'
                : isHi
                    ? 'खतरे के संकेत, रेफरल मार्ग, सुविधा सेवाएँ, हकदारी या क्लिनिक समय पूछें। उत्तर इसी ऐप के डेटा से आते हैं।'
                    : 'धोक्याची लक्षणे, संदर्भ मार्ग, सुविधा सेवा, हक्क किंवा क्लिनिक वेळ विचारा. उत्तरे याच अ‍ॅपच्या डेटामधून येतात.')
            : (isEn
                ? 'Ask which health centre offers what, clinic timings, free-scheme entitlements, or where to go for a particular treatment. Answers come from this portal\'s own records.'
                : isHi
                    ? 'कौन सा स्वास्थ्य केंद्र क्या सेवा देता है, क्लिनिक समय, नि:शुल्क योजना का लाभ, या इलाज हेतु कहाँ जाएँ — पूछें। उत्तर इसी पोर्टल के अभिलेखों से आते हैं।'
                    : 'कोणते आरोग्य केंद्र कोणती सेवा देते, क्लिनिक वेळ, मोफत योजनांचे लाभ, किंवा उपचारासाठी कुठे जावे — विचारा. उत्तरे याच पोर्टलच्या नोंदींमधून येतात.'),
        disclaimer: isStaff
            ? (isEn
                ? 'Decision support only — not a diagnosis. Never states medicine doses. Confirm with your Medical Officer.'
                : isHi
                    ? 'केवल निर्णय सहायता — निदान नहीं। दवा की मात्रा कभी नहीं बताता। अपने चिकित्सा अधिकारी से पुष्टि करें।'
                    : 'फक्त निर्णय सहाय्य — निदान नाही. औषधाची मात्रा कधीही सांगत नाही. वैद्यकीय अधिकाऱ्यांकडून खात्री करा.')
            : (isEn
                ? 'Information only — not a diagnosis. Never states medicine doses. See a doctor before acting on anything here.'
                : isHi
                    ? 'केवल जानकारी — निदान नहीं। दवा की मात्रा कभी नहीं बताता। कोई भी कदम उठाने से पहले डॉक्टर से मिलें।'
                    : 'फक्त माहिती — निदान नाही. औषधाची मात्रा कधीही सांगत नाही. कृती करण्यापूर्वी डॉक्टरांना भेटा.'),
        noAnswerOffline: isStaff
            ? (isEn
                ? 'I have no protocol entry for that, and the device is offline so I cannot ask the cloud assistant. Contact your supervising Medical Officer or the district helpline.'
                : isHi
                    ? 'इसके लिए मेरे पास कोई प्रोटोकॉल नहीं है, और डिवाइस ऑफलाइन है। अपने चिकित्सा अधिकारी या जिला हेल्पलाइन से संपर्क करें।'
                    : 'यासाठी माझ्याकडे प्रोटोकॉल नोंद नाही, आणि उपकरण ऑफलाइन आहे. वैद्यकीय अधिकारी किंवा जिल्हा हेल्पलाइनशी संपर्क साधा.')
            : (isEn
                ? 'I have no entry for that, and this device is offline. Please visit your nearest health centre, or call the 104 health helpline.'
                : isHi
                    ? 'इसके लिए मेरे पास जानकारी नहीं है, और डिवाइस ऑफलाइन है। नजदीकी स्वास्थ्य केंद्र जाएँ या 104 हेल्पलाइन पर कॉल करें।'
                    : 'यासाठी माझ्याकडे नोंद नाही, आणि उपकरण ऑफलाइन आहे. जवळच्या आरोग्य केंद्रात जा किंवा 104 हेल्पलाइनवर कॉल करा.'),
        noAnswerCloud: isStaff
            ? (isEn
                ? 'The cloud assistant is not available right now and I have no offline protocol entry for that. Contact your supervising Medical Officer or the district helpline.'
                : isHi
                    ? 'क्लाउड सहायक अभी उपलब्ध नहीं है और ऑफलाइन प्रोटोकॉल भी नहीं है। अपने चिकित्सा अधिकारी से संपर्क करें।'
                    : 'क्लाउड सहाय्यक सध्या उपलब्ध नाही व ऑफलाइन प्रोटोकॉल नोंदही नाही. वैद्यकीय अधिकाऱ्यांशी संपर्क साधा.')
            : (isEn
                ? 'I have no entry for that and cannot reach the assistant right now. Please visit your nearest health centre, or call the 104 health helpline.'
                : isHi
                    ? 'इसके लिए जानकारी नहीं है और सहायक से संपर्क नहीं हो पा रहा। नजदीकी स्वास्थ्य केंद्र जाएँ या 104 पर कॉल करें।'
                    : 'यासाठी नोंद नाही व सहाय्यकाशी संपर्क होत नाही. जवळच्या आरोग्य केंद्रात जा किंवा 104 वर कॉल करा.'),
        outOfScopeBadge: isEn ? 'Outside scope' : isHi ? 'दायरे से बाहर' : 'कार्यकक्षेबाहेर',
        noAnswerSource: isEn ? 'No matching entry in this portal' : isHi ? 'इस पोर्टल में कोई मिलती-जुलती जानकारी नहीं' : 'या पोर्टलमध्ये जुळणारी नोंद नाही',
    };

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [turns, isThinking]);

    const cloudFailureText = (reason: CloudResult['reason']): string =>
        reason === 'offline' ? t.noAnswerOffline : t.noAnswerCloud;

    const handleAsk = async (event: React.FormEvent) => {
        event.preventDefault();
        const question = draft.trim();
        if (!question || isThinking) return;

        setDraft('');
        setIsThinking(true);

        const local = retrieveOffline(question, { role, language });
        if (local) {
            setTurns((prev) => [
                ...prev,
                { id: `${Date.now()}`, question, answer: local.text, source: local.source, layer: 'offline' },
            ]);
            setIsThinking(false);
            return;
        }

        // The gate sits here rather than inside askCloud's failure handling so
        // that a declined question never becomes a network request, and never
        // reads as "the cloud is down" — two different things that the worker
        // would otherwise see the same sentence for.
        if (!isInScope(question)) {
            const declined = outOfScopeReply(language, isStaff);
            setTurns((prev) => [
                ...prev,
                { id: `${Date.now()}`, question, answer: declined.text, source: declined.source, layer: 'out-of-scope' },
            ]);
            setIsThinking(false);
            return;
        }

        const cloud = await askCloud(question, { role, language });
        setTurns((prev) => [
            ...prev,
            cloud.answer
                ? {
                    id: `${Date.now()}`,
                    question,
                    answer: cloud.answer,
                    source: `${t.cloudBadge}${cloud.model ? ` · ${cloud.model}` : ''}`,
                    layer: 'cloud' as const,
                }
                : {
                    id: `${Date.now()}`,
                    question,
                    answer: cloudFailureText(cloud.reason),
                    source: t.noAnswerSource,
                    layer: 'none' as const,
                },
        ]);
        setIsThinking(false);
    };

    // bottom-5 right-5 z-50 is the slot the Emergency SOS launcher used to hold.
    // Nothing else is fixed to that corner now, so the assistant takes it outright.
    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label={t.launch}
                className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gov-navy px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-gov-navy-hover focus:outline-none focus:ring-2 focus:ring-gov-saffron focus:ring-offset-2"
            >
                <ChatIcon />
                <span className="hidden sm:inline">{t.title}</span>
            </button>
        );
    }

    return (
        <section
            role="dialog"
            aria-label={t.title}
            className="fixed bottom-5 right-5 left-4 z-50 flex max-h-[min(32rem,70vh)] flex-col overflow-hidden rounded border border-gov-navy bg-white shadow-2xl sm:left-auto sm:w-[26rem]"
        >
            <header className="flex items-start justify-between gap-3 bg-gov-navy px-4 py-3 text-white">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-sm font-bold">
                        <ChatIcon />
                        {t.title}
                    </h2>
                    <p className="mt-0.5 text-[0.6875rem] leading-snug text-white/80">
                        {/* A visitor has no cadre to show, so the identity half is dropped
                            rather than rendered as a dangling separator. */}
                        {role ? `${t.subtitle} · ${name ? `${name} (${role})` : role}` : t.subtitle}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label={t.close}
                    className="rounded p-1 text-xl leading-none text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-gov-saffron"
                >
                    ×
                </button>
            </header>

            {/* Stays pinned above the scroll area: in an emergency nobody should have
                to scroll a chat log to find the ambulance number. */}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gov-red bg-gov-red-bg px-4 py-2 text-[0.6875rem] font-semibold leading-snug text-gov-red">
                <span>{t.emergency}</span>
                <a
                    href="/emergency"
                    className="underline underline-offset-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-gov-navy"
                >
                    {t.emergencyLink}
                </a>
            </p>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#F4F6FA] px-4 py-3">
                <p className="rounded border border-gov-blue-border bg-gov-blue-bg p-2.5 text-[0.75rem] leading-relaxed text-gov-navy-dark">
                    {t.greeting}
                </p>

                {turns.map((turn) => (
                    <div key={turn.id} className="space-y-1.5">
                        <p className="ml-auto max-w-[85%] rounded bg-gov-navy px-3 py-2 text-[0.8125rem] text-white">
                            {turn.question}
                        </p>
                        <div className="max-w-[92%] rounded border border-slate-300 bg-white px-3 py-2">
                            <div className="space-y-1 text-[0.8125rem] leading-relaxed text-gov-navy-dark">
                                {renderAnswer(turn.answer)}
                            </div>
                            <p className="mt-2 border-t border-slate-200 pt-1.5 text-[0.6875rem] leading-snug text-slate-600">
                                <span
                                    className={`mr-1.5 inline-block rounded-sm px-1.5 py-0.5 font-semibold ${
                                        turn.layer === 'offline'
                                            ? 'bg-gov-green-bg text-gov-green-dark'
                                            : turn.layer === 'cloud'
                                                ? 'bg-gov-blue-bg text-gov-blue'
                                                // Amber reads as "something went wrong", which a
                                                // declined question is not — it is the assistant
                                                // working as designed, so it gets a neutral chip.
                                                : turn.layer === 'out-of-scope'
                                                    ? 'bg-slate-100 text-slate-600'
                                                    : 'bg-gov-amber-bg text-gov-amber'
                                    }`}
                                >
                                    {turn.layer === 'cloud'
                                        ? t.cloudBadge
                                        : turn.layer === 'offline'
                                            ? t.offlineBadge
                                            : turn.layer === 'out-of-scope'
                                                ? t.outOfScopeBadge
                                                : t.noAnswerBadge}
                                </span>
                                {t.sourceLabel}: {turn.source}
                            </p>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <p className="text-[0.75rem] italic text-slate-600" aria-live="polite">
                        {t.thinking}
                    </p>
                )}
            </div>

            <form onSubmit={handleAsk} className="border-t border-slate-300 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <input
                        id="nalammesh-assistant-input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t.placeholder}
                        aria-label={t.placeholder}
                        className="flex-1 rounded border border-slate-400 px-2.5 py-2 text-[0.8125rem] text-gov-navy-dark focus:border-gov-navy focus:outline-none focus:ring-1 focus:ring-gov-navy"
                    />
                    <button
                        type="submit"
                        disabled={isThinking || !draft.trim()}
                        className="rounded bg-gov-navy px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-gov-navy-hover disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                        {t.send}
                    </button>
                </div>
                <p className="mt-1.5 text-[0.6875rem] leading-snug text-slate-600">{t.disclaimer}</p>
            </form>
        </section>
    );
}

function ChatIcon() {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h11A2.5 2.5 0 0 1 18 5.5v7a2.5 2.5 0 0 1-2.5 2.5H8.9l-3.6 2.7A.75.75 0 0 1 4 17.1V15h-.5A1.5 1.5 0 0 1 2 13.5v-8Z" />
        </svg>
    );
}
