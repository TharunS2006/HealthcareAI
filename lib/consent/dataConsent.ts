/**
 * The patient's data notice and consent (Digital Personal Data Protection Act, 2023).
 *
 * Every new registration records the basis on which the patient's data is
 * processed, and that the notice below was given, in which language, by whom
 * and when:
 *
 *   CONSENT            the patient heard the notice and agreed (18 or over)
 *   GUARDIAN_CONSENT   a parent or lawful guardian heard it and agreed — the
 *                      only consent the Act accepts for a child (under 18)
 *   MEDICAL_EMERGENCY  processing to respond to a medical emergency, which the
 *                      Act allows without consent. It never blocks care: the
 *                      record is marked pending, and the notice is given and
 *                      consent recorded once the patient or a guardian can hear it.
 *
 * A patient who declines is not registered in the app (the screen says so):
 * they are treated and the visit is written on paper.
 *
 * The notice text is a draft for the health department's legal and language
 * review (docs/PRODUCTION_READINESS.md); NOTICE_VERSION is stored with every
 * record so a revised notice can tell who heard which text.
 */

export type ConsentBasis = 'CONSENT' | 'GUARDIAN_CONSENT' | 'MEDICAL_EMERGENCY';
export type NoticeLanguage = 'en' | 'hi' | 'mr';

export const NOTICE_VERSION = '2026-10-draft-1';
/** Under the Act a child is anyone under 18; their consent is a parent's or lawful guardian's. */
export const ADULT_AGE = 18;

export interface DataConsent {
    basis: ConsentBasis;
    /** True only for an emergency registration whose notice and consent are still to be taken. */
    pending: boolean;
    /** The language the notice was read in — absent while pending. */
    noticeLanguage?: NoticeLanguage;
    noticeVersion: string;
    guardianName?: string;
    guardianRelation?: string;
    recordedAt: string;
    recordedBy: string;
    recordedByName?: string;
    /** When the patient was registered as an emergency, kept after consent is recorded. */
    emergencyAt?: string;
}

/** What the worker has chosen on the form. */
export interface ConsentDraft {
    basis: ConsentBasis | '';
    language: NoticeLanguage;
    guardianName: string;
    guardianRelation: string;
}

export const EMPTY_CONSENT: ConsentDraft = { basis: '', language: 'mr', guardianName: '', guardianRelation: '' };

type Problem = 'CHOOSE' | 'NEED_CONSENT' | 'MINOR' | 'GUARDIAN_NAME' | 'GUARDIAN_RELATION';

const PROBLEM_TEXT: Record<Problem, Record<NoticeLanguage, string>> = {
    CHOOSE: {
        en: 'Data notice — choose how the patient’s data may be recorded',
        hi: 'डेटा सूचना — चुनें कि रोगी का डेटा किस आधार पर दर्ज होगा',
        mr: 'डेटा सूचना — रुग्णाची माहिती कोणत्या आधारावर नोंदवायची ते निवडा',
    },
    NEED_CONSENT: {
        en: 'Data notice — read the notice and record the patient’s or guardian’s consent',
        hi: 'डेटा सूचना — सूचना पढ़कर रोगी या अभिभावक की सहमति दर्ज करें',
        mr: 'डेटा सूचना — सूचना वाचून रुग्णाची किंवा पालकांची संमती नोंदवा',
    },
    MINOR: {
        en: `Data notice — the patient is under ${ADULT_AGE}; a parent or guardian must consent`,
        hi: `डेटा सूचना — रोगी ${ADULT_AGE} वर्ष से कम है; माता-पिता या अभिभावक की सहमति आवश्यक है`,
        mr: `डेटा सूचना — रुग्ण ${ADULT_AGE} वर्षांखालील आहे; पालक किंवा संरक्षकांची संमती आवश्यक आहे`,
    },
    GUARDIAN_NAME: {
        en: 'Data notice — the parent’s or guardian’s name',
        hi: 'डेटा सूचना — माता-पिता या अभिभावक का नाम',
        mr: 'डेटा सूचना — पालक किंवा संरक्षकाचे नाव',
    },
    GUARDIAN_RELATION: {
        en: 'Data notice — their relationship to the patient',
        hi: 'डेटा सूचना — रोगी से उनका संबंध',
        mr: 'डेटा सूचना — रुग्णाशी त्यांचे नाते',
    },
};

/**
 * What is missing or not allowed, in words a worker can act on, in the screen's
 * language. Empty means the draft can be recorded. `allowEmergency` is false
 * when the notice is being completed for an emergency registration: it must now
 * be real consent.
 */
export function consentProblems(draft: ConsentDraft, patientAge: number | undefined, allowEmergency = true, lang: NoticeLanguage = 'en'): string[] {
    const found: Problem[] = [];
    if (!draft.basis) found.push('CHOOSE');
    else if (draft.basis === 'MEDICAL_EMERGENCY') {
        if (!allowEmergency) found.push('NEED_CONSENT');
    } else {
        if (draft.basis === 'CONSENT' && patientAge !== undefined && Number.isFinite(patientAge) && patientAge < ADULT_AGE) found.push('MINOR');
        if (draft.basis === 'GUARDIAN_CONSENT') {
            if (draft.guardianName.trim().length < 2) found.push('GUARDIAN_NAME');
            if (!draft.guardianRelation.trim()) found.push('GUARDIAN_RELATION');
        }
    }
    return found.map(p => PROBLEM_TEXT[p][lang]);
}

