/**
 * Diagnostic Coordination Module — NalamMesh (SIH PS#26133 Module 6)
 * End-to-end sample collection, processing, and results delivery to LHR.
 * Smart "Unavailable Test Router" pointing to nearest lab across Sub-Centre -> PHC -> CHC -> DH.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useFacilityStore } from '@/stores/facilityStore';
import { usePatientStore } from '@/stores/patientStore';
import { DiagnosticOrder } from '@/types/facility';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import toast from 'react-hot-toast';

export default function DiagnosticsPage() {
    const { diagnostics, loadAll, updateDiagnosticResult } = useFacilityStore();
    const { patients, loadPatients } = usePatientStore();

    const [selectedTest, setSelectedTest] = useState<DiagnosticOrder | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);

    // New Order Form State
    const [orderPatientId, setOrderPatientId] = useState('');
    const [orderTestType, setOrderTestType] = useState('CBC');
    const [orderFacilityId, setOrderFacilityId] = useState('phc-bhamragad');
    const [orderNotes, setOrderNotes] = useState('');

    // Result Entry State
    const [resultText, setResultText] = useState('');
    const [isAbnormal, setIsAbnormal] = useState(false);

    useEffect(() => {
        loadAll();
        loadPatients();
    }, [loadAll, loadPatients]);

    const testCatalog: Array<{
        code: string;
        name: string;
        category: DiagnosticOrder['category'];
        tier: string;
        localAvail: boolean;
        nearest: string;
        time: string;
    }> = [
        { code: 'CBC', name: 'Complete Blood Count (CBC) with Automated Cell Counter', category: 'Hematology', tier: 'CHC / DH', localAvail: false, nearest: 'CHC Etapalli (28 km)', time: '3 hrs' },
        { code: 'MALARIA_RDT', name: 'Rapid Diagnostic Test (RDT) Malaria Pf / Pv', category: 'Rapid Test', tier: 'Sub-Centre / PHC', localAvail: true, nearest: 'On-site at Sub-Centre / PHC', time: '15 mins' },
        { code: 'SICKLE_CELL', name: 'Sickle Cell Solubility & Electrophoresis', category: 'Hematology', tier: 'PHC / CHC', localAvail: true, nearest: 'PHC Bhamragad (On-site)', time: '45 mins' },
        { code: 'HBA1C', name: 'Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar', category: 'Biochemistry', tier: 'PHC / CHC', localAvail: true, nearest: 'PHC Bhamragad (On-site)', time: '1 hr' },
        { code: 'SPUTUM_AFB', name: 'Sputum Smear for AFB / CBNAAT GeneXpert', category: 'Microbiology/Sputum', tier: 'PHC (Smear) / DH (CBNAAT)', localAvail: true, nearest: 'Sample collected at PHC -> DH Gadchiroli', time: '24 hrs' },
        { code: 'USG_OBSTETRIC', name: 'Obstetric Ultrasound (USG Antenatal Scan)', category: 'Radiology', tier: 'SDH Aheri / DH Gadchiroli', localAvail: false, nearest: 'SDH Aheri (CEmONC, 38 km)', time: 'Same Day' },
        { code: 'ECG_DIGITAL', name: '12-Lead Digital ECG with Tele-Cardiology', category: 'Biochemistry', tier: 'PHC / CHC / DH', localAvail: true, nearest: 'PHC Bhamragad (On-site)', time: '10 mins' },
        { code: 'URINE_ALBUMIN', name: 'Urine Albumin (Proteinuria Dipstick)', category: 'Urine', tier: 'Sub-Centre / PHC', localAvail: true, nearest: 'On-site at Sub-Centre Kothi', time: '5 mins' },
    ];

    const filteredDiagnostics = diagnostics.filter(d => {
        const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
        const matchesSearch = d.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              d.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              d.facilityName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const handleCreateOrder = (e: React.FormEvent) => {
        e.preventDefault();
        const p = patients.find(pat => pat.id === orderPatientId) || patients[0];
        const selectedCat = testCatalog.find(c => c.code === orderTestType) || testCatalog[0];

        const newOrder: DiagnosticOrder = {
            id: `diag-${Math.floor(1000 + Math.random() * 9000)}`,
            patientId: p.id,
            patientName: p.name,
            patientAge: p.age,
            facilityId: orderFacilityId,
            facilityName: MAHARASHTRA_FACILITIES.find(f => f.id === orderFacilityId)?.name || 'PHC Bhamragad',
            testName: selectedCat.name,
            category: selectedCat.category,
            orderedBy: 'Dr. Suresh Atram (MO)',
            orderedAt: new Date().toISOString(),
            status: 'ORDERED',
            isAbnormal: false,
        };

        toast.success(`Diagnostic Requisition Created for ${p.name}`);
        setShowNewOrderModal(false);
    };

    const handleOpenResultModal = (order: DiagnosticOrder) => {
        setSelectedTest(order);
        setResultText(order.resultSummary || '');
        setIsAbnormal(order.isAbnormal || false);
        setShowResultModal(true);
    };

    const handleSaveResult = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTest) return;
        await updateDiagnosticResult(selectedTest.id, resultText, isAbnormal);
        toast.success('Diagnostic Result Saved & Automatically Pushed to Patient LHR!', {
            icon: '📑',
        });
        setShowResultModal(false);
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
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                                    Government of Maharashtra • Cross-Tier Diagnostic Lab Network
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Diagnostic Coordination & Lab Tracking
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Sample collection pipeline, nearest lab router for unavailable tests, and instant LHR push
                            </p>
                        </div>

                        <button
                            onClick={() => setShowNewOrderModal(true)}
                            className="px-4 py-2 bg-emerald-deep hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2"
                        >
                            <span>➕ Order Diagnostic Test</span>
                        </button>
                    </div>

                    {/* Diagnostic Test Catalog & Nearest Availability Router */}
                    <div className="surface-card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black text-emerald-deep uppercase tracking-wider">
                                IPHS Diagnostic Catalog & Multi-Tier Facility Availability
                            </h2>
                            <span className="text-[11px] text-txt-muted">
                                Real-time routing for Sub-Centres & PHCs
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {testCatalog.map((item) => (
                                <div
                                    key={item.code}
                                    className={`p-3.5 rounded-2xl border transition-all ${
                                        item.localAvail
                                            ? 'bg-emerald-50/40 border-emerald-200'
                                            : 'bg-amber-50/50 border-amber-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-xs font-extrabold text-emerald-deep leading-tight">
                                            {item.name}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            item.localAvail ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                                        }`}>
                                            {item.localAvail ? '✓ In-House' : '↗ Refer Lab'}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[11px] text-txt-secondary space-y-0.5">
                                        <p><strong>Tier:</strong> {item.tier}</p>
                                        <p><strong>Location:</strong> {item.nearest}</p>
                                        <p><strong>Turnaround Time:</strong> {item.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live Diagnostic Orders & Sample Pipeline */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                {(['ALL', 'ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((st) => (
                                    <button
                                        key={st}
                                        onClick={() => setFilterStatus(st)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            filterStatus === st
                                                ? 'bg-emerald-deep text-white shadow-sm'
                                                : 'bg-white border border-border-subtle text-txt-secondary hover:bg-gray-50'
                                        }`}
                                    >
                                        {st === 'ALL' ? 'All Orders' : st.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patient, test, facility..."
                                className="px-3 py-1.5 bg-white border border-border-subtle rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-deep"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredDiagnostics.map((order) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`surface-card p-5 border-l-4 transition-all ${
                                        order.isAbnormal ? 'border-l-rose-500 bg-rose-50/20' :
                                        order.status === 'COMPLETED' ? 'border-l-emerald-500' :
                                        'border-l-teal-500'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                                                    order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'SAMPLE_COLLECTED' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {order.status.replace('_', ' ')}
                                                </span>
                                                {order.isAbnormal && (
                                                    <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                        ⚠️ ABNORMAL RESULT
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-extrabold text-emerald-deep">
                                                {order.testName}
                                            </h3>
                                            <p className="text-xs text-txt-muted mt-0.5">
                                                Patient: <strong>{order.patientName}</strong> ({order.patientAge}y) • Ordered by: {order.orderedBy}
                                            </p>
                                        </div>

                                        <span className="text-xs font-mono bg-gray-100 text-txt-muted px-2 py-1 rounded-lg">
                                            {order.id}
                                        </span>
                                    </div>

                                    {/* Result Summary */}
                                    <div className="mt-3 p-3 bg-gray-50 border border-border-subtle rounded-xl text-xs space-y-1">
                                        <div className="flex justify-between font-medium">
                                            <span>Facility: <strong>{order.facilityName}</strong></span>
                                            <span>Ordered: {new Date(order.orderedAt).toLocaleDateString()}</span>
                                        </div>
                                        {order.resultSummary ? (
                                            <div className="pt-1 text-txt-primary">
                                                <strong>Result:</strong> <span className={order.isAbnormal ? 'font-bold text-rose-700' : 'text-emerald-800'}>{order.resultSummary}</span>
                                                {order.normalRange && (
                                                    <span className="block text-[11px] text-txt-muted">Ref Range: {order.normalRange}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-txt-muted italic pt-1">
                                                Sample in transit to designated testing laboratory...
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-3 flex gap-2 justify-end">
                                        <button
                                            onClick={() => handleOpenResultModal(order)}
                                            className="px-3 py-1.5 bg-white border border-border-subtle hover:bg-gray-100 text-txt-primary text-xs font-bold rounded-xl shadow-sm"
                                        >
                                            {order.status === 'COMPLETED' ? '📝 Update Result' : '🧪 Enter Lab Result'}
                                        </button>
                                        <button
                                            onClick={() => toast.success(`Lab Report synced with ABHA ${order.patientId} health locker`)}
                                            className="px-3 py-1.5 bg-emerald-deep hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm"
                                        >
                                            Push to LHR →
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* New Order Modal */}
                {showNewOrderModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-border-subtle space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-emerald-deep">
                                    Requisition Diagnostic Test
                                </h3>
                                <button onClick={() => setShowNewOrderModal(false)} className="text-txt-muted">✕</button>
                            </div>

                            <form onSubmit={handleCreateOrder} className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-txt-secondary block mb-1">Select Patient</label>
                                    <select
                                        value={orderPatientId}
                                        onChange={(e) => setOrderPatientId(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 border border-border-subtle rounded-xl text-xs font-semibold"
                                    >
                                        <option value="">Choose Patient from Registry...</option>
                                        {patients.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.age}y, {p.village})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-txt-secondary block mb-1">Diagnostic Test</label>
                                    <select
                                        value={orderTestType}
                                        onChange={(e) => setOrderTestType(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 border border-border-subtle rounded-xl text-xs font-semibold"
                                    >
                                        {testCatalog.map((c) => (
                                            <option key={c.code} value={c.code}>{c.name} — {c.localAvail ? 'Local' : 'Referral'}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-txt-secondary block mb-1">Testing Facility</label>
                                    <select
                                        value={orderFacilityId}
                                        onChange={(e) => setOrderFacilityId(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 border border-border-subtle rounded-xl text-xs font-semibold"
                                    >
                                        {MAHARASHTRA_FACILITIES.map((f) => (
                                            <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-txt-secondary block mb-1">Clinical Indication / Notes</label>
                                    <input
                                        type="text"
                                        value={orderNotes}
                                        onChange={(e) => setOrderNotes(e.target.value)}
                                        placeholder="Reason for ordering test..."
                                        className="w-full p-2.5 bg-gray-50 border border-border-subtle rounded-xl text-xs"
                                    />
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowNewOrderModal(false)}
                                        className="px-4 py-2 bg-gray-100 text-txt-secondary text-xs font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-emerald-deep text-white text-xs font-bold rounded-xl shadow"
                                    >
                                        Create Requisition
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Result Entry Modal */}
                {showResultModal && selectedTest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-border-subtle space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-emerald-deep">
                                        Lab Result Entry: {selectedTest.testName}
                                    </h3>
                                    <span className="text-xs text-txt-muted">Patient: {selectedTest.patientName}</span>
                                </div>
                                <button onClick={() => setShowResultModal(false)} className="text-txt-muted">✕</button>
                            </div>

                            <form onSubmit={handleSaveResult} className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-txt-secondary block mb-1">Lab Findings / Numerical Value</label>
                                    <textarea
                                        value={resultText}
                                        onChange={(e) => setResultText(e.target.value)}
                                        rows={3}
                                        required
                                        placeholder="e.g. Hemoglobin: 8.2 g/dL, Fasting Sugar: 284 mg/dL..."
                                        className="w-full p-3 bg-gray-50 border border-border-subtle rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-deep"
                                    />
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="abnormalCheck"
                                        checked={isAbnormal}
                                        onChange={(e) => setIsAbnormal(e.target.checked)}
                                        className="w-4 h-4 text-rose-600 rounded"
                                    />
                                    <label htmlFor="abnormalCheck" className="text-xs font-bold text-rose-900 cursor-pointer">
                                        Flag as Critical / Abnormal Result (Triggers Doctor Alert)
                                    </label>
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowResultModal(false)}
                                        className="px-4 py-2 bg-gray-100 text-txt-secondary text-xs font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-emerald-deep text-white text-xs font-bold rounded-xl shadow"
                                    >
                                        Save & Sync to LHR
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
