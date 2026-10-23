/**
 * Emergency referral — raised the moment a worker has a life-threatening case.
 *
 * This app does not dispatch ambulances: 108 and 102 are run by their own
 * control rooms, reached by phone. What it does is get the patient's record
 * and a referral to the facility that can treat them before the ambulance
 * arrives there. So staff raise an emergency referral here and phone 108/102;
 * the vehicle number goes on the referral when the control room gives one.
 * Anyone not signed in as staff is shown the numbers to call, and nothing
 * pretends a request went anywhere.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { requirementsFor } from '@/lib/capacity/requirements';
import { defaultReferralTarget, referralTargets } from '@/lib/capacity/availability';
import { useAvailability } from '@/lib/capacity/useAvailability';
import { travelMinutes } from '@/lib/analytics/facilityMetrics';
import { flushOutbox, uploadStatusOf, type UploadStatus } from '@/lib/sync/outbox';
import { Patient, ReferralRecord, Vitals } from '@/types/patient';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

type EmergencyKind = '108_TRAUMA' | '102_MATERNAL' | 'PEDIATRIC_EMERGENCY';

/** What each kind of emergency needs, in the words the capacity rules read (lib/capacity/requirements.ts). */
const KIND: Record<EmergencyKind, { reason: string; transport: ReferralRecord['transportMode']; call: '108' | '102' }> = {
    '108_TRAUMA': { reason: 'Life-threatening emergency — trauma, stroke, shock or cardiac', transport: 'AMBULANCE_108', call: '108' },
    '102_MATERNAL': { reason: 'Obstetric emergency — pregnancy complication (eclampsia, bleeding, obstructed labour)', transport: 'AMBULANCE_102', call: '102' },
    PEDIATRIC_EMERGENCY: { reason: 'Paediatric emergency — child in danger (newborn asphyxia, severe malnutrition with shock)', transport: 'AMBULANCE_108', call: '108' },
};

const UNIDENTIFIED = '__unidentified__';

