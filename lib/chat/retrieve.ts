/**
 * NalamMesh Assistant — offline retrieval (Layer 1).
 *
 * Keyword-scored lookup against lib/chat/knowledgeBase.ts. Runs with no network
 * and answers the majority of point-of-care questions (danger signs, "where do
 * I send this patient", schemes, schedules, stock, app navigation) by composing
 * real data — never a generated sentence, so it cannot hallucinate a fact.
 *
 * Returns null when no intent scores high enough to trust; the caller (the chat
 * widget) then either says "I don't know" outright, or — if online — asks
 * Layer 2 (the cloud LLM), itself grounded in this same knowledge base.
 */

import type { Language } from '@/stores/languageStore';
import type { FacilityType } from '@/types/facility';
import {
    CLINICAL_THRESHOLDS,
    listFacilities,
    findFacilitiesByService,
    referralGuidance,
    entitlementsAt,
    medicineStockAt,
    scheduleAt,
    routesForRole,
    localize,
} from './knowledgeBase';

export interface ChatAnswer {
    text: string;
    source: string;
    confidence: 'high' | 'medium';
}

interface Intent {
    name: string;
    keywords: string[];
    /**
     * Recognises the *shape* of a question rather than its exact wording.
     *
     * The keyword list above only fires on phrases somebody thought to write
     * down, so "Where do I refer a RED case?" — the app's own placeholder —
     * matched nothing and the assistant said it had no entry. A worker who is
     * told "no entry" once stops asking, which is the worst outcome for the
     * intent that routes emergencies. A structural hit is weighted above a
     * single keyword so a real match beats an incidental one.
     */
    match?: (q: string) => boolean;
    resolve: (q: string, ctx: RetrieveContext) => ChatAnswer | null;
}

/** A structural match is worth this many keyword hits. */
const MATCH_WEIGHT = 2;

export interface RetrieveContext {
    role: string | null;
    language: Language;
}

const TIER_ALIASES: [RegExp, FacilityType][] = [
    [/\bsub[- ]?centre\b|\bayushman arogya mandir\b|\bsc\b/i, 'SC'],
    [/\bphc\b|\bprimary health\b/i, 'PHC'],
    [/\bchc\b|\bcommunity health\b/i, 'CHC'],
    [/\bsdh\b|\bsub[- ]?district\b/i, 'SDH'],
    [/\bdh\b|\bdistrict hospital\b/i, 'DH'],
];

function detectTier(q: string): FacilityType | null {
    for (const [re, tier] of TIER_ALIASES) {
        if (re.test(q)) return tier;
    }
    return null;
}

function detectPriority(q: string): 'RED' | 'YELLOW' | 'GREEN' | null {
    if (/\bred\b|\bemergency\b|\bcritical\b/i.test(q)) return 'RED';
    if (/\byellow\b|\burgent\b/i.test(q)) return 'YELLOW';
    if (/\bgreen\b|\broutine\b|\bstable\b/i.test(q)) return 'GREEN';
    return null;
}

// ── question shapes ──────────────────────────────────────────────────────────
// Deliberately narrow: each one needs two signals, so an ordinary sentence that
// happens to contain "where" does not get routed to the referral protocol.

const REFERRAL_VERB = /\b(refer|referral|send|route|transfer|escalate|shift)\b/i;
const DESTINATION = /\b(where|which|whom|hospital|facility|centre|center|unit|tier)\b/i;
// A worker names the tier far more often than the word "facility" — and just as
// often asks routing the other way round ("can I keep this one here?"), which
// carries no destination word at all. Kept separate from DESTINATION so it only
// widens the branch that already demands an urgency and a person alongside it.
const TIER = /\b(sc|phc|chc|sdh|dh|sub-?cent(re|er)|here)\b/i;
const SCHEDULE_SUBJECT = /\b(anc|antenatal|immunis\w*|immuniz\w*|vaccin\w*|clinic|camp|ncd|screening|vhnd|specialist|opd)\b/i;
const WHEN = /\b(when|next|what day|which day|timing|timings|schedule)\b/i;
const MEDICINE_NOUN = /\b(medicine|medicines|drug|drugs|tablet|tablets|stock)\b/i;
const AVAILABILITY = /\b(stock|stocked|available|availability|have|got|left|supply|supplies)\b/i;
const CASE_NOUN = /\b(case|cases|patient|patients|mother|child|baby|infant|woman|man|victim)\b/i;
const NAV_NOUN = /\b(page|screen|board|section|module|tab|menu|button|form)\b/i;
const NAV_VERB = /\b(where|how|find|open|go to|get to|see|view)\b/i;

