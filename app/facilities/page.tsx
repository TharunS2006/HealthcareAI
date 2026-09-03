/**
 * Facility Hierarchy & Service Discovery Directory — NalamMesh (SIH PS#26133 Module 15)
 * Exact 4-Tier Maharashtra Model: Sub-Centre -> PHC -> CHC/SDH -> District Hospital
 * Service locator ("What is available where") with live beds, specialized staff, and equipment.
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { FacilityType } from '@/types/facility';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function FacilitiesPage() {
    const [selectedTier, setSelectedTier] = useState<FacilityType | 'ALL'>('ALL');
    const [serviceFilter, setServiceFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFacility, setSelectedFacility] = useState(MAHARASHTRA_FACILITIES[0]);

    const serviceTags = [
        'ALL',
        'Blood Bank',
        '24x7 Emergency',
        'Obstetrics & Gynaecology',
        'Pediatrics & SNCU',
        'Emergency Obstetric Care (CEmONC)',
        'CT Scan',
        'Sickle Cell Screening',
        'Assisted Teleconsultation',
        'NCD Screening (BP/Sugar)',
    ];

    const filteredFacilities = MAHARASHTRA_FACILITIES.filter(f => {
        const matchesTier = selectedTier === 'ALL' || f.type === selectedTier;
        const matchesService = serviceFilter === 'ALL' || f.services.some(s => s.toLowerCase().includes(serviceFilter.toLowerCase()));
        const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              f.tehsil.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              f.medicalOfficerInCharge?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              f.equipment.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesTier && matchesService && matchesSearch;
    });

    const tierBadges: Record<FacilityType, { label: string; color: string; desc: string }> = {
        SC: { label: 'Sub-Centre / Ayushman Arogya Mandir', color: 'bg-amber-100 text-amber-800 border-amber-300', desc: 'Frontline ASHA/ANM/CHO base, point-of-care rapid triage' },
        PHC: { label: 'Primary Health Centre (PHC)', color: 'bg-teal-100 text-teal-800 border-teal-300', desc: 'Medical Officer, basic OPD, 24x7 normal deliveries' },
        CHC: { label: 'Community Health Centre (CHC)', color: 'bg-blue-100 text-blue-800 border-blue-300', desc: '30-bed First Referral Unit, emergency maternity (BEmONC)' },
        SDH: { label: 'Sub-District Hospital (SDH)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', desc: '100-bed Comprehensive Emergency Obstetric (CEmONC), Surgery' },
        DH: { label: 'District Hospital (DH)', color: 'bg-purple-100 text-purple-800 border-purple-300', desc: '300-bed Apex Multi-Specialty, ICU, Blood Bank, CT Scanner' },
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
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                    Government of Maharashtra • Public Health Facility Hierarchy & Directory
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                4-Tier Facility Hierarchy & Service Directory
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Sub-Centre (SC) $\to$ Primary Health Centre (PHC) $\to$ CHC/SDH $\to$ District Hospital (DH)
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="px-3 py-1.5 bg-white border border-border-subtle rounded-xl font-bold text-txt-secondary shadow-sm">
                                📍 District: Gadchiroli (Tribal Division)
                            </span>
                        </div>
                    </div>

                    {/* 4-Tier Visual Pyramid & Quick Tier Filter */}
                    <div className="surface-card p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black text-emerald-deep uppercase tracking-wider">
                                Maharashtra Public Health Continuum of Care (4 Tiers)
                            </h2>
                            <span className="text-[11px] text-txt-muted">Click tier to isolate facilities</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <button
                                onClick={() => setSelectedTier(selectedTier === 'DH' ? 'ALL' : 'DH')}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                    selectedTier === 'DH' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400' : 'bg-white border-border-subtle hover:border-purple-300'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-purple-900 uppercase">Tier 4: Apex Care</span>
                                    <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">1 DH</span>
                                </div>
                                <h3 className="text-sm font-bold text-purple-950">District Hospital</h3>
                                <p className="text-[11px] text-txt-muted mt-1">Multi-specialist, ICU, Blood Bank, Surgery</p>
                            </button>

                            <button
                                onClick={() => setSelectedTier(selectedTier === 'CHC' || selectedTier === 'SDH' ? 'ALL' : 'CHC')}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                    selectedTier === 'CHC' || selectedTier === 'SDH' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400' : 'bg-white border-border-subtle hover:border-blue-300'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-blue-900 uppercase">Tier 3: First Referral</span>
                                    <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">2 CHC/SDH</span>
                                </div>
                                <h3 className="text-sm font-bold text-blue-950">CHC / Sub-District Hospital</h3>
                                <p className="text-[11px] text-txt-muted mt-1">CEmONC, 30-100 beds, X-Ray, Surgery</p>
                            </button>

                            <button
                                onClick={() => setSelectedTier(selectedTier === 'PHC' ? 'ALL' : 'PHC')}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                    selectedTier === 'PHC' ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-400' : 'bg-white border-border-subtle hover:border-teal-300'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-teal-900 uppercase">Tier 2: Primary Care</span>
                                    <span className="text-[10px] bg-teal-200 text-teal-900 font-bold px-2 py-0.5 rounded-full">2 PHC</span>
                                </div>
                                <h3 className="text-sm font-bold text-teal-950">Primary Health Centre</h3>
                                <p className="text-[11px] text-txt-muted mt-1">Medical Officer, 24x7 normal deliveries</p>
                            </button>

                            <button
                                onClick={() => setSelectedTier(selectedTier === 'SC' ? 'ALL' : 'SC')}
                                className={`p-4 rounded-2xl border text-left transition-all ${
                                    selectedTier === 'SC' ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-400' : 'bg-white border-border-subtle hover:border-amber-300'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-amber-900 uppercase">Tier 1: Grassroots</span>
                                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">2 Sub-Centres</span>
                                </div>
                                <h3 className="text-sm font-bold text-amber-950">Ayushman Arogya Mandir</h3>
                                <p className="text-[11px] text-txt-muted mt-1">ASHA/ANM/CHO, rapid triage, field outreach</p>
                            </button>
                        </div>
                    </div>

                    {/* Service Discovery Search Toolbar */}
                    <div className="surface-card p-4 space-y-3">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                            <div className="relative w-full md:w-80">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search facilities, doctors, equipment..."
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-border-subtle rounded-xl text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none"
                                />
                                <svg className="w-4 h-4 text-txt-muted absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                                <span className="text-[10px] font-bold text-txt-muted uppercase whitespace-nowrap">Service Discovery:</span>
                                {serviceTags.slice(0, 5).map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => setServiceFilter(tag)}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                            serviceFilter === tag
                                                ? 'bg-emerald-deep text-white shadow-sm'
                                                : 'bg-gray-100 text-txt-secondary hover:bg-gray-200'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Facility Grid & Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Facility List (2 cols) */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-black text-txt-muted uppercase tracking-wider">
                                    Discovered Public Health Facilities ({filteredFacilities.length})
                                </span>
                                <span className="text-xs text-txt-muted">Select facility for full resource checklist</span>
                            </div>

                            <div className="space-y-3">
                                {filteredFacilities.map((facility) => {
                                    const isSelected = selectedFacility.id === facility.id;
                                    const badge = tierBadges[facility.type];

                                    return (
                                        <motion.div
                                            key={facility.id}
                                            onClick={() => setSelectedFacility(facility)}
                                            className={`surface-card p-5 border-l-4 cursor-pointer transition-all ${
                                                isSelected ? 'border-l-emerald-600 ring-2 ring-emerald-500 shadow-lg bg-emerald-50/20' :
                                                'border-l-border-subtle hover:border-l-emerald-500 hover:shadow-md'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-xs text-txt-muted font-semibold">
                                                            Tehsil: {facility.tehsil}
                                                        </span>
                                                        {facility.ambulanceAvailable > 0 && (
                                                            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                                                                🚑 {facility.ambulanceAvailable} Ambulances
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h3 className="text-lg font-black text-emerald-deep">
                                                        {facility.name}
                                                    </h3>
                                                    <p className="text-xs text-txt-secondary font-medium mt-0.5">
                                                        {facility.nameMarathi} • {facility.location.address}
                                                    </p>

                                                    <div className="mt-2.5 flex items-center gap-4 text-xs text-txt-muted flex-wrap">
                                                        <span>👨‍⚕️ Doctors: <strong>{facility.staff.doctors}</strong></span>
                                                        <span>👩‍⚕️ Nurses: <strong>{facility.staff.nurses}</strong></span>
                                                        <span>🛏️ Beds: <strong>{facility.beds.occupied}/{facility.beds.total}</strong></span>
                                                        <span>📞 {facility.contact}</span>
                                                    </div>
                                                </div>

                                                <div className="shrink-0 flex sm:flex-col gap-2 justify-end">
                                                    <Link
                                                        href="/teleconsult"
                                                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl text-center"
                                                    >
                                                        Teleconsult Link
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toast.success(`Referral destination set to ${facility.name}`);
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-deep hover:bg-emerald-800 text-white text-xs font-bold rounded-xl text-center shadow"
                                                    >
                                                        Route Patient →
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Service Tags */}
                                            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-1.5 flex-wrap">
                                                {facility.services.map((srv, sIdx) => (
                                                    <span
                                                        key={sIdx}
                                                        className="text-[10px] bg-gray-100 text-txt-secondary font-semibold px-2 py-0.5 rounded-md"
                                                    >
                                                        {srv}
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected Facility Inspector Card (1 col) */}
                        <div className="space-y-4">
                            <div className="surface-card p-6 border-t-4 border-t-emerald-600 sticky top-6 space-y-4">
                                <div>
                                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase">
                                        Facility Profile Inspector
                                    </span>
                                    <h3 className="text-xl font-black text-emerald-deep mt-2">
                                        {selectedFacility.name}
                                    </h3>
                                    <p className="text-xs text-txt-muted">
                                        In-Charge: <strong>{selectedFacility.medicalOfficerInCharge}</strong>
                                    </p>
                                </div>

                                {/* Bed Occupancy Breakdown */}
                                <div className="p-4 bg-gray-50 border border-border-subtle rounded-2xl space-y-2 text-xs">
                                    <span className="font-extrabold text-emerald-deep uppercase text-[10px] block">
                                        Real-Time Bed Availability
                                    </span>
                                    <div className="space-y-1.5">
                                        <div>
                                            <div className="flex justify-between text-txt-secondary font-medium">
                                                <span>Total Inpatient Beds</span>
                                                <span className="font-bold">{selectedFacility.beds.occupied} / {selectedFacility.beds.total} ({Math.round((selectedFacility.beds.occupied / (selectedFacility.beds.total || 1)) * 100)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-1">
                                                <div
                                                    className="bg-emerald-600 h-full rounded-full"
                                                    style={{ width: `${Math.min(100, Math.round((selectedFacility.beds.occupied / (selectedFacility.beds.total || 1)) * 100))}%` }}
                                                />
                                            </div>
                                        </div>

                                        {selectedFacility.beds.maternity && (
                                            <div className="flex justify-between pt-1 border-t border-border-subtle">
                                                <span>Maternity / Labor Beds:</span>
                                                <span className="font-bold text-rose-700">{selectedFacility.beds.maternity.occupied} / {selectedFacility.beds.maternity.total}</span>
                                            </div>
                                        )}

                                        {selectedFacility.beds.icu && (
                                            <div className="flex justify-between">
                                                <span>ICU / Ventilator Beds:</span>
                                                <span className="font-bold text-purple-700">{selectedFacility.beds.icu.occupied} / {selectedFacility.beds.icu.total}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Specialized Equipment Catalog */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-extrabold text-txt-muted uppercase tracking-wider block">
                                        Specialized Diagnostic & ICU Equipment
                                    </span>
                                    <div className="space-y-1">
                                        {selectedFacility.equipment.map((eq, eIdx) => (
                                            <div key={eIdx} className="flex items-center gap-2 text-xs text-txt-primary">
                                                <span className="text-emerald-600 font-bold">✓</span>
                                                <span>{eq}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Contact / Dispatch Action */}
                                <div className="pt-3 border-t border-border-subtle flex gap-2">
                                    <button
                                        onClick={() => toast.success(`Calling ${selectedFacility.name} at ${selectedFacility.contact}`)}
                                        className="flex-1 py-2.5 bg-emerald-deep text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-800"
                                    >
                                        📞 Call Facility
                                    </button>
                                    <Link
                                        href="/referrals"
                                        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-txt-secondary font-bold text-xs rounded-xl text-center"
                                    >
                                        Referral Tracker →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
