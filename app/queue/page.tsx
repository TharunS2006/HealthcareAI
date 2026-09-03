/**
 * Queue & Token Management Suite — NalamMesh
 * OPD Waiting Time Reduction & Priority Calling (SIH PS#26133)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useQueueStore } from '@/stores/queueStore';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import toast from 'react-hot-toast';

export default function QueuePage() {
    const {
        queue,
        currentServing,
        loadQueue,
        callNext,
        prioritizeEntry,
        updateEntryStatus,
        selectedFacilityId,
        setSelectedFacilityId,
    } = useQueueStore();

    const [isTvMode, setIsTvMode] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadQueue();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [loadQueue]);

    const waitingPatients = queue.filter(q => q.status === 'WAITING');
    const completedPatients = queue.filter(q => q.status === 'COMPLETED');

    // TV / Full-Screen Display Mode for Waiting Room Lobby
    if (isTvMode) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col justify-between select-none">
                {/* TV Header */}
                <header className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-wide text-emerald-400 uppercase">
                                प्राथमिक आरोग्य केंद्र, भामरागड (PHC Bhamragad)
                            </h1>
                            <p className="text-sm text-slate-400">
                                OPD Token Calling Display • सार्वजनिक आरोग्य विभाग महाराष्ट्र शासन
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-3xl font-mono font-extrabold text-teal-300">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-xs text-slate-400">{currentTime.toDateString()}</div>
                        </div>
                        <button
                            onClick={() => setIsTvMode(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700"
                        >
                            Exit TV Mode (Esc)
                        </button>
                    </div>
                </header>

                {/* Giant Live Serving Section */}
                <div className="grid md:grid-cols-12 gap-8 my-8">
                    <div className="md:col-span-7 bg-slate-900/90 border-2 border-emerald-500/60 rounded-3xl p-10 flex flex-col justify-center items-center text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-4 left-6 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700">
                            ● Now Serving / सध्या तपासणी सुरू
                        </div>

                        {currentServing ? (
                            <motion.div
                                key={currentServing.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="my-6 space-y-3"
                            >
                                <div className="text-8xl md:text-9xl font-extrabold font-mono text-emerald-400 tracking-tighter drop-shadow-lg">
                                    {currentServing.tokenNumber}
                                </div>
                                <h2 className="text-4xl font-extrabold text-white">
                                    {currentServing.patientName}
                                </h2>
                                <p className="text-xl text-slate-300">
                                    Room 2 • {currentServing.consultingDoctor || 'Dr. Suresh Atram'}
                                </p>
                            </motion.div>
                        ) : (
                            <div className="py-16 text-slate-500 text-2xl font-bold">
                                All Waiting Patients Consulted
                            </div>
                        )}
                    </div>

                    {/* Next in Queue on TV */}
                    <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-300 mb-4 pb-2 border-b border-slate-800 uppercase tracking-wider flex justify-between">
                            <span>Up Next / पुढील रुग्ण</span>
                            <span className="text-sm text-teal-400">{waitingPatients.length} Waiting</span>
                        </h3>

                        <div className="space-y-3 flex-1 overflow-y-auto">
                            {waitingPatients.slice(0, 5).map((entry, idx) => (
                                <div
                                    key={entry.id}
                                    className={`flex justify-between items-center p-4 rounded-2xl border ${
                                        entry.priority === 'EMERGENCY'
                                            ? 'bg-red-950/40 border-red-500 text-red-200'
                                            : 'bg-slate-800/60 border-slate-700 text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-bold text-slate-500 font-mono">#{idx + 1}</span>
                                        <div>
                                            <div className="text-2xl font-mono font-extrabold text-emerald-300">
                                                {entry.tokenNumber}
                                            </div>
                                            <div className="text-sm font-semibold text-slate-200">{entry.patientName}</div>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                        entry.priority === 'EMERGENCY' ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'
                                    }`}>
                                        {entry.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TV Footer */}
                <footer className="text-center text-xs text-slate-500 border-t border-slate-800 pt-3">
                    NalamMesh Digital Public Infrastructure • Smart India Hackathon PS#26133
                </footer>
            </div>
        );
    }

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />

                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                    Smart Queue & Token Calling Engine
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Queue Management — PHC Bhamragad
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Prioritize critical triage patients, track waiting times, and streamline doctor consultation
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsTvMode(true)}
                                className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800 flex items-center gap-2"
                            >
                                <span>📺 Launch Full-Screen TV Display</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Area: 2 Columns */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Left Column (7 cols): Live Serving Banner & Waiting List */}
                        <div className="lg:col-span-7 space-y-6">

                            {/* Now Serving Big Card */}
                            <div className="surface-card p-6 border-l-4 border-l-emerald-deep bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                                        ● Currently In Consultation / चालू तपासणी
                                    </span>
                                    <span className="text-xs text-txt-muted">Room 2 • General OPD</span>
                                </div>

                                {currentServing ? (
                                    <div className="py-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-5xl md:text-6xl font-extrabold font-mono text-emerald-deep tracking-tight">
                                                {currentServing.tokenNumber}
                                            </div>
                                            <h3 className="text-xl font-bold text-emerald-deep mt-1">
                                                {currentServing.patientName} ({currentServing.patientAge}y / {currentServing.patientGender})
                                            </h3>
                                            <p className="text-xs text-txt-muted">
                                                Complaint: {currentServing.chiefComplaint}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => updateEntryStatus(currentServing.id, 'COMPLETED')}
                                            className="px-4 py-3 bg-emerald-deep text-white text-xs font-bold rounded-xl shadow hover:bg-emerald-dark"
                                        >
                                            ✓ Finish Consultation
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-txt-muted text-sm font-semibold">
                                        Doctor ready for next patient. Click 'Call Next Patient' below.
                                    </div>
                                )}

                                {/* Calling Actions */}
                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button
                                        onClick={() => callNext()}
                                        className="flex-1 py-3.5 bg-gradient-to-r from-emerald-deep to-teal-accent text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>📢 Call Next Patient</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>

                            {/* Waiting Patients Table */}
                            <div className="surface-card p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-emerald-deep uppercase tracking-wider">
                                        Waiting Queue ({waitingPatients.length} Patients)
                                    </h3>
                                    <span className="text-xs text-txt-muted">Est. Avg. Wait: ~15 mins</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-subtle text-left text-txt-muted uppercase font-bold">
                                                <th className="pb-3">Token</th>
                                                <th className="pb-3">Patient Name</th>
                                                <th className="pb-3">Priority</th>
                                                <th className="pb-3">Wait Time</th>
                                                <th className="pb-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {waitingPatients.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-txt-muted">
                                                        No patients waiting in queue.
                                                    </td>
                                                </tr>
                                            ) : (
                                                waitingPatients.map((entry) => (
                                                    <tr key={entry.id} className="hover:bg-teal-50/30 transition-colors">
                                                        <td className="py-3.5 font-mono font-bold text-sm text-emerald-deep">
                                                            {entry.tokenNumber}
                                                        </td>
                                                        <td className="py-3.5">
                                                            <div className="font-bold text-emerald-deep">{entry.patientName}</div>
                                                            <div className="text-[10px] text-txt-muted truncate max-w-[140px]">{entry.chiefComplaint}</div>
                                                        </td>
                                                        <td className="py-3.5">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                                                                entry.priority === 'URGENT' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-green-100 text-green-800'
                                                            }`}>
                                                                {entry.priority}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 text-txt-muted">
                                                            ~{entry.estimatedWaitMinutes} mins
                                                        </td>
                                                        <td className="py-3.5 text-right space-x-1.5">
                                                            {entry.priority !== 'EMERGENCY' && (
                                                                <button
                                                                    onClick={() => prioritizeEntry(entry.id)}
                                                                    className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded text-[10px]"
                                                                >
                                                                    Override ⚡
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => updateEntryStatus(entry.id, 'NO_SHOW')}
                                                                className="px-2 py-1 bg-gray-100 text-txt-secondary hover:bg-gray-200 font-medium rounded text-[10px]"
                                                            >
                                                                Skip
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Column (5 cols): Queue Analytics & Completed Summary */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* Queue Analytics Card */}
                            <div className="surface-card p-6 space-y-4">
                                <h3 className="text-sm font-bold text-emerald-deep uppercase tracking-wider">
                                    Queue Performance Today
                                </h3>

                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="p-3 bg-gray-50 rounded-xl border">
                                        <span className="text-xs text-txt-muted block">Consulted Today</span>
                                        <span className="text-3xl font-extrabold text-emerald-deep">{completedPatients.length + 38}</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border">
                                        <span className="text-xs text-txt-muted block">Avg. Consult Time</span>
                                        <span className="text-3xl font-extrabold text-teal-700">12 min</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs pt-2">
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-txt-muted">Peak OPD Inflow Time:</span>
                                        <span className="font-bold text-emerald-deep">09:30 AM - 11:30 AM</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-txt-muted">Emergency Overrides Handled:</span>
                                        <span className="font-bold text-status-red">4 Patients</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-txt-muted">On-duty Doctor:</span>
                                        <span className="font-bold text-emerald-deep">Dr. Suresh Atram</span>
                                    </div>
                                </div>
                            </div>

                            {/* Recently Completed Log */}
                            <div className="surface-card p-6">
                                <h3 className="text-xs font-bold text-emerald-deep uppercase tracking-wider mb-3">
                                    Completed Consultations Today
                                </h3>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {completedPatients.slice(0, 5).map((q) => (
                                        <div key={q.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-xs">
                                            <div>
                                                <span className="font-mono font-bold text-emerald-deep mr-2">{q.tokenNumber}</span>
                                                <span className="font-medium text-emerald-deep">{q.patientName}</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                                                ✓ Completed
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
