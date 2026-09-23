/**
 * NalamMesh Assistant — grounded knowledge base (Layer 1).
 *
 * The chat assistant must never invent a fact — a wrong "which facility has a
 * blood bank" answer sends a RED referral to the wrong place. So this module
 * builds every answerable fact directly from the same data modules the rest of
 * the app renders from (lib/data/facilities.ts, lib/data/patientServices.ts),
 * rather than hand-written prose that can drift from the seed data.
 *
 * The one exception is CLINICAL_THRESHOLDS below: those numbers are a literal
 * copy of the boundaries enforced in assessClinically() (lib/triage/model.ts),
 * because that function does not export them. A copy can drift, so
 * scripts/verify-chat-thresholds.ts asserts these against classifyTriage()
 * directly — run it after touching either file.
 */

import { FACILITY_NETWORK, SEED_MEDICINES } from '@/lib/data/facilities';
import { getEntitlements, freeEssentialMedicinesAt, TIER_SERVICE_SCHEDULE, nextOccurrence } from '@/lib/data/patientServices';
import type { FacilityType } from '@/types/facility';
import type { Language } from '@/stores/languageStore';

/**
 * Mirrors assessClinically() in lib/triage/model.ts exactly. Keep in sync —
 * verified by scripts/verify-chat-thresholds.ts.
 */
export const CLINICAL_THRESHOLDS = {
    spo2: { criticalBelow: 90, cautionBelow: 95 },
    heartRate: { criticalAbove: 130, criticalBelow: 48, cautionAbove: 105 },
    systolic: { criticalBelowOrEqual: 85, criticalAboveOrEqual: 160, cautionAboveOrEqual: 140 },
    diastolic: { criticalAboveOrEqual: 100, cautionAboveOrEqual: 90 },
    respiratoryRate: { criticalAboveOrEqual: 36, criticalBelowOrEqual: 8, cautionAboveOrEqual: 27 },
    temperature: { cautionAboveOrEqual: 102.5 },
    glucose: { criticalBelowOrEqual: 55, criticalAboveOrEqual: 280, cautionAboveOrEqual: 180 },
} as const;

export const REFERRAL_PATHWAY: FacilityType[] = ['SC', 'PHC', 'CHC', 'SDH', 'DH'];

const TIER_NAME: Record<FacilityType, Localized> = {
    SC: { en: 'Sub-Centre / Ayushman Arogya Mandir', hi: 'उप-केंद्र', mr: 'उपकेंद्र' },
    PHC: { en: 'Primary Health Centre', hi: 'प्राथमिक स्वास्थ्य केंद्र', mr: 'प्राथमिक आरोग्य केंद्र' },
    CHC: { en: 'Community Health Centre', hi: 'सामुदायिक स्वास्थ्य केंद्र', mr: 'सामुदायिक आरोग्य केंद्र' },
    SDH: { en: 'Sub-District Hospital', hi: 'उप-जिला अस्पताल', mr: 'उपजिल्हा रुग्णालय' },
    DH: { en: 'District Hospital', hi: 'जिला अस्पताल', mr: 'जिल्हा रुग्णालय' },
};

interface Localized {
    en: string;
    hi: string;
    mr: string;
}

export interface FacilitySummary {
    id: string;
    name: string;
    tier: FacilityType;
    tierName: Localized;
    services: string[];
    equipment: string[];
    operatingHours: string;
    ambulanceAvailable: number;
    bedsTotal: number;
    bedsOccupied: number;
    contact: string;
}

/** Every facility, reduced to what the assistant is allowed to state. */
export function listFacilities(): FacilitySummary[] {
    return FACILITY_NETWORK.map((f) => ({
        id: f.id,
        name: f.name,
        tier: f.type,
        tierName: TIER_NAME[f.type],
        services: f.services,
        equipment: f.equipment,
        operatingHours: f.operatingHours,
        ambulanceAvailable: f.ambulanceAvailable,
        bedsTotal: f.beds.total,
        bedsOccupied: f.beds.occupied,
        contact: f.contact,
    }));
}

