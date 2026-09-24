/**
 * Shared navigation definition for the desktop sidebar and mobile tab bar.
 */

import { DICTIONARY } from '@/lib/i18n';
import { isNative } from '@/lib/native';

type DictKey = keyof typeof DICTIONARY['en'];

export interface NavItem {
    path: string;
    labelKey: DictKey;
    shortLabelKey: DictKey;
    icon: JSX.Element;
}

const iconProps = { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' } as const;

export const NAV_ITEMS: NavItem[] = [
    {
        path: '/dashboard', labelKey: 'navCommand', shortLabelKey: 'tabCommand', icon: (
            <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
        ),
    },
    {
        path: '/triage', labelKey: 'navTriage', shortLabelKey: 'tabTriage', icon: (
            <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
    },
    {
        path: '/mesh-demo', labelKey: 'navTopology', shortLabelKey: 'tabMesh', icon: (
            <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        path: '/ambulance', labelKey: 'navAmbulance', shortLabelKey: 'tabAmbulance', icon: (
            <svg {...iconProps}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0l2 2h2a1 1 0 001-1v-5a1 1 0 00-.29-.71l-3-3A1 1 0 0014 9h-1m-6 8h.01M17 16h.01" />
            </svg>
        ),
    },
];

/** Patient detail pages belong to the Command section. */
export function isNavActive(pathname: string | null, path: string): boolean {
    if (!pathname) return false;
    if (pathname === path || pathname.startsWith(`${path}/`)) return true;
    return path === '/dashboard' && pathname.startsWith('/patient');
}

export async function resetAllPatientData(): Promise<boolean> {
    if (!window.confirm('Are you sure you want to delete ALL patient data?')) return false;
    const { usePatientStore } = await import('@/stores/patientStore');
    await usePatientStore.getState().resetData();
    // The store is already cleared; a hard reload inside the native shell would
    // land on the bundled index.html rather than the current route.
    if (!isNative()) window.location.reload();
    return true;
}
