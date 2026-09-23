/**
 * NalamMesh Assistant — scope guard.
 *
 * The assistant is a fixture of this portal, not a general chatbot that happens
 * to live here. Its range is exactly two things:
 *
 *   1. This platform — what NalamMesh is, how it works offline, how a record
 *      reaches a hospital before the patient does, how it is built, its limits.
 *   2. Rural public healthcare in India — the clinical, facility, entitlement
 *      and scheme questions the app's own data speaks to.
 *
 * Anything else is declined. Two reasons this is a hard gate and not a request
 * in the prompt:
 *
 *   - A demo is judged on what it does in front of the judge. An assistant that
 *     will cheerfully write a poem invites exactly that question, and the answer
 *     it gives is no longer about the project.
 *   - Every out-of-scope question that reaches Layer 2 is a network round-trip
 *     and a billed token spend for an answer nobody wanted. Refusing here costs
 *     nothing and cannot fail.
 *
 * The rule is DEFAULT DENY: a question is out of scope unless something in it
 * positively places it in range. A permissive list of banned topics would have
 * to anticipate the whole world; a list of admitted topics only has to describe
 * this project, which is finite and known.
 *
 * This is Layer 1 of the guard. The backend's CHAT_SYSTEM_PROMPT carries the
 * same rule in words, so a question reaching /api/v1/chat by some other route
 * is still declined by the model. Neither layer is load-bearing alone.
 */

import type { Language } from '@/stores/languageStore';

/**
 * Topics that are declined even when a health or platform word appears in the
 * same sentence. "Write a poem about a nurse" is the shape this exists for:
 * the subject is in range, the task is not, and a signal-counting gate would
 * wave it through on the strength of "nurse".
 */
const HARD_DENY = [
    'poem', 'poetry', 'haiku', 'limerick', 'song about', 'lyrics', 'rap about',
    'joke', 'jokes', 'funny story', 'story about', 'essay about', 'essay on',
    'recipe', 'horoscope', 'astrology', 'zodiac', 'rashifal',
    'cricket', 'football', 'ipl ', 'world cup', 'who won',
    'movie', 'film review', 'netflix', 'actor', 'actress', 'celebrity',
    'bitcoin', 'crypto', 'stock price', 'share price', 'lottery', 'betting',
    'capital of', 'president of', 'prime minister of', 'weather in',
    'my homework', 'homework for',
];

/**
 * Ways somebody refers to this product without naming it. A judge almost never
 * types "NalamMesh" — they type "what does this do?", stood in front of it.
 * Matched as phrases, never as the bare pronoun, because "this" and "it" on
 * their own carry no subject at all.
 */
const SELF_REFERENCE = [
    'nalammesh', 'nalam mesh', 'this app', 'this application', 'this system',
    'this platform', 'this portal', 'this website', 'this site', 'this project',
    'this prototype', 'this solution', 'this software', 'this tool', 'this demo',
    'this product', 'this dashboard', 'the app', 'your app', 'your system',
    'your project', 'the platform', 'the portal', 'the project',
    'who are you', 'what are you', 'what can you do', 'what do you do',
    'how can you help', 'what can i ask', 'what do you know',
    // Verb-first phrasings, which is how the question usually arrives at a
    // stall: "who built this?", "why should we pick this over X?"
    'built this', 'build this', 'made this', 'making this', 'created this',
    'developed this', 'designed this', 'about this', 'pick this', 'choose this',
    'use this', 'using this', 'try this', 'why this', 'why should we',
    'your team', 'your approach', 'your solution', 'your work', 'your idea',
    'you built', 'you made', 'you solve', 'you handle',
    'यह ऐप', 'इस ऐप', 'यह सिस्टम', 'इस प्रणाली', 'हे अ‍ॅप', 'या अ‍ॅप',
];

/**
 * Distinctive multi-character terms, matched anywhere in the question so that
 * plurals and Indian-English compounds ("referral slip", "referrals") all hit
 * the same entry. Every term here is long enough that an accidental substring
 * match is not a realistic worry — the short and ambiguous ones live in
 * DOMAIN_WORDS instead, where they are matched as whole words.
 */
