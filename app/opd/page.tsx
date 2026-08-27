/**
 * OPD Registration & Edge AI Digital Triage — NalamMesh
 * Frontline Worker / PHC Intake Flow (SIH PS#26133)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import QRWristband from '@/components/shared/QRWristband';
import { Vitals, Patient, TriageStatus, TriagePriority } from '@/types/patient';
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
    const [village, setVillage] = useState('Kothi');
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
            toast.success('Voice vitals captured and auto-filled');
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
            toast.success(`Found existing longitudinal record for ${found.name}`);
        } else {
            toast.error('No matching record found. Creating new entry.');
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
                name: name.trim() || 'Anonymous Patient',
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
                chiefComplaint: vitals.injuryType || 'General Consultation',
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
                toast.error(`CRITICAL TRIAGE: Auto-initiated Referral to ${newRef.toFacilityName}`, { duration: 6000 });
            } else {
                toast.success(`Triage complete: ${result.status} Priority | Token ${token} generated`);
            }
        } catch (err) {
            console.error('Triage failed:', err);
            toast.error('AI Triage classification failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <MobileMenu />

                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                                    Primary Health Centre • Bhamragad
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                OPD Registration & Digital Triage
                            </h1>
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-80">
                                <input
                                    type="text"
                                    placeholder="Search ABHA ID / Aadhaar / Name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-4 py-2 pl-9 bg-white border border-border-subtle rounded-xl text-sm focus:outline-none focus:border-teal-accent shadow-sm"
                                />
                                <svg className="w-4 h-4 text-txt-muted absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-4 py-2 bg-emerald-deep text-white text-sm font-bold rounded-xl hover:bg-emerald-dark transition-all"
                            >
                                Search
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Left Column (7 cols): Patient Details & Vitals Capture */}
                        <form onSubmit={handleRunTriage} className="lg:col-span-7 space-y-6">

                            {/* Section 1: Demographics Card */}
                            <div className="surface-card p-6 border-l-4 border-l-teal-accent">
                                <h2 className="text-base font-bold text-emerald-deep mb-4 flex items-center justify-between">
                                    <span>1. Patient Demographics (ABDM Linked)</span>
                                    <span className="text-xs font-normal text-txt-muted bg-gray-100 px-2 py-0.5 rounded">
                                        Gadchiroli District
                                    </span>
                                </h2>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-txt-muted uppercase block mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full p-2.5 bg-gray-50/70 border border-border-subtle rounded-xl text-sm font-semibold text-emerald-deep outline-none focus:border-teal-accent"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-bold text-txt-muted uppercase block mb-1">Age</label>
                                            <input
                                                type="number"
                                                required
                                                value={age}
                                                onChange={(e) => setAge(Number(e.target.value))}
                                                className="w-full p-2.5 bg-gray-50/70 border border-border-subtle rounded-xl text-sm font-semibold outline-none focus:border-teal-accent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-txt-muted uppercase block mb-1">Gender</label>
                                            <div className="flex rounded-xl overflow-hidden border border-border-subtle bg-gray-50/70">
                                                {(['M', 'F', 'O'] as const).map((g) => (
                                                    <button
                                                        key={g}
                                                        type="button"
                                                        onClick={() => setGender(g)}
                                                        className={`flex-1 py-2 text-xs font-bold transition-all ${
                                                            gender === g ? 'bg-emerald-deep text-white' : 'text-txt-secondary hover:bg-gray-200/50'
                                                        }`}
                                                    >
                                                        {g}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-txt-muted uppercase block mb-1">ABHA Health ID</label>
                                        <input
                                            type="text"
                                            value={abhaId}
                                            onChange={(e) => setAbhaId(e.target.value)}
                                            placeholder="ABHA-XXXX-XXXX-XXXX"
                                            className="w-full p-2.5 bg-gray-50/70 border border-border-subtle rounded-xl text-sm font-mono outline-none focus:border-teal-accent"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-txt-muted uppercase block mb-1">Village / Sub-Centre</label>
                                        <input
                                            type="text"
                                            value={village}
                                            onChange={(e) => setVillage(e.target.value)}
                                            placeholder="e.g. Kothi / Govindpur"
                                            className="w-full p-2.5 bg-gray-50/70 border border-border-subtle rounded-xl text-sm font-semibold outline-none focus:border-teal-accent"
                                        />
                                    </div>
                                </div>

                                {/* High-Risk Checkboxes */}
                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap text-xs">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                                        <input
                                            type="checkbox"
                                            checked={vitals.isPregnant}
                                            onChange={(e) => setVitals({ ...vitals, isPregnant: e.target.checked })}
                                            className="w-4 h-4 accent-rose-600 rounded"
                                        />
                                        <span>🤰 Pregnant / Maternal ANC ({vitals.gestationalWeeks || 32}w)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                        <input
                                            type="checkbox"
                                            checked={!!vitals.childAgeMonths}
                                            onChange={(e) => setVitals({ ...vitals, childAgeMonths: e.target.checked ? 18 : undefined })}
                                            className="w-4 h-4 accent-amber-600 rounded"
                                        />
                                        <span>👶 Child (&lt; 5 Years)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Section 2: Physiological Vitals */}
                            <div className="surface-card p-6 border-l-4 border-l-indigo-500">
                                <h2 className="text-base font-bold text-emerald-deep mb-4 flex items-center justify-between">
                                    <span>2. Physiological Vital Signs</span>
                                    <span className="text-xs text-txt-muted">Real-time edge analysis</span>
                                </h2>

                                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                                    {/* SpO2 */}
                                    <div className="bg-gray-50/80 p-4 rounded-xl border border-border-subtle">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-txt-muted uppercase">SpO2 (Oxygen Saturation)</span>
                                            <span className={`text-2xl font-bold font-mono ${vitals.spo2 < 90 ? 'text-status-red' : vitals.spo2 < 95 ? 'text-status-yellow' : 'text-emerald-deep'}`}>
                                                {vitals.spo2}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="60"
                                            max="100"
                                            value={vitals.spo2}
                                            onChange={(e) => setVitals({ ...vitals, spo2: Number(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-accent"
                                        />
                                    </div>

                                    {/* Heart Rate */}
                                    <div className="bg-gray-50/80 p-4 rounded-xl border border-border-subtle">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-txt-muted uppercase">Pulse Rate (BPM)</span>
                                            <span className={`text-2xl font-bold font-mono ${vitals.heartRate > 110 || vitals.heartRate < 50 ? 'text-status-red' : 'text-emerald-deep'}`}>
                                                {vitals.heartRate}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="40"
                                            max="180"
                                            value={vitals.heartRate}
                                            onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-status-red"
                                        />
                                    </div>

                                    {/* Blood Pressure */}
                                    <div className="bg-gray-50/80 p-4 rounded-xl border border-border-subtle">
                                        <span className="text-xs font-bold text-txt-muted uppercase block mb-2">Blood Pressure (mmHg)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                placeholder="Sys"
                                                value={vitals.bloodPressure?.systolic}
                                                onChange={(e) => setVitals({
                                                    ...vitals,
                                                    bloodPressure: {
                                                        systolic: Number(e.target.value),
                                                        diastolic: vitals.bloodPressure?.diastolic || 80
                                                    }
                                                })}
                                                className="w-full p-2 bg-white border border-border-subtle rounded-lg text-center font-mono font-bold text-lg text-emerald-deep"
                                            />
                                            <span className="text-txt-muted font-bold">/</span>
                                            <input
                                                type="number"
                                                placeholder="Dia"
                                                value={vitals.bloodPressure?.diastolic}
                                                onChange={(e) => setVitals({
                                                    ...vitals,
                                                    bloodPressure: {
                                                        systolic: vitals.bloodPressure?.systolic || 120,
                                                        diastolic: Number(e.target.value)
                                                    }
                                                })}
                                                className="w-full p-2 bg-white border border-border-subtle rounded-lg text-center font-mono font-bold text-lg text-emerald-deep"
                                            />
                                        </div>
                                    </div>

                                    {/* Blood Glucose */}
                                    <div className="bg-gray-50/80 p-4 rounded-xl border border-border-subtle">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-txt-muted uppercase">Random Blood Glucose</span>
                                            <span className="text-xs text-txt-muted">mg/dL</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={vitals.bloodGlucose || 100}
                                            onChange={(e) => setVitals({ ...vitals, bloodGlucose: Number(e.target.value) })}
                                            className="w-full p-2 bg-white border border-border-subtle rounded-lg text-center font-mono font-bold text-lg text-emerald-deep"
                                        />
                                    </div>
                                </div>

                                {/* AVPU Consciousness */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-txt-muted uppercase block mb-2">Consciousness (AVPU)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'] as const).map((level) => (
                                            <button
                                                key={level}
                                                type="button"
                                                onClick={() => setVitals({ ...vitals, consciousness: level })}
                                                className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                                                    vitals.consciousness === level
                                                        ? 'bg-emerald-deep text-white border-emerald-deep shadow-sm'
                                                        : 'bg-white text-txt-secondary border-border-subtle hover:border-emerald-200'
                                                }`}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Clinical Symptoms & Voice Input */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-txt-muted uppercase">Chief Complaint & Clinical Symptoms</label>
                                        <button
                                            type="button"
                                            onClick={() => voice.isListening ? voice.stopListening() : voice.startListening('mr')}
                                            className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all ${
                                                voice.isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-teal-50 text-teal-700 border border-teal-200'
                                            }`}
                                        >
                                            <span>🎙️</span>
                                            <span>{voice.isListening ? 'Listening (मराठी/EN)...' : 'Voice Input'}</span>
                                        </button>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={vitals.injuryType}
                                        onChange={(e) => setVitals({ ...vitals, injuryType: e.target.value })}
                                        placeholder="Describe symptoms (e.g. fever, headache, convulsions, chest pain, pregnancy distress)..."
                                        className="w-full p-3 bg-gray-50/70 border border-border-subtle rounded-xl text-sm font-medium outline-none focus:border-teal-accent"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isAnalyzing}
                                className="w-full py-4 bg-gradient-to-r from-emerald-deep to-teal-accent text-white text-base font-bold rounded-xl shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Running Neural Network Triage...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>⚡ Run AI Triage & Generate OPD Token</span>
                                        <span>→</span>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Right Column (5 cols): AI Triage Result & Token Display */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* Triage Decision Banner */}
                            <AnimatePresence>
                                {triageResult ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`surface-card p-6 border-t-4 ${
                                            triageResult.status === 'RED'
                                                ? 'border-t-status-red bg-rose-50/30'
                                                : triageResult.status === 'YELLOW'
                                                ? 'border-t-status-yellow bg-amber-50/30'
                                                : 'border-t-status-green bg-emerald-50/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider ${
                                                triageResult.status === 'RED' ? 'bg-red-100 text-red-800' :
                                                triageResult.status === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                                {triageResult.status} — {triageResult.priority}
                                            </span>
                                            <span className="text-xs font-mono text-txt-muted">
                                                Confidence: {(triageResult.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-emerald-deep mb-2">
                                            {triageResult.status === 'RED' ? '🚨 Immediate Emergency Intervention' :
                                             triageResult.status === 'YELLOW' ? '⚠️ Urgent Doctor Evaluation' :
                                             '✅ Routine Primary Care'}
                                        </h3>

                                        <p className="text-xs text-txt-secondary leading-relaxed mb-4">
                                            {triageResult.reasoning}
                                        </p>

                                        {/* Recommended Action */}
                                        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 mb-4 shadow-sm">
                                            <span className="text-[10px] font-bold text-teal-800 uppercase block mb-1">
                                                Recommended Facility Tier & Action:
                                            </span>
                                            <p className="text-xs font-semibold text-emerald-deep">
                                                🏥 Tier: {triageResult.recommendedFacilityTier} ({
                                                    triageResult.recommendedFacilityTier === 'DH' ? 'District Hospital Gadchiroli' :
                                                    triageResult.recommendedFacilityTier === 'CHC' ? 'CHC Etapalli' : 'PHC Bhamragad'
                                                })
                                            </p>
                                            <p className="text-xs text-txt-muted mt-1">
                                                {triageResult.recommendedAction}
                                            </p>
                                        </div>

                                        {/* Token Banner */}
                                        {generatedToken && (
                                            <div className="bg-emerald-deep text-white p-4 rounded-xl text-center shadow-md">
                                                <span className="text-xs font-medium uppercase tracking-widest block text-teal-200">
                                                    Issued OPD Token
                                                </span>
                                                <div className="text-4xl font-extrabold font-mono tracking-tight my-1">
                                                    {generatedToken}
                                                </div>
                                                <span className="text-xs text-teal-100">
                                                    Room 2 • Est. Wait: {triageResult.priority === 'EMERGENCY' ? 'Direct Override' : '15 min'}
                                                </span>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowQR(!showQR)}
                                                className="py-2.5 px-3 bg-white border border-border-subtle rounded-xl text-xs font-bold text-emerald-deep hover:bg-gray-50 flex items-center justify-center gap-1.5"
                                            >
                                                <span>🏷️</span>
                                                <span>{showQR ? 'Hide Wristband' : 'QR Wristband'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (createdPatient) {
                                                        downloadFHIRRecord(createdPatient);
                                                        toast.success('ABDM / FHIR R4 Bundle Downloaded');
                                                    }
                                                }}
                                                className="py-2.5 px-3 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 flex items-center justify-center gap-1.5"
                                            >
                                                <span>📄</span>
                                                <span>Export FHIR</span>
                                            </button>
                                        </div>

                                        {showQR && createdPatient && (
                                            <div className="mt-4">
                                                <QRWristband patient={createdPatient} />
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="surface-card p-8 text-center text-txt-muted border-dashed border-2">
                                        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                                            🩺
                                        </div>
                                        <h3 className="font-bold text-sm text-emerald-deep">AI Decision Support Ready</h3>
                                        <p className="text-xs text-txt-muted mt-1 max-w-xs mx-auto">
                                            Complete demographics & vitals on the left, then click 'Run AI Triage' to evaluate risk priority.
                                        </p>
                                    </div>
                                )}
                            </AnimatePresence>

                            {/* Recent Queue Snippet */}
                            <div className="surface-card p-5">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-emerald-deep uppercase tracking-wider">
                                        Live Queue • PHC Bhamragad
                                    </h3>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                        {queue.filter(q => q.status === 'WAITING').length} Waiting
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {queue.slice(0, 4).map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between p-2.5 bg-gray-50/70 rounded-lg text-xs">
                                            <div className="flex items-center gap-2.5">
                                                <span className="font-mono font-bold text-emerald-deep bg-white px-2 py-1 rounded border border-gray-200">
                                                    {entry.tokenNumber}
                                                </span>
                                                <div>
                                                    <p className="font-semibold text-emerald-deep">{entry.patientName}</p>
                                                    <p className="text-[10px] text-txt-muted truncate max-w-[140px]">{entry.chiefComplaint}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                                                entry.priority === 'URGENT' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                                {entry.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
