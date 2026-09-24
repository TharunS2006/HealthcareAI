/**
 * Emergency Escalation Portal — Module 13
 * Provides 1-tap 108 / 102 emergency ambulance dispatch with Longitudinal Health Record sharing. */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { useSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { STATUS_LABELS } from '@/lib/referrals/workflow';
import { flushOutbox, uploadStatusOf, type UploadStatus } from '@/lib/sync/outbox';
import { Patient, ReferralRecord } from '@/types/patient';
import toast from 'react-hot-toast';

/**
 * The patient a dispatch is raised against when nobody has been registered yet.
 *
 * A roadside 108 call is often placed before any intake happens, so this has to
 * be a complete, storable record rather than a display-only stub: it is written
 * to the device and uploaded like any other, which is what puts the case on the
 * receiving hospital's pre-arrival board. The vitals are the worst-case
 * assumptions an unassessed emergency is treated on — deliberately pessimistic,
 * because over-preparing a resus bay costs a trolley and under-preparing costs
 * more. The name says plainly that this person is unidentified so nobody
 * mistakes the placeholder for a real record.
 */
const UNIDENTIFIED_PATIENT: Patient = {
    id: 'p-gad-emergency',
    name: 'Unidentified emergency patient',
    age: 30,
    gender: 'F',
    village: 'Block A Tribal Sub-Centre',
    tehsil: 'Bhamragad',
    district: 'Gadchiroli',
    vitals: {
        spo2: 88,
        heartRate: 124,
        bloodPressure: { systolic: 168, diastolic: 104 },
        injuryType: 'Acute Shock / Obstetric Crisis',
    },
    triageStatus: 'RED',
    triagePriority: 'EMERGENCY',
    abhaId: 'ABHA-9188-EMERGENCY',
    gps: { lat: 19.4981, lng: 80.4512 },
    isSynced: false,
    timestamp: '',
};

export default function EmergencyPage() {
    const [selectedType, setSelectedType] = useState<'108_TRAUMA' | '102_MATERNAL' | 'PEDIATRIC_EMERGENCY'>('108_TRAUMA');
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [isDispatched, setIsDispatched] = useState(false);
    const [dispatchSummary, setDispatchSummary] = useState<ReferralRecord | null>(null);
    /**
     * Whether this escalation has actually reached the district cloud.
     *
     * The old copy on this panel claimed the record had been "securely
     * transmitted" the instant the button was pressed. On a field device that is
     * almost never true: the record is written locally and queued, and the
     * upload happens whenever there is a network. Telling a worker the trauma
     * team can already see the patient — when the record is sitting in an outbox
     * under a tree in Bhamragad — is the difference between phoning ahead and
     * not bothering.
     */
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('UNKNOWN');

    const { patients, addPatient, loadPatients } = usePatientStore();
    const createReferral = useReferralStore(s => s.create);
    const session = useSession();
    // The live copy, so the panel shows the referral moving from Created to
    // Sent and on, rather than the snapshot taken at the moment of dispatch.
    const liveReferral = useReferralStore(s => (dispatchSummary ? s.referrals.find(r => r.id === dispatchSummary.id) : undefined));

    // Without this the selector is empty and every dispatch falls back to the
    // unknown-patient stub below, so the receiving hospital gets a referral with
    // no clinical record behind it — the one case where it matters most.
    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const activePatient: Patient =
        patients.find(p => p.id === selectedPatientId) || patients[0] || UNIDENTIFIED_PATIENT;

    const handleTriggerEmergency = async () => {
        const targetFacility = selectedType === '102_MATERNAL'
            ? FACILITY_NETWORK[1]
            : FACILITY_NETWORK[0];

        // A signed-in worker who may raise referrals dispatches from their own
        // facility, as themselves. Anyone else — this is the public SOS screen —
        // dispatches as the automatic 108/102 service from the field station.
        const staffOrigin = session && can(session.role, 'referral:create') && session.facilityId
            ? FACILITY_NETWORK.find(f => f.id === session.facilityId)
            : undefined;
        const origin = staffOrigin ?? FACILITY_NETWORK.find(f => f.id === 'sc-kothi')!;
        const maternal = selectedType === '102_MATERNAL';
        const vitals = activePatient.vitals;

        // The record has to go up with the referral, not just the referral.
        // A referral alone is a name and a reason; what lets the trauma team
        // ready a resus bay is the vitals and risk flags behind it. Saving the
        // patient here also covers the unidentified-patient case, which exists
        // only in this component's memory until someone dispatches on it.
        try {
            await addPatient({
                ...activePatient,
                transportStatus: 'IN_TRANSIT',
                isSynced: false,
                timestamp: new Date().toISOString(),
                registeredAtFacilityId: activePatient.registeredAtFacilityId ?? origin.id,
            });
        } catch {
            toast.error('Could not save the patient record on this device — call 108 / 102 directly');
            return;
        }

        const result = await createReferral(
            {
                patient: { id: activePatient.id, name: activePatient.name, age: activePatient.age, gender: activePatient.gender },
                from: { id: origin.id, name: origin.name, type: origin.type },
                to: { id: targetFacility.id, name: targetFacility.name, type: targetFacility.type },
                reason: maternal
                    ? 'EMERGENCY OBSTETRIC ESCALATION: Severe Preeclampsia / Hemorrhage'
                    : '108 TRAUMA / ACUTE LIFE-THREATENING CRISIS',
                priority: 'EMERGENCY',
                transportMode: maternal ? 'AMBULANCE_102' : 'AMBULANCE_108',
                clinicalSummary: `SpO2 ${vitals?.spo2 || '—'}%, BP ${vitals?.bloodPressure ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : '—'}, HR ${vitals?.heartRate || '—'}. ${vitals?.injuryType || ''}`.trim(),
                vitals,
                dispatch: { vehicleNo: maternal ? 'AMB-T-1021 (102)' : 'AMB-G-1088 (108 ALS)' },
            },
            staffOrigin ? session : null
        );
        if (!result.ok) {
            toast.error(result.message);
            return;
        }
        const emergencyRecord = result.value;
        setDispatchSummary(emergencyRecord);
        setUploadStatus('PENDING');
        setIsDispatched(true);
        toast.error(`EMERGENCY ESCALATION RECORDED: ${emergencyRecord.ambulanceVehicleNo}`, { duration: 6000 });
    };

    // Watch this record's journey to the cloud. The panel below reports whatever
    // this says, including "we cannot tell" — never a fixed reassurance.
    const refreshUploadStatus = useCallback(async () => {
        if (!dispatchSummary) return;
        setUploadStatus(await uploadStatusOf('REFERRAL', dispatchSummary.id));
    }, [dispatchSummary]);

    useEffect(() => {
        if (!dispatchSummary) return;
        void refreshUploadStatus();
        const t = setInterval(() => {
            void flushOutbox().then(refreshUploadStatus);
        }, 5000);
        return () => clearInterval(t);
    }, [dispatchSummary, refreshUploadStatus]);

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
                                <span>Government of India • Universal Emergency Escalation Protocol</span>
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
                                    <strong className="text-status-green text-sm">{STATUS_LABELS[(liveReferral ?? dispatchSummary).status]}</strong>
                                    <span className="block text-[10px] text-txt-muted">
                                        ETA pending crew confirmation
                                    </span>
                                </div>
                            </div>

                            <UploadState
                                status={uploadStatus}
                                facilityName={dispatchSummary.toFacilityName}
                                onRetry={() => void flushOutbox().then(refreshUploadStatus)}
                            />
                            <div className="flex gap-3 pt-2">
                                <Link href="/referrals" className="gov-btn gov-btn-primary text-xs">
                                    Track Ambulance in Referral Pipeline →
                                </Link>
                                <Link href="/incoming" className="gov-btn gov-btn-secondary text-xs">
                                    Pre-Arrival Board →
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
                                            {selectedType === '102_MATERNAL' ? 'Sub-District Hospital (First Referral Unit - CEmONC)' : 'District Hospital (Apex ICU/Trauma)'}
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

/**
 * What actually happened to the escalation record, in plain words.
 *
 * Each state says where the record is and what the worker should do about it.
 * "Queued" is not a failure and is not dressed up as one — it is the normal
 * state of an offline device — but it does mean nobody at the receiving end has
 * seen this yet, and that has to be on the screen.
 */
function UploadState({
    status,
    facilityName,
    onRetry,
}: {
    status: UploadStatus;
    facilityName: string;
    onRetry: () => void;
}) {
    if (status === 'UPLOADED') {
        return (
            <div className="border border-gov-green-border bg-gov-green-bg p-3">
                <p className="text-xs font-extrabold text-gov-green">
                    Record delivered to the district cloud
                </p>
                <p className="text-xs text-txt-primary mt-1">
                    The emergency record and the patient&apos;s vitals are now on the pre-arrival board
                    at {facilityName}, so the receiving team can ready equipment before arrival.
                </p>
            </div>
        );
    }

    if (status === 'BLOCKED') {
        return (
            <div className="border border-gov-red bg-gov-red-bg p-3">
                <p className="text-xs font-extrabold text-gov-red">
                    The district cloud refused this record
                </p>
                <p className="text-xs text-txt-primary mt-1">
                    It is saved on this device and nothing is lost, but {facilityName} cannot see it.
                    <span className="font-bold"> Phone the receiving facility directly.</span> The record
                    is retried automatically the next time the app starts.
                </p>
            </div>
        );
    }

    if (status === 'UNKNOWN') {
        return (
            <div className="border border-gov-amber bg-gov-amber-bg p-3">
                <p className="text-xs font-extrabold text-gov-amber">Upload state could not be read</p>
                <p className="text-xs text-txt-primary mt-1">
                    The escalation is recorded on this device. Whether {facilityName} has received it
                    cannot be confirmed from here —{' '}
                    <span className="font-bold">assume they have not and phone ahead.</span>
                </p>
            </div>
        );
    }

    return (
        <div className="border border-gov-amber bg-gov-amber-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-gov-amber">
                    Saved on this device — waiting to upload
                </p>
                <button onClick={onRetry} className="gov-btn gov-btn-ghost text-[11px]">
                    Try now
                </button>
            </div>
            <p className="text-xs text-txt-primary mt-1">
                The ambulance has been requested and the record is safe locally. It uploads to the
                district cloud automatically as soon as there is a connection; until then{' '}
                {facilityName} cannot see it, so{' '}
                <span className="font-bold">radio or phone the details through.</span>
            </p>
        </div>
    );
}
