/**
 * Place names on devices seeded by the generic build.
 *
 * For a while the seed data carried placeholder geography — "Primary Health
 * Centre — Block A", "Village 1", vehicle "AMB-E-1081" — in place of the
 * Gadchiroli names it was written with. A device seeded then still holds those
 * strings in IndexedDB, so its screens would say "Block A" beside a masthead
 * that says Gadchiroli. This puts the real names back in what that build wrote.
 *
 * Only a value that is still exactly the generic text is replaced: a facility
 * the Super Admin renamed, or anything a worker typed, is never touched. Full
 * rewriting applies to the records the seed created (known by id); for records
 * made on the device, only the generated facility labels are mapped, since
 * those came from the facility list and name no real place.
 *
 * scripts/verify-place-names.mts runs the generic build's own seed through
 * this and checks the result is today's seed, field for field.
 */

import { FACILITY_NETWORK, SEED_PATIENTS, SEED_QUEUE, SEED_MEDICINES, SEED_DIAGNOSTICS } from '@/lib/data/facilities';
import { SEED_REFERRALS, SEED_NOTIFICATIONS } from '@/lib/data/referralSeed';
import { SEED_RESOURCES, SEED_MAINTENANCE } from '@/lib/data/resources';

/** Generated facility labels, as the generic build spelled them. Replaced wherever they occur. */
const FACILITY_LABELS: [string, string][] = [
    ['Sub-Centre / Ayushman Arogya Mandir — Village 1', 'Sub-Centre / Ayushman Arogya Mandir, Pemgiri'],
    ['Sub-Centre — Village 2', 'Sub-Centre, Sawargaon Ghule'],
    ['Community Health Centre — Block A', 'Community Health Centre, Sakur'],
    ['Primary Health Centre — Block A', 'Primary Health Centre, Dhandarphal'],
    ['Primary Health Centre — Block B', 'Primary Health Centre, Jawale Baleshwar'],
];

/** The two hospital names that were bare in the generic build — as whole labels. */
const HOSPITAL_LABELS: Record<string, string> = {
    'District Hospital': 'District Hospital, Ahilyanagar',
    'Sub-District Hospital': 'Sub-District Hospital, Sangamner',
};

/** Inside seeded text: the hospitals, the short forms and the vehicle numbers. */
const SEED_PHRASES: [RegExp, string][] = [
    [/Sub-District Hospital(?!, Sangamner)/g, 'Sub-District Hospital, Sangamner'],
    [/(?<!Sub-)District Hospital(?!, Ahilyanagar)/g, 'District Hospital, Ahilyanagar'],
    [/\bCHC Block A\b/g, 'CHC Sakur'],
    [/\bAMB-([TE])-(0102|1081|1084)\b/g, 'MH-16-$1-$2'],
];

/** Whole seeded values — only ever replaced as the entire field. */
const SEED_VALUES: Record<string, string> = {
    'Village 1': 'Pemgiri',
    'Village 2': 'Sawargaon Ghule',
    'Block A': 'Dhandarphal',
    'Block B': 'Jawale Baleshwar',
    'District': 'Ahilyanagar',
    'PHC Block A': 'PHC Dhandarphal',
    'PHC Block B': 'PHC Jawale Baleshwar',
    'Sub-Centre Village 1': 'Sub-Centre Pemgiri',
    'जिल्हा रुग्णालय, ': 'जिल्हा रुग्णालय, अहिल्यानगर',
    'उपजिल्हा रुग्णालय, उपविभाग': 'उपजिल्हा रुग्णालय, संगमनेर',
    'ग्रामीण रुग्णालय (CHC), ब्लॉक अ': 'ग्रामीण रुग्णालय (CHC), साकूर',
    'प्राथमिक आरोग्य केंद्र, ब्लॉक अ': 'प्राथमिक आरोग्य केंद्र, धांदरफळ',
    'प्राथमिक आरोग्य केंद्र, ब्लॉक ब': 'प्राथमिक आरोग्य केंद्र, जवळे बाळेश्वर',
    'आरोग्य उपकेंद्र, गाव १': 'आरोग्य उपकेंद्र, पेमगिरी',
    'आरोग्य उपकेंद्र, गाव २': 'आरोग्य उपकेंद्र, सावरगाव घुले',
    'Complex Area, Chamorshi Road, 442605': 'Civil Hospital Campus, Ahilyanagar',
    'Allapalli Road, Sub-Division, 442705': 'Nashik–Pune Highway, Sangamner, Ahilyanagar',
    'Main Road, Block A, 442704': 'Main Road, Sakur, Tal. Sangamner, Ahilyanagar',
    'Near Tehsil Office, Block A, 442710': 'Near Gram Panchayat, Dhandarphal, Tal. Sangamner, Ahilyanagar',
    'Block B Village, Sub-Division Tehsil, 442705': 'Jawale Baleshwar, Tal. Sangamner, Ahilyanagar',
    'Village 1 Gram Panchayat, Block A 442710': 'Pemgiri Gram Panchayat, Tal. Sangamner',
    'Village 2 Village, Block A 442710': 'Sawargaon Ghule, Tal. Sangamner',
    'Nikshay ID: NK-PHC-01, DOTS regimen adherence good': 'Nikshay ID: NK-MH-GAD-29402, DOTS regimen adherence good',
};