/** Facilities offering a service whose name contains `query` (case-insensitive). */
export function findFacilitiesByService(query: string): FacilitySummary[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return listFacilities().filter((f) =>
        f.services.some((s) => s.toLowerCase().includes(needle)) ||
        f.equipment.some((e) => e.toLowerCase().includes(needle))
    );
}

/** Where a RED / YELLOW / GREEN case should be referred, and why — mirrors getRecommendedFacility(). */
export function referralGuidance(priority: 'RED' | 'YELLOW' | 'GREEN'): {
    tier: FacilityType;
    tierName: Localized;
    action: Localized;
} {
    if (priority === 'RED') {
        return {
            tier: 'DH',
            tierName: TIER_NAME.DH,
            action: {
                en: 'Immediate emergency referral (108 ambulance) to the nearest facility with 24×7 emergency care — District Hospital or, if closer, the Sub-District Hospital FRU.',
                hi: 'तुरंत आपातकालीन रेफरल (108 एम्बुलेंस) निकटतम 24x7 आपातकालीन सुविधा वाले केंद्र — जिला अस्पताल या नज़दीक होने पर उप-जिला अस्पताल (FRU) को।',
                mr: 'तातडीने आपत्कालीन संदर्भ (108 रुग्णवाहिका) — जवळच्या 24x7 आपत्कालीन सुविधा असलेल्या केंद्राला, जिल्हा रुग्णालय किंवा जवळ असल्यास उपजिल्हा रुग्णालय (FRU).',
            },
        };
    }
    if (priority === 'YELLOW') {
        return {
            tier: 'CHC',
            tierName: TIER_NAME.CHC,
            action: {
                en: 'Expedited referral to a CHC or higher for medical officer consultation and diagnostics within 48 hours.',
                hi: 'चिकित्सा अधिकारी परामर्श व जांच के लिए 48 घंटे के भीतर CHC या उच्च केंद्र को शीघ्र रेफर करें।',
                mr: 'वैद्यकीय अधिकारी सल्ला व तपासणीसाठी 48 तासांत CHC किंवा उच्च केंद्राला त्वरित संदर्भित करा.',
            },
        };
    }
    return {
        tier: 'PHC',
        tierName: TIER_NAME.PHC,
        action: {
            en: 'Routine OPD consultation at the PHC is sufficient — no urgent referral needed.',
            hi: 'PHC पर नियमित ओपीडी परामर्श पर्याप्त है — तुरंत रेफरल की आवश्यकता नहीं।',
            mr: 'PHC येथे नियमित ओपीडी सल्ला पुरेसा आहे — तातडीच्या संदर्भाची गरज नाही.',
        },
    };
}

export interface EntitlementSummary {
    tier: FacilityType;
    lines: Localized[];
}

export function entitlementsAt(tier: FacilityType): EntitlementSummary {
    return { tier, lines: getEntitlements(tier).lines };
}

export interface StockSummary {
    facilityId: string;
    facilityName: string;
    total: number;
    inStock: number;
    sample: string[];
}

/** Free essential medicine availability at a named facility. */
export function medicineStockAt(facilityId: string): StockSummary | null {
    const facility = FACILITY_NETWORK.find((f) => f.id === facilityId);
    if (!facility) return null;
    const summary = freeEssentialMedicinesAt(facilityId, SEED_MEDICINES);
    return { facilityId, facilityName: facility.name, ...summary };
}

export interface ScheduleSummary {
    tier: FacilityType;
    entries: { label: Localized; time: string; nextDate: string }[];
}

/** Upcoming recurring clinic/camp days at a tier, with real computed next-occurrence dates. */
export function scheduleAt(tier: FacilityType): ScheduleSummary {
    const entries = TIER_SERVICE_SCHEDULE[tier].map((entry) => ({
        label: entry.label,
        time: entry.time,
        nextDate: nextOccurrence(entry.weekday).toDateString(),
    }));
    return { tier, entries };
}

export interface RouteEntry {
    path: string;
    label: Localized;
    roles: string[] | 'ALL';
}