/** The record to store. Call only when consentProblems() is empty. */
export function buildConsent(draft: ConsentDraft, staff: { staffId: string; name?: string }, now: Date = new Date(), previous?: DataConsent): DataConsent {
    if (!draft.basis) throw new Error('No consent basis chosen');
    const at = now.toISOString();
    const emergencyAt = previous?.basis === 'MEDICAL_EMERGENCY' ? (previous.emergencyAt ?? previous.recordedAt) : previous?.emergencyAt;
    const base = { noticeVersion: NOTICE_VERSION, recordedAt: at, recordedBy: staff.staffId, ...(staff.name ? { recordedByName: staff.name } : {}), ...(emergencyAt ? { emergencyAt } : {}) };
    if (draft.basis === 'MEDICAL_EMERGENCY') return { ...base, basis: 'MEDICAL_EMERGENCY', pending: true, emergencyAt: emergencyAt ?? at };
    return {
        ...base,
        basis: draft.basis,
        pending: false,
        noticeLanguage: draft.language,
        ...(draft.basis === 'GUARDIAN_CONSENT' ? { guardianName: draft.guardianName.trim(), guardianRelation: draft.guardianRelation.trim() } : {}),
    };
}

/** An emergency registration made with no form (the Emergency screen): pending from the start. */
export function emergencyConsent(staff: { staffId: string; name?: string }, now: Date = new Date()): DataConsent {
    return buildConsent({ ...EMPTY_CONSENT, basis: 'MEDICAL_EMERGENCY' }, staff, now);
}

export type ConsentStatus = 'RECORDED' | 'PENDING' | 'NOT_RECORDED';

/** NOT_RECORDED: a record made before this step existed, or by an older build. */
export function consentStatus(p: { dataConsent?: DataConsent }): ConsentStatus {
    if (!p.dataConsent) return 'NOT_RECORDED';
    return p.dataConsent.pending ? 'PENDING' : 'RECORDED';
}

export const LANGUAGE_NAME: Record<NoticeLanguage, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

/**
 * The notice read to the patient (DPDP Act s.5: what is collected and why, how
 * to exercise their rights, how to complain to the Board). Draft text for the
 * department's legal review and its language cell.
 */
export const NOTICE: Record<NoticeLanguage, { title: string; points: string[] }> = {
    en: {
        title: 'Your health record — notice',
        points: [
            'This health centre records your name, age, sex and village, your phone and ABHA numbers if you give them, and your health readings and treatment.',
            'They are used only for your care: to treat you here, to send your record ahead if you are referred to another hospital, and for health reports that do not name you.',
            'Only the health staff caring for you and district health officers can see your record. Who opens it on the district system is recorded.',
            'At this centre you can ask to see or correct your record, withdraw your consent, or make a complaint. You can also complain to the Data Protection Board of India.',
            'Saying no will not stop you being treated. Your visit will then be written on paper.',
        ],
    },
    hi: {
        title: 'आपका स्वास्थ्य रिकॉर्ड — सूचना',
        points: [
            'यह स्वास्थ्य केंद्र आपका नाम, उम्र, लिंग और गाँव, यदि आप दें तो आपका फ़ोन नंबर और आभा (ABHA) नंबर, तथा आपकी स्वास्थ्य जाँच और इलाज की जानकारी दर्ज करता है।',
            'इसका उपयोग केवल आपके इलाज के लिए होता है: यहाँ इलाज करने, किसी दूसरे अस्पताल भेजे जाने पर आपका रिकॉर्ड पहले से भेजने, और ऐसी स्वास्थ्य रिपोर्टों के लिए जिनमें आपका नाम नहीं होता।',
            'आपका रिकॉर्ड केवल आपका इलाज करने वाले स्वास्थ्य कर्मचारी और ज़िला स्वास्थ्य अधिकारी देख सकते हैं। ज़िला सिस्टम पर इसे किसने खोला, यह दर्ज होता है।',
            'इसी केंद्र पर आप अपना रिकॉर्ड देखने या सुधारने, अपनी सहमति वापस लेने, या शिकायत करने के लिए कह सकते हैं। आप भारतीय डेटा संरक्षण बोर्ड (Data Protection Board of India) से भी शिकायत कर सकते हैं।',
            'मना करने पर भी आपका इलाज होगा। तब आपकी जाँच की जानकारी कागज़ पर लिखी जाएगी।',
        ],
    },
    mr: {
        title: 'तुमची आरोग्य नोंद — सूचना',
        points: [
            'हे आरोग्य केंद्र तुमचे नाव, वय, लिंग आणि गाव, तुम्ही दिल्यास तुमचा फोन नंबर आणि आभा (ABHA) क्रमांक, तसेच तुमच्या आरोग्य तपासण्या आणि उपचारांची माहिती नोंदवते.',
            'ही माहिती फक्त तुमच्या उपचारांसाठी वापरली जाते: येथे उपचार करण्यासाठी, दुसऱ्या रुग्णालयात पाठवल्यास तुमची नोंद आधीच पाठवण्यासाठी, आणि तुमचे नाव नसलेल्या आरोग्य अहवालांसाठी.',
            'तुमची नोंद फक्त तुमच्यावर उपचार करणारे आरोग्य कर्मचारी आणि जिल्हा आरोग्य अधिकारी पाहू शकतात. जिल्हा प्रणालीवर ती कोणी उघडली, हे नोंदवले जाते.',
            'याच केंद्रात तुम्ही तुमची नोंद पाहण्यासाठी किंवा दुरुस्त करण्यासाठी, तुमची संमती मागे घेण्यासाठी, किंवा तक्रार करण्यासाठी सांगू शकता. तुम्ही भारतीय डेटा संरक्षण मंडळाकडेही (Data Protection Board of India) तक्रार करू शकता.',
            'नकार दिला तरी तुमच्यावर उपचार होतील. त्या वेळी तुमच्या भेटीची माहिती कागदावर लिहिली जाईल.',
        ],
    },
};
