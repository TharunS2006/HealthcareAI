/**
 * OPD Registration & Edge AI Digital Triage — NalamMesh
 * Government of Maharashtra • Department of Public Health
 * Primary Health Centre Clinical Workstation (NIC / GIGW Standard)
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import QRWristband from '@/components/shared/QRWristband';
import Icon from '@/components/gov/Icon';
import { Vitals, Patient } from '@/types/patient';
import { QueueEntry } from '@/types/facility';
import { classifyTriage, TriageResult } from '@/lib/triage/model';
import { usePatientStore } from '@/stores/patientStore';
import { useQueueStore } from '@/stores/queueStore';
import { useReferralStore } from '@/stores/referralStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { downloadFHIRRecord } from '@/lib/fhir';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export default function OPDPage() {
    const { language } = useLanguageStore();
    const { patients, addPatient } = usePatientStore();
    const { queue, addQueueEntry } = useQueueStore();
    const { addReferral } = useReferralStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    // Patient Demographics State
    const [searchQuery, setSearchQuery] = useState('');
    const [patientId, setPatientId] = useState('');
    const [name, setName] = useState('Sunita M. Devi');
    const [age, setAge] = useState<number>(26);
    const [gender, setGender] = useState<'M' | 'F' | 'O'>('F');
    const [phone, setPhone] = useState('+91-98765-43210');
    const [village, setVillage] = useState('Kothi (कोठी)');
    const [abhaId, setAbhaId] = useState('ABHA-9128-4421-8890');
    const [aadhaarLast4, setAadhaarLast4] = useState('4821');

    // Clinical Vitals State
    const [vitals, setVitals] = useState<Vitals>({
        spo2: 91,
        heartRate: 118,
        bloodPressure: { systolic: 154, diastolic: 98 },
        temperature: 99.4,
        bloodGlucose: 126,
        respiratoryRate: 24,
        consciousness: 'ALERT',
        injuryType: 'Severe headache, blurred vision, bilateral pedal edema at 32 weeks gestation',
        isPregnant: true,
        gestationalWeeks: 32,
    });

    // Voice Input Integration
    const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceInput();

    useEffect(() => {
        if (transcript) {
            setVitals((prev) => ({
                ...prev,
                injuryType: prev.injuryType ? `${prev.injuryType}; ${transcript}` : transcript,
            }));
        }
    }, [transcript]);

    // Triage & Output State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);
    const [showQR, setShowQR] = useState(false);

    // Dynamic Translations Dictionary
    const L = {
        deptTag: isEn
            ? 'Department of Public Health • Primary Health Centre, Bhamragad'
            : isHi
            ? 'सार्वजनिक स्वास्थ्य विभाग • प्राथमिक स्वास्थ्य केंद्र, भामरागढ़'
            : 'सार्वजनिक आरोग्य विभाग • प्राथमिक आरोग्य केंद्र, भामरागड',
        standardsTag: isEn ? 'IPHS 2022 Standards' : isHi ? 'IPHS 2022 मानक' : 'IPHS 2022 मानके',
        pageTitle: isEn
            ? 'OPD Patient Registration & Digital Triage'
            : isHi
            ? 'ओपीडी मरीज पंजीकरण एवं डिजिटल ट्राइएज कक्ष'
            : 'ओपीडी रुग्ण नोंदणी व डिजिटल ट्राइएज कक्ष',
        pageSub: isEn
            ? 'OPD Registration & Clinical Intake • Government of Maharashtra • ABDM Integrated'
            : isHi
            ? 'ओपीडी पंजीयन व नैदानिक जांच • महाराष्ट्र शासन • ABDM प्रमाणित'
            : 'OPD Registration & Clinical Intake • Government of Maharashtra • ABDM Integrated',
        searchPlaceholder: isEn ? 'Search ABHA ID / Aadhaar / Name...' : isHi ? 'ABHA ID / आधार क्रमांक / नाम खोजें...' : 'ABHA ID / आधार क्रमांक / नाव शोधा...',
        searchBtn: isEn ? 'Search' : isHi ? 'खोजें' : 'शोधा',
        sec1Title: isEn ? '1. Patient Demographics & ABHA' : isHi ? '१. मरीज की प्राथमिक जानकारी (ABHA)' : '१. रुग्णाची प्राथमिक माहिती (Demographics & ABHA)',
        fullName: isEn ? 'Patient Full Name' : isHi ? 'मरीज का पूरा नाम' : 'रुग्णाचे पूर्ण नाव',
        ageLabel: isEn ? 'Age (Years)' : isHi ? 'आयु (वर्ष)' : 'वय (वर्षे)',
        genderLabel: isEn ? 'Gender' : isHi ? 'लिंग' : 'लिंग',
        male: isEn ? 'M' : isHi ? 'पु' : 'पु',
        female: isEn ? 'F' : isHi ? 'स्त्री' : 'स्त्री',
        other: isEn ? 'O' : isHi ? 'अन्य' : 'इतर',
        abhaLabel: isEn ? 'Ayushman Bharat (ABHA ID)' : isHi ? 'आयुष्मान भारत (ABHA ID)' : 'आयुष्मान भारत (ABHA ID)',
        villageLabel: isEn ? 'Village / Hamlet' : isHi ? 'गांव / टोला' : 'गाव / पाडा',
        ancCohort: isEn
            ? `High-Risk Maternal / ANC (${vitals.gestationalWeeks || 32} Weeks)`
            : isHi
            ? `गर्भवती माता / ANC (${vitals.gestationalWeeks || 32} सप्ताह)`
            : `गरोदर माता / ANC (${vitals.gestationalWeeks || 32} आठवडे)`,
        childCohort: isEn ? 'Child (< 5 Years Malnutrition Screening)' : isHi ? 'बालक (< ५ वर्ष कुपोषण जांच)' : 'बालक (< ५ वर्षे कुपोषण तपासणी)',
        sec2Title: isEn ? '2. Physiological Vitals & Clinical Examination' : isHi ? '२. शारीरिक जांच एवं महत्वपूर्ण संकेत (Vitals)' : '२. वैद्यकीय तपासणी व महत्त्वपूर्ण नोंदी (Physiological Vitals)',
        manualSensor: isEn ? 'Live Sensor / Manual Entry' : isHi ? 'लाइव सेंसर / मैन्युअल प्रविष्टि' : 'थेट सेन्सर / मॅन्युअल नोंदणी',
        spo2Label: isEn ? 'SpO2 (Oxygen Saturation)' : isHi ? 'SpO2 (ऑक्सीजन स्तर)' : 'SpO2 (ऑक्सिजन प्रमाण)',
        pulseLabel: isEn ? 'Pulse Rate (BPM)' : isHi ? 'नाड़ी दर (Pulse / BPM)' : 'नाडीचे ठोके (Pulse / BPM)',
        bpLabel: isEn ? 'Blood Pressure (mmHg)' : isHi ? 'रक्तचाप / Blood Pressure (mmHg)' : 'रक्तदाब / Blood Pressure (mmHg)',
        glucoseLabel: isEn ? 'Blood Glucose' : isHi ? 'रक्त शर्करा (Glucose)' : 'रक्तातील साखर (Glucose)',
        rrLabel: isEn ? 'Respiratory Rate (/min)' : isHi ? 'श्वसन दर (Respiratory Rate)' : 'श्वसनाचा दर (Respiratory Rate)',
        tempLabel: isEn ? 'Temperature' : isHi ? 'तापमान (Temperature)' : 'तापमान (Temperature)',
        avpuLabel: isEn ? 'Consciousness (AVPU)' : isHi ? 'चेतना स्तर (AVPU)' : 'शुद्धीची पातळी (AVPU)',
        avpuAlert: isEn ? 'Alert' : isHi ? 'सजग' : 'सजग',
        avpuVoice: isEn ? 'Voice' : isHi ? 'आवाज' : 'आवाज',
        avpuPain: isEn ? 'Pain' : isHi ? 'वेदना' : 'वेदना',
        avpuUnresponsive: isEn ? 'Unresponsive' : isHi ? 'बेहोश' : 'बेशुद्ध',
        complaintLabel: isEn ? 'Chief Complaint & Clinical Symptoms' : isHi ? 'मुख्य शिकायत व लक्षण (Chief Complaint)' : 'मुख्य तक्रार व आजाराची लक्षणे (Chief Complaint)',
        analyzingBtn: isEn ? 'Evaluating Triage Risk...' : isHi ? 'विश्लेषण जारी है...' : 'विश्लेषण चालू आहे...',
        runTriageBtn: isEn ? '✓ Run AI Triage & Generate OPD Token' : isHi ? '✓ एआई ट्राइएज विश्लेषण करें व टोकन दें' : '✓ एआई ट्राइएज विश्लेषण करा व ओपीडी टोकन द्या',
        receiptGovt: isEn
            ? 'Government of Maharashtra • Department of Public Health'
            : isHi
            ? 'महाराष्ट्र सरकार • सार्वजनिक स्वास्थ्य विभाग'
            : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग',
        receiptTitle: isEn ? 'Official OPD Registration & Triage Slip' : isHi ? 'अधिकृत ओपीडी पंजीयन व ट्राइएज पर्ची' : 'अधिकृत ओपीडी नोंदणी व ट्राइएज पावती',
        tokenLabel: isEn ? 'Token Number' : isHi ? 'टोकन नंबर' : 'टोकन क्रमांक',
        priorityLabel: isEn ? 'Triage Priority' : isHi ? 'ट्राइएज प्राथमिकता' : 'ट्राइएज प्राधान्य',
        patNameLabel: isEn ? 'Patient Name:' : isHi ? 'मरीज का नाम:' : 'रुग्णाचे नाव:',
        patVillageLabel: isEn ? 'Village:' : isHi ? 'गांव:' : 'गाव:',
        patAbhaLabel: isEn ? 'ABHA ID:' : isHi ? 'ABHA नंबर:' : 'ABHA क्रमांक:',
        patRoomLabel: isEn ? 'Consultation Room:' : isHi ? 'जांच कक्ष:' : 'तपासणी कक्ष:',
        roomMO: isEn ? 'Room No. 2 (Medical Officer)' : isHi ? 'कक्ष क्र. २ (चिकित्सा अधिकारी)' : 'कक्ष क्र. २ (MO OPD)',
        actionLabel: isEn ? 'Recommended Clinical Action:' : isHi ? 'अनुशंसित चिकित्सकीय कार्रवाई:' : 'वैद्यकीय कृती शिफारस:',
        basisLabel: isEn ? 'Clinical Basis' : isHi ? 'चिकित्सकीय आधार' : 'वैद्यकीय आधार',
        srcNeural: isEn ? 'On-device neural network' : isHi ? 'ऑन-डिवाइस न्यूरल नेटवर्क' : 'ऑन-डिव्हाइस न्यूरल नेटवर्क',
        srcOverride: isEn ? 'IPHS danger-sign protocol (overrode model)' : isHi ? 'IPHS खतरे के लक्षण प्रोटोकॉल (मॉडल अधिभावी)' : 'IPHS धोकादायक लक्षण प्रोटोकॉल (मॉडेलवर प्राधान्य)',
        srcRules: isEn ? 'IPHS clinical rule engine' : isHi ? 'IPHS चिकित्सकीय नियम इंजन' : 'IPHS वैद्यकीय नियम इंजिन',
        confLabel: isEn ? 'Confidence' : isHi ? 'विश्वसनीयता' : 'विश्वासार्हता',
        wristbandBtn: isEn ? 'QR Wristband' : isHi ? 'QR रिस्टबैंड' : 'QR रिस्टबँड',
        downloadFHIR: isEn ? 'FHIR R4 JSON' : isHi ? 'FHIR R4 JSON' : 'FHIR R4 JSON',
        waitingAnalysisTitle: isEn ? 'Awaiting Triage Analysis' : isHi ? 'ट्राइएज विश्लेषण की प्रतीक्षा' : 'ट्राइएज विश्लेषण प्रतिक्षा',
        waitingAnalysisDesc: isEn
            ? 'Fill in the patient symptoms and vital signs on the left, then click "Run AI Triage". The system will instantly prioritize emergency risk and issue a government OPD token.'
            : isHi
            ? 'बाईं ओर मरीज के लक्षण व संकेत दर्ज करें और "एआई ट्राइएज विश्लेषण" बटन पर क्लिक करें। प्रणाली तत्काल जोखिम वर्गीकरण और सरकारी ओपीडी टोकन जारी करेगी।'
            : 'डाव्या बाजूला रुग्णाची लक्षणे व नोंदी भरून "एआई ट्राइएज विश्लेषण" बटणावर क्लिक करा. सिस्टीम तात्काळ धोक्याचे वर्गीकरण व अधिकृत ओपीडी टोकन जारी करेल.',
        analyzingTitle: isEn ? 'Running On-Device Triage Model…' : isHi ? 'ऑन-डिवाइस ट्राइएज मॉडेल चल रहा है…' : 'ऑन-डिव्हाइस ट्राइएज मॉडेल सुरू आहे…',
        analyzingDesc: isEn
            ? 'Scoring vitals and symptoms against the IPHS danger-sign protocol and neural network. This runs entirely on this device — no internet required.'
            : isHi
            ? 'IPHS खतरे के लक्षण प्रोटोकॉल व न्यूरल नेटवर्क के आधार पर विश्लेषण जारी है। यह पूरी तरह इस डिवाइस पर चलता है — इंटरनेट की आवश्यकता नहीं।'
            : 'IPHS धोकादायक लक्षण प्रोटोकॉल व न्यूरल नेटवर्कच्या आधारे विश्लेषण सुरू आहे. हे पूर्णपणे याच डिव्हाइसवर चालते — इंटरनेटची गरज नाही.',
        queueHeader: isEn ? 'Live OPD Queue Board' : isHi ? 'दैनिक ओपीडी कतार बोर्ड' : 'दैनिक ओपीडी रांग फलक (Live OPD Queue Board)',
        queueLive: isEn ? 'Live Real-time' : isHi ? 'लाइव अपडेट' : 'थेट अद्ययावत',
        colToken: isEn ? 'Token' : isHi ? 'टोकन' : 'टोकन',
        colPatient: isEn ? 'Patient' : isHi ? 'मरीज' : 'रुग्ण',
        colPriority: isEn ? 'Priority' : isHi ? 'प्राथमिकता' : 'प्राधान्य',
        colWait: isEn ? 'Est. Wait' : isHi ? 'समय' : 'वेळ',
        minUnit: isEn ? 'min' : isHi ? 'मि.' : 'मि.',
        voiceListening: isEn ? 'Listening... Speak symptoms' : isHi ? 'सुन रहा है... लक्षण बोलें' : 'ऐकत आहे... लक्षणे बोला',
        voicePrompt: isEn ? 'Voice Intake (EN/HI/MR)' : isHi ? 'आवाज इनपुट (हिन्दी/मराठी/Eng)' : 'आवाज इनपुट (मराठी/हिन्दी/Eng)',
    };

    // Handle Quick Search
    const handleSearch = () => {
        const found = patients.find(
            (p) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.abhaId && p.abhaId.toLowerCase().includes(searchQuery.toLowerCase())) ||
                p.id.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (found) {
            setPatientId(found.id);
            setName(found.name);
            setAge(found.age);
            setGender(found.gender);
            setPhone(found.phone || '');
            setVillage(found.village || 'Bhamragad');
            setAbhaId(found.abhaId || '');
            if (found.vitals) setVitals(found.vitals);
            toast.success(isEn ? `Found record: ${found.name}` : `रेकॉर्ड सापडला: ${found.name}`);
        } else {
            toast.error(isEn ? 'Patient record not found locally' : 'स्थानिक डेटाबेसमध्ये रुग्ण सापडला नाही');
        }
    };

    // Run On-Device Triage Classification
    const handleRunTriage = (e: React.FormEvent) => {
        e.preventDefault();
        setIsAnalyzing(true);

        setTimeout(async () => {
            const result = await classifyTriage(vitals);
            setTriageResult(result);

            // Generate OPD Token
            const tokenPrefix = result.status === 'RED' ? 'EMG' : result.status === 'YELLOW' ? 'URG' : 'GEN';
            const tokenNum = `${tokenPrefix}-${Math.floor(100 + Math.random() * 900)}`;
            setGeneratedToken(tokenNum);

            // Save Patient Record into Zustand & IndexedDB
            const newPatId = patientId || `PAT-${uuidv4().substring(0, 8).toUpperCase()}`;
            const newPatient: Patient = {
                id: newPatId,
                name,
                age,
                gender,
                phone,
                village,
                tehsil: 'Bhamragad',
                district: 'Gadchiroli',
                state: 'Maharashtra',
                languagePreference: language === 'hi' ? 'hi' : language === 'en' ? 'en' : 'mr',
                abhaId,
                aadhaarLast4,
                vitals,
                triageStatus: result.status,
                triagePriority: result.priority,
                gps: { lat: 19.0432, lng: 80.3621 },
                timestamp: new Date().toISOString(),
                isSynced: false,
                highRiskFlags: vitals.isPregnant
                    ? [
                          {
                              type: 'MATERNAL',
                              severity: 'HIGH',
                              identifiedDate: new Date().toISOString(),
                              nextFollowUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                              notes: 'High-risk maternal ANC follow-up',
                          },
                      ]
                    : [],
            };

            addPatient(newPatient);
            setCreatedPatient(newPatient);

            // Add into Facility Queue
            const queueItem: QueueEntry = {
                id: `Q-${uuidv4().substring(0, 6)}`,
                tokenNumber: tokenNum,
                sequence: queue.length + 1,
                patientId: newPatId,
                patientName: name,
                patientAge: age,
                patientGender: gender,
                facilityId: 'phc-bhamragad',
                facilityName: 'PHC Bhamragad',
                registeredAt: new Date().toISOString(),
                priority: result.priority,
                chiefComplaint: vitals.injuryType || 'General Consultation',
                status: 'WAITING',
                roomNo: result.status === 'RED' ? 'Emergency Stabilisation' : 'Room 2 (MO)',
                consultingDoctor: 'Dr. Suresh Atram',
                estimatedWaitMinutes: result.status === 'RED' ? 0 : result.status === 'YELLOW' ? 8 : 25,
            };
            addQueueEntry(queueItem);

            // If Critical RED, automatically trigger 108 Emergency Referral Pipeline draft
            if (result.status === 'RED') {
                addReferral({
                    id: `REF-${uuidv4().substring(0, 6).toUpperCase()}`,
                    patientId: newPatId,
                    patientName: name,
                    patientAge: age,
                    patientGender: gender,
                    fromFacilityId: 'phc-bhamragad',
                    fromFacilityName: 'PHC Bhamragad (भामरागड)',
                    fromFacilityType: 'PHC',
                    toFacilityId: 'dh-gadchiroli',
                    toFacilityName: 'District Hospital Gadchiroli (जिल्हा रुग्णालय)',
                    toFacilityType: 'DH',
                    status: 'INITIATED',
                    priority: 'EMERGENCY',
                    reason: `${result.recommendedAction} — Severe clinical vitals (SpO2: ${vitals.spo2}%, BP: ${vitals.bloodPressure?.systolic}/${vitals.bloodPressure?.diastolic})`,
                    referredBy: 'Dr. Suresh Atram (MO)',
                    referredAt: new Date().toISOString(),
                    transportMode: 'AMBULANCE_108',
                    ambulanceVehicleNo: 'MH-33-E-1081',
                });
                toast.error(isEn ? 'CRITICAL: 108 Emergency Ambulance Pipeline Triggered' : 'अति तातडीचे: १०८ रुग्णवाहिका रेफरल तात्काळ सक्रिय केले!');
            } else {
                toast.success(isEn ? `Token Generated: ${tokenNum}` : `टोकन तयार केले: ${tokenNum}`);
            }

            setIsAnalyzing(false);
        }, 350);
    };

    return (
        <div className="flex bg-[#F4F6FA] min-h-screen font-sans text-slate-800">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                <MobileMenu />

                <div className="max-w-6xl mx-auto space-y-4">
                    {/* Official Workstation Header Bar */}
                    <div className="bg-white border border-slate-300 rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{L.deptTag}</span>
                                <span className="text-slate-400">|</span>
                                <span className="text-emerald-700 font-extrabold">{L.standardsTag}</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">
                                {L.pageTitle}
                            </h1>
                            <p className="text-xs text-slate-600">
                                {L.pageSub}
                            </p>
                        </div>

                        {/* Search Patient Bar */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <input
                                    type="text"
                                    placeholder={L.searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-1.5 pl-8 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white focus:outline-none focus:border-[#1F3A6E]"
                                />
                                <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-3 py-1.5 bg-[#1F3A6E] text-white text-xs font-bold rounded hover:bg-[#16294E] transition-colors"
                            >
                                {L.searchBtn}
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-12 gap-5">
                        {/* Left Column (7 cols): Official Medical Intake Form */}
                        <form onSubmit={handleRunTriage} className="lg:col-span-7 space-y-4">
                            {/* Section 1: Demographics Fieldset */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>{L.sec1Title}</span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded">
                                        ABDM M1 Ready
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">
                                                {L.fullName} <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1F3A6E]"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block font-bold text-slate-700 mb-1">
                                                    {L.ageLabel} <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={age}
                                                    onChange={(e) => setAge(Number(e.target.value))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold focus:outline-none focus:border-[#1F3A6E]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-bold text-slate-700 mb-1">
                                                    {L.genderLabel} <span className="text-red-600">*</span>
                                                </label>
                                                <div className="flex border border-slate-300 rounded overflow-hidden">
                                                    {(['M', 'F', 'O'] as const).map((g) => (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            onClick={() => setGender(g)}
                                                            className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                                                                gender === g
                                                                    ? 'bg-[#1F3A6E] text-white'
                                                                    : 'bg-white text-slate-700 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {g === 'M' ? L.male : g === 'F' ? L.female : L.other}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">
                                                {L.abhaLabel}
                                            </label>
                                            <input
                                                type="text"
                                                value={abhaId}
                                                onChange={(e) => setAbhaId(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-[#1F3A6E]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">
                                                {L.villageLabel} <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={village}
                                                onChange={(e) => setVillage(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1F3A6E]"
                                            />
                                        </div>
                                    </div>

                                    {/* High-Risk Clinical Cohort Selectors */}
                                    <div className="pt-2 border-t border-slate-200 flex items-center gap-3 flex-wrap text-xs">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-red-900 bg-red-50 px-3 py-1.5 rounded border border-red-200">
                                            <input
                                                type="checkbox"
                                                checked={vitals.isPregnant}
                                                onChange={(e) => setVitals({ ...vitals, isPregnant: e.target.checked })}
                                                className="w-4 h-4 accent-red-700"
                                            />
                                            <span>{L.ancCohort}</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                                            <input
                                                type="checkbox"
                                                checked={!!vitals.childAgeMonths}
                                                onChange={(e) => setVitals({ ...vitals, childAgeMonths: e.target.checked ? 18 : undefined })}
                                                className="w-4 h-4 accent-amber-700"
                                            />
                                            <span>{L.childCohort}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Clinical Vitals */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>{L.sec2Title}</span>
                                    <span className="text-[10px] text-slate-500 font-bold">
                                        {L.manualSensor}
                                    </span>
                                </div>

                                <div className="p-4 space-y-4 text-xs">
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {/* SpO2 */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    {L.spo2Label}
                                                </span>
                                                <strong className={`text-xl font-mono ${vitals.spo2 < 92 ? 'text-red-700 font-black' : 'text-[#1F3A6E]'}`}>
                                                    {vitals.spo2}%
                                                </strong>
                                            </div>
                                            <input
                                                type="range"
                                                min="60"
                                                max="100"
                                                value={vitals.spo2}
                                                onChange={(e) => setVitals({ ...vitals, spo2: Number(e.target.value) })}
                                                className="w-full accent-[#1F3A6E] cursor-pointer"
                                            />
                                        </div>

                                        {/* Heart Rate */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    {L.pulseLabel}
                                                </span>
                                                <strong className="text-xl font-mono text-[#1F3A6E]">
                                                    {vitals.heartRate}
                                                </strong>
                                            </div>
                                            <input
                                                type="range"
                                                min="40"
                                                max="180"
                                                value={vitals.heartRate}
                                                onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                                                className="w-full accent-[#1F3A6E] cursor-pointer"
                                            />
                                        </div>

                                        {/* Blood Pressure */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <span className="font-bold text-slate-700 uppercase text-[11px] block mb-1">
                                                {L.bpLabel}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Systolic"
                                                    value={vitals.bloodPressure?.systolic}
                                                    onChange={(e) => setVitals({
                                                        ...vitals,
                                                        bloodPressure: {
                                                            systolic: Number(e.target.value),
                                                            diastolic: vitals.bloodPressure?.diastolic || 80
                                                        }
                                                    })}
                                                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base text-[#1F3A6E]"
                                                />
                                                <span className="text-slate-400 font-bold">/</span>
                                                <input
                                                    type="number"
                                                    placeholder="Diastolic"
                                                    value={vitals.bloodPressure?.diastolic}
                                                    onChange={(e) => setVitals({
                                                        ...vitals,
                                                        bloodPressure: {
                                                            systolic: vitals.bloodPressure?.systolic || 120,
                                                            diastolic: Number(e.target.value)
                                                        }
                                                    })}
                                                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base text-[#1F3A6E]"
                                                />
                                            </div>
                                        </div>

                                        {/* Blood Glucose */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    {L.glucoseLabel}
                                                </span>
                                                <span className="text-slate-500 text-[10px]">mg/dL</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={vitals.bloodGlucose || 110}
                                                onChange={(e) => setVitals({ ...vitals, bloodGlucose: Number(e.target.value) })}
                                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base text-[#1F3A6E]"
                                            />
                                        </div>

                                        {/* Respiratory Rate — a trained triage input with critical thresholds
                                            (>=36 or <=8 /min), so it must be capturable at intake. */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    {L.rrLabel}
                                                </span>
                                                <strong className={`text-xl font-mono ${
                                                    (vitals.respiratoryRate || 16) >= 36 || (vitals.respiratoryRate || 16) <= 8
                                                        ? 'text-red-700 font-black'
                                                        : (vitals.respiratoryRate || 16) >= 27
                                                        ? 'text-amber-700 font-black'
                                                        : 'text-[#1F3A6E]'
                                                }`}>
                                                    {vitals.respiratoryRate || 16}
                                                </strong>
                                            </div>
                                            <input
                                                type="range"
                                                min="4"
                                                max="60"
                                                value={vitals.respiratoryRate || 16}
                                                onChange={(e) => setVitals({ ...vitals, respiratoryRate: Number(e.target.value) })}
                                                className="w-full accent-[#1F3A6E] cursor-pointer"
                                            />
                                        </div>

                                        {/* Temperature */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    {L.tempLabel}
                                                </span>
                                                <span className="text-slate-500 text-[10px]">&deg;F</span>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={vitals.temperature || 98.6}
                                                onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
                                                className={`w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base ${
                                                    (vitals.temperature || 98.6) >= 102.5 ? 'text-red-700' : 'text-[#1F3A6E]'
                                                }`}
                                            />
                                        </div>

                                        {/* Consciousness (AVPU) — drives the critical override for altered sensorium. */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded sm:col-span-2">
                                            <span className="font-bold text-slate-700 uppercase text-[11px] block mb-1">
                                                {L.avpuLabel}
                                            </span>
                                            <div className="flex border border-slate-300 rounded overflow-hidden">
                                                {([
                                                    ['ALERT', L.avpuAlert],
                                                    ['VOICE', L.avpuVoice],
                                                    ['PAIN', L.avpuPain],
                                                    ['UNRESPONSIVE', L.avpuUnresponsive],
                                                ] as const).map(([level, text]) => (
                                                    <button
                                                        key={level}
                                                        type="button"
                                                        onClick={() => setVitals({ ...vitals, consciousness: level })}
                                                        className={`flex-1 py-1.5 text-[11px] font-bold transition-colors ${
                                                            (vitals.consciousness || 'ALERT') === level
                                                                ? level === 'ALERT'
                                                                    ? 'bg-[#1F3A6E] text-white'
                                                                    : 'bg-red-700 text-white'
                                                                : 'bg-white text-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {text}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chief Complaint / Symptoms */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block font-bold text-slate-700">
                                                {L.complaintLabel}
                                            </label>
                                            {isSupported && (
                                                <button
                                                    type="button"
                                                    onClick={() => (isListening ? stopListening() : startListening(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'))}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                                        isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    <Icon name={isListening ? 'mic' : 'mic'} className="w-3 h-3" />
                                                    {isListening ? L.voiceListening : L.voicePrompt}
                                                </button>
                                            )}
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={vitals.injuryType}
                                            onChange={(e) => setVitals({ ...vitals, injuryType: e.target.value })}
                                            className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-[#1F3A6E]"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isAnalyzing}
                                        className="w-full py-3 bg-[#1F3A6E] hover:bg-[#16294E] text-white text-sm font-bold rounded shadow transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isAnalyzing ? (
                                            <span>{L.analyzingBtn}</span>
                                        ) : (
                                            <span>{L.runTriageBtn}</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>

                        {/* Right Column (5 cols): Official Slip & Live Queue Board */}
                        <div className="lg:col-span-5 space-y-4">
                            {/* Official Triage Result & Token Receipt Slip */}
                            {triageResult && generatedToken ? (
                                <div className="gov-card border-2 border-[#1F3A6E] shadow-sm animate-fade-in">
                                    <div className="bg-[#1F3A6E] text-white p-3 text-center border-b border-slate-300">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 block">
                                            {L.receiptGovt}
                                        </span>
                                        <h3 className="text-sm font-black">
                                            {L.receiptTitle}
                                        </h3>
                                        <span className="text-[10px] text-slate-300">
                                            Government OPD Token Slip • PHC Bhamragad
                                        </span>
                                    </div>

                                    <div className="p-4 space-y-3 text-xs bg-[#FAFBFD]">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <div>
                                                <span className="text-slate-500 block text-[10px] uppercase font-bold">{L.tokenLabel}</span>
                                                <strong className="text-2xl font-mono font-black text-[#1F3A6E]">{generatedToken}</strong>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-slate-500 block text-[10px] uppercase font-bold">{L.priorityLabel}</span>
                                                <span className={`px-2.5 py-1 rounded text-xs font-black uppercase ${
                                                    triageResult.status === 'RED'
                                                        ? 'bg-red-600 text-white'
                                                        : triageResult.status === 'YELLOW'
                                                        ? 'bg-amber-500 text-slate-950'
                                                        : 'bg-emerald-700 text-white'
                                                }`}>
                                                    {triageResult.priority} ({triageResult.status})
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded border border-slate-200">
                                            <div>
                                                <span className="text-slate-500 block">{L.patNameLabel}</span>
                                                <strong className="text-slate-800">{name} ({age} {isEn ? 'Yrs' : 'वर्षे'} / {gender})</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patVillageLabel}</span>
                                                <strong className="text-slate-800">{village}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patAbhaLabel}</span>
                                                <strong className="text-slate-800 font-mono text-[10px]">{abhaId}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patRoomLabel}</span>
                                                <strong className="text-[#1F3A6E]">{L.roomMO}</strong>
                                            </div>
                                        </div>

                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-snug">
                                            <strong>{L.actionLabel}</strong> {triageResult.recommendedAction}
                                        </div>

                                        {/* Clinical basis — states who actually decided, model or protocol */}
                                        <div className="p-2 bg-white border border-slate-200 rounded text-[11px] text-slate-700 leading-snug space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <strong className="text-[10px] uppercase tracking-wide text-slate-500">
                                                    {L.basisLabel}
                                                </strong>
                                                <span className="font-mono text-[10px] text-slate-500">
                                                    {L.confLabel} {Math.round(triageResult.confidence * 100)}% • {triageResult.processingTime} ms
                                                </span>
                                            </div>
                                            <p className="text-slate-700">{triageResult.reasoning}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {triageResult.decisionSource === 'CLINICAL_OVERRIDE'
                                                    ? L.srcOverride
                                                    : triageResult.decisionSource === 'RULE_ENGINE'
                                                    ? L.srcRules
                                                    : L.srcNeural}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowQR(true)}
                                                className="gov-btn gov-btn-secondary text-xs flex-1 inline-flex items-center justify-center gap-1.5"
                                            >
                                                <Icon name="printer" className="w-3.5 h-3.5" /> {L.wristbandBtn}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => createdPatient && downloadFHIRRecord(createdPatient)}
                                                className="gov-btn gov-btn-primary text-xs flex-1 inline-flex items-center justify-center gap-1.5"
                                            >
                                                <Icon name="download" className="w-3.5 h-3.5" /> {L.downloadFHIR}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : isAnalyzing ? (
                                <div className="gov-card p-6 text-center text-xs text-slate-600 space-y-3">
                                    <div
                                        className="w-8 h-8 mx-auto rounded-full border-[3px] border-slate-200 border-t-[#1F3A6E] animate-spin"
                                        role="status"
                                        aria-label={L.analyzingTitle}
                                    />
                                    <strong className="text-slate-700 block text-xs">
                                        {L.analyzingTitle}
                                    </strong>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {L.analyzingDesc}
                                    </p>
                                </div>
                            ) : (
                                <div className="gov-card p-4 text-center text-xs text-slate-500 space-y-2">
                                    <Icon name="clipboard" className="w-7 h-7 mx-auto text-slate-300" />
                                    <strong className="text-slate-700 block text-xs">
                                        {L.waitingAnalysisTitle}
                                    </strong>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {L.waitingAnalysisDesc}
                                    </p>
                                </div>
                            )}

                            {/* Official Live Queue Table (NIC Style) */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>{L.queueHeader}</span>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                        {L.queueLive}
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="gov-table">
                                        <thead>
                                            <tr>
                                                <th>{L.colToken}</th>
                                                <th>{L.colPatient}</th>
                                                <th>{L.colPriority}</th>
                                                <th>{L.colWait}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {queue.slice(0, 6).map((q) => (
                                                <tr key={q.id}>
                                                    <td className="font-mono font-bold text-[#1F3A6E]">{q.tokenNumber}</td>
                                                    <td className="font-semibold">{q.patientName}</td>
                                                    <td>
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                                            q.priority === 'EMERGENCY'
                                                                ? 'bg-red-100 text-red-800'
                                                                : q.priority === 'URGENT'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {q.priority}
                                                        </span>
                                                    </td>
                                                    <td className="text-slate-500">{q.estimatedWaitMinutes} {L.minUnit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* QR Wristband Modal */}
                    {showQR && createdPatient && (
                        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                            <div className="bg-white rounded border border-slate-400 p-4 max-w-sm w-full space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <strong className="text-xs font-bold text-[#1F3A6E]">{isEn ? 'Patient ID QR Wristband' : 'रुग्ण ओळख QR रिस्टबँड'}</strong>
                                    <button onClick={() => setShowQR(false)} className="text-xs font-bold text-slate-500">✕ {isEn ? 'Close' : 'बंद करा'}</button>
                                </div>
                                <QRWristband patient={createdPatient} />
                                <button
                                    onClick={() => window.print()}
                                    className="gov-btn gov-btn-primary w-full text-xs inline-flex items-center justify-center gap-1.5"
                                >
                                    <Icon name="printer" className="w-3.5 h-3.5" /> {isEn ? 'Print Wristband' : 'प्रिंट काढा (Print)'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
