/**
 * Pre-arrival readiness check — `npm run verify:equipment`
 *
 * Two modules are asserted here because they are the clinical half of the cloud
 * hand-off, and neither has a UI that would make a mistake obvious:
 *
 *   - lib/care/priority.ts   — compressing four priority levels into three
 *                              triage colours, which decides where a case lands
 *                              on the receiving facility's board.
 *   - lib/care/equipment.ts  — turning a record into the list of things the
 *                              receiving team should have ready.
 *
 * The properties below are the ones whose failure would be invisible in the
 * browser. A board that renders beautifully while quietly rounding SEMI_URGENT
 * down to GREEN, or while reporting a ventilator as available at a PHC that has
 * none, looks exactly like a board that is right.
 */

// Dynamic import: lib/ is CJS under this package.json, so named ESM bindings aren't static.
const { COLOUR_RANK, colourForPatient, colourForPriority } = await import('../lib/care/priority');
const { prepareFor, readinessFor, requiredEquipment } = await import('../lib/care/equipment');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');

type TriageStatus = 'RED' | 'YELLOW' | 'GREEN';
type TriagePriority = 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE';

const failures: string[] = [];
const pass = (label: string) => console.log(`  PASS  ${label}`);
const fail = (label: string, detail: string) => {
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failures.push(label);
};
const check = (label: string, ok: boolean, detail: string) => (ok ? pass(label) : fail(label, detail));

// ── fixtures ─────────────────────────────────────────────────────────────────
// Deliberately in the app's own vocabulary (triageStatus RED/YELLOW/GREEN,
// priority EMERGENCY/URGENT/…), not the cloud's. A fixture written in the wire
// format is how the last round of these checks passed while the app was broken.

const baseVitals = {
    spo2: 98,
    heartRate: 78,
    bloodPressure: { systolic: 118, diastolic: 76 },
    temperature: 98.4,
    respiratoryRate: 16,
    bloodGlucose: 96,
    consciousness: 'ALERT' as const,
    injuryType: 'Routine antenatal check-up',
};

const patient = (over: Record<string, any> = {}): any => ({
    id: 'p-test',
    name: 'Test Patient',
    age: 30,
    gender: 'F',
    village: 'Kothi',
    tehsil: 'Bhamragad',
    district: 'Gadchiroli',
    vitals: { ...baseVitals, ...(over.vitals ?? {}) },
    triageStatus: 'GREEN',
    gps: { lat: 19.5, lng: 80.4 },
    isSynced: false,
    timestamp: new Date().toISOString(),
    ...over,
});

const referral = (over: Record<string, any> = {}): any => ({
    priority: 'ROUTINE',
    reason: 'Routine review',
    clinicalSummary: '',
    ...over,
});

const ids = (needs: Array<{ id: string }>) => needs.map((n) => n.id);
const has = (needs: Array<{ id: string }>, id: string) => ids(needs).includes(id);

const DH = FACILITY_NETWORK.find((f: any) => f.id === 'dh-district')!;
const PHC = FACILITY_NETWORK.find((f: any) => f.id === 'phc-bhamragad')!;
const SC = FACILITY_NETWORK.find((f: any) => f.id === 'sc-kothi')!;

console.log('\nNalamMesh — pre-arrival readiness check\n');

// ── 1. The four-to-three mapping only ever escalates ─────────────────────────
console.log('Priority → triage colour never lowers urgency:');
{
    const expected: Record<TriagePriority, TriageStatus> = {
        EMERGENCY: 'RED',
        URGENT: 'YELLOW',
        SEMI_URGENT: 'YELLOW',
        ROUTINE: 'GREEN',
    };
    for (const [priority, colour] of Object.entries(expected) as Array<[TriagePriority, TriageStatus]>) {
        check(`${priority} → ${colour}`, colourForPriority(priority) === colour,
            `got ${colourForPriority(priority)}`);
    }
    // The one that matters: the level with no colour of its own must round up.
    check('SEMI_URGENT rounds up, never down to GREEN',
        colourForPriority('SEMI_URGENT') !== 'GREEN',
        'SEMI_URGENT mapped to GREEN — a semi-urgent case would sit at the bottom of the board');

    // Unknown urgency is treated as the most urgent, not the least.
    for (const bad of [undefined, '', 'PRIORITY_3', 'red', null]) {
        check(`unreadable priority ${JSON.stringify(bad)} → RED`,
            colourForPriority(bad as any) === 'RED',
            `got ${colourForPriority(bad as any)} — an unreadable priority must not be assumed routine`);
    }
}

