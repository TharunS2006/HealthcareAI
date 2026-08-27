/**
 * Multilingual Dictionaries for Maharashtra Rural Public Healthcare (SIH PS#26133)
 * Supports English (en), Marathi (mr - मराठी), and Hindi (hi - हिन्दी)
 */

import { Language } from '@/stores/languageStore';

export const DICTIONARY = {
    mr: {
        appTitle: 'नलममेश (NalamMesh)',
        appSubtitle: 'ग्रामीण सार्वजनिक आरोग्य सेवा एकात्मिक मंच — महाराष्ट्र शासन',
        sihHeader: 'SIH 2025 | समस्या क्रमांक #26133 | कौशल्य, रोजगार व नाविन्यता विभाग',

        // Navigation
        navHome: 'मुख्य पृष्ठ',
        navOpd: 'ओपीडी व डिजिटल ट्राइएज',
        navDashboard: 'जिल्हा आरोग्य डॅशबोर्ड',
        navReferrals: 'संदर्भ सेवा (रेफरल ट्रॅकर)',
        navQueue: 'रांग व टोकन व्यवस्थापन',
        navTeleconsult: 'टेलिकन्सल्टेशन (ई-संजीवनी)',
        navMedicine: 'औषध व निदान समन्वय',
        navMesh: 'ऑफलाइन मेश नेटवर्क',

        // Triage Priorities
        critical: 'अति तातडीचे (CRITICAL)',
        urgent: 'तातडीचे (URGENT)',
        stable: 'स्थिर (STABLE)',
        emergency: 'आपत्कालीन (EMERGENCY)',

        // Action Buttons
        runAnalysis: 'एआय ट्राइएज विश्लेषण करा',
        generateToken: 'ओपीडी टोकन तयार करा',
        initiateReferral: 'रेफरल सुरू करा',
        startTeleconsult: 'तज्ज्ञ डॉक्टरांशी संपर्क',
        callNextPatient: 'पुढील रुग्ण बोलवा',
        priorityOverride: 'तातडीचे प्राधान्य द्या',
        restockMedicine: 'औषध साठा नोंदवा',
        exportFHIR: 'ABDM / FHIR R4 डाउनलोड',
        printWristband: 'QR रिस्टबँड प्रिंट',
        demoMode: 'महाराष्ट्र डेमो डेटा लोड करा',
        stopDemo: 'डेमो रीसेट',
        systemOnline: 'सर्व आरोग्य यंत्रणा सुरू',
        offlineActive: 'ऑफलाइन मोड सक्रिय',

        // Vitals & Clinical
        spo2Label: 'ऑक्सिजन पातळी (SpO2 %)',
        pulseLabel: 'नाडीचे ठोके (Pulse BPM)',
        bpLabel: 'रक्तदाब (BP mmHg)',
        tempLabel: 'तापमान (Temp °F)',
        glucoseLabel: 'रक्तातील साखर (Glucose mg/dL)',
        rrLabel: 'श्वसन दर (Resp Rate /min)',
        consciousnessLabel: 'जागृती पातळी (AVPU)',
        notesLabel: 'तक्रार व लक्षणे (Voice / Type)',
        maternalFlag: 'गर्भवती / ANC माता',
        childFlag: 'लहान मूल (< ५ वर्षे)',

        // District Stats
        patientsToday: 'आजचे एकूण रुग्ण',
        pendingReferrals: 'प्रलंबित रेफरल्स',
        activeQueue: 'सध्याची रांग',
        highRiskAlerts: 'उच्च जोखीम रुग्ण फॉलो-अप',
        facilityHierarchy: 'महाराष्ट्र आरोग्य सुविधा साखळी',
    },

    en: {
        appTitle: 'NalamMesh',
        appSubtitle: 'Integrated Rural Healthcare Access Platform — Govt of Maharashtra',
        sihHeader: 'SIH 2025 | Problem Statement #26133 | Dept of Skills, Employment & Innovation',

        // Navigation
        navHome: 'Role Hub',
        navOpd: 'OPD & Digital Triage',
        navDashboard: 'District Dashboard',
        navReferrals: 'Referral Pipeline',
        navQueue: 'Queue & Token Engine',
        navTeleconsult: 'Teleconsultation',
        navMedicine: 'Medicine & Diagnostics',
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
        priorityOverride: 'Priority Override',
        restockMedicine: 'Restock Medicines',
        exportFHIR: 'Export ABDM / FHIR R4',
        printWristband: 'Print QR Wristband',
        demoMode: 'Load Maharashtra Demo',
        stopDemo: 'Reset Demo Data',
        systemOnline: 'All Facilities Online',
        offlineActive: 'Offline Mesh Active',

        // Vitals & Clinical
        spo2Label: 'Oxygen Saturation (SpO2 %)',
        pulseLabel: 'Pulse Rate (BPM)',
        bpLabel: 'Blood Pressure (mmHg)',
        tempLabel: 'Temperature (°F)',
        glucoseLabel: 'Blood Glucose (mg/dL)',
        rrLabel: 'Respiratory Rate (/min)',
        consciousnessLabel: 'Consciousness (AVPU)',
        notesLabel: 'Chief Complaint / Symptoms',
        maternalFlag: 'High-Risk Maternal (ANC)',
        childFlag: 'Child (< 5 Years)',

        // District Stats
        patientsToday: 'Patients Today',
        pendingReferrals: 'Pending Referrals',
        activeQueue: 'Queue Length',
        highRiskAlerts: 'High-Risk Follow-ups Due',
        facilityHierarchy: 'Maharashtra Facility Hierarchy',
    },

    hi: {
        appTitle: 'नलममेश (NalamMesh)',
        appSubtitle: 'ग्रामीण सार्वजनिक स्वास्थ्य सेवा एकीकृत मंच — महाराष्ट्र सरकार',
        sihHeader: 'SIH 2025 | समस्या आईडी #26133 | कौशल, रोजगार एवं नवाचार विभाग',

        // Navigation
        navHome: 'मुख्य पृष्ठ',
        navOpd: 'ओपीडी व डिजिटल ट्राइएज',
        navDashboard: 'जिला स्वास्थ्य डैशबोर्ड',
        navReferrals: 'रेफरल ट्रैकर पाइपलाइन',
        navQueue: 'कतार व टोकन प्रबंधन',
        navTeleconsult: 'टेलीकंसल्टेशन (विशेषज्ञ)',
        navMedicine: 'दवा व जांच समन्वय',
        navMesh: 'ऑफलाइन मेश नेटवर्क',

        // Triage Priorities
        critical: 'अत्यंत गंभीर',
        urgent: 'गंभीर',
        stable: 'स्थिर',
        emergency: 'आपातकालीन',

        // Action Buttons
        runAnalysis: 'एआई ट्राइएज विश्लेषण करें',
        generateToken: 'ओपीडी टोकन बनाएं',
        initiateReferral: 'रेफरल शुरू करें',
        startTeleconsult: 'विशेषज्ञ से जुड़ें',
        callNextPatient: 'अगला मरीज बुलाएं',
        priorityOverride: 'आपातकालीन प्राथमिकता दें',
        restockMedicine: 'दवा स्टॉक जोड़ें',
        exportFHIR: 'ABDM / FHIR R4 डाउनलोड',
        printWristband: 'QR रिस्टबैंड प्रिंट',
        demoMode: 'महाराष्ट्र डेमो लोड करें',
        stopDemo: 'डेमो रीसेट करें',
        systemOnline: 'सभी स्वास्थ्य केंद्र ऑनलाइन',
        offlineActive: 'ऑफलाइन मोड सक्रिय',

        // Vitals & Clinical
        spo2Label: 'ऑक्सीजन स्तर (SpO2 %)',
        pulseLabel: 'पल्स रेट (BPM)',
        bpLabel: 'रक्तचाप (BP mmHg)',
        tempLabel: 'तापमान (°F)',
        glucoseLabel: 'रक्त शर्करा (Glucose mg/dL)',
        rrLabel: 'श्वसन दर (/min)',
        consciousnessLabel: 'चेतना स्तर (AVPU)',
        notesLabel: 'मुख्य शिकायत व लक्षण',
        maternalFlag: 'गर्भवती / मातृ स्वास्थ्य',
        childFlag: 'बच्चा (< 5 वर्ष)',

        // District Stats
        patientsToday: 'आज के कुल मरीज',
        pendingReferrals: 'लंबित रेफरल',
        activeQueue: 'सक्रिय कतार',
        highRiskAlerts: 'उच्च जोखिम फॉलो-अप',
        facilityHierarchy: 'महाराष्ट्र स्वास्थ्य ढांचा',
    },
};

export function t(key: keyof typeof DICTIONARY['en'], lang: Language = 'mr'): string {
    const dict = DICTIONARY[lang] || DICTIONARY.mr || DICTIONARY.en;
    return dict[key] || DICTIONARY.mr[key] || DICTIONARY.en[key] || key;
}
