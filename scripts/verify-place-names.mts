/**
 * Place-name restoration check — `npm run verify:place-names`
 *
 * A device seeded by the generic build holds "Primary Health Centre — Block A"
 * where this build says "Primary Health Centre, Bhamragad". lib/data/placeNames
 * puts the real names back. scripts/fixtures/generic-build-seed.json is that
 * build's own seed, generated with the clock frozen; this regenerates today's
 * seed at the same instant and checks:
 *
 *   1. RESTORED     every seeded record, run through restorePlaceNames, is
 *                   today's seed record — every field, every store
 *   2. UNCHANGED    today's seed passes through untouched (same object), so
 *                   an up-to-date device writes nothing
 *   3. DEVICE-MADE  a referral made on the device gets its facility labels
 *                   mapped and nothing else; typed text keeps "Block A"
 *   4. EDITED       a facility the Super Admin renamed keeps the new name
 *   5. NO LEFTOVERS no generic place name is left anywhere in the result
 */

import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/generic-build-seed.json', import.meta.url), 'utf8'));
Date.now = () => fixture.generatedAt;

const { restorePlaceNames, PLACE_NAME_STORES } = await import('../lib/data/placeNames');
const F = await import('../lib/data/facilities');
const R = await import('../lib/data/referralSeed');
const S = await import('../lib/data/resources');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const today: Record<string, any[]> = {
    facilities: F.FACILITY_NETWORK, patients: F.SEED_PATIENTS, queue: F.SEED_QUEUE, medicineStock: F.SEED_MEDICINES,
    diagnostics: F.SEED_DIAGNOSTICS, referrals: R.SEED_REFERRALS, notifications: R.SEED_NOTIFICATIONS,
    facilityResources: S.SEED_RESOURCES, maintenanceLog: S.SEED_MAINTENANCE,
};
const keyOf = (store: string, r: any) => (store === 'facilityResources' ? r.facilityId : r.id);
// Fields this build no longer writes, which records already on devices still carry
// and the app ignores. The generic build's seed has them; today's does not.
const RETIRED: Record<string, string[]> = {
    // A fixed "estimated wait" by triage colour that nothing measured (types/facility.ts).
    queue: ['estimatedWaitMinutes'],
};
const withoutRetired = (store: string, r: any) => {
    const retired = RETIRED[store] ?? [];
    return retired.length ? Object.fromEntries(Object.entries(r).filter(([k]) => !retired.includes(k))) : r;
};
// Clock times in notification text follow the machine's time zone; the fixture's
// were written in one zone and this may run in another.
const comparable = (v: unknown) => String(JSON.stringify(v)).replace(/\d{1,2}:\d{2} [ap]m/gi, 'hh:mm');

/** Leaf paths where two values differ, for a readable failure. */
function differences(a: any, b: any, path = ''): string[] {
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null)
        return comparable(a) === comparable(b) ? [] : [`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap(k => differences(a[k], b[k], `${path}.${k}`));
}

console.log('\n1. RESTORED');
check('the fixture covers every store the restoration handles',
    PLACE_NAME_STORES.every(s => Array.isArray(fixture.stores[s]) && fixture.stores[s].length > 0),
    PLACE_NAME_STORES.filter(s => !fixture.stores[s]?.length).join(', '));
for (const store of PLACE_NAME_STORES) {
    const diffs: string[] = [];
    for (const old of fixture.stores[store]) {
        const now = today[store].find(r => keyOf(store, r) === keyOf(store, old));
        if (!now) { diffs.push(`${keyOf(store, old)} is not in today's seed`); continue; }
        diffs.push(...differences(withoutRetired(store, restorePlaceNames(store, old)), now, keyOf(store, old)));
    }
    check(`${store}: ${fixture.stores[store].length} generic records restore to today's seed`, diffs.length === 0, diffs.slice(0, 4).join(' | '));
}

console.log('\n2. UNCHANGED');
for (const store of PLACE_NAME_STORES) {
    const touched = today[store].filter(r => restorePlaceNames(store, r) !== r).map(r => keyOf(store, r));
    check(`${store}: today's seed passes through untouched`, touched.length === 0, touched.join(', '));
}

console.log('\n3. DEVICE-MADE');
const mine = {
    id: 'ref-device-1', fromFacilityId: 'sc-govindpur', fromFacilityName: 'Sub-Centre — Village 2',
    toFacilityId: 'dh-district', toFacilityName: 'District Hospital',
    reason: 'Snake bite near Block A market; family says the District Hospital is too far',
    timeline: [{ note: 'EMERGENCY referral to District Hospital', actor: { facilityName: 'Sub-Centre — Village 2' } }],
};
const mineOut: any = restorePlaceNames('referrals', mine);
check('facility labels are mapped', mineOut.fromFacilityName === 'Sub-Centre, Govindpur' && mineOut.toFacilityName === 'District Hospital, Gadchiroli'
    && mineOut.timeline[0].actor.facilityName === 'Sub-Centre, Govindpur', JSON.stringify(mineOut));
check('what a worker typed is left as written', mineOut.reason === mine.reason && mineOut.timeline[0].note === mine.timeline[0].note, mineOut.reason);
check('the stored original is not mutated', mine.fromFacilityName === 'Sub-Centre — Village 2');
const patientOut: any = restorePlaceNames('patients', { id: 'p-device-9', village: 'Block A', tehsil: 'Block', district: 'District' });
check('a patient registered on the device keeps what was entered', patientOut.village === 'Block A' && patientOut.tehsil === 'Block', JSON.stringify(patientOut));

console.log('\n4. EDITED');
const generic = fixture.stores.facilities.find((f: any) => f.id === 'phc-bhamragad');
const edited: any = restorePlaceNames('facilities', { ...generic, name: 'PHC Bhamragad (upgraded 24x7)' });
check('a renamed facility keeps its new name', edited.name === 'PHC Bhamragad (upgraded 24x7)', edited.name);
check('…and its other generic fields are still restored', edited.tehsil === 'Bhamragad' && edited.district === 'Gadchiroli', `${edited.tehsil}, ${edited.district}`);

console.log('\n5. NO LEFTOVERS');
const GENERIC = /Block [AB]\b|Village [12]\b|ब्लॉक [अब]|गाव [१२]|Sub-Division|उपविभाग|AMB-[TEG]-|NK-PHC-01|"tehsil":"Block"|"district":"District"/;
const leftovers = PLACE_NAME_STORES.flatMap(store => fixture.stores[store]
    .map((r: any) => JSON.stringify(restorePlaceNames(store, r)).match(GENERIC)?.[0])
    .filter(Boolean).map((m: string) => `${store}: ${m}`));
check('no generic place name survives restoration', leftovers.length === 0, [...new Set(leftovers)].join(', '));
const inToday = PLACE_NAME_STORES.flatMap(store => today[store].map(r => JSON.stringify(r).match(GENERIC)?.[0]).filter(Boolean));
check("today's seed carries none either", inToday.length === 0, [...new Set(inToday)].join(', '));

console.log(failures === 0 ? '\nAll place-name checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
