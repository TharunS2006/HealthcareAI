/**
 * Command Dashboard - Modern Medcare
 * Real-time patient overview and triage statistics with live map
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePatientStore } from '@/stores/patientStore';
import { Patient } from '@/types/patient';
import Sidebar from '@/components/shared/Sidebar';
import HospitalCard from '@/components/dashboard/HospitalCard';
import { HOSPITALS } from '@/lib/data/hospitals';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import for Leaflet (SSR-incompatible)
const LiveMap = dynamic(() => import('@/components/dashboard/LiveMap'), { ssr: false });

import DemoModeToggle from '@/components/shared/DemoModeToggle';

export default function DashboardPage() {
    const { patients, loadPatients, unsyncedCount } = usePatientStore();
    const [stats, setStats] = useState({
        red: 0,
        yellow: 0,
        green: 0,
        total: 0,
    });

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    useEffect(() => {
        const red = patients.filter(p => p.triageStatus === 'RED').length;
        const yellow = patients.filter(p => p.triageStatus === 'YELLOW').length;
        const green = patients.filter(p => p.triageStatus === 'GREEN').length;

        setStats({ red, yellow, green, total: patients.length });
    }, [patients]);

    const getStatusBadge = (status: Patient['triageStatus']) => {
        switch (status) {
            case 'RED': return <span className="px-3 py-1 rounded-full text-xs font-bold badge-red shadow-sm">CRITICAL</span>;
            case 'YELLOW': return <span className="px-3 py-1 rounded-full text-xs font-bold badge-yellow shadow-sm">URGENT</span>;
            case 'GREEN': return <span className="px-3 py-1 rounded-full text-xs font-bold badge-green shadow-sm">STABLE</span>;
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative overflow-x-hidden w-full">
                {/* Background decoration */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-accent/5 rounded-full blur-3xl -z-10" />

                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-emerald-deep tracking-tight">Main Command</h1>
                        <p className="text-txt-secondary text-sm mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Operations Center
                        </p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        <DemoModeToggle />
                        {unsyncedCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-bold shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                {unsyncedCount} Pending Sync
                            </div>
                        )}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-accent to-emerald-600 text-white flex items-center justify-center font-bold shadow-lg shadow-teal-accent/30">
                            A
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    {/* Stat Card: Total */}
                    <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between h-36 border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">Total Census</p>
                                <h3 className="text-4xl font-bold text-emerald-deep mt-2">{stats.total}</h3>
                            </div>
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
                        </div>
                    </motion.div>

                    {/* Stat Card: Critical */}
                    <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between h-36 border-l-4 border-l-status-red">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">Critical (Red)</p>
                                <h3 className="text-4xl font-bold text-status-red mt-2">{stats.red}</h3>
                            </div>
                            <div className="p-2.5 bg-red-50 text-status-red rounded-xl">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-status-red h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.red / (stats.total || 1)) * 100}%` }} />
                        </div>
                    </motion.div>

                    {/* Stat Card: Urgent */}
                    <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between h-36 border-l-4 border-l-status-yellow">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">Urgent (Yellow)</p>
                                <h3 className="text-4xl font-bold text-status-yellow mt-2">{stats.yellow}</h3>
                            </div>
                            <div className="p-2.5 bg-yellow-50 text-status-yellow rounded-xl">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-status-yellow h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.yellow / (stats.total || 1)) * 100}%` }} />
                        </div>
                    </motion.div>

                    {/* Stat Card: Stable */}
                    <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between h-36 border-l-4 border-l-status-green">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">Stable (Green)</p>
                                <h3 className="text-4xl font-bold text-status-green mt-2">{stats.green}</h3>
                            </div>
                            <div className="p-2.5 bg-green-50 text-status-green rounded-xl">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-status-green h-full rounded-full transition-all duration-1000" style={{ width: `${(stats.green / (stats.total || 1)) * 100}%` }} />
                        </div>
                    </motion.div>
                </div>

                {/* Live Map Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-8"
                >
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-emerald-deep">Live Field Map</h2>
                            <p className="text-xs text-txt-muted">Real-time patient locations & hospital proximity</p>
                        </div>
                        <span className="text-xs font-bold text-teal-accent flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-accent" />
                            {patients.filter(p => p.gps.lat !== 0).length} active pins
                        </span>
                    </div>
                    <div className="surface-card overflow-hidden h-[400px]">
                        <LiveMap patients={patients} className="h-full" />
                    </div>
                </motion.div>

                {/* Hospital Capacity Section */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="mb-8"
                >
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-emerald-deep">Network Capacity Status</h2>
                            <p className="text-xs text-txt-muted">Real-time availability across regional centers</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {HOSPITALS.map(hospital => (
                            <HospitalCard key={hospital.id} hospital={hospital} />
                        ))}
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Patient List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-2 surface-card p-6 bg-white/90 backdrop-blur"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-emerald-deep">Active Patient Queue</h2>
                            <button className="text-xs font-bold text-teal-accent border border-teal-accent px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors">
                                EXPORT DATA
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border-subtle text-left">
                                        <th className="pb-4 pl-2 text-xs font-bold text-txt-muted uppercase tracking-wider">Patient Details</th>
                                        <th className="pb-4 text-xs font-bold text-txt-muted uppercase tracking-wider">Status</th>
                                        <th className="pb-4 text-xs font-bold text-txt-muted uppercase tracking-wider">Key Vitals</th>
                                        <th className="pb-4 text-xs font-bold text-txt-muted uppercase tracking-wider">Consciousness</th>
                                        <th className="pb-4 text-xs font-bold text-txt-muted uppercase tracking-wider text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {patients.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-txt-muted text-sm">
                                                No active patients. Waiting for new triage data...
                                            </td>
                                        </tr>
                                    ) : (
                                        patients.slice().reverse().slice(0, 8).map((patient) => (
                                            <tr key={patient.id} className="group hover:bg-teal-50/30 transition-colors">
                                                <td className="py-4 pl-2">
                                                    <div className="font-mono text-xs text-txt-muted">ID: {patient.id.slice(0, 6)}</div>
                                                    <div className="text-sm font-semibold text-emerald-deep">
                                                        {new Date(patient.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="py-4">{getStatusBadge(patient.triageStatus)}</td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="font-medium text-emerald-deep">
                                                            <span className="text-xs text-txt-muted font-normal mr-1">SpO2</span>
                                                            {patient.vitals.spo2}%
                                                        </span>
                                                        <span className="font-medium text-emerald-deep">
                                                            <span className="text-xs text-txt-muted font-normal mr-1">Pulse</span>
                                                            {patient.vitals.heartRate}
                                                        </span>
                                                        {patient.vitals.bloodPressure && (
                                                            <span className="font-medium text-emerald-deep">
                                                                <span className="text-xs text-txt-muted font-normal mr-1">BP</span>
                                                                {patient.vitals.bloodPressure.systolic}/{patient.vitals.bloodPressure.diastolic}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2 text-sm flex-wrap">
                                                        {patient.vitals.consciousness && (
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${patient.vitals.consciousness === 'ALERT'
                                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                                : 'bg-red-50 text-red-700 border-red-200'
                                                                }`}>
                                                                {patient.vitals.consciousness}
                                                            </span>
                                                        )}
                                                        {patient.transportStatus === 'COMPLETED' ? (
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm">
                                                                ✓ ADMITTED
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200">
                                                                🚑 IN TRANSIT
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right pr-2">
                                                    <Link href={`/dashboard/${patient.id}`} className="text-teal-accent hover:text-teal-hover bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                                                        VIEW
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Triage Distribution Chart */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="surface-card p-6 bg-white/90 backdrop-blur flex flex-col"
                    >
                        <h2 className="text-lg font-bold text-emerald-deep mb-6">Triage Distribution</h2>
                        <div className="flex-1 min-h-[250px] w-full flex items-end justify-center px-2 gap-8 pb-6 border-b border-border-subtle">
                            {/* Real data bars: RED, YELLOW, GREEN */}
                            {[
                                { label: 'Critical', count: stats.red, color: 'from-red-500 to-red-400', max: stats.total },
                                { label: 'Urgent', count: stats.yellow, color: 'from-yellow-500 to-yellow-400', max: stats.total },
                                { label: 'Stable', count: stats.green, color: 'from-emerald-500 to-teal-400', max: stats.total },
                            ].map((bar, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 w-full max-w-[80px]">
                                    <span className="text-2xl font-bold text-emerald-deep">{bar.count}</span>
                                    <div className="w-full bg-gray-100/50 rounded-t-lg relative group h-[180px] flex items-end overflow-hidden">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${bar.max > 0 ? Math.max(8, (bar.count / bar.max) * 100) : 8}%` }}
                                            transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
                                            className={`w-full bg-gradient-to-t ${bar.color} rounded-t-lg transition-colors relative`}
                                        >
                                            <div className="absolute top-0 w-full h-1 bg-white/30" />
                                        </motion.div>
                                    </div>
                                    <span className="text-xs font-bold text-txt-muted uppercase">{bar.label}</span>
                                </div>
                            ))}
                        </div>
                        {stats.total === 0 && (
                            <p className="text-center text-sm text-txt-muted mt-4">No patients triaged yet</p>
                        )}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