// ── 2. colourForPatient prefers the recorded triage ──────────────────────────
console.log('\nPatient colour comes from the triage of record:');
{
    check('triageStatus wins over triagePriority',
        colourForPatient({ triageStatus: 'YELLOW', triagePriority: 'ROUTINE' }) === 'YELLOW',
        'the recorded triage colour was overridden by the queue priority');
    check('falls back to priority when untriaged',
        colourForPatient({ triagePriority: 'EMERGENCY' }) === 'RED',
        'an untriaged EMERGENCY patient did not fall back to RED');
    check('no data at all → RED',
        colourForPatient({}) === 'RED',
        'a patient with no urgency information was assumed stable');
}

// ── 3. A RED case is never left with an empty preparation list ───────────────
console.log('\nA RED case always yields the resuscitation set:');
{
    // The worst real case: the referral arrived, the record has not.
    const needs = requiredEquipment(referral({ priority: 'EMERGENCY', reason: 'Collapsed at home' }), null);
    check('resuscitation bay', has(needs, 'resus-bay'), `got ${JSON.stringify(ids(needs))}`);
    check('oxygen', has(needs, 'oxygen'), `got ${JSON.stringify(ids(needs))}`);
    check('monitor', has(needs, 'monitor'), `got ${JSON.stringify(ids(needs))}`);
    check('IV access', has(needs, 'iv-access'), `got ${JSON.stringify(ids(needs))}`);
}

// ── 4. A stale GREEN record cannot cancel an EMERGENCY referral ──────────────
console.log('\nThe more urgent of record and referral wins:');
{
    const stale = patient({ triageStatus: 'GREEN' });
    const needs = requiredEquipment(referral({ priority: 'EMERGENCY', reason: 'Deteriorated after review' }), stale);
    check('EMERGENCY referral + GREEN record still prepares resuscitation',
        has(needs, 'resus-bay'),
        `a stale GREEN record cleared the board for an EMERGENCY referral: ${JSON.stringify(ids(needs))}`);

    const redRecord = patient({ triageStatus: 'RED', vitals: { ...baseVitals, spo2: 88 } });
    const needs2 = requiredEquipment(referral({ priority: 'ROUTINE', reason: 'Review' }), redRecord);
    check('RED record still prepares resuscitation under a ROUTINE referral',
        has(needs2, 'resus-bay'),
        `a ROUTINE referral suppressed a RED record: ${JSON.stringify(ids(needs2))}`);
}

