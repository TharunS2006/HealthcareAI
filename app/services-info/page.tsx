/**
 * Health Services & Entitlements — NalamMesh (SIH PS#26133)
 *
 * Patient- and ASHA-facing awareness screen. PS#26133 names "limited awareness of
 * available services" and "affordability" as root causes of poor rural access; this is
 * the surface that answers, per facility, "what is offered here, WHEN, and what is free."
 *
 * All content is static seed data + dates computed from today, so it works fully offline.
 * The affordability panel is display-only awareness — it performs no scheme verification.
 * Full trilingual localisation: English, Hindi (हिन्दी), Marathi (मराठी).
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import {
    TIER_SERVICE_SCHEDULE,
    nextOccurrence,
    getEntitlements,
    freeEssentialMedicinesAt,
    type Localized,
} from '@/lib/data/patientServices';
import { useLanguageStore } from '@/stores/languageStore';
import Link from 'next/link';

export default function ServicesInfoPage() {
    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';
    const pick = (l: Localized) => (isEn ? l.en : isHi ? l.hi : l.mr);

    // Default to PHC Bhamragad — the station shown throughout the app.
    const [facilityId, setFacilityId] = useState('phc-bhamragad');
    const facility = MAHARASHTRA_FACILITIES.find(f => f.id === facilityId) ?? MAHARASHTRA_FACILITIES[0];

    const schedule = TIER_SERVICE_SCHEDULE[facility.type] ?? [];
    const entitlements = getEntitlements(facility.type);
    const meds = freeEssentialMedicinesAt(facility.id);

    const weekdayNames: Localized[] = [
        { en: 'Sunday', hi: 'रविवार', mr: 'रविवार' },
        { en: 'Monday', hi: 'सोमवार', mr: 'सोमवार' },
        { en: 'Tuesday', hi: 'मंगलवार', mr: 'मंगळवार' },
        { en: 'Wednesday', hi: 'बुधवार', mr: 'बुधवार' },
        { en: 'Thursday', hi: 'गुरुवार', mr: 'गुरुवार' },
        { en: 'Friday', hi: 'शुक्रवार', mr: 'शुक्रवार' },
        { en: 'Saturday', hi: 'शनिवार', mr: 'शनिवार' },
    ];

    const localeCode = isEn ? 'en-IN' : isHi ? 'hi-IN' : 'mr-IN';
    const formatDate = (d: Date) =>
        d.toLocaleDateString(localeCode, { day: 'numeric', month: 'short', year: 'numeric' });

    // Read-aloud for low-literacy users — the most direct health-literacy lever.
    // Progressive enhancement: silently does nothing where speechSynthesis is unavailable.
    const speak = (text: string) => {
        try {
            if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = localeCode;
            window.speechSynthesis.speak(u);
        } catch {
            /* TTS unavailable — the text is already on screen, so this is non-blocking. */
        }
    };

    const txt = {
        deptTag: isEn ? 'Government of Maharashtra • Public Health — Citizen Services'
            : isHi ? 'महाराष्ट्र सरकार • सार्वजनिक स्वास्थ्य — नागरिक सेवाएं'
            : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य — नागरिक सेवा',
        title: isEn ? 'Health Services & Your Entitlements'
            : isHi ? 'स्वास्थ्य सेवाएं एवं आपके अधिकार'
            : 'आरोग्य सेवा व आपले हक्क',
        subTitle: isEn ? 'What is available at your health centre, when clinics run, and what is free of cost'
            : isHi ? 'आपके स्वास्थ्य केंद्र पर क्या उपलब्ध है, क्लिनिक कब लगते हैं, और क्या निःशुल्क है'
            : 'आपल्या आरोग्य केंद्रावर काय उपलब्ध आहे, चिकित्सालय केव्हा भरते, आणि काय मोफत आहे',
        chooseFacility: isEn ? 'Choose your health centre' : isHi ? 'अपना स्वास्थ्य केंद्र चुनें' : 'आपले आरोग्य केंद्र निवडा',
        servicesTitle: isEn ? 'Services Offered Here' : isHi ? 'यहां उपलब्ध सेवाएं' : 'येथे उपलब्ध सेवा',
        hoursLabel: isEn ? 'Opening hours' : isHi ? 'खुलने का समय' : 'सुरू असण्याची वेळ',
        scheduleTitle: isEn ? 'Clinic & Camp Schedule' : isHi ? 'क्लिनिक एवं शिविर अनुसूची' : 'चिकित्सालय व शिबिर वेळापत्रक',
        nextLabel: isEn ? 'Next:' : isHi ? 'अगला:' : 'पुढील:',
        entitlementsTitle: isEn ? 'What Is Free For You' : isHi ? 'आपके लिए क्या निःशुल्क है' : 'आपल्यासाठी काय मोफत आहे',
        freeMedsTitle: isEn ? 'Free essential medicines in stock' : isHi ? 'स्टॉक में निःशुल्क आवश्यक दवाएं' : 'साठ्यातील मोफत अत्यावश्यक औषधे',
        freeMedsNone: isEn ? 'Medicine stock is not reported for this centre. Ask staff about free essential medicines.'
            : isHi ? 'इस केंद्र के लिए दवा स्टॉक दर्ज नहीं है। निःशुल्क आवश्यक दवाओं के बारे में कर्मचारियों से पूछें।'
            : 'या केंद्रासाठी औषध साठा नोंदवलेला नाही. मोफत अत्यावश्यक औषधांबद्दल कर्मचाऱ्यांना विचारा.',
        ofLabel: isEn ? 'of' : isHi ? 'में से' : 'पैकी',
        inStockLabel: isEn ? 'in stock' : isHi ? 'स्टॉक में' : 'साठ्यात',
        readAloud: isEn ? 'Read aloud' : isHi ? 'सुनें' : 'ऐका',
        disclaimer: isEn ? 'This is general awareness information, not an individual eligibility decision. Confirm details with centre staff.'
            : isHi ? 'यह सामान्य जागरूकता जानकारी है, व्यक्तिगत पात्रता निर्णय नहीं। विवरण केंद्र कर्मचारियों से पुष्टि करें।'
            : 'ही सर्वसाधारण जनजागृती माहिती आहे, वैयक्तिक पात्रता निर्णय नाही. तपशील केंद्र कर्मचाऱ्यांकडून खात्री करा.',
        viewFacility: isEn ? 'Full facility details →' : isHi ? 'पूरा केंद्र विवरण →' : 'संपूर्ण केंद्र तपशील →',
    };

    const entitlementSpeech = entitlements.lines.map(pick).join('. ');

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />

                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                    {txt.deptTag}
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">
                                {txt.title}
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">{txt.subTitle}</p>
                        </div>
                    </div>

                    {/* Facility picker */}
                    <div className="surface-card p-4">
                        <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider block mb-2">
                            {txt.chooseFacility}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <select
                                value={facilityId}
                                onChange={(e) => setFacilityId(e.target.value)}
                                className="px-3.5 py-2 bg-gray-50 border border-border-subtle rounded-xl text-sm w-full sm:w-96 focus:outline-none focus:ring-2 focus:ring-emerald-deep"
                            >
                                {MAHARASHTRA_FACILITIES.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.type} — {f.name}
                                    </option>
                                ))}
                            </select>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border-subtle rounded font-bold text-xs text-txt-secondary shadow-sm">
                                <Icon name="map-pin" className="w-3.5 h-3.5" /> {facility.tehsil}, {facility.district}
                            </span>
                        </div>
                    </div>

                    {/* Three panels */}
                    <div className="grid lg:grid-cols-3 gap-6">

                        {/* 1. Services offered */}
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="surface-card p-5 border-t-4 border-[#1F3A6E]">
                            <h2 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider mb-3">
                                {txt.servicesTitle}
                            </h2>
                            <ul className="space-y-2">
                                {facility.services.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-txt-primary">
                                        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-txt-secondary">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span><strong>{txt.hoursLabel}:</strong> {facility.operatingHours}</span>
                            </div>
                        </motion.div>

                        {/* 2. Clinic & camp schedule */}
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                            className="surface-card p-5 border-t-4 border-emerald-600">
                            <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-3">
                                {txt.scheduleTitle}
                            </h2>
                            <ul className="space-y-3">
                                {schedule.map(entry => {
                                    const next = nextOccurrence(entry.weekday);
                                    const isToday = next.toDateString() === new Date().toDateString();
                                    return (
                                        <li key={entry.key} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <div>
                                                    <p className="text-sm font-semibold text-txt-primary">{pick(entry.label)}</p>
                                                    <p className="text-xs text-txt-secondary mt-0.5">
                                                        {pick(weekdayNames[entry.weekday])} • {entry.time}
                                                    </p>
                                                    <p className={`text-xs font-bold mt-1 ${isToday ? 'text-emerald-700' : 'text-[#1F3A6E]'}`}>
                                                        {txt.nextLabel} {formatDate(next)}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </motion.div>

                        {/* 3. Entitlements & affordability */}
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="surface-card p-5 border-t-4 border-[#B45309]">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-bold text-[#B45309] uppercase tracking-wider">
                                    {txt.entitlementsTitle}
                                </h2>
                                <button
                                    onClick={() => speak(entitlementSpeech)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                                    aria-label={txt.readAloud}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                    {txt.readAloud}
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {entitlements.lines.map((line, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-txt-primary">
                                        <svg className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{pick(line)}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Free essential medicines, from live stock */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <p className="text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                                    {txt.freeMedsTitle}
                                </p>
                                {meds.total === 0 ? (
                                    <p className="text-xs text-txt-secondary italic">{txt.freeMedsNone}</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-black text-emerald-700">
                                            {meds.inStock} <span className="text-xs font-normal text-txt-secondary">{txt.ofLabel} {meds.total} {txt.inStockLabel}</span>
                                        </p>
                                        {meds.sample.length > 0 && (
                                            <p className="text-xs text-txt-secondary mt-1">{meds.sample.join(' • ')}</p>
                                        )}
                                    </>
                                )}
                            </div>

                            <Link href="/facilities" className="inline-block mt-4 text-xs font-bold text-[#1F3A6E] underline">
                                {txt.viewFacility}
                            </Link>
                        </motion.div>
                    </div>

                    {/* Honest disclaimer — awareness, not an eligibility ruling */}
                    <div className="surface-card p-3 bg-slate-50/60 flex items-start gap-2">
                        <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-[11px] text-txt-secondary">{txt.disclaimer}</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