/** The generic build's one placeholder tehsil; the real one depends on the record. */
const GENERIC_TEHSIL = 'Block';


/**
 * The demonstration moved from Gadchiroli to Sangamner taluka (Ahilyanagar) on
 * 2026-10-22. Devices seeded before then hold the Gadchiroli names; these put
 * the Sangamner ones in their place. Facility ids did not change.
 */
const MOVED_FULL: [string, string][] = [
    ['Complex Area, Chamorshi Road, Gadchiroli 442605', 'Civil Hospital Campus, Ahilyanagar'],
    ['Allapalli Road, Aheri, Gadchiroli 442705', 'Nashik–Pune Highway, Sangamner, Ahilyanagar'],
    ['Main Road, Etapalli, Gadchiroli 442704', 'Main Road, Sakur, Tal. Sangamner, Ahilyanagar'],
    ['Near Tehsil Office, Bhamragad, Gadchiroli 442710', 'Near Gram Panchayat, Dhandarphal, Tal. Sangamner, Ahilyanagar'],
    ['Perimili Village, Aheri Tehsil, Gadchiroli 442705', 'Jawale Baleshwar, Tal. Sangamner, Ahilyanagar'],
    ['Kothi Gram Panchayat, Bhamragad 442710', 'Pemgiri Gram Panchayat, Tal. Sangamner'],
    ['Govindpur Village, Bhamragad 442710', 'Sawargaon Ghule, Tal. Sangamner'],
    ['गडचिरोली', 'अहिल्यानगर'], ['गढ़चिरौली', 'अहिल्यानगर'], ['अहेरी', 'संगमनेर'], ['एटापल्ली', 'साकूर'],
    ['भामरागड', 'धांदरफळ'], ['पेरीमिली', 'जवळे बाळेश्वर'], ['कोठी', 'पेमगिरी'], ['गोविंदपूर', 'सावरगाव घुले'],
];
const MOVED_WORDS: [RegExp, string][] = [
    [/\bGadchiroli\b/g, 'Ahilyanagar'], [/\bBhamragad\b/g, 'Dhandarphal'], [/\bPerimili\b/g, 'Jawale Baleshwar'],
    [/\bEtapalli\b/g, 'Sakur'], [/\bAheri\b/g, 'Sangamner'], [/\bKothi\b/g, 'Pemgiri'], [/\bGovindpur\b/g, 'Sawargaon Ghule'],
    [/\bMH-33\b/g, 'MH-16'],
];
/** Old facility labels, as whole values — safe to map even in records made on a device. */
const MOVED_LABELS: Record<string, string> = Object.fromEntries([
    'District Hospital, Gadchiroli', 'Sub-District Hospital, Aheri', 'Community Health Centre, Etapalli',
    'Primary Health Centre, Bhamragad', 'Primary Health Centre, Perimili', 'Sub-Centre / Ayushman Arogya Mandir, Kothi',
    'Sub-Centre, Govindpur', 'DH Gadchiroli', 'SDH Aheri', 'CHC Etapalli', 'PHC Bhamragad', 'PHC Perimili', 'SC Kothi',
    'SC Govindpur', 'Sub-Centre Kothi', 'Sub-Centre Govindpur',
].map(old => [old, MOVED_WORDS.reduce((v, [re, to]) => v.replace(re, to), old)]));
const MOVED_TEHSILS = new Set(['Bhamragad', 'Aheri', 'Etapalli']);
/** Old map positions → new, matched exactly (the seed's own values). */
const MOVED_COORDS = new Map<number, number>([
    [20.1809, 19.0952], [79.9934, 74.7496], [19.4144, 19.5771], [80.0031, 74.208], [19.6468, 19.333], [80.2884, 74.295],
    [19.4678, 19.56], [80.3789, 74.15], [19.3512, 19.43], [80.1245, 74.18], [19.4981, 19.51], [80.4512, 74.27],
    [19.5211, 19.48], [80.3992, 74.23], [19.38, 19.45], [80.2, 74.2],
]);