// ── 5. The real case this feature was built for ──────────────────────────────
console.log('\nSevere pre-eclampsia at 32 weeks prepares obstetric + newborn care:');
{
    const sunita = patient({
        triageStatus: 'RED',
        triagePriority: 'EMERGENCY',
        vitals: {
            ...baseVitals,
            spo2: 94,
            heartRate: 104,
            bloodPressure: { systolic: 160, diastolic: 102 },
            isPregnant: true,
            gestationalWeeks: 32,
            injuryType: 'High-risk Antenatal: severe gestational hypertension with headache and visual blurring',
        },
        highRiskFlags: [{ type: 'MATERNAL', severity: 'HIGH', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' }],
    });
    const ref = referral({
        priority: 'EMERGENCY',
        reason: 'Severe pre-eclampsia at 32 weeks. Needs CEmONC and a neonatal cot on standby.',
        clinicalSummary: 'SpO2: 94%, BP: 160/102 mmHg.',
    });
    const needs = requiredEquipment(ref, sunita);
    for (const id of ['eclampsia-tray', 'obstetric-theatre', 'radiant-warmer', 'labour-room', 'resus-bay']) {
        check(`prepares ${id}`, has(needs, id), `got ${JSON.stringify(ids(needs))}`);
    }
}

// ── 6. Vitals thresholds fire ────────────────────────────────────────────────
console.log('\nMeasured vitals drive preparation:');
{
    const cases: Array<[string, Record<string, any>, string[]]> = [
        ['SpO₂ 86% → oxygen + airway', { spo2: 86 }, ['oxygen', 'airway']],
        ['SpO₂ 92% → oxygen', { spo2: 92 }, ['oxygen']],
        ['systolic 80 → IV access', { bloodPressure: { systolic: 80, diastolic: 50 } }, ['iv-access']],
        ['pulse 132 → monitor + IV access', { heartRate: 132 }, ['monitor', 'iv-access']],
        ['unresponsive → airway + glucose', { consciousness: 'UNRESPONSIVE' }, ['airway', 'glucose']],
        ['glucose 48 → glucose trolley', { bloodGlucose: 48 }, ['glucose']],
        ['RR 30 → oxygen + nebuliser', { respiratoryRate: 30 }, ['oxygen', 'nebuliser']],
        ['child 14 months → paediatric bed', { childAgeMonths: 14 }, ['paediatric-bed']],
    ];
    for (const [label, vitals, expect] of cases) {
        const needs = requiredEquipment(referral(), patient({ vitals }));
        const missing = expect.filter((id) => !has(needs, id));
        check(label, missing.length === 0, `missing ${JSON.stringify(missing)}; got ${JSON.stringify(ids(needs))}`);
    }

    // Normal vitals must not manufacture work — a board crying wolf gets ignored.
    const stable = requiredEquipment(referral(), patient());
    check('a stable ROUTINE case does not demand resuscitation',
        !has(stable, 'resus-bay') && !has(stable, 'airway'),
        `a stable patient produced ${JSON.stringify(ids(stable))}`);
}

// ── 7. Free-text rules read the referral's own words ─────────────────────────
console.log('\nThe referral text is read:');
{
    const textCases: Array<[string, string[]]> = [
        ['Road traffic accident, open fracture of the left femur', ['trauma-set', 'xray', 'blood']],
        ['Snake bite on the right foot two hours ago', ['antivenom']],
        ['Sudden left-sided paralysis and slurred speech', ['ct', 'airway']],
        ['Severe chest pain radiating to the left arm', ['ecg-defib']],
        ['Organophosphate poisoning, pesticide ingestion', ['poisoning-kit', 'airway']],
        ['Acute severe asthma, breathless and wheezing', ['nebuliser', 'oxygen']],
        ['Profuse diarrhoea and vomiting since morning', ['rehydration']],
        ['Suspected pulmonary tuberculosis with haemoptysis', ['isolation']],
        ['Convulsion lasting five minutes', ['seizure-tray', 'airway']],
        ['Flame burns over both forearms', ['burn-care', 'iv-access']],
    ];
    for (const [reason, expect] of textCases) {
        const needs = requiredEquipment(referral({ priority: 'URGENT', reason }), null);
        const missing = expect.filter((id) => !has(needs, id));
        check(`"${reason.slice(0, 44)}…"`, missing.length === 0,
            `missing ${JSON.stringify(missing)}; got ${JSON.stringify(ids(needs))}`);
    }
}

// ── 8. Registered high-risk flags are honoured ───────────────────────────────
console.log('\nLongitudinal high-risk flags are honoured:');
{
    const flagCases: Array<[string, string]> = [
        ['MATERNAL', 'labour-room'],
        ['CHILD_U5', 'paediatric-bed'],
        ['MALNUTRITION', 'nutrition'],
        ['TB', 'isolation'],
        ['NCD_DIABETES', 'glucose'],
        ['NCD_HYPERTENSION', 'bp-review'],
    ];
    for (const [type, id] of flagCases) {
        const needs = requiredEquipment(referral(), patient({
            highRiskFlags: [{ type, severity: 'HIGH', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' }],
        }));
        check(`${type} → ${id}`, has(needs, id), `got ${JSON.stringify(ids(needs))}`);
    }
    // OTHER has no specific preparation, and must not crash the derivation.
    const other = requiredEquipment(referral(), patient({
        highRiskFlags: [{ type: 'OTHER', severity: 'LOW', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' }],
    }));
    check('an OTHER flag is handled without throwing', Array.isArray(other), 'derivation threw or returned a non-list');
}

// ── 9. Structural invariants of the list itself ──────────────────────────────
console.log('\nThe list is well-formed:');
{
    const everything = requiredEquipment(
        referral({
            priority: 'EMERGENCY',
            reason: 'Road accident with bleeding, convulsion, breathless, burns, snake bite, poisoning, newborn',
            clinicalSummary: 'diarrhoea, chest pain, paralysis, tuberculosis, delivery',
        }),
        patient({
            triageStatus: 'RED',
            vitals: {
                ...baseVitals, spo2: 85, heartRate: 140, bloodGlucose: 400, respiratoryRate: 30,
                temperature: 103, consciousness: 'PAIN', isPregnant: true, gestationalWeeks: 31, childAgeMonths: 2,
                bloodPressure: { systolic: 165, diastolic: 112 },
            },
            highRiskFlags: [
                { type: 'MATERNAL', severity: 'HIGH', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' },
                { type: 'TB', severity: 'MEDIUM', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' },
            ],
        })
    );

    check('no duplicate items', new Set(ids(everything)).size === ids(everything).length,
        `duplicates in ${JSON.stringify(ids(everything))}`);

    const firstOnArrival = everything.findIndex((n) => n.urgency === 'ON_ARRIVAL');
    const lastImmediate = everything.map((n) => n.urgency).lastIndexOf('IMMEDIATE');
    check('IMMEDIATE items are listed before ON_ARRIVAL ones',
        firstOnArrival === -1 || lastImmediate < firstOnArrival,
        `ordering broken: ${JSON.stringify(everything.map((n) => `${n.id}:${n.urgency}`))}`);

    const unexplained = everything.filter((n) => !n.reason || n.reason.trim().length < 8);
    check('every item explains why it fired', unexplained.length === 0,
        `items with no usable reason: ${JSON.stringify(unexplained.map((n) => n.id))}`);

    const unmatchable = everything.filter((n) => !n.match || n.match.length === 0);
    check('every item can be checked against a facility', unmatchable.length === 0,
        `items with no match patterns: ${JSON.stringify(unmatchable.map((n) => n.id))}`);
}

// ── 10. No item states a dose ────────────────────────────────────────────────
// Same rule as the assistant: this screen is read by staff under time pressure,
// and a quantity on it would be acted on. Preparation only.
console.log('\nNo item states a dose, route or rate:');
{
    const DOSE_PATTERNS: Array<[RegExp, string]> = [
        [/\b\d+(\.\d+)?\s*mg\b(?!\/d)/i, 'a milligram quantity'],
        [/\bmg\s*\/\s*kg\b/i, 'a weight-based dose'],
        [/\b\d+(\.\d+)?\s*(ml|mcg|iu|units?)\b/i, 'a volume/unit dose'],
        [/\b\d+\s*(tablet|tab|capsule|cap|drop|sachet|vial|ampoule)s?\b/i, 'a unit count'],
        [/\b(bd|tds|qid|od|prn)\b/i, 'a prescription abbreviation'],
        [/\b(bolus|infuse|administer|give)\b/i, 'an instruction to administer'],
    ];

    // Every label in the catalogue, reached by firing everything at once.
    const all = requiredEquipment(
        referral({
            priority: 'EMERGENCY',
            reason: 'accident bleeding chest pain stroke seizure snake poison burn diarrhoea asthma tuberculosis delivery newborn',
        }),
        patient({
            triageStatus: 'RED',
            vitals: {
                ...baseVitals, spo2: 85, heartRate: 40, bloodGlucose: 40, respiratoryRate: 30,
                consciousness: 'VOICE', isPregnant: true, gestationalWeeks: 30, childAgeMonths: 3,
                bloodPressure: { systolic: 85, diastolic: 55 },
            },
            highRiskFlags: [
                { type: 'NCD_HYPERTENSION', severity: 'HIGH', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' },
                { type: 'MALNUTRITION', severity: 'HIGH', identifiedDate: '2026-01-01', nextFollowUpDate: '2026-02-01' },
            ],
        })
    );
    check('the sweep reaches most of the catalogue', all.length >= 18,
        `only ${all.length} items fired; the dose check would be vacuous`);

    let clean = true;
    for (const need of all) {
        const hit = DOSE_PATTERNS.find(([re]) => re.test(need.label));
        if (hit) {
            fail(`${need.id} label is dose-free`, `matched ${hit[1]}: ${JSON.stringify(need.label)}`);
            clean = false;
        }
    }
    if (clean) pass(`all ${all.length} labels are dose-free`);
}

// ── 11. Readiness against a real facility ────────────────────────────────────
console.log('\nFacility cross-reference reflects what is actually recorded:');
{
    const stroke = referral({ priority: 'EMERGENCY', reason: 'Sudden paralysis and slurred speech' });
    const atDH = prepareFor(stroke, null, DH);
    const atPHC = prepareFor(stroke, null, PHC);

    const ctAtDH = atDH.items.find((i: any) => i.need.id === 'ct');
    const ctAtPHC = atPHC.items.find((i: any) => i.need.id === 'ct');
    check('CT reads READY at the District Hospital', ctAtDH?.state === 'READY',
        `got ${ctAtDH?.state} — DH equipment lists a CT Scanner`);
    check('CT reads GAP at the PHC', ctAtPHC?.state === 'GAP',
        `got ${ctAtPHC?.state} — the PHC has no scanner and the board must say so`);
    check('a READY item names the line that satisfied it',
        typeof ctAtDH?.matchedOn === 'string' && DH.equipment.concat(DH.services).includes(ctAtDH!.matchedOn!),
        `matchedOn was ${JSON.stringify(ctAtDH?.matchedOn)} — it must be a line from this facility`);
    check('the PHC reports at least one gap for a stroke case', atPHC.gaps > 0,
        'a PHC reported full readiness for a stroke — the cross-reference is not working');

    const trauma = prepareFor(referral({ priority: 'EMERGENCY', reason: 'Road accident, heavy bleeding' }), null, SC);
    const bloodAtSC = trauma.items.find((i: any) => i.need.id === 'blood');
    check('blood bank reads GAP at a sub-centre', bloodAtSC?.state === 'GAP',
        `got ${bloodAtSC?.state} — a sub-centre has no blood storage`);

    // Counts must add up, or the "3 gaps" headline on the board is fiction.
    for (const [name, report] of [['DH', atDH], ['PHC', atPHC], ['SC', trauma]] as const) {
        const ready = report.items.filter((i: any) => i.state === 'READY').length;
        check(`${name}: counts add up`,
            ready + report.gaps + report.unknowns === report.items.length,
            `${ready} ready + ${report.gaps} gaps + ${report.unknowns} unknown ≠ ${report.items.length} items`);
    }
}

// ── 12. An unknown facility is never reported as ready ───────────────────────
console.log('\nAn unknown receiving facility reads UNKNOWN, not READY:');
{
    const needs = requiredEquipment(referral({ priority: 'EMERGENCY', reason: 'Collapsed' }), null);
    const report = readinessFor(needs, null);
    check('every item is UNKNOWN', report.items.every((i: any) => i.state === 'UNKNOWN'),
        `states: ${JSON.stringify(report.items.map((i: any) => i.state))}`);
    check('nothing is counted as a gap', report.gaps === 0, `gaps was ${report.gaps}`);
    check('unknowns equals the item count', report.unknowns === report.items.length,
        `${report.unknowns} of ${report.items.length}`);
}

// ── 13. "Derived from the referral alone" is reported honestly ───────────────
console.log('\nA missing patient record is declared, not hidden:');
{
    const withoutRecord = prepareFor(referral({ priority: 'EMERGENCY', reason: 'Collapsed' }), null, DH);
    const withRecord = prepareFor(referral({ priority: 'EMERGENCY', reason: 'Collapsed' }), patient({ triageStatus: 'RED' }), DH);
    check('flag set when the record has not arrived', withoutRecord.fromReferralOnly === true,
        'the board would present a referral-only list as if it were the full picture');
    check('flag cleared once the record arrives', withRecord.fromReferralOnly === false,
        'a complete case was still marked incomplete');
}

// ── 14. Every facility in the network can be evaluated ───────────────────────
console.log('\nEvery facility in the network evaluates without error:');
{
    const ref = referral({ priority: 'EMERGENCY', reason: 'Road accident with bleeding and breathlessness' });
    let ok = true;
    for (const facility of FACILITY_NETWORK as any[]) {
        try {
            const report = prepareFor(ref, null, facility);
            const lines = [...facility.equipment, ...facility.services];
            const bogus = report.items.filter((i: any) => i.matchedOn && !lines.includes(i.matchedOn));
            if (bogus.length > 0) {
                fail(`${facility.id} cites only its own lines`, `invented: ${JSON.stringify(bogus.map((b: any) => b.matchedOn))}`);
                ok = false;
            }
        } catch (err) {
            fail(`${facility.id} evaluates`, String(err));
            ok = false;
        }
    }
    if (ok) pass(`all ${FACILITY_NETWORK.length} facilities evaluate and cite only their own capability lines`);
}

console.log('');
if (failures.length === 0) {
    console.log('All checks passed — urgency only ever rounds up, a RED case always gets the');
    console.log('resuscitation set, no item states a dose, and an unverifiable facility reads');
    console.log('UNKNOWN rather than ready.\n');
    process.exit(0);
} else {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
}