// ── courtesy ─────────────────────────────────────────────────────────────────
// "hi" is the first thing most people type into a chat box. Answering it with
// "I have no offline protocol entry for that" reads as broken, and the worker
// concludes the assistant knows nothing and closes it — before ever asking the
// question it exists to answer. A greeting is not a clinical question, so it is
// answered with an orientation: what this assistant can look up, and three
// questions worth copying.

const GREETING = /^(h+i+|h+e+y+|hell?o+|namaste|namaskar|namaskaram|vanakkam|salaam|help|morning|afternoon|evening|नमस्ते|नमस्कार|हाय|हॅलो|सलाम)$/u;
const THANKS = /^(thanks?|thankyou|thx|ty|dhanyavad|dhanyawad|धन्यवाद|आभार|शुक्रिया)$/u;
/** Words that may sit around a greeting without making it a question. */
const COURTESY_FILLER = /^(you|there|good|very|much|so|a|lot|ok|okay|sir|madam|maam|doctor|dr|bot|assistant|nalammesh|please|pls)$/u;

/**
 * Whether the whole message is a courtesy, and which kind.
 *
 * Deliberately all-or-nothing: every word has to be a greeting, a thanks or
 * harmless filler. "hi, where do I refer a RED case?" is a real question with a
 * greeting attached, and must reach the referral protocol rather than be
 * answered with a menu. An ambiguous plea like "help me" is left unmatched on
 * purpose — the caller's fallback points at a Medical Officer and the helpline,
 * which is the right answer to a phrase that might not be small talk at all.
 */
function courtesyKind(q: string): 'greeting' | 'thanks' | null {
    const words = q
        // \p{M} keeps the combining marks: stripping them alone would turn
        // नमस्ते into a different string of letters and never match.
        .replace(/[^\p{L}\p{M}\s]/gu, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0 || words.length > 4) return null;
    if (!words.every((w) => GREETING.test(w) || THANKS.test(w) || COURTESY_FILLER.test(w))) return null;
    if (words.some((w) => THANKS.test(w))) return 'thanks';
    return words.some((w) => GREETING.test(w)) ? 'greeting' : null;
}

const ALL_TERMS = Array.from(
    new Set(listFacilities().flatMap((f) => [...f.services, ...f.equipment]))
);

/**
 * Whether two words name the same thing, allowing only a plural difference.
 *
 * Substring matching is what made "how do I register a new patient" answer with
 * *Inpatient* Care: "patient" sits inside "inpatient". Confidently answering a
 * different question than the one asked is worse than admitting no match, so
 * the comparison is word-for-word, with the plural tolerated because the
 * directory writes "Ventilators (12)" and staff ask about a ventilator.
 */
function sameWord(a: string, b: string): boolean {
    if (a === b) return true;
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    return long === `${short}s` || long === `${short}es`;
}

function matchServiceTerms(q: string): string[] {
    const needle = q.toLowerCase();
    const asked = needle.split(/\W+/).filter((w) => w.length > 3);
    return ALL_TERMS.filter((term) => {
        const t = term.toLowerCase();
        if (needle.includes(t)) return true;
        const termWords = t.split(/\W+/).filter(Boolean);
        return t.length > 5 && asked.some((w) => termWords.some((tw) => sameWord(w, tw)));
    });
}

/**
 * Sentence frames around the data. The facts themselves come from the knowledge
 * base (already localized where the source data is), but the connecting prose
 * has to be written per language — an ASHA reading a Marathi interface should
 * not get her referral instruction back in English.
 */