const DOMAIN_PHRASES = [
    // ── the platform's own story ────────────────────────────────────────────
    'offline', 'online', 'connectivity', 'internet', 'network', 'bandwidth',
    'architect', 'tech stack', 'technology', 'built with', 'built on', 'build it',
    'how does it work', 'how it works', 'how does this work',
    'indexeddb', 'fastapi', 'next.js', 'nextjs', 'sqlite', 'socket', 'relay',
    'mesh', 'cloud', 'server', 'backend', 'frontend', 'database', 'endpoint',
    'sync', 'upload', 'download', 'outbox', 'queue', 'token',
    // The app's own screens, by the names they carry in the sidebar. The
    // verify suite caught 'pre-arrival board' missing here: the retriever
    // answered it offline while the gate would have refused it.
    'pre-arrival', 'prearrival', 'arrival', 'board', 'incoming',
    'command centre', 'command center', 'high-risk', 'high risk',
    'edge ai', 'on-device', 'on device', 'tensorflow', 'machine learning',
    'rule engine', 'triage engine', 'algorithm',
    'scalab', 'deploy', 'secur', 'privacy', 'encrypt', 'consent',
    'de-identif', 'deidentif', 'anonymis', 'anonymiz',
    'smart india hackathon', 'hackathon', 'problem statement', '26133',
    'problem', 'solve', 'solving',
    'judge', 'evaluat', 'submission', 'innovat', 'novelty', 'unique', 'usp',
    'differenti', 'compet', 'limitation', 'roadmap', 'future', 'impact',
    'beneficiar', 'cost', 'budget', 'feature', 'screen', 'module', 'workflow',
    'dashboard', 'accessib', 'wcag', 'gigw', 'multilingual', 'marathi', 'hindi',

    // ── clinical ────────────────────────────────────────────────────────────
    'patient', 'triage', 'danger sign', 'red case', 'yellow case', 'green case',
    'emergency', 'ambulance', 'refer', 'transfer', 'admit', 'admission',
    'discharge', 'ward', 'bed', 'oxygen', 'saturation', 'vital', 'pulse',
    'blood pressure', 'heart rate', 'temperature', 'respirat', 'breath',
    'fever', 'cough', 'pain', 'bleed', 'wound', 'burn', 'fractur', 'injur',
    'trauma', 'accident', 'poison', 'snake', 'seizure', 'convuls', 'stroke',
    'cardiac', 'chest pain', 'unconscious', 'shock', 'sepsis',
    'pregnan', 'delivery', 'labour', 'labor pain', 'maternal', 'matern',
    'antenatal', 'postnatal', 'neonat', 'newborn', 'infant', 'child',
    'immunis', 'immuniz', 'vaccin', 'nutrition', 'malnutri', 'anemia', 'anaemia',
    'diabet', 'hypertens', 'tubercul', 'malaria', 'dengue', 'covid', 'leprosy',
    'diarrh', 'dehydrat', 'infection', 'symptom', 'disease', 'illness',
    'diagnos', 'screening', 'treatment', 'therapy', 'follow-up', 'followup',
    'medicine', 'medicat', 'pharmac', 'tablet', 'injection', 'dosage', 'dose',
    'stock', 'supply', 'expiry',
    'laborator', 'x-ray', 'xray', 'ct scan', 'ultrasound', 'sonograph',
    'blood bank', 'ventilator', 'incubator', 'equipment', 'diagnostic',

    // ── the system of care around it ────────────────────────────────────────
    'health centre', 'health center', 'sub-centre', 'sub centre', 'subcentre',
    'sub-center', 'primary health', 'community health', 'district hospital',
    'sub-district', 'wellness centre', 'dispensary', 'hospital', 'facilit',
    'clinic', 'anganwadi', 'village', 'rural', 'district', 'taluka', 'block',
    'medical officer', 'health worker', 'nurse', 'doctor', 'physician',
    'pharmacist', 'technician', 'staff', 'roster', 'shift',
    'ayushman', 'arogya', 'jan aushadhi', 'janani', 'e-sanjeevani', 'esanjeevani',
    'teleconsult', 'telemedicine', 'helpline', 'scheme', 'entitle', 'free treatment',
    'insurance', 'card', 'eligib', 'government', 'ministry', 'public health',
    'appointment', 'clinic day', 'schedule', 'timing', 'audit', 'record',
    'report', 'register', 'registration',

    // ── Devanagari: the terms a Hindi or Marathi speaker actually types ──────
    'रुग्ण', 'मरीज', 'रेफर', 'संदर्भ', 'रुग्णालय', 'अस्पताल', 'आरोग्य', 'स्वास्थ्य',
    'औषध', 'दवा', 'लसीकरण', 'टीका', 'गर्भ', 'प्रसूति', 'प्रसूती', 'बुखार', 'ताप',
    'आपात', 'आपत्कालीन', 'रुग्णवाहिका', 'एम्बुलेंस', 'केंद्र', 'तपासणी', 'जांच',
    'उपचार', 'योजना', 'मोफत', 'नि:शुल्क', 'ऑफलाइन', 'इंटरनेट',
];

