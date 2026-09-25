/**
 * Deployment configuration — the single place this platform is branded.
 *
 * NalamMesh is built to be deployed by any public health authority in India. The
 * clinical logic, the four-tier facility model (SC / PHC / CHC / SDH / DH) and the
 * entitlement rules all follow national IPHS and NHM norms, so nothing below the
 * presentation layer is specific to one state or district.
 *
 * To deploy for a particular authority, edit the values in this file. Nothing else
 * should hard-code a department, state or district name — if you find yourself
 * typing one into a component, add it here instead.
 */

export interface DeploymentConfig {
    /** Owning department, e.g. "Public Health Department" */
    authority: { en: string; hi: string; mr: string };
    /** Level of government, e.g. "Government of Maharashtra" */
    government: { en: string; hi: string; mr: string };
    /** Programme under which the platform runs */
    programme: { en: string; hi: string; mr: string };
    /** Short programme tag shown beside the product name */
    programmeShort: string;
    /**
     * District this instance serves. Leave blank for a generic/national
     * deployment — the UI omits the district line entirely when it is empty.
     */
    district: { en: string; hi: string; mr: string };
    /** Sub-division or block, blank when not applicable */
    subDivision: { en: string; hi: string; mr: string };
    /** Facility code prefix used on station badges, e.g. "MH-GAD-04" */
    stationCode: string;
    /** Nodal officer named on the statutory pages and the portal right rail */
    nodalOfficer: { en: string; hi: string; mr: string };
    /**
     * State whose official Rural Health Statistics the Command Center opens on,
     * spelled as in lib/data/official/rhs.json (e.g. "Maharashtra"). Blank shows
     * the all-India figures; the panel lets the reader pick any state either way.
     */
    statisticsState: string;
}

export const DEPLOYMENT: DeploymentConfig = {
    authority: {
        en: 'Public Health Department',
        hi: 'लोक स्वास्थ्य विभाग',
        mr: 'सार्वजनिक आरोग्य विभाग',
    },
    government: {
        en: 'Government of Maharashtra',
        hi: 'महाराष्ट्र सरकार',
        mr: 'महाराष्ट्र शासन',
    },
    programme: {
        en: 'National Health Mission',
        hi: 'राष्ट्रीय स्वास्थ्य मिशन',
        mr: 'राष्ट्रीय आरोग्य अभियान',
    },
    programmeShort: 'NHM Maharashtra',

    // This build serves Gadchiroli district. Blank these for a generic build.
    district: { en: 'Gadchiroli', hi: 'गढ़चिरौली', mr: 'गडचिरोली' },
    subDivision: { en: 'Aheri', hi: 'अहेरी', mr: 'अहेरी' },
    stationCode: 'MH-GAD-04',
    statisticsState: 'Maharashtra',

    nodalOfficer: {
        en: 'Chief Medical Officer, District Health Office, Gadchiroli',
        hi: 'मुख्य चिकित्सा अधिकारी, जिला स्वास्थ्य कार्यालय, गढ़चिरौली',
        mr: 'मुख्य वैद्यकीय अधिकारी, जिल्हा आरोग्य कार्यालय, गडचिरोली',
    },
};

type Lang = 'en' | 'hi' | 'mr';

/** Resolve a localized config field for the active language. */
export function dep(field: keyof Omit<DeploymentConfig, 'programmeShort' | 'stationCode' | 'statisticsState'>, lang: string): string {
    const l: Lang = lang === 'hi' || lang === 'mr' ? lang : 'en';
    return DEPLOYMENT[field][l];
}

/**
 * "Public Health Department | National Health Mission"
 * The standard department line under the masthead.
 */
export function departmentLine(lang: string): string {
    return `${dep('authority', lang)} | ${dep('programme', lang)}`;
}

/**
 * District qualifier for page headings — returns an empty string on a generic
 * deployment so callers can append it unconditionally without producing
 * a dangling em dash.
 */
export function districtSuffix(lang: string): string {
    const d = dep('district', lang);
    return d ? ` — ${d}` : '';
}

/** True when this build is branded for a specific district. */
export function hasDistrict(): boolean {
    return DEPLOYMENT.district.en.trim().length > 0;
}