const PHRASES = {
    en: {
        referral: (priority: string, tierName: string, tier: string, action: string) =>
            `For a ${priority} case: refer to ${tierName} (${tier}) or higher. ${action}`,
        serviceFound: (term: string, list: string) => `"${term}" is available at: ${list}.`,
        serviceMissing: (term: string) =>
            `No facility in the network currently lists "${term}" among its services or equipment.`,
        scheduleAt: (tier: string, lines: string) => `At ${tier}: ${lines}.`,
        nextOn: 'next on',
        medicineStock: 'Open Medicine Stock from the sidebar to see live, facility-specific essential-medicine availability — stock levels change too often for me to state a number here.',
        navigate: (label: string, path: string) => `${label} — go to ${path} in the app.`,
        dangerRed: 'RED (immediate referral)',
        dangerYellow: 'YELLOW (urgent, expedite)',
        dangerAvpu: 'or an unresponsive/pain-only AVPU',
        escalateOnly: 'A danger sign can only raise the triage level — it never lowers one already set.',
        greetStaff:
            'Namaste. Answers here come from this portal\'s own records — danger-sign thresholds, where to refer a case, which facility has a service or piece of equipment, free entitlements, clinic days, and where a screen lives in the app. Try: "Where do I refer a RED case?", "Which facility has a blood bank?", or "When is the next ANC clinic?"',
        greetPublic:
            'Namaste. Answers here come from this portal\'s own records — which health centre offers what, clinic and camp days, free entitlements under the government schemes, and where to go for a particular treatment. Try: "Which facility has a blood bank?", "When is the next immunisation day?", or "Is treatment free under Ayushman Bharat?"',
        thanksBack:
            'Anytime. Ask again whenever you need — thresholds, referral routing, facility services, entitlements or clinic days.',
    },
    hi: {
        referral: (priority: string, tierName: string, tier: string, action: string) =>
            `${priority} केस के लिए: ${tierName} (${tier}) या उससे ऊपर रेफर करें। ${action}`,
        serviceFound: (term: string, list: string) => `"${term}" यहाँ उपलब्ध है: ${list}।`,
        serviceMissing: (term: string) =>
            `नेटवर्क की किसी भी सुविधा में अभी "${term}" सेवा या उपकरण सूचीबद्ध नहीं है।`,
        scheduleAt: (tier: string, lines: string) => `${tier} पर: ${lines}।`,
        nextOn: 'अगली तिथि',
        medicineStock: 'साइडबार में औषधि भंडार खोलें — सुविधा-वार अत्यावश्यक दवाओं की वर्तमान उपलब्धता वहीं दिखती है। भंडार इतनी जल्दी बदलता है कि यहाँ संख्या बताना सही नहीं होगा।',
        navigate: (label: string, path: string) => `${label} — ऐप में ${path} पर जाएँ।`,
        dangerRed: 'RED (तत्काल रेफरल)',
        dangerYellow: 'YELLOW (तत्काल, प्राथमिकता से)',
        dangerAvpu: 'या रोगी अनुत्तरदायी / केवल दर्द पर प्रतिक्रिया (AVPU)',
        escalateOnly: 'खतरे का संकेत ट्राइएज स्तर केवल बढ़ा सकता है — पहले से निर्धारित स्तर को कभी घटाता नहीं।',
        greetStaff:
            'नमस्ते। यहाँ उत्तर इसी पोर्टल के अभिलेखों से आते हैं — खतरे के संकेतों की सीमाएँ, किस केस को कहाँ रेफर करें, किस सुविधा में कौन-सी सेवा या उपकरण है, नि:शुल्क हकदारी, क्लिनिक के दिन, और ऐप में कौन-सी स्क्रीन कहाँ है। पूछकर देखें: "RED केस कहाँ रेफर करें?", "ब्लड बैंक किस सुविधा में है?", या "अगला ANC क्लिनिक कब है?"',
        greetPublic:
            'नमस्ते। यहाँ उत्तर इसी पोर्टल के अभिलेखों से आते हैं — कौन-सा स्वास्थ्य केंद्र क्या सेवा देता है, क्लिनिक और शिविर के दिन, सरकारी योजनाओं की नि:शुल्क हकदारी, और इलाज के लिए कहाँ जाएँ। पूछकर देखें: "ब्लड बैंक किस सुविधा में है?", "अगला टीकाकरण दिवस कब है?", या "क्या आयुष्मान भारत में इलाज नि:शुल्क है?"',
        thanksBack:
            'कभी भी पूछें। ज़रूरत पड़ने पर फिर पूछिए — सीमाएँ, रेफरल मार्ग, सुविधा सेवाएँ, हकदारी या क्लिनिक के दिन।',
    },
    mr: {
        referral: (priority: string, tierName: string, tier: string, action: string) =>
            `${priority} रुग्णासाठी: ${tierName} (${tier}) किंवा त्यावरील संस्थेकडे संदर्भित करा. ${action}`,
        serviceFound: (term: string, list: string) => `"${term}" येथे उपलब्ध आहे: ${list}.`,
        serviceMissing: (term: string) =>
            `नेटवर्कमधील कोणत्याही सुविधेत सध्या "${term}" ही सेवा किंवा उपकरण नोंदलेले नाही.`,
        scheduleAt: (tier: string, lines: string) => `${tier} येथे: ${lines}.`,
        nextOn: 'पुढील दिनांक',
        medicineStock: 'साइडबारमधील औषध साठा उघडा — तेथे सुविधानिहाय अत्यावश्यक औषधांची चालू उपलब्धता दिसते. साठा इतक्या वेळा बदलतो की येथे आकडा सांगणे योग्य होणार नाही.',
        navigate: (label: string, path: string) => `${label} — अ‍ॅपमध्ये ${path} येथे जा.`,
        dangerRed: 'RED (तात्काळ संदर्भ)',
        dangerYellow: 'YELLOW (तातडीचे, प्राधान्याने)',
        dangerAvpu: 'किंवा रुग्ण प्रतिसादहीन / फक्त वेदनेला प्रतिसाद (AVPU)',
        escalateOnly: 'धोक्याचे लक्षण ट्राइएज पातळी केवळ वाढवू शकते — आधी ठरलेली पातळी कधीही कमी करत नाही.',
        greetStaff:
            'नमस्कार. येथील उत्तरे याच पोर्टलच्या नोंदींमधून येतात — धोक्याच्या लक्षणांच्या मर्यादा, कोणत्या रुग्णाला कुठे संदर्भित करायचे, कोणत्या सुविधेत कोणती सेवा किंवा उपकरण आहे, मोफत हक्क, क्लिनिकचे दिवस, आणि अ‍ॅपमधील स्क्रीन कुठे आहे. विचारून पहा: "RED रुग्ण कुठे संदर्भित करावा?", "ब्लड बँक कोणत्या सुविधेत आहे?", किंवा "पुढील ANC क्लिनिक कधी आहे?"',
        greetPublic:
            'नमस्कार. येथील उत्तरे याच पोर्टलच्या नोंदींमधून येतात — कोणते आरोग्य केंद्र कोणती सेवा देते, क्लिनिक व शिबिराचे दिवस, शासकीय योजनांतील मोफत हक्क, आणि उपचारासाठी कुठे जावे. विचारून पहा: "ब्लड बँक कोणत्या सुविधेत आहे?", "पुढील लसीकरण दिवस कधी आहे?", किंवा "आयुष्मान भारतमध्ये उपचार मोफत आहेत का?"',
        thanksBack:
            'कधीही विचारा. गरज पडेल तेव्हा पुन्हा विचारा — मर्यादा, संदर्भ मार्ग, सुविधा सेवा, हक्क किंवा क्लिनिकचे दिवस.',
    },
} as const;

