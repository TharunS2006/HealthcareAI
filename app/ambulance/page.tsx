/**
 * Ambulance Crew Interface - NalamMesh
 * Direct task list for paramedics/drivers
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePatientStore } from '@/stores/patientStore';
import { getRecommendedHospital, getResourceChecklist, HOSPITALS } from '@/lib/data/hospitals';
import Sidebar from '@/components/shared/Sidebar';
import toast from 'react-hot-toast';

export default function AmbulancePage() {
    const { patients, loadPatients, updatePatient } = usePatientStore();
    const [assignedPatients, setAssignedPatients] = useState<any[]>([]);

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    useEffect(() => {
        // Filter for active patients who need transport (not yet completed)
        const relevant = patients
            .filter(p => p.transportStatus !== 'COMPLETED')
            .sort((a, b) => {
                const priority = { RED: 0, YELLOW: 1, GREEN: 2 };
                const diff = priority[a.triageStatus] - priority[b.triageStatus];
                if (diff !== 0) return diff;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            })
            .map(p => ({
                ...p,
                destination: getRecommendedHospital(p.triageStatus),
                checklist: getResourceChecklist(p.vitals.injuryType),
                eta: Math.floor(Math.random() * 15) + 5
            }));
        setAssignedPatients(relevant);
    }, [patients]);

    const handleCallHospital = (phone: string) => {
        toast.success(`Calling ${phone}...`);
        window.location.href = `tel:${phone}`;
    };

    const handleCompleteTask = async (id: string) => {
        const p = patients.find(patient => patient.id === id);
        if (p) {
            await updatePatient({ ...p, transportStatus: 'COMPLETED' });
        }
        toast.success('Transport Completed. Patient Handover Done.');
        setAssignedPatients(prev => prev.filter(task => task.id !== id));
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl -z-10" />

                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-emerald-deep tracking-tight flex items-center gap-3">
                        <svg className="w-8 h-8 text-emerald-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0l2 2h2a1 1 0 001-1v-5a1 1 0 00-.29-.71l-3-3A1 1 0 0014 9h-1m-6 8h.01M17 16h.01" />
                        </svg>
                        Ambulance Crew Portal
                    </h1>
                    <p className="text-txt-secondary text-sm mt-1">Vehicle ID: TN-02-G-108 • Unit 42 • Active</p>
                </header>

                <div className="space-y-6">
                    {assignedPatients.length === 0 ? (
                        <div className="surface-card p-12 text-center opacity-70">
                            <h3 className="text-xl font-bold text-txt-secondary">No Active Transport Tasks</h3>
                            <p className="text-sm">Standby for dispatch.</p>
                        </div>
                    ) : (
                        assignedPatients.map((task) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`surface-card p-6 border-l-8 ${task.triageStatus === 'RED' ? 'border-l-status-red' :
                                    task.triageStatus === 'YELLOW' ? 'border-l-status-yellow' : 'border-l-emerald-500'
                                    } shadow-lg relative overflow-hidden`}
                            >
                                {/* Background Warning Strip for RED */}
                                {task.triageStatus === 'RED' && (
                                    <div className="absolute top-0 right-0 p-1 bg-red-100 text-red-800 text-[10px] font-bold px-3 rounded-bl-xl">
                                        CRITICAL TRANSPORT
                                    </div>
                                )}

                                <div className="grid md:grid-cols-3 gap-6">
                                    {/* Column 1: Patient & Vitals */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg text-emerald-deep">Patient #{task.id.slice(0, 4)}</h3>
                                                <p className="text-xs text-txt-muted">{new Date(task.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${task.triageStatus === 'RED' ? 'bg-red-100 text-red-700' :
                                                task.triageStatus === 'YELLOW' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {task.triageStatus} PRIORITY
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <div>
                                                <span className="text-txt-muted text-[10px] uppercase block">Pulse</span>
                                                <span className="font-bold text-red-600">{task.vitals.heartRate} bpm</span>
                                            </div>
                                            <div>
                                                <span className="text-txt-muted text-[10px] uppercase block">SpO2</span>
                                                <span className={`font-bold ${task.vitals.spo2 < 90 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                    {task.vitals.spo2}%
                                                </span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-txt-muted text-[10px] uppercase block">Injury</span>
                                                <span className="font-medium text-emerald-deep truncate block" title={task.vitals.injuryType}>
                                                    {task.vitals.injuryType || 'Trauma unspecified'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Destination & ETA */}
                                    <div className="space-y-3 border-t md:border-t-0 md:border-l border-gray-100 md:pl-6 pt-4 md:pt-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <svg className="w-6 h-6 text-emerald-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <div>
                                                <p className="text-xs text-txt-muted font-bold uppercase">Destination</p>
                                                <h4 className="font-bold text-emerald-deep leading-tight">{task.destination.name}</h4>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-center flex-1">
                                                <span className="block text-xl font-bold">{task.eta}</span>
                                                <span className="text-[10px] uppercase font-bold">Mins ETA</span>
                                            </div>
                                            <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-center flex-1">
                                                <span className="block text-xl font-bold">{task.destination.capacity.icu.total - task.destination.capacity.icu.occupied}</span>
                                                <span className="text-[10px] uppercase font-bold">ICU Beds</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleCallHospital(task.destination.contact)}
                                            className="w-full py-2 bg-white border-2 border-emerald-500 text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            Call ER Control
                                        </button>
                                    </div>

                                    {/* Column 3: Response Protocol */}
                                    <div className="space-y-3 border-t md:border-t-0 md:border-l border-gray-100 md:pl-6 pt-4 md:pt-0">
                                        <h4 className="font-bold text-sm text-txt-secondary uppercase tracking-wide">Required Resources</h4>
                                        <ul className="space-y-1">
                                            {task.checklist.map((item: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-txt-primary">
                                                    <span className="text-teal-500 mt-1">✓</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            onClick={() => handleCompleteTask(task.id)}
                                            className="w-full mt-4 py-3 bg-emerald-deep text-white font-bold rounded-xl shadow-lg hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span>Complete Transport</span>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
