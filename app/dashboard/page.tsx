/**
 * District & Facility Health Dashboard — NalamMesh
 * Administrative View for District Health Officer (DHO) & Medical Superintendents
 * Gadchiroli District, Maharashtra (SIH PS#26133)
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
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

export default function DashboardPage() {
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

    const pendingRefs = referrals.filter(r => r.status === 'INITIATED' || r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT').length;
    const inTransitCount = referrals.filter(r => r.status === 'IN_TRANSIT').length;
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
    const completedRefs = referrals.filter(r => r.status === 'COMPLETED').length;
    const referralCompletionRate = referrals.length === 0
        ? 0
        : Math.round((completedRefs / referrals.length) * 100);

    // Measured from the clock, not from the estimate shown to the patient at check-in:
    // `estimatedWaitMinutes` is a forecast and is zeroed once a token is called, so
    // averaging it over completed tokens reports 0 minutes for a queue that really waited.
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
        title: isEn ? 'District Health Command — Gadchiroli' : isHi ? 'जिला स्वास्थ्य कमांड केंद्र — गढ़चिरौली' : 'जिल्हा आरोग्य कमांड केंद्र — गडचिरोली',
        subTitle: isEn
            ? 'Real-time monitoring across Sub-Centres, PHCs, CHCs, and District Hospital'
            : isHi
            ? 'उप-केंद्र, प्राथमिक स्वास्थ्य केंद्र (PHC), सामुदायिक स्वास्थ्य केंद्र (CHC) और जिला अस्पताल की वास्तविक समय निगरानी'
            : 'उप-केंद्रे, प्राथमिक आरोग्य केंद्रे (PHC), ग्रामीण रुग्णालये (CHC) आणि जिल्हा रुग्णालयाचे थेट निरीक्षण',
        meshOnline: isEn ? 'Mesh Relay Online' : isHi ? 'मेश रिले ऑनलाइन' : 'मेश रिले ऑनलाइन',
        meshStandalone: isEn ? 'Mesh Relay Standalone' : isHi ? 'मेश रिले स्वतंत्र' : 'मेश रिले स्वतंत्र',
        meshConnecting: isEn ? 'Mesh Relay Connecting' : isHi ? 'मेश रिले जुड़ रहा है' : 'मेश रिले जोडत आहे',

        // Metrics
        patientsToday: isEn ? 'Patients in System' : isHi ? 'सिस्टम में कुल मरीज' : 'प्रणालीतील एकूण रुग्ण',
        registeredInSystem: isEn ? 'live registered count' : isHi ? 'लाइव पंजीकृत संख्या' : 'थेट नोंदणीकृत संख्या',
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
        treeTitle: isEn ? 'Maharashtra Health Continuum Tree' : isHi ? 'महाराष्ट्र स्वास्थ्य निरंतरता नेटवर्क' : 'महाराष्ट्र आरोग्य सातत्य वृक्ष (Continuum)',
        treeSub: isEn ? 'District Hospital → Sub-District → CHC → PHC → Sub-Centres' : isHi ? 'जिला अस्पताल → उप-जिला अस्पताल → CHC → PHC → उप-केंद्र' : 'जिल्हा रुग्णालय → उपजिल्हा रुग्णालय → CHC → PHC → उप-केंद्रे',
        nodesConnected: isEn ? '7 Nodes Connected' : isHi ? '७ स्वास्थ्य केंद्र सक्रिय' : '७ आरोग्य केंद्रे जोडलेली',
        
        apexHospital: isEn ? 'APEX FACILITY — DISTRICT HOSPITAL (DH)' : isHi ? 'शीर्ष रेफरल अस्पताल — जिला अस्पताल (DH)' : 'सर्वोच्च संदर्भ रुग्णालय — जिल्हा रुग्णालय (DH)',
        dhName: isEn ? 'District Hospital, Gadchiroli' : isHi ? 'जिला अस्पताल, गढ़चिरौली' : 'जिल्हा रुग्णालय, गडचिरोली',
        dhBeds: isEn ? 'Beds: 235/300 Occupied • ICU: 16/20 • Specialists: 24' : isHi ? 'बिस्तर: २३५/३०० • ICU: १६/२० • विशेषज्ञ डॉक्टर: २४' : 'खाटा: २३५/३०० • ICU: १६/२० • तज्ज्ञ डॉक्टर: २४',
        online247: isEn ? 'Online 24x7' : isHi ? '२४x७ सक्रिय' : '२४ तास सेवारत',

        fruUnit: isEn ? 'FIRST REFERRAL UNIT • SDH (AHERI)' : isHi ? 'प्रथम संदर्भ सेवा केंद्र (FRU) • SDH (अहेरी)' : 'प्रथम संदर्भ सेवा केंद्र (FRU) • SDH (अहेरी)',
        sdhName: isEn ? 'Sub-District Hospital, Aheri' : isHi ? 'उप-जिला अस्पताल, अहेरी' : 'उपजिल्हा रुग्णालय, अहेरी',
        sdhAmbulances: isEn ? '5 Ambulances' : isHi ? '५ एम्बुलेंस' : '५ रुग्णवाहिका',
        sdhBeds: isEn ? 'Beds: 74/100 • Emergency Obstetric Care (CEmONC) • Blood Unit' : isHi ? 'बिस्तर: ७४/१०० • आपातकालीन प्रसूति सेवा (CEmONC) • ब्लड बैंक' : 'खाटा: ७४/१०० • तातडीची प्रसूती सेवा (CEmONC) • रक्तपेढी',

        chcUnit: isEn ? 'COMMUNITY HEALTH CENTRE (CHC)' : isHi ? 'सामुदायिक स्वास्थ्य केंद्र (CHC)' : 'सामुदायिक आरोग्य केंद्र (CHC)',
        chcName: isEn ? 'CHC Etapalli' : isHi ? 'सामुदायिक स्वास्थ्य केंद्र, एटापल्ली' : 'ग्रामीण रुग्णालय (CHC), एटापल्ली',
        chcBeds: isEn ? 'Beds: 21/30 • 24x7 Delivery Care • Teleconsult Node' : isHi ? 'बिस्तर: २१/३० • २४x७ प्रसव कक्ष • ई-संजीवनी केंद्र' : 'खाटा: २१/३० • २४x७ प्रसूती कक्ष • ई-संजीवनी केंद्र',

        phcBhamragad: isEn ? 'PHC Bhamragad' : isHi ? 'प्राथमिक स्वास्थ्य केंद्र, भामरागढ़' : 'प्राथमिक आरोग्य केंद्र, भामरागड',
        phcBeds: isEn ? 'Beds: 6/10 • 2 Doctors • Solar Mesh Active' : isHi ? 'बिस्तर: ६/१० • २ डॉक्टर • सोलर मेश सक्रिय' : 'खाटा: ६/१० • २ डॉक्टर • सौर मेश प्रणाली',
        stationActive: isEn ? 'Station Active' : isHi ? 'वर्तमान स्टेशन' : 'सध्याचे केंद्र',

        scKothi: isEn ? 'Sub-Centre Kothi (CHO + ASHA)' : isHi ? 'आरोग्य मंदिर उप-केंद्र कोठी (CHO + ASHA)' : 'आरोग्य वर्धिनी उपकेंद्र कोठी (CHO + ASHA)',
        scGovindpur: isEn ? 'Sub-Centre Govindpur (ANM)' : isHi ? 'उप-केंद्र गोविंदपुर (ANM)' : 'उपकेंद्र गोविंदपूर (ANM)',
        phcPerimili: isEn ? 'PHC Perimili' : isHi ? 'प्रा. स्वा. केंद्र पेरिमिली' : 'प्रा. आ. केंद्र पेरीमिली',
        perimiliBeds: isEn ? 'Beds: 3/6' : isHi ? 'बिस्तर: ३/६' : 'खाटा: ३/६',

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
        dispatchSub: isEn ? '2 ambulances active in Etapalli-Bhamragad corridor' : isHi ? 'एटापल्ली-भामरागढ़ मार्ग पर २ एम्बुलेंस सक्रिय' : 'एटापल्ली-भामरागड मार्गावर २ रुग्णवाहिका सक्रिय',
        trackBtn: isEn ? 'Track' : isHi ? 'ट्रैक करें' : 'ट्रॅक करा',

        // IPHS Quality Indicators
        iphsTitle: isEn ? 'Indian Public Health Standards (IPHS) Quality Indicators' : isHi ? 'भारतीय सार्वजनिक स्वास्थ्य मानक (IPHS) गुणवत्ता सूचकांक' : 'भारतीय सार्वजनिक आरोग्य मानक (IPHS) गुणवत्ता निर्देशांक',
        iphsSub: isEn ? 'Quality, continuity, and accountability benchmarks for Gadchiroli rural district' : isHi ? 'गढ़चिरौली ग्रामीण व आदिवासी क्षेत्र हेतु गुणवत्ता व सेवा निरंतरता मानक' : 'गडचिरोली ग्रामीण व आदिवासी भागासाठी गुणवत्ता व सेवा निरंतरता मापदंड',
        quarterlyTarget: isEn ? 'Quarterly Target: 85%+' : isHi ? 'त्रैमासिक लक्ष्य: ८५%+' : 'त्रैमासिक उद्दिष्ट: ८५%+',

        ind1Title: isEn ? 'Referral Completion Rate' : isHi ? 'रेफरल पूर्णता दर' : 'रेफरल पूर्णता दर',
        
        ind2Title: isEn ? 'Avg. OPD Wait Time' : isHi ? 'औसत ओपीडी प्रतीक्षा समय' : 'सरासरी ओपीडी प्रतीक्षा वेळ',
        
        ind3Title: isEn ? 'IPHS Drug Stock Level' : isHi ? 'IPHS आवश्यक दवा स्टॉक स्तर' : 'IPHS अत्यावश्यक औषध साठा',

        ind4Title: isEn ? 'High-Risk ANC Adherence' : isHi ? 'उच्च जोखिम ANC गृह भेंट अनुपालन' : 'उच्च जोखीम माता ANC तपासणी',
    };

    // Localized patient illness descriptions
    const getPatientCondition = (name: string, defaultDesc: string) => {
        if (name.includes('Sunita')) {
            return isEn
                ? 'High-risk Antenatal: Severe gestational hypertension with severe frontal headache and visual blurring'
                : isHi
                ? 'उच्च जोखिम गर्भावस्था: गंभीर उच्च रक्तचाप, सिरदर्द व धुंधली दृष्टि (CEmONC रेफरल)'
                : 'उच्च जोखीम गरोदरपण: तीव्र रक्तदाब, डोकेदुखी व अंधुक दृष्टी (CEmONC रेफरल)';
        }
        if (name.includes('Ramesh')) {
            return isEn
                ? 'Uncontrolled Type-2 Diabetes with non-healing ulcer on right plantar foot (grade 2) for 3 weeks'
                : isHi
                ? 'अनियंत्रित टाइप-२ मधुमेह: पैर के तलवे पर ३ सप्ताह पुराना अल्सर (ग्रेड २ जांच)'
                : 'अनियंत्रित मधुमेह (Type-2): उजव्या पायावर ३ आठवड्यांपासून बरी न होणारी जखम (Grade 2)';
        }
        if (name.includes('Aarav')) {
            return isEn
                ? 'Severe Acute Malnutrition (SAM) with fast breathing & high fever (Pneumonia suspect)'
                : isHi
                ? 'गंभीर तीव्र कुपोषण (SAM): तेज सांस चलना व तेज बुखार (निमोनिया संशय NRC रेफरल)'
                : 'तीव्र कुपोषण (SAM): धाप लागणे, जलद श्वसन व तीव्र ताप (न्यूमोनिया संशय NRC रेफरल)';
        }
        if (name.includes('Meshram')) {
            return isEn
                ? 'Pulmonary Tuberculosis Month-3 Follow up: Chronic cough reduced, sputum check needed'
                : isHi
                ? 'फेफड़ों का टीबी (TB) माह-३ फॉलो-अप: खांसी कम, बलगम जांच आवश्यक'
                : 'फुफ्फुसाचा क्षयरोग (TB) महिना-३ फॉलो-अप: खोकला कमी, थुंकी तपासणी आवश्यक';
        }
        return defaultDesc;
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />

                <div className="max-w-6xl mx-auto space-y-6">

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
                            <DemoModeToggle />
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

                    {/* Row 1: Key Performance Metrics — Sober Government Administrative KPI Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Total Census */}
                        <div className="bg-white p-4 rounded border border-slate-300 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                                    {txt.patientsToday}
                                </span>
                                <div className="text-3xl font-black text-[#1F3A6E] mt-1">
                                    {patients.length}
                                </div>
                            </div>
                            <div className="text-xs text-slate-600 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">{txt.registeredInSystem}</span>
                            </div>
                        </div>

                        {/* 2. Pending Referrals */}
                        <div className="bg-white p-4 rounded border border-slate-300 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                                    {txt.pendingReferrals}
                                </span>
                                <div className="text-3xl font-black text-[#B45309] mt-1">
                                    {pendingRefs}
                                </div>
                            </div>
                            <div className="text-xs text-slate-600 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-amber-800 font-semibold">{txt.inTransit}</span>
                                <Link href="/referrals" className="underline text-[#1F3A6E] font-bold text-xs">{txt.viewLink}</Link>
                            </div>
                        </div>

                        {/* 3. Live OPD Queue */}
                        <div className="bg-white p-4 rounded border border-slate-300 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                                    {txt.queueLength}
                                </span>
                                <div className="text-3xl font-black text-[#1F3A6E] mt-1">
                                    {waitingQueue}
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                                {txt.avgWait}
                            </div>
                        </div>

                        {/* 4. High-Risk Maternal & NCD */}
                        <div className="bg-white p-4 rounded border border-slate-300 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                                    {txt.highRiskAlerts}
                                </span>
                                <div className="text-3xl font-black text-[#DC2626] mt-1">
                                    {highRiskPatients.length}
                                </div>
                            </div>
                            <div className="text-xs text-slate-600 mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {redCount} Critical
                                </span>
                                <span className="text-slate-500 text-[11px]">Overdue Follow-ups</span>
                            </div>
                        </div>
                    </div>

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

                            {/* Visual Hierarchy Nodes */}
                            <div className="space-y-3 flex-1 overflow-y-auto pr-1">

                                {/* Level 1: District Hospital */}
                                <div className="p-3.5 bg-[#1F3A6E] text-white rounded border border-[#11223F]">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-[9.5px] uppercase tracking-wider text-amber-400 font-bold block">
                                                {txt.apexHospital}
                                            </span>
                                            <h3 className="font-extrabold text-sm">{txt.dhName}</h3>
                                            <span className="text-[10px] text-slate-300">
                                                {txt.dhBeds}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                                            {txt.online247}
                                        </span>
                                    </div>
                                </div>

                                {/* Level 2: Sub-District Hospital */}
                                <div className="pl-4 border-l-2 border-slate-300 space-y-3">
                                    <div className="p-3 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[9.5px] uppercase tracking-wider text-teal-800 font-bold block">
                                                    {txt.fruUnit}
                                                </span>
                                                <h3 className="font-bold text-xs text-[#1F3A6E]">{txt.sdhName}</h3>
                                                <span className="text-[10px] text-txt-muted">
                                                    {txt.sdhBeds}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-white text-emerald-800 px-2 py-0.5 rounded border">
                                                {txt.sdhAmbulances}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Level 3: CHC */}
                                    <div className="pl-4 border-l-2 border-slate-300 space-y-3">
                                        <div className="p-3 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[9px] uppercase tracking-wider text-txt-muted font-bold block">
                                                        {txt.chcUnit}
                                                    </span>
                                                    <h3 className="font-bold text-xs text-[#1F3A6E]">{txt.chcName}</h3>
                                                    <span className="text-[10px] text-txt-muted">
                                                        {txt.chcBeds}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                    {isEn ? 'Online' : isHi ? 'सक्रिय' : 'सक्रिय'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Level 4: PHCs */}
                                        <div className="pl-4 border-l-2 border-slate-300 space-y-2">
                                            <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[9px] bg-[#1F3A6E] text-white px-1.5 py-0.5 rounded font-bold">PHC</span>
                                                        <span className="font-bold text-xs text-[#1F3A6E] ml-1.5">{txt.phcBhamragad}</span>
                                                        <span className="text-[10px] text-txt-muted ml-2">({txt.phcBeds})</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-[#1F3A6E]">{txt.stationActive}</span>
                                                </div>

                                                {/* Level 5: Sub-Centres / Arogya Mandir */}
                                                <div className="mt-2 pl-3 pt-2 border-t border-slate-200 flex gap-2 flex-wrap text-[10px]">
                                                    <span className="bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700 font-medium flex items-center gap-1">
                                                        <svg className="w-3 h-3 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                        <span>{txt.scKothi}</span>
                                                    </span>
                                                    <span className="bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700 font-medium flex items-center gap-1">
                                                        <svg className="w-3 h-3 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                        <span>{txt.scGovindpur}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-2.5 bg-gray-50 border border-border-subtle rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">PHC</span>
                                                        <span className="font-bold text-xs text-[#1F3A6E] ml-1.5">{txt.phcPerimili}</span>
                                                    </div>
                                                    <span className="text-[10px] text-txt-muted">{txt.perimiliBeds}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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

                                            <p className="text-[11px] text-txt-secondary leading-snug line-clamp-2">
                                                {getPatientCondition(p.name, p.vitals.injuryType || '')}
                                            </p>

                                            <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px]">
                                                <span className="text-txt-muted">
                                                    BP: {p.vitals.bloodPressure?.systolic || 'N/A'}/{p.vitals.bloodPressure?.diastolic || 'N/A'} • SpO2: {p.vitals.spo2}%
                                                </span>
                                                <Link
                                                    href={`/opd`}
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
                                    <span className="text-amber-700">{referralCompletionRate}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
                                    <div className="bg-[#B45309] h-full rounded" style={{ width: `${referralCompletionRate}%` }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">
                                    {completedRefs} of {referrals.length} referrals closed
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
                                    <span className="text-[#1F3A6E]">{medicineAvailability}%</span>
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
                                    <span className="text-[#1F3A6E]">{maternalFollowUpRate}%</span>
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
                                        <span className="text-[#1F3A6E]">{dangerSigns.escalationRate}%</span>
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
                            <span className="text-[10px] font-normal normal-case text-slate-500">{txt.scorecardSub}</span>
                        </div>

                        <div className="overflow-x-auto">
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
                                                    <span className="block text-[10px] text-slate-500">{c.detail}</span>
                                                </td>
                                            ))}
                                            <td className="text-[11px]">
                                                {s.gaps.length === 0
                                                    ? <span className="text-emerald-800 font-semibold">{txt.meetsNorms}</span>
                                                    : <span className="text-red-800">{s.gaps[0]}</span>}
                                                {s.gaps.length > 1 && (
                                                    <span className="block text-[10px] text-slate-500">
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

                </div>
            </main>
        </div>
    );
}