/** App navigation map — where a worker goes to do a given task. */
export const APP_ROUTES: RouteEntry[] = [
    { path: '/opd', label: { en: 'OPD registration & digital triage', hi: 'ओपीडी पंजीकरण व डिजिटल ट्राइएज', mr: 'ओपीडी नोंदणी व डिजिटल ट्राइएज' }, roles: ['ASHA', 'ANM', 'MO'] },
    { path: '/triage', label: { en: 'Triage assessment (vitals entry)', hi: 'ट्राइएज मूल्यांकन (वाइटल्स एंट्री)', mr: 'ट्राइएज मूल्यांकन (व्हायटल्स नोंद)' }, roles: ['ASHA', 'ANM', 'MO'] },
    { path: '/record', label: { en: 'Patient health record', hi: 'रोगी स्वास्थ्य अभिलेख', mr: 'रुग्ण आरोग्य नोंद' }, roles: 'ALL' },
    { path: '/referrals', label: { en: 'Referral tracker (108/102)', hi: 'रेफरल ट्रैकर (108/102)', mr: 'संदर्भ ट्रॅकर (108/102)' }, roles: 'ALL' },
    { path: '/incoming', label: { en: 'Pre-arrival board — patients en route here', hi: 'आगमन-पूर्व बोर्ड — रास्ते में मरीज', mr: 'आगमनपूर्व फलक — मार्गावरील रुग्ण' }, roles: ['MO', 'ANM', 'SPECIALIST', 'DHO'] },
    { path: '/diagnostics', label: { en: 'Lab & diagnostics — log a result', hi: 'लैब व जांच — परिणाम दर्ज करें', mr: 'लॅब व निदान — निकाल नोंदवा' }, roles: ['LAB_TECH', 'MO', 'SPECIALIST'] },
    { path: '/medicine', label: { en: 'Essential medicine stock / dispensing', hi: 'आवश्यक दवा स्टॉक / वितरण', mr: 'अत्यावश्यक औषध साठा / वितरण' }, roles: ['PHARMACIST', 'MO'] },
    { path: '/queue', label: { en: 'Queue & token management', hi: 'कतार व टोकन प्रबंधन', mr: 'रांग व टोकन व्यवस्थापन' }, roles: ['ASHA', 'ANM', 'MO'] },
    { path: '/teleconsult', label: { en: 'Teleconsultation with a specialist (eSanjeevani)', hi: 'विशेषज्ञ से टेलीकंसल्टेशन (ई-संजीवनी)', mr: 'तज्ज्ञांशी टेलिकन्सल्टेशन (ई-संजीवनी)' }, roles: ['MO', 'ANM'] },
    { path: '/facilities', label: { en: 'Facility directory (services, beds, equipment)', hi: 'सुविधा निर्देशिका', mr: 'सुविधा निर्देशिका' }, roles: 'ALL' },
    { path: '/followup', label: { en: 'High-risk follow-up recall (ANC / child / NCD)', hi: 'उच्च जोखिम फॉलो-अप रिकॉल', mr: 'उच्च जोखीम फॉलो-अप रिकॉल' }, roles: ['ASHA', 'ANM'] },
    { path: '/emergency', label: { en: 'Emergency SOS (108/102)', hi: 'आपातकालीन SOS (108/102)', mr: 'आपत्कालीन SOS (108/102)' }, roles: 'ALL' },
    { path: '/dashboard', label: { en: 'District health command dashboard', hi: 'जिला स्वास्थ्य कमांड डैशबोर्ड', mr: 'जिल्हा आरोग्य कमांड डॅशबोर्ड' }, roles: ['DHO', 'SPECIALIST'] },
    { path: '/audit', label: { en: 'Audit trail', hi: 'ऑडिट ट्रेल', mr: 'ऑडिट ट्रेल' }, roles: ['MO', 'SPECIALIST', 'DHO'] },
    { path: '/staff', label: { en: 'Staff / login', hi: 'स्टाफ / लॉगिन', mr: 'कर्मचारी / लॉगिन' }, roles: 'ALL' },
];

export function routesForRole(role: string | null): RouteEntry[] {
    return APP_ROUTES.filter((r) => r.roles === 'ALL' || (role && r.roles.includes(role)));
}

/** Picks the localized string for the app's active language, English fallback. */
export function localize(text: Localized, language: Language): string {
    return text[language] ?? text.en;
}
