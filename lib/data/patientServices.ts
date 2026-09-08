/**
 * Patient-facing service awareness & entitlement data — NalamMesh (SIH PS#26133).
 *
 * PS#26133 names "limited awareness of available services" and "affordability" as root
 * causes of poor rural access. This module supplies, per facility tier, the two things a
 * patient or ASHA worker actually needs and the app did not previously surface anywhere:
 *
 *   1. WHEN services run — recurring clinic/camp days (ANC, immunisation, NCD screening,
 *      specialist visit), with the NEXT date COMPUTED from today rather than written as a
 *      fixed calendar string. (A hardcoded date silently goes stale — the exact defect the
 *      follow-up recall screen had; see the nalammesh-quality-bar memory.)
 *   2. WHAT is free — plain-language entitlement facts (NHM/IPHS free-of-cost care, Ayushman
 *      Bharat PMJAY cover). This is DISPLAY-ONLY awareness content: it performs no scheme
 *      verification and calls no payment or eligibility API, by design.
 *
 * All data here is static seed content, so the screen works fully offline.
 */

import { FacilityType, MedicineStockItem } from '@/types/facility';
import { SEED_MEDICINES } from '@/lib/data/facilities';

export interface Localized {
    en: string;
    hi: string;
    mr: string;
}

export interface ServiceScheduleEntry {
    /** Stable key for React lists and tests. */
    key: string;
    /** 0 = Sunday … 6 = Saturday. The recurring clinic/camp weekday. */
    weekday: number;
    /** Clinic window, e.g. "9:00 AM – 1:00 PM". Same across languages (numeric). */
    time: string;
    label: Localized;
}

/**
 * Recurring clinic/camp schedule expected at each tier under NHM/IPHS norms.
 * Deliberately tier-keyed rather than per-facility: these are the standard service days
 * a patient can rely on at that tier, and keeping one table avoids inventing distinct
 * fake calendars for seven facilities. A facility's real operating hours still come from
 * its own `operatingHours` field; this table is the "which day is which clinic" layer.
 */
export const TIER_SERVICE_SCHEDULE: Record<FacilityType, ServiceScheduleEntry[]> = {
    SC: [
        { key: 'sc-anc', weekday: 3, time: '9:00 AM – 12:00 PM',
          label: { en: 'Antenatal (ANC) check-up day', hi: 'प्रसवपूर्व (ANC) जांच दिवस', mr: 'गरोदरपण (ANC) तपासणी दिवस' } },
        { key: 'sc-imm', weekday: 5, time: '9:00 AM – 1:00 PM',
          label: { en: 'Village immunisation day (VHND)', hi: 'ग्राम टीकाकरण दिवस (VHND)', mr: 'ग्राम लसीकरण दिवस (VHND)' } },
    ],
    PHC: [
        { key: 'phc-anc', weekday: 2, time: '9:00 AM – 1:00 PM',
          label: { en: 'Antenatal (ANC) clinic', hi: 'प्रसवपूर्व (ANC) क्लिनिक', mr: 'गरोदरपण (ANC) चिकित्सालय' } },
        { key: 'phc-imm', weekday: 4, time: '9:00 AM – 1:00 PM',
          label: { en: 'Immunisation day', hi: 'टीकाकरण दिवस', mr: 'लसीकरण दिवस' } },
        { key: 'phc-ncd', weekday: 1, time: '10:00 AM – 2:00 PM',
          label: { en: 'NCD screening (BP / sugar)', hi: 'एनसीडी जांच (बीपी / शुगर)', mr: 'असंसर्गजन्य आजार तपासणी (बीपी / साखर)' } },
    ],
    CHC: [
        { key: 'chc-anc', weekday: 2, time: '9:00 AM – 2:00 PM',
          label: { en: 'High-risk ANC & obstetric clinic', hi: 'उच्च जोखिम ANC व प्रसूति क्लिनिक', mr: 'उच्च जोखीम ANC व प्रसूती चिकित्सालय' } },
        { key: 'chc-spec', weekday: 5, time: '10:00 AM – 3:00 PM',
          label: { en: 'Visiting specialist clinic', hi: 'विज़िटिंग विशेषज्ञ क्लिनिक', mr: 'भेट देणारे तज्ज्ञ चिकित्सालय' } },
        { key: 'chc-imm', weekday: 4, time: '9:00 AM – 1:00 PM',
          label: { en: 'Immunisation day', hi: 'टीकाकरण दिवस', mr: 'लसीकरण दिवस' } },
    ],
    SDH: [
        { key: 'sdh-spec', weekday: 1, time: '9:00 AM – 4:00 PM',
          label: { en: 'Specialist OPD (OB-GYN, Paediatrics)', hi: 'विशेषज्ञ ओपीडी (स्त्री रोग, बाल रोग)', mr: 'तज्ज्ञ ओपीडी (स्त्रीरोग, बालरोग)' } },
        { key: 'sdh-surg', weekday: 4, time: '9:00 AM – 1:00 PM',
          label: { en: 'Planned surgery day', hi: 'नियोजित सर्जरी दिवस', mr: 'नियोजित शस्त्रक्रिया दिवस' } },
    ],
    DH: [
        { key: 'dh-spec', weekday: 1, time: '9:00 AM – 4:00 PM',
          label: { en: 'Multi-specialty OPD (daily)', hi: 'मल्टी-स्पेशलिटी ओपीडी (प्रतिदिन)', mr: 'बहु-विशेषज्ञ ओपीडी (दररोज)' } },
        { key: 'dh-dial', weekday: 3, time: '8:00 AM – 2:00 PM',
          label: { en: 'Dialysis & NCD clinic', hi: 'डायलिसिस व एनसीडी क्लिनिक', mr: 'डायलिसिस व एनसीडी चिकित्सालय' } },
    ],
};

