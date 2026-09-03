/**
 * OPD Registration & Edge AI Digital Triage — NalamMesh
 * Government of Maharashtra • Department of Public Health
 * Primary Health Centre Clinical Workstation (NIC / GIGW Standard)
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import QRWristband from '@/components/shared/QRWristband';
import { Vitals, Patient } from '@/types/patient';
import { QueueEntry } from '@/types/facility';
import { classifyTriage, TriageResult } from '@/lib/triage/model';
import { usePatientStore } from '@/stores/patientStore';
import { useQueueStore } from '@/stores/queueStore';
import { useReferralStore } from '@/stores/referralStore';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { downloadFHIRRecord } from '@/lib/fhir';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export default function OPDPage() {
    const { patients, addPatient } = usePatientStore();
    const { queue, addQueueEntry } = useQueueStore();
    const { addReferral } = useReferralStore();

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
        spo2: 94,
        heartRate: 104,
        bloodPressure: { systolic: 160, diastolic: 102 },
        temperature: 99.2,
        respiratoryRate: 22,
        bloodGlucose: 110,
        weight: 54,
        consciousness: 'ALERT',
        isPregnant: true,
        gestationalWeeks: 32,
        injuryType: 'Severe frontal headache, pedal edema ++, visual blurring at 32 weeks pregnancy',
    });

    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

    const voice = useVoiceInput();

    // Sync voice vitals if spoken
    useEffect(() => {
        if (voice.parsedVitals) {
            const p = voice.parsedVitals;
            setVitals(prev => ({
                ...prev,
                ...(p.spo2 !== undefined && { spo2: p.spo2 }),
                ...(p.heartRate !== undefined && { heartRate: p.heartRate }),
                ...(p.systolic !== undefined && p.diastolic !== undefined && {
                    bloodPressure: { systolic: p.systolic, diastolic: p.diastolic }
                }),
                ...(p.consciousness && { consciousness: p.consciousness }),
                ...(p.injuryType && { injuryType: p.injuryType }),
            }));
            toast.success('ध्वनी नोंदी यशस्वीपणे भरल्या (Voice vitals captured)');
        }
    }, [voice.parsedVitals]);

    // Handle Search
    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.toLowerCase();
        const found = patients.find(p =>
            p.name.toLowerCase().includes(q) ||
            p.abhaId?.toLowerCase().includes(q) ||
            p.aadhaarLast4?.includes(q) ||
            p.phone?.includes(q)
        );

        if (found) {
            setPatientId(found.id);
            setName(found.name);
            setAge(found.age);
            setGender(found.gender);
            setPhone(found.phone || '');
            setVillage(found.village);
            setAbhaId(found.abhaId || '');
            setAadhaarLast4(found.aadhaarLast4 || '');
            setVitals(found.vitals);
            toast.success(`अस्तित्वात असलेले रेकॉर्ड सापडले: ${found.name}`);
        } else {
            toast.error('माहिती सापडली नाही. नवीन नोंदणी तयार करत आहे.');
        }
    };

    // Run AI Triage Analysis & Issue Token
    const handleRunTriage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAnalyzing(true);

        try {
            const result = await classifyTriage(vitals);
            setTriageResult(result);

            // Generate token number
            const seq = queue.length + 41;
            const token = `T-0${seq}`;
            setGeneratedToken(token);

            const pId = patientId || `p-${uuidv4().slice(0, 8)}`;
            const newPatient: Patient = {
                id: pId,
                abhaId: abhaId || `ABHA-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
                aadhaarLast4,
                name: name.trim() || 'अनामिक रुग्ण (Anonymous)',
                age: Number(age) || 30,
                gender,
                phone,
                village,
                tehsil: 'Bhamragad',
                district: 'Gadchiroli',
                state: 'Maharashtra',
                vitals,
                triageStatus: result.status,
                triagePriority: result.priority,
                transportStatus: result.status === 'RED' ? 'IN_TRANSIT' : 'PENDING',
                gps: { lat: 19.4678, lng: 80.3789 },
                isSynced: true,
                timestamp: new Date().toISOString(),
                chw_name: 'Lakshmi Netam (ASHA)',
                notes: result.recommendedAction,
            };

            await addPatient(newPatient);
            setCreatedPatient(newPatient);

            // Add to live queue
            const newQueueEntry: QueueEntry = {
                id: `q-${uuidv4().slice(0, 6)}`,
                tokenNumber: token,
                sequence: seq,
                patientId: pId,
                patientName: newPatient.name,
                patientAge: newPatient.age,
                patientGender: newPatient.gender,
                facilityId: 'phc-bhamragad',
                facilityName: 'PHC Bhamragad',
                registeredAt: new Date().toISOString(),
                priority: result.priority,
                chiefComplaint: vitals.injuryType || 'सर्वसाधारण तपासणी (General OPD)',
                status: 'WAITING',
                estimatedWaitMinutes: result.priority === 'EMERGENCY' ? 2 : result.priority === 'URGENT' ? 10 : 25,
            };
            await addQueueEntry(newQueueEntry);

            // If RED, auto-create a referral recommendation in pipeline
            if (result.status === 'RED') {
                const newRef = {
                    id: `ref-${Math.floor(1000 + Math.random() * 9000)}`,
                    patientId: pId,
                    patientName: newPatient.name,
                    patientAge: newPatient.age,
                    patientGender: newPatient.gender,
                    fromFacilityId: 'phc-bhamragad',
                    fromFacilityName: 'PHC Bhamragad',
                    fromFacilityType: 'PHC' as const,
                    toFacilityId: result.recommendedFacilityTier === 'DH' ? 'dh-gadchiroli' : 'chc-etapalli',
                    toFacilityName: result.recommendedFacilityTier === 'DH' ? 'District Hospital Gadchiroli' : 'CHC Etapalli',
                    toFacilityType: result.recommendedFacilityTier,
                    reason: `${vitals.injuryType} — AI Flagged ${result.priority}`,
                    priority: result.priority,
                    status: 'INITIATED' as const,
                    referredBy: 'Dr. Suresh Atram (MO)',
                    referredAt: new Date().toISOString(),
                    transportMode: vitals.isPregnant ? 'AMBULANCE_102' as const : 'AMBULANCE_108' as const,
                    clinicalSummary: result.reasoning,
                };
                await addReferral(newRef);
                toast.error(`तातडीचा संदर्भ (EMERGENCY REFERRAL): ${newRef.toFacilityName} येथे पाठवले`, { duration: 6000 });
            } else {
                toast.success(`ट्राइएज पूर्ण: ${result.status} | ओपीडी टोकन ${token} जारी केले`);
            }
        } catch (err) {
            console.error('Triage failed:', err);
            toast.error('ट्राइएज वर्गीकरण अयशस्वी झाले');
        } finally {
            setIsAnalyzing(false);
        }
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
                                <span>सार्वजनिक आरोग्य विभाग • प्राथमिक आरोग्य केंद्र, भामरागड</span>
                                <span className="text-slate-400">|</span>
                                <span className="text-emerald-700 font-extrabold">IPHS 2022 मानके</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">
                                ओपीडी रुग्ण नोंदणी व डिजिटल ट्राइएज कक्ष
                            </h1>
                            <p className="text-xs text-slate-600">
                                OPD Registration & Clinical Intake • Government of Maharashtra • ABDM Integrated
                            </p>
                        </div>

                        {/* Search Patient Bar */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-72">
                                <input
                                    type="text"
                                    placeholder="ABHA ID / आधार क्रमांक / नाव शोधा..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-1.5 pl-8 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white focus:outline-none focus:border-[#1F3A6E]"
                                />
                                <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-3 py-1.5 bg-[#1F3A6E] text-white text-xs font-bold rounded hover:bg-[#16294E] transition-colors"
                            >
                                शोधा (Search)
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-12 gap-5">
                        {/* Left Column (7 cols): Official Medical Intake Form */}
                        <form onSubmit={handleRunTriage} className="lg:col-span-7 space-y-4">
                            {/* Section 1: Demographics Fieldset */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>१. रुग्णाची प्राथमिक माहिती (Patient Demographics & ABHA)</span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded">
                                        ABDM M1 Ready
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">
                                                रुग्णाचे पूर्ण नाव (Full Name) <span className="text-red-600">*</span>
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
                                                    वय (Age) <span className="text-red-600">*</span>
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
                                                    लिंग (Gender) <span className="text-red-600">*</span>
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
                                                            {g === 'M' ? 'पु' : g === 'F' ? 'स्त्री' : 'इतर'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">
                                                आयुष्मान भारत (ABHA ID)
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
                                                गाव / पाडा (Village / Hamlet) <span className="text-red-600">*</span>
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
                                            <span>🤰 गरोदर माता / ANC ({vitals.gestationalWeeks || 32} आठवडे)</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                                            <input
                                                type="checkbox"
                                                checked={!!vitals.childAgeMonths}
                                                onChange={(e) => setVitals({ ...vitals, childAgeMonths: e.target.checked ? 18 : undefined })}
                                                className="w-4 h-4 accent-amber-700"
                                            />
                                            <span>👶 बालक (&lt; ५ वर्षे कुपोषण तपासणी)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Clinical Vitals */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>२. वैद्यकीय तपासणी व महत्त्वपूर्ण नोंदी (Physiological Vitals)</span>
                                    <span className="text-[10px] text-slate-500 font-bold">
                                        थेट सेन्सर / मॅन्युअल नोंदणी
                                    </span>
                                </div>

                                <div className="p-4 space-y-4 text-xs">
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {/* SpO2 */}
                                        <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-700 uppercase text-[11px]">
                                                    SpO2 (ऑक्सिजन प्रमाण)
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
                                                    नाडीचे ठोके (Pulse / BPM)
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
                                                रक्तदाब / Blood Pressure (mmHg)
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
                                                    रक्तातील साखर (Glucose)
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
                                    </div>

                                    {/* Chief Complaint / Symptoms */}
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">
                                            मुख्य तक्रार व आजाराची लक्षणे (Chief Complaint & Clinical Presentation)
                                        </label>
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
                                            <span>विश्लेषण चालू आहे (Evaluating Triage)...</span>
                                        ) : (
                                            <span>✓ एआय ट्राइएज विश्लेषण करा व ओपीडी टोकन द्या</span>
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
                                            महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग
                                        </span>
                                        <h3 className="text-sm font-black">
                                            अधिकृत ओपीडी नोंदणी व ट्राइएज पावती
                                        </h3>
                                        <span className="text-[10px] text-slate-300">
                                            Government OPD Token Slip • PHC Bhamragad
                                        </span>
                                    </div>

                                    <div className="p-4 space-y-3 text-xs bg-[#FAFBFD]">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <div>
                                                <span className="text-slate-500 block text-[10px] uppercase font-bold">टोकन क्रमांक / Token</span>
                                                <strong className="text-2xl font-mono font-black text-[#1F3A6E]">{generatedToken}</strong>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-slate-500 block text-[10px] uppercase font-bold">ट्राइएज प्राधान्य</span>
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
                                                <span className="text-slate-500 block">रुग्णाचे नाव:</span>
                                                <strong className="text-slate-800">{name} ({age} वर्षे / {gender})</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">गाव:</span>
                                                <strong className="text-slate-800">{village}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">ABHA क्रमांक:</span>
                                                <strong className="text-slate-800 font-mono text-[10px]">{abhaId}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">तपासणी कक्ष:</span>
                                                <strong className="text-[#1F3A6E]">कक्ष क्र. २ (MO OPD)</strong>
                                            </div>
                                        </div>

                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-snug">
                                            <strong>वैद्यकीय कृती शिफारस:</strong> {triageResult.recommendedAction}
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowQR(true)}
                                                className="gov-btn gov-btn-secondary text-xs flex-1"
                                            >
                                                🖨️ QR रिस्टबँड
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => createdPatient && downloadFHIRRecord(createdPatient)}
                                                className="gov-btn gov-btn-primary text-xs flex-1"
                                            >
                                                📥 FHIR R4 JSON
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="gov-card p-4 text-center text-xs text-slate-500 space-y-2">
                                    <span className="text-2xl block">📋</span>
                                    <strong className="text-slate-700 block text-xs">
                                        ट्राइएज विश्लेषण प्रतिक्षा
                                    </strong>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        डाव्या बाजूला रुग्णाची लक्षणे व नोंदी भरून &quot;एआय ट्राइएज विश्लेषण&quot; बटणावर क्लिक करा. सिस्टीम तात्काळ धोक्याचे वर्गीकरण व अधिकृत ओपीडी टोकन जारी करेल.
                                    </p>
                                </div>
                            )}

                            {/* Official Live Queue Table (NIC Style) */}
                            <div className="gov-card">
                                <div className="gov-card-header flex items-center justify-between">
                                    <span>दैनिक ओपीडी रांग फलक (Live OPD Queue Board)</span>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                        थेट अद्ययावत
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="gov-table">
                                        <thead>
                                            <tr>
                                                <th>टोकन</th>
                                                <th>रुग्ण</th>
                                                <th>प्राधान्य</th>
                                                <th>वेळ</th>
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
                                                    <td className="text-slate-500">{q.estimatedWaitMinutes} मि.</td>
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
                                    <strong className="text-xs font-bold text-[#1F3A6E]">रुग्ण ओळख QR रिस्टबँड</strong>
                                    <button onClick={() => setShowQR(false)} className="text-xs font-bold text-slate-500">✕ बंद करा</button>
                                </div>
                                <QRWristband patient={createdPatient} />
                                <button
                                    onClick={() => window.print()}
                                    className="gov-btn gov-btn-primary w-full text-xs"
                                >
                                    🖨️ प्रिंट काढा (Print)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
