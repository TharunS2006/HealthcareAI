/**
 * GovFooter — GIGW-compliant Government footer
 * Includes helplines, RTI, sitemap, accessibility statement, and official copyright.
 */

import Link from 'next/link';

export default function GovFooter() {
    return (
        <footer className="bg-gov-navy-dark text-white mt-auto" role="contentinfo">
            {/* Helpline Bar */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <p className="text-xs font-bold text-gov-saffron mb-3 uppercase tracking-wider">
                        24×7 Government Health Helplines
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <a href="tel:104" className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                            <span className="text-lg" aria-hidden="true">📞</span>
                            <div>
                                <span className="text-sm font-bold text-white block">104</span>
                                <span className="text-xs text-white/60 group-hover:text-white/80">Health Helpline</span>
                            </div>
                        </a>
                        <a href="tel:108" className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                            <span className="text-lg" aria-hidden="true">🚑</span>
                            <div>
                                <span className="text-sm font-bold text-white block">108</span>
                                <span className="text-xs text-white/60 group-hover:text-white/80">Ambulance</span>
                            </div>
                        </a>
                        <a href="tel:112" className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                            <span className="text-lg" aria-hidden="true">🆘</span>
                            <div>
                                <span className="text-sm font-bold text-white block">112</span>
                                <span className="text-xs text-white/60 group-hover:text-white/80">Emergency</span>
                            </div>
                        </a>
                        <a href="tel:14477" className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                            <span className="text-lg" aria-hidden="true">🧠</span>
                            <div>
                                <span className="text-sm font-bold text-white block">14477</span>
                                <span className="text-xs text-white/60 group-hover:text-white/80">Tele-MANAS</span>
                            </div>
                        </a>
                    </div>
                </div>
            </div>

            {/* Links & Legal */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
                    <div className="flex items-center gap-4 flex-wrap justify-center">
                        <Link href="/sitemap" className="hover:text-white/80 transition-colors">Sitemap</Link>
                        <Link href="/accessibility" className="hover:text-white/80 transition-colors">Accessibility Statement</Link>
                        <Link href="/rti" className="hover:text-white/80 transition-colors">RTI</Link>
                        <Link href="/feedback" className="hover:text-white/80 transition-colors">Feedback / Grievance</Link>
                        <Link href="/privacy" className="hover:text-white/80 transition-colors">Privacy Policy</Link>
                    </div>

                    <p className="text-center sm:text-right">
                        © {new Date().getFullYear()} NalamMesh Public Health DPI • Government of Maharashtra • National Health Mission (NHM)
                    </p>
                </div>
            </div>
        </footer>
    );
}
