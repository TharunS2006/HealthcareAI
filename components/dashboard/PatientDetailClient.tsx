/**
 * Patient Detail View — Client Component
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';
import { getPatient } from '@/lib/db';
import { usePatientStore } from '@/stores/patientStore';
import Sidebar from '@/components/shared/Sidebar';
import QRWristband from '@/components/shared/QRWristband';
import { getRecommendedHospital, getResourceChecklist } from '@/lib/data/hospitals';
import toast from 'react-hot-toast';

export default function PatientDetailClient() {
    const params = useParams();
    const router = useRouter();
    const { patients } = usePatientStore();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [showQR, setShowQR] = useState(false);

    useEffect(() => {
        const id = params?.id as string;
        if (!id) return;

        // Try from store first (faster), then from DB
        const fromStore = patients.find(p => p.id === id);
        if (fromStore) {
            setPatient(fromStore);
        } else {
            getPatient(id).then(p => {
                if (p) setPatient(p);
            });
        }
    }, [params?.id, patients]);

    if (!patient) {
        return (
            <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
                <Sidebar />
                <main className="flex-1 md:ml-64 p-8 flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-teal-accent border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-txt-secondary">Loading patient record...</p>
                    </div>
                </main>
            </div>
        );
    }

    const hospital = getRecommendedHospital(patient.triageStatus);
    const checklist = getResourceChecklist(patient.vitals.injuryType);

    const statusColors = {
        RED: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
        YELLOW: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
        GREEN: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
    };
    const colors = statusColors[patient.triageStatus];

    // Patient journey timeline
    const triageTime = new Date(patient.timestamp);
    const isTransportComplete = patient.transportStatus === 'COMPLETED';

    const timelineIcons = [
        <svg key="triage" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
        <svg key="ai" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
        <svg key="sync" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>,
        <svg key="transport" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0l2 2h2a1 1 0 001-1v-5a1 1 0 00-.29-.71l-3-3A1 1 0 0014 9h-1m-6 8h.01M17 16h.01" /></svg>,
        <svg key="hospital" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    ];

    const timeline = [
        { time: triageTime, action: 'Patient triaged at field station', actor: 'Triage Medic', icon: timelineIcons[0], status: 'complete' },
        { time: new Date(triageTime.getTime() + 60_000), action: 'On-device analysis completed — Priority assigned', actor: 'NalamMesh Engine', icon: timelineIcons[1], status: 'complete' },
        { time: new Date(triageTime.getTime() + 120_000), action: 'Record synced via mesh network', actor: 'Mesh Network', icon: timelineIcons[2], status: patient.isSynced ? 'complete' : 'pending' },
        { time: new Date(triageTime.getTime() + 180_000), action: `Transport assigned → ${hospital.name}`, actor: 'Command Center', icon: timelineIcons[3], status: isTransportComplete ? 'complete' : (patient.triageStatus === 'GREEN' ? 'pending' : 'active') },
        { time: new Date(triageTime.getTime() + 900_000), action: isTransportComplete ? `Handover complete → Admitted to ${hospital.name}` : 'Hospital handover & ER admission', actor: hospital.name, icon: timelineIcons[4], status: isTransportComplete ? 'complete' : 'pending' },
    ];

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-accent/5 rounded-full blur-3xl -z-10" />

                <div className="max-w-5xl mx-auto">
                    {/* Back Button & Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 bg-white border border-border-subtle rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-emerald-deep">Patient #{patient.id.slice(0, 6)}</h1>
                            <p className="text-sm text-txt-secondary">
                                Registered: {new Date(patient.timestamp).toLocaleString()}
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
                                <h2 className="text-lg font-bold text-emerald-deep mb-6">Patient Journey Timeline</h2>
                                <div className="relative">
                                    {/* Vertical line */}
                                    <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-accent via-emerald-300 to-gray-200" />

                                    <div className="space-y-6">
                                        {timeline.map((event, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 + i * 0.1 }}
                                                className="flex items-start gap-4 relative"
                                            >
                                                {/* Node */}
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 ${
                                                    event.status === 'complete' ? 'bg-teal-accent/20 text-teal-700 ring-2 ring-teal-accent' :
                                                    event.status === 'active' ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400 animate-pulse' :
                                                    'bg-gray-100 text-gray-400 ring-2 ring-gray-300'
                                                }`}>
                                                    {event.icon}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 pb-2">
                                                    <p className={`font-semibold text-sm ${
                                                        event.status === 'complete' ? 'text-emerald-deep' :
                                                        event.status === 'active' ? 'text-yellow-700' :
                                                        'text-txt-muted'
                                                    }`}>
                                                        {event.action}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-xs text-txt-muted">{event.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="text-xs text-txt-muted">•</span>
                                                        <span className="text-xs text-txt-secondary">{event.actor}</span>
                                                    </div>
                                                </div>

                                                {/* Status */}
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${
                                                    event.status === 'complete' ? 'bg-green-100 text-green-700' :
                                                    event.status === 'active' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {event.status}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
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

                            {/* Recommended Hospital */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="surface-card p-6"
                            >
                                <h3 className="text-sm font-bold text-emerald-deep mb-3 uppercase tracking-wide">Recommended Hospital</h3>
                                <div className="space-y-2">
                                    <p className="font-bold text-emerald-deep">{hospital.name}</p>
                                    <p className="text-xs text-txt-muted">{hospital.location.address}</p>
                                    <div className="flex gap-3 mt-2">
                                        <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-center flex-1">
                                            <span className="block text-lg font-bold">
                                                {hospital.beds.icu ? hospital.beds.icu.total - hospital.beds.icu.occupied : hospital.beds.total - hospital.beds.occupied}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold">Avail Beds</span>
                                        </div>
                                        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-center flex-1">
                                            <span className="block text-lg font-bold">{hospital.ambulanceAvailable}</span>
                                            <span className="text-[10px] uppercase font-bold">Ambulance</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Resource Checklist */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="surface-card p-6"
                            >
                                <h3 className="text-sm font-bold text-emerald-deep mb-3 uppercase tracking-wide">Required Resources</h3>
                                <ul className="space-y-2">
                                    {checklist.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-teal-accent mt-0.5">✓</span>
                                            <span className="text-txt-primary">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowQR(!showQR)}
                                    className="w-full py-3 bg-gradient-to-r from-emerald-deep to-teal-accent text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                    <span>{showQR ? 'Hide QR Wristband' : 'Generate QR Wristband'}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        import('@/lib/fhir').then(m => m.downloadFHIRRecord(patient));
                                        toast.success('ABDM FHIR R4 Record Exported');
                                    }}
                                    className="w-full py-3 bg-white border-2 border-indigo-600 text-indigo-700 font-bold rounded-xl shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Export ABDM / FHIR R4 JSON
                                </button>
                            </div>

                            {/* QR Wristband */}
                            {showQR && <QRWristband patient={patient} />}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
