/**
 * Facility metrics regression check — `npm run verify:metrics`
 *
 * These three numbers are shown to a District Health Officer as grounds for moving
 * staff and ambulances, so each one is pinned to a property that must hold:
 *
 *   1. GEOGRAPHY     haversine + terrain factor must reproduce the real Gadchiroli
 *                    distances. A silent unit error here (miles vs km, or a lat/lng
 *                    swap) would still render a plausible-looking dashboard.
 *   2. NO OVER-CLAIM travel savings must never count a patient who was referred onward.
 *                    They made the journey anyway; counting them inflates the headline.
 *   3. CASCADE MATH  danger-sign counts must partition exactly — every detected case is
 *                    either escalated or awaiting escalation, never both and never
 *                    neither, or the "gap" a DHO acts on is wrong.
 *   4. TIER FAIRNESS a Sub-Centre must not be marked down for lacking a surgeon it was
 *                    never mandated to have; each tier scores against its own IPHS norm.
 *
 * Uses tsx (already a devDependency) rather than a test framework, so it adds no deps.
 */
// Dynamic import: lib/ is CJS under this package.json, so named ESM bindings aren't static.
const { SEED_PATIENTS, SEED_REFERRALS, MAHARASHTRA_FACILITIES } = await import('../lib/data/facilities');
const {
    computeTravelSavings,
    computeDangerSignTelemetry,
    scoreAllFacilities,
    scoreFacility,
    roadDistanceKm,
    travelMinutes,
    haversineKm,
} = await import('../lib/analytics/facilityMetrics');

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
    if (condition) {
        console.log(`  PASS  ${label}`);
    } else {
        failures += 1;
        console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

// ---------------------------------------------------------------------------
console.log('\n1. GEOGRAPHY');
// ---------------------------------------------------------------------------
const dh = MAHARASHTRA_FACILITIES.find(f => f.type === 'DH')!;
const phcBhamragad = MAHARASHTRA_FACILITIES.find(f => f.id === 'phc-bhamragad')!;

const straight = haversineKm(phcBhamragad.location, dh.location);
const road = roadDistanceKm(phcBhamragad.location, dh.location);

console.log(`     Bhamragad -> Gadchiroli DH: ${straight.toFixed(1)} km straight, ${road.toFixed(1)} km road, ${travelMinutes(road).toFixed(0)} min`);

// Bhamragad sits roughly 80-110 km by road from Gadchiroli town in the real district.
check('straight-line distance is plausible for the district', straight > 50 && straight < 120, `${straight.toFixed(1)} km`);
check('road distance exceeds straight-line', road > straight);
check('a facility is zero distance from itself', haversineKm(dh.location, dh.location) === 0);
check('travel time is positive and finite', travelMinutes(road) > 0 && Number.isFinite(travelMinutes(road)));

// ---------------------------------------------------------------------------
console.log('\n2. TRAVEL SAVINGS — NO OVER-CLAIM');
// ---------------------------------------------------------------------------
const savings = computeTravelSavings(SEED_PATIENTS, SEED_REFERRALS, MAHARASHTRA_FACILITIES);
console.log(`     ${savings.episodesResolvedLocally} episodes, ${savings.kilometresAvoided.toFixed(0)} km, ${savings.hoursAvoided.toFixed(1)} h avoided`);

const referredIds = new Set(SEED_REFERRALS.map(r => r.patientId));
const eligible = SEED_PATIENTS.filter(p => !referredIds.has(p.id));

check('never counts more episodes than un-referred patients', savings.episodesResolvedLocally <= eligible.length,
    `${savings.episodesResolvedLocally} > ${eligible.length}`);
check('no savings claimed when every patient was referred',
    computeTravelSavings(SEED_PATIENTS.filter(p => referredIds.has(p.id)), SEED_REFERRALS, MAHARASHTRA_FACILITIES)
        .episodesResolvedLocally === 0);
check('savings are non-negative', savings.kilometresAvoided >= 0 && savings.hoursAvoided >= 0);
check('empty input yields zero, not NaN',
    computeTravelSavings([], [], MAHARASHTRA_FACILITIES).averageHoursPerEpisode === 0);
check('average is consistent with totals',
    savings.episodesResolvedLocally === 0 ||
    Math.abs(savings.averageHoursPerEpisode - savings.hoursAvoided / savings.episodesResolvedLocally) < 1e-9);

// ---------------------------------------------------------------------------
console.log('\n3. DANGER-SIGN CASCADE MATH');
// ---------------------------------------------------------------------------
const telemetry = computeDangerSignTelemetry(SEED_PATIENTS, SEED_REFERRALS);
console.log(`     detected ${telemetry.dangerSignsDetected}, escalated ${telemetry.escalated}, reached care ${telemetry.reachedDefinitiveCare}, awaiting ${telemetry.awaitingEscalation}`);

check('detected partitions exactly into escalated + awaiting',
    telemetry.escalated + telemetry.awaitingEscalation === telemetry.dangerSignsDetected,
    `${telemetry.escalated} + ${telemetry.awaitingEscalation} != ${telemetry.dangerSignsDetected}`);
check('cannot reach definitive care without being escalated',
    telemetry.reachedDefinitiveCare <= telemetry.escalated);
check('no negative counts',
    telemetry.awaitingEscalation >= 0 && telemetry.escalated >= 0 && telemetry.reachedDefinitiveCare >= 0);
check('rates stay within 0-100', [telemetry.escalationRate, telemetry.completionRate].every(r => r >= 0 && r <= 100));
check('empty input yields zeroes, not NaN', (() => {
    const e = computeDangerSignTelemetry([], []);
    return e.escalationRate === 0 && e.completionRate === 0 && e.dangerSignsDetected === 0;
})());

// ---------------------------------------------------------------------------
console.log('\n4. SCORECARD TIER FAIRNESS');
// ---------------------------------------------------------------------------
const scorecards = scoreAllFacilities(MAHARASHTRA_FACILITIES);
for (const s of scorecards) {
    console.log(`     ${s.grade} ${String(s.score).padStart(3)}  ${s.type.padEnd(4)} ${s.facilityName}`);
}

check('every facility is scored', scorecards.length === MAHARASHTRA_FACILITIES.length);
check('all scores are within 0-100', scorecards.every(s => s.score >= 0 && s.score <= 100));
check('scores are integers (no float noise in the UI)', scorecards.every(s => Number.isInteger(s.score)));
check('sorted weakest-first so the DHO sees the worst facility at the top',
    scorecards.every((s, i) => i === 0 || scorecards[i - 1].score <= s.score));
check('grade agrees with score band', scorecards.every(s =>
    (s.score >= 85 && s.grade === 'A') ||
    (s.score >= 70 && s.score < 85 && s.grade === 'B') ||
    (s.score >= 55 && s.score < 70 && s.grade === 'C') ||
    (s.score < 55 && s.grade === 'D')));

const subCentre = MAHARASHTRA_FACILITIES.find(f => f.type === 'SC');
if (subCentre) {
    const sc = scoreFacility(subCentre);
    const staffing = sc.components.find(c => c.label === 'Staffing vs IPHS')!;
    check('a Sub-Centre is not penalised for having no doctor (not mandated at that tier)',
        staffing.score > 0, `staffing scored ${staffing.score}`);
    check('a Sub-Centre reports no bed-shortage gap when it has no beds by design',
        !sc.gaps.some(g => g.includes('Bed occupancy critical')));
}

check('gaps are only reported alongside a sub-100 component',
    scorecards.every(s => s.gaps.length === 0 || s.components.some(c => c.score < 100)));

// Facilities describe services in clinical language ("24x7 Delivery Care (BEmONC)",
// "Routine Diagnostics"), not in the standard's vocabulary. Matching the standard's
// term literally used to report a CHC as having no OPD — wrong, and discrediting.
const chc = MAHARASHTRA_FACILITIES.find(f => f.type === 'CHC');
if (chc) {
    const card = scoreFacility(chc);
    const services = card.components.find(c => c.label === 'Essential Services')!;
    check('a CHC offering delivery care and diagnostics is credited for them',
        services.score === 100, `scored ${services.score} (${services.detail})`);
    check('no false "missing OPD" gap for a facility that runs an outpatient service',
        !card.gaps.some(g => g.includes('Outpatient')), card.gaps.join(' | '));
}

const phcPerimili = MAHARASHTRA_FACILITIES.find(f => f.id === 'phc-perimili');
if (phcPerimili) {
    const services = scoreFacility(phcPerimili).components.find(c => c.label === 'Essential Services')!;
    check('a PHC listing plain "OPD" is credited for outpatient care', services.score > 0,
        `scored ${services.score} (${services.detail})`);
}

const scKothi = MAHARASHTRA_FACILITIES.find(f => f.id === 'sc-kothi');
if (scKothi) {
    const services = scoreFacility(scKothi).components.find(c => c.label === 'Essential Services')!;
    check('a Sub-Centre running ANC check-ups and immunisation days scores full marks',
        services.score === 100, `scored ${services.score} (${services.detail})`);
}

// ---------------------------------------------------------------------------
console.log(failures === 0 ? '\nAll facility-metric checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
