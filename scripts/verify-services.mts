/**
 * Patient-services regression check — `npm run verify:services`
 *
 * The awareness screen shows a patient the NEXT clinic/camp date and what care is free.
 * A wrong date sends someone to a shut clinic; an over-claimed entitlement misleads about
 * cost. Each property below is pinned:
 *
 *   1. NEXT DATE     nextOccurrence must never return a date in the past, must land on the
 *                    requested weekday, and must treat today-is-the-day as today (not +7).
 *                    This is the exact class of bug that made the follow-up screen show a
 *                    stale "due in 2 days" beside a date already gone.
 *   2. NO OVER-CLAIM free-medicine counts come from real stock: in-stock never exceeds total,
 *                    and totals never exceed the facility's essential-medicine records.
 *   3. ENTITLEMENTS  PMJAY admission cover is shown only from CHC upward (where inpatient
 *                    care exists), never at SC/PHC where it would mislead.
 *
 * Uses tsx (already a devDependency); dynamic import because lib/ is CJS here.
 */
const { nextOccurrence, getEntitlements, freeEssentialMedicinesAt, TIER_SERVICE_SCHEDULE } =
    await import('../lib/data/patientServices');
const { SEED_MEDICINES, MAHARASHTRA_FACILITIES } = await import('../lib/data/facilities');

let failures = 0;
function check(label: string, cond: boolean, detail = ''): void {
    if (cond) { console.log(`  PASS  ${label}`); }
    else { failures += 1; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// ---------------------------------------------------------------------------
console.log('\n1. NEXT CLINIC DATE');
// ---------------------------------------------------------------------------
// Exhaustive over every weekday and every possible "today" weekday.
let allValid = true, todayCounts = true, correctWeekday = true;
for (let base = 0; base < 7; base++) {
    // A fixed reference date, then shift so its getDay() == base.
    const ref = new Date(2026, 8, 8); // 8 Sep 2026 (a Tuesday)
    ref.setDate(ref.getDate() + ((base - ref.getDay() + 7) % 7));
    const today = midnight(ref);
    for (let wd = 0; wd < 7; wd++) {
        const next = nextOccurrence(wd, today);
        if (next.getTime() < today.getTime()) allValid = false;
        if (next.getDay() !== wd) correctWeekday = false;
        if (wd === base && next.getTime() !== today.getTime()) todayCounts = false;
    }
}
check('next date is never in the past (all weekday combinations)', allValid);
check('next date always lands on the requested weekday', correctWeekday);
check('today counts as today when today is the clinic day', todayCounts);
check('a Wednesday ANC from a Monday resolves to +2 days', (() => {
    const monday = new Date(2026, 8, 7); // 7 Sep 2026 is a Monday
    const next = nextOccurrence(3, monday); // 3 = Wednesday
    return next.getDate() === 9 && next.getDay() === 3;
})());

// ---------------------------------------------------------------------------
console.log('\n2. FREE-MEDICINE COUNTS — NO OVER-CLAIM');
// ---------------------------------------------------------------------------
for (const f of MAHARASHTRA_FACILITIES) {
    const s = freeEssentialMedicinesAt(f.id, SEED_MEDICINES);
    const essentialHere = SEED_MEDICINES.filter(m => m.facilityId === f.id && m.isEssentialIPHS).length;
    check(`${f.id}: in-stock (${s.inStock}) <= total (${s.total}) <= essential records (${essentialHere})`,
        s.inStock <= s.total && s.total === essentialHere && s.sample.length <= 4);
}

// ---------------------------------------------------------------------------
console.log('\n3. ENTITLEMENTS BY TIER');
// ---------------------------------------------------------------------------
const mentionsPmjay = (tier: 'SC'|'PHC'|'CHC'|'SDH'|'DH') =>
    getEntitlements(tier).lines.some(l => l.en.includes('PMJAY'));
check('SC does not show PMJAY admission cover', !mentionsPmjay('SC'));
check('PHC does not show PMJAY admission cover', !mentionsPmjay('PHC'));
check('CHC shows PMJAY admission cover', mentionsPmjay('CHC'));
check('DH shows PMJAY admission cover', mentionsPmjay('DH'));
check('every tier states free OPD + free essential meds', (['SC','PHC','CHC','SDH','DH'] as const).every(t => {
    const e = getEntitlements(t);
    return e.freeAtPublicFacility && e.lines.length >= 4;
}));
check('every tier has at least one scheduled clinic/camp', (['SC','PHC','CHC','SDH','DH'] as const).every(
    t => TIER_SERVICE_SCHEDULE[t].length >= 1));

// ---------------------------------------------------------------------------
console.log(failures === 0 ? '\nAll patient-service checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
