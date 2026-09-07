/**
 * Emergency Escalation Portal — Module 13 (SIH PS#26133)
 * Provides 1-tap 108 / 102 emergency ambulance dispatch with Longitudinal Health Record sharing.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { ReferralRecord } from '@/types/patient';
import toast from 'react-hot-toast';

export default function EmergencyPage() {
    const [selectedType, setSelectedType] = useState<'108_TRAUMA' | '102_MATERNAL' | 'PEDIATRIC_EMERGENCY'>('108_TRAUMA');
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [isDispatched, setIsDispatched] = useState(false);
    const [dispatchSummary, setDispatchSummary] = useState<ReferralRecord | null>(null);

    const { patients } = usePatientStore();
    const { addReferral } = useReferralStore();

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
            ? MAHARASHTRA_FACILITIES[1]
            : MAHARASHTRA_FACILITIES[0];

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
            referredBy: 'Frontline Worker / Universal Emergency SOS',
            referredAt: new Date().toISOString(),
            transportMode: selectedType === '102_MATERNAL' ? 'AMBULANCE_102' : 'AMBULANCE_108',
            ambulanceVehicleNo: selectedType === '102_MATERNAL' ? 'MH-33-T-1021 (Janani Shishu 102)' : 'MH-33-G-1088 (MEMS ALS Ambulance 108)',
            clinicalSummary: `CRITICAL ALERT: SpO2 ${activePatient.vitals?.spo2 || 88}%, BP ${activePatient.vitals?.bloodPressure?.systolic || 160}/${activePatient.vitals?.bloodPressure?.diastolic || 100}, HR ${activePatient.vitals?.heartRate || 120} BPM. Condition: ${activePatient.vitals?.injuryType || 'Acute Emergency'}. ABHA: ${activePatient.abhaId || 'ABHA-LINKED'}. Immediate team mobilization requested.`,
            notes: selectedType === '102_MATERNAL' ? 'Obstetrics & Gynecology (CEmONC)' : 'Trauma & Emergency Care (ICU)',
        };

        addReferral(emergencyRecord);
        setDispatchSummary(emergencyRecord);
        setIsDispatched(true);
        toast.error(`EMERGENCY DISPATCH TRANSMITTED: ${emergencyRecord.ambulanceVehicleNo}`, { duration: 6000 });
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full text-xs font-bold text-red-800 mb-2">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                <span>Government of Maharashtra • Universal Emergency Escalation Protocol</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Emergency Medical Response & 108/102 Dispatch
                            </h1>
                        </div>
                        <Link href="/" className="gov-btn gov-btn-secondary text-xs">
                            ← Back to Home
                        </Link>
                    </div>

                    {isDispatched && dispatchSummary ? (
                        <div className="surface-card border-2 border-status-green bg-green-50/40 p-6 rounded-2xl space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-status-green font-bold text-lg">
                                    <Icon name="check-circle" className="w-5 h-5" />
                                    <span>Emergency Escalation Dispatched Successfully</span>
                                </div>
                                <span className="text-xs font-mono bg-status-green text-white px-2 py-1 rounded">
                                    {dispatchSummary.id}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-green-200">
                                <div>
                                    <span className="text-txt-muted block">Assigned Ambulance</span>
                                    <strong className="text-emerald-deep text-sm">{dispatchSummary.ambulanceVehicleNo}</strong>
                                </div>
                                <div>
                                    <span className="text-txt-muted block">Receiving Hospital</span>
                                    <strong className="text-emerald-deep text-sm">{dispatchSummary.toFacilityName}</strong>
                                </div>
                                <div>
                                    <span className="text-txt-muted block">Status</span>
                                    <strong className="text-status-green text-sm">IN TRANSIT (ETA 35m)</strong>
                                </div>
                            </div>
                            <p className="text-xs text-txt-secondary leading-relaxed">
                                Emergency LHR snapshot and vitals telemetry have been securely transmitted to the receiving trauma team at {dispatchSummary.toFacilityName}.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <Link href="/referrals" className="gov-btn gov-btn-primary text-xs">
                                    Track Ambulance in Referral Pipeline →
                                </Link>
                                <button
                                    onClick={() => setIsDispatched(false)}
                                    className="gov-btn gov-btn-ghost text-xs"
                                >
                                    Trigger Another Escalation
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('108_TRAUMA')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                        selectedType === '108_TRAUMA'
                                            ? 'border-status-red bg-red-50 text-red-950 shadow-sm'
                                            : 'border-border-subtle bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <Icon name="ambulance" className="w-6 h-6 mb-1 text-status-red" />
                                    <strong className="text-sm block text-emerald-deep">108 MEMS Trauma</strong>
                                    <span className="text-[11px] text-txt-secondary">Accident, Stroke, Shock, Cardiac</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('102_MATERNAL')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                        selectedType === '102_MATERNAL'
                                            ? 'border-status-green bg-green-50 text-green-950 shadow-sm'
                                            : 'border-border-subtle bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <Icon name="maternal" className="w-6 h-6 mb-1 text-status-green" />
                                    <strong className="text-sm block text-emerald-deep">102 Janani Shishu</strong>
                                    <span className="text-[11px] text-txt-secondary">Maternal Labor, Preeclampsia</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('PEDIATRIC_EMERGENCY')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                        selectedType === 'PEDIATRIC_EMERGENCY'
                                            ? 'border-gov-blue bg-blue-50 text-blue-950 shadow-sm'
                                            : 'border-border-subtle bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <Icon name="child" className="w-6 h-6 mb-1 text-gov-blue" />
                                    <strong className="text-sm block text-emerald-deep">Pediatric Emergency</strong>
                                    <span className="text-[11px] text-txt-secondary">Neonatal Asphyxia, SAM Shock</span>
                                </button>
                            </div>

                            <div className="surface-card p-5 space-y-4">
                                <label className="block text-xs font-bold text-emerald-deep uppercase tracking-wider">
                                    Select Patient for Clinical Snapshot
                                </label>
                                <select
                                    value={selectedPatientId}
                                    onChange={(e) => setSelectedPatientId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-emerald-deep focus:outline-none font-medium"
                                >
                                    <option value="">-- Active Patient: {activePatient.name} ({activePatient.age}y / {activePatient.gender}) --</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.age}y, {p.village}) — SpO2: {p.vitals.spo2}%, Status: {p.triageStatus}
                                        </option>
                                    ))}
                                </select>

                                <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-red-900 uppercase">Emergency LHR Snapshot</span>
                                        <span className="text-[10px] font-mono bg-status-red text-white px-2 py-0.5 rounded font-bold">
                                            {activePatient.abhaId || 'ABHA-LINKED'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                        <div className="bg-white p-2 rounded border border-red-100">
                                            <span className="text-txt-muted block text-[10px]">SpO2</span>
                                            <strong className="text-status-red text-sm">{activePatient.vitals.spo2}%</strong>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-100">
                                            <span className="text-txt-muted block text-[10px]">Blood Pressure</span>
                                            <strong className="text-status-red text-sm">{activePatient.vitals.bloodPressure?.systolic || 160}/{activePatient.vitals.bloodPressure?.diastolic || 100}</strong>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-100">
                                            <span className="text-txt-muted block text-[10px]">Heart Rate</span>
                                            <strong className="text-emerald-deep text-sm">{activePatient.vitals.heartRate || 110} BPM</strong>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-100">
                                            <span className="text-txt-muted block text-[10px]">Condition</span>
                                            <strong className="text-emerald-deep text-xs truncate block">{activePatient.vitals.injuryType || 'Emergency'}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 border border-border-subtle rounded-xl flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-txt-muted block text-[10px] font-bold uppercase">Auto-Routed Receiving Centre</span>
                                        <strong className="text-emerald-deep font-bold">
                                            {selectedType === '102_MATERNAL' ? 'SDH Aheri (First Referral Unit - CEmONC)' : 'District Hospital Gadchiroli (Apex ICU/Trauma)'}
                                        </strong>
                                    </div>
                                    <span className="badge-green font-bold px-2 py-1 rounded">
                                        {selectedType === '102_MATERNAL' ? '38 km • ETA 42 min' : '82 km • ETA 1h 15m'}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleTriggerEmergency}
                                    className="gov-btn gov-btn-danger w-full text-base py-3 font-bold"
                                >
                                    <Icon name="alert-siren" className="w-4 h-4" /> 1-Tap Emergency Dispatch & Transmit LHR
                                </button>
                            </div>

                            <div className="surface-card p-5 text-center space-y-3">
                                <span className="text-xs text-txt-secondary font-medium">Or place an immediate direct telephone call:</span>
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    <a href="tel:108" className="gov-btn gov-btn-danger text-sm">
                                        <Icon name="phone" className="w-3.5 h-3.5" /> Call 108 (Ambulance)
                                    </a>
                                    <a href="tel:102" className="gov-btn gov-btn-danger text-sm">
                                        <Icon name="phone" className="w-3.5 h-3.5" /> Call 102 (Maternal)
                                    </a>
                                    <a href="tel:104" className="gov-btn gov-btn-secondary text-sm">
                                        <Icon name="phone" className="w-3.5 h-3.5" /> Call 104 (Health Advice)
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
