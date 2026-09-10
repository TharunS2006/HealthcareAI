/**
 * Shared renderer for the statutory policy pages linked from the portal footer
 * (privacy, terms, hyperlinking, copyright, accessibility, RTI, grievance redressal).
 * One component so all seven stay visually and structurally consistent.
 */

'use client';

import Link from 'next/link';
import { POLICIES } from '@/lib/data/policies';

export default function PolicyPage({ slug }: { slug: string }) {
    const doc = POLICIES[slug];

    // Defensive: a mistyped slug renders a real message rather than crashing on undefined.
    if (!doc) {
        return (
            <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
                <h1 className="text-2xl font-bold text-[#1F3A6E]">Policy not found</h1>
                <p className="text-sm text-txt-secondary mt-2">
                    The policy page you requested does not exist.{' '}
                    <Link href="/" className="text-[#1F3A6E] underline font-semibold">Return to home</Link>.
                </p>
            </main>
        );
    }

    return (
        <main id="main-content" className="max-w-3xl mx-auto px-4 py-10 md:py-14">
            <nav aria-label="Breadcrumb" className="text-[11px] text-txt-muted mb-4">
                <Link href="/" className="hover:underline">Home</Link>
                <span aria-hidden="true"> / </span>
                <span className="text-txt-secondary font-semibold">{doc.title}</span>
            </nav>

            <div className="border-b-2 border-[#1F3A6E] pb-4 mb-6">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Government of Maharashtra • Department of Public Health
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F3A6E] tracking-tight">
                    {doc.title}
                </h1>
            </div>

            <p className="text-sm text-txt-secondary leading-relaxed mb-8">{doc.intro}</p>

            <div className="space-y-7">
                {doc.sections.map((section) => (
                    <section key={section.heading}>
                        <h2 className="text-base font-bold text-[#1F3A6E] mb-2">{section.heading}</h2>
                        {section.body.map((para, i) => (
                            <p key={i} className="text-sm text-txt-primary leading-relaxed mb-2.5">
                                {para}
                            </p>
                        ))}
                    </section>
                ))}
            </div>

            <div className="mt-10 pt-5 border-t border-border-subtle flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <Link href="/" className="text-[#1F3A6E] underline font-semibold">← Back to home</Link>
                <Link href="/services-info" className="text-[#1F3A6E] underline">Services &amp; Entitlements</Link>
                <Link href="/facilities" className="text-[#1F3A6E] underline">Find a health centre</Link>
            </div>
        </main>
    );
}
