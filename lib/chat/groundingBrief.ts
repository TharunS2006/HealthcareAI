/**
 * NalamMesh Assistant — grounding brief for Layer 2 (cloud LLM).
 *
 * The FastAPI reporting service has no copy of facility/scheme/threshold data —
 * duplicating it in Python would create a second place for it to drift. Instead
 * the client renders this compact text brief from the same TypeScript data
 * modules the rest of the app uses, and sends it with every cloud chat request;
 * the backend's system prompt instructs the model never to contradict it.
 *
 * ABOUT_THIS_SYSTEM rides along for a different reason. Most questions the
 * assistant cannot answer offline are not clinical at all — they are someone
 * asking what this thing is: an evaluator, a visiting officer, a worker on
 * their first day. Without these facts the model would either refuse or invent
 * an architecture, and an invented answer about a medical system is worse than
 * no answer. With them it can describe the platform accurately, including the
 * parts it deliberately does not do.
 */

import type { Language } from '@/stores/languageStore';
import type { FacilityType } from '@/types/facility';
import { CLINICAL_THRESHOLDS, listFacilities, REFERRAL_PATHWAY, entitlementsAt, localize } from './knowledgeBase';

/**
 * What NalamMesh is, in the model's own working memory.
 *
 * Kept as prose rather than assembled from the data modules on purpose: this
 * describes design decisions and their reasons, which live in no data file.
 * Every line here must stay true of the running app — it is quoted to people
 * evaluating the system, so a stale claim is a false claim.
 */
export const ABOUT_THIS_SYSTEM = `NalamMesh is an offline-first digital public healthcare platform for rural and underserved areas, built for Smart India Hackathon 2025, Problem Statement 26133 ("Accessibility and quality of public healthcare services, particularly in rural and underserved areas"), for the Government of Maharashtra. Interface languages: English, Hindi, Marathi.

THE PROBLEM IT ADDRESSES: rural facilities lose connectivity for hours or days; a paper referral arrives with the patient rather than ahead of them, so the receiving hospital starts preparing only once the patient is at the door; and nobody at district level can see across facilities to know where the load is.

ARCHITECTURE — three tiers, each usable without the one above it:
1. DEVICE (the clinical source of truth): Next.js 14 App Router as a static export, React 18, TypeScript, all patient/queue/referral/inventory data in the browser's IndexedDB. Runs with no network at all. Packaged for Android with Capacitor.
2. MESH RELAY (optional): a Socket.io server that forwards records peer-to-peer between nearby facilities on a shared LAN, for the continuum of care Sub-Centre → PHC → CHC → District Hospital. The app shows ONLINE or STANDALONE honestly and works either way.
3. DISTRICT CLOUD (optional): a FastAPI + SQLModel service (SQLite locally, Postgres on a host) that does two jobs — de-identified district analytics, and the pre-arrival record sync described below.

EDGE AI TRIAGE: a TensorFlow.js model runs in the browser and is trained on-device from a seeded synthetic dataset, so triage works offline and reproducibly. A deterministic IPHS clinical rule engine always has the final say on danger signs — the neural model can raise a priority but can never lower one below what the rules demand.

PRE-ARRIVAL RECORD SYNC (the answer to "prepare before the patient arrives"): when a case is referred, including an emergency referral from /emergency, the device queues the full patient record in an outbox. If there is no connectivity the case still moves — the record simply waits. The moment connectivity returns the record uploads to the district cloud, and the receiving facility's pre-arrival board at /incoming shows it: patient, age, sex, vitals, gestational status, and the triage engine's risk flags, with the referral's priority and origin facility. The receiving team can ready equipment, blood, or a theatre before the ambulance arrives. Nothing about this blocks care: if the cloud is unreachable, the referral and the ambulance dispatch proceed exactly as they would have, and the record uploads later.

THIS ASSISTANT: two layers. Layer 1 runs entirely offline in the browser and composes answers out of the app's own data — triage thresholds, referral routing, which facility has which service or equipment, scheme entitlements, clinic days, where a screen lives. It cannot hallucinate because it only reports what is in the app. Layer 2 (this one) is a cloud language model, used only when Layer 1 finds no confident match and the device is online, and it is given the brief above as ground truth.

MAIN SCREENS: /opd (registration and edge-AI triage), /dashboard (district command: facility census, KPIs, high-risk list), /referrals (referral board: each referral's status from sent to discharged, with the 108/102 transport and vehicle number the sender records — the app does not dispatch or track ambulances; 108 and 102 are called by phone), /incoming (receiving facility's pre-arrival board), /emergency (public emergency dispatch), /queue (live OPD token queue with a TV waiting-room mode), /teleconsult (low-bandwidth specialist consult), /medicine (essential medicine stock and lab orders), /facilities (four-tier directory), /followup (high-risk ANC, SAM and NCD recall), /record, /appointments, /diagnostics, /services, /audit, and the citizen-facing GIGW pages (/accessibility, /privacy, /terms, /rti, /copyright, /feedback).

WHAT IT DELIBERATELY DOES NOT DO: it does not diagnose, and it never recommends a medicine dose. The district analytics tables carry de-identified aggregates only — no patient names. The pre-arrival sync is the one exception and it is intentional: a receiving clinician needs the identified record, so that path carries the full record to the district store rather than a summary. The cloud is a courier, never a dependency: with every server switched off, triage, registration, referral, dispatch and the offline assistant all still work.`

export function buildGroundingBrief(language: Language): string {
    const t = CLINICAL_THRESHOLDS;
    const facilities = listFacilities()
        .map((f) => `- ${f.name} (${f.tier}): services [${f.services.join(', ')}]; equipment [${f.equipment.join(', ')}]; ${f.ambulanceAvailable} ambulances; ${f.bedsOccupied}/${f.bedsTotal} beds occupied; hours ${f.operatingHours}.`)
        .join('\n');

    const entitlementLines = (['PHC', 'CHC', 'DH'] as FacilityType[])
        .map((tier) => `${tier}: ${entitlementsAt(tier).lines.map((l) => localize(l, language)).join(' ')}`)
        .join('\n');

    return [
        'REFERRAL PATHWAY: ' + REFERRAL_PATHWAY.join(' → '),
        '',
        'FACILITIES:',
        facilities,
        '',
        'TRIAGE THRESHOLDS (exact values enforced by the app\'s triage engine — never restate these differently):',
        `RED: SpO2<${t.spo2.criticalBelow}%, HR>${t.heartRate.criticalAbove} or <${t.heartRate.criticalBelow}, systolic<=${t.systolic.criticalBelowOrEqual} or >=${t.systolic.criticalAboveOrEqual}, diastolic>=${t.diastolic.criticalAboveOrEqual}, RR>=${t.respiratoryRate.criticalAboveOrEqual} or <=${t.respiratoryRate.criticalBelowOrEqual}, glucose<=${t.glucose.criticalBelowOrEqual} or >=${t.glucose.criticalAboveOrEqual}.`,
        `YELLOW: SpO2<${t.spo2.cautionBelow}%, HR>${t.heartRate.cautionAbove}, systolic>=${t.systolic.cautionAboveOrEqual} or diastolic>=${t.diastolic.cautionAboveOrEqual}, RR>=${t.respiratoryRate.cautionAboveOrEqual}, temp>=${t.temperature.cautionAboveOrEqual}F, glucose>=${t.glucose.cautionAboveOrEqual}.`,
        '',
        'ENTITLEMENTS BY TIER:',
        entitlementLines,
        '',
        'ABOUT THIS SYSTEM (use this to answer questions about NalamMesh itself):',
        ABOUT_THIS_SYSTEM,
    ].join('\n');
}
