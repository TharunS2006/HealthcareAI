/**
 * Raise a referral — patient, vitals, reason, urgency, and where to send it.
 *
 * The destination list is live: every candidate facility's capacity for
 * *this* patient, recomputed as the reason and vitals are typed, so an ANM does
 * not send a mother in pre-eclampsia to a CHC whose blood storage is down.
 * Facilities meeting every need are listed first, nearest first.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useReferralStore } from '@/stores/referralStore';
import { usePatientStore } from '@/stores/patientStore';
import { useFacilityStore } from '@/stores/facilityStore';
import type { StaffSession } from '@/stores/authStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { requirementsFor } from '@/lib/capacity/requirements';
import { defaultReferralTarget, referralTargets } from '@/lib/capacity/availability';
import { useAvailability } from '@/lib/capacity/useAvailability';
import FacilityAvailabilityList from '@/components/capacity/FacilityAvailabilityList';
import type { Patient, ReferralRecord, TriagePriority, Vitals } from '@/types/patient';


export interface ReferralFormPrefill {
    patientId?: string;
    newPatient?: { name: string; age: string; gender: 'M' | 'F' | 'O'; village: string };
    spo2?: string;
    pulse?: string;
    systolic?: string;
    diastolic?: string;
    temperature?: string;
    respiratoryRate?: string;
    reason?: string;
    priority?: TriagePriority;
    transport?: ReferralRecord['transportMode'];
    targetId?: string;
}

interface Props {
    session: StaffSession;
    onCreated: (referral: ReferralRecord) => void;
    onCancel?: () => void;
    prefill?: ReferralFormPrefill;
    /** Increment to submit programmatically (the simulation's scripted demo). */
    submitSignal?: number;
}

const field = 'w-full px-2.5 py-1.5 text-[12px] bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#1F3A6E] focus:outline-none';
const label = 'block text-[11px] font-bold text-slate-600 mb-0.5';

/** A number within range, or undefined for a blank field; NaN signals invalid input. */
function reading(raw: string, min: number, max: number): number | undefined {
    if (!raw.trim()) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}

