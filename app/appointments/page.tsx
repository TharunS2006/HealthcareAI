/**
 * Appointment Scheduling — NalamMesh (SIH PS#26133)
 *
 * Future-dated OPD booking against a facility's daily slot capacity, with a facility-scoped
 * upcoming list and a check-in that hands the booking to the live OPD queue on the day.
 * Trilingual (en/hi/mr); fully offline (IndexedDB). Complements the walk-in queue so the
 * platform covers "appointment AND queue management".
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { usePatientStore } from '@/stores/patientStore';
import { useAppointmentStore } from '@/stores/appointmentStore';
import { useLanguageStore } from '@/stores/languageStore';
import { Appointment, APPOINTMENT_SLOTS, APPOINTMENT_DEPARTMENTS, AppointmentSource } from '@/types/appointment';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import Link from 'next/link';

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AppointmentsPage() {
    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    const { patients, loadPatients } = usePatientStore();
    const { appointments, loadAppointments, addAppointment, changeStatus, convertToToken } = useAppointmentStore();

    const [facilityId, setFacilityId] = useState('phc-bhamragad');
    const [patientId, setPatientId] = useState('');
    const [department, setDepartment] = useState<string>(APPOINTMENT_DEPARTMENTS[0]);
    const [date, setDate] = useState(todayISO());
    const [slot, setSlot] = useState<string>(APPOINTMENT_SLOTS[0]);
    const [createdVia, setCreatedVia] = useState<AppointmentSource>('ASHA_BOOKED');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadPatients();
        loadAppointments();
    }, [loadPatients, loadAppointments]);

    const facility = MAHARASHTRA_FACILITIES.find(f => f.id === facilityId) ?? MAHARASHTRA_FACILITIES[0];
    // Per-slot capacity derived from staffing (min 2), so a busy PHC books more than a Sub-Centre.
    const slotCapacity = Math.max(2, facility.staff.doctors * 2);

    const activeAt = (d: string, s: string) =>
        appointments.filter(a =>
            a.facilityId === facilityId && a.requestedDate === d && a.slot === s &&
            (a.status === 'REQUESTED' || a.status === 'CONFIRMED')
        ).length;

    const remainingForChosen = slotCapacity - activeAt(date, slot);

    const upcoming = useMemo(() => {
        return appointments
            .filter(a => a.facilityId === facilityId && a.status !== 'CANCELLED')
            .sort((a, b) => (a.requestedDate === b.requestedDate
                ? a.slot.localeCompare(b.slot)
                : a.requestedDate.localeCompare(b.requestedDate)));
    }, [appointments, facilityId]);

    const patientById = (id: string) => patients.find(p => p.id === id);

    const t = {
        deptTag: isEn ? 'Government of Maharashtra • Public Health — OPD Scheduling'
            : isHi ? 'महाराष्ट्र सरकार • सार्वजनिक स्वास्थ्य — ओपीडी अनुसूची'
            : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य — ओपीडी नियोजन',
        title: isEn ? 'Appointment Scheduling' : isHi ? 'अपॉइंटमेंट अनुसूची' : 'भेटीचे नियोजन',
        subtitle: isEn ? 'Book a future OPD slot; walk-ins still use the live token queue'
            : isHi ? 'भविष्य का ओपीडी स्लॉट बुक करें; वॉक-इन के लिए लाइव टोकन कतार'
            : 'भविष्यातील ओपीडी स्लॉट बुक करा; वॉक-इनसाठी थेट टोकन रांग',
        book: isEn ? 'Book Appointment' : isHi ? 'अपॉइंटमेंट बुक करें' : 'भेट नोंदवा',
        facility: isEn ? 'Facility' : isHi ? 'केंद्र' : 'केंद्र',
        patient: isEn ? 'Patient' : isHi ? 'मरीज' : 'रुग्ण',
        choosePatient: isEn ? 'Select a registered patient…' : isHi ? 'पंजीकृत मरीज चुनें…' : 'नोंदणीकृत रुग्ण निवडा…',
        department: isEn ? 'Department' : isHi ? 'विभाग' : 'विभाग',
        date: isEn ? 'Date' : isHi ? 'तारीख' : 'दिनांक',
        slot: isEn ? 'Slot' : isHi ? 'समय स्लॉट' : 'वेळ स्लॉट',
        bookedBy: isEn ? 'Booked by' : isHi ? 'बुक किया' : 'नोंदवले',
        asha: isEn ? 'ASHA / Health Worker' : isHi ? 'आशा / स्वास्थ्य कार्यकर्ता' : 'आशा / आरोग्य कर्मचारी',
        self: isEn ? 'Patient (self)' : isHi ? 'मरीज (स्वयं)' : 'रुग्ण (स्वतः)',
        notes: isEn ? 'Notes (optional)' : isHi ? 'टिप्पणी (वैकल्पिक)' : 'टिप्पणी (ऐच्छिक)',
        left: isEn ? 'left' : isHi ? 'शेष' : 'शिल्लक',
        full: isEn ? 'FULL' : isHi ? 'भरा' : 'भरले',
        upcomingTitle: isEn ? 'Upcoming Appointments' : isHi ? 'आगामी अपॉइंटमेंट' : 'आगामी भेटी',
        none: isEn ? 'No appointments booked at this facility yet.' : isHi ? 'इस केंद्र पर कोई अपॉइंटमेंट नहीं।' : 'या केंद्रावर अद्याप भेट नाही.',
        confirm: isEn ? 'Confirm' : isHi ? 'पुष्टि' : 'निश्चित करा',
        cancel: isEn ? 'Cancel' : isHi ? 'रद्द' : 'रद्द',
        checkIn: isEn ? 'Check in → token' : isHi ? 'चेक-इन → टोकन' : 'चेक-इन → टोकन',
        checkedIn: isEn ? 'Checked in' : isHi ? 'चेक-इन हो गया' : 'चेक-इन झाले',
        pickPatient: isEn ? 'Select a patient first' : isHi ? 'पहले मरीज चुनें' : 'प्रथम रुग्ण निवडा',
        pastDate: isEn ? 'Choose today or a future date' : isHi ? 'आज या भविष्य की तारीख चुनें' : 'आजची किंवा पुढील तारीख निवडा',
        slotFull: isEn ? 'That slot is full — pick another' : isHi ? 'यह स्लॉट भरा है — दूसरा चुनें' : 'हा स्लॉट भरला — दुसरा निवडा',
        viewQueue: isEn ? 'Open OPD Queue →' : isHi ? 'ओपीडी कतार खोलें →' : 'ओपीडी रांग उघडा →',
    };

    const handleBook = (e: React.FormEvent) => {
        e.preventDefault();
        const patient = patientById(patientId);
        if (!patient) { toast.error(t.pickPatient); return; }
        if (date < todayISO()) { toast.error(t.pastDate); return; }
        if (remainingForChosen <= 0) { toast.error(t.slotFull); return; }

        const appt: Appointment = {
            id: uuidv4(),
            patientId: patient.id,
            patientName: patient.name,
            facilityId: facility.id,
            facilityName: facility.name,
            department,
            requestedDate: date,
            slot,
            status: 'REQUESTED',
            createdVia,
            notes: notes.trim() || undefined,
            createdAt: new Date().toISOString(),
        };
        addAppointment(appt);
        setNotes('');
    };

    const statusBadge = (s: Appointment['status']) =>
        s === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800'
        : s === 'REQUESTED' ? 'bg-amber-100 text-amber-800'
        : s === 'CONVERTED_TO_TOKEN' ? 'bg-indigo-100 text-indigo-800'
        : 'bg-slate-100 text-slate-600';

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{t.deptTag}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">{t.title}</h1>
                            <p className="text-xs text-txt-secondary mt-0.5">{t.subtitle}</p>
                        </div>
                        <Link href="/queue" className="text-xs font-bold text-[#1F3A6E] underline">{t.viewQueue}</Link>
                    </div>

                    <div className="grid lg:grid-cols-12 gap-6">
                        {/* Booking form */}
                        <motion.form
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleBook}
                            className="lg:col-span-5 surface-card p-5 space-y-3 text-sm self-start"
                        >
                            <h2 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider">{t.book}</h2>

                            <label className="block">
                                <span className="text-[11px] font-bold text-txt-muted uppercase">{t.facility}</span>
                                <select value={facilityId} onChange={e => setFacilityId(e.target.value)}
                                    className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl">
                                    {MAHARASHTRA_FACILITIES.map(f => <option key={f.id} value={f.id}>{f.type} — {f.name}</option>)}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[11px] font-bold text-txt-muted uppercase">{t.patient}</span>
                                <select value={patientId} onChange={e => setPatientId(e.target.value)} required
                                    className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl">
                                    <option value="">{t.choosePatient}</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.age}/{p.gender}) · {p.village}</option>)}
                                </select>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-txt-muted uppercase">{t.department}</span>
                                    <select value={department} onChange={e => setDepartment(e.target.value)}
                                        className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl">
                                        {APPOINTMENT_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[11px] font-bold text-txt-muted uppercase">{t.date}</span>
                                    <input type="date" value={date} min={todayISO()} onChange={e => setDate(e.target.value)}
                                        className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl" />
                                </label>
                            </div>

                            <label className="block">
                                <span className="text-[11px] font-bold text-txt-muted uppercase">{t.slot}</span>
                                <select value={slot} onChange={e => setSlot(e.target.value)}
                                    className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl">
                                    {APPOINTMENT_SLOTS.map(s => {
                                        const left = slotCapacity - activeAt(date, s);
                                        return <option key={s} value={s} disabled={left <= 0}>
                                            {s} — {left > 0 ? `${left} ${t.left}` : t.full}
                                        </option>;
                                    })}
                                </select>
                                <span className={`text-[11px] font-bold mt-1 block ${remainingForChosen > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {remainingForChosen > 0 ? `${remainingForChosen} / ${slotCapacity} ${t.left}` : t.full}
                                </span>
                            </label>

                            <label className="block">
                                <span className="text-[11px] font-bold text-txt-muted uppercase">{t.bookedBy}</span>
                                <select value={createdVia} onChange={e => setCreatedVia(e.target.value as AppointmentSource)}
                                    className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl">
                                    <option value="ASHA_BOOKED">{t.asha}</option>
                                    <option value="SELF_REQUESTED">{t.self}</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[11px] font-bold text-txt-muted uppercase">{t.notes}</span>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                                    className="w-full mt-1 p-2 bg-gray-50 border border-border-subtle rounded-xl" />
                            </label>

                            <button type="submit" disabled={remainingForChosen <= 0}
                                className="w-full py-2.5 bg-emerald-deep text-white font-bold rounded-xl shadow disabled:opacity-50 disabled:cursor-not-allowed">
                                {t.book}
                            </button>
                        </motion.form>

                        {/* Upcoming list */}
                        <div className="lg:col-span-7 surface-card p-5">
                            <h2 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wider mb-3">{t.upcomingTitle}</h2>
                            {upcoming.length === 0 ? (
                                <p className="text-sm text-txt-secondary py-6 text-center">{t.none}</p>
                            ) : (
                                <div className="space-y-2">
                                    {upcoming.map(a => {
                                        const canCheckIn = a.status === 'CONFIRMED' && a.requestedDate <= todayISO();
                                        const p = patientById(a.patientId);
                                        return (
                                            <div key={a.id} className="border border-border-subtle rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-[#1F3A6E] truncate">{a.patientName}</p>
                                                    <p className="text-[11px] text-txt-secondary">
                                                        {a.department} · {a.requestedDate} · {a.slot}
                                                        <span className="text-txt-muted"> · {a.createdVia === 'ASHA_BOOKED' ? t.asha : t.self}</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(a.status)}`}>
                                                        {a.status === 'CONVERTED_TO_TOKEN' ? t.checkedIn : a.status}
                                                    </span>
                                                    {a.status === 'REQUESTED' && (
                                                        <button onClick={() => changeStatus(a.id, 'CONFIRMED')}
                                                            className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded">{t.confirm}</button>
                                                    )}
                                                    {canCheckIn && (
                                                        <button onClick={() => convertToToken(a, { age: p?.age, gender: p?.gender })}
                                                            className="px-2 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded">{t.checkIn}</button>
                                                    )}
                                                    {(a.status === 'REQUESTED' || a.status === 'CONFIRMED') && (
                                                        <button onClick={() => changeStatus(a.id, 'CANCELLED')}
                                                            className="px-2 py-1 bg-gray-100 text-txt-secondary text-[11px] font-bold rounded">{t.cancel}</button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
