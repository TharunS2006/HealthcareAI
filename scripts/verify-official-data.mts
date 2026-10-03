/**
 * Official data check — `npm run verify:official-data`
 *
 * lib/data/official/rhs.json holds figures copied from data.gov.in. They are
 * shown to a District Health Officer as official, so the copy is checked
 * against the arithmetic the published datasets must satisfy:
 *
 *   1. PROVENANCE  both datasets name their title, publisher, resource id and
 *                  the date they were retrieved
 *   2. TOTALS      the states sum exactly to the published all-India Total
 *                  (RHS 2021-22), for every column
 *   3. CONSISTENCY rural + urban = total for every state (RHS 2020-21); every
 *                  count a non-negative whole number; the two files name the
 *                  same states once spelling is reconciled
 *   4. DERIVED     each ratio equals its two published counts, and a state
 *                  missing from a file shows "—", not a zero
 */

const { RHS_BY_STATE, RHS_SOURCES, ALL_INDIA, rhsFor } = await import('../lib/data/official/rhs');
const raw = (await import('../lib/data/official/rhs.json', { with: { type: 'json' } })).default;

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

console.log('\n1. PROVENANCE');
for (const [name, s] of Object.entries({ '2021-22': RHS_SOURCES.infrastructure2022, '2020-21': RHS_SOURCES.phcChc2021 })) {
    check(`RHS ${name} names its title, publisher, resource id and page`,
        Boolean(s.title && s.publisher && /^[0-9a-f-]{36}$/.test(s.resourceId) && s.page.startsWith('https://www.data.gov.in/')), JSON.stringify(s));
}
check('the retrieval date is recorded', !Number.isNaN(Date.parse(RHS_SOURCES.retrievedAt)));

console.log('\n2. TOTALS (RHS 2021-22)');
const rows22 = raw.infrastructure2022.rows;
const total = rows22.find(r => r.state === 'Total');
check('the published Total row is present', Boolean(total));
for (const col of ['subHealthCentres', 'phcs', 'districtHospitals'] as const) {
    const sum = rows22.filter(r => r.state !== 'Total').reduce((n, r) => n + r[col], 0);
    check(`${col}: the states sum to the published Total (${total?.[col]})`, sum === total?.[col], `sum ${sum}`);
}

console.log('\n3. CONSISTENCY');
const whole = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
check('every 2021-22 count is a non-negative whole number', rows22.every(r => whole(r.subHealthCentres) && whole(r.phcs) && whole(r.districtHospitals)));
const rows21 = raw.phcChc2021.rows;
check('every 2020-21 count is a non-negative whole number', rows21.every(r => [r.phcsRural, r.phcsUrban, r.phcsTotal, r.chcsRural, r.chcsUrban, r.chcsTotal].every(whole)));
const bad = rows21.filter(r => r.phcsRural + r.phcsUrban !== r.phcsTotal || r.chcsRural + r.chcsUrban !== r.chcsTotal).map(r => r.state);
check('rural + urban = total for PHCs and CHCs in every state', bad.length === 0, bad.join(', '));
const states = RHS_BY_STATE.filter(r => r.state !== ALL_INDIA);
const onlyOne = states.filter(r => (r.subHealthCentres == null) !== (r.chcsTotal == null)).map(r => r.state);
check('once spelling is reconciled, both files name the same states', onlyOne.length === 0, onlyOne.join(', '));
check('36 states and UTs, plus all-India', states.length === 36 && RHS_BY_STATE[0].state === ALL_INDIA, String(states.length));

console.log('\n4. DERIVED');
const mh = rhsFor('Maharashtra')!;
check('Maharashtra is shown as published (10,673 SHCs, 2,539 PHCs, 23 DHs; 401 CHCs)',
    mh.subHealthCentres === 10673 && mh.phcs === 2539 && mh.districtHospitals === 23 && mh.chcsTotal === 401);
const wrongRatio = RHS_BY_STATE.filter(r =>
    (r.shcPerPhc !== null && Math.abs(r.shcPerPhc - (r.subHealthCentres! / r.phcs!)) > 0.05) ||
    (r.ruralPhcPerRuralChc !== null && Math.abs(r.ruralPhcPerRuralChc - (r.phcsRural! / r.chcsRural!)) > 0.05)).map(r => r.state);
check('every ratio equals its two published counts', wrongRatio.length === 0, wrongRatio.join(', '));
const zeroChc = RHS_BY_STATE.filter(r => r.chcsRural === 0);
check('a state with no rural CHC gets no ratio, not infinity', zeroChc.every(r => r.ruralPhcPerRuralChc === null), zeroChc.map(r => `${r.state}:${r.ruralPhcPerRuralChc}`).join(', '));
const india = rhsFor(ALL_INDIA)!;
check('all-India CHCs are the sum of the states (2020-21 publishes no Total)', india.chcsTotal === rows21.reduce((n, r) => n + r.chcsTotal, 0));

console.log(failures === 0 ? '\nAll official-data checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
