/**
 * PortalAside — the right-hand rail every NIC department portal carries:
 * Announcements, Quick Links, Emergency Helplines and the nodal contact.
 *
 * Announcements are NOT hand-written notices. They are the next occurrence of each
 * recurring clinic/camp day at this facility's tier, computed forward from today via
 * nextOccurrence(). That keeps the most prominent panel on the page factual — a
 * hard-coded list of dated bulletins would be fabricated content, and this is a
 * medical portal.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TIER_SERVICE_SCHEDULE, nextOccurrence } from '@/lib/data/patientServices';
import { useLanguageStore } from '@/stores/languageStore';
import type { FacilityType } from '@/types/facility';
import { dep } from '@/lib/config/deployment';

const HELPLINES: Array<[string, string]> = [
    ['Emergency Ambulance', '108'],
    ['Mother & Child Transport', '102'],
    ['National Health Helpline', '104'],
    ['Childline', '1098'],
    ['Tele-MANAS Mental Health', '14477'],
];

export default function PortalAside({ tier = 'PHC' }: { tier?: FacilityType }) {
    const { language } = useLanguageStore();
    const lang = (language === 'hi' || language === 'mr' ? language : 'en') as 'en' | 'hi' | 'mr';
    const isEn = lang === 'en';

    // Dates are resolved after mount: this is a static export, and computing "today"
    // during render would bake the build date into the HTML and hydrate mismatched.
    const [schedule, setSchedule] = useState<Array<{ key: string; date: string; label: string; time: string }>>([]);

    useEffect(() => {
        const entries = TIER_SERVICE_SCHEDULE[tier] ?? [];
        setSchedule(
            entries
                .map((e) => {
                    const d = nextOccurrence(e.weekday);
                    return {
                        key: e.key,
                        date: d.toLocaleDateString(isEn ? 'en-IN' : 'en-IN', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                        }),
                        label: e.label[lang],
                        time: e.time,
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date))
        );
    }, [tier, lang, isEn]);

    const t = {
        announcements: isEn ? 'Announcements' : lang === 'hi' ? 'घोषणाएं' : 'घोषणा',
        allServices: isEn ? 'All services' : lang === 'hi' ? 'सभी सेवाएं' : 'सर्व सेवा',
        quickLinks: isEn ? 'Quick Links' : lang === 'hi' ? 'त्वरित लिंक' : 'जलद दुवे',
        helplines: isEn ? 'Emergency Helplines (24x7)' : lang === 'hi' ? 'आपातकालीन हेल्पलाइन (24x7)' : 'तातडीची हेल्पलाइन (24x7)',
        nodal: isEn ? 'Nodal Officer' : lang === 'hi' ? 'नोडल अधिकारी' : 'नोडल अधिकारी',
        upcoming: isEn ? 'Next scheduled service days at this facility tier'
            : lang === 'hi' ? 'इस स्तर पर आगामी सेवा दिवस' : 'या स्तरावरील पुढील सेवा दिवस',
    };

    const quickLinks: Array<[string, string]> = [
        [isEn ? 'Services & Entitlements' : lang === 'hi' ? 'सेवाएं व पात्रता' : 'सेवा व पात्रता', '/services-info'],
        [isEn ? 'Find a Health Centre' : lang === 'hi' ? 'स्वास्थ्य केंद्र खोजें' : 'आरोग्य केंद्र शोधा', '/facilities'],
        [isEn ? 'Book an Appointment' : lang === 'hi' ? 'अपॉइंटमेंट बुक करें' : 'भेट नोंदवा', '/appointments'],
        [isEn ? 'Grievance Redressal' : lang === 'hi' ? 'शिकायत निवारण' : 'तक्रार निवारण', '/feedback'],
        [isEn ? 'Right to Information (RTI)' : lang === 'hi' ? 'सूचना का अधिकार (RTI)' : 'माहितीचा अधिकार (RTI)', '/rti'],
    ];

    return (
        <aside className="space-y-3">
            {/* Announcements — computed service days, never hand-written bulletins */}
            <div className="border border-[#B9C5D6] bg-white">
                <div className="bg-[#E7ECF3] border-b border-[#B9C5D6] px-2.5 py-1 flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1F3A6E]">{t.announcements}</span>
                    <Link href="/services-info" className="text-[10px] text-[#1F3A6E] hover:underline">
                        {t.allServices}
                    </Link>
                </div>
                <div className="px-2.5 py-2">
                    <p className="text-[10px] text-[#5A6B80] mb-1.5">{t.upcoming}</p>
                    <ul className="divide-y divide-[#E2E8F1]">
                        {schedule.map((s) => (
                            <li key={s.key} className="py-1.5 first:pt-0">
                                <span className="block text-[10px] font-bold text-[#1F3A6E]">{s.date}</span>
                                <p className="text-[11px] text-[#243449] leading-snug">{s.label}</p>
                                <span className="text-[10px] text-[#5A6B80]">{s.time}</span>
                            </li>
                        ))}
                        {schedule.length === 0 && (
                            <li className="py-1.5 text-[11px] text-[#5A6B80]">
                                {isEn ? 'No recurring service days recorded for this tier.' : ''}
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Quick Links */}
            <div className="border border-[#B9C5D6] bg-white">
                <div className="bg-[#E7ECF3] border-b border-[#B9C5D6] px-2.5 py-1">
                    <span className="text-[12px] font-bold text-[#1F3A6E]">{t.quickLinks}</span>
                </div>
                <ul className="px-2.5 py-2 space-y-1">
                    {quickLinks.map(([label, href]) => (
                        <li key={href} className="flex gap-1.5 text-[11.5px] leading-snug">
                            <span aria-hidden="true" className="text-[#8494AB]">&raquo;</span>
                            <Link href={href} className="text-[#1F3A6E] hover:underline">{label}</Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Emergency helplines — national numbers, verifiable */}
            <div className="border border-[#C9A227] bg-[#FFFDF5]">
                <div className="bg-[#FBF0CE] border-b border-[#C9A227] px-2.5 py-1">
                    <span className="text-[12px] font-bold text-[#7A5B0B]">{t.helplines}</span>
                </div>
                <table className="w-full px-2.5 py-1">
                    <tbody>
                        {HELPLINES.map(([label, num]) => (
                            <tr key={num} className="border-b border-[#EFE3BE] last:border-0">
                                <td className="px-2.5 py-1 text-[11px] text-[#3A4859]">{label}</td>
                                <td className="px-2.5 py-1 text-[12px] font-bold text-[#C0392B] text-right tabular-nums">
                                    <a href={`tel:${num}`} className="hover:underline">{num}</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Nodal contact — the same officer named in the statutory pages */}
            <div className="border border-[#B9C5D6] bg-white px-2.5 py-2">
                <span className="block text-[11.5px] font-bold text-[#1F3A6E] mb-0.5">{t.nodal}</span>
                <p className="text-[11px] text-[#4A5A73] leading-snug">
                    {dep('nodalOfficer', lang)}
                </p>
                <Link href="/feedback" className="text-[11px] text-[#1F3A6E] hover:underline">
                    {isEn ? 'Raise a grievance' : lang === 'hi' ? 'शिकायत दर्ज करें' : 'तक्रार नोंदवा'} &raquo;
                </Link>
            </div>
        </aside>
    );
}
