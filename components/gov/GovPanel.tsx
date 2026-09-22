/**
 * GovPanel — the standard content unit of an Indian government portal.
 *
 * NIC-built department sites (mohfw.gov.in, nhm.gov.in, arogya.<state>.gov.in)
 * do not use floating cards. Content sits in a square, 1px-bordered box under a
 * solid heading bar. Separation comes from the rule, never from elevation.
 *
 * Replaces the rounded/shadowed card pattern used across the app.
 */

import type { ReactNode } from 'react';

interface GovPanelProps {
    /** Heading bar text — rendered bold, in the heading bar */
    title: string;
    /** Optional right-aligned text in the heading bar (counts, "as on" dates) */
    meta?: string;
    /** Tone of the heading bar. 'primary' is the departmental navy. */
    tone?: 'primary' | 'plain';
    /** Remove body padding when the panel holds a full-bleed table */
    flush?: boolean;
    className?: string;
    children: ReactNode;
}

export default function GovPanel({
    title,
    meta,
    tone = 'primary',
    flush = false,
    className = '',
    children,
}: GovPanelProps) {
    const bar =
        tone === 'primary'
            ? 'bg-[#1F3A6E] text-white border-[#1F3A6E]'
            : 'bg-[#EDF1F7] text-[#1F3A6E] border-[#B9C5D6]';

    return (
        <section className={`border border-[#B9C5D6] bg-white ${className}`}>
            <div
                className={`${bar} border-b px-3 py-[7px] flex items-baseline justify-between gap-3`}
            >
                <h2 className="text-[13px] font-bold tracking-[0.01em] leading-tight">{title}</h2>
                {meta && (
                    <span
                        className={`text-[11px] shrink-0 ${
                            tone === 'primary' ? 'text-white/85' : 'text-[#4A5A73]'
                        }`}
                    >
                        {meta}
                    </span>
                )}
            </div>
            <div className={flush ? '' : 'px-3 py-3'}>{children}</div>
        </section>
    );
}
