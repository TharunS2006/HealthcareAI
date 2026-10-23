/**
 * PortalShell — the three-column department-portal layout used across NalamMesh.
 *
 * Breadcrumb bar, then: left rail (facility scope + department navigation),
 * main column, right rail (announcements, quick links, helplines). This is the
 * standard NIC arrangement; keeping it in one component means every page picks up
 * the same chrome instead of each re-inventing a flex wrapper.
 *
 * Collapses to a single column below `lg` — the right rail drops beneath the content
 * rather than competing with it, because ASHA and ANM users are largely on phones.
 */

'use client';

import type { ReactNode } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import PortalAside from '@/components/gov/PortalAside';
import Breadcrumb, { type Crumb } from '@/components/gov/Breadcrumb';
import type { FacilityType } from '@/types/facility';

interface PortalShellProps {
    trail: Crumb[];
    /** "Last Updated" stamp for the breadcrumb bar */
    updated?: string;
    /** Tier drives which recurring clinic days the Announcements panel lists */
    tier?: FacilityType;
    /** Hide the left department navigation (citizen-facing pages) */
    noNav?: boolean;
    /** Hide the right rail (full-width working screens such as triage intake) */
    noAside?: boolean;
    children: ReactNode;
}

export default function PortalShell({
    trail,
    updated,
    tier = 'PHC',
    noNav = false,
    noAside = false,
    children,
}: PortalShellProps) {
    // Explicit tracks, not 12-column fractions: the sidebar is a fixed 16rem and the
    // right rail 20rem, so the main column simply takes what is left. Fractional
    // columns let the fixed-width sidebar overflow its track and collide with content.
    const cols = noNav && noAside
        ? 'lg:grid-cols-[minmax(0,1fr)]'
        : noNav
        ? 'lg:grid-cols-[minmax(0,1fr)_20rem]'
        : noAside
        ? 'lg:grid-cols-[16rem_minmax(0,1fr)]'
        : 'lg:grid-cols-[16rem_minmax(0,1fr)_20rem]';

    return (
        <>
            <Breadcrumb trail={trail} updated={updated} />
            <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3">
                <div className={`grid grid-cols-1 gap-3 items-start ${cols}`}>
                    {!noNav && (
                        <div className="min-w-0">
                            <Sidebar />
                        </div>
                    )}

                    <main id="main-content" className="min-w-0">
                        {children}
                    </main>

                    {!noAside && (
                        <div className="min-w-0">
                            <PortalAside tier={tier} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
