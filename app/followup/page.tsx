/**
 * High-Risk Patient Follow-Up & Recall Engine — NalamMesh
 * Implements the 3 mandatory cohorts: Maternal (ANC/PNC), Child (Immunization/SAM), Chronic (NCD/TB)
 * Auto-generates weekly FHW task lists and triggers multilingual SMS recalls. */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import Icon from '@/components/gov/Icon';
import { usePatientStore } from '@/stores/patientStore';
import { useLanguageStore } from '@/stores/languageStore';
import { t } from '@/lib/i18n';
import { openSmsComposer } from '@/lib/sms/fallback';
import toast from 'react-hot-toast';
import { useSession } from '@/lib/auth/session';
import { isDistrictWide } from '@/lib/auth/permissions';
import Link from 'next/link';
import { recallTasksFrom, recordFollowUpVisit, type RecallTask } from '@/lib/followup/recall';
import { FACILITY_NETWORK } from '@/lib/data/facilities';


export default function FollowUpPage() {
    const { patients, loadPatients, addPatient } = usePatientStore();
    const { language } = useLanguageStore();

    const [activeTab, setActiveTab] = useState<'ALL' | 'MATERNAL' | 'CHILD' | 'CHRONIC'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [smsModalPatient, setSmsModalPatient] = useState<RecallTask | null>(null);
    const [customSmsText, setCustomSmsText] = useState('');

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    // One task per high-risk flag on a patient's own record (lib/followup/recall.ts):
    // what is due comes from the record, and a recorded visit is saved on it.
    const tasks = useMemo(() => recallTasksFrom(patients), [patients]);
    // SMS reminders opened this session. Only the device's SMS app sends them;
    // this marks which ones the worker has started, nothing more.
    const [smsOpened, setSmsOpened] = useState<Set<string>>(new Set());

    const isEn = language === 'en';
    const isHi = language === 'hi';

    /** Renders a due-day offset as a schedule label plus the real calendar date it lands on. */
    const formatDue = (dueInDays: number | null): string => {
        if (dueInDays === null) {
            return isEn
                ? 'Due on next Village Health & Nutrition Day (VHND)'
                : isHi
                ? 'अगले ग्राम स्वास्थ्य एवं पोषण दिवस (VHND) पर देय'
                : 'पुढील ग्राम आरोग्य व पोषण दिनी (VHND) नियोजित';
        }

        const due = new Date();
        due.setDate(due.getDate() + dueInDays);
        const dateStr = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        if (dueInDays < 0) {
            const n = Math.abs(dueInDays);
            return isEn
                ? `Overdue by ${n} day${n === 1 ? '' : 's'} (${dateStr})`
                : isHi
                ? `${n} दिन विलंबित (${dateStr})`
                : `${n} दिवस विलंबित (${dateStr})`;
        }
        if (dueInDays === 0) {
            return isEn ? `Due today (${dateStr})` : isHi ? `आज देय (${dateStr})` : `आज नियोजित (${dateStr})`;
        }
        return isEn
            ? `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'} (${dateStr})`
            : isHi
            ? `${dueInDays} दिन में देय (${dateStr})`
            : `${dueInDays} दिवसांत नियोजित (${dateStr})`;
    };

    // Only the recalls for patients registered at this worker's own facility.
    // A task whose patient is not on this device is kept out rather than shown
    // to everyone.
    const session = useSession();
    const scopedTasks = tasks.filter(t => {
        if (isDistrictWide(session?.role ?? null)) return true;
        const patient = patients.find(p => p.id === t.patientId);
        return Boolean(session?.facilityId && patient?.registeredAtFacilityId === session.facilityId);
    });

    const filteredTasks = scopedTasks.filter(t => {
        const matchesCohort = activeTab === 'ALL' || t.cohort === activeTab;
        const matchesSearch = t.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.fieldWorker.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCohort && matchesSearch;
    });

    const maternalCount = scopedTasks.filter(t => t.cohort === 'MATERNAL').length;
    const childCount = scopedTasks.filter(t => t.cohort === 'CHILD').length;
    const chronicCount = scopedTasks.filter(t => t.cohort === 'CHRONIC').length;
    const completedCount = scopedTasks.filter(t => t.visited).length;

    const handleMarkComplete = async (task: RecallTask) => {
        const patient = patients.find(p => p.id === task.patientId);
        if (!patient) {
            toast.error('This patient is no longer on this device');
            return;
        }
        const updated = recordFollowUpVisit(patient, task.flagIndex);
        try {
            await addPatient(updated);
        } catch {
            toast.error('The visit could not be saved on this device — try again');
            return;
        }
        const next = updated.highRiskFlags?.[task.flagIndex]?.nextFollowUpDate;
        toast.success(`Visit recorded for ${task.patientName}${next ? ` — next follow-up ${new Date(next).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`);
    };

    const handleOpenSMSModal = (task: RecallTask) => {
        setSmsModalPatient(task);
        // The patient's own facility, in Marathi where the directory has it.
        const facility = FACILITY_NETWORK.find(f => f.id === task.registeredAtFacilityId);
        const place = facility?.nameMarathi || facility?.name || 'आपल्या आरोग्य केंद्रात';
        const template = task.cohort === 'MATERNAL'
            ? `[आरोग्य संदेश] श्रीमती ${task.patientName}, आपली पुढील ANC तपासणी ${place} येथे नियोजित आहे. कृपया आशा ताईंशी संपर्क साधा. मोफत रुग्णवाहिका: 102.`
            : task.cohort === 'CHILD'
            ? `[आरोग्य संदेश] ${task.patientName} यांचे लसीकरण व वजन तपासणी दिवस जवळ आला आहे. कृपया अंगणवाडी केंद्रात या.`
            : `[आरोग्य संदेश] ${task.patientName}, आपली नियमित तपासणी ${place} येथे देय आहे.`;
        setCustomSmsText(template);
    };

    const handleSendSMS = () => {
        if (!smsModalPatient) return;
        setSmsOpened(prev => new Set(prev).add(smsModalPatient.id));

        // Real handoff on mobile/Capacitor: the carrier SMS channel needs no data connection.
        const handedOff = openSmsComposer(smsModalPatient.phone, customSmsText);

        if (handedOff) {
            toast.success(`SMS composer opened for ${smsModalPatient.phone}`, { icon: <Icon name="sms" className="w-4 h-4" /> });
        } else {
            toast(
                `The SMS app did not open on this device — nothing was sent. Open this recall on a phone with a SIM to send it to ${smsModalPatient.phone}.`,
                { icon: <Icon name="sms" className="w-4 h-4" />, duration: 5000 }
            );
        }
        setSmsModalPatient(null);
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
                                    National Health Mission • Maternal, Child & Chronic Care Surveillance
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                                High-Risk Follow-Up & Recall Engine
                            </h1>
                            <p className="text-xs text-txt-secondary mt-0.5">
                                Automated FHW task schedules & multilingual SMS recall for Maternal, Child, and Chronic Care Pathways
                            </p>
                        </div>

                    </div>

                    {/* 3 Mandatory Named Cohorts KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* 1. Maternal Pathway */}
                        <div
                            onClick={() => setActiveTab('MATERNAL')}
                            className={`surface-card p-4 cursor-pointer transition-all ${
                                activeTab === 'MATERNAL' ? 'ring-2 ring-rose-400 shadow-md bg-rose-50/30' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">
                                        1. Maternal Care Cohort
                                    </span>
                                    <h3 className="text-2xl font-black text-rose-950 mt-0.5">{maternalCount} Active</h3>
                                </div>
                                <span className="p-2 bg-rose-100 text-rose-700 rounded"><Icon name="maternal" className="w-5 h-5" /></span>
                            </div>
                            <p className="text-[11px] text-txt-muted mt-2">
                                ANC 1-4 visits, Preeclampsia & Severe Anemia surveillance
                            </p>
                        </div>

                        {/* 2. Child / Immunization Pathway */}
                        <div
                            onClick={() => setActiveTab('CHILD')}
                            className={`surface-card p-4 cursor-pointer transition-all ${
                                activeTab === 'CHILD' ? 'ring-2 ring-amber-400 shadow-md bg-amber-50/30' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
                                        2. Child & Malnutrition (SAM)
                                    </span>
                                    <h3 className="text-2xl font-black text-amber-950 mt-0.5">{childCount} Active</h3>
                                </div>
                                <span className="p-2 bg-amber-100 text-amber-700 rounded"><Icon name="child" className="w-5 h-5" /></span>
                            </div>
                            <p className="text-[11px] text-txt-muted mt-2">
                                Immunization milestones & MUAC Malnutrition tracking
                            </p>
                        </div>

                        {/* 3. Chronic NCD Pathway */}
                        <div
                            onClick={() => setActiveTab('CHRONIC')}
                            className={`surface-card p-4 cursor-pointer transition-all ${
                                activeTab === 'CHRONIC' ? 'ring-2 ring-blue-400 shadow-md bg-blue-50/30' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block">
                                        3. Chronic NCD & TB Pathway
                                    </span>
                                    <h3 className="text-2xl font-black text-blue-950 mt-0.5">{chronicCount} Active</h3>
                                </div>
                                <span className="p-2 bg-blue-100 text-blue-700 rounded"><Icon name="stethoscope" className="w-5 h-5" /></span>
                            </div>
                            <p className="text-[11px] text-txt-muted mt-2">
                                Hypertension, Diabetes & DOTS TB adherence recall
                            </p>
                        </div>

                        {/* 4. Overall Compliance */}
                        <div className="surface-card p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                                        FHW Compliance Score
                                    </span>
                                    <h3 className="text-2xl font-black text-emerald-900 mt-0.5">
                                        {scopedTasks.length === 0 ? 0 : Math.round((completedCount / scopedTasks.length) * 100)}%
                                    </h3>
                                </div>
                                <span className="p-2 bg-emerald-100 text-emerald-800 rounded"><Icon name="target" className="w-5 h-5" /></span>
                            </div>
                            <p className="text-[11px] text-txt-muted mt-2">
                                {completedCount} of {scopedTasks.length} weekly visits completed
                            </p>
                        </div>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="surface-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                            {(['ALL', 'MATERNAL', 'CHILD', 'CHRONIC'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        activeTab === tab
                                            ? 'bg-emerald-deep text-white shadow-sm'
                                            : 'bg-gray-100 text-txt-secondary hover:bg-gray-200'
                                    }`}
                                >
                                    {tab === 'ALL' ? 'All Cohorts (6)' : tab === 'MATERNAL' ? 'Maternal ANC (2)' : tab === 'CHILD' ? 'Child / SAM (2)' : 'Chronic NCD / TB (2)'}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by patient, village, ASHA..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-border-subtle rounded-xl text-xs focus:ring-2 focus:ring-emerald-deep focus:outline-none"
                            />
                            <svg className="w-4 h-4 text-txt-muted absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Task List Table / Cards */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-black text-txt-muted uppercase tracking-wider">
                                Assigned Frontline Health Worker (ASHA/ANM) Field Tasks ({filteredTasks.length})
                            </h2>
                            <span className="text-xs text-txt-muted font-medium">
                                Most urgent first
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {filteredTasks.map((task) => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`surface-card p-5 transition-all ${
                                        task.priority === 'CRITICAL'
                                            ? 'border-l-red-600 bg-red-50/20'
                                            : task.priority === 'HIGH'
                                            ? 'border-l-amber-500'
                                            : 'border-l-emerald-500'
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                        <div className="space-y-1.5 flex-1">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                                    task.cohort === 'MATERNAL' ? 'bg-rose-100 text-rose-800' :
                                                    task.cohort === 'CHILD' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {task.cohort}
                                                </span>

                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                                    task.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
                                                    task.priority === 'HIGH' ? 'bg-amber-700 text-white' :
                                                    'bg-emerald-600 text-white'
                                                }`}>
                                                    {task.priority}
                                                </span>

                                                <h3 className="text-base font-extrabold text-emerald-deep">
                                                    {task.patientName} ({task.age}y, {task.gender})
                                                </h3>

                                                <span className="text-xs text-txt-muted font-medium inline-flex items-center gap-1">
                                                    <Icon name="map-pin" className="w-3 h-3" /> {task.village}
                                                </span>
                                            </div>

                                            <p className="text-xs font-semibold text-txt-primary">
                                                {task.condition}
                                            </p>

                                            <div className="p-2.5 bg-gray-50 border border-border-subtle rounded-xl text-xs text-txt-secondary">
                                                <strong>To check on the visit:</strong> {task.actionNeeded}
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-txt-muted pt-1">
                                                <span className="inline-flex items-center gap-1"><Icon name="community-worker" className="w-3.5 h-3.5" /> Field worker: <strong>{task.fieldWorker || 'not recorded'}</strong></span>
                                                <span>Schedule: <strong className="text-rose-700">{formatDue(task.dueInDays)}</strong></span>
                                                {task.lastVisitAt && <span>Last visit: <strong>{new Date(task.lastVisitAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
                                                <span className="inline-flex items-center gap-1"><Icon name="phone" className="w-3 h-3" /> {task.phone || 'no phone recorded'}</span>
                                                {smsOpened.has(task.id) && <span className="text-teal-800 font-semibold">SMS app opened</span>}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-row lg:flex-col gap-2 shrink-0 justify-end">
                                            <button
                                                onClick={() => handleOpenSMSModal(task)}
                                                disabled={!task.phone}
                                                className="px-3.5 py-2 bg-white border border-border-subtle hover:bg-teal-50 text-teal-800 text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                                            >
                                                <Icon name="sms" className="w-3.5 h-3.5" /> SMS Reminder
                                            </button>

                                            {!task.visited ? (
                                                <button
                                                    onClick={() => void handleMarkComplete(task)}
                                                    className="px-3.5 py-2 bg-emerald-deep hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                                                >
                                                    <span>✓ Mark Visited</span>
                                                </button>
                                            ) : (
                                                <span className="px-3.5 py-2 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-xl text-center">
                                                    ✓ Visit Done
                                                </span>
                                            )}

                                            <Link
                                                href={`/record?id=${task.patientId}`}
                                                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-txt-secondary text-xs font-semibold rounded-xl text-center"
                                            >
                                                View LHR →
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* SMS Recall Modal */}
                {smsModalPatient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                        <div className="bg-white rounded p-6 max-w-lg w-full shadow-xl border border-border-subtle space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Icon name="sms" className="w-6 h-6 text-emerald-deep" />
                                    <div>
                                        <h3 className="text-base font-bold text-emerald-deep">
                                            Vernacular SMS Recall Dispatcher
                                        </h3>
                                        <span className="text-xs text-txt-muted">
                                            To: {smsModalPatient.patientName} ({smsModalPatient.phone})
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSmsModalPatient(null)} className="text-txt-muted hover:text-txt-primary">✕</button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-txt-secondary">
                                    Message Text (Localized in Marathi / Hindi / English):
                                </label>
                                <textarea
                                    value={customSmsText}
                                    onChange={(e) => setCustomSmsText(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 bg-gray-50 border border-border-subtle rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-deep focus:outline-none"
                                />
                                <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                                    <Icon name="alert-siren" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>
                                        Opens your phone&apos;s SMS app with this message pre-filled — works on a mobile
                                        device with SIM connectivity (no data needed). There is no server-side SMS
                                        gateway; on a desktop the composer will not open.
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    onClick={() => setSmsModalPatient(null)}
                                    className="px-4 py-2 bg-gray-100 text-txt-secondary text-xs font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendSMS}
                                    className="px-4 py-2 bg-emerald-deep text-white text-xs font-bold rounded-xl shadow"
                                >
                                    Open SMS on Device
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
