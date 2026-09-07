/**
 * Referral Pipeline & Continuum of Care Tracker — NalamMesh
 * Multi-tier referral tracking across Maharashtra public health system (SIH PS#26133)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { useReferralStore } from '@/stores/referralStore';
import { usePatientStore } from '@/stores/patientStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { ReferralRecord, FacilityType, TriagePriority } from '@/types/patient';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export default function ReferralsPage() {
    const { referrals, loadReferrals, addReferral, changeStatus } = useReferralStore();
    const { patients, loadPatients } = usePatientStore();
    const { facilities, loadAll } = useFacilityStore();

    // New Referral Form Modal / Panel State
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [fromFacilityId, setFromFacilityId] = useState('phc-bhamragad');
    const [toFacilityId, setToFacilityId] = useState('chc-etapalli');
    const [priority, setPriority] = useState<TriagePriority>('EMERGENCY');
    const [transportMode, setTransportMode] = useState<ReferralRecord['transportMode']>('AMBULANCE_108');
    const [reason, setReason] = useState('');
    const [ambulanceVehicleNo, setAmbulanceVehicleNo] = useState('MH-33-E-1081');

    useEffect(() => {
        loadReferrals();
        loadPatients();
        loadAll();
    }, [loadReferrals, loadPatients, loadAll]);

    // Group referrals by status columns
    const columns: Array<{
        status: ReferralRecord['status'];
        label: string;
        color: string;
        badgeColor: string;
    }> = [
        { status: 'INITIATED', label: '1. Initiated', color: 'border-t-blue-500', badgeColor: 'bg-blue-100 text-blue-800' },
        { status: 'ACCEPTED', label: '2. Accepted by Higher Centre', color: 'border-t-teal-500', badgeColor: 'bg-teal-100 text-teal-800' },
        { status: 'IN_TRANSIT', label: '3. In Transit (Ambulance)', color: 'border-t-amber-500', badgeColor: 'bg-amber-100 text-amber-800' },
        { status: 'COMPLETED', label: '4. Completed & Admitted', color: 'border-t-emerald-500', badgeColor: 'bg-emerald-100 text-emerald-800' },
        { status: 'REJECTED', label: '5. Redirected / Cancelled', color: 'border-t-rose-500', badgeColor: 'bg-rose-100 text-rose-800' },
    ];

    const handleCreateReferral = async (e: React.FormEvent) => {
        e.preventDefault();
        const patient = patients.find(p => p.id === selectedPatientId) || patients[0];
        const fromFac = MAHARASHTRA_FACILITIES.find(f => f.id === fromFacilityId) || MAHARASHTRA_FACILITIES[3];
        const toFac = MAHARASHTRA_FACILITIES.find(f => f.id === toFacilityId) || MAHARASHTRA_FACILITIES[2];

        if (!reason.trim()) {
            toast.error('Please enter clinical reason for referral');
            return;
        }

        const newRef: ReferralRecord = {
            id: `ref-${Math.floor(1000 + Math.random() * 9000)}`,
            patientId: patient.id,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            fromFacilityId: fromFac.id,
            fromFacilityName: fromFac.name,
            fromFacilityType: fromFac.type,
            toFacilityId: toFac.id,
            toFacilityName: toFac.name,
            toFacilityType: toFac.type,
            reason,
            priority,
            status: 'INITIATED',
            referredBy: 'Dr. Suresh Atram (MO)',
            referredAt: new Date().toISOString(),
            transportMode,
            ambulanceVehicleNo: transportMode.includes('AMBULANCE') ? ambulanceVehicleNo : undefined,
            clinicalSummary: `SpO2: ${patient.vitals.spo2}%, BP: ${patient.vitals.bloodPressure?.systolic || 120}/${patient.vitals.bloodPressure?.diastolic || 80} mmHg. ${patient.vitals.injuryType}`,
        };

        await addReferral(newRef);
        setShowNewModal(false);
        setReason('');
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />

                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                                    Tiered Referral Continuum (SC → PHC → CHC → DH)
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Referral Tracking Pipeline
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Ensure zero patient drop-off with live status updates and 108/102 emergency ambulance dispatch
                            </p>
                        </div>

                        <button
                            onClick={() => setShowNewModal(true)}
                            className="gov-btn gov-btn-primary text-sm"
                        >
                            <span>+ Initiate New Referral</span>
                        </button>
                    </div>

                    {/* Kanban Board of Referrals */}
                    <div className="grid md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                        {columns.map((col) => {
                            const items = referrals.filter(r => r.status === col.status);
                            return (
                                <div
                                    key={col.status}
                                    className={`surface-card p-3.5 border-t-4 ${col.color} bg-gray-50/70 min-w-[240px] flex flex-col`}
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-xs text-emerald-deep">{col.label}</h3>
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                                            {items.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-0.5">
                                        {items.length === 0 ? (
                                            <div className="py-8 text-center text-xs text-txt-muted border border-dashed rounded-lg">
                                                No referrals
                                            </div>
                                        ) : (
                                            items.map((ref) => (
                                                <div
                                                    key={ref.id}
                                                    className="p-3.5 bg-white border border-gray-200/90 rounded-xl shadow-sm hover:shadow-md transition-all space-y-2 text-xs"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-mono text-[10px] font-bold text-txt-muted">
                                                            #{ref.id}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                                            ref.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                                                            ref.priority === 'URGENT' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                            {ref.priority}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <h4 className="font-bold text-sm text-emerald-deep">{ref.patientName}</h4>
                                                        <p className="text-[11px] text-txt-muted">{ref.patientAge}y / {ref.patientGender}</p>
                                                    </div>

                                                    {/* From -> To Facility Route */}
                                                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-deep">
                                                            <span className="text-txt-muted text-[10px]">From:</span>
                                                            <span className="truncate">{ref.fromFacilityName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                                                            <span className="text-txt-muted text-[10px]">To:</span>
                                                            <span className="truncate">{ref.toFacilityName}</span>
                                                        </div>
                                                    </div>

                                                    <p className="text-[11px] text-txt-secondary line-clamp-2 leading-relaxed">
                                                        {ref.reason}
                                                    </p>

                                                    {ref.ambulanceVehicleNo && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-1 rounded">
                                                            <Icon name="ambulance" className="w-3 h-3" />
                                                            <span>{ref.transportMode}:</span>
                                                            <span className="font-mono">{ref.ambulanceVehicleNo}</span>
                                                        </div>
                                                    )}

                                                    {/* Action to advance status */}
                                                    <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[11px]">
                                                        {ref.status === 'INITIATED' && (
                                                            <button
                                                                onClick={() => changeStatus(ref.id, 'ACCEPTED')}
                                                                className="w-full py-1 bg-teal-50 text-teal-700 font-bold rounded hover:bg-teal-100 transition-all text-center"
                                                            >
                                                                Accept at Higher Facility →
                                                            </button>
                                                        )}
                                                        {ref.status === 'ACCEPTED' && (
                                                            <button
                                                                onClick={() => changeStatus(ref.id, 'IN_TRANSIT')}
                                                                className="w-full py-1 bg-amber-50 text-amber-700 font-bold rounded hover:bg-amber-100 transition-all text-center inline-flex items-center justify-center gap-1"
                                                            >
                                                                <Icon name="ambulance" className="w-3 h-3" /> Mark In-Transit →
                                                            </button>
                                                        )}
                                                        {ref.status === 'IN_TRANSIT' && (
                                                            <button
                                                                onClick={() => changeStatus(ref.id, 'COMPLETED')}
                                                                className="w-full py-1 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-700 transition-all text-center"
                                                            >
                                                                ✓ Confirm Admission
                                                            </button>
                                                        )}
                                                        {ref.status === 'COMPLETED' && (
                                                            <span className="text-[10px] text-emerald-700 font-bold mx-auto">
                                                                ✓ Case Closed & Handed Over
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* New Referral Modal */}
                    {showNewModal && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex justify-between items-center pb-2 border-b">
                                    <h2 className="text-lg font-bold text-emerald-deep">Initiate Patient Referral</h2>
                                    <button onClick={() => setShowNewModal(false)} className="text-txt-muted hover:text-black text-xl font-bold">×</button>
                                </div>

                                <form onSubmit={handleCreateReferral} className="space-y-4 text-xs">
                                    <div>
                                        <label className="font-bold text-txt-muted uppercase block mb-1">Select Patient</label>
                                        <select
                                            value={selectedPatientId}
                                            onChange={(e) => setSelectedPatientId(e.target.value)}
                                            className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm font-semibold text-emerald-deep outline-none"
                                        >
                                            {patients.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.age}y / {p.village}) — Status: {p.triageStatus}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="font-bold text-txt-muted uppercase block mb-1">From Facility</label>
                                            <select
                                                value={fromFacilityId}
                                                onChange={(e) => setFromFacilityId(e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium outline-none"
                                            >
                                                {MAHARASHTRA_FACILITIES.map(f => (
                                                    <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="font-bold text-txt-muted uppercase block mb-1">Referred To (Higher Tier)</label>
                                            <select
                                                value={toFacilityId}
                                                onChange={(e) => setToFacilityId(e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium outline-none"
                                            >
                                                {MAHARASHTRA_FACILITIES.map(f => (
                                                    <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="font-bold text-txt-muted uppercase block mb-1">Priority</label>
                                            <select
                                                value={priority}
                                                onChange={(e) => setPriority(e.target.value as any)}
                                                className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold outline-none"
                                            >
                                                <option value="EMERGENCY">EMERGENCY (Red - Immediate)</option>
                                                <option value="URGENT">URGENT (Yellow - 24 Hours)</option>
                                                <option value="ROUTINE">ROUTINE (Green - Planned)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="font-bold text-txt-muted uppercase block mb-1">Transport Mode</label>
                                            <select
                                                value={transportMode}
                                                onChange={(e) => setTransportMode(e.target.value as any)}
                                                className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium outline-none"
                                            >
                                                <option value="AMBULANCE_108">108 Emergency Ambulance (ALS)</option>
                                                <option value="AMBULANCE_102">102 Janani Shishu Express (Maternal)</option>
                                                <option value="SELF">Self / Attendant Arranged</option>
                                                <option value="PUBLIC_TRANSPORT">State Transport Bus</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="font-bold text-txt-muted uppercase block mb-1">Clinical Reason & Provisional Diagnosis</label>
                                        <textarea
                                            rows={3}
                                            required
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Detail reasons for referral (e.g. CEmONC evaluation, surgical debridement, pediatric ICU)..."
                                            className="w-full p-2.5 bg-gray-50 border rounded-xl text-sm font-medium outline-none focus:border-teal-accent"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t">
                                        <button
                                            type="button"
                                            onClick={() => setShowNewModal(false)}
                                            className="px-4 py-2 bg-gray-100 text-txt-secondary font-bold rounded-xl"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 bg-emerald-deep text-white font-bold rounded-xl hover:bg-emerald-dark"
                                        >
                                            Dispatch Referral
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
