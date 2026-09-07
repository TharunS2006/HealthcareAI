/**
 * Essential Medicine Inventory & Diagnostic Coordination — NalamMesh
 * Indian Public Health Standards (IPHS) Compliance (SIH PS#26133)
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { useFacilityStore } from '@/stores/facilityStore';
import { useLanguageStore } from '@/stores/languageStore';
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

    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDiag, setSelectedDiag] = useState<DiagnosticOrder | null>(null);
    const [labResultText, setLabResultText] = useState('');
    const [isAbnormal, setIsAbnormal] = useState(false);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const filteredMeds = medicines.filter(m => {
        const matchesCat = filterCategory === 'ALL' || m.category.toLowerCase().includes(filterCategory.toLowerCase());
        const matchesSearch = searchQuery === '' || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.facilityName.toLowerCase().includes(searchQuery.toLowerCase());
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
        toast.success(isEn ? 'Diagnostic result updated and linked to patient LHR' : isHi ? 'लैब रिपोर्ट अपडेट कर मरीज के डिजिटल रिकॉर्ड (LHR) में दर्ज की गई' : 'लॅब अहवाल अपडेट करून रुग्णाच्या डिजिटल आरोग्य नोंदीमध्ये (LHR) जोडला गेला');
    };

    const txt = {
        deptTag: isEn ? 'Indian Public Health Standards (IPHS) Drug & Diagnostic Portal' : isHi ? 'भारतीय सार्वजनिक स्वास्थ्य मानक (IPHS) दवा व निदान पोर्टल' : 'भारतीय सार्वजनिक आरोग्य मानक (IPHS) औषध व निदान पोर्टल',
        title: isEn ? 'Medicine Inventory & Diagnostic Coordination' : isHi ? 'आवश्यक दवा स्टॉक एवं निदान समन्वय' : 'अत्यावश्यक औषध साठा व निदान समन्वय',
        subTitle: isEn
            ? 'Stock visibility, emergency reorder alerts, and cross-tier lab test tracking for Gadchiroli'
            : isHi
            ? 'गढ़चिरौली जिले में दवा स्टॉक, आपातकालीन पुनः आपूर्ति व बहु-स्तरीय परीक्षण ट्रैकिंग'
            : 'गडचिरोली जिल्ह्यातील औषध साठा, तातडीची मागणी सूचना आणि सर्व स्तरीय लॅब चाचण्यांची स्थिती',
        emergencyReqBtn: isEn ? '🚨 Emergency Supply Request' : isHi ? '🚨 आपातकालीन आपूर्ति मांग' : '🚨 आपत्कालीन औषध मागणी',
        criticalAlert: isEn
            ? `Critical Stock Alert: ${outOfStockMeds.length} items Out-of-Stock, ${lowStockMeds.length} items Low`
            : isHi
            ? `गंभीर स्टॉक चेतावनी: ${outOfStockMeds.length} दवाएं अनुपलब्ध, ${lowStockMeds.length} कम स्टॉक में`
            : `गंभीर साठा सूचना: ${outOfStockMeds.length} औषधे संपली आहेत, ${lowStockMeds.length} औषधे कमी साठ्यात आहेत`,
        alertSub: isEn
            ? `Immediate restock needed for ${outOfStockMeds.map(m => m.name).join(', ') || 'essential drugs'}.`
            : isHi
            ? `${outOfStockMeds.map(m => m.name).join(', ') || 'अत्यावश्यक दवाओं'} के लिए तत्काल वेयरहाउस से आपूर्ति आवश्यक।`
            : `${outOfStockMeds.map(m => m.name).join(', ') || 'अत्यावश्यक औषधांसाठी'} जिल्हा गोदामाकडून तातडीचा पुरवठा आवश्यक.`,
        autoRestockBtn: isEn ? 'Auto-Restock All' : isHi ? 'सभी स्वतः पुनः मंगाएं' : 'सर्व औषधे पुन्हा मागवा',
        tableTitle: isEn ? 'Essential Medicine Stock (IPHS)' : isHi ? 'आवश्यक दवा स्टॉक (IPHS सूची)' : 'अत्यावश्यक औषध साठा (IPHS मानके)',
        filterPlaceholder: isEn ? 'Filter drug...' : isHi ? 'दवा खोजें...' : 'औषध शोधा...',
        allCategories: isEn ? 'All Categories' : isHi ? 'सभी श्रेणियां' : 'सर्व प्रकार',
        thMed: isEn ? 'Medicine / Form' : isHi ? 'दवा व प्रकार' : 'औषध व प्रकार',
        thStock: isEn ? 'Stock Level' : isHi ? 'स्टॉक स्तर' : 'साठा पातळी',
        thStatus: isEn ? 'Status' : isHi ? 'स्थिति' : 'स्थिती',
        thFacility: isEn ? 'Facility' : isHi ? 'स्वास्थ्य केंद्र' : 'आरोग्य केंद्र',
        thAction: isEn ? 'Action' : isHi ? 'कार्रवाई' : 'क्रिया',
        restockAction: isEn ? '+ Restock' : isHi ? '+ मंगाएं' : '+ साठा वाढवा',
        labOrdersTitle: isEn ? 'Diagnostic Lab Orders' : isHi ? 'लैब परीक्षण ऑर्डर्स' : 'लॅब तपासणी ऑर्डर्स',
        resultsEntryTitle: isEn ? 'Enter Lab Result' : isHi ? 'लैब रिपोर्ट दर्ज करें' : 'लॅब अहवाल नोंदवा',
        sampleCollected: isEn ? 'Sample Collected' : isHi ? 'सैंपल संकलित' : 'नमुना गोळा केला',
        labProcessing: isEn ? 'Processing at Lab' : isHi ? 'लैब में प्रक्रियाधीन' : 'प्रयोगशाळेत तपासणी सुरू',
        completed: isEn ? 'Completed' : isHi ? 'पूर्ण' : 'पूर्ण झाले',
        saveResultBtn: isEn ? 'Save & Push to LHR' : isHi ? 'सुरक्षित करें व LHR में भेजें' : 'जतन करा व LHR ला पाठवा',
        cancelBtn: isEn ? 'Cancel' : isHi ? 'रद्द करें' : 'रद्द करा',
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
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
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
                            onClick={() => toast.success(isEn ? 'Emergency Drug Requisition sent to District Warehouse Gadchiroli' : isHi ? 'जिला गोदाम गढ़चिरौली को आपातकालीन दवा मांग भेजी गई' : 'जिल्हा गोदाम गडचिरोलीकडे आपत्कालीन औषध मागणी नोंदवली')}
                            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white text-xs font-bold rounded-xl shadow hover:opacity-95 cursor-pointer"
                        >
                            {txt.emergencyReqBtn}
                        </button>
                    </div>

                    {/* Critical Out of Stock Alert Banner */}
                    {(outOfStockMeds.length > 0 || lowStockMeds.length > 0) && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-950 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <strong className="block text-amber-900 text-sm font-extrabold">
                                        {txt.criticalAlert}
                                    </strong>
                                    <span className="text-amber-800">
                                        {txt.alertSub}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    outOfStockMeds.forEach(m => restockMedicine(m.id, 100));
                                    toast.success(isEn ? 'Auto-restocked essential medicines' : isHi ? 'आवश्यक दवाओं का पुनः स्टॉक किया गया' : 'अत्यावश्यक औषधांचा साठा वाढवला');
                                }}
                                className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-all shrink-0 ml-4 cursor-pointer"
                            >
                                {txt.autoRestockBtn}
                            </button>
                        </div>
                    )}

                    {/* 3-Column Layout */}
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Column 1 (7 cols): Medicine Stock Table */}
                        <div className="lg:col-span-7 surface-card p-5 space-y-4">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <h2 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider">
                                    {txt.tableTitle}
                                </h2>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder={txt.filterPlaceholder}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="px-3 py-1 bg-gray-50 border rounded-lg text-xs outline-none w-32"
                                    />
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="p-1 bg-gray-50 border rounded-lg text-xs font-semibold"
                                    >
                                        <option value="ALL">{txt.allCategories}</option>
                                        <option value="Analgesic">{isEn ? 'Analgesic' : isHi ? 'दर्द निवारक' : 'वेदना शामक'}</option>
                                        <option value="Antibiotic">{isEn ? 'Antibiotic' : isHi ? 'एंटीबायोटिक' : 'प्रतिजैविके'}</option>
                                        <option value="Maternal">{isEn ? 'Maternal / ANC' : isHi ? 'मातृ स्वास्थ्य' : 'मातृ आरोग्य'}</option>
                                        <option value="Anti-diabetic">{isEn ? 'Anti-diabetic' : isHi ? 'मधुमेह' : 'मधुमेह'}</option>
                                        <option value="Emergency">{isEn ? 'Emergency' : isHi ? 'आपातकालीन' : 'आपत्कालीन'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-border-subtle text-left text-txt-muted uppercase font-bold">
                                            <th className="pb-2">{txt.thMed}</th>
                                            <th className="pb-2">{txt.thStock}</th>
                                            <th className="pb-2">{txt.thStatus}</th>
                                            <th className="pb-2">{txt.thFacility}</th>
                                            <th className="pb-2 text-right">{txt.thAction}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {filteredMeds.map((med) => (
                                            <tr key={med.id} className="hover:bg-teal-50/30 transition-colors">
                                                <td className="py-2.5">
                                                    <div className="font-bold text-[#1F3A6E]">{med.name}</div>
                                                    <span className="text-[10px] text-txt-muted">{med.category} • {med.dosageForm}</span>
                                                </td>
                                                <td className="py-2.5 font-mono font-bold">
                                                    <span className={med.currentStock === 0 ? 'text-status-red' : med.currentStock < med.minimumRequiredStock ? 'text-amber-600' : 'text-[#1F3A6E]'}>
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
                                                        {med.status === 'OUT_OF_STOCK' ? (isEn ? 'OUT OF STOCK' : isHi ? 'अनुपलब्ध' : 'साठा संपला') :
                                                         med.status === 'LOW' ? (isEn ? 'LOW STOCK' : isHi ? 'कम स्टॉक' : 'कमी साठा') :
                                                         med.status === 'NEAR_EXPIRY' ? (isEn ? 'NEAR EXPIRY' : isHi ? 'निकट समाप्ति' : 'मुदत संपत आलेले') :
                                                         (isEn ? 'IN STOCK' : isHi ? 'उपलब्ध' : 'उपलब्ध')}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-[10px] text-txt-secondary truncate max-w-[110px]">
                                                    {med.facilityName}
                                                </td>
                                                <td className="py-2.5 text-right">
                                                    <button
                                                        onClick={() => {
                                                            restockMedicine(med.id, 50);
                                                            toast.success(`+50 ${med.unit} ${med.name}`);
                                                        }}
                                                        className="px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold rounded text-[10px] cursor-pointer"
                                                    >
                                                        {txt.restockAction}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Column 2 (5 cols): Diagnostic Lab Orders */}
                        <div className="lg:col-span-5 surface-card p-5 space-y-4">
                            <h2 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider">
                                {txt.labOrdersTitle}
                            </h2>

                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                {diagnostics.map((diag) => (
                                    <div
                                        key={diag.id}
                                        className="p-3 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-all space-y-2"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <strong className="text-xs font-bold text-[#1F3A6E] block">{diag.testName}</strong>
                                                <span className="text-[10px] text-txt-muted">
                                                    {diag.patientName} • {diag.facilityName}
                                                </span>
                                            </div>
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                                diag.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                                                diag.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                                {diag.status === 'COMPLETED' ? txt.completed :
                                                 diag.status === 'IN_PROGRESS' ? txt.labProcessing : txt.sampleCollected}
                                            </span>
                                        </div>

                                        {diag.resultSummary ? (
                                            <div className="p-2 bg-slate-50 border rounded text-[11px]">
                                                <span className="font-bold text-slate-700">{isEn ? 'Result:' : isHi ? 'परिणाम:' : 'अहवाल:'}</span>{' '}
                                                <span className={diag.isAbnormal ? 'text-red-700 font-bold' : 'text-slate-800'}>{diag.resultSummary}</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setSelectedDiag(diag)}
                                                className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs transition-colors cursor-pointer"
                                            >
                                                ✍️ {txt.resultsEntryTitle}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Result Entry Modal */}
                    {selectedDiag && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                                <h3 className="text-base font-black text-[#1F3A6E]">
                                    {txt.resultsEntryTitle}: {selectedDiag.testName}
                                </h3>
                                <p className="text-xs text-slate-600">
                                    {selectedDiag.patientName} • {selectedDiag.facilityName}
                                </p>

                                <form onSubmit={handleSaveLabResult} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            {isEn ? 'Clinical Findings / Values' : isHi ? 'परीक्षण परिणाम / निष्कर्ष' : 'लॅब अहवाल मूल्य व निष्कर्ष'}
                                        </label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={labResultText}
                                            onChange={(e) => setLabResultText(e.target.value)}
                                            placeholder={isEn ? 'e.g. Hb 8.4 g/dL (Moderate Anemia)' : isHi ? 'उदा. Hb ८.४ g/dL (एनीमिया)' : 'उदा. हिमोग्लोबिन ८.४ g/dL (अ‍ॅनिमिया)'}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                        <input
                                            type="checkbox"
                                            checked={isAbnormal}
                                            onChange={(e) => setIsAbnormal(e.target.checked)}
                                            className="rounded text-red-600 focus:ring-red-500"
                                        />
                                        <span>{isEn ? 'Mark as Abnormal / Alert Doctor' : isHi ? 'असामान्य (Abnormal) चिह्नित करें' : 'असामान्य (Abnormal) चिन्हांकित करा'}</span>
                                    </label>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDiag(null)}
                                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                                        >
                                            {txt.cancelBtn}
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-2 bg-[#1F3A6E] hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer"
                                        >
                                            {txt.saveResultBtn}
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
