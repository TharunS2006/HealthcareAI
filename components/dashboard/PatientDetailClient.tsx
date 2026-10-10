/**
 * Patient Detail View — Client Component
 *
 * Resolves the patient id from EITHER the dynamic route segment (/dashboard/[id])
 * or a query parameter (/record?id=…). The query-param route is the one that works
 * for patients created at runtime, because `output: 'export'` can only prerender
 * the ids known at build time.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';
import { getPatient } from '@/lib/db';
import { usePatientStore } from '@/stores/patientStore';
import Sidebar from '@/components/shared/Sidebar';
import QRWristband from '@/components/shared/QRWristband';
import FHIRModal from '@/components/shared/FHIRModal';
import { patientTimeline } from '@/lib/analytics/patientTimeline';
import { STATUS_LABELS } from '@/lib/referrals/workflow';
import { useFacilityStore } from '@/stores/facilityStore';
import toast from 'react-hot-toast';
import { useSession } from '@/lib/auth/session';
import { isDistrictWide, ROLE_HOME } from '@/lib/auth/permissions';
import { useReferralStore } from '@/stores/referralStore';

export default function PatientDetailClient() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { patients, loadPatients } = usePatientStore();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [status, setStatus] = useState<'loading' | 'found' | 'not-found'>('loading');
    const [showQR, setShowQR] = useState(false);
    const [showFHIRModal, setShowFHIRModal] = useState(false);
    const session = useSession();
    const referrals = useReferralStore(s => s.referrals);
    const diagnostics = useFacilityStore(s => s.diagnostics);
    const loadFacilityData = useFacilityStore(s => s.loadAll);
    const home = session ? ROLE_HOME[session.role] : '/';

    // /dashboard/[id] takes precedence; /record?id=… is the runtime-safe route.
    const patientId = (params?.id as string | undefined) || searchParams.get('id') || '';

    // Make sure IndexedDB records are in the store even on a cold deep-link.
    useEffect(() => {
        if (patients.length === 0) loadPatients();
    }, [patients.length, loadPatients]);
    useEffect(() => {
        void loadFacilityData();
    }, [loadFacilityData]);

    useEffect(() => {
        let cancelled = false;

        if (!patientId) {
            setStatus('not-found');
            return;
        }

        setStatus('loading');

        // Try the store first (already hydrated), then fall back to IndexedDB.
        const fromStore = patients.find((p) => p.id === patientId);
        if (fromStore) {
            setPatient(fromStore);
            setStatus('found');
            return;
        }

        getPatient(patientId)
            .then((p) => {
                if (cancelled) return;
                if (p) {
                    setPatient(p);
                    setStatus('found');
                } else {
                    setStatus('not-found');
                }
            })
            .catch(() => {
                if (!cancelled) setStatus('not-found');
            });

        return () => {
            cancelled = true;
        };
    }, [patientId, patients]);

    if (status === 'loading' || (!patient && status !== 'not-found')) {
        return (
            <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
                <Sidebar />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-teal-accent border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-txt-secondary">Loading patient record…</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
                <Sidebar />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <div className="surface-card max-w-md w-full p-8 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[#1F3A6E]">Patient record not found</h1>
                            <p className="text-sm text-txt-secondary mt-1">
                                रुग्ण नोंद सापडली नाही.{' '}
                                {patientId ? (
                                    <>
                                        No record matches ID <span className="font-mono font-bold">{patientId}</span> on this device.
                                    </>
                                ) : (
                                    <>No patient ID was supplied.</>
                                )}
                            </p>
                            <p className="text-xs text-txt-muted mt-2">
                                Records are stored locally per device. If this patient was registered on another
                                device, sync the mesh relay first.
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center pt-1">
                            <Link
                                href={home}
                                className="px-4 py-2 bg-[#1F3A6E] hover:bg-[#16294E] text-white font-bold text-sm rounded transition-colors"
                            >
                                Back to my workspace
                            </Link>
                            <Link
                                href="/opd"
                                className="px-4 py-2 bg-white border border-[#1F3A6E] text-[#1F3A6E] hover:bg-slate-50 font-bold text-sm rounded transition-colors"
                            >
                                Register Patient
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // A patient belongs to the facility that registered them, and to any
    // facility a referral has taken them to or from. Everyone else is refused —
    // a deep link is not a way around facility scoping.
    const involved = new Set<string>([
        ...(patient.registeredAtFacilityId ? [patient.registeredAtFacilityId] : []),
        ...referrals.filter(r => r.patientId === patient.id).flatMap(r => [r.fromFacilityId, r.toFacilityId]),
        ...(patient.visits ?? []).map(v => v.facilityId),
    ]);
    const mayView = isDistrictWide(session?.role ?? null) || Boolean(session?.facilityId && involved.has(session.facilityId));
    if (!mayView) {
        return (
            <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
                <Sidebar />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <div className="surface-card max-w-md w-full p-8 text-center space-y-3">
                        <h1 className="text-lg font-bold text-[#1F3A6E]">Not permitted</h1>
                        <p className="text-sm text-txt-secondary">
                            This patient is not registered at, or referred to or from, {session?.facilityName ?? 'your facility'}.
                            Records are shown only to the facilities caring for the patient and to district officers.
                        </p>
                        <Link href={home} className="inline-block px-4 py-2 bg-[#1F3A6E] hover:bg-[#16294E] text-white font-bold text-sm rounded">
                            Back to my workspace
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const statusColors = {
        RED: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
        YELLOW: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
        GREEN: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
    };
    const colors = statusColors[patient.triageStatus];

    // The journey as recorded — registration, visits, referral events, lab
    // orders and results (lib/analytics/patientTimeline.ts). It used to be five
    // invented steps at fixed offsets from registration.
    const timeline = patientTimeline(patient, referrals, diagnostics);
    const patientReferrals = referrals
        .filter(r => r.patientId === patient.id)
        .sort((a, b) => new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime());
    const kindLabel: Record<string, string> = {
        REGISTERED: 'Registration', VISIT: 'Visit', REFERRAL: 'Referral', LAB_ORDER: 'Lab', LAB_RESULT: 'Lab result',
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-accent/5 rounded-full blur-3xl -z-10" />

                <div className="max-w-5xl mx-auto">
                    {/* Back Button & Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => router.push(home)}
                            aria-label="Back to my workspace"
                            className="p-2 bg-white border border-border-subtle rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex-1">
                            {/* Name first, full id beside it: a truncated id renders every
                                "p-gad-XXXX" patient identically, which is a misidentification risk
                                on a record a clinician acts from. */}
                            <h1 className="text-2xl font-bold text-emerald-deep">
                                {patient.name}
                                <span className="ml-2 text-base font-normal text-txt-muted">
                                    ({patient.age}
                                    {patient.gender ? ` / ${patient.gender}` : ''})
                                </span>
                            </h1>
                            <p className="text-sm text-txt-secondary">
                                <span className="font-mono">{patient.id}</span>
                                {patient.abhaId ? <span className="font-mono"> • {patient.abhaId}</span> : null}
                                {' • '}Registered: {new Date(patient.timestamp).toLocaleString()}
                            </p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-bold ${colors.badge}`}>
                            {patient.triageStatus} PRIORITY
                        </span>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Column 1-2: Patient Details */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Vitals Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`surface-card p-6 border-t-4 ${colors.border}`}
                            >
                                <h2 className="text-lg font-bold text-emerald-deep mb-4">Vital Signs</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-xl text-center">
                                        <span className="text-xs font-bold text-txt-muted uppercase block">SpO2</span>
                                        <span className={`text-3xl font-bold font-mono ${patient.vitals.spo2 < 90 ? 'text-status-red' : 'text-emerald-deep'}`}>
                                            {patient.vitals.spo2}%
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl text-center">
                                        <span className="text-xs font-bold text-txt-muted uppercase block">Pulse</span>
                                        <span className={`text-3xl font-bold font-mono ${patient.vitals.heartRate > 120 ? 'text-status-red' : 'text-emerald-deep'}`}>
                                            {patient.vitals.heartRate}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl text-center">
                                        <span className="text-xs font-bold text-txt-muted uppercase block">Blood Pressure</span>
                                        <span className="text-3xl font-bold font-mono text-emerald-deep">
                                            {patient.vitals.bloodPressure ? `${patient.vitals.bloodPressure.systolic}/${patient.vitals.bloodPressure.diastolic}` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl text-center flex flex-col justify-center items-center">
                                        <span className="text-xs font-bold text-txt-muted uppercase block">AVPU</span>
                                        <span className={`font-bold tracking-tight mt-1 ${
                                            (patient.vitals.consciousness || '').length > 6 ? 'text-xs md:text-sm font-extrabold' : 'text-2xl'
                                        } ${
                                            patient.vitals.consciousness === 'ALERT' ? 'text-emerald-deep' : 'text-status-red'
                                        }`}>
                                            {patient.vitals.consciousness || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                {patient.vitals.injuryType && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                        <span className="text-xs font-bold text-txt-muted uppercase">Clinical Notes</span>
                                        <p className="text-sm text-emerald-deep font-medium mt-1">{patient.vitals.injuryType}</p>
                                    </div>
                                )}
                            </motion.div>

                            {/* Journey Timeline */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="surface-card p-6"
                            >
                                <h2 className="text-lg font-bold text-emerald-deep mb-1">Patient Journey</h2>
                                <p className="text-xs text-txt-muted mb-5">
                                    As recorded on this device{patient.isSynced ? '' : ' — not yet uploaded to the district service'}.
                                </p>
                                {timeline.length === 0 ? (
                                    <p className="text-sm text-txt-muted">Nothing has been recorded for this patient yet.</p>
                                ) : (
                                    <ol className="relative border-l-2 border-gray-200 ml-2 space-y-5">
                                        {timeline.map((event, i) => (
                                            <li key={`${event.kind}-${i}`} className="ml-5">
                                                <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal-600" aria-hidden="true" />
                                                <p className="text-sm font-semibold text-emerald-deep">{event.title}</p>
                                                {event.detail && <p className="text-xs text-txt-secondary mt-0.5">{event.detail}</p>}
                                                <p className="text-[11px] text-txt-muted mt-0.5">
                                                    <span className="font-semibold uppercase tracking-wide">{kindLabel[event.kind]}</span>
                                                    {' · '}{event.at.toLocaleString()}
                                                    {event.actor ? ` · ${event.actor}` : ''}
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </motion.div>
                        </div>

                        {/* Column 3: Actions & Info */}
                        <div className="space-y-6">
                            {/* GPS & Location */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="surface-card p-6"
                            >
                                <h3 className="text-sm font-bold text-emerald-deep mb-3 uppercase tracking-wide">GPS Location</h3>
                                <div className="bg-gray-50 p-3 rounded-xl font-mono text-sm text-emerald-deep">
                                    <div>Lat: {patient.gps.lat.toFixed(6)}</div>
                                    <div>Lng: {patient.gps.lng.toFixed(6)}</div>
                                    {patient.gps.accuracy && <div className="text-xs text-txt-muted mt-1">Accuracy: ±{patient.gps.accuracy.toFixed(0)}m</div>}
                                </div>
                            </motion.div>

                            {/* Referrals — this patient's, from the referral records */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="surface-card p-6"
                            >
                                <h3 className="text-sm font-bold text-emerald-deep mb-3 uppercase tracking-wide">Referrals</h3>
                                {patientReferrals.length === 0 ? (
                                    <p className="text-xs text-txt-muted">No referral has been raised for this patient.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {patientReferrals.map(r => (
                                            <li key={r.id} className="text-xs border border-slate-200 rounded p-2.5">
                                                <p className="font-bold text-emerald-deep">{r.fromFacilityName} → {r.toFacilityName}</p>
                                                <p className="text-txt-secondary mt-0.5">{STATUS_LABELS[r.status]} · {r.priority} · {new Date(r.referredAt).toLocaleString()}</p>
                                                {r.reason && <p className="text-txt-muted mt-0.5 line-clamp-2">{r.reason}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <Link href="/referrals" className="mt-3 inline-block text-xs font-bold text-[#1F3A6E] hover:underline">Open the referral board →</Link>
                            </motion.div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowQR(!showQR)}
                                    className="gov-btn gov-btn-primary w-full py-3"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                    <span>{showQR ? 'Hide QR Wristband' : 'Generate QR Wristband'}</span>
                                </button>

                                <button
                                    onClick={() => setShowFHIRModal(true)}
                                    className="w-full py-3 bg-white border-2 border-indigo-600 text-indigo-700 font-bold rounded-xl shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Inspect ABDM / FHIR R4 Bundle
                                </button>
                            </div>

                            {/* QR Wristband */}
                            {showQR && <QRWristband patient={patient} />}

                            {/* ABDM / FHIR R4 Inspector Modal */}
                            {showFHIRModal && (
                                <FHIRModal
                                    patient={patient}
                                    isOpen={showFHIRModal}
                                    onClose={() => setShowFHIRModal(false)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