const phrasesFor = (language: Language) => PHRASES[language] ?? PHRASES.en;

const INTENTS: Intent[] = [
    {
        name: 'courtesy',
        // No keywords: a bare greeting is recognised by shape alone. Anything
        // with a real question in it fails courtesyKind() and never gets here.
        keywords: [],
        match: (q) => courtesyKind(q) !== null,
        resolve: (q, ctx) => {
            const p = phrasesFor(ctx.language);
            const kind = courtesyKind(q);
            if (kind === null) return null;
            return {
                text:
                    kind === 'thanks'
                        ? p.thanksBack
                        : // Same facts either way; a visitor is simply not offered the
                          // staff screens they have no login for.
                          ctx.role
                          ? p.greetStaff
                          : p.greetPublic,
                source: 'NalamMesh assistant — what this portal can answer',
                confidence: 'high',
            };
        },
    },
    {
        name: 'danger-signs',
        keywords: ['danger sign', 'threshold', 'critical value', 'red flag', 'spo2', 'oxygen', 'heart rate', 'pulse', 'blood pressure', 'bp ', 'respiratory rate', 'breathing rate', 'glucose', 'sugar level', 'fever', 'temperature', 'vitals mean', 'when to refer', 'when is a patient red', 'iphs threshold'],
        resolve: (_q, ctx) => {
            const t = CLINICAL_THRESHOLDS;
            const p = phrasesFor(ctx.language);
            // The numbers and units stay as written in every language: SpO2, mmHg and
            // mg/dL are what the monitors and the registers actually read.
            const lines = [
                `${p.dangerRed}: SpO2 < ${t.spo2.criticalBelow}%, HR > ${t.heartRate.criticalAbove} / < ${t.heartRate.criticalBelow} bpm, systolic ≤ ${t.systolic.criticalBelowOrEqual} / ≥ ${t.systolic.criticalAboveOrEqual} mmHg, diastolic ≥ ${t.diastolic.criticalAboveOrEqual} mmHg, RR ≥ ${t.respiratoryRate.criticalAboveOrEqual} / ≤ ${t.respiratoryRate.criticalBelowOrEqual} per min, glucose ≤ ${t.glucose.criticalBelowOrEqual} / ≥ ${t.glucose.criticalAboveOrEqual} mg/dL, ${p.dangerAvpu}.`,
                `${p.dangerYellow}: SpO2 < ${t.spo2.cautionBelow}%, HR > ${t.heartRate.cautionAbove} bpm, BP ≥ ${t.systolic.cautionAboveOrEqual}/${t.diastolic.cautionAboveOrEqual} mmHg, RR ≥ ${t.respiratoryRate.cautionAboveOrEqual} per min, temp ≥ ${t.temperature.cautionAboveOrEqual}°F, glucose ≥ ${t.glucose.cautionAboveOrEqual} mg/dL.`,
                p.escalateOnly,
            ];
            return {
                text: lines.join(' '),
                source: 'NalamMesh triage engine (IPHS/NHM danger-sign protocol) — these are the exact values the app enforces, not general guidance.',
                confidence: 'high',
            };
        },
    },
    {
        name: 'referral-routing',
        keywords: ['where do i send', 'where should i refer', 'refer this patient', 'which facility for', 'send the patient', 'refer red', 'refer yellow', 'refer green', 'first referral unit', 'fru'],
        // Either "send/refer … where", or a destination question about a case
        // whose urgency is named ("which hospital for an emergency case").
        // The second branch needs a person as well as an urgency, so "which
        // facility has an emergency department" stays a directory lookup
        // instead of being answered with the triage-routing protocol.
        match: (q) =>
            (REFERRAL_VERB.test(q) && DESTINATION.test(q)) ||
            ((DESTINATION.test(q) || TIER.test(q)) && detectPriority(q) !== null && CASE_NOUN.test(q)),
        resolve: (q, ctx) => {
            const priority = detectPriority(q) ?? 'RED';
            const g = referralGuidance(priority);
            const p = phrasesFor(ctx.language);
            return {
                text: p.referral(priority, localize(g.tierName, ctx.language), g.tier, localize(g.action, ctx.language)),
                source: 'NalamMesh referral pathway (SC → PHC → CHC → SDH → DH)',
                confidence: detectPriority(q) ? 'high' : 'medium',
            };
        },
    },
    {
        name: 'facility-service-lookup',
        keywords: ['which facility has', 'where can i get', 'who has a', 'does the phc have', 'does the chc have', 'nearest facility with', 'blood bank', 'dialysis', 'ct scan', 'icu', 'ventilator', 'x-ray', 'ultrasound', 'surgery', 'ambulance available'],
        // Only a service named in full counts as structural. A single shared
        // word is too weak — "what medicines are in stock" overlaps the service
        // "General Medicine" but is a stock question, not a directory one.
        match: (q) => ALL_TERMS.some((t) => t.length > 4 && q.includes(t.toLowerCase())),
        resolve: (q, ctx) => {
            const terms = matchServiceTerms(q);
            if (terms.length === 0) return null;
            const p = phrasesFor(ctx.language);
            const matches = findFacilitiesByService(terms[0]);
            if (matches.length === 0) {
                return {
                    text: p.serviceMissing(terms[0]),
                    source: 'NalamMesh facility directory',
                    confidence: 'medium',
                };
            }
            const list = matches.map((f) => `${f.name} (${f.tier})`).join(', ');
            return {
                text: p.serviceFound(terms[0], list),
                source: 'NalamMesh facility directory',
                confidence: 'high',
            };
        },
    },
    {
        name: 'entitlements',
        keywords: ['pmjay', 'ayushman', 'abha', 'free medicine', 'free of cost', 'scheme', 'entitlement', 'jsy', 'janani suraksha', 'is it free', 'do i have to pay'],
        resolve: (q, ctx) => {
            const tier = detectTier(q) ?? 'PHC';
            const e = entitlementsAt(tier);
            const lines = e.lines.map((l) => localize(l, ctx.language)).join(' ');
            return {
                text: lines,
                source: 'NHM/IPHS entitlement facts (display-only — not an eligibility determination)',
                confidence: detectTier(q) ? 'high' : 'medium',
            };
        },
    },
    {
        name: 'schedule',
        keywords: ['clinic day', 'immunisation day', 'immunization day', 'anc day', 'vhnd', 'when is the next', 'camp day', 'ncd screening day', 'specialist visit'],
        match: (q) => WHEN.test(q) && SCHEDULE_SUBJECT.test(q),
        resolve: (q, ctx) => {
            const tier = detectTier(q) ?? 'PHC';
            const s = scheduleAt(tier);
            const p = phrasesFor(ctx.language);
            const lines = s.entries
                .map((e) => `${localize(e.label, ctx.language)}: ${e.time}, ${p.nextOn} ${e.nextDate}`)
                .join('. ');
            return {
                text: p.scheduleAt(tier, lines),
                source: 'NalamMesh tier service schedule',
                confidence: detectTier(q) ? 'high' : 'medium',
            };
        },
    },
    {
        name: 'medicine-stock',
        keywords: ['medicine stock', 'medicine available', 'out of stock', 'do we have', 'essential medicine', 'drug available'],
        match: (q) => MEDICINE_NOUN.test(q) && AVAILABILITY.test(q),
        resolve: (_q, ctx) => ({
            text: phrasesFor(ctx.language).medicineStock,
            source: 'NalamMesh app guidance',
            confidence: 'medium',
        }),
    },
    {
        name: 'app-navigation',
        keywords: ['how do i', 'where do i log', 'where is the', 'how to register', 'how to add', 'how to view', 'where can i see', 'navigate to', 'which screen'],
        match: (q) => NAV_VERB.test(q) && NAV_NOUN.test(q),
        resolve: (q, ctx) => {
            const needle = q.toLowerCase();
            const routes = routesForRole(ctx.role);
            const hit = routes.find((r) =>
                localize(r.label, ctx.language).toLowerCase().split(/\W+/).some((w) => w.length > 3 && needle.includes(w))
            );
            if (!hit) return null;
            return {
                text: phrasesFor(ctx.language).navigate(localize(hit.label, ctx.language), hit.path),
                source: 'NalamMesh app navigation map',
                confidence: 'high',
            };
        },
    },
];

const MIN_KEYWORD_HITS = 1;

/**
 * Scores every intent's keyword list against the question and resolves the
 * best match. Returns null when nothing scores — the caller should not
 * present a low-confidence guess as fact.
 */
export function retrieveOffline(question: string, ctx: RetrieveContext): ChatAnswer | null {
    const q = question.toLowerCase().trim();
    if (!q) return null;

    let best: { intent: Intent; hits: number } | null = null;
    for (const intent of INTENTS) {
        const keywordHits = intent.keywords.filter((kw) => q.includes(kw)).length;
        const hits = keywordHits + (intent.match?.(q) ? MATCH_WEIGHT : 0);
        if (hits >= MIN_KEYWORD_HITS && (!best || hits > best.hits)) {
            best = { intent, hits };
        }
    }
    if (!best) return null;
    // An intent may still decline (no such service, no such screen). Falling
    // through to the next-best intent would answer a different question than
    // the one asked, so the caller is told plainly that nothing matched.
    return best.intent.resolve(q, ctx);
}
