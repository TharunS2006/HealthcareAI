/**
 * Essential Medicine Inventory & Diagnostic Coordination — NalamMesh
 * Indian Public Health Standards (IPHS) Compliance (SIH PS#26133)
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useFacilityStore } from '@/stores/facilityStore';
import { MedicineStockItem, DiagnosticOrder } from '@/types/facility';
import toast from 'react-hot-toast';

export default function MedicinePage() {
    const {
        medicines,
        diagnostics,
        loadAll,
        restockMedicine,
        updateDiagnosticResult
    } = useFacilityStore();

    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDiag, setSelectedDiag] = useState<DiagnosticOrder | null>(null);
    const [labResultText, setLabResultText] = useState('');
    const [isAbnormal, setIsAbnormal] = useState(false);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const filteredMeds = medicines.filter(m => {
        const matchesCat = filterCategory === 'ALL' || m.category === filterCategory;
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              m.facilityName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    const outOfStockMeds = medicines.filter(m => m.status === 'OUT_OF_STOCK');
    const lowStockMeds = medicines.filter(m => m.status === 'LOW' || m.status === 'NEAR_EXPIRY');

    const handleSaveLabResult = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDiag || !labResultText.trim()) return;
        await updateDiagnosticResult(selectedDiag.id, labResultText, isAbnormal);
        setSelectedDiag(null);
        setLabResultText('');
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen relative">
                <MobileMenu />

                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                                    Indian Public Health Standards (IPHS) Drug & Diagnostic Portal
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                Medicine Inventory & Diagnostic Coordination
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Stock visibility, emergency reorder alerts, and cross-tier lab test tracking for Gadchiroli
                            </p>
                        </div>

                        <button
                            onClick={() => toast.success('Emergency Drug Requisition sent to District Warehouse Gadchiroli')}
                            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white text-xs font-bold rounded-xl shadow hover:opacity-95"
                        >
                            🚨 Emergency Supply Request
                        </button>
                    </div>

                    {/* Critical Out of Stock Alert Banner */}
                    {(outOfStockMeds.length > 0 || lowStockMeds.length > 0) && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-950 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <strong className="block text-amber-900 text-sm font-extrabold">
                                        Critical Stock Alert: {outOfStockMeds.length} items Out-of-Stock, {lowStockMeds.length} items Low
                                    </strong>
                                    <span className="text-amber-800">
                                        Immediate restock needed for {outOfStockMeds.map(m => m.name).join(', ') || 'essential drugs'}.
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    outOfStockMeds.forEach(m => restockMedicine(m.id, 100));
                                }}
                                className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-all shrink-0 ml-4"
                            >
                                Auto-Restock All
                            </button>
                        </div>
                    )}

                    {/* 3-Column Layout */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Column 1 (6 cols): Medicine Stock Table */}
                        <div className="lg:col-span-6 surface-card p-5 space-y-4">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <h2 className="text-sm font-bold text-emerald-deep uppercase tracking-wider">
                                    Essential Medicine Stock (IPHS)
                                </h2>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Filter drug..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="px-3 py-1 bg-gray-50 border rounded-lg text-xs outline-none w-32"
                                    />
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="p-1 bg-gray-50 border rounded-lg text-xs font-semibold"
                                    >
                                        <option value="ALL">All Categories</option>
                                        <option value="Analgesic">Analgesic</option>
                                        <option value="Antibiotic">Antibiotic</option>
                                        <option value="Maternal/ANC">Maternal/ANC</option>
                                        <option value="Anti-diabetic">Anti-diabetic</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-border-subtle text-left text-txt-muted uppercase font-bold">
                                            <th className="pb-2">Medicine / Form</th>
                                            <th className="pb-2">Stock Level</th>
                                            <th className="pb-2">Status</th>
                                            <th className="pb-2">Facility</th>
                                            <th className="pb-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {filteredMeds.map((med) => (
                                            <tr key={med.id} className="hover:bg-teal-50/30 transition-colors">
                                                <td className="py-2.5">
                                                    <div className="font-bold text-emerald-deep">{med.name}</div>
                                                    <span className="text-[10px] text-txt-muted">{med.category} • {med.dosageForm}</span>
                                                </td>
                                                <td className="py-2.5 font-mono font-bold">
                                                    <span className={med.currentStock === 0 ? 'text-status-red' : med.currentStock < med.minimumRequiredStock ? 'text-status-yellow' : 'text-emerald-deep'}>
                                                        {med.currentStock} {med.unit}
                                                    </span>
                                                    <span className="text-[9px] text-txt-muted block">Min: {med.minimumRequiredStock}</span>
                                                </td>
                                                <td className="py-2.5">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                                        med.status === 'OUT_OF_STOCK' ? 'bg-red-100 text-red-700' :
                                                        med.status === 'LOW' ? 'bg-yellow-100 text-yellow-800' :
                                                        med.status === 'NEAR_EXPIRY' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {med.status}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-[10px] text-txt-secondary truncate max-w-[100px]">
                                                    {med.facilityName}
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <button
                                                        onClick={() => restockMedicine(med.id, 50)}
                                                        className="px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold rounded text-[10px]"
                                                    >
                                                        + Restock
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Column 2 (3 cols): Diagnostic Lab Orders */}
                        <div className="lg:col-span-3 surface-card p-5 space-y-4">
                            <h2 className="text-sm font-bold text-emerald-deep uppercase tracking-wider">
                                Diagnostic Lab Orders
                            </h2>

                            <div className="space-y-3">
                                {diagnostics.map((diag) => (
                                    <div
                                        key={diag.id}
                                        className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl space-y-1.5 text-xs"
                                    >
                                        <div className="flex justify-between items-start">
                                            <strong className="text-emerald-deep">{diag.testName}</strong>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                diag.status === 'COMPLETED' ? (diag.isAbnormal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700') :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                                {diag.status}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-txt-muted">
                                            Patient: <strong>{diag.patientName}</strong> ({diag.facilityName})
                                        </p>

                                        {diag.resultSummary ? (
                                            <div className="p-2 bg-white rounded border border-gray-200 text-[10px] font-mono text-emerald-deep font-semibold">
                                                {diag.resultSummary}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setSelectedDiag(diag);
                                                    setLabResultText('');
                                                }}
                                                className="w-full py-1 bg-teal-50 text-teal-700 font-bold rounded hover:bg-teal-100 text-[10px] text-center"
                                            >
                                                + Enter Lab Result
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 3 (3 cols): Stock Summary & Compliance */}
                        <div className="lg:col-span-3 space-y-4">

                            {/* Donut Health Summary */}
                            <div className="surface-card p-5 space-y-3 text-xs">
                                <h3 className="font-bold text-emerald-deep uppercase tracking-wider">
                                    Drug Inventory Health
                                </h3>

                                <div className="space-y-2">
                                    <div>
                                        <div className="flex justify-between font-semibold mb-1">
                                            <span className="text-emerald-700">● Adequate (62%)</span>
                                            <span>5 Drugs</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: '62%' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between font-semibold mb-1">
                                            <span className="text-amber-700">● Low Stock (25%)</span>
                                            <span>2 Drugs</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: '25%' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between font-semibold mb-1">
                                            <span className="text-rose-700">● Out of Stock (13%)</span>
                                            <span>1 Drug</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-status-red h-full rounded-full" style={{ width: '13%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Near Expiry Warning Card */}
                            <div className="surface-card p-5 border-l-4 border-l-orange-500 text-xs space-y-2">
                                <span className="font-bold text-orange-900 block uppercase tracking-wider">
                                    Near Expiry Alert (&lt; 60 Days)
                                </span>
                                <p className="text-txt-secondary leading-relaxed">
                                    <strong>Oxytocin Inj</strong> (Batch OXY-2024-77) expires on 30 Sept 2025. Rotate stock with CHC Etapalli.
                                </p>
                            </div>

                        </div>
                    </div>

                    {/* Modal to Record Lab Result */}
                    {selectedDiag && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                                <h3 className="text-base font-bold text-emerald-deep">
                                    Record Diagnostic Result: {selectedDiag.testName}
                                </h3>
                                <p className="text-xs text-txt-muted">
                                    Patient: {selectedDiag.patientName} • Normal: {selectedDiag.normalRange}
                                </p>

                                <form onSubmit={handleSaveLabResult} className="space-y-4 text-xs">
                                    <div>
                                        <label className="font-bold text-txt-muted block mb-1">Result Observation</label>
                                        <input
                                            type="text"
                                            required
                                            value={labResultText}
                                            onChange={(e) => setLabResultText(e.target.value)}
                                            placeholder="e.g. FBG: 142 mg/dL or Negative"
                                            className="w-full p-2.5 bg-gray-50 border rounded-xl font-medium outline-none"
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer font-bold text-status-red">
                                        <input
                                            type="checkbox"
                                            checked={isAbnormal}
                                            onChange={(e) => setIsAbnormal(e.target.checked)}
                                            className="w-4 h-4 accent-red-600 rounded"
                                        />
                                        <span>Mark as Abnormal / Pathological Finding</span>
                                    </label>

                                    <div className="flex justify-end gap-2 pt-2 border-t">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDiag(null)}
                                            className="px-4 py-2 bg-gray-100 text-txt-secondary font-bold rounded-xl"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-emerald-deep text-white font-bold rounded-xl"
                                        >
                                            Save Result
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
