/**
 * Facility ids that have been retired, and the ids that replaced them.
 *
 * Facility ids are keys, not labels: patients, referrals, bed returns and staff
 * postings all point at them. Commit 566bf16 changed the District Hospital's id
 * while taking place names out of the seed data, and a device that stored data
 * before that kept the old id in its facility list — while everything seeded
 * since (beds, staff postings, demo referrals) uses the new one. On such a
 * device the District Hospital showed no beds, no staff and no capacity.
 *
 * lib/db.ts (v6) rewrites stored records once; normalizeReferral() rewrites
 * referrals that arrive from a device that has not upgraded yet. Add an entry
 * here whenever a facility id is changed — never reuse a retired id.
 *
 * @module lib/data/facilityIds
 */

export const RETIRED_FACILITY_IDS: Readonly<Record<string, string>> = {
    'dh-gadchiroli': 'dh-district',
};

/**
 * Replace every retired facility id anywhere in a stored record.
 *
 * Only whole string values that equal a retired id are replaced, so free text
 * is never touched. Returns the same object when nothing changed, so a caller
 * can skip the write.
 */
export function remapRetiredFacilityIds<T>(value: T): T {
    if (typeof value === 'string') return (RETIRED_FACILITY_IDS[value] ?? value) as T;
    if (Array.isArray(value)) {
        let changed = false;
        const next = value.map(item => {
            const mapped = remapRetiredFacilityIds(item);
            if (mapped !== item) changed = true;
            return mapped;
        });
        return (changed ? next : value) as T;
    }
    // Plain records only: a Date or other class instance holds no facility id.
    if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            const mapped = remapRetiredFacilityIds(item);
            if (mapped !== item) changed = true;
            next[key] = mapped;
        }
        return (changed ? next : value) as T;
    }
    return value;
}
