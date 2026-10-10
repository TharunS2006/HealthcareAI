/**
 * District & Facility Health Dashboard — NalamMesh
 * Administrative View for District Health Officer (DHO) & Medical Superintendents
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 *
 * Every figure is computed from the records on this device. The facility tree
 * and the high-risk list were partly drawn by hand — fixed bed counts, and a
 * clinical description chosen by the patient's first name — and are now built
 * from the facility and patient records (components/dashboard/FacilityTree.tsx,
 * lib/analytics/patientSummary.ts). A rate with nothing to measure shows a dash.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PortalShell from '@/components/gov/PortalShell';
import GovPanel from '@/components/gov/GovPanel';
import MobileMenu from '@/components/shared/MobileMenu';
import DemoModeToggle from '@/components/shared/DemoModeToggle';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useQueueStore } from '@/stores/queueStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useMeshStatus } from '@/lib/hooks/useMeshStatus';
import {
    scoreAllFacilities,
    computeDangerSignTelemetry,
    computeTravelSavings,
} from '@/lib/analytics/facilityMetrics';
import Link from 'next/link';
import ReferralCommand from '@/components/dashboard/ReferralCommand';
import FacilityTree from '@/components/dashboard/FacilityTree';
import { clinicalSummary } from '@/lib/analytics/patientSummary';
import { districtSuffix } from '@/lib/config/deployment';
import { PRODUCTION } from '@/lib/config/mode';
import OfficialHealthContext from '@/components/dashboard/OfficialHealthContext';
import { isOpenReferral } from '@/lib/referrals/workflow';
import { useSession } from '@/lib/auth/session';
import { isDistrictWide, ROLE_LABELS } from '@/lib/auth/permissions';

export default function DashboardPage() {
    const session = useSession();
    // DHO and Super Admin see the district; a Hospital Admin gets a read-only
    // Command Center for their own facility — no district patient lists.
    const districtWide = isDistrictWide(session?.role ?? null);
    const { patients, loadPatients } = usePatientStore();
    const { referrals, loadReferrals } = useReferralStore();
    const { queue, loadQueue } = useQueueStore();
    const { facilities, medicines, loadAll } = useFacilityStore();
    const { language } = useLanguageStore();
    const meshStatus = useMeshStatus();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    useEffect(() => {
        loadPatients();
        loadReferrals();
        loadQueue();
        loadAll();
    }, [loadPatients, loadReferrals, loadQueue, loadAll]);

    // Aggregate District Metrics
    const redCount = patients.filter(p => p.triageStatus === 'RED').length;
    const yellowCount = patients.filter(p => p.triageStatus === 'YELLOW').length;
    const greenCount = patients.filter(p => p.triageStatus === 'GREEN').length;

    const pendingRefs = referrals.filter(r => isOpenReferral(r.status)).length;
    const inTransitCount = referrals.filter(r => r.status === 'ACCEPTED' && Boolean(r.inTransitAt)).length;
    const waitingQueue = queue.filter(q => q.status === 'WAITING').length;

    // Collect High Risk Flagged Patients
    const highRiskPatients = patients.filter(p => (p.highRiskFlags && p.highRiskFlags.length > 0) || p.triageStatus === 'RED');

    // Derived district analytics — every figure below is computed from the records
    // actually held on this device, so they move with the data instead of being fixed
    // display numbers a judge or a DHO could not reconcile against the record list.
    const scorecards = useMemo(() => scoreAllFacilities(facilities), [facilities]);
    const dangerSigns = useMemo(
        () => computeDangerSignTelemetry(patients, referrals),
        [patients, referrals]
    );
    const travel = useMemo(
        () => computeTravelSavings(patients, referrals, facilities),
        [patients, referrals, facilities]
    );

    // IPHS quality indicators, measured rather than asserted.
    // Completion: of referrals that have reached a decision, the share whose
    // patient was admitted. Still-open referrals are left out of the
    // denominator rather than counted as failures.
    const decided = referrals.filter(r => !isOpenReferral(r.status) && r.status !== 'CREATED');
    const completedRefs = decided.filter(r => ['PATIENT_ARRIVED', 'ADMITTED', 'DISCHARGED'].includes(r.status)).length;
    const referralCompletionRate = decided.length === 0
        ? 0
        : Math.round((completedRefs / decided.length) * 100);

    // Measured from the clock — registration to call — over tokens that were seen.
    // (Tokens once carried a fixed "estimated wait" by triage colour; nothing measured it.)
    const consultedQueue = queue.filter(q => q.status === 'COMPLETED' && q.registeredAt && q.calledAt);
    const waitSamples = consultedQueue
        .map(q => (new Date(q.calledAt!).getTime() - new Date(q.registeredAt).getTime()) / 60000)
        .filter(mins => Number.isFinite(mins) && mins >= 0);
    const avgWaitMinutes = waitSamples.length === 0
        ? 0
        : Math.round(waitSamples.reduce((sum, m) => sum + m, 0) / waitSamples.length);
    // IPHS benchmark for OPD waiting is 30 minutes; score against that, floored at 0.
    const waitTimeScore = waitSamples.length === 0
        ? 0
        : Math.max(0, Math.min(100, Math.round(((30 - avgWaitMinutes) / 30) * 100)));

    const essentialMeds = medicines.filter(m => m.isEssentialIPHS);
    const medicineAvailability = essentialMeds.length === 0
        ? 0
        : Math.round(
            (essentialMeds.filter(m => m.status === 'ADEQUATE').length / essentialMeds.length) * 100
        );

    const maternalFlagged = patients.filter(p => p.highRiskFlags?.some(f => f.type === 'MATERNAL'));
    const maternalOnSchedule = maternalFlagged.filter(p =>
        p.highRiskFlags?.some(f => f.type === 'MATERNAL' && (f.overdueDays ?? 0) <= 0)
    ).length;
    const maternalFollowUpRate = maternalFlagged.length === 0
        ? 0
        : Math.round((maternalOnSchedule / maternalFlagged.length) * 100);

    // Localization Dictionary for Dashboard
    const txt = {
        deptTag: isEn ? 'Government of Maharashtra • Public Health Dept' : isHi ? 'महाराष्ट्र सरकार • लोक स्वास्थ्य विभाग' : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग',
        title: isEn ? `District Health Command${districtSuffix(language)}` : isHi ? `जिला स्वास्थ्य कमांड केंद्र${districtSuffix(language)}` : `जिल्हा आरोग्य कमांड केंद्र${districtSuffix(language)}`,
        subTitle: isEn
            ? 'Sub-Centres, PHCs, CHCs and the District Hospital — from the records on this device and the referral network'
            : isHi
            ? 'उप-केंद्र, प्राथमिक स्वास्थ्य केंद्र (PHC), सामुदायिक स्वास्थ्य केंद्र (CHC) और जिला अस्पताल — इस डिवाइस के अभिलेखों व रेफरल नेटवर्क से'
            : 'उप-केंद्रे, प्राथमिक आरोग्य केंद्रे (PHC), ग्रामीण रुग्णालये (CHC) आणि जिल्हा रुग्णालय — या उपकरणावरील नोंदी व संदर्भ नेटवर्कमधून',
        meshOnline: isEn ? 'Mesh Relay Online' : isHi ? 'मेश रिले ऑनलाइन' : 'मेश रिले ऑनलाइन',
        meshStandalone: isEn ? 'Mesh Relay Standalone' : isHi ? 'मेश रिले स्वतंत्र' : 'मेश रिले स्वतंत्र',
        meshConnecting: isEn ? 'Mesh Relay Connecting' : isHi ? 'मेश रिले जुड़ रहा है' : 'मेश रिले जोडत आहे',

        // Metrics
        patientsToday: isEn ? 'Patients in System' : isHi ? 'सिस्टम में कुल मरीज' : 'प्रणालीतील एकूण रुग्ण',
        registeredInSystem: isEn ? 'counted from the records on this device' : isHi ? 'इस डिवाइस के अभिलेखों से गिना गया' : 'या उपकरणावरील नोंदींवरून मोजले',
        pendingReferrals: isEn ? 'Pending Referrals' : isHi ? 'प्रलंबित रेफरल' : 'प्रलंबित संदर्भ सेवा (रेफरल)',
        inTransit: isEn ? `${inTransitCount} In-Transit (102/108)` : isHi ? `${inTransitCount} मार्ग में (१०२/१०८)` : `${inTransitCount} मार्गावर (१०२/१०८)`,
        viewLink: isEn ? 'View →' : isHi ? 'देखें →' : 'पहा →',
        queueLength: isEn ? 'Queue Length (PHC)' : isHi ? 'ओपीडी कतार (PHC)' : 'ओपीडी रांग (PHC)',
        avgWait: waitSamples.length === 0
            ? (isEn ? 'Avg. Wait Time: no data yet' : isHi ? 'औसत प्रतीक्षा समय: अभी कोई डेटा नहीं' : 'सरासरी प्रतीक्षा वेळ: अद्याप डेटा नाही')
            : (isEn ? `Avg. Wait Time: ${avgWaitMinutes} mins` : isHi ? `औसत प्रतीक्षा समय: ${avgWaitMinutes} मिनट` : `सरासरी प्रतीक्षा वेळ: ${avgWaitMinutes} मिनिटे`),
        highRiskAlerts: isEn ? 'High-Risk Alerts' : isHi ? 'उच्च जोखिम अलर्ट' : 'उच्च जोखीम सूचना',
        criticalFollowups: isEn
            ? `${redCount} Critical • Overdue Follow-ups`
            : isHi
            ? `${redCount} गंभीर • लंबित फॉलो-अप`
            : `${redCount} अतिगंभीर • प्रलंबित तपासणी`,

        // Continuum Tree
        treeTitle: isEn ? 'Referral Network' : isHi ? 'रेफरल नेटवर्क' : 'संदर्भ सेवा नेटवर्क',
        treeSub: isEn ? 'District Hospital → Sub-District → CHC → PHC → Sub-Centres, as the facility records report them' : isHi ? 'जिला अस्पताल → उप-जिला अस्पताल → CHC → PHC → उप-केंद्र, केंद्र अभिलेखों के अनुसार' : 'जिल्हा रुग्णालय → उपजिल्हा रुग्णालय → CHC → PHC → उप-केंद्रे, संस्थांच्या नोंदींनुसार',
        nodesConnected: isEn ? `${facilities.length} facilities` : isHi ? `${facilities.length} केंद्र` : `${facilities.length} केंद्रे`,
        
        // High-Risk Action List
        actionListTitle: isEn ? 'High-Risk Patient Action List' : isHi ? 'उच्च जोखिम मरीज कार्य सूची' : 'उच्च जोखीम रुग्ण कृती सूची',
        actionRequired: isEn ? 'Action Required' : isHi ? 'कार्रवाई अपेक्षित' : 'त्वरित कारवाई आवश्यक',
        openRecord: isEn ? 'Open Record →' : isHi ? 'विवरण खोलें →' : 'नोंद पहा →',
        priorityRed: isEn ? 'RED PRIORITY' : isHi ? 'अति गंभीर (लाल)' : 'तातडीचे (लाल)',
        priorityYellow: isEn ? 'YELLOW PRIORITY' : isHi ? 'प्राथमिकता (पीला)' : 'प्राधान्य (पिवळा)',
        priorityGreen: isEn ? 'GREEN PRIORITY' : isHi ? 'सामान्य (हरा)' : 'नियमित (हिरवा)',

        // Danger-sign cascade (mortality prevention telemetry)
        cascadeTitle: isEn ? 'Danger-Sign Escalation Cascade' : isHi ? 'खतरे के लक्षण एस्केलेशन शृंखला' : 'धोकादायक लक्षण एस्केलेशन शृंखला',
        cascadeSub: isEn
            ? 'Tracks every detected danger sign through to definitive care. Cases detected but never escalated are the avoidable-mortality gap MDSR/CDR reviews look for.'
            : isHi
            ? 'प्रत्येक खतरे के लक्षण को निश्चित उपचार तक ट्रैक करता है। पहचाने गए किंतु रेफर न किए गए मामले ही टाली जा सकने वाली मृत्यु का अंतर हैं।'
            : 'प्रत्येक धोकादायक लक्षणाचा निश्चित उपचारापर्यंत मागोवा. आढळूनही संदर्भित न झालेली प्रकरणे हीच टाळता येणाऱ्या मृत्यूची तफावत आहे.',
        detected: isEn ? 'Detected' : isHi ? 'पहचाने गए' : 'आढळले',
        escalated: isEn ? 'Escalated' : isHi ? 'रेफर किए' : 'संदर्भित',
        reachedCare: isEn ? 'Reached Care' : isHi ? 'उपचार मिला' : 'उपचार मिळाले',
        escalationRate: isEn ? 'Escalation Rate' : isHi ? 'रेफरल दर' : 'संदर्भ दर',
        awaitingEscalation: isEn
            ? 'danger sign(s) detected but not yet escalated — review today'
            : isHi
            ? 'खतरे के लक्षण पहचाने गए किंतु रेफर नहीं — आज समीक्षा करें'
            : 'धोकादायक लक्षणे आढळली पण संदर्भित नाहीत — आज आढावा घ्या',
        noBacklog: isEn
            ? 'Every detected danger sign has been escalated'
            : isHi
            ? 'सभी पहचाने गए खतरे के लक्षण रेफर किए जा चुके हैं'
            : 'सर्व आढळलेली धोकादायक लक्षणे संदर्भित झाली आहेत',
        stillInTransit: isEn ? 'still in the referral pipeline' : isHi ? 'अभी भी रेफरल पाइपलाइन में' : 'अद्याप संदर्भ प्रक्रियेत',

        // Travel burden avoided
        travelTitle: isEn ? 'Travel Burden Avoided' : isHi ? 'यात्रा भार में कमी' : 'प्रवास भार बचत',
        travelSub: isEn
            ? 'Round-trip distance patients did not travel because the episode was closed at their nearest Sub-Centre/PHC/CHC instead of the district hospital. Referred patients are excluded — they travelled anyway.'
            : isHi
            ? 'रोगियों द्वारा न की गई आवागमन दूरी, क्योंकि उपचार निकटतम उपकेंद्र/PHC/CHC पर ही पूर्ण हुआ। रेफर किए गए रोगी शामिल नहीं हैं।'
            : 'रुग्णांनी न केलेले येण्या-जाण्याचे अंतर, कारण उपचार जवळच्या उपकेंद्र/PHC/CHC मध्येच पूर्ण झाले. संदर्भित रुग्ण वगळले आहेत.',
        episodes: isEn ? 'Episodes' : isHi ? 'प्रकरण' : 'प्रकरणे',
        kmAvoided: isEn ? 'KM Avoided' : isHi ? 'कि.मी. बचे' : 'कि.मी. वाचले',
        hoursAvoided: isEn ? 'Hours Avoided' : isHi ? 'घंटे बचे' : 'तास वाचले',
        avgPerEpisode: isEn ? 'Average per episode:' : isHi ? 'प्रति प्रकरण औसत:' : 'प्रति प्रकरण सरासरी:',
        hoursRoundTrip: isEn ? 'hours round trip' : isHi ? 'घंटे आना-जाना' : 'तास येणे-जाणे',
        noLocalEpisodes: isEn
            ? 'No locally-closed episodes yet — every current patient was referred onward.'
            : isHi
            ? 'अभी तक कोई स्थानीय रूप से पूर्ण प्रकरण नहीं — सभी रोगी रेफर किए गए।'
            : 'अद्याप स्थानिक पातळीवर पूर्ण झालेले प्रकरण नाही — सर्व रुग्ण संदर्भित झाले.',

        // Facility scorecards
        scorecardTitle: isEn ? 'Facility Scorecards (IPHS 2022 Benchmark)' : isHi ? 'सुविधा स्कोरकार्ड (IPHS 2022)' : 'आरोग्य संस्था गुणपत्रिका (IPHS 2022)',
        scorecardSub: isEn ? 'Weakest facility first — each tier scored against its own IPHS norm' : isHi ? 'सबसे कमजोर पहले — प्रत्येक स्तर अपने IPHS मानक पर' : 'सर्वात कमकुवत प्रथम — प्रत्येक स्तर स्वतःच्या IPHS मानकानुसार',
        colFacility: isEn ? 'Facility' : isHi ? 'सुविधा' : 'संस्था',
        colTier: isEn ? 'Tier' : isHi ? 'स्तर' : 'स्तर',
        colScore: isEn ? 'Grade' : isHi ? 'ग्रेड' : 'श्रेणी',
        colGaps: isEn ? 'Primary Gap' : isHi ? 'मुख्य कमी' : 'प्रमुख त्रुटी',
        meetsNorms: isEn ? 'Meets IPHS norms' : isHi ? 'IPHS मानक पूर्ण' : 'IPHS मानके पूर्ण',
        moreGaps: isEn ? 'more' : isHi ? 'और' : 'अधिक',
        awaitingData: isEn ? 'Awaiting data' : isHi ? 'डेटा प्रतीक्षित' : 'डेटा प्रतीक्षेत',
        noCompletedConsults: isEn
            ? 'No completed consultations yet today'
            : isHi
            ? 'आज अभी तक कोई परामर्श पूर्ण नहीं'
            : 'आज अद्याप कोणतीही तपासणी पूर्ण नाही',

        // Emergency Dispatch Banner
        dispatchTitle: isEn ? '108 / 102 Emergency Dispatch' : isHi ? '१०८ / १०२ आपातकालीन एम्बुलेंस नियंत्रण' : '१०८ / १०२ आपत्कालीन रुग्णवाहिका नियंत्रण',
        // Counted from dispatched referrals — nothing in this build tracks vehicles.
        dispatchSub: isEn
            ? `${inTransitCount} ${inTransitCount === 1 ? 'patient' : 'patients'} dispatched and on the way to a receiving facility`
            : isHi
            ? `${inTransitCount} मरीज़ रवाना, प्राप्तकर्ता केंद्र की ओर मार्ग में`
            : `${inTransitCount} रुग्ण रवाना, स्वीकारणाऱ्या केंद्राकडे मार्गावर`,
        trackBtn: isEn ? 'View referrals' : isHi ? 'रेफरल देखें' : 'संदर्भ पहा',

        // IPHS Quality Indicators
        iphsTitle: isEn ? 'Indian Public Health Standards (IPHS) Quality Indicators' : isHi ? 'भारतीय सार्वजनिक स्वास्थ्य मानक (IPHS) गुणवत्ता सूचकांक' : 'भारतीय सार्वजनिक आरोग्य मानक (IPHS) गुणवत्ता निर्देशांक',
        iphsSub: isEn ? 'Quality, continuity and accountability, measured from the records on this device' : isHi ? 'गुणवत्ता, निरंतरता व जवाबदेही — इस डिवाइस के अभिलेखों से मापी गई' : 'गुणवत्ता, सातत्य व उत्तरदायित्व — या उपकरणावरील नोंदींवरून मोजलेले',
        quarterlyTarget: isEn ? 'Quarterly Target: 85%+' : isHi ? 'त्रैमासिक लक्ष्य: ८५%+' : 'त्रैमासिक उद्दिष्ट: ८५%+',

        ind1Title: isEn ? 'Referral Completion Rate' : isHi ? 'रेफरल पूर्णता दर' : 'रेफरल पूर्णता दर',
        
        ind2Title: isEn ? 'Avg. OPD Wait Time' : isHi ? 'औसत ओपीडी प्रतीक्षा समय' : 'सरासरी ओपीडी प्रतीक्षा वेळ',
        
        ind3Title: isEn ? 'IPHS Drug Stock Level' : isHi ? 'IPHS आवश्यक दवा स्टॉक स्तर' : 'IPHS अत्यावश्यक औषध साठा',

        ind4Title: isEn ? 'High-Risk ANC Adherence' : isHi ? 'उच्च जोखिम ANC गृह भेंट अनुपालन' : 'उच्च जोखीम माता ANC तपासणी',
    };

    return (
        <PortalShell
            trail={[
                { label: isEn ? 'Home' : 'मुख्य पृष्ठ', href: '/' },
                { label: isEn ? 'District Administration' : 'जिल्हा प्रशासन' },
                { label: isEn ? 'Command Centre' : 'कमांड केंद्र' },
            ]}
        >
            <div className="font-sans text-txt-primary">
                <MobileMenu />

                <div className="space-y-4">

                    {/* Top Header */}
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{txt.deptTag}</span>
                            </div>
                            <h1 className="text-2xl font-bold text-[#1F3A6E] tracking-tight">
                                {txt.title}
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                {txt.subTitle}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Evaluation builds only: it adds made-up patients to this device. */}
                            {districtWide && !PRODUCTION && <DemoModeToggle />}
                            {/* Reflects the actual relay socket — see lib/socket.ts for why this must
                                never be hardcoded to "Online". */}
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium ${
                                    meshStatus === 'ONLINE'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : meshStatus === 'STANDALONE'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                            >
                                <svg className={`w-4 h-4 ${meshStatus === 'ONLINE' ? 'text-emerald-600' : meshStatus === 'STANDALONE' ? 'text-amber-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                                <span>
                                    {meshStatus === 'ONLINE' ? txt.meshOnline : meshStatus === 'STANDALONE' ? txt.meshStandalone : txt.meshConnecting}
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Referral Command — live facilities, referrals, beds, emergencies and escalations. */}
                    <section aria-label="Referral command" className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-base font-bold text-[#1F3A6E]">
                                {districtWide ? 'Referral Command — district, live' : `Referral Command — ${session?.facilityName ?? ''} (read-only)`}
                            </h2>
                            {session && <span className="text-[11px] text-slate-600">{ROLE_LABELS[session.role]} · {session.name}</span>}
                        </div>
                        <ReferralCommand scopeFacilityId={districtWide ? undefined : session?.facilityId ?? undefined} />
                        <OfficialHealthContext />
                    </section>

                    {!districtWide && (
                        <p className="text-[12px] text-slate-600 bg-white border border-slate-300 px-3 py-2">
                            District-wide indicators, high-risk patient lists and facility scorecards are shown to the District Health Officer.
                        </p>
                    )}

                    {districtWide && (<>
                    {/* Row 1: Key Performance Metrics — Sober Government Administrative KPI Grid */}
                    {/* District indicators — a bordered register, not KPI tiles.
                        Large display numbers in a card grid read as a product dashboard;
                        a department portal states the same figures in a table. */}
                    <GovPanel
                        title={isEn ? 'District Health Indicators' : isHi ? 'जिला स्वास्थ्य संकेतक' : 'जिल्हा आरोग्य निर्देशांक'}
                        meta={txt.registeredInSystem}
                        flush
                    >
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#EDF1F7] text-[#1F3A6E]">
                                    <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6]">
                                        {isEn ? 'Indicator' : isHi ? 'संकेतक' : 'निर्देशांक'}
                                    </th>
                                    <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6] w-28 text-right">
                                        {isEn ? 'Value' : isHi ? 'मान' : 'मूल्य'}
                                    </th>
                                    <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6] w-80 hidden sm:table-cell">
                                        {isEn ? 'Remarks' : isHi ? 'टिप्पणी' : 'शेरा'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-[12.5px]">
                                {([
                                    [txt.patientsToday, patients.length, txt.registeredInSystem, null],
                                    [txt.pendingReferrals, pendingRefs, txt.inTransit, '/referrals'],
                                    [txt.queueLength, waitingQueue, txt.avgWait, '/queue'],
                                    [txt.highRiskAlerts, highRiskPatients.length,
                                        `${redCount} ${isEn ? 'critical' : isHi ? 'गंभीर' : 'गंभीर'}`, '/followup'],
                                ] as Array<[string, number, string, string | null]>).map((row, i) => (
                                    <tr key={row[0]} className={`border-b border-[#E2E8F1] ${i % 2 === 1 ? 'bg-[#F6F8FB]' : 'bg-white'}`}>
                                        <td className="px-3 py-2 text-[#243449]">
                                            {row[3] ? (
                                                <Link href={row[3]} className="text-[#1F3A6E] hover:underline">{row[0]}</Link>
                                            ) : row[0]}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-[#1F3A6E] tabular-nums">{row[1]}</td>
                                        <td className="px-3 py-2 text-[11.5px] text-[#4A5A73] hidden sm:table-cell">{row[2]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </GovPanel>

                    {/* Row 2: Facility Hierarchy Tree (Left) & High-Risk Alerts (Right) */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Facility Hierarchy Tree (7 cols) */}
                        <div className="lg:col-span-7 bg-white p-5 rounded border border-slate-300 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-base font-bold text-[#1F3A6E]">
                                        {txt.treeTitle}
                                    </h2>
                                    <p className="text-xs text-txt-muted">
                                        {txt.treeSub}
                                    </p>
                                </div>
                                <span className="text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded text-xs font-semibold">
                                    {txt.nodesConnected}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1">
                                <FacilityTree facilities={facilities} currentFacilityId={session?.facilityId} language={language} />
                            </div>
                        </div>

                        {/* High-Risk Alerts & Action List (5 cols) */}
                        <div className="lg:col-span-5 bg-white p-5 rounded border border-slate-300 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-base font-bold text-[#1F3A6E]">
                                        {txt.actionListTitle}
                                    </h2>
                                    <span className="text-[11px] bg-red-50 text-red-800 border border-red-200 font-bold px-2 py-0.5 rounded">
                                        {txt.actionRequired}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {highRiskPatients.map((p) => (
                                        <div
                                            key={p.id}
                                            className="p-3 bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors space-y-1.5"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-bold text-xs text-[#1F3A6E]">{p.name}</span>
                                                    <span className="text-[10px] text-txt-muted ml-2">({p.age}y / {p.gender}) • {p.village}</span>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${p.triageStatus === 'RED' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
                                                    {p.triageStatus === 'RED' ? txt.priorityRed : txt.priorityYellow}
                                                </span>
                                            </div>

                                            {clinicalSummary(p) && (
                                                <p className="text-[11px] text-txt-secondary leading-snug line-clamp-2">
                                                    {clinicalSummary(p)}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px]">
                                                <span className="text-txt-muted">
                                                    BP: {p.vitals.bloodPressure?.systolic || 'N/A'}/{p.vitals.bloodPressure?.diastolic || 'N/A'} • SpO2: {p.vitals.spo2}%
                                                </span>
                                                <Link
                                                    href={`/record?id=${encodeURIComponent(p.id)}`}
                                                    className="font-bold text-[#1F3A6E] hover:underline flex items-center gap-1"
                                                >
                                                    <span>{txt.openRecord}</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Emergency Action Banner */}
                            <div className="mt-4 p-3 bg-slate-50 border border-slate-300 rounded flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-slate-900 block">{txt.dispatchTitle}</span>
                                    <span className="text-slate-600 text-[11px]">{txt.dispatchSub}</span>
                                </div>
                                <Link
                                    href="/referrals"
                                    className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded text-xs border border-red-800 shadow-none transition-colors"
                                >
                                    {txt.trackBtn}
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Quality of Public Healthcare Indicators (IPHS Benchmark) */}
                    <div className="bg-white p-5 rounded border border-slate-300 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-base font-bold text-[#1F3A6E]">
                                    {txt.iphsTitle}
                                </h2>
                                <p className="text-xs text-txt-muted">
                                    {txt.iphsSub}
                                </p>
                            </div>
                            <span className="text-xs text-txt-muted font-bold">{txt.quarterlyTarget}</span>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Referral Completion Rate */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-[#1F3A6E]">{txt.ind1Title}</span>
                                    <span className="text-amber-700">{decided.length === 0 ? txt.awaitingData : `${referralCompletionRate}%`}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div className="bg-[#B45309] h-full rounded" style={{ width: `${referralCompletionRate}%` }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">
                                    {completedRefs} of {decided.length} decided referrals reached the receiving facility ({referrals.length - decided.length} still open)
                                </span>
                            </div>

                            {/* Average Wait Time */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-[#1F3A6E]">{txt.ind2Title}</span>
                                    <span className="text-emerald-700">
                                        {waitSamples.length === 0 ? txt.awaitingData : `${avgWaitMinutes} mins (${waitTimeScore}%)`}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div className="bg-[#15803D] h-full rounded" style={{ width: `${waitTimeScore}%` }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">
                                    {waitSamples.length === 0
                                        ? txt.noCompletedConsults
                                        : `${waitSamples.length} consultations vs 30-min IPHS norm`}
                                </span>
                            </div>

                            {/* Essential Medicine Availability */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-[#1F3A6E]">{txt.ind3Title}</span>
                                    <span className="text-[#1F3A6E]">{essentialMeds.length === 0 ? txt.awaitingData : `${medicineAvailability}%`}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div className="bg-[#1F3A6E] h-full rounded" style={{ width: `${medicineAvailability}%` }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">
                                    {essentialMeds.filter(m => m.status === 'ADEQUATE').length} of {essentialMeds.length} IPHS drugs adequate
                                </span>
                            </div>

                            {/* Maternal ANC Follow-up Rate */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-[#1F3A6E]">{txt.ind4Title}</span>
                                    <span className="text-[#1F3A6E]">{maternalFlagged.length === 0 ? txt.awaitingData : `${maternalFollowUpRate}%`}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div className="bg-[#1F3A6E] h-full rounded" style={{ width: `${maternalFollowUpRate}%` }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">
                                    {maternalOnSchedule} of {maternalFlagged.length} ANC recalls on schedule
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Danger-Sign Cascade & Travel Burden Avoided */}
                    <div className="grid lg:grid-cols-2 gap-6">

                        {/* Mortality-prevention cascade telemetry */}
                        <div className="bg-white rounded border border-slate-300 shadow-sm">
                            <div className="gov-card-header flex items-center justify-between">
                                <span>{txt.cascadeTitle}</span>
                                {dangerSigns.awaitingEscalation > 0 && (
                                    <span className="badge-red">{txt.actionRequired}</span>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <p className="text-[11px] text-txt-muted leading-relaxed">
                                    {txt.cascadeSub}
                                </p>

                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.detected}</span>
                                        <strong className="text-2xl font-black text-[#1F3A6E]">{dangerSigns.dangerSignsDetected}</strong>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.escalated}</span>
                                        <strong className="text-2xl font-black text-[#B45309]">{dangerSigns.escalated}</strong>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.reachedCare}</span>
                                        <strong className="text-2xl font-black text-[#15803D]">{dangerSigns.reachedDefinitiveCare}</strong>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-[#1F3A6E]">{txt.escalationRate}</span>
                                        <span className="text-[#1F3A6E]">{dangerSigns.dangerSignsDetected === 0 ? txt.awaitingData : `${dangerSigns.escalationRate}%`}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                        <div className="bg-[#1F3A6E] h-full rounded" style={{ width: `${dangerSigns.escalationRate}%` }} />
                                    </div>
                                </div>

                                {/* The gap a DHO can still close today, stated plainly rather
                                    than absorbed into an aggregate success percentage. */}
                                <div className={`p-2.5 rounded border text-[11px] ${
                                    dangerSigns.awaitingEscalation > 0
                                        ? 'bg-gov-red-bg border-red-300 text-red-900'
                                        : 'bg-gov-success-bg border-emerald-300 text-emerald-900'
                                }`}>
                                    <strong>
                                        {dangerSigns.awaitingEscalation > 0
                                            ? `${dangerSigns.awaitingEscalation} ${txt.awaitingEscalation}`
                                            : txt.noBacklog}
                                    </strong>
                                    {dangerSigns.inTransit > 0 && (
                                        <span className="block mt-0.5">
                                            {dangerSigns.inTransit} {txt.stillInTransit}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Travel burden avoided */}
                        <div className="bg-white rounded border border-slate-300 shadow-sm">
                            <div className="gov-card-header">{txt.travelTitle}</div>
                            <div className="p-4 space-y-3">
                                <p className="text-[11px] text-txt-muted leading-relaxed">
                                    {txt.travelSub}
                                </p>

                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.episodes}</span>
                                        <strong className="text-2xl font-black text-[#1F3A6E]">{travel.episodesResolvedLocally}</strong>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.kmAvoided}</span>
                                        <strong className="text-2xl font-black text-[#15803D]">{Math.round(travel.kilometresAvoided)}</strong>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">{txt.hoursAvoided}</span>
                                        <strong className="text-2xl font-black text-[#15803D]">{travel.hoursAvoided.toFixed(1)}</strong>
                                    </div>
                                </div>

                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-txt-secondary">
                                    {travel.episodesResolvedLocally > 0
                                        ? `${txt.avgPerEpisode} ${travel.averageHoursPerEpisode.toFixed(1)} ${txt.hoursRoundTrip}`
                                        : txt.noLocalEpisodes}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Per-Facility IPHS Scorecards */}
                    <div className="bg-white rounded border border-slate-300 shadow-sm">
                        <div className="gov-card-header flex items-center justify-between">
                            <span>{txt.scorecardTitle}</span>
                            <span className="text-[10px] font-normal normal-case text-slate-600">{txt.scorecardSub}</span>
                        </div>

                        {/* Focusable, so a keyboard user can scroll the wide table too. */}
                        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={txt.scorecardTitle}>
                            <table className="gov-table">
                                <thead>
                                    <tr>
                                        <th>{txt.colFacility}</th>
                                        <th>{txt.colTier}</th>
                                        <th>{txt.colScore}</th>
                                        {scorecards[0]?.components.map(c => (
                                            <th key={c.label} className="hidden lg:table-cell">{c.label}</th>
                                        ))}
                                        <th>{txt.colGaps}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scorecards.map(s => (
                                        <tr key={s.facilityId}>
                                            <td className="font-semibold text-[#1F3A6E]">{s.facilityName}</td>
                                            <td className="font-mono">{s.type}</td>
                                            <td>
                                                <span className={
                                                    s.grade === 'A' ? 'badge-green'
                                                        : s.grade === 'B' ? 'badge-blue'
                                                        : s.grade === 'C' ? 'badge-amber'
                                                        : 'badge-red'
                                                }>
                                                    {s.grade} · {s.score}
                                                </span>
                                            </td>
                                            {s.components.map(c => (
                                                <td key={c.label} className="hidden lg:table-cell">
                                                    <span className={
                                                        c.score >= 85 ? 'text-emerald-800 font-bold'
                                                            : c.score >= 55 ? 'text-amber-800 font-bold'
                                                            : 'text-red-800 font-bold'
                                                    }>
                                                        {c.score}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-600">{c.detail}</span>
                                                </td>
                                            ))}
                                            <td className="text-[11px]">
                                                {s.gaps.length === 0
                                                    ? <span className="text-emerald-800 font-semibold">{txt.meetsNorms}</span>
                                                    : <span className="text-red-800">{s.gaps[0]}</span>}
                                                {s.gaps.length > 1 && (
                                                    <span className="block text-[10px] text-slate-600">
                                                        +{s.gaps.length - 1} {txt.moreGaps}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </>)}

                </div>
            </div>
        </PortalShell>
    );
}
