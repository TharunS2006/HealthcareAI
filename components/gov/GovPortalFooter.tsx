/**
 * GovPortalFooter — Official GIGW 3.0 & NIC-Compliant Government Footer
 * Standard Indian Government & Maharashtra Public Health Department Attribution
 */

'use client';

import Link from 'next/link';
import StateEmblem from '@/components/gov/StateEmblem';

export default function GovPortalFooter() {
    return (
        <footer className="w-full bg-[#11223F] text-white border-t-4 border-[#FF9933] font-sans text-xs select-none mt-12">
            {/* National Emergency Helplines Tier */}
            <div className="bg-[#0C1A30] border-b border-slate-700 py-3.5 px-4">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                            24×7 राष्ट्रीय आपत्कालीन व आरोग्य हेल्पलाईन (National Helplines):
                        </span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">रुग्णवाहिका:</span>
                            <strong className="text-amber-300 font-black">108</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">जननी शिशु:</span>
                            <strong className="text-emerald-300 font-black">102</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">आरोग्य सल्ला:</span>
                            <strong className="text-blue-300 font-black">104</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Tele-MANAS:</span>
                            <strong className="text-purple-300 font-black">14477</strong>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">बाल हेल्पलाइन:</span>
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
                            <span className="font-bold text-white text-sm">महाराष्ट्र शासन</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            सार्वजनिक आरोग्य विभाग, मंत्रालय, मुंबई ४०० ०३२.<br />
                            राष्ट्रीय आरोग्य अभियान (NHM) महाराष्ट्र.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            महत्वाच्या लिंक्स (Important Portals)
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><a href="https://arogya.maharashtra.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">सार्वजनिक आरोग्य विभाग पोर्टल</a></li>
                            <li><a href="https://abdm.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">आयुष्मान भारत डिजिटल मिशन (ABDM)</a></li>
                            <li><a href="https://nhm.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">राष्ट्रीय आरोग्य अभियान (NHM)</a></li>
                            <li><a href="https://esanjeevani.mohfw.gov.in" target="_blank" rel="noreferrer" className="hover:text-amber-300">ई-संजीवनी टेलिमेडिसिन</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            धोरण व नियम (Website Policies)
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><Link href="/privacy" className="hover:text-amber-300">गोपनीयता धोरण (Privacy Policy)</Link></li>
                            <li><Link href="/terms" className="hover:text-amber-300">अटी व शर्ती (Terms of Use)</Link></li>
                            <li><Link href="/hyperlinking" className="hover:text-amber-300">हायपरलिंकिंग धोरण (Hyperlinking Policy)</Link></li>
                            <li><Link href="/copyright" className="hover:text-amber-300">कॉपीराइट धोरण (Copyright Policy)</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">
                            पारदर्शकता (Transparency & RTI)
                        </h4>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                            <li><Link href="/accessibility" className="hover:text-amber-300">प्रवेशयोग्यता विधान (Accessibility Statement)</Link></li>
                            <li><Link href="/rti" className="hover:text-amber-300">माहितीचा अधिकार (RTI 2005)</Link></li>
                            <li><Link href="/feedback" className="hover:text-amber-300">तक्रार निवारण (Grievance Redressal)</Link></li>
                            <li><span className="text-slate-400">नोडल अधिकारी: मुख्य वैद्यकीय अधिकारी, गडचिरोली</span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Official NIC Attribution Tier */}
            <div className="max-w-7xl mx-auto px-4 py-4 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                    <p>
                        © २०२६ <strong>नलममेश (NalamMesh)</strong> • सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन. सर्व हक्क राखीव.
                    </p>
                    <p className="text-[10px] text-slate-500">
                        Designed, Developed and Hosted by <strong>National Informatics Centre (NIC)</strong>.
                        Compliant with <strong>GIGW 3.0</strong> and <strong>W3C WCAG 2.1 (AA)</strong>.
                    </p>
                </div>

                <div className="flex items-center gap-3 text-center sm:text-right text-[10px]">
                    <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        <span>शेवटचा बदल: <strong>०३-सप्टेंबर-२०२६</strong></span>
                    </div>
                    <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        <span>एकूण भेट संख्या: <strong>१,८४,३९२</strong></span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
