/**
 * GovPortalFooter — Official GIGW 3.0 & NIC-Compliant Government Footer
 * Standard Indian Government & Maharashtra Public Health Department Attribution
 * Full Trilingual Localization: English, Marathi, Hindi
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StateEmblem from '@/components/gov/StateEmblem';
import { useLanguageStore } from '@/stores/languageStore';

export default function GovPortalFooter() {
    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    /**
     * Resolved after mount, not during render: this is a static export, so anything
     * derived from the clock at render time is baked into the prerendered HTML at build
     * time and then disagrees with the client on hydration. Empty until mounted.
     */
    const [today, setToday] = useState('');
    useEffect(() => {
        setToday(new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }));
    }, []);

    const currentYear = today ? new Date().getFullYear() : '';

    const F = {
        helplineHeader: isEn
            ? '24×7 National Emergency & Health Helplines:'
            : isHi
            ? '24×7 राष्ट्रीय आपातकालीन एवं स्वास्थ्य हेल्पलाइन:'
            : '24×7 राष्ट्रीय आपत्कालीन व आरोग्य हेल्पलाईन (National Helplines):',
        ambulance: isEn ? 'Ambulance:' : isHi ? 'एम्बुलेंस:' : 'रुग्णवाहिका:',
        maternal: isEn ? 'Janani Shishu:' : isHi ? 'मातृ व शिशु:' : 'जननी शिशु:',
        healthAdvise: isEn ? 'Health Advice:' : isHi ? 'स्वास्थ्य सलाह:' : 'आरोग्य सल्ला:',
        childLine: isEn ? 'Child Helpline:' : isHi ? 'बाल हेल्पलाइन:' : 'बाल हेल्पलाइन:',
        stateGov: isEn ? 'Government of Maharashtra' : isHi ? 'महाराष्ट्र सरकार' : 'महाराष्ट्र शासन',
        address: isEn
            ? 'Department of Public Health, Mantralaya, Mumbai 400 032. National Health Mission (NHM) Maharashtra.'
            : isHi
            ? 'सार्वजनिक स्वास्थ्य विभाग, मंत्रालय, मुंबई ४०० ०३२. राष्ट्रीय स्वास्थ्य मिशन (NHM) महाराष्ट्र।'
            : 'सार्वजनिक आरोग्य विभाग, मंत्रालय, मुंबई ४०० ०३२. राष्ट्रीय आरोग्य अभियान (NHM) महाराष्ट्र.',
        importantPortals: isEn ? 'Important Portals' : isHi ? 'महत्वपूर्ण पोर्टल्स' : 'महत्वाच्या लिंक्स (Important Portals)',
        p1: isEn ? 'Public Health Dept Portal' : isHi ? 'सार्वजनिक स्वास्थ्य विभाग पोर्टल' : 'सार्वजनिक आरोग्य विभाग पोर्टल',
        p2: isEn ? 'Ayushman Bharat Digital Mission (ABDM)' : isHi ? 'आयुष्मान भारत डिजिटल मिशन (ABDM)' : 'आयुष्मान भारत डिजिटल मिशन (ABDM)',
        p3: isEn ? 'National Health Mission (NHM)' : isHi ? 'राष्ट्रीय स्वास्थ्य मिशन (NHM)' : 'राष्ट्रीय आरोग्य अभियान (NHM)',
        p4: isEn ? 'eSanjeevani Telemedicine' : isHi ? 'ई-संजीवनी टेलीमेडिसिन' : 'ई-संजीवनी टेलिमेडिसिन',
        policies: isEn ? 'Website Policies' : isHi ? 'वेबसाइट नीतियां' : 'धोरण व नियम (Website Policies)',
        pol1: isEn ? 'Privacy Policy' : isHi ? 'गोपनीयता नीति' : 'गोपनीयता धोरण (Privacy Policy)',
        pol2: isEn ? 'Terms of Use' : isHi ? 'उपयोग की शर्तें' : 'अटी व शर्ती (Terms of Use)',
        pol3: isEn ? 'Hyperlinking Policy' : isHi ? 'हाइपरलिंकिंग नीति' : 'हायपरलिंकिंग धोरण (Hyperlinking Policy)',
        pol4: isEn ? 'Copyright Policy' : isHi ? 'कॉपीराइट नीति' : 'कॉपीराइट धोरण (Copyright Policy)',
        transparency: isEn ? 'Transparency & RTI' : isHi ? 'पारदर्शिता एवं आरटीआई' : 'पारदर्शकता (Transparency & RTI)',
        trans1: isEn ? 'Accessibility Statement' : isHi ? 'पहुंच विवरण' : 'प्रवेशयोग्यता विधान (Accessibility Statement)',
        trans2: isEn ? 'Right to Information (RTI 2005)' : isHi ? 'सूचना का अधिकार (RTI 2005)' : 'माहितीचा अधिकार (RTI 2005)',
        trans3: isEn ? 'Grievance Redressal' : isHi ? 'शिकायत निवारण' : 'तक्रार निवारण (Grievance Redressal)',
        nodal: isEn ? 'Nodal Officer: Chief Medical Officer, Gadchiroli' : isHi ? 'नोडल अधिकारी: मुख्य चिकित्सा अधिकारी, गढ़चिरौली' : 'नोडल अधिकारी: मुख्य वैद्यकीय अधिकारी, गडचिरोली',
        rights: isEn
            ? `© ${currentYear} NalamMesh • Department of Public Health, Government of Maharashtra. All rights reserved.`
            : isHi
            ? `© ${currentYear} नलममेश • सार्वजनिक स्वास्थ्य विभाग, महाराष्ट्र सरकार। सर्वाधिकार सुरक्षित।`
            : `© ${currentYear} नलममेश • सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन. सर्व हक्क राखीव.`,
        designedBy: isEn
            ? 'Designed, Developed and Hosted by National Informatics Centre (NIC). Compliant with GIGW 3.0 and W3C WCAG 2.1 (AA).'
            : isHi
            ? 'राष्ट्रीय सूचना विज्ञान केंद्र (NIC) द्वारा डिज़ाइन, विकसित व होस्ट किया गया। GIGW 3.0 व W3C WCAG 2.1 (AA) प्रमाणित।'
            : 'Designed, Developed and Hosted by National Informatics Centre (NIC). Compliant with GIGW 3.0 and W3C WCAG 2.1 (AA).',
        lastUpdated: isEn ? `Last Updated: ${today}` : isHi ? `अंतिम अपडेट: ${today}` : `शेवटचा बदल: ${today}`,
        // No visitor counter: this is a static, offline-first build with no analytics
        // backend, so any figure shown here would be invented. Removed rather than faked.
    };

    return (
        <footer className="w-full bg-[#11223F] text-white border-t-4 border-[#FF9933] font-sans text-xs select-none mt-12">
            {/* National Emergency Helplines Tier */}
            <div className="bg-[#0C1A30] border-b border-slate-700 py-3.5 px-4">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                            {F.helplineHeader}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{F.ambulance}</span>
                            <strong className="text-amber-300 font-black">108</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{F.maternal}</span>
                            <strong className="text-emerald-300 font-black">102</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{F.healthAdvise}</span>
                            <strong className="text-blue-300 font-black">104</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Tele-MANAS:</span>
                            <strong className="text-purple-300 font-black">14477</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{F.childLine}</span>
                            <strong className="text-rose-300 font-black">1098</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mandatory GIGW Institutional Links */}
            <div className="max-w-7xl mx-auto px-4 py-6 border-b border-slate-700/80">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-slate-300">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <StateEmblem size={28} light />
                            <span className="font-bold text-white text-sm">{F.stateGov}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {F.address}
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            {F.importantPortals}
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><a href="https://arogya.maharashtra.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">{F.p1}</a></li>
                            <li><a href="https://abdm.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">{F.p2}</a></li>
                            <li><a href="https://nhm.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">{F.p3}</a></li>
                            <li><a href="https://esanjeevani.mohfw.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">{F.p4}</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            {F.policies}
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><Link href="/privacy" className="hover:text-amber-300">{F.pol1}</Link></li>
                            <li><Link href="/terms" className="hover:text-amber-300">{F.pol2}</Link></li>
                            <li><Link href="/hyperlinking" className="hover:text-amber-300">{F.pol3}</Link></li>
                            <li><Link href="/copyright" className="hover:text-amber-300">{F.pol4}</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            {F.transparency}
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><Link href="/accessibility" className="hover:text-amber-300">{F.trans1}</Link></li>
                            <li><Link href="/rti" className="hover:text-amber-300">{F.trans2}</Link></li>
                            <li><Link href="/feedback" className="hover:text-amber-300">{F.trans3}</Link></li>
                            <li><span className="text-slate-400">{F.nodal}</span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Official NIC Attribution Tier */}
            <div className="max-w-7xl mx-auto px-4 py-4 sm:pr-40 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                    <p>
                        {F.rights}
                    </p>
                    <p className="text-[10px] text-slate-500">
                        {F.designedBy}
                    </p>
                </div>

                <div className="flex items-center gap-3 text-center sm:text-right text-[10px]">
                    <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        <span>{F.lastUpdated}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