export default function NewReferralForm({ session, onCreated, onCancel, prefill, submitSignal }: Props) {
    const create = useReferralStore(s => s.create);
    const patients = usePatientStore(s => s.patients);
    const loadPatients = usePatientStore(s => s.loadPatients);
    const addPatient = usePatientStore(s => s.addPatient);
    const updatePatient = usePatientStore(s => s.updatePatient);
    const stored = useFacilityStore(s => s.facilities);
    const facilities = stored.length ? stored : FACILITY_NETWORK;
    const availabilityOf = useAvailability();

    useEffect(() => {
        if (patients.length === 0) void loadPatients();
    }, [patients.length, loadPatients]);

    const origin = facilities.find(f => f.id === session.facilityId);
    const myPatients = useMemo(
        () => patients.filter(p => p.registeredAtFacilityId === session.facilityId),
        [patients, session.facilityId]
    );

    const [mode, setMode] = useState<'existing' | 'new'>(prefill?.newPatient ? 'new' : 'existing');
    const [patientId, setPatientId] = useState(prefill?.patientId ?? '');
    const [name, setName] = useState(prefill?.newPatient?.name ?? '');
    const [age, setAge] = useState(prefill?.newPatient?.age ?? '');
    const [gender, setGender] = useState<'M' | 'F' | 'O'>(prefill?.newPatient?.gender ?? 'F');
    const [village, setVillage] = useState(prefill?.newPatient?.village ?? '');
    const [spo2, setSpo2] = useState(prefill?.spo2 ?? '');
    const [pulse, setPulse] = useState(prefill?.pulse ?? '');
    const [systolic, setSystolic] = useState(prefill?.systolic ?? '');
    const [diastolic, setDiastolic] = useState(prefill?.diastolic ?? '');
    const [temperature, setTemperature] = useState(prefill?.temperature ?? '');
    const [respiratoryRate, setRespiratoryRate] = useState(prefill?.respiratoryRate ?? '');
    const [pregnant, setPregnant] = useState(false);
    const [weeks, setWeeks] = useState('');
    const [reason, setReason] = useState(prefill?.reason ?? '');
    const [priority, setPriority] = useState<TriagePriority>(prefill?.priority ?? 'URGENT');
    const [transport, setTransport] = useState<ReferralRecord['transportMode']>(prefill?.transport ?? 'AMBULANCE_108');
    const [targetId, setTargetId] = useState(prefill?.targetId ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (mode === 'existing' && !myPatients.some(p => p.id === patientId)) setPatientId(myPatients[0]?.id ?? '');
    }, [mode, myPatients, patientId]);

    const selected = mode === 'existing' ? myPatients.find(p => p.id === patientId) : undefined;
    // A blank age is unknown, not zero — Number('') is 0, which would read as a newborn.
    const ageNum = mode === 'new' ? (age.trim() ? Number(age) : undefined) : selected?.age;

    const vitalsDraft: Vitals = {
        spo2: Number(spo2) || 0,
        heartRate: Number(pulse) || 0,
        ...(systolic && diastolic ? { bloodPressure: { systolic: Number(systolic), diastolic: Number(diastolic) } } : {}),
        ...(temperature ? { temperature: Number(temperature) } : {}),
        ...(respiratoryRate ? { respiratoryRate: Number(respiratoryRate) } : {}),
        ...(pregnant ? { isPregnant: true, ...(weeks ? { gestationalWeeks: Number(weeks) } : {}) } : {}),
        injuryType: reason,
    };

    const requirements = useMemo(
        () => requirementsFor({ reason, priority, vitals: vitalsDraft, patientAge: typeof ageNum === 'number' && Number.isFinite(ageNum) ? ageNum : undefined }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [reason, priority, spo2, pulse, pregnant, ageNum]
    );

    const options = useMemo(() => {
        if (!origin) return [];
        return referralTargets(requirements, origin, facilities, availabilityOf);
    }, [origin, facilities, requirements, availabilityOf]);

    // Default to the parent facility unless it cannot take this patient.
    useEffect(() => {
        if (targetId && options.some(o => o.facility.id === targetId)) return;
        setTargetId((origin && defaultReferralTarget(options, origin))?.facility.id ?? '');
    }, [options, targetId, origin]);

    const submit = async () => {
        setError(null);
        if (!origin) return setError('Your session has no facility to refer from');
        const target = facilities.find(f => f.id === targetId);
        if (!target) return setError('Choose where to refer the patient');
        if (reason.trim().length < 3) return setError('Enter the clinical reason for referral');

        const readings = {
            spo2: reading(spo2, 50, 100),
            pulse: reading(pulse, 20, 250),
            systolic: reading(systolic, 50, 260),
            diastolic: reading(diastolic, 30, 160),
            temperature: reading(temperature, 90, 110),
            rr: reading(respiratoryRate, 5, 80),
        };
        if (readings.spo2 === undefined || readings.pulse === undefined) return setError('SpO2 and pulse are required');
        const bad = Object.entries(readings).find(([, v]) => Number.isNaN(v));
        if (bad) return setError(`Check the ${bad[0]} reading — it is outside the plausible range`);
        if ((systolic && !diastolic) || (!systolic && diastolic)) return setError('Enter both systolic and diastolic, or neither');

        const vitals: Vitals = {
            spo2: readings.spo2,
            heartRate: readings.pulse!,
            ...(readings.systolic !== undefined && readings.diastolic !== undefined ? { bloodPressure: { systolic: readings.systolic, diastolic: readings.diastolic } } : {}),
            ...(readings.temperature !== undefined ? { temperature: readings.temperature } : {}),
            ...(readings.rr !== undefined ? { respiratoryRate: readings.rr } : {}),
            ...(pregnant ? { isPregnant: true, ...(weeks ? { gestationalWeeks: Number(weeks) } : {}) } : {}),
            injuryType: reason.trim(),
        };
        const colour: Patient['triageStatus'] = priority === 'EMERGENCY' ? 'RED' : priority === 'URGENT' ? 'YELLOW' : 'GREEN';

        setBusy(true);
        let patient: Patient;
        try {
            if (mode === 'new') {
                const n = Number(age);
                if (name.trim().length < 2) throw new Error('Enter the patient\'s name');
                if (!Number.isFinite(n) || n < 0 || n > 120) throw new Error('Enter an age between 0 and 120');
                patient = {
                    id: `p-${session.facilityId}-${Date.now().toString(36)}`,
                    name: name.trim(),
                    age: n,
                    gender,
                    village: village.trim() || origin.tehsil,
                    tehsil: origin.tehsil,
                    district: origin.district,
                    vitals,
                    triageStatus: colour,
                    triagePriority: priority,
                    gps: { lat: origin.location.lat, lng: origin.location.lng },
                    isSynced: false,
                    timestamp: new Date().toISOString(),
                    chw_id: session.staffId,
                    chw_name: session.name,
                    registeredAtFacilityId: origin.id,
                };
                await addPatient(patient);
            } else {
                if (!selected) throw new Error('Choose the patient');
                // The vitals taken for the referral are the patient's latest vitals.
                patient = { ...selected, vitals, triageStatus: colour, triagePriority: priority, timestamp: new Date().toISOString() };
                await updatePatient(patient);
            }
        } catch (e) {
            setBusy(false);
            const message = e instanceof Error && !/IndexedDB|Database/i.test(e.message) ? e.message : 'Could not save the patient on this device';
            setError(message);
            return;
        }

        const result = await create(
            {
                patient: { id: patient.id, name: patient.name, age: patient.age, gender: patient.gender },
                from: { id: origin.id, name: origin.name, type: origin.type },
                to: { id: target.id, name: target.name, type: target.type },
                reason: reason.trim(),
                priority,
                transportMode: transport,
                vitals,
            },
            session
        );
        setBusy(false);
        if (!result.ok) {
            setError(result.message);
            toast.error(result.message);
            return;
        }
        toast.success(`Referral ${result.value.id} created for ${patient.name}`);
        onCreated(result.value);
    };

    const submitRef = useRef(submit);
    submitRef.current = submit;
    useEffect(() => {
        if (submitSignal) void submitRef.current();
    }, [submitSignal]);

    return (
        <form
            className="border border-[#B9C5D6] bg-white"
            onSubmit={e => {
                e.preventDefault();
                void submit();
            }}
        >
            <div className="bg-[#1F3A6E] text-white px-3 py-2 flex items-center justify-between">
                <h2 className="text-[13px] font-bold">New referral from {origin?.name ?? session.facilityName}</h2>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="text-white/90 hover:text-white text-lg leading-none" aria-label="Cancel">×</button>
                )}
            </div>

            <div className="p-3 space-y-3">
                <fieldset className="space-y-2">
                    <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Patient</legend>
                    <div className="flex gap-3 text-[12px]">
                        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} /> Registered here</label>
                        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Register new patient</label>
                    </div>
                    {mode === 'existing' ? (
                        myPatients.length === 0 ? (
                            <p className="text-[11px] text-slate-600">No patients registered at this facility yet — register a new one.</p>
                        ) : (
                            <select value={patientId} onChange={e => setPatientId(e.target.value)} className={field} aria-label="Patient">
                                {myPatients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — {p.age} y / {p.gender} · {p.village}</option>
                                ))}
                            </select>
                        )
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <label className="col-span-2"><span className={label}>Name</span><input value={name} onChange={e => setName(e.target.value)} className={field} /></label>
                            <label><span className={label}>Age (years)</span><input type="number" min={0} max={120} value={age} onChange={e => setAge(e.target.value)} className={field} /></label>
                            <label>
                                <span className={label}>Sex</span>
                                <select value={gender} onChange={e => setGender(e.target.value as 'M' | 'F' | 'O')} className={field}>
                                    <option value="F">Female</option>
                                    <option value="M">Male</option>
                                    <option value="O">Other</option>
                                </select>
                            </label>
                            <label className="col-span-2 sm:col-span-4"><span className={label}>Village</span><input value={village} onChange={e => setVillage(e.target.value)} className={field} /></label>
                        </div>
                    )}
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vitals now</legend>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        <label><span className={label}>SpO2 % *</span><input inputMode="numeric" value={spo2} onChange={e => setSpo2(e.target.value)} className={field} /></label>
                        <label><span className={label}>Pulse *</span><input inputMode="numeric" value={pulse} onChange={e => setPulse(e.target.value)} className={field} /></label>
                        <label><span className={label}>BP sys</span><input inputMode="numeric" value={systolic} onChange={e => setSystolic(e.target.value)} className={field} /></label>
                        <label><span className={label}>BP dia</span><input inputMode="numeric" value={diastolic} onChange={e => setDiastolic(e.target.value)} className={field} /></label>
                        <label><span className={label}>Temp °F</span><input inputMode="decimal" value={temperature} onChange={e => setTemperature(e.target.value)} className={field} /></label>
                        <label><span className={label}>Resp/min</span><input inputMode="numeric" value={respiratoryRate} onChange={e => setRespiratoryRate(e.target.value)} className={field} /></label>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]">
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={pregnant} onChange={e => setPregnant(e.target.checked)} /> Pregnant</label>
                        {pregnant && (
                            <label className="flex items-center gap-1.5">weeks <input inputMode="numeric" value={weeks} onChange={e => setWeeks(e.target.value)} className={`${field} w-16`} /></label>
                        )}
                    </div>
                </fieldset>

                <label className="block">
                    <span className={label}>Reason for referral *</span>
                    <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className={field} placeholder="Findings, working diagnosis, what the patient needs" />
                </label>

                <fieldset>
                    <legend className={label}>Urgency *</legend>
                    <div className="grid grid-cols-3 gap-2">
                        {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map(p => (
                            <label
                                key={p}
                                className={`flex items-center justify-center gap-1.5 border rounded px-2 py-2 text-[12px] font-bold cursor-pointer ${
                                    priority === p
                                        ? p === 'EMERGENCY' ? 'bg-red-600 text-white border-red-700' : p === 'URGENT' ? 'bg-amber-100 text-amber-900 border-amber-500' : 'bg-green-100 text-green-900 border-green-500'
                                        : 'bg-white text-slate-700 border-slate-300'
                                }`}
                            >
                                <input type="radio" className="sr-only" checked={priority === p} onChange={() => setPriority(p)} />
                                {p === 'ROUTINE' ? 'Routine' : p === 'URGENT' ? 'Urgent' : 'Emergency'}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="block">
                    <span className={label}>Transport</span>
                    <select value={transport} onChange={e => setTransport(e.target.value as ReferralRecord['transportMode'])} className={field}>
                        <option value="AMBULANCE_108">108 Emergency ambulance</option>
                        <option value="AMBULANCE_102">102 Janani Shishu (maternal / infant)</option>
                        <option value="SELF">Self / family arranged</option>
                        <option value="PUBLIC_TRANSPORT">State transport bus</option>
                    </select>
                </label>

                <div>
                    <span className={label}>Refer to — live availability for this patient *</span>
                    <FacilityAvailabilityList
                        options={options}
                        availabilityOf={availabilityOf}
                        selectedId={targetId}
                        onSelect={setTargetId}
                        emptyText="No higher facility is configured."
                    />
                </div>

                {error && <p className="text-[12px] text-red-800 bg-red-50 border border-red-300 px-2 py-1" role="alert">{error}</p>}

                <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="gov-btn gov-btn-primary text-[12px] font-bold disabled:opacity-50">
                        {busy ? 'Saving…' : 'Create & send referral'}
                    </button>
                    {onCancel && <button type="button" onClick={onCancel} className="gov-btn gov-btn-secondary text-[12px]">Cancel</button>}
                </div>
                <p className="text-[11px] text-slate-500">
                    Saved on this device first. It shows as <strong>Sent</strong> only once the referral network, or a user at the
                    receiving facility, has confirmed it.
                </p>
            </div>
        </form>
    );
}