/**
 * Short or ambiguous terms, matched only as whole words. "anc" inside
 * "balance" and "sc" inside "scan" are the reason this list is separated —
 * as substrings they would admit almost anything.
 */
const DOMAIN_WORDS = [
    'phc', 'chc', 'sdh', 'hwc', 'anm', 'asha', 'cho', 'opd', 'ipd', 'icu',
    'anc', 'pnc', 'ors', 'ncd', 'vhnd', 'tb', 'hiv', 'bp', 'spo2', 'ecg',
    'abha', 'nhm', 'nrhm', 'iphs', 'pmjay', 'jsy', 'jssk', 'rbsk', 'sih',
    'red', 'yellow', 'green', 'sos', 'app', 'api', 'ai', 'ui', 'ux', 'pwa',
    'scale', 'scaled', 'demo', 'judges', 'team',
];

/** Splits on anything that is not a letter, a combining mark or a digit.
 *  \p{M} matters: without it every Devanagari matra becomes a word boundary
 *  and Hindi words shatter into fragments that match nothing. */
const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

/**
 * Is this question something the NalamMesh Assistant answers at all?
 *
 * Pure and synchronous on purpose: the widget calls it between the offline
 * retriever and the cloud call, where anything slow or failable would be felt.
 */
export function isInScope(question: string): boolean {
    const q = question.toLowerCase().trim();
    if (!q) return false;

    if (HARD_DENY.some((term) => q.includes(term))) return false;
    if (SELF_REFERENCE.some((term) => q.includes(term))) return true;
    if (DOMAIN_PHRASES.some((term) => q.includes(term))) return true;

    const words = new Set(q.split(WORD_SPLIT).filter(Boolean));
    return DOMAIN_WORDS.some((w) => words.has(w));
}

/**
 * What the worker or visitor is shown when a question falls outside the range.
 *
 * Written as a boundary, not an apology, and it always says what IS in range —
 * a bare refusal teaches nothing and the next question is usually a rephrase of
 * the same one. Staff and public wordings differ because the useful examples
 * differ.
 */
export function outOfScopeReply(
    language: Language,
    isStaff: boolean
): { text: string; source: string } {
    if (language === 'hi') {
        return {
            text: isStaff
                ? 'यह सहायक केवल NalamMesh और ग्रामीण सार्वजनिक स्वास्थ्य सेवा से जुड़े प्रश्नों का उत्तर देता है। ट्राइएज सीमाएँ, रेफरल मार्ग, केंद्र की सेवाएँ, दवा स्टॉक, योजनाओं के लाभ, या यह ऐप कैसे काम करता है — यह पूछें।'
                : 'यह सहायक केवल NalamMesh और ग्रामीण स्वास्थ्य सेवा से जुड़े प्रश्नों का उत्तर देता है। कौन सा स्वास्थ्य केंद्र क्या सेवा देता है, क्लिनिक समय, नि:शुल्क योजनाएँ, या यह पोर्टल कैसे काम करता है — यह पूछें।',
            source: 'इस सहायक के दायरे से बाहर',
        };
    }
    if (language === 'mr') {
        return {
            text: isStaff
                ? 'हा सहाय्यक फक्त NalamMesh आणि ग्रामीण सार्वजनिक आरोग्य सेवेसंबंधी प्रश्नांची उत्तरे देतो. ट्राइएज मर्यादा, संदर्भ मार्ग, केंद्रातील सेवा, औषध साठा, योजनांचे लाभ, किंवा हे अ‍ॅप कसे चालते — हे विचारा.'
                : 'हा सहाय्यक फक्त NalamMesh आणि ग्रामीण आरोग्य सेवेसंबंधी प्रश्नांची उत्तरे देतो. कोणते आरोग्य केंद्र कोणती सेवा देते, क्लिनिक वेळ, मोफत योजना, किंवा हे पोर्टल कसे चालते — हे विचारा.',
            source: 'या सहाय्यकाच्या कार्यकक्षेबाहेर',
        };
    }
    return {
        text: isStaff
            ? 'This assistant only answers questions about NalamMesh and rural public healthcare. Ask about triage thresholds, referral routing, facility services, medicine stock, scheme entitlements, or how this platform works.'
            : 'This assistant only answers questions about NalamMesh and rural health services. Ask which health centre offers what, clinic timings, free-scheme entitlements, or how this portal works.',
        source: 'Outside this assistant’s scope',
    };
}
