/**
 * i18n Dictionaries for India Digital Public Infrastructure (DPI)
 * Supports English, Tamil (தமிழ்), and Hindi (हिन्दी)
 */

import { Language } from '@/stores/languageStore';

export const DICTIONARY = {
    en: {
        appTitle: 'NalamMesh',
        appSubtitle: 'Offline Disaster Mesh Network',
        navCommand: 'Command Dashboard',
        navTriage: 'Triage Station',
        navAmbulance: 'Ambulance Hub',
        navTopology: 'Mesh Network Demo',
        critical: 'CRITICAL',
        urgent: 'URGENT',
        stable: 'STABLE',
        runAnalysis: 'Run AI Triage Analysis',
        spo2Label: 'Oxygen Saturation (SpO2)',
        pulseLabel: 'Pulse Rate (BPM)',
        bpLabel: 'Blood Pressure (mmHg)',
        consciousnessLabel: 'Consciousness (AVPU)',
        notesLabel: 'Clinical Notes / Pattern',
        printWristband: 'Print Wristband',
        exportFHIR: 'Export ABDM / FHIR R4',
        demoMode: 'Start Live Demo Flow',
        stopDemo: 'Stop Demo Mode',
        systemOnline: 'Mesh Network Online',
    },
    ta: {
        appTitle: 'நலம்மேஷ்',
        appSubtitle: 'இணையமற்ற அவசரகால மருத்துவ வலையமைப்பு',
        navCommand: 'முதன்மை கட்டுப்பாட்டு மையம்',
        navTriage: 'நோயாளி பரிசோதனை நிலையம்',
        navAmbulance: 'ஆம்புலன்ஸ் மையம்',
        navTopology: 'வலைப்பின்னல் செயல்முறை',
        critical: 'அவசர சிகிச்சை தேவை',
        urgent: 'முக்கிய சிகிச்சை தேவை',
        stable: 'சீரான நிலை',
        runAnalysis: 'செயற்கை நுண்ணறிவு பகுப்பாய்வு',
        spo2Label: 'ஆக்ஸிஜன் அளவு (SpO2)',
        pulseLabel: 'நாடித் துடிப்பு (BPM)',
        bpLabel: 'இரத்த அழுத்தம் (mmHg)',
        consciousnessLabel: 'சுயநினைவு நிலை (AVPU)',
        notesLabel: 'மருத்துவ குறிப்புகள்',
        printWristband: 'மணிக்கட்டு பட்டை அச்சிடு',
        exportFHIR: 'ABDM / FHIR பதிவிறக்கம்',
        demoMode: 'நேரலை செயல்முறை தொடங்கு',
        stopDemo: 'செயல்முறை நிறுத்து',
        systemOnline: 'வலைப்பின்னல் இயங்குகிறது',
    },
    hi: {
        appTitle: 'नलममेश',
        appSubtitle: 'ऑफलाइन आपातकालीन चिकित्सा नेटवर्क',
        navCommand: 'मुख्य कमान केंद्र',
        navTriage: 'मरीज ट्राइएज स्टेशन',
        navAmbulance: 'एम्बुलेंस हब',
        navTopology: 'नेटवर्क टोपोलॉजी',
        critical: 'अत्यंत गंभीर',
        urgent: 'गंभीर',
        stable: 'स्थिर',
        runAnalysis: 'एआई ट्राइएज विश्लेषण',
        spo2Label: 'ऑक्सीजन स्तर (SpO2)',
        pulseLabel: 'पल्स रेट (BPM)',
        bpLabel: 'रक्तचाप (mmHg)',
        consciousnessLabel: 'चेतना स्तर (AVPU)',
        notesLabel: 'चिकित्सकीय नोट्स',
        printWristband: 'रिस्टबैंड प्रिंट करें',
        exportFHIR: 'ABDM / FHIR डाउनलोड',
        demoMode: 'लाइव डेमो शुरू करें',
        stopDemo: 'डेमो रोकें',
        systemOnline: 'नेटवर्क सक्रिय है',
    },
};

export function t(key: keyof typeof DICTIONARY['en'], lang: Language = 'en'): string {
    const dict = DICTIONARY[lang] || DICTIONARY.en;
    return dict[key] || DICTIONARY.en[key] || key;
}
