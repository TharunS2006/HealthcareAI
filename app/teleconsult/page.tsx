/**
 * Assisted Teleconsultation Suite — NalamMesh (e-Sanjeevani / ABDM Integration)
 * Connecting Frontline Health Workers (ASHA/CHO) with District Specialists (SIH PS#26133)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { SEED_TELECONSULT, MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { TeleconsultSession } from '@/types/facility';
import toast from 'react-hot-toast';

export default function TeleconsultPage() {
    const { patients } = usePatientStore();
    const { addReferral } = useReferralStore();

    const [session, setSession] = useState<TeleconsultSession>(SEED_TELECONSULT);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isLowBandwidth, setIsLowBandwidth] = useState(false);
    const [callDuration, setCallDuration] = useState(745); // seconds (~12m25s)
    const [specialistNotes, setSpecialistNotes] = useState(
        'Patient presents with impending preeclampsia at 32 weeks gestation. Administer Tab Labetalol 100mg stat and arrange immediate transfer via 102 Janani Shishu Ambulance.'
    );
    const [prescriptions, setPrescriptions] = useState([
        { medicine: 'Tab Labetalol', dosage: '100mg', frequency: 'Stat (Now)', duration: '1 dose' },
        { medicine: 'Inj Magnesium Sulfate (50%)', dosage: '4g IV slowly over 10 min', frequency: 'Loading Dose', duration: 'Stat under monitoring' }
    ]);
    const [newMed, setNewMed] = useState('');
    const [newDose, setNewDose] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleAddPrescription = () => {
        if (!newMed.trim()) return;
        setPrescriptions(prev => [
            ...prev,
            { medicine: newMed, dosage: newDose || 'As directed', frequency: '1-0-1', duration: '5 days' }
        ]);
        setNewMed('');
        setNewDose('');
        toast.success('Prescription item added');
    };

    const handleDispatchReferral = async () => {
        const newRef = {
            id: `ref-tele-${Math.floor(1000 + Math.random() * 9000)}`,
            patientId: session.patientId,
            patientName: session.patientName,
            patientAge: session.patientAge,
            patientGender: session.patientGender,
            fromFacilityId: session.initiatingFacilityId,
            fromFacilityName: session.initiatingFacilityName,
            fromFacilityType: 'SC' as const,
            toFacilityId: 'dh-gadchiroli',
            toFacilityName: 'District Hospital, Gadchiroli',
            toFacilityType: 'DH' as const,
            reason: `Teleconsultation Decision: ${session.reasonForConsult}`,
            priority: 'EMERGENCY' as const,
            status: 'ACCEPTED' as const,
            referredBy: `${session.specialistDoctorName} (MD)`,
            referredAt: new Date().toISOString(),
            transportMode: 'AMBULANCE_102' as const,
            clinicalSummary: specialistNotes,
        };
        await addReferral(newRef);
        toast.success(`Direct Referral created to ${newRef.toFacilityName}`);
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <MobileMenu />

                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                                    LIVE TELECONSULTATION SESSION • e-Sanjeevani ABDM Gateway
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Assisted Specialist Consultation
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold font-mono">
                                <span>🔴 {formatTimer(callDuration)}</span>
                            </div>
                            <button
                                onClick={() => {
                                    setIsLowBandwidth(!isLowBandwidth);
                                    toast(isLowBandwidth ? 'High Definition Video Enabled' : 'Low-Bandwidth 2G/3G Audio Mode Enabled');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    isLowBandwidth
                                        ? 'bg-amber-500 text-white border-amber-600'
                                        : 'bg-white text-txt-secondary border-border-subtle hover:bg-gray-50'
                                }`}
                            >
                                {isLowBandwidth ? '📶 2G Audio Mode (Active)' : '📶 Low Bandwidth Mode'}
                            </button>
                        </div>
                    </div>

                    {/* Main Teleconsult Grid */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Left Column (7 cols): Simulated Video Feed & Controls */}
                        <div className="lg:col-span-7 space-y-4">

                            {/* Video / Call Container */}
                            <div className="bg-slate-950 rounded-3xl overflow-hidden shadow-2xl relative aspect-[16/10] flex flex-col justify-between p-6 border-2 border-slate-800">

                                {/* Top Overlay Badges */}
                                <div className="flex justify-between items-center z-10">
                                    <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 text-xs text-white">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="font-bold">{session.specialistDoctorName}</span>
                                        <span className="text-slate-400 text-[10px]">({session.specialty})</span>
                                    </div>

                                    <div className="bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-full border border-slate-700 text-[10px] text-teal-300 font-mono">
                                        Sub-Centre Kothi ↔ DH Gadchiroli
                                    </div>
                                </div>

                                {/* Main Visual Video Area */}
                                <div className="my-auto text-center space-y-3">
                                    {isLowBandwidth || isVideoOff ? (
                                        <div className="w-24 h-24 rounded-full bg-teal-900/80 border-2 border-teal-500 text-teal-300 flex items-center justify-center text-4xl mx-auto shadow-inner">
                                            👩‍⚕️
                                        </div>
                                    ) : (
                                        <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 p-1 mx-auto shadow-2xl animate-pulse">
                                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-5xl">
                                                🩺
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-xl font-bold text-white tracking-wide">
                                            {session.specialistHospital}
                                        </h3>
                                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                            Connected with Frontline Worker <strong>{session.initiatorName}</strong> via NalamMesh Relay
                                        </p>
                                    </div>
                                </div>

                                {/* Inset Self Video (Frontline Health Worker) */}
                                <div className="absolute bottom-20 right-6 w-32 h-20 bg-slate-900 border-2 border-teal-500/60 rounded-xl overflow-hidden shadow-lg p-2 flex flex-col justify-between">
                                    <span className="text-[9px] font-bold text-teal-300">CHO Field Device</span>
                                    <div className="text-center text-lg">👩‍🌾</div>
                                    <span className="text-[8px] text-slate-400 truncate">Sunita Hichami</span>
                                </div>

                                {/* Call Action Bar */}
                                <div className="bg-slate-900/90 backdrop-blur p-3 rounded-2xl border border-slate-800 flex justify-center items-center gap-4 z-10">
                                    <button
                                        onClick={() => setIsMuted(!isMuted)}
                                        className={`p-3 rounded-full text-sm font-bold transition-all ${
                                            isMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                        }`}
                                    >
                                        {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
                                    </button>

                                    <button
                                        onClick={() => setIsVideoOff(!isVideoOff)}
                                        className={`p-3 rounded-full text-sm font-bold transition-all ${
                                            isVideoOff ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                        }`}
                                    >
                                        {isVideoOff ? '🚫 Start Video' : '📹 Stop Video'}
                                    </button>

                                    <button
                                        onClick={() => toast.success('Patient Vitals & Ultrasound link shared with Specialist')}
                                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-sm font-bold"
                                    >
                                        📤 Share Screen / Vitals
                                    </button>

                                    <button
                                        onClick={() => {
                                            toast.success('Consultation session concluded');
                                        }}
                                        className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold shadow-lg"
                                    >
                                        End Call
                                    </button>
                                </div>
                            </div>

                            {/* Low-Bandwidth Real-time Audio Transcript / Chat */}
                            <div className="surface-card p-4">
                                <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block mb-2">
                                    Structured Clinical Notes Stream (Low-Bandwidth Sync)
                                </span>
                                <div className="space-y-2 text-xs max-h-32 overflow-y-auto">
                                    <div className="p-2 bg-gray-50 rounded-lg">
                                        <strong className="text-emerald-deep">Dr. Priya Sharma:</strong> "Check fetal heart sounds with Doppler. Is patient experiencing visual disturbance or epigastric pain?"
                                    </div>
                                    <div className="p-2 bg-teal-50 rounded-lg">
                                        <strong className="text-teal-800">CHO Sunita (Kothi):</strong> "Yes doctor, FHR is 142 bpm. Patient complains of frontal headache and visual blurring since 2 hours."
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column (5 cols): Patient Context & Prescription Generator */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* Patient Demographics & Live Vitals */}
                            <div className="surface-card p-5 border-l-4 border-l-rose-500 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                                            High-Risk Maternal Flag
                                        </span>
                                        <h3 className="text-lg font-bold text-emerald-deep mt-1">
                                            {session.patientName}
                                        </h3>
                                        <p className="text-xs text-txt-muted">
                                            Age: {session.patientAge} • Sub-Centre Kothi • 32 Weeks ANC
                                        </p>
                                    </div>
                                    <span className="font-mono text-xs text-txt-muted">
                                        ABHA-9128-XXXX
                                    </span>
                                </div>

                                {/* Live Vitals Pill Matrix */}
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="p-2 bg-red-50 text-status-red rounded-xl font-bold border border-red-200">
                                        <span className="text-[10px] block font-normal uppercase text-txt-muted">BP (High)</span>
                                        {session.currentVitals.bloodPressure?.systolic}/{session.currentVitals.bloodPressure?.diastolic}
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded-xl font-bold border">
                                        <span className="text-[10px] block font-normal uppercase text-txt-muted">SpO2</span>
                                        {session.currentVitals.spo2}%
                                    </div>
                                    <div className="p-2 bg-amber-50 text-amber-800 rounded-xl font-bold border border-amber-200">
                                        <span className="text-[10px] block font-normal uppercase text-txt-muted">Pulse</span>
                                        {session.currentVitals.heartRate} bpm
                                    </div>
                                </div>
                            </div>

                            {/* Specialist Clinical Prescription & Actions */}
                            <div className="surface-card p-5 space-y-4">
                                <h3 className="text-xs font-bold text-emerald-deep uppercase tracking-wider">
                                    Specialist Order & Digital Prescription
                                </h3>

                                <textarea
                                    rows={3}
                                    value={specialistNotes}
                                    onChange={(e) => setSpecialistNotes(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs outline-none focus:border-teal-accent"
                                    placeholder="Doctor's clinical advice and stabilization instructions..."
                                />

                                {/* Prescription Items */}
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold text-txt-muted block">Prescribed Medications:</span>
                                    {prescriptions.map((rx, i) => (
                                        <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-xs">
                                            <div>
                                                <span className="font-bold text-emerald-deep">{rx.medicine}</span>
                                                <span className="text-[10px] text-txt-muted ml-2">({rx.dosage} • {rx.frequency})</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                                                {rx.duration}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="flex gap-2 pt-1">
                                        <input
                                            type="text"
                                            placeholder="Medicine (e.g. Tab Nifedipine)"
                                            value={newMed}
                                            onChange={(e) => setNewMed(e.target.value)}
                                            className="flex-1 p-2 bg-gray-50 border rounded-lg text-xs outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Dose"
                                            value={newDose}
                                            onChange={(e) => setNewDose(e.target.value)}
                                            className="w-24 p-2 bg-gray-50 border rounded-lg text-xs outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddPrescription}
                                            className="px-3 bg-teal-accent text-white font-bold rounded-lg text-xs"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>

                                {/* Critical Actions */}
                                <div className="space-y-2 pt-2 border-t">
                                    <button
                                        onClick={handleDispatchReferral}
                                        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-bold text-xs rounded-xl shadow hover:opacity-90 flex items-center justify-center gap-2"
                                    >
                                        <span>🚑 Authorize Immediate Referral to DH Gadchiroli</span>
                                    </button>

                                    <button
                                        onClick={() => toast.success('Teleconsultation record saved to patient profile & ABDM')}
                                        className="w-full py-2.5 bg-emerald-deep text-white font-bold text-xs rounded-xl hover:bg-emerald-dark"
                                    >
                                        ✓ Save & Finalize e-Prescription
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