/**
 * The next calendar date on or after `from` that falls on `weekday`.
 * If `from` is already that weekday, `from` itself is returned (today's clinic still counts).
 * Returned date is normalised to local midnight so downstream formatting is stable.
 */
export function nextOccurrence(weekday: number, from: Date = new Date()): Date {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const delta = (weekday - d.getDay() + 7) % 7; // 0 when today matches
    d.setDate(d.getDate() + delta);
    return d;
}

export interface EntitlementFacts {
    /** Care at a public facility of this tier is free of user charge under NHM/IPHS. */
    freeAtPublicFacility: boolean;
    /** Plain-language lines shown to the patient. */
    lines: Localized[];
}

/**
 * Entitlement facts by tier. Public-facility OPD, drugs on the essential list, ANC, and
 * immunisation are free of charge under the National Health Mission at every tier; PMJAY
 * cover for admission/secondary care becomes relevant from CHC upward. These are factual
 * awareness statements, not a coverage determination for any individual.
 */
export function getEntitlements(tier: FacilityType): EntitlementFacts {
    const freeCore: Localized[] = [
        { en: 'OPD consultation is free of charge at this public facility (NHM).',
          hi: 'इस सरकारी केंद्र पर ओपीडी परामर्श निःशुल्क है (एनएचएम)।',
          mr: 'या शासकीय केंद्रावर ओपीडी सल्ला मोफत आहे (एनएचएम).' },
        { en: 'Essential medicines on the IPHS list are dispensed free.',
          hi: 'आईपीएचएस सूची की आवश्यक दवाएं निःशुल्क दी जाती हैं।',
          mr: 'आयपीएचएस यादीतील अत्यावश्यक औषधे मोफत दिली जातात.' },
        { en: 'Antenatal (ANC) care and child immunisation are free.',
          hi: 'प्रसवपूर्व (ANC) देखभाल और बच्चों का टीकाकरण निःशुल्क है।',
          mr: 'गरोदरपण (ANC) काळजी व बालकांचे लसीकरण मोफत आहे.' },
    ];
    const pmjay: Localized = {
        en: 'Admission & secondary care covered up to ₹5 lakh/year under Ayushman Bharat (PMJAY) — carry your PMJAY / ABHA card.',
        hi: 'आयुष्मान भारत (PMJAY) के तहत भर्ती व द्वितीयक देखभाल ₹5 लाख/वर्ष तक कवर — अपना PMJAY / ABHA कार्ड साथ रखें।',
        mr: 'आयुष्मान भारत (PMJAY) अंतर्गत रुग्णालयीन व दुय्यम सेवा ₹5 लाख/वर्षापर्यंत कव्हर — आपले PMJAY / ABHA कार्ड सोबत ठेवा.',
    };
    const referralNote: Localized = {
        en: 'If referred to a higher centre, transport by 108/102 ambulance is free.',
        hi: 'उच्च केंद्र रेफर होने पर 108/102 एम्बुलेंस से परिवहन निःशुल्क है।',
        mr: 'वरच्या केंद्रात संदर्भित केल्यास 108/102 रुग्णवाहिकेने वाहतूक मोफत आहे.',
    };

    const lines = [...freeCore, referralNote];
    // PMJAY admission cover is meaningful where inpatient/secondary care exists.
    if (tier === 'CHC' || tier === 'SDH' || tier === 'DH') {
        lines.splice(3, 0, pmjay);
    }
    return { freeAtPublicFacility: true, lines };
}

export interface FreeMedicineSummary {
    total: number;
    inStock: number;
    /** A few representative in-stock free essential medicine names. */
    sample: string[];
}

/**
 * Free IPHS-essential medicines available at a facility, from the live stock seed.
 * `inStock` counts those not out of stock; `sample` lists a few for display. No invented
 * counts — everything derives from SEED_MEDICINES filtered by facility.
 */
export function freeEssentialMedicinesAt(
    facilityId: string,
    medicines: MedicineStockItem[] = SEED_MEDICINES
): FreeMedicineSummary {
    const atFacility = medicines.filter(m => m.facilityId === facilityId && m.isEssentialIPHS);
    const inStock = atFacility.filter(m => m.status !== 'OUT_OF_STOCK');
    return {
        total: atFacility.length,
        inStock: inStock.length,
        sample: inStock.slice(0, 4).map(m => m.name),
    };
}