function moveSeeded(value: string, key: string): string {
    if (key === 'tehsil' && MOVED_TEHSILS.has(value)) return 'Sangamner';
    let out = value;
    for (const [from, to] of MOVED_FULL) out = out.split(from).join(to);
    for (const [re, to] of MOVED_WORDS) out = out.replace(re, to);
    return out;
}

function moveCoords(value: unknown, key = ''): unknown {
    if (typeof value === 'number' && (key === 'lat' || key === 'lng') && MOVED_COORDS.has(value)) return MOVED_COORDS.get(value);
    if (Array.isArray(value)) {
        const next = value.map(v => moveCoords(v, key));
        return next.some((v, i) => v !== value[i]) ? next : value;
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            const m = moveCoords(v, k);
            if (m !== v) changed = true;
            next[k] = m;
        }
        return changed ? next : value;
    }
    return value;
}

export type PlaceNameStore =
    | 'facilities' | 'patients' | 'queue' | 'medicineStock' | 'diagnostics'
    | 'referrals' | 'notifications' | 'facilityResources' | 'maintenanceLog';

type Keyed = { id?: string; facilityId?: string };

const SEEDS: Record<PlaceNameStore, Keyed[]> = {
    facilities: FACILITY_NETWORK,
    patients: SEED_PATIENTS,
    queue: SEED_QUEUE,
    medicineStock: SEED_MEDICINES,
    diagnostics: SEED_DIAGNOSTICS,
    referrals: SEED_REFERRALS,
    notifications: SEED_NOTIFICATIONS,
    facilityResources: SEED_RESOURCES,
    maintenanceLog: SEED_MAINTENANCE,
};

export const PLACE_NAME_STORES = Object.keys(SEEDS) as PlaceNameStore[];

const keyOf = (store: PlaceNameStore, r: Keyed) => (store === 'facilityResources' ? r.facilityId : r.id);

const seedIds = new Map<PlaceNameStore, Map<string, Keyed>>(
    PLACE_NAME_STORES.map(store => [store, new Map(SEEDS[store].map(r => [keyOf(store, r) as string, r]))]),
);

function relabel(value: string): string {
    let out = value;
    for (const [generic, named] of FACILITY_LABELS) out = out.split(generic).join(named);
    return out;
}

function renameSeeded(value: string): string {
    if (Object.hasOwn(SEED_VALUES, value)) return SEED_VALUES[value];
    let out = relabel(value);
    for (const [pattern, named] of SEED_PHRASES) out = out.replace(pattern, named);
    return out;
}

/** Rewrite every string in a value; returns the same object when nothing changed. */
function mapStrings(value: unknown, key: string, rename: (s: string, key: string) => string): unknown {
    if (typeof value === 'string') return rename(value, key);
    if (Array.isArray(value)) {
        let changed = false;
        const next = value.map(v => {
            const m = mapStrings(v, key, rename);
            if (m !== v) changed = true;
            return m;
        });
        return changed ? next : value;
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            const m = mapStrings(v, k, rename);
            if (m !== v) changed = true;
            next[k] = m;
        }
        return changed ? next : value;
    }
    return value;
}

/**
 * The record with the generic build's place names replaced, or the same record
 * (by reference) when it holds none — callers write back only on a change.
 */
export function restorePlaceNames<T>(store: PlaceNameStore, record: T): T {
    const key = keyOf(store, record as Keyed);
    const seed = key ? seedIds.get(store)?.get(key) : undefined;

    if (!seed) {
        // Made on this device: only its generated facility labels.
        return mapStrings(record, '', (s, k) => {
            if (Object.hasOwn(MOVED_LABELS, s)) return MOVED_LABELS[s];
            return /facilityName$/i.test(k) && Object.hasOwn(HOSPITAL_LABELS, s) ? HOSPITAL_LABELS[s] : relabel(s);
        }) as T;
    }

    const named = mapStrings(record, '', (s, k) => {
        if (k === 'tehsil' && s === GENERIC_TEHSIL) return (seed as { tehsil?: string }).tehsil ?? s;
        return moveSeeded(renameSeeded(s), k);
    });
    return moveCoords(named) as T;
}
