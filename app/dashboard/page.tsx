/**
 * District & Facility Health Dashboard — NalamMesh
 * Administrative View for District Health Officer (DHO) & Medical Superintendents
 * Gadchiroli District, Maharashtra (SIH PS#26133)
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import DemoModeToggle from '@/components/shared/DemoModeToggle';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useQueueStore } from '@/stores/queueStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import Link from 'next/link';

export default function DashboardPage() {
    const { patients, loadPatients } = usePatientStore();
    const { referrals, loadReferrals } = useReferralStore();
    const { queue, loadQueue } = useQueueStore();
    const { facilities, loadAll } = useFacilityStore();
    const { language } = useLanguageStore();

    useEffect(() => {
        loadPatients();
        loadReferrals();
        loadQueue();
        loadAll();
    }, [loadPatients, loadReferrals, loadQueue, loadAll]);

    // Aggregate District Metrics
    const redCount = patients.filter(p => p.triageStatus === 'RED').length;
    const yellowCount = patients.filter(p => p.triageStatus === 'YELLOW').length;
    const greenCount = patients.filter(p => p.triageStatus === 'GREEN').length;

    const pendingRefs = referrals.filter(r => r.status === 'INITIATED' || r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT').length;
    const waitingQueue = queue.filter(q => q.status === 'WAITING').length;

    // Collect High Risk Flagged Patients
    const highRiskPatients = patients.filter(p => (p.highRiskFlags && p.highRiskFlags.length > 0) || p.triageStatus === 'RED');

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <MobileMenu />

                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Top Header */}
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                                    Government of Maharashtra • Public Health Dept
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                {t('navDashboard', language)} — Gadchiroli
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Real-time monitoring across Sub-Centres, PHCs, CHCs, and District Hospital
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <DemoModeToggle />
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-sm">
                                <span>📶 Mesh Relay Online</span>
                            </div>
                        </div>
                    </header>

                    {/* Row 1: Key Performance Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Total Census */}
                        <div className="surface-card p-5 border-l-4 border-l-blue-600 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                                        {t('patientsToday', language)}
                                    </span>
                                    <h3 className="text-3xl font-extrabold text-emerald-deep mt-1">
                                        {patients.length + 142}
                                    </h3>
                                </div>
                                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-lg">👥</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-3">
                                <span>↑ +14%</span>
                                <span className="text-txt-muted font-normal">vs. tribal weekly avg</span>
                            </div>
                        </div>

                        {/* 2. Pending Referrals */}
                        <div className="surface-card p-5 border-l-4 border-l-amber-500 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                                        {t('pendingReferrals', language)}
                                    </span>
                                    <h3 className="text-3xl font-extrabold text-amber-600 mt-1">
                                        {pendingRefs}
                                    </h3>
                                </div>
                                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl text-lg">🔄</span>
                            </div>
                            <div className="text-xs text-amber-800 font-semibold mt-3 flex items-center justify-between">
                                <span>2 In-Transit (102/108)</span>
                                <Link href="/referrals" className="underline text-amber-900">View →</Link>
                            </div>
                        </div>

                        {/* 3. Live OPD Queue */}
                        <div className="surface-card p-5 border-l-4 border-l-teal-accent flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                                        {t('activeQueue', language)} (PHC)
                                    </span>
                                    <h3 className="text-3xl font-extrabold text-teal-700 mt-1">
                                        {waitingQueue}
                                    </h3>
                                </div>
                                <span className="p-2 bg-teal-50 text-teal-700 rounded-xl text-lg">⏱️</span>
                            </div>
                            <div className="text-xs text-txt-muted mt-3">
                                Avg. Wait Time: <strong className="text-emerald-deep">16 mins</strong>
                            </div>
                        </div>

                        {/* 4. High-Risk Maternal & NCD */}
                        <div className="surface-card p-5 border-l-4 border-l-status-red flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                                        High-Risk Alerts
                                    </span>
                                    <h3 className="text-3xl font-extrabold text-status-red mt-1">
                                        {highRiskPatients.length}
                                    </h3>
                                </div>
                                <span className="p-2 bg-red-50 text-status-red rounded-xl text-lg">🚨</span>
                            </div>
                            <div className="text-xs text-status-red font-semibold mt-3">
                                {redCount} Critical • Overdue Follow-ups
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Facility Hierarchy Tree (Left) & High-Risk Alerts (Right) */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Facility Hierarchy Tree (7 cols) */}
                        <div className="lg:col-span-7 surface-card p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-base font-bold text-emerald-deep">
                                        Maharashtra Health Continuum Tree
                                    </h2>
                                    <p className="text-xs text-txt-muted">
                                        District Hospital $\to$ Sub-District $\to$ CHC $\to$ PHC $\to$ Sub-Centres
                                    </p>
                                </div>
                                <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                    7 Nodes Connected
                                </span>
                            </div>

                            {/* Visual Hierarchy Nodes */}
                            <div className="space-y-3 flex-1 overflow-y-auto pr-1">

                                {/* Level 1: District Hospital */}
                                <div className="p-3.5 bg-gradient-to-r from-emerald-deep to-teal-800 text-white rounded-xl shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                Apex Facility • District Hospital (DH)
                                            </span>
                                            <h3 className="font-bold text-sm mt-1">District Hospital, Gadchiroli</h3>
                                            <p className="text-[11px] text-teal-100">Beds: 235/300 Occupied • ICU: 16/20 • Specialists: 24</p>
                                        </div>
                                        <span className="text-xs bg-emerald-400/30 text-white font-bold px-2 py-1 rounded">
                                            Online 24x7
                                        </span>
                                    </div>
                                </div>

                                <div className="pl-6 border-l-2 border-dashed border-teal-300 ml-6 space-y-3">

                                    {/* Level 2: Sub-District Hospital */}
                                    <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] bg-teal-200/60 text-teal-800 px-2 py-0.5 rounded font-bold uppercase">
                                                    First Referral Unit • SDH (Aheri)
                                                </span>
                                                <h4 className="font-bold text-xs text-emerald-deep mt-0.5">Sub-District Hospital, Aheri</h4>
                                                <p className="text-[11px] text-txt-muted">Beds: 74/100 • Emergency Obstetric Care (CEmONC) • Blood Unit</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded border">
                                                3 Ambulances
                                            </span>
                                        </div>
                                    </div>

                                    {/* Level 3: CHC */}
                                    <div className="pl-4 border-l-2 border-dashed border-teal-300 space-y-2.5">
                                        <div className="p-3 bg-gray-50 border border-border-subtle rounded-xl">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase">
                                                        Community Health Centre (CHC)
                                                    </span>
                                                    <h4 className="font-bold text-xs text-emerald-deep mt-0.5">CHC Etapalli</h4>
                                                    <p className="text-[11px] text-txt-muted">Beds: 21/30 • 24x7 Delivery Care • Teleconsult Node</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-emerald-700">Online</span>
                                            </div>
                                        </div>

                                        {/* Level 4: PHCs */}
                                        <div className="pl-4 border-l-2 border-dashed border-teal-300 space-y-2">
                                            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">PHC</span>
                                                        <span className="font-bold text-xs text-emerald-deep ml-1.5">PHC Bhamragad</span>
                                                        <span className="text-[10px] text-txt-muted ml-2">(Beds: 6/10 • 2 Doctors • Solar Mesh Active)</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-teal-700">Station Active</span>
                                                </div>

                                                {/* Level 5: Sub-Centres / Arogya Mandir */}
                                                <div className="mt-2 pl-3 pt-2 border-t border-emerald-100 flex gap-2 flex-wrap text-[10px]">
                                                    <span className="bg-white px-2 py-0.5 rounded border text-txt-secondary font-medium">
                                                        📍 Sub-Centre Kothi (CHO + ASHA)
                                                    </span>
                                                    <span className="bg-white px-2 py-0.5 rounded border text-txt-secondary font-medium">
                                                        📍 Sub-Centre Govindpur (ANM)
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-2.5 bg-gray-50 border border-border-subtle rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[9px] bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded font-bold">PHC</span>
                                                        <span className="font-bold text-xs text-emerald-deep ml-1.5">PHC Perimili</span>
                                                    </div>
                                                    <span className="text-[10px] text-txt-muted">Beds: 3/6</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Risk Alerts & Action List (5 cols) */}
                        <div className="lg:col-span-5 surface-card p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-base font-bold text-emerald-deep">
                                        High-Risk Patient Action List
                                    </h2>
                                    <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                                        Action Required
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {highRiskPatients.map((p) => (
                                        <div
                                            key={p.id}
                                            className="p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all space-y-1.5"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-bold text-xs text-emerald-deep">{p.name}</span>
                                                    <span className="text-[10px] text-txt-muted ml-2">({p.age}y / {p.gender}) • {p.village}</span>
                                                </div>
                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                                    p.triageStatus === 'RED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {p.triageStatus} PRIORITY
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-txt-secondary leading-snug line-clamp-2">
                                                {p.vitals.injuryType}
                                            </p>

                                            <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px]">
                                                <span className="text-txt-muted">
                                                    BP: {p.vitals.bloodPressure?.systolic || 'N/A'}/{p.vitals.bloodPressure?.diastolic || 'N/A'} • SpO2: {p.vitals.spo2}%
                                                </span>
                                                <Link
                                                    href={`/opd`}
                                                    className="font-bold text-teal-700 hover:underline"
                                                >
                                                    Open Record →
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Emergency Action Banner */}
                            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-rose-900 block">108 / 102 Emergency Dispatch</span>
                                    <span className="text-rose-700 text-[11px]">2 ambulances active in Etapalli-Bhamragad corridor</span>
                                </div>
                                <Link
                                    href="/referrals"
                                    className="px-3 py-1.5 bg-status-red text-white font-bold rounded-lg hover:opacity-90"
                                >
                                    Track
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Quality of Public Healthcare Indicators (IPHS Benchmark) */}
                    <div className="surface-card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-base font-bold text-emerald-deep">
                                    Indian Public Health Standards (IPHS) Quality Indicators
                                </h2>
                                <p className="text-xs text-txt-muted">
                                    Quality, continuity, and accountability benchmarks for Gadchiroli rural district
                                </p>
                            </div>
                            <span className="text-xs text-txt-muted">Quarterly Target: 85%+</span>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Referral Completion Rate */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-emerald-deep">Referral Completion Rate</span>
                                    <span className="text-amber-700">78%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '78%' }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">Target: 90% • +6% vs last month</span>
                            </div>

                            {/* Average Wait Time */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-emerald-deep">Avg. OPD Wait Time</span>
                                    <span className="text-emerald-700">16 mins (88%)</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: '88%' }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">Under 30 mins standard</span>
                            </div>

                            {/* Essential Medicine Availability */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-emerald-deep">IPHS Drug Stock Level</span>
                                    <span className="text-teal-700">82%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-teal-600 h-full rounded-full" style={{ width: '82%' }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">4 items low in remote SCs</span>
                            </div>

                            {/* Maternal ANC Follow-up Rate */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-emerald-deep">High-Risk ANC Adherence</span>
                                    <span className="text-indigo-700">91%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: '91%' }} />
                                </div>
                                <span className="text-[10px] text-txt-muted">ASHA home visits active</span>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
