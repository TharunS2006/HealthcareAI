/**
 * OPD Registration & Edge AI Digital Triage — NalamMesh
 * Government of Maharashtra • Department of Public Health
 * Facility OPD workstation, laid out to GIGW 3.0
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी) */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import QRWristband from '@/components/shared/QRWristband';
import Icon from '@/components/gov/Icon';
import { Patient } from '@/types/patient';
import { EMPTY_INTAKE, readIntake, type Avpu, type IntakeDraft } from '@/lib/triage/intake';
import { DEPLOYMENT } from '@/lib/config/deployment';
import { QueueEntry } from '@/types/facility';
import { classifyTriage, TriageResult } from '@/lib/triage/model';
import { usePatientStore } from '@/stores/patientStore';
import { useQueueStore } from '@/stores/queueStore';
import { useReferralStore } from '@/stores/referralStore';
import { useSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { requirementsFor } from '@/lib/capacity/requirements';
import { defaultReferralTarget, referralTargets } from '@/lib/capacity/availability';
import { useAvailability } from '@/lib/capacity/useAvailability';
import { nextTokenNumber } from '@/lib/queue/token';
import { useLanguageStore } from '@/stores/languageStore';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { downloadFHIRRecord } from '@/lib/fhir';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export default function OPDPage() {
    const { language } = useLanguageStore();
    const { patients, addPatient } = usePatientStore();
    const { queue, addQueueEntry } = useQueueStore();
    const createReferral = useReferralStore(s => s.create);
    // The patient is registered at — and any referral raised from — the
    // signed-in worker's own facility, never a hardcoded one.
    const session = useSession();
    const facility = FACILITY_NETWORK.find(f => f.id === session?.facilityId);
    const availabilityOf = useAvailability();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    // Patient Demographics State
    const [searchQuery, setSearchQuery] = useState('');
    const [patientId, setPatientId] = useState('');
    // The form starts empty for every patient: a pre-filled name, ABHA number or
    // vital sign is one careless click from being saved against the wrong person.
    const [name, setName] = useState('');
    const [ageText, setAgeText] = useState('');
    const [gender, setGender] = useState<'M' | 'F' | 'O' | ''>('');
    const [phone, setPhone] = useState('');
    const [village, setVillage] = useState('');
    const [abhaId, setAbhaId] = useState('');
    const [aadhaarLast4, setAadhaarLast4] = useState('');

    // Clinical intake as typed; lib/triage/intake.ts turns it into vitals and
    // refuses to invent a reading that was not taken.
    const [draft, setDraft] = useState<IntakeDraft>(EMPTY_INTAKE);
    const setField = <K extends keyof IntakeDraft>(field: K, value: IntakeDraft[K]) => setDraft(d => ({ ...d, [field]: value }));
    const num = (text: string) => (text.trim() === '' ? undefined : Number(text));

    // Voice Input Integration
    const { isListening, isSupported, isTranscribing, engine, error: voiceError, transcript, startListening, stopListening } = useVoiceInput();

    useEffect(() => {
        if (transcript) {
            setDraft((prev) => ({
                ...prev,
                complaint: prev.complaint ? `${prev.complaint}; ${transcript}` : transcript,
            }));
        }
    }, [transcript]);

    // Triage & Output State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);
    const [showQR, setShowQR] = useState(false);
    const [formProblems, setFormProblems] = useState<string[]>([]);

    /** Clear everything for the next patient, so the last one cannot be saved twice. */
    const resetForNextPatient = () => {
        setPatientId(''); setName(''); setAgeText(''); setGender(''); setPhone(''); setVillage('');
        setAbhaId(''); setAadhaarLast4(''); setSearchQuery(''); setDraft(EMPTY_INTAKE);
        setTriageResult(null); setGeneratedToken(null); setCreatedPatient(null); setShowQR(false); setFormProblems([]);
    };

    // Dynamic Translations Dictionary
    const L = {
        deptTag: `${isEn ? 'Department of Public Health' : isHi ? 'सार्वजनिक स्वास्थ्य विभाग' : 'सार्वजनिक आरोग्य विभाग'} • ${facility?.name ?? (isEn ? 'no facility posting' : isHi ? 'कोई केंद्र नहीं' : 'केंद्र नाही')}`,
        standardsTag: isEn ? 'IPHS 2022 Standards' : isHi ? 'IPHS 2022 मानक' : 'IPHS 2022 मानके',
        pageTitle: isEn
            ? 'OPD Patient Registration & Digital Triage'
            : isHi
            ? 'ओपीडी मरीज पंजीकरण एवं डिजिटल ट्राइएज कक्ष'
            : 'ओपीडी रुग्ण नोंदणी व डिजिटल ट्राइएज कक्ष',
        pageSub: isEn
            ? 'OPD Registration & Clinical Intake • Government of Maharashtra • ABDM-Ready (FHIR R4)'
            : isHi
            ? 'ओपीडी पंजीयन व नैदानिक जांच • महाराष्ट्र शासन • ABDM-सज्ज (FHIR R4)'
            : 'ओपीडी रुग्ण नोंदणी व नैदानिक तपासणी • महाराष्ट्र शासन • ABDM-सज्ज (FHIR R4)',
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
            ? 'Pregnant / ANC'
            : isHi
            ? 'गर्भवती माता / ANC'
            : 'गरोदर माता / ANC',
        childCohort: isEn ? 'Child (< 5 Years Malnutrition Screening)' : isHi ? 'बालक (< ५ वर्ष कुपोषण जांच)' : 'बालक (< ५ वर्षे कुपोषण तपासणी)',
        sec2Title: isEn ? '2. Physiological Vitals & Clinical Examination' : isHi ? '२. शारीरिक जांच एवं महत्वपूर्ण संकेत (Vitals)' : '२. वैद्यकीय तपासणी व महत्त्वपूर्ण नोंदी (Physiological Vitals)',
        manualSensor: isEn ? 'Live Sensor / Manual Entry' : isHi ? 'लाइव सेंसर / मैन्युअल प्रविष्टि' : 'थेट सेन्सर / मॅन्युअल नोंदणी',
        spo2Label: isEn ? 'SpO2 (Oxygen Saturation)' : isHi ? 'SpO2 (ऑक्सीजन स्तर)' : 'SpO2 (ऑक्सिजन प्रमाण)',
        pulseLabel: isEn ? 'Pulse Rate (BPM)' : isHi ? 'नाड़ी दर (Pulse / BPM)' : 'नाडीचे ठोके (Pulse / BPM)',
        bpLabel: isEn ? 'Blood Pressure (mmHg)' : isHi ? 'रक्तचाप / Blood Pressure (mmHg)' : 'रक्तदाब / Blood Pressure (mmHg)',
        glucoseLabel: isEn ? 'Blood Glucose' : isHi ? 'रक्त शर्करा (Glucose)' : 'रक्तातील साखर (Glucose)',
        notMeasured: isEn ? 'not measured' : isHi ? 'नहीं मापा' : 'मोजले नाही',
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
        roomEmergency: isEn ? 'Emergency stabilisation' : isHi ? 'आपातकालीन स्थिरीकरण' : 'आपत्कालीन स्थिरीकरण',
        roomMO: isEn ? 'Medical Officer OPD' : isHi ? 'चिकित्सा अधिकारी ओपीडी' : 'वैद्यकीय अधिकारी ओपीडी',
        roomSC: isEn ? 'Sub-Centre consultation (ANM / CHO)' : isHi ? 'उप-केंद्र परामर्श (ANM / CHO)' : 'उपकेंद्र सल्ला (ANM / CHO)',
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
            // Who they are, not how they were last time: today's vitals are
            // measured today.
            setPatientId(found.id);
            setName(found.name);
            setAgeText(String(found.age));
            setGender(found.gender);
            setPhone(found.phone || '');
            setVillage(found.village || '');
            setAbhaId(found.abhaId || '');
            setAadhaarLast4(found.aadhaarLast4 || '');
            setDraft({ ...EMPTY_INTAKE, pregnant: Boolean(found.vitals?.isPregnant) });
            toast.success(isEn ? `Found record: ${found.name}` : `रेकॉर्ड सापडला: ${found.name}`);
        } else {
            toast.error(isEn ? 'Patient record not found locally' : 'स्थानिक डेटाबेसमध्ये रुग्ण सापडला नाही');
        }
    };

    // Run On-Device Triage Classification
    const handleRunTriage = (e: React.FormEvent) => {
        e.preventDefault();

        // Nothing is registered or triaged until the record is complete and
        // plausible — see lib/triage/intake.ts.
        const age = Number(ageText);
        const missing: string[] = [];
        if (!facility) missing.push(isEn ? 'You have no facility posting — OPD registration is done at a facility' : 'कोई केंद्र नियुक्ति नहीं — ओपीडी पंजीकरण केंद्र पर होता है');
        if (!name.trim()) missing.push(isEn ? 'Patient name — not entered' : 'रुग्णाचे नाव — भरलेले नाही');
        if (ageText.trim() === '' || !Number.isInteger(age) || age < 0 || age > 120) missing.push(isEn ? 'Age — a whole number of years, 0–120' : 'वय — ० ते १२० वर्षे');
        if (!gender) missing.push(isEn ? 'Gender — not chosen' : 'लिंग — निवडलेले नाही');
        if (!village.trim()) missing.push(isEn ? 'Village — not entered' : 'गाव — भरलेले नाही');
        const intake = readIntake(draft);
        missing.push(...intake.problems.map(p => p.message));
        if (missing.length > 0 || !intake.vitals || !facility || !gender) {
            setFormProblems(missing);
            toast.error(isEn ? `Complete the record first (${missing.length} item${missing.length === 1 ? '' : 's'})` : `आधी नोंद पूर्ण करा (${missing.length})`);
            return;
        }
        setFormProblems([]);
        const vitals = intake.vitals;
        const patientGender = gender;
        setIsAnalyzing(true);

        setTimeout(async () => {
            const result = await classifyTriage(vitals);
            setTriageResult(result);

            // Generate OPD Token
            const tokenPrefix = result.status === 'RED' ? 'EMG' : result.status === 'YELLOW' ? 'URG' : 'GEN';
            const tokenNum = nextTokenNumber(useQueueStore.getState().queue, facility.id, tokenPrefix);
            setGeneratedToken(tokenNum);

            // Save Patient Record into Zustand & IndexedDB
            const newPatId = patientId || `PAT-${uuidv4().substring(0, 8).toUpperCase()}`;
            const newPatient: Patient = {
                id: newPatId,
                name: name.trim(),
                age,
                gender: patientGender,
                phone,
                village: village.trim(),
                // Where the registering facility is; the patient's own address
                // is the village above.
                tehsil: facility.tehsil,
                district: facility.district,
                state: DEPLOYMENT.statisticsState || undefined,
                languagePreference: language === 'hi' ? 'hi' : language === 'en' ? 'en' : 'mr',
                abhaId,
                aadhaarLast4,
                vitals,
                triageStatus: result.status,
                triagePriority: result.priority,
                gps: { lat: facility.location.lat, lng: facility.location.lng },
                timestamp: new Date().toISOString(),
                isSynced: false,
                registeredAtFacilityId: facility.id,
                ...(session ? { chw_id: session.staffId, chw_name: session.name } : {}),
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

            try {
                await addPatient(newPatient);
            } catch {
                toast.error(isEn ? 'Could not save the patient on this device — nothing was registered' : 'रुग्णाची नोंद जतन झाली नाही');
                setIsAnalyzing(false);
                return;
            }
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
                facilityId: facility.id,
                facilityName: facility.name,
                registeredAt: new Date().toISOString(),
                priority: result.priority,
                chiefComplaint: vitals.injuryType || (isEn ? 'Not recorded' : 'नोंद नाही'),
                status: 'WAITING',
                roomNo: result.status === 'RED' ? 'Emergency stabilisation' : facility.type === 'SC' ? 'Sub-Centre consultation (ANM / CHO)' : 'Medical Officer OPD',
                consultingDoctor: facility.medicalOfficerInCharge ?? 'Medical Officer',
                estimatedWaitMinutes: result.status === 'RED' ? 0 : result.status === 'YELLOW' ? 8 : 25,
            };
            addQueueEntry(queueItem);

            // RED: raise the emergency referral at once. It goes to the facility
            // above this one unless that facility's reported beds, equipment or
            // specialists show it cannot take this patient — then to the nearest
            // that can (the same rule as the referral form). Saved here first; it
            // shows as Sent only when the network confirms.
            const reason = `${result.recommendedAction} — severe vitals (SpO2 ${vitals.spo2}%, BP ${vitals.bloodPressure?.systolic ?? '—'}/${vitals.bloodPressure?.diastolic ?? '—'}). ${vitals.injuryType || ''}`.trim();
            const parent = facility
                ? defaultReferralTarget(referralTargets(requirementsFor({ reason, priority: 'EMERGENCY', vitals, patientAge: age }), facility, FACILITY_NETWORK, availabilityOf), facility)?.facility
                : undefined;
            if (result.status === 'RED' && session && facility && parent && can(session.role, 'referral:create')) {
                const referral = await createReferral(
                    {
                        patient: { id: newPatId, name: name.trim(), age, gender: patientGender },
                        from: { id: facility.id, name: facility.name, type: facility.type },
                        to: { id: parent.id, name: parent.name, type: parent.type },
                        reason,
                        priority: 'EMERGENCY',
                        // Mothers and newborns travel on the 102 Janani Shishu service.
                        transportMode: vitals.isPregnant ? 'AMBULANCE_102' : 'AMBULANCE_108',
                        vitals,
                    },
                    session
                );
                if (referral.ok) {
                    toast.error(isEn ? `RED: emergency referral ${referral.value.id} raised to ${parent.name}` : `अति तातडीचे: ${parent.name} येथे संदर्भ पाठवला`, { duration: 7000 });
                } else {
                    toast.error(isEn ? `RED patient — the referral could not be raised: ${referral.message}. Refer by phone.` : `संदर्भ तयार झाला नाही: ${referral.message}`, { duration: 9000 });
                }
            } else if (result.status === 'RED') {
                toast.error(isEn ? 'RED patient — raise a referral from the Referrals screen now' : 'अति तातडीचे: संदर्भ सेवा स्क्रीनवरून संदर्भ पाठवा', { duration: 7000 });
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
                        <form onSubmit={handleRunTriage} noValidate className="lg:col-span-7 space-y-4">
                            {/* Section 1: Demographics Fieldset */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>{L.sec1Title}</span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded">
                                        FHIR R4 Ready
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label htmlFor="opd-name" className="block font-bold text-slate-700 mb-1">
                                                {L.fullName} <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                id="opd-name"
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1F3A6E]"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label htmlFor="opd-age" className="block font-bold text-slate-700 mb-1">
                                                    {L.ageLabel} <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                id="opd-age"
                                                    type="number"
                                                    inputMode="numeric"
                                                    required
                                                    min={0}
                                                    max={120}
                                                    value={ageText}
                                                    onChange={(e) => setAgeText(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-bold focus:outline-none focus:border-[#1F3A6E]"
                                                />
                                            </div>
                                            <div>
                                                <span id="opd-gender" className="block font-bold text-slate-700 mb-1">
                                                    {L.genderLabel} <span className="text-red-600">*</span>
                                                </span>
                                                <div className="flex border border-slate-300 rounded overflow-hidden" role="radiogroup" aria-labelledby="opd-gender">
                                                    {(['M', 'F', 'O'] as const).map((g) => (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={gender === g}
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
                                            <label htmlFor="opd-abha" className="block font-bold text-slate-700 mb-1">
                                                {L.abhaLabel}
                                            </label>
                                            <input
                                                id="opd-abha"
                                                type="text"
                                                value={abhaId}
                                                onChange={(e) => setAbhaId(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-[#1F3A6E]"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="opd-village" className="block font-bold text-slate-700 mb-1">
                                                {L.villageLabel} <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                id="opd-village"
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
                                                checked={draft.pregnant}
                                                onChange={(e) => setField('pregnant', e.target.checked)}
                                                className="w-4 h-4 accent-red-700"
                                            />
                                            <span>{L.ancCohort}</span>
                                        </label>
                                        {draft.pregnant && (
                                            <label className="flex items-center gap-1.5 font-bold text-red-900">
                                                {isEn ? 'Weeks' : isHi ? 'सप्ताह' : 'आठवडे'}
                                                <input type="number" inputMode="numeric" min={4} max={44} value={draft.gestationalWeeks}
                                                    onChange={(e) => setField('gestationalWeeks', e.target.value)}
                                                    className="w-16 px-2 py-1 bg-white border border-red-200 rounded font-mono" />
                                            </label>
                                        )}

                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                                            <input
                                                type="checkbox"
                                                checked={draft.child}
                                                onChange={(e) => setField('child', e.target.checked)}
                                                className="w-4 h-4 accent-amber-700"
                                            />
                                            <span>{L.childCohort}</span>
                                        </label>
                                        {draft.child && (
                                            <label className="flex items-center gap-1.5 font-bold text-amber-900">
                                                {isEn ? 'Age in months' : isHi ? 'आयु (महीने)' : 'वय (महिने)'} <span className="text-red-600">*</span>
                                                <input type="number" inputMode="numeric" min={0} max={60} required value={draft.childAgeMonths}
                                                    onChange={(e) => setField('childAgeMonths', e.target.value)}
                                                    className="w-16 px-2 py-1 bg-white border border-amber-200 rounded font-mono" />
                                            </label>
                                        )}
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
                                        <VitalInput label={L.spo2Label} unit="%" value={draft.spo2} onChange={v => setField('spo2', v)} min={50} max={100} required notMeasured={L.notMeasured}
                                            severity={(n => n === undefined ? undefined : n < 90 ? 'critical' : n < 95 ? 'caution' : undefined)(num(draft.spo2))} />
                                        <VitalInput label={L.pulseLabel} unit="/min" value={draft.pulse} onChange={v => setField('pulse', v)} min={20} max={250} required notMeasured={L.notMeasured}
                                            severity={(n => n === undefined ? undefined : n > 130 || n < 48 ? 'critical' : n > 105 ? 'caution' : undefined)(num(draft.pulse))} />

                                        {/* Blood Pressure — both numbers, never one filled in for the worker. */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <span className="font-bold text-slate-700 uppercase text-[11px] block mb-1">
                                                {L.bpLabel} <span className="text-red-600">*</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    aria-label="Systolic"
                                                    placeholder={isEn ? 'Systolic' : 'सिस्टोलिक'}
                                                    required
                                                    min={50}
                                                    max={260}
                                                    value={draft.systolic}
                                                    onChange={(e) => setField('systolic', e.target.value)}
                                                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base text-[#1F3A6E]"
                                                />
                                                <span className="text-slate-400 font-bold">/</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    aria-label="Diastolic"
                                                    placeholder={isEn ? 'Diastolic' : 'डायस्टोलिक'}
                                                    required
                                                    min={20}
                                                    max={180}
                                                    value={draft.diastolic}
                                                    onChange={(e) => setField('diastolic', e.target.value)}
                                                    className="w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base text-[#1F3A6E]"
                                                />
                                            </div>
                                        </div>

                                        {/* Respiratory Rate — a trained triage input with critical thresholds
                                            (>=36 or <=8 /min), so it must be captured at intake. */}
                                        <VitalInput label={L.rrLabel} unit="/min" value={draft.respiratoryRate} onChange={v => setField('respiratoryRate', v)} min={4} max={80} required notMeasured={L.notMeasured}
                                            severity={(n => n === undefined ? undefined : n >= 36 || n <= 8 ? 'critical' : n >= 27 ? 'caution' : undefined)(num(draft.respiratoryRate))} />
                                        <VitalInput label={L.tempLabel} unit="°F" step="0.1" value={draft.temperature} onChange={v => setField('temperature', v)} min={90} max={110} notMeasured={L.notMeasured}
                                            severity={(n => n !== undefined && n >= 102.5 ? 'critical' : undefined)(num(draft.temperature))} />
                                        <VitalInput label={L.glucoseLabel} unit="mg/dL" value={draft.glucose} onChange={v => setField('glucose', v)} min={20} max={700} notMeasured={L.notMeasured}
                                            severity={(n => n === undefined ? undefined : n <= 55 || n >= 280 ? 'critical' : n >= 180 ? 'caution' : undefined)(num(draft.glucose))} />

                                        {/* Consciousness (AVPU) — drives the critical override for altered
                                            sensorium, so the worker chooses it; nothing is pre-selected. */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded sm:col-span-2">
                                            <span className="font-bold text-slate-700 uppercase text-[11px] block mb-1">
                                                {L.avpuLabel} <span className="text-red-600">*</span>
                                            </span>
                                            <div className="flex border border-slate-300 rounded overflow-hidden" role="radiogroup" aria-label={L.avpuLabel}>
                                                {([
                                                    ['ALERT', L.avpuAlert],
                                                    ['VOICE', L.avpuVoice],
                                                    ['PAIN', L.avpuPain],
                                                    ['UNRESPONSIVE', L.avpuUnresponsive],
                                                ] as const).map(([level, text]) => (
                                                    <button
                                                        key={level}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={draft.avpu === level}
                                                        onClick={() => setField('avpu', level as Avpu)}
                                                        className={`flex-1 py-1.5 text-[11px] font-bold transition-colors ${
                                                            draft.avpu === level
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
                                                    disabled={isTranscribing}
                                                    title={engine === 'BHASHINI' ? 'Speech recognition by Bhashini (Government of India)' : 'Speech recognition by this browser'}
                                                    onClick={() => (isListening ? stopListening() : startListening(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN'))}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 disabled:opacity-60 ${
                                                        isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    <Icon name="mic" className="w-3 h-3" />
                                                    {isTranscribing ? (isEn ? 'Transcribing…' : isHi ? 'लिख रहे हैं…' : 'लिहित आहे…') : isListening ? (engine === 'BHASHINI' ? (isEn ? 'Stop & transcribe' : isHi ? 'रोकें' : 'थांबा') : L.voiceListening) : L.voicePrompt}
                                                    {engine === 'BHASHINI' && <span className="font-normal opacity-80">· Bhashini</span>}
                                                </button>
                                            )}
                                        </div>
                                        {voiceError && (
                                            <p role="alert" className="text-[11px] text-red-700 mb-1">{voiceError}</p>
                                        )}
                                        <textarea
                                            rows={2}
                                            value={draft.complaint}
                                            onChange={(e) => setField('complaint', e.target.value)}
                                            className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-[#1F3A6E]"
                                        />
                                    </div>

                                    {formProblems.length > 0 && (
                                        <div role="alert" className="border border-red-300 bg-red-50 p-3 text-[11px] text-red-900">
                                            <strong className="block mb-1">{isEn ? 'Complete these before triage:' : isHi ? 'ट्राइएज से पहले पूरा करें:' : 'ट्राइएजपूर्वी हे पूर्ण करा:'}</strong>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {formProblems.map(problem => <li key={problem}>{problem}</li>)}
                                            </ul>
                                        </div>
                                    )}

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
                                            Government OPD Token Slip • {createdPatient ? FACILITY_NETWORK.find(f => f.id === createdPatient.registeredAtFacilityId)?.name : ''}
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
                                                <strong className="text-slate-800">{createdPatient?.name} ({createdPatient?.age} {isEn ? 'Yrs' : 'वर्षे'} / {createdPatient?.gender})</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patVillageLabel}</span>
                                                <strong className="text-slate-800">{createdPatient?.village}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patAbhaLabel}</span>
                                                <strong className="text-slate-800 font-mono text-[10px]">{createdPatient?.abhaId || (isEn ? "not recorded" : "नोंद नाही")}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">{L.patRoomLabel}</span>
                                                <strong className="text-[#1F3A6E]">{triageResult.status === 'RED' ? L.roomEmergency : facility?.type === 'SC' ? L.roomSC : L.roomMO}</strong>
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
                                        <button type="button" onClick={resetForNextPatient} className="gov-btn gov-btn-secondary text-xs w-full">
                                            {isEn ? 'Register next patient' : isHi ? 'अगला मरीज़ दर्ज करें' : 'पुढील रुग्णाची नोंद करा'}
                                        </button>
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

/**
 * One vital sign, typed exactly as read off the device. Empty means not
 * measured — shown as such, never replaced by a normal value.
 */
function VitalInput({ label, unit, value, onChange, min, max, step, required, severity, notMeasured }: {
    label: string;
    unit: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    max: number;
    step?: string;
    required?: boolean;
    severity?: 'critical' | 'caution';
    notMeasured: string;
}) {
    const tone = severity === 'critical' ? 'text-red-700 font-black' : severity === 'caution' ? 'text-amber-700 font-black' : 'text-[#1F3A6E]';
    return (
        <label className="p-3 bg-slate-50 border border-slate-300 rounded block">
            <span className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-700 uppercase text-[11px]">
                    {label} {required && <span className="text-red-600">*</span>}
                </span>
                <span className="text-slate-500 text-[10px]">{value.trim() === '' ? notMeasured : unit}</span>
            </span>
            <input
                type="number"
                inputMode="decimal"
                required={required}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-base ${tone}`}
            />
        </label>
    );
}
