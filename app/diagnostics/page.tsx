/**
 * Diagnostic Coordination Module — NalamMesh (SIH PS#26133 Module 6)
 * End-to-end sample collection, processing, and results delivery to LHR.
 * Smart "Unavailable Test Router" pointing to nearest lab across Sub-Centre -> PHC -> CHC -> DH.
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useFacilityStore } from '@/stores/facilityStore';
import { usePatientStore } from '@/stores/patientStore';
import { useLanguageStore } from '@/stores/languageStore';
import { DiagnosticOrder } from '@/types/facility';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import toast from 'react-hot-toast';

export default function DiagnosticsPage() {
    const { diagnostics, loadAll, updateDiagnosticResult } = useFacilityStore();
    const { patients, loadPatients } = usePatientStore();
    const { language } = useLanguageStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    const [selectedTest, setSelectedTest] = useState<DiagnosticOrder | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);

    // New Order Form State
    const [orderPatientId, setOrderPatientId] = useState('');
    const [orderTestType, setOrderTestType] = useState('CBC');
    const [orderFacilityId, setOrderFacilityId] = useState('fac-phc-001');
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
        nameMr: string;
        nameHi: string;
        category: DiagnosticOrder['category'];
        tier: string;
        localAvail: boolean;
        nearest: string;
        nearestMr: string;
        nearestHi: string;
        time: string;
    }> = [
        { code: 'CBC', name: 'Complete Blood Count (CBC) with Automated Cell Counter', nameMr: 'रक्त तपासणी (CBC) ऑटोमेटेड सेल काउंटर', nameHi: 'कम्प्लीट ब्लड काउंट (CBC) सेल काउंटर', category: 'Hematology', tier: 'CHC / DH', localAvail: false, nearest: 'CHC Etapalli (28 km)', nearestMr: 'ग्रामीण रुग्णालय एटापल्ली (२८ किमी)', nearestHi: 'सामुदायिक स्वास्थ्य केंद्र एटापल्ली (२८ किमी)', time: '3 hrs' },
        { code: 'MALARIA_RDT', name: 'Rapid Diagnostic Test (RDT) Malaria Pf / Pv', nameMr: 'मलेरिया जलद निदान चाचणी (RDT Malaria Pf/Pv)', nameHi: 'मलेरिया रैपिड टेस्ट (RDT Malaria Pf/Pv)', category: 'Rapid Test', tier: 'Sub-Centre / PHC', localAvail: true, nearest: 'On-site at Sub-Centre / PHC', nearestMr: 'उपकेंद्र / प्रा. आ. केंद्रात उपलब्ध', nearestHi: 'उप-केंद्र / पीएचसी में ऑन-साइट', time: '15 mins' },
        { code: 'SICKLE_CELL', name: 'Sickle Cell Solubility & Electrophoresis', nameMr: 'सिकलसेल चाचणी व इलेक्ट्रोफोरेसीस', nameHi: 'सिकल सेल घुलनशीलता व इलेक्ट्रोफोरेसिस', category: 'Hematology', tier: 'PHC / CHC', localAvail: true, nearest: 'PHC Bhamragad (On-site)', nearestMr: 'प्रा. आ. केंद्र भामरागड (थेट उपलब्ध)', nearestHi: 'प्रा. स्वा. केंद्र भामरागढ़ (ऑन-साइट)', time: '45 mins' },
        { code: 'HBA1C', name: 'Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar', nameMr: 'मधुमेह चाचणी (HbA1c व रक्तातील साखर)', nameHi: 'ग्लाइकेटेड हीमोग्लोबिन (HbA1c) व शुगर', category: 'Biochemistry', tier: 'PHC / CHC', localAvail: true, nearest: 'PHC Bhamragad (On-site)', nearestMr: 'प्रा. आ. केंद्र भामरागड (थेट उपलब्ध)', nearestHi: 'प्रा. स्वा. केंद्र भामरागढ़ (ऑन-साइट)', time: '1 hr' },
        { code: 'SPUTUM_AFB', name: 'Sputum Smear for AFB / CBNAAT GeneXpert (TB)', nameMr: 'क्षयरोग थुंकी चाचणी / CBNAAT GeneXpert (TB)', nameHi: 'टीबी बलगम जांच / CBNAAT GeneXpert (TB)', category: 'Microbiology/Sputum', tier: 'PHC / DH', localAvail: true, nearest: 'Sample at PHC -> DH Gadchiroli', nearestMr: 'नमुना भामरागड -> जिल्हा रुग्णालय गडचिरोली', nearestHi: 'सैंपल पीएचसी -> जिला अस्पताल गढ़चिरौली', time: '24 hrs' },
        { code: 'USG_OBSTETRIC', name: 'Obstetric Ultrasound (USG Antenatal Scan)', nameMr: 'सोनोग्राफी (USG गरोदर माता तपासणी)', nameHi: 'सोनोग्राफी (USG प्रसूति पूर्व जांच)', category: 'Radiology', tier: 'SDH Aheri / DH Gadchiroli', localAvail: false, nearest: 'SDH Aheri (CEmONC, 38 km)', nearestMr: 'उपजिल्हा रुग्णालय अहेरी (३८ किमी)', nearestHi: 'उप-जिला अस्पताल अहेरी (३८ किमी)', time: 'Same Day' },
        { code: 'ECG_DIGITAL', name: '12-Lead Digital ECG with Tele-Cardiology', nameMr: '१२-लीड डिजिटल ECG (टेली-कार्डिओलॉजी)', nameHi: '१२-लीड डिजिटल ईसीजी (टेली-कार्डियोलॉजी)', category: 'Biochemistry', tier: 'PHC / CHC / DH', localAvail: true, nearest: 'PHC Bhamragad (On-site)', nearestMr: 'प्रा. आ. केंद्र भामरागड (थेट उपलब्ध)', nearestHi: 'प्रा. स्वा. केंद्र भामरागढ़ (ऑन-साइट)', time: '10 mins' },
        { code: 'URINE_ALBUMIN', name: 'Urine Albumin (Proteinuria Dipstick)', nameMr: 'लघवीतील प्रथिने तपासणी (Albumin Dipstick)', nameHi: 'मूत्र एल्बुमिन जांच (Proteinuria Dipstick)', category: 'Urine', tier: 'Sub-Centre / PHC', localAvail: true, nearest: 'On-site at Sub-Centre Kothi', nearestMr: 'आरोग्य वर्धिनी उपकेंद्र कोठी येथे उपलब्ध', nearestHi: 'आरोग्य मंदिर उप-केंद्र कोठी में उपलब्ध', time: '5 mins' },
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
            testName: isEn ? selectedCat.name : isHi ? selectedCat.nameHi : selectedCat.nameMr,
            category: selectedCat.category,
            orderedBy: isEn ? 'Dr. Suresh Atram (MO)' : isHi ? 'डॉ. सुरेश आत्राम (MO)' : 'डॉ. सुरेश आत्राम (MO)',
            orderedAt: new Date().toISOString(),
            status: 'ORDERED',
            isAbnormal: false,
        };

        toast.success(isEn ? `Diagnostic Requisition Created for ${p.name}` : isHi ? `${p.name} हेतु लैब जांच ऑर्डर दर्ज किया गया` : `${p.name} साठी लॅब चाचणी नोंदवली गेली`);
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
        toast.success(isEn ? 'Diagnostic Result Saved & Pushed to Patient LHR!' : isHi ? 'लैब रिपोर्ट सुरक्षित कर मरीज के LHR रिकॉर्ड में दर्ज की गई!' : 'लॅब अहवाल जतन करून रुग्णाच्या डिजिटल LHR ला जोडला गेला!');
        setShowResultModal(false);
    };

    const txt = {
        deptTag: isEn ? 'Government of Maharashtra • Cross-Tier Diagnostic Lab Network' : isHi ? 'महाराष्ट्र सरकार • बहु-स्तरीय स्वास्थ्य जांच नेटवर्क' : 'महाराष्ट्र शासन • बहु-स्तरीय लॅब व निदान नेटवर्क',
        title: isEn ? 'Diagnostic Coordination & Lab Tracking' : isHi ? 'निदान समन्वय एवं लैब ट्रैकिंग' : 'निदान व प्रयोगशाळा समन्वय',
        subTitle: isEn
            ? 'Sample collection pipeline, nearest lab router for unavailable tests, and instant LHR push'
            : isHi
            ? 'सैंपल कलेक्शन पाइपलाइन, अनुपलब्ध टेस्ट हेतु निकटतम लैब राउटर एवं डिजिटल LHR रिकॉर्ड'
            : 'नमुने संकलन, उपलब्ध नसलेल्या चाचण्यांसाठी जवळचे लॅब राऊटर आणि थेट डिजिटल आरोग्य नोंद (LHR)',
        orderTestBtn: isEn ? '➕ Order Diagnostic Test' : isHi ? '➕ नई जांच ऑर्डर करें' : '➕ नवीन लॅब चाचणी नोंदवा',
        catalogTitle: isEn ? 'IPHS Diagnostic Catalog & Multi-Tier Facility Availability' : isHi ? 'IPHS जांच सूची एवं स्तर-वार उपलब्धता राउटर' : 'IPHS चाचण्यांची सूची व बहु-स्तरीय आरोग्य केंद्र उपलब्धता',
        catalogSub: isEn ? 'Real-time routing for Sub-Centres & PHCs' : isHi ? 'उपकेंद्रों व प्राथमिक स्वास्थ्य केंद्रों हेतु लाइव मैपिंग' : 'उपकेंद्रे व प्राथमिक आरोग्य केंद्रांसाठी थेट लॅब जोडणी',
        inHouse: isEn ? '✓ In-House' : isHi ? '✓ स्थानीय उपलब्ध' : '✓ केंद्रात उपलब्ध',
        referLab: isEn ? '↗ Refer Lab' : isHi ? '↗ रेफरल लैब' : '↗ संदर्भ लॅबकडे',
        allOrders: isEn ? 'All Orders' : isHi ? 'सभी ऑर्डर्स' : 'सर्व ऑर्डर्स',
        ordered: isEn ? 'Ordered' : isHi ? 'ऑर्डर की गई' : 'नोंदवलेली',
        sampleCollected: isEn ? 'Sample Collected' : isHi ? 'सैंपल संकलित' : 'नमुना गोळा केला',
        inProgress: isEn ? 'In Progress' : isHi ? 'प्रक्रियाधीन' : 'तपासणी सुरू',
        completed: isEn ? 'Completed' : isHi ? 'पूर्ण' : 'पूर्ण झाले',
        searchPlaceholder: isEn ? 'Search patient, test, facility...' : isHi ? 'मरीज, टेस्ट, अस्पताल खोजें...' : 'रुग्ण, चाचणी, आरोग्य केंद्र शोधा...',
        abnormalBadge: isEn ? '⚠️ ABNORMAL RESULT' : isHi ? '⚠️ असामान्य परिणाम' : '⚠️ असामान्य अहवाल (Abnormal)',
        enterResultBtn: isEn ? '✍️ Enter Lab Result' : isHi ? '✍️ रिपोर्ट दर्ज करें' : '✍️ अहवाल नोंदवा',
        resultModalTitle: isEn ? 'Enter Lab Diagnostic Result' : isHi ? 'लैब रिपोर्ट दर्ज करें' : 'लॅब अहवाल नोंदवा',
        resultFindings: isEn ? 'Result Findings / Measured Values:' : isHi ? 'परीक्षण परिणाम / निष्कर्ष:' : 'चाचणीचे निष्कर्ष व मूल्ये:',
        markAbnormal: isEn ? 'Flag as Abnormal / Alert Consulting Doctor' : isHi ? 'असामान्य (Abnormal) चिह्नित कर डॉक्टर को अलर्ट करें' : 'असामान्य (Abnormal) चिन्हांकित करून डॉक्टरना सतर्क करा',
        cancel: isEn ? 'Cancel' : isHi ? 'रद्द करें' : 'रद्द करा',
        saveBtn: isEn ? 'Save & Push to Patient LHR' : isHi ? 'सुरक्षित करें व LHR में भेजें' : 'जतन करा व LHR मध्ये जोडा',
        createModalTitle: isEn ? 'Order New Diagnostic Lab Test' : isHi ? 'नई लैब जांच ऑर्डर करें' : 'नवीन लॅब तपासणी नोंदवा',
        selectPatient: isEn ? 'Select Patient:' : isHi ? 'मरीज चुनें:' : 'रुग्ण निवडा:',
        selectTest: isEn ? 'Diagnostic Test:' : isHi ? 'जांच का नाम:' : 'चाचणीचे नाव:',
        routingFacility: isEn ? 'Processing Lab Facility:' : isHi ? 'जांच अस्पताल / लैब:' : 'तपासणी प्रयोगशाळा / केंद्र:',
        confirmOrderBtn: isEn ? 'Confirm Diagnostic Order' : isHi ? 'ऑर्डर की पुष्टि करें' : 'चाचणी ऑर्डर निश्चित करा',
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

                        <button
                            onClick={() => setShowNewOrderModal(true)}
                            className="px-4 py-2 bg-[#1F3A6E] hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer transition-all"
                        >
                            <span>{txt.orderTestBtn}</span>
                        </button>
                    </div>

                    {/* Diagnostic Test Catalog & Nearest Availability Router */}
                    <div className="surface-card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black text-[#1F3A6E] uppercase tracking-wider">
                                {txt.catalogTitle}
                            </h2>
                            <span className="text-[11px] text-txt-muted">
                                {txt.catalogSub}
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
                                        <span className="text-xs font-extrabold text-[#1F3A6E] leading-tight">
                                            {isEn ? item.name : isHi ? item.nameHi : item.nameMr}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            item.localAvail ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                                        }`}>
                                            {item.localAvail ? txt.inHouse : txt.referLab}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[11px] text-txt-secondary space-y-0.5">
                                        <p><strong>{isEn ? 'Tier:' : isHi ? 'स्तर:' : 'स्तर:'}</strong> {item.tier}</p>
                                        <p><strong>{isEn ? 'Location:' : isHi ? 'स्थान:' : 'स्थान:'}</strong> {isEn ? item.nearest : isHi ? item.nearestHi : item.nearestMr}</p>
                                        <p><strong>{isEn ? 'Turnaround:' : isHi ? 'समय:' : 'कालावधी:'}</strong> {item.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live Diagnostic Orders & Sample Pipeline */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                {([
                                    { key: 'ALL', label: txt.allOrders },
                                    { key: 'ORDERED', label: txt.ordered },
                                    { key: 'SAMPLE_COLLECTED', label: txt.sampleCollected },
                                    { key: 'IN_PROGRESS', label: txt.inProgress },
                                    { key: 'COMPLETED', label: txt.completed }
                                ]).map((st) => (
                                    <button
                                        key={st.key}
                                        onClick={() => setFilterStatus(st.key)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            filterStatus === st.key
                                                ? 'bg-[#1F3A6E] text-white shadow-sm'
                                                : 'bg-white border border-border-subtle text-txt-secondary hover:bg-gray-50'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={txt.searchPlaceholder}
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
                                                    {order.status === 'COMPLETED' ? txt.completed :
                                                     order.status === 'IN_PROGRESS' ? txt.inProgress :
                                                     order.status === 'SAMPLE_COLLECTED' ? txt.sampleCollected : txt.ordered}
                                                </span>
                                                {order.isAbnormal && (
                                                    <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                        {txt.abnormalBadge}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-extrabold text-[#1F3A6E]">
                                                {order.testName}
                                            </h3>
                                            <p className="text-xs text-txt-muted mt-0.5">
                                                {isEn ? 'Patient:' : isHi ? 'मरीज:' : 'रुग्ण:'} <strong>{order.patientName}</strong> ({order.patientAge}y) • {isEn ? 'Ordered by:' : isHi ? 'डॉक्टर:' : 'वैद्यकीय अधिकारी:'} {order.orderedBy}
                                            </p>
                                        </div>

                                        <span className="text-xs font-mono bg-gray-100 text-txt-muted px-2 py-1 rounded-lg">
                                            {order.id}
                                        </span>
                                    </div>

                                    {/* Result Summary */}
                                    <div className="mt-3 p-3 bg-gray-50 border border-border-subtle rounded-xl text-xs space-y-1">
                                        <div className="flex justify-between font-medium">
                                            <span>{isEn ? 'Facility:' : isHi ? 'केंद्र:' : 'आरोग्य केंद्र:'} <strong>{order.facilityName}</strong></span>
                                            <span className="text-txt-muted">{new Date(order.orderedAt).toLocaleDateString()}</span>
                                        </div>

                                        {order.resultSummary ? (
                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                <span className="font-bold text-txt-primary">{isEn ? 'Result:' : isHi ? 'रिपोर्ट:' : 'अहवाल:'}</span>{' '}
                                                <span className={order.isAbnormal ? 'font-bold text-status-red' : 'text-txt-secondary'}>
                                                    {order.resultSummary}
                                                </span>
                                                <div className="mt-1 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                                    <span>✓ {isEn ? 'Synced to ABDM Longitudinal Health Record (LHR)' : isHi ? 'ABDM हेल्थ रिकॉर्ड (LHR) में दर्ज' : 'ABDM आरोग्य रेकॉर्ड (LHR) ला जोडले गेले'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                                                <button
                                                    onClick={() => handleOpenResultModal(order)}
                                                    className="px-3 py-1 bg-[#1F3A6E] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-800 transition-colors cursor-pointer"
                                                >
                                                    {txt.enterResultBtn}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Result Entry Modal */}
                    {showResultModal && selectedTest && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <div>
                                        <h3 className="text-base font-extrabold text-[#1F3A6E]">
                                            {txt.resultModalTitle}
                                        </h3>
                                        <p className="text-xs text-txt-muted">
                                            {selectedTest.testName} • {selectedTest.patientName}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowResultModal(false)}
                                        className="text-gray-400 hover:text-gray-600 font-bold"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <form onSubmit={handleSaveResult} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-txt-primary mb-1">
                                            {txt.resultFindings}
                                        </label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={resultText}
                                            onChange={(e) => setResultText(e.target.value)}
                                            placeholder={isEn ? 'e.g., Hb: 7.8 g/dL (Severe Microcytic Anemia)' : isHi ? 'उदा. Hb: ७.८ g/dL (एनीमिया)' : 'उदा. हिमोग्लोबिन: ७.८ g/dL (तीव्र अ‍ॅनिमिया)'}
                                            className="w-full p-3 border border-border-subtle rounded-xl text-xs focus:ring-2 focus:ring-emerald-deep outline-none"
                                        />
                                    </div>

                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="abnormalCheck"
                                            checked={isAbnormal}
                                            onChange={(e) => setIsAbnormal(e.target.checked)}
                                            className="rounded text-status-red focus:ring-status-red"
                                        />
                                        <label htmlFor="abnormalCheck" className="text-xs font-bold text-status-red cursor-pointer">
                                            {txt.markAbnormal}
                                        </label>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowResultModal(false)}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-txt-secondary text-xs font-bold rounded-xl cursor-pointer"
                                        >
                                            {txt.cancel}
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-[#1F3A6E] hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                                        >
                                            {txt.saveBtn}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* New Order Modal */}
                    {showNewOrderModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <h3 className="text-base font-extrabold text-[#1F3A6E]">
                                        {txt.createModalTitle}
                                    </h3>
                                    <button
                                        onClick={() => setShowNewOrderModal(false)}
                                        className="text-gray-400 hover:text-gray-600 font-bold"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
                                    <div>
                                        <label className="block font-bold text-txt-primary mb-1">
                                            {txt.selectPatient}
                                        </label>
                                        <select
                                            required
                                            value={orderPatientId}
                                            onChange={(e) => setOrderPatientId(e.target.value)}
                                            className="w-full p-2.5 border rounded-xl"
                                        >
                                            <option value="">-- {isEn ? 'Choose Patient' : isHi ? 'मरीज चुनें' : 'रुग्ण निवडा'} --</option>
                                            {patients.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.age}y / {p.gender}) — {p.village}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-txt-primary mb-1">
                                            {txt.selectTest}
                                        </label>
                                        <select
                                            value={orderTestType}
                                            onChange={(e) => setOrderTestType(e.target.value)}
                                            className="w-full p-2.5 border rounded-xl"
                                        >
                                            {testCatalog.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {isEn ? c.name : isHi ? c.nameHi : c.nameMr} ({c.tier})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-txt-primary mb-1">
                                            {txt.routingFacility}
                                        </label>
                                        <select
                                            value={orderFacilityId}
                                            onChange={(e) => setOrderFacilityId(e.target.value)}
                                            className="w-full p-2.5 border rounded-xl"
                                        >
                                            {MAHARASHTRA_FACILITIES.map((f) => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name} ({f.type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowNewOrderModal(false)}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-txt-secondary rounded-xl font-bold cursor-pointer"
                                        >
                                            {txt.cancel}
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-[#1F3A6E] hover:bg-emerald-800 text-white rounded-xl font-bold shadow cursor-pointer"
                                        >
                                            {txt.confirmOrderBtn}
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