const reading = (text: string) => {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function EmergencyPage() {
    const [kind, setKind] = useState<EmergencyKind>('108_TRAUMA');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [unknownAge, setUnknownAge] = useState('');
    const [unknownGender, setUnknownGender] = useState<'M' | 'F' | 'O' | ''>('');
    const [unknownSpo2, setUnknownSpo2] = useState('');
    const [unknownPulse, setUnknownPulse] = useState('');
    const [unknownSys, setUnknownSys] = useState('');
    const [unknownDia, setUnknownDia] = useState('');
    const [targetId, setTargetId] = useState('');
    const [raising, setRaising] = useState(false);
    const [raised, setRaised] = useState<ReferralRecord | null>(null);
    /**
     * Whether this referral has actually reached the district cloud. Pressing
     * the button writes it to this device and queues it; the upload happens
     * whenever there is a network, and the panel says which.
     */
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('UNKNOWN');
    const { patients, addPatient, loadPatients } = usePatientStore();
    const createReferral = useReferralStore(s => s.create);
    const session = useSession();
    const availabilityOf = useAvailability();
    // The live copy, so the panel follows the referral from Created to Sent and on.
    const liveReferral = useReferralStore(s => (raised ? s.referrals.find(r => r.id === raised.id) : undefined));

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const origin = session && can(session.role, 'referral:create') && session.facilityId
        ? FACILITY_NETWORK.find(f => f.id === session.facilityId)
        : undefined;
    const call = KIND[kind].call;

    // This facility's patients first, newest first; then anyone else on the device.
    const choices = useMemo(() => {
        const newest = (a: Patient, b: Patient) => String(b.timestamp).localeCompare(String(a.timestamp));
        const here = patients.filter(p => p.registeredAtFacilityId === origin?.id).sort(newest);
        const elsewhere = patients.filter(p => p.registeredAtFacilityId !== origin?.id).sort(newest);
        return { here, elsewhere };
    }, [patients, origin?.id]);
    const chosen = selectedPatientId && selectedPatientId !== UNIDENTIFIED ? patients.find(p => p.id === selectedPatientId) : undefined;

    const unknownVitals: Vitals = {
        spo2: reading(unknownSpo2) ?? 0,
        heartRate: reading(unknownPulse) ?? 0,
        ...(reading(unknownSys) && reading(unknownDia) ? { bloodPressure: { systolic: reading(unknownSys)!, diastolic: reading(unknownDia)! } } : {}),
        injuryType: KIND[kind].reason,
        ...(kind === '102_MATERNAL' ? { isPregnant: true } : {}),
    };
    const vitals: Vitals | undefined = chosen?.vitals ?? (selectedPatientId === UNIDENTIFIED ? unknownVitals : undefined);
    const age = chosen?.age ?? reading(unknownAge);

    // Where the patient can be treated: the same rule as every other referral.
    const options = useMemo(() => {
        if (!origin) return [];
        const requirements = requirementsFor({ reason: KIND[kind].reason, priority: 'EMERGENCY', vitals, patientAge: age });
        return referralTargets(requirements, origin, FACILITY_NETWORK, availabilityOf);
    }, [origin, kind, vitals, age, availabilityOf]);
    const suggested = origin ? defaultReferralTarget(options, origin) : undefined;
    const target = options.find(o => o.facility.id === targetId) ?? suggested;

    const raise = async () => {
        if (!origin || !session || !target) return;
        const problems: string[] = [];
        if (!selectedPatientId) problems.push('choose the patient, or "Unidentified patient"');
        if (selectedPatientId === UNIDENTIFIED) {
            const a = Number(unknownAge);
            if (unknownAge.trim() === '' || !Number.isInteger(a) || a < 0 || a > 120) problems.push('approximate age in years');
            if (!unknownGender) problems.push('sex');
        }
        if (problems.length > 0) {
            toast.error(`Before raising the referral: ${problems.join(', ')}`);
            return;
        }
        setRaising(true);
        try {
            // An unidentified patient gets a record of their own — never a shared
            // placeholder that the next emergency would overwrite.
            const patient: Patient = chosen
                ? { ...chosen, transportStatus: 'IN_TRANSIT', isSynced: false, timestamp: new Date().toISOString(), registeredAtFacilityId: chosen.registeredAtFacilityId ?? origin.id }
                : {
                      id: `PAT-EMG-${uuidv4().slice(0, 8).toUpperCase()}`,
                      name: 'Unidentified emergency patient',
                      age: Number(unknownAge),
                      gender: unknownGender as 'M' | 'F' | 'O',
                      village: '',
                      tehsil: origin.tehsil,
                      district: origin.district,
                      vitals: unknownVitals,
                      triageStatus: 'RED',
                      triagePriority: 'EMERGENCY',
                      gps: { lat: origin.location.lat, lng: origin.location.lng },
                      isSynced: false,
                      transportStatus: 'IN_TRANSIT',
                      timestamp: new Date().toISOString(),
                      registeredAtFacilityId: origin.id,
                      chw_id: session.staffId,
                      chw_name: session.name,
                  };
            try {
                await addPatient(patient);
            } catch {
                toast.error(`Could not save the patient on this device — call ${call} and phone ${target.facility.name} directly`);
                return;
            }
            const v = patient.vitals;
            const result = await createReferral(
                {
                    patient: { id: patient.id, name: patient.name, age: patient.age, gender: patient.gender },
                    from: { id: origin.id, name: origin.name, type: origin.type },
                    to: { id: target.facility.id, name: target.facility.name, type: target.facility.type },
                    reason: KIND[kind].reason,
                    priority: 'EMERGENCY',
                    transportMode: KIND[kind].transport,
                    clinicalSummary: `SpO2 ${v.spo2 || '—'}%, pulse ${v.heartRate || '—'}/min, BP ${v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : '—'}. ${chosen ? (v.injuryType || '') : 'Unidentified patient, not yet registered.'}`.trim(),
                    vitals: v,
                },
                session
            );
            if (!result.ok) {
                toast.error(`${result.message} — call ${call} and phone the receiving facility`);
                return;
            }
            setRaised(result.value);
            setUploadStatus('PENDING');
            toast.error(`Emergency referral ${result.value.id} raised to ${target.facility.name}. Call ${call} now for the ambulance.`, { duration: 8000 });
        } finally {
            setRaising(false);
        }
    };

    const startOver = () => {
        setRaised(null); setSelectedPatientId(''); setUnknownAge(''); setUnknownGender('');
        setUnknownSpo2(''); setUnknownPulse(''); setUnknownSys(''); setUnknownDia(''); setTargetId('');
    };

    // Watch this record's journey to the cloud. The panel reports whatever this
    // says, including "we cannot tell" — never a fixed reassurance.
    const refreshUploadStatus = useCallback(async () => {
        if (!raised) return;
        setUploadStatus(await uploadStatusOf('REFERRAL', raised.id));
    }, [raised]);

    useEffect(() => {
        if (!raised) return;
        void refreshUploadStatus();
        const t = setInterval(() => {
            void flushOutbox().then(refreshUploadStatus);
        }, 5000);
        return () => clearInterval(t);
    }, [raised, refreshUploadStatus]);

    const callButtons = (
        <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="tel:108" className="gov-btn gov-btn-danger text-sm">
                <Icon name="phone" className="w-3.5 h-3.5" /> Call 108 (Ambulance)
            </a>
            <a href="tel:102" className="gov-btn gov-btn-danger text-sm">
                <Icon name="phone" className="w-3.5 h-3.5" /> Call 102 (Mother &amp; child)
            </a>
            <a href="tel:104" className="gov-btn gov-btn-secondary text-sm">
                <Icon name="phone" className="w-3.5 h-3.5" /> Call 104 (Health advice)
            </a>
        </div>
    );

    const kindButton = (value: EmergencyKind, icon: 'ambulance' | 'maternal' | 'child', title: string, sub: string, active: string, tone: string) => (
        <button
            type="button"
            onClick={() => { setKind(value); setTargetId(''); }}
            aria-pressed={kind === value}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${kind === value ? active : 'border-border-subtle bg-white hover:border-gray-300'}`}
        >
            <Icon name={icon} className={`w-6 h-6 mb-1 ${tone}`} />
            <strong className="text-sm block text-emerald-deep">{title}</strong>
            <span className="text-[11px] text-txt-secondary">{sub}</span>
        </button>
    );

    const shown = (n: number | undefined, unit: string) => (typeof n === 'number' && n > 0 ? `${n}${unit}` : '—');
    const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-emerald-deep focus:outline-none';

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
                                <span>Government of Maharashtra • Emergency Escalation</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Emergency: 108 / 102 and emergency referral
                            </h1>
                        </div>
                        <Link href="/" className="gov-btn gov-btn-secondary text-xs">
                            ← Back to Home
                        </Link>
                    </div>

                    {!origin ? (
                        <div className="surface-card p-6 text-center space-y-4">
                            <p className="text-sm font-bold text-emerald-deep">In an emergency, call now — the call is free.</p>
                            {callButtons}
                            <p className="text-xs text-txt-secondary">
                                108 sends an ambulance for any emergency; 102 carries pregnant women, mothers and sick infants to and from government facilities.
                            </p>
                            <p className="text-xs text-txt-secondary border-t border-border-subtle pt-3">
                                Health staff: <Link href="/staff/login" className="underline font-bold">sign in</Link> to raise an emergency referral, so the receiving facility has the patient&apos;s record before the ambulance arrives.
                            </p>
                        </div>
                    ) : raised ? (
                        <div className="surface-card border-2 border-status-green bg-green-50/40 p-6 rounded-2xl space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-status-green font-bold text-lg">
                                    <Icon name="check-circle" className="w-5 h-5" />
                                    <span>Emergency referral raised</span>
                                </div>
                                <span className="text-xs font-mono bg-status-green text-white px-2 py-1 rounded">{raised.id}</span>
                            </div>
                            <div className="border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                                <strong>Call {call} now</strong> for the ambulance — this app does not dispatch one. When the control room gives a vehicle number, record it on the referral (Referrals → this case → Dispatched).
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-green-200">
                                <div>
                                    <span className="text-txt-muted block">Patient</span>
                                    <strong className="text-emerald-deep text-sm">{raised.patientName}</strong>
                                </div>
                                <div>
                                    <span className="text-txt-muted block">Receiving facility</span>
                                    <strong className="text-emerald-deep text-sm">{raised.toFacilityName}</strong>
                                </div>
                                <div>
                                    <span className="text-txt-muted block">Referral status</span>
                                    <strong className="text-status-green text-sm">{STATUS_LABELS[(liveReferral ?? raised).status]}</strong>
                                </div>
                            </div>
                            <UploadState
                                status={uploadStatus}
                                facilityName={raised.toFacilityName}
                                onRetry={() => void flushOutbox().then(refreshUploadStatus)}
                            />
                            <div className="flex gap-3 pt-2 flex-wrap">
                                <Link href="/referrals" className="gov-btn gov-btn-primary text-xs">Open in Referrals →</Link>
                                <a href={`tel:${call}`} className="gov-btn gov-btn-danger text-xs"><Icon name="phone" className="w-3.5 h-3.5" /> Call {call}</a>
                                <button type="button" onClick={startOver} className="gov-btn gov-btn-ghost text-xs">Raise another</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {kindButton('108_TRAUMA', 'ambulance', '108 Emergency', 'Accident, stroke, shock, cardiac', 'border-status-red bg-red-50 text-red-950 shadow-sm', 'text-status-red')}
                                {kindButton('102_MATERNAL', 'maternal', '102 Janani Shishu', 'Pregnancy complication, labour', 'border-status-green bg-green-50 text-green-950 shadow-sm', 'text-status-green')}
                                {kindButton('PEDIATRIC_EMERGENCY', 'child', 'Child emergency', 'Newborn asphyxia, SAM with shock', 'border-gov-blue bg-blue-50 text-blue-950 shadow-sm', 'text-gov-blue')}
                            </div>

                            <div className="surface-card p-5 space-y-4">
                                <label htmlFor="emg-patient" className="block text-xs font-bold text-emerald-deep uppercase tracking-wider">
                                    Patient <span className="text-red-600">*</span>
                                </label>
                                <select id="emg-patient" value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} className={`${inputClass} font-medium`}>
                                    <option value="">— Choose the patient —</option>
                                    <option value={UNIDENTIFIED}>Unidentified patient (not registered yet)</option>
                                    {choices.here.length > 0 && (
                                        <optgroup label={`Registered at ${origin.name}`}>
                                            {choices.here.map(p => <option key={p.id} value={p.id}>{p.name} ({p.age} y, {p.gender}) — {p.village || 'village not recorded'}</option>)}
                                        </optgroup>
                                    )}
                                    {choices.elsewhere.length > 0 && (
                                        <optgroup label="Other patients on this device">
                                            {choices.elsewhere.map(p => <option key={p.id} value={p.id}>{p.name} ({p.age} y, {p.gender}) — {p.village || 'village not recorded'}</option>)}
                                        </optgroup>
                                    )}
                                </select>

                                {selectedPatientId === UNIDENTIFIED && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                        <label className="block">Approx. age (years) <span className="text-red-600">*</span>
                                            <input type="number" inputMode="numeric" min={0} max={120} value={unknownAge} onChange={e => setUnknownAge(e.target.value)} className={inputClass} />
                                        </label>
                                        <fieldset className="block">
                                            <legend>Sex <span className="text-red-600">*</span></legend>
                                            <div className="flex border border-border-subtle rounded-xl overflow-hidden mt-0.5">
                                                {(['M', 'F', 'O'] as const).map(g => (
                                                    <button key={g} type="button" aria-pressed={unknownGender === g} onClick={() => setUnknownGender(g)}
                                                        className={`flex-1 py-2 font-bold ${unknownGender === g ? 'bg-emerald-deep text-white' : 'bg-white'}`}>{g}</button>
                                                ))}
                                            </div>
                                        </fieldset>
                                        <label className="block">SpO2 % (if measured)
                                            <input type="number" inputMode="numeric" min={50} max={100} value={unknownSpo2} onChange={e => setUnknownSpo2(e.target.value)} className={inputClass} />
                                        </label>
                                        <label className="block">Pulse /min (if measured)
                                            <input type="number" inputMode="numeric" min={20} max={250} value={unknownPulse} onChange={e => setUnknownPulse(e.target.value)} className={inputClass} />
                                        </label>
                                        <label className="block">BP systolic (if measured)
                                            <input type="number" inputMode="numeric" min={50} max={260} value={unknownSys} onChange={e => setUnknownSys(e.target.value)} className={inputClass} />
                                        </label>
                                        <label className="block">BP diastolic (if measured)
                                            <input type="number" inputMode="numeric" min={20} max={180} value={unknownDia} onChange={e => setUnknownDia(e.target.value)} className={inputClass} />
                                        </label>
                                    </div>
                                )}

                                {vitals && (
                                    <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-red-900 uppercase">Record sent with the referral</span>
                                            <span className="text-[10px] font-mono text-red-900">
                                                {chosen ? `${chosen.abhaId ? `ABHA ${chosen.abhaId} · ` : ''}recorded ${new Date(chosen.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'entered now'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                            <div className="bg-white p-2 rounded border border-red-100"><span className="text-txt-muted block text-[10px]">SpO2</span><strong className="text-sm">{shown(vitals.spo2, '%')}</strong></div>
                                            <div className="bg-white p-2 rounded border border-red-100"><span className="text-txt-muted block text-[10px]">Blood pressure</span><strong className="text-sm">{vitals.bloodPressure ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : '—'}</strong></div>
                                            <div className="bg-white p-2 rounded border border-red-100"><span className="text-txt-muted block text-[10px]">Pulse</span><strong className="text-sm">{shown(vitals.heartRate, '/min')}</strong></div>
                                            <div className="bg-white p-2 rounded border border-red-100"><span className="text-txt-muted block text-[10px]">Complaint</span><strong className="text-xs truncate block">{chosen ? (vitals.injuryType || '—') : KIND[kind].reason}</strong></div>
                                        </div>
                                    </div>
                                )}

                                {target && (
                                    <div className="p-3 bg-gray-50 border border-border-subtle rounded-xl space-y-2 text-xs">
                                        <label htmlFor="emg-target" className="text-txt-muted block text-[10px] font-bold uppercase">Receiving facility — the nearest that reports it can take this case</label>
                                        <select id="emg-target" value={target.facility.id} onChange={e => setTargetId(e.target.value)} className={`${inputClass} font-bold`}>
                                            {options.map(o => (
                                                <option key={o.facility.id} value={o.facility.id}>
                                                    {o.facility.name} — {o.distanceKm.toFixed(0)} km · {o.check.overall === 'OK' ? 'can take' : o.check.overall === 'SHORT' ? 'reports a shortfall' : 'capacity not reported'}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="block text-txt-secondary">
                                            About {target.distanceKm.toFixed(0)} km by road — roughly {Math.round(travelMinutes(target.distanceKm))} min by ambulance (estimate).
                                        </span>
                                    </div>
                                )}

                                <button type="button" onClick={() => void raise()} disabled={raising} className="gov-btn gov-btn-danger w-full text-base py-3 font-bold disabled:opacity-60">
                                    <Icon name="alert-siren" className="w-4 h-4" /> {raising ? 'Raising…' : 'Raise emergency referral'}
                                </button>
                                <p className="text-[11px] text-txt-secondary text-center">
                                    Then call {call} for the ambulance — the referral gets the record there first; it does not dispatch a vehicle.
                                </p>
                            </div>

                            <div className="surface-card p-5 text-center space-y-3">
                                <span className="text-xs text-txt-secondary font-medium">Call now:</span>
                                {callButtons}
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
