/**
 * Multilingual Dictionaries for Maharashtra Rural Public Healthcare
 * Standard: Government of Maharashtra • Public Health Department • NHM
 * Languages Supported: Marathi (mr), Hindi (hi), English (en)
 */

import { Language } from '@/stores/languageStore';

export const DICTIONARY = {
    mr: {
        appTitle: 'नलममेश',
        appSubtitle: 'ग्रामीण सार्वजनिक आरोग्य सेवा एकात्मिक मंच — महाराष्ट्र शासन',
        govtHeader: 'सार्वजनिक आरोग्य विभाग • महाराष्ट्र शासन | राष्ट्रीय आरोग्य अभियान (NHM)',

        // Navigation
        navHome: 'मुख्य पोर्टल',
        navOpd: 'ओपीडी व डिजिटल ट्राइएज',
        navDashboard: 'जिल्हा आरोग्य कमांड केंद्र',
        navFollowup: 'उच्च जोखीम फॉलो-अप (ANC/बालक/NCD)',
        navDiagnostics: 'निदान व लॅब समन्वय',
        navMedicine: 'अत्यावश्यक औषध साठा',
        navReferrals: 'संदर्भ सेवा (रेफरल ट्रॅकर १०८/१०२)',
        navQueue: 'रांग व टोकन व्यवस्थापन',
        navTeleconsult: 'टेलिकन्सल्टेशन (ई-संजीवनी)',
        navFacilities: 'आरोग्य सुविधा निर्देशिका (४-स्तर)',
        navEmergency: 'आपत्कालीन SOS (१०८/१०२)',
        navMesh: 'ऑफलाइन मेश रिले',

        // Triage Priorities
        critical: 'अति गंभीर (CRITICAL)',
        urgent: 'तातडीचे (URGENT)',
        stable: 'स्थिर (STABLE)',
        emergency: 'आपत्कालीन (EMERGENCY)',

        // Action Buttons
        runAnalysis: 'ट्राइएज विश्लेषण करा',
        generateToken: 'ओपीडी टोकन तयार करा',
        initiateReferral: 'रेफरल सुरू करा',
        startTeleconsult: 'तज्ज्ञ डॉक्टरांशी संपर्क जोडा',
        callNextPatient: 'पुढील रुग्णास बोलवा',
        priorityOverride: 'प्राधान्य बदला',
        restockMedicine: 'औषध पुन्हा मागवा',
        exportFHIR: 'ABDM / FHIR R4 निर्यात करा',
        printWristband: 'QR रिस्टबँड प्रिंट करा',
        demoMode: 'डेमो प्रवाह सुरू करा',
        stopDemo: 'डेमो थांबवा',
        systemOnline: 'प्रणाली ऑनलाइन',
        offlineActive: 'ऑफलाइन मेश कार्यरत',
        sendSMS: 'एसएमएस स्मरणपत्र पाठवा',
        viewLHR: 'आरोग्य नोंद (LHR) पहा',

        // Vitals & Clinical
        spo2Label: 'ऑक्सिजन पातळी (SpO2 %)',
        pulseLabel: 'नाडीचे ठोके (Pulse BPM)',
        bpLabel: 'रक्तदाब (BP mmHg)',
        tempLabel: 'तापमान (°F)',
        glucoseLabel: 'रक्तातील साखर (Glucose mg/dL)',
        rrLabel: 'श्वसन दर (Resp Rate /min)',
        consciousnessLabel: 'शुद्धीची स्थिती (AVPU)',
        notesLabel: 'लक्षणे व नोंदी (Voice / Type)',
        maternalFlag: 'गरोदर माता / ANC जोखीम',
        childFlag: 'बालक जोखीम (< ५ वर्षे)',

        // District Stats
        patientsToday: 'आजचे एकूण रुग्ण',
        pendingReferrals: 'प्रलंबित संदर्भ सेवा (रेफरल)',
        activeQueue: 'सध्याची ओपीडी रांग',
        highRiskAlerts: 'उच्च जोखीम सूचना',
        facilityHierarchy: 'महाराष्ट्र आरोग्य सातत्य नेटवर्क',

        // Common Labels
        searchPlaceholder: 'रुग्ण, औषधे किंवा लॅब चाचण्या शोधा...',
        filterAll: 'सर्व',
        statusWaiting: 'प्रतीक्षेत',
        statusInProgress: 'उपचार सुरू',
        statusCompleted: 'पूर्ण झाले',
        statusInTransit: 'मार्गावर',
    },

    hi: {
        appTitle: 'नलममेश',
        appSubtitle: 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — महाराष्ट्र सरकार',
        govtHeader: 'लोक स्वास्थ्य विभाग • महाराष्ट्र सरकार | राष्ट्रीय स्वास्थ्य मिशन (NHM)',

        // Navigation
        navHome: 'मुख्य पोर्टल',
        navOpd: 'ओपीडी व डिजिटल ट्राइएज',
        navDashboard: 'जिला स्वास्थ्य कमांड सेंटर',
        navFollowup: 'उच्च जोखिम फॉलो-अप (ANC/शिशु/NCD)',
        navDiagnostics: 'निदान व लैब समन्वय',
        navMedicine: 'आवश्यक दवा स्टॉक',
        navReferrals: 'रेफरल पाइपलाइन (१०८/१०२)',
        navQueue: 'ओपीडी कतार व टोकन इंजन',
        navTeleconsult: 'टेलीकंसल्टेशन (ई-संजीवनी)',
        navFacilities: 'स्वास्थ्य केंद्र निर्देशिका (४-स्तरीय)',
        navEmergency: 'आपातकालीन सहायता SOS',
        navMesh: 'ऑफलाइन मेश सिंक',

        // Triage Priorities
        critical: 'अति गंभीर (CRITICAL)',
        urgent: 'त्वरित (URGENT)',
        stable: 'स्थिर (STABLE)',
        emergency: 'आपातकालीन (EMERGENCY)',

        // Action Buttons
        runAnalysis: 'ट्राइएज विश्लेषण चलाएं',
        generateToken: 'ओपीडी टोकन बनाएं',
        initiateReferral: 'रेफरल शुरू करें',
        startTeleconsult: 'विशेषज्ञ डॉक्टर से जोड़ें',
        callNextPatient: 'अगले मरीज को बुलाएं',
        priorityOverride: 'प्राथमिकता बदलें',
        restockMedicine: 'दवा पुनः मंगाएं',
        exportFHIR: 'ABDM / FHIR R4 निर्यात करें',
        printWristband: 'QR रिस्टबैंड प्रिंट करें',
        demoMode: 'डेमो मोड शुरू करें',
        stopDemo: 'डेमो रोकें',
        systemOnline: 'सिस्टम ऑनलाइन',
        offlineActive: 'ऑफलाइन मेश सक्रिय',
        sendSMS: 'एसएमएस अलर्ट भेजें',
        viewLHR: 'डिजिटल हेल्थ रिकॉर्ड (LHR) देखें',

        // Vitals & Clinical
        spo2Label: 'ऑक्सीजन स्तर (SpO2 %)',
        pulseLabel: 'हार्ट रेट (Pulse BPM)',
        bpLabel: 'रक्तचाप (BP mmHg)',
        tempLabel: 'तापमान (°F)',
        glucoseLabel: 'ब्लड शुगर (Glucose mg/dL)',
        rrLabel: 'श्वसन दर (Resp Rate /min)',
        consciousnessLabel: 'चेतना स्तर (AVPU)',
        notesLabel: 'लक्षण व टिप्पणियां (Voice / Type)',
        maternalFlag: 'गर्भवती माता / ANC जोखिम',
        childFlag: 'शिशु जोखिम (< ५ वर्ष)',

        // District Stats
        patientsToday: 'आज के कुल मरीज',
        pendingReferrals: 'लंबित रेफरल',
        activeQueue: 'सक्रिय ओपीडी कतार',
        highRiskAlerts: 'उच्च जोखिम अलर्ट',
        facilityHierarchy: 'महाराष्ट्र स्वास्थ्य अवसंरचना नेटवर्क',

        // Common Labels
        searchPlaceholder: 'मरीज, दवाएं या लैब टेस्ट खोजें...',
        filterAll: 'सभी',
        statusWaiting: 'प्रतीक्षारत',
        statusInProgress: 'जांच जारी',
        statusCompleted: 'संपन्न',
        statusInTransit: 'मार्ग में',
    },

    en: {
        appTitle: 'NalamMesh',
        appSubtitle: 'Integrated Rural Healthcare Access & Quality Platform — Govt of Maharashtra',
        govtHeader: 'Public Health Department • Government of Maharashtra | National Health Mission (NHM)',

        // Navigation
        navHome: 'Executive Portal',
        navOpd: 'OPD & Digital Triage',
        navDashboard: 'District Health Command',
        navFollowup: 'High-Risk Follow-Up & Recall',
        navDiagnostics: 'Diagnostic Coordination',
        navMedicine: 'Essential Medicine Inventory',
        navReferrals: 'Emergency Referral Pipeline (108/102)',
        navQueue: 'OPD Queue & Token Engine',
        navTeleconsult: 'Assisted Teleconsultation',
        navFacilities: '4-Tier Facility Directory',
        navEmergency: 'Emergency Escalation (SOS)',
        navMesh: 'Offline Mesh Sync',

        // Triage Priorities
        critical: 'CRITICAL',
        urgent: 'URGENT',
        stable: 'STABLE',
        emergency: 'EMERGENCY',

        // Action Buttons
        runAnalysis: 'Run AI Triage Analysis',
        generateToken: 'Generate OPD Token',
        initiateReferral: 'Initiate Referral',
        startTeleconsult: 'Connect Specialist',
        callNextPatient: 'Call Next Patient',
        priorityOverride: 'Override Priority',
        restockMedicine: 'Request Drug Restock',
        exportFHIR: 'Export FHIR R4 Bundle',
        printWristband: 'Print QR Wristband',
        demoMode: 'Simulate Rural Data Stream',
        stopDemo: 'Halt Simulation',
        systemOnline: 'Broadband Connected',
        offlineActive: 'Operating Offline (Mesh Active)',
        sendSMS: 'Send Localized SMS',
        viewLHR: 'View Longitudinal Health Record',

        // Vitals & Clinical
        spo2Label: 'Oxygen Saturation (SpO2 %)',
        pulseLabel: 'Pulse Rate (BPM)',
        bpLabel: 'Blood Pressure (mmHg)',
        tempLabel: 'Temperature (°F)',
        glucoseLabel: 'Random Blood Sugar (mg/dL)',
        rrLabel: 'Respiratory Rate (/min)',
        consciousnessLabel: 'Consciousness (AVPU)',
        notesLabel: 'Symptoms & History (Voice / Type)',
        maternalFlag: 'Maternal Health / ANC Case',
        childFlag: 'Pediatric Case (< 5 years)',

        // District Stats
        patientsToday: 'Total Patients Registered',
        pendingReferrals: 'Pending Emergency Transfers',
        activeQueue: 'Active OPD Waiting Queue',
        highRiskAlerts: 'High-Risk Alerts (Active Cohort)',
        facilityHierarchy: 'Maharashtra 4-Tier Health Network',

        // Common Labels
        searchPlaceholder: 'Search patients, referrals, medicines...',
        filterAll: 'All',
        statusWaiting: 'Waiting',
        statusInProgress: 'In Consultation',
        statusCompleted: 'Completed',
        statusInTransit: 'In Transit',
    },
};

export function t(key: keyof typeof DICTIONARY['en'], lang: Language = 'mr'): string {
    const dict = (DICTIONARY as Record<string, any>)[lang] || DICTIONARY.mr || DICTIONARY.en;
    return dict[key] || DICTIONARY.mr[key] || DICTIONARY.en[key] || key;
}
