/**
 * Breadcrumb — the trail bar every NIC department portal carries directly under
 * the navigation, above the page heading.
 *
 * Deliberately plain: small text, "»" separators, current page unlinked.
 */

import Link from 'next/link';

export interface Crumb {
    label: string;
    href?: string;
}

export default function Breadcrumb({
    trail,
    updated,
}: {
    trail: Crumb[];
    /** "Last Updated" stamp — government portals print this on every page */
    updated?: string;
}) {
    return (
        <nav
            aria-label="Breadcrumb"
            className="border-b border-[#D5DDE8] bg-[#EDF1F7] px-4 py-[6px]"
        >
            <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <ol className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-[#4A5A73]">
                    {trail.map((c, i) => {
                        const last = i === trail.length - 1;
                        return (
                            <li key={`${c.label}-${i}`} className="flex items-center gap-x-1.5">
                                {c.href && !last ? (
                                    <Link href={c.href} className="text-[#1F3A6E] hover:underline">
                                        {c.label}
                                    </Link>
                                ) : (
                                    <span className={last ? 'font-semibold text-[#243449]' : ''}>
                                        {c.label}
                                    </span>
                                )}
                                {!last && (
                                    <span aria-hidden="true" className="text-[#8494AB]">
                                        &raquo;
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ol>
                {updated && (
                    <span className="text-[11px] text-[#5A6B80]">Last Updated: {updated}</span>
                )}
            </div>
        </nav>
    );
}
