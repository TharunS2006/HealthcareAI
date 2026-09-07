/**
 * Facility Hierarchy & Service Discovery Directory — NalamMesh (SIH PS#26133 Module 15)
 * Exact 4-Tier Maharashtra Model: Sub-Centre -> PHC -> CHC/SDH -> District Hospital
 * Service locator ("What is available where") with live beds, specialized staff, and equipment.
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { FacilityType } from '@/types/facility';
import { useLanguageStore } from '@/stores/languageStore';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function FacilitiesPage() {
    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    const [selectedTier, setSelectedTier] = useState<FacilityType | 'ALL'>('ALL');
    const [serviceFilter, setServiceFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFacility, setSelectedFacility] = useState(MAHARASHTRA_FACILITIES[0]);

    const serviceTags = [
        'Emergency Obstetric Care (CEmONC)',
        '24x7 Delivery Care (BEmONC)',
        'Blood Storage Unit',
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

    const tierBadges: Record<FacilityType, { label: string; labelMr: string; labelHi: string; color: string; desc: string; descMr: string; descHi: string }> = {
        SC: {
            label: 'Sub-Centre / Ayushman Arogya Mandir',
            labelMr: 'आरोग्य वर्धिनी उपकेंद्र (SC)',
            labelHi: 'आयुष्मान आरोग्य मंदिर (उप-केंद्र)',
            color: 'bg-amber-100 text-amber-800 border-amber-300',
            desc: 'Frontline ASHA/ANM/CHO base, point-of-care rapid triage',
            descMr: 'आशा, एएनएम व CHO यांचे प्राथमिक आरोग्य केंद्र',
            descHi: 'आशा, एएनएम व सीएचओ का प्राथमिक सेवा केंद्र',
        },
        PHC: {
            label: 'Primary Health Centre (PHC)',
            labelMr: 'प्राथमिक आरोग्य केंद्र (PHC)',
            labelHi: 'प्राथमिक स्वास्थ्य केंद्र (PHC)',
            color: 'bg-teal-100 text-teal-800 border-teal-300',
            desc: 'Medical Officer, basic OPD, 24x7 normal deliveries',
            descMr: 'वैद्यकीय अधिकारी, बाह्यरुग्ण विभाग, २४ तास प्रसूती सेवा',
            descHi: 'चिकित्सा अधिकारी, सामान्य ओपीडी, २४x७ प्रसव सेवा',
        },
        CHC: {
            label: 'Community Health Centre (CHC)',
            labelMr: 'सामुदायिक आरोग्य केंद्र (CHC)',
            labelHi: 'सामुदायिक स्वास्थ्य केंद्र (CHC)',
            color: 'bg-blue-100 text-blue-800 border-blue-300',
            desc: '30-bed First Referral Unit, emergency maternity (BEmONC)',
            descMr: '३० खाटांचे ग्रामीण रुग्णालय, प्रथम संदर्भ केंद्र',
            descHi: '३० बिस्तरों का अस्पताल, आपातकालीन प्रसूति (BEmONC)',
        },
        SDH: {
            label: 'Sub-District Hospital (SDH)',
            labelMr: 'उपजिल्हा रुग्णालय (SDH)',
            labelHi: 'उप-जिला अस्पताल (SDH)',
            color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            desc: '100-bed Comprehensive Emergency Obstetric (CEmONC), Surgery',
            descMr: '१०० खाटांचे रुग्णालय, प्रगत प्रसूती सेवा (CEmONC), शस्त्रक्रिया',
            descHi: '१०० बिस्तरों का अस्पताल, उन्नत प्रसूति सेवा व सर्जरी',
        },
        DH: {
            label: 'District Hospital (DH)',
            labelMr: 'जिल्हा रुग्णालय (DH)',
            labelHi: 'जिला अस्पताल (DH)',
            color: 'bg-purple-100 text-purple-800 border-purple-300',
            desc: '300-bed Apex Multi-Specialty, ICU, Blood Bank, CT Scanner',
            descMr: '३०० खाटांचे सर्वोच्च रुग्णालय, अतिदक्षता विभाग (ICU), रक्तपेढी',
            descHi: '३०० बिस्तरों का शीर्ष अस्पताल, आईसीयू, ब्लड बैंक, सीटी स्कैन',
        },
    };

    const txt = {
        deptTag: isEn ? 'Government of Maharashtra • Public Health Facility Hierarchy & Directory' : isHi ? 'महाराष्ट्र सरकार • स्वास्थ्य केंद्र पदानुक्रम एवं निर्देशिका' : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य केंद्र रचना व निर्देशिका',
        title: isEn ? '4-Tier Facility Hierarchy & Service Directory' : isHi ? '४-स्तरीय स्वास्थ्य केंद्र निर्देशिका एवं सेवा खोज' : '४-स्तरीय आरोग्य केंद्र निर्देशिका व सेवा शोधक',
        subTitle: isEn
            ? 'Sub-Centre (SC) → Primary Health Centre (PHC) → CHC/SDH → District Hospital (DH)'
            : isHi
            ? 'उप-केंद्र (SC) → प्राथमिक स्वास्थ्य केंद्र (PHC) → CHC/SDH → जिला अस्पताल (DH)'
            : 'उपकेंद्र (SC) → प्राथमिक आरोग्य केंद्र (PHC) → CHC/SDH → जिल्हा रुग्णालय (DH)',
        districtBadge: isEn ? 'District: Gadchiroli (Tribal Division)' : isHi ? 'जिला: गढ़चिरौली (आदिवासी क्षेत्र)' : 'जिल्हा: गडचिरोली (आदिवासी विभाग)',
        searchPlaceholder: isEn ? 'Search facility, tehsil, equipment, doctor...' : isHi ? 'अस्पताल, तहसील, उपकरण, डॉक्टर खोजें...' : 'आरोग्य केंद्र, तालुका, उपकरण, डॉक्टर शोधा...',
        allTiers: isEn ? 'All Tiers' : isHi ? 'सभी स्तर' : 'सर्व स्तर',
        servicesTitle: isEn ? 'Available Specialized Clinical Services' : isHi ? 'उपलब्ध विशिष्ट चिकित्सीय सेवाएं' : 'उपलब्ध विशेष वैद्यकीय सेवा',
        doctorsOnDuty: isEn ? 'Doctors On Duty' : isHi ? 'कार्यरत डॉक्टर' : 'कार्यरत वैद्यकीय अधिकारी',
        bedsLabel: isEn ? 'Bed Occupancy' : isHi ? 'बिस्तर उपलब्धता' : 'खाटांची संख्या व उपलब्धता',
        icuLabel: isEn ? 'ICU Beds' : isHi ? 'आईसीयू बिस्तर' : 'ICU खाटा',
        bloodBank: isEn ? 'Blood Bank' : isHi ? 'ब्लड बैंक' : 'रक्तपेढी',
        cemonc: isEn ? 'CEmONC Status' : isHi ? 'CEmONC प्रसूति' : 'CEmONC प्रसूती सेवा',
        referralBtn: isEn ? 'Initiate Referral to Facility →' : isHi ? 'इस अस्पताल हेतु रेफरल शुरू करें →' : 'या रुग्णालयाकडे रेफरल सुरू करा →',
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
                                    {txt.deptTag}
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">
                                {txt.title}
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                {txt.subTitle}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border-subtle rounded font-bold text-txt-secondary shadow-sm">
                                <Icon name="map-pin" className="w-3.5 h-3.5" /> {txt.districtBadge}
                            </span>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="surface-card p-4 space-y-3">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            {/* Tier Filter Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setSelectedTier('ALL')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        selectedTier === 'ALL'
                                            ? 'bg-[#1F3A6E] text-white shadow-sm'
                                            : 'bg-gray-100 text-txt-secondary hover:bg-gray-200'
                                    }`}
                                >
                                    {txt.allTiers}
                                </button>
                                {(['DH', 'SDH', 'CHC', 'PHC', 'SC'] as FacilityType[]).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setSelectedTier(t)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            selectedTier === t
                                                ? 'bg-[#1F3A6E] text-white shadow-sm'
                                                : 'bg-gray-100 text-txt-secondary hover:bg-gray-200'
                                        }`}
                                    >
                                        {t} ({tierBadges[t].label.split(' ')[0]})
                                    </button>
                                ))}
                            </div>

                            {/* Search Box */}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={txt.searchPlaceholder}
                                className="px-3.5 py-1.5 bg-gray-50 border border-border-subtle rounded-xl text-xs w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-emerald-deep"
                            />
                        </div>
                    </div>

                    {/* 2-Column Split: Facility List (Left 7) & Live Detail Dossier (Right 5) */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Left Column (7 cols): Facilities List */}
                        <div className="lg:col-span-7 space-y-3">
                            {filteredFacilities.map((fac) => {
                                const badge = tierBadges[fac.type];
                                const isSelected = selectedFacility.id === fac.id;

                                return (
                                    <div
                                        key={fac.id}
                                        onClick={() => setSelectedFacility(fac)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/30'
                                                : 'border-border-subtle bg-white hover:border-emerald-300 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border uppercase ${badge.color}`}>
                                                        {isEn ? badge.label : isHi ? badge.labelHi : badge.labelMr}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-txt-muted">HFR: {fac.id}</span>
                                                </div>
                                                <h3 className="text-base font-extrabold text-[#1F3A6E]">
                                                    {fac.name}
                                                </h3>
                                                <p className="text-xs text-txt-muted mt-0.5">
                                                    {isEn ? 'Taluka:' : isHi ? 'तहसील:' : 'तालुका:'} <strong>{fac.tehsil}</strong> • {isEn ? 'In-charge:' : isHi ? 'प्रभारी:' : 'वैद्यकीय अधिकारी:'} {fac.medicalOfficerInCharge || 'Medical Officer'}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-sm font-black font-mono text-[#1F3A6E] block">
                                                    {fac.beds.total} {isEn ? 'Beds' : isHi ? 'बिस्तर' : 'खाटा'}
                                                </span>
                                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    ● {(fac.isOnline ? (isEn ? 'Active' : isHi ? 'सक्रिय' : 'सक्रिय') : (isEn ? 'Offline' : isHi ? 'ऑफलाइन' : 'ऑफलाइन'))}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-txt-secondary">
                                            <div className="flex gap-2 flex-wrap">
                                                {fac.services.slice(0, 3).map((s, idx) => (
                                                    <span key={idx} className="bg-gray-100 text-txt-secondary px-2 py-0.5 rounded text-[10px] font-medium">
                                                        {s}
                                                    </span>
                                                ))}
                                                {fac.services.length > 3 && (
                                                    <span className="text-[10px] text-txt-muted font-bold">
                                                        +{fac.services.length - 3} {isEn ? 'more' : isHi ? 'अन्य' : 'इतर'}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-[11px] font-bold text-teal-700">
                                                {isEn ? 'Inspect Dossier →' : isHi ? 'विवरण देखें →' : 'माहिती पहा →'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Column (5 cols): Selected Facility Dossier */}
                        <div className="lg:col-span-5">
                            <div className="surface-card p-6 sticky top-24 space-y-5 border-t-4 border-t-emerald-deep">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${tierBadges[selectedFacility.type].color}`}>
                                            {isEn ? tierBadges[selectedFacility.type].label : isHi ? tierBadges[selectedFacility.type].labelHi : tierBadges[selectedFacility.type].labelMr}
                                        </span>
                                        <span className="text-xs font-mono text-txt-muted font-bold">{selectedFacility.id}</span>
                                    </div>
                                    <h2 className="text-xl font-extrabold text-[#1F3A6E]">
                                        {selectedFacility.name}
                                    </h2>
                                    <p className="text-xs text-txt-muted">
                                        {isEn ? 'Tehsil / Block:' : isHi ? 'तहसील / ब्लॉक:' : 'तालुका / ब्लॉक:'} <strong>{selectedFacility.tehsil}</strong>
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-emerald-800 block uppercase">{txt.bedsLabel}</span>
                                        <strong className="text-xl font-black text-[#1F3A6E]">
                                            {selectedFacility.beds.occupied}/{selectedFacility.beds.total}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-blue-800 block uppercase">{txt.icuLabel}</span>
                                        <strong className="text-xl font-black text-blue-900">
                                            {(selectedFacility.beds.icu?.total || 0) || 0}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-amber-800 block uppercase">{txt.doctorsOnDuty}</span>
                                        <strong className="text-xl font-black text-amber-900">
                                            {selectedFacility.staff.doctors}
                                        </strong>
                                    </div>
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-purple-800 block uppercase">{isEn ? 'Ambulances' : isHi ? 'एम्बुलेंस' : 'रुग्णवाहिका'}</span>
                                        <strong className="text-xl font-black text-purple-900">
                                            {selectedFacility.ambulanceAvailable}
                                        </strong>
                                    </div>
                                </div>

                                {/* Clinical Services */}
                                <div>
                                    <h3 className="text-xs font-black uppercase text-txt-muted tracking-wider mb-2">
                                        {txt.servicesTitle}
                                    </h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedFacility.services.map((s, idx) => (
                                            <span key={idx} className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-medium">
                                                ✓ {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100">
                                    <Link
                                        href="/referrals"
                                        className="w-full py-3 bg-[#1F3A6E] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-all block text-center cursor-pointer"
                                    >
                                        {txt.referralBtn}
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
