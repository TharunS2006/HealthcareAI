/**
 * Queue & Token Management Suite — NalamMesh
 * OPD Waiting Time Reduction & Priority Calling (SIH PS#26133)
 * Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import LoadingSkeleton from '@/components/gov/LoadingSkeleton';
import { useQueueStore } from '@/stores/queueStore';
import { useLanguageStore } from '@/stores/languageStore';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import toast from 'react-hot-toast';

export default function QueuePage() {
    const {
        queue,
        currentServing,
        isLoading,
        loadQueue,
        callNext,
        prioritizeEntry,
        updateEntryStatus,
        selectedFacilityId,
        setSelectedFacilityId,
    } = useQueueStore();

    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    const [isTvMode, setIsTvMode] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        loadQueue();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [loadQueue]);

    const waitingPatients = queue.filter(q => q.status === 'WAITING');
    const completedPatients = queue.filter(q => q.status === 'COMPLETED');

    const txt = {
        deptTag: isEn ? 'Smart Queue & Token Calling Engine' : isHi ? 'स्मार्ट ओपीडी कतार व टोकन इंजन' : 'स्मार्ट ओपीडी रांग व टोकन प्रणाली',
        title: isEn ? 'Queue Management — PHC Bhamragad' : isHi ? 'ओपीडी कतार प्रबंधन — प्रा. स्वा. केंद्र भामरागढ़' : 'ओपीडी रांग व्यवस्थापन — प्रा. आ. केंद्र भामरागड',
        subTitle: isEn
            ? 'Prioritize critical triage patients, track waiting times, and streamline doctor consultation'
            : isHi
            ? 'गंभीर मरीजों को प्राथमिकता, प्रतीक्षा समय की निगरानी एवं त्वरित डॉक्टर परामर्श'
            : 'अतिगंभीर रुग्णांना प्राधान्य, प्रतीक्षा वेळेचे नियंत्रण आणि जलद वैद्यकीय तपासणी',
        launchTv: isEn ? 'Launch Full-Screen TV Display' : isHi ? 'पूर्ण-स्क्रीन टीवी डिस्प्ले चालू करें' : 'टीव्ही डिस्प्ले सुरू करा (TV Mode)',
        exitTv: isEn ? 'Exit TV Mode (Esc)' : isHi ? 'टीवी मोड से बाहर निकलें' : 'टीव्ही मोड बंद करा',
        nowServing: isEn ? 'Currently In Consultation' : isHi ? 'वर्तमान में परामर्श जारी' : 'सध्या तपासणी सुरू',
        nowServingTv: isEn ? '● Now Serving' : isHi ? '● वर्तमान परामर्श जारी' : '● सध्या तपासणी सुरू',
        roomLabel: isEn ? 'Room 2 • General OPD' : isHi ? 'कक्ष क्र. २ • सामान्य ओपीडी' : 'खोली क्र. २ • सामान्य ओपीडी',
        allDone: isEn ? 'All Waiting Patients Consulted' : isHi ? 'सभी प्रतीक्षा कर रहे मरीजों का परामर्श पूर्ण' : 'सर्व प्रतीक्षारत रुग्णांची तपासणी पूर्ण झाली आहे',
        finishConsult: isEn ? '✓ Finish Consultation' : isHi ? '✓ परामर्श पूर्ण करें' : '✓ तपासणी पूर्ण झाली',
        readyNext: isEn ? "Doctor ready for next patient. Click 'Call Next Patient' below." : isHi ? "डॉक्टर अगले मरीज हेतु तैयार हैं। नीचे 'अगले मरीज को बुलाएं' पर क्लिक करें।" : "डॉक्टर पुढील रुग्णासाठी सज्ज आहेत. खालील 'पुढील रुग्णास बोलवा' बटनावर क्लिक करा.",
        callNextBtn: isEn ? 'Call Next Patient' : isHi ? 'अगले मरीज को बुलाएं' : 'पुढील रुग्णास बोलवा',
        waitingQueueTitle: isEn ? 'Waiting Queue' : isHi ? 'प्रतीक्षारत कतार' : 'प्रतीक्षा रांग',
        estWait: isEn ? 'Est. Avg. Wait: ~15 mins' : isHi ? 'अनुमानित औसत प्रतीक्षा: ~१५ मिनट' : 'सरासरी प्रतीक्षा वेळ: ~१५ मिनिटे',
        thToken: isEn ? 'Token' : isHi ? 'टोकन' : 'टोकन',
        thPatient: isEn ? 'Patient Name' : isHi ? 'मरीज का नाम' : 'रुग्णाचे नाव',
        thPriority: isEn ? 'Priority' : isHi ? 'प्राथमिकता' : 'प्राधान्य',
        thWaitTime: isEn ? 'Wait Time' : isHi ? 'प्रतीक्षा समय' : 'प्रतीक्षा वेळ',
        thActions: isEn ? 'Actions' : isHi ? 'कार्रवाई' : 'क्रिया',
        noWaiting: isEn ? 'No patients waiting in queue.' : isHi ? 'कतार में कोई मरीज प्रतीक्षारत नहीं है।' : 'रांगेमध्ये कोणताही रुग्ण प्रतीक्षेत नाही.',
        overrideBtn: isEn ? 'Override' : isHi ? 'प्राथमिकता दें' : 'अग्रक्रम द्या',
        skipBtn: isEn ? 'Skip' : isHi ? 'छोड़ें' : 'वगळा',
        analyticsTitle: isEn ? 'Queue Performance Today' : isHi ? 'आज का कतार प्रदर्शन' : 'आजचे रांग व्यवस्थापन आकडेवारी',
        totalServed: isEn ? 'Total Consulted' : isHi ? 'कुल परामर्शित' : 'एकूण तपासलेले रुग्ण',
        avgWaitTimeLabel: isEn ? 'Avg Wait Time' : isHi ? 'औसत प्रतीक्षा समय' : 'सरासरी प्रतीक्षा वेळ',
        longestWait: isEn ? 'Longest Wait' : isHi ? 'अधिकतम प्रतीक्षा' : 'कमाल प्रतीक्षा वेळ',
        activeDoctors: isEn ? 'Doctors On Duty' : isHi ? 'ड्यूटी पर डॉक्टर' : 'कार्यरत वैद्यकीय अधिकारी',
        completedTitle: isEn ? 'Completed Consultations' : isHi ? 'परामर्श पूर्ण मरीज' : 'तपासणी पूर्ण झालेले रुग्ण',
    };

    // TV Mode
    if (isTvMode) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col justify-between select-none">
                {/* TV Header */}
                <header className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-emerald-400 uppercase">
                                {isEn ? 'PHC Bhamragad — OPD Token Calling Display' : isHi ? 'प्राथमिक स्वास्थ्य केंद्र भामरागढ़ — ओपीडी टोकन डिस्प्ले' : 'प्राथमिक आरोग्य केंद्र भामरागड — ओपीडी टोकन डिस्प्ले'}
                            </h1>
                            <p className="text-sm text-slate-400">
                                {isEn ? 'Department of Public Health • Government of Maharashtra' : isHi ? 'लोक स्वास्थ्य विभाग • महाराष्ट्र सरकार' : 'सार्वजनिक आरोग्य विभाग • महाराष्ट्र शासन'}
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
                            {txt.exitTv}
                        </button>
                    </div>
                </header>

                {/* Giant Live Serving Section */}
                <div className="grid md:grid-cols-12 gap-8 my-8">
                    <div className="md:col-span-7 bg-slate-900/90 border-2 border-emerald-500/60 rounded-3xl p-10 flex flex-col justify-center items-center text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-4 left-6 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700">
                            {txt.nowServingTv}
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
                                    {txt.roomLabel} • {currentServing.consultingDoctor || 'Dr. Suresh Atram'}
                                </p>
                            </motion.div>
                        ) : (
                            <div className="py-16 text-slate-500 text-2xl font-bold">
                                {txt.allDone}
                            </div>
                        )}
                    </div>

                    {/* Next in Queue on TV */}
                    <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-300 mb-4 pb-2 border-b border-slate-800 uppercase tracking-wider flex justify-between">
                            <span>{isEn ? 'Up Next' : isHi ? 'अगले मरीज' : 'पुढील रुग्ण'}</span>
                            <span className="text-sm text-teal-400">{waitingPatients.length} {isEn ? 'Waiting' : isHi ? 'प्रतीक्षारत' : 'प्रतीक्षेत'}</span>
                        </h3>

                        <div className="space-y-3 overflow-y-auto max-h-[400px]">
                            {waitingPatients.slice(0, 5).map((entry, idx) => (
                                <div
                                    key={entry.id}
                                    className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-between"
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
                    NalamMesh Digital Public Infrastructure • Government of Maharashtra
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

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsTvMode(true)}
                                className="gov-btn gov-btn-primary text-xs"
                            >
                                <Icon name="tv" className="w-3.5 h-3.5" /> {txt.launchTv}
                            </button>
                        </div>
                    </div>

                    {/* Main Area: 2 Columns */}
                    {isLoading && queue.length === 0 ? (
                        <LoadingSkeleton variant="card" rows={3} />
                    ) : (
                    <div className="grid lg:grid-cols-12 gap-6">

                        {/* Left Column (7 cols): Live Serving Banner & Waiting List */}
                        <div className="lg:col-span-7 space-y-6">

                            {/* Now Serving Big Card */}
                            <div className="surface-card p-6 border-l-4 border-l-emerald-deep bg-emerald-50/40">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                                        ● {txt.nowServing}
                                    </span>
                                    <span className="text-xs text-txt-muted">{txt.roomLabel}</span>
                                </div>

                                {currentServing ? (
                                    <div className="py-4 flex justify-between items-center">
                                        <div>
                                            <span className="text-5xl font-mono font-extrabold text-[#1F3A6E] block">
                                                {currentServing.tokenNumber}
                                            </span>
                                            <h2 className="text-xl font-bold text-txt-primary mt-1">
                                                {currentServing.patientName}
                                            </h2>
                                            <p className="text-xs text-txt-muted">
                                                {isEn ? 'Chief Complaint:' : isHi ? 'मुख्य समस्या:' : 'मुख्य तक्रार:'} {currentServing.chiefComplaint || 'General OPD Examination'}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => updateEntryStatus(currentServing.id, 'COMPLETED')}
                                            className="px-4 py-3 bg-[#1F3A6E] text-white text-xs font-bold rounded-xl shadow hover:bg-emerald-800 transition-all cursor-pointer"
                                        >
                                            {txt.finishConsult}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-txt-muted text-sm font-semibold">
                                        {txt.readyNext}
                                    </div>
                                )}

                                {/* Calling Actions */}
                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button
                                        onClick={() => callNext()}
                                        className="flex-1 py-3.5 bg-emerald-deep hover:bg-emerald-800 text-white font-bold text-sm rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Icon name="megaphone" className="w-4 h-4" />
                                        <span>{txt.callNextBtn}</span>
                                        <span>→</span>
                                    </button>
                                </div>
                            </div>

                            {/* Waiting Patients Table */}
                            <div className="surface-card p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider">
                                        {txt.waitingQueueTitle} ({waitingPatients.length})
                                    </h3>
                                    <span className="text-xs text-txt-muted">{txt.estWait}</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-subtle text-left text-txt-muted uppercase font-bold">
                                                <th className="pb-3">{txt.thToken}</th>
                                                <th className="pb-3">{txt.thPatient}</th>
                                                <th className="pb-3">{txt.thPriority}</th>
                                                <th className="pb-3">{txt.thWaitTime}</th>
                                                <th className="pb-3 text-right">{txt.thActions}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {waitingPatients.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-txt-muted">
                                                        {txt.noWaiting}
                                                    </td>
                                                </tr>
                                            ) : (
                                                waitingPatients.map((entry) => (
                                                    <tr key={entry.id} className="hover:bg-teal-50/30 transition-colors">
                                                        <td className="py-3.5 font-mono font-bold text-sm text-[#1F3A6E]">
                                                            {entry.tokenNumber}
                                                        </td>
                                                        <td className="py-3.5">
                                                            <div className="font-bold text-[#1F3A6E]">{entry.patientName}</div>
                                                            <div className="text-[10px] text-txt-muted truncate max-w-[140px]">{entry.chiefComplaint}</div>
                                                        </td>
                                                        <td className="py-3.5">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                                                                entry.priority === 'URGENT' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-green-100 text-green-800'
                                                            }`}>
                                                                {entry.priority === 'EMERGENCY' ? (isEn ? 'EMERGENCY' : isHi ? 'अति गंभीर' : 'तातडीचे') :
                                                                 entry.priority === 'URGENT' ? (isEn ? 'URGENT' : isHi ? 'प्राथमिक' : 'प्राधान्य') :
                                                                 (isEn ? 'STABLE' : isHi ? 'सामान्य' : 'नियमित')}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 text-txt-muted">
                                                            ~{entry.estimatedWaitMinutes} mins
                                                        </td>
                                                        <td className="py-3.5 text-right space-x-1.5">
                                                            {entry.priority !== 'EMERGENCY' && (
                                                                <button
                                                                    onClick={() => prioritizeEntry(entry.id)}
                                                                    className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded text-[10px] cursor-pointer"
                                                                >
                                                                    {txt.overrideBtn}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => updateEntryStatus(entry.id, 'NO_SHOW')}
                                                                className="px-2 py-1 bg-gray-100 text-txt-secondary hover:bg-gray-200 font-medium rounded text-[10px] cursor-pointer"
                                                            >
                                                                {txt.skipBtn}
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
                                <h3 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider">
                                    {txt.analyticsTitle}
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-emerald-800 block uppercase">{txt.totalServed}</span>
                                        <strong className="text-2xl font-black text-[#1F3A6E]">{completedPatients.length + 38}</strong>
                                    </div>
                                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-teal-800 block uppercase">{txt.avgWaitTimeLabel}</span>
                                        <strong className="text-2xl font-black text-teal-800">14 min</strong>
                                    </div>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-amber-800 block uppercase">{txt.longestWait}</span>
                                        <strong className="text-2xl font-black text-amber-800">28 min</strong>
                                    </div>
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <span className="text-[10px] font-bold text-blue-800 block uppercase">{txt.activeDoctors}</span>
                                        <strong className="text-2xl font-black text-blue-800">2 (MOs)</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Completed Summary */}
                            <div className="surface-card p-6">
                                <h3 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider mb-3">
                                    {txt.completedTitle}
                                </h3>
                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                    {completedPatients.map((entry) => (
                                        <div key={entry.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                                            <div>
                                                <strong className="text-slate-900">{entry.patientName}</strong>
                                                <span className="text-[10px] text-slate-500 ml-2 font-mono">Token {entry.tokenNumber}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                                ✓ {isEn ? 'Completed' : isHi ? 'पूर्ण' : 'पूर्ण'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                    )}
                </div>
            </main>
        </div>
    );
}
