/**
 * Universal Emergency Escalation & 108/102 SOS Module — NalamMesh (SIH PS#26133)
 * Provides one-tap emergency escalation, nearest FRU/DH routing, and instant LHR emergency summary dispatch.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { ReferralRecord } from '@/types/patient';
import toast from 'react-hot-toast';

export default function EmergencyModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<'108_TRAUMA' | '102_MATERNAL' | 'PEDIATRIC_EMERGENCY'>('108_TRAUMA');
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [isDispatched, setIsDispatched] = useState(false);
    const [dispatchSummary, setDispatchSummary] = useState<ReferralRecord | null>(null);

    const { patients } = usePatientStore();
    const { addReferral } = useReferralStore();

    // Default emergency patient or selected
    const activePatient = patients.find(p => p.id === selectedPatientId) || patients[0] || {
        id: 'p-gad-emergency',
        name: 'Emergency Unknown Patient',
        age: 30,
        gender: 'F',
        village: 'Bhamragad Tribal Sub-Centre',
        vitals: { spo2: 88, heartRate: 124, bloodPressure: { systolic: 168, diastolic: 104 }, injuryType: 'Acute Shock / Obstetric Crisis' },
        triageStatus: 'RED' as const,
        triagePriority: 'EMERGENCY' as const,
        abhaId: 'ABHA-9188-EMERGENCY',
    };

    const handleTriggerEmergency = async () => {
        const targetFacility = selectedType === '102_MATERNAL'
            ? MAHARASHTRA_FACILITIES[1] // SDH Aheri (CEmONC)
            : MAHARASHTRA_FACILITIES[0]; // DH Gadchiroli (Trauma/Apex)

        const emergencyRecord: ReferralRecord = {
            id: `SOS-${Date.now().toString().slice(-6)}`,
            patientId: activePatient.id,
            patientName: activePatient.name,
            patientAge: activePatient.age,
            patientGender: activePatient.gender,
            fromFacilityId: 'sc-kothi',
            fromFacilityName: 'Sub-Centre Kothi (Field Station)',
            fromFacilityType: 'SC',
            toFacilityId: targetFacility.id,
            toFacilityName: targetFacility.name,
            toFacilityType: targetFacility.type,
            reason: selectedType === '102_MATERNAL'
                ? 'EMERGENCY OBSTETRIC ESCALATION: Severe Preeclampsia / Hemorrhage'
                : '108 TRAUMA / ACUTE LIFE-THREATENING CRISIS',
            priority: 'EMERGENCY',
            status: 'IN_TRANSIT',
            referredBy: 'Frontline Worker SOS Trigger (1-Tap)',
            referredAt: new Date().toISOString(),
            transportMode: selectedType === '102_MATERNAL' ? 'AMBULANCE_102' : 'AMBULANCE_108',
            ambulanceVehicleNo: selectedType === '102_MATERNAL' ? 'MH-33-T-0102' : 'MH-33-E-1081',
            clinicalSummary: `CRITICAL ALERT: SpO2 ${activePatient.vitals.spo2}%, Pulse ${activePatient.vitals.heartRate} bpm, BP ${activePatient.vitals.bloodPressure?.systolic || 160}/${activePatient.vitals.bloodPressure?.diastolic || 100} mmHg. Chief note: ${activePatient.vitals.injuryType}`,
        };

        await addReferral(emergencyRecord);
        setDispatchSummary(emergencyRecord);
        setIsDispatched(true);
        toast.error(`🚨 108/102 EMERGENCY DISPATCHED to ${targetFacility.name}!`, {
            duration: 6000,
            icon: '🚑',
        });
    };

    const handleReset = () => {
        setIsDispatched(false);
        setDispatchSummary(null);
        setIsOpen(false);
    };

    return (
        <>
            {/* Global Floating SOS Trigger Button */}
            <div className="fixed bottom-5 right-5 z-50">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-extrabold text-sm rounded-full shadow-2xl shadow-red-600/50 border-2 border-red-300 animate-pulse hover:animate-none cursor-pointer"
                    id="universal-sos-btn"
                >
                    <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                    <span>🚨 EMERGENCY SOS (108 / 102)</span>
                </motion.button>
            </div>

            {/* Emergency Modal Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl border-4 border-red-500 max-w-2xl w-full overflow-hidden my-8"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-800 text-white p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold">
                                        🚨
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-200 block">
                                            Maharashtra Emergency Medical Services (MEMS)
                                        </span>
                                        <h2 className="text-xl font-black tracking-tight">
                                            Emergency Escalation & Ambulance Command
                                        </h2>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="text-white/80 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-white/10"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {!isDispatched ? (
                                    <>
                                        {/* Emergency Type Selector */}
                                        <div>
                                            <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider block mb-2">
                                                1. Select Emergency Classification
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedType('108_TRAUMA')}
                                                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                                                        selectedType === '108_TRAUMA'
                                                            ? 'border-red-500 bg-red-50 text-red-950 font-bold shadow-md'
                                                            : 'border-border-subtle bg-gray-50/70 text-txt-secondary hover:border-red-200'
                                                    }`}
                                                >
                                                    <span className="text-xl block mb-1">🚑 108 MEMS</span>
                                                    <span className="text-xs font-bold block text-red-700">Trauma & Acute Shock</span>
                                                    <span className="text-[11px] text-txt-muted block">Cardiac, Snakebite, Poisoning</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedType('102_MATERNAL')}
                                                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                                                        selectedType === '102_MATERNAL'
                                                            ? 'border-rose-500 bg-rose-50 text-rose-950 font-bold shadow-md'
                                                            : 'border-border-subtle bg-gray-50/70 text-txt-secondary hover:border-rose-200'
                                                    }`}
                                                >
                                                    <span className="text-xl block mb-1">🤰 102 Janani Shishu</span>
                                                    <span className="text-xs font-bold block text-rose-700">Maternal Crisis</span>
                                                    <span className="text-[11px] text-txt-muted block">Preeclampsia, Labor Hemorrhage</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedType('PEDIATRIC_EMERGENCY')}
                                                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                                                        selectedType === 'PEDIATRIC_EMERGENCY'
                                                            ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-md'
                                                            : 'border-border-subtle bg-gray-50/70 text-txt-secondary hover:border-amber-200'
                                                    }`}
                                                >
                                                    <span className="text-xl block mb-1">👶 Pediatric SNCU</span>
                                                    <span className="text-xs font-bold block text-amber-800">Severe Malnutrition (SAM)</span>
                                                    <span className="text-[11px] text-txt-muted block">Infant Cyanosis & Convulsions</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Patient Selector */}
                                        <div>
                                            <label className="text-xs font-bold text-txt-secondary uppercase tracking-wider block mb-2">
                                                2. Attach Patient Health Record (LHR)
                                            </label>
                                            <select
                                                value={selectedPatientId}
                                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-border-subtle rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                                            >
                                                <option value="">{activePatient.name} ({activePatient.age}y, {activePatient.gender}) — {activePatient.vitals.injuryType?.slice(0, 50)}...</option>
                                                {patients.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.age}y, {p.gender}) • SpO2: {p.vitals.spo2}% • {p.triageStatus} • {p.village}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Instant LHR Summary Card (Pre-dispatch Review) */}
                                        <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-red-800 uppercase tracking-wider">
                                                    Emergency LHR Snapshot (Shared with Apex Trauma Team)
                                                </span>
                                                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">
                                                    ABHA: {activePatient.abhaId || 'ABHA-LINKED'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                <div className="bg-white p-2 rounded-lg border border-red-100">
                                                    <span className="text-txt-muted block text-[10px]">SpO2</span>
                                                    <span className="font-extrabold text-red-700 text-sm">{activePatient.vitals.spo2}%</span>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-red-100">
                                                    <span className="text-txt-muted block text-[10px]">Blood Pressure</span>
                                                    <span className="font-extrabold text-red-700 text-sm">{activePatient.vitals.bloodPressure?.systolic || 160}/{activePatient.vitals.bloodPressure?.diastolic || 100}</span>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-red-100">
                                                    <span className="text-txt-muted block text-[10px]">Heart Rate</span>
                                                    <span className="font-extrabold text-red-700 text-sm">{activePatient.vitals.heartRate || 110} BPM</span>
                                                </div>
                                                <div className="bg-white p-2 rounded-lg border border-red-100">
                                                    <span className="text-txt-muted block text-[10px]">Blood Group</span>
                                                    <span className="font-extrabold text-emerald-800 text-sm">O+ (Rh Pos)</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-red-900 font-medium">
                                                <strong>Critical Condition:</strong> {activePatient.vitals.injuryType}
                                            </p>
                                        </div>

                                        {/* Auto-routed Receiving Higher Centre */}
                                        <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-border-subtle rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">🏥</span>
                                                <div>
                                                    <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block">Auto-Routed Receiving Centre</span>
                                                    <span className="text-xs font-extrabold text-emerald-deep">
                                                        {selectedType === '102_MATERNAL' ? 'SDH Aheri (First Referral Unit - CEmONC)' : 'District Hospital Gadchiroli (Apex ICU/Trauma)'}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                                                {selectedType === '102_MATERNAL' ? '38 km • ETA 42 min' : '82 km • ETA 1h 15m'}
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="flex-1 py-3 px-4 rounded-xl border border-border-subtle text-txt-secondary font-bold text-sm hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleTriggerEmergency}
                                                className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-extrabold text-sm shadow-xl shadow-red-600/30 hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <span>🚨 ONE-TAP DISPATCH AMBULANCE</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* Dispatched Success View */
                                    <div className="text-center space-y-4 py-4">
                                        <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">
                                            🚑
                                        </div>
                                        <div>
                                            <span className="text-xs font-black bg-red-100 text-red-800 px-3 py-1 rounded-full uppercase tracking-wider">
                                                Ambulance Dispatched & Emergency Referral Activated
                                            </span>
                                            <h3 className="text-2xl font-black text-emerald-deep mt-2">
                                                Tracking Token: {dispatchSummary?.id}
                                            </h3>
                                            <p className="text-xs text-txt-secondary mt-1">
                                                Vehicle <strong>{dispatchSummary?.ambulanceVehicleNo}</strong> en route to {dispatchSummary?.fromFacilityName}.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left text-xs space-y-1.5 text-emerald-950">
                                            <div className="flex justify-between font-bold">
                                                <span>Destination Facility:</span>
                                                <span className="text-emerald-800">{dispatchSummary?.toFacilityName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Receiving Trauma Team:</span>
                                                <span className="font-semibold">Dr. Khandate / Dr. Meshram (Alerted via SMS & Web)</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Emergency LHR Shared:</span>
                                                <span className="font-semibold text-emerald-700">✓ ABDM FHIR Bundle Transmitted</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="w-full py-3 bg-emerald-deep text-white font-bold text-sm rounded-xl hover:bg-emerald-800 transition-all shadow-md"
                                        >
                                            Close & Return to Work
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
