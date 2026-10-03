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
    ['Sub-Centre / Ayushman Arogya Mandir — Village 1', 'Sub-Centre / Ayushman Arogya Mandir, Kothi'],
    ['Sub-Centre — Village 2', 'Sub-Centre, Govindpur'],
    ['Community Health Centre — Block A', 'Community Health Centre, Etapalli'],
    ['Primary Health Centre — Block A', 'Primary Health Centre, Bhamragad'],
    ['Primary Health Centre — Block B', 'Primary Health Centre, Perimili'],
];

/** The two hospital names that were bare in the generic build — as whole labels. */
const HOSPITAL_LABELS: Record<string, string> = {
    'District Hospital': 'District Hospital, Gadchiroli',
    'Sub-District Hospital': 'Sub-District Hospital, Aheri',
};

/** Inside seeded text: the hospitals, the short forms and the vehicle numbers. */
const SEED_PHRASES: [RegExp, string][] = [
    [/Sub-District Hospital(?!, Aheri)/g, 'Sub-District Hospital, Aheri'],
    [/(?<!Sub-)District Hospital(?!, Gadchiroli)/g, 'District Hospital, Gadchiroli'],
    [/\bCHC Block A\b/g, 'CHC Etapalli'],
    [/\bAMB-([TE])-(0102|1081|1084)\b/g, 'MH-33-$1-$2'],
];

/** Whole seeded values — only ever replaced as the entire field. */
const SEED_VALUES: Record<string, string> = {
    'Village 1': 'Kothi',
    'Village 2': 'Govindpur',
    'Block A': 'Bhamragad',
    'Block B': 'Perimili',
    'District': 'Gadchiroli',
    'PHC Block A': 'PHC Bhamragad',
    'PHC Block B': 'PHC Perimili',
    'Sub-Centre Village 1': 'Sub-Centre Kothi',
    'जिल्हा रुग्णालय, ': 'जिल्हा रुग्णालय, गडचिरोली',
    'उपजिल्हा रुग्णालय, उपविभाग': 'उपजिल्हा रुग्णालय, अहेरी',
    'ग्रामीण रुग्णालय (CHC), ब्लॉक अ': 'ग्रामीण रुग्णालय (CHC), एटापल्ली',
    'प्राथमिक आरोग्य केंद्र, ब्लॉक अ': 'प्राथमिक आरोग्य केंद्र, भामरागड',
    'प्राथमिक आरोग्य केंद्र, ब्लॉक ब': 'प्राथमिक आरोग्य केंद्र, पेरीमिली',
    'आरोग्य उपकेंद्र, गाव १': 'आरोग्य उपकेंद्र, कोठी',
    'आरोग्य उपकेंद्र, गाव २': 'आरोग्य उपकेंद्र, गोविंदपूर',
    'Complex Area, Chamorshi Road, 442605': 'Complex Area, Chamorshi Road, Gadchiroli 442605',
    'Allapalli Road, Sub-Division, 442705': 'Allapalli Road, Aheri, Gadchiroli 442705',
    'Main Road, Block A, 442704': 'Main Road, Etapalli, Gadchiroli 442704',
    'Near Tehsil Office, Block A, 442710': 'Near Tehsil Office, Bhamragad, Gadchiroli 442710',
    'Block B Village, Sub-Division Tehsil, 442705': 'Perimili Village, Aheri Tehsil, Gadchiroli 442705',
    'Village 1 Gram Panchayat, Block A 442710': 'Kothi Gram Panchayat, Bhamragad 442710',
    'Village 2 Village, Block A 442710': 'Govindpur Village, Bhamragad 442710',
    'Nikshay ID: NK-PHC-01, DOTS regimen adherence good': 'Nikshay ID: NK-MH-GAD-29402, DOTS regimen adherence good',
};

/** The generic build's one placeholder tehsil; the real one depends on the record. */
const GENERIC_TEHSIL = 'Block';

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
        return mapStrings(record, '', (s, k) =>
            /facilityName$/i.test(k) && Object.hasOwn(HOSPITAL_LABELS, s) ? HOSPITAL_LABELS[s] : relabel(s)) as T;
    }

    return mapStrings(record, '', (s, k) => {
        if (k === 'tehsil' && s === GENERIC_TEHSIL) return (seed as { tehsil?: string }).tehsil ?? s;
        return renameSeeded(s);
    }) as T;
}
