/**
 * Triage regression check — `npm run verify:triage`
 *
 * Guards the four properties the triage engine must never lose. Each was a real defect:
 *
 *   1. ACUITY        every danger sign reaches its expected acuity. Substring-matched
 *                    overrides used to miss shock, hypoglycaemia, bradypnoea and altered
 *                    sensorium entirely.
 *   2. DISCRIMINATION a healthy adult must classify GREEN. A degenerate training set once
 *                    made the network answer RED for every patient, which also made the
 *                    clinical override unreachable (an override may only escalate).
 *   3. DETERMINISM   identical vitals must yield an identical verdict. Run this twice in
 *                    separate processes and diff the output: the network is trained at
 *                    runtime, so reproducibility depends on the seeded dataset and
 *                    initialisers holding.
 *   4. HONEST CONF.  `confidence` must describe the class actually returned, never the
 *                    bare argmax of a softmax that a rule then overruled.
 *
 * Uses tsx (already a devDependency) rather than a test framework, so it adds no deps.
 */
import type { TriageResult } from '../lib/triage/model';
import type { Vitals } from '../types/patient';

// Dynamic import: lib/ is CJS under this package.json, so named ESM bindings aren't static.
const { classifyTriage } = await import('../lib/triage/model');

const healthy: Vitals = {
    spo2: 98, heartRate: 76, bloodPressure: { systolic: 118, diastolic: 76 },
    temperature: 98.4, respiratoryRate: 16, bloodGlucose: 95,
    consciousness: 'ALERT', injuryType: 'routine check-up',
};

const cases: Array<{ name: string; expect: 'RED' | 'YELLOW' | 'GREEN'; vitals: Vitals }> = [
    { name: 'healthy adult',                  expect: 'GREEN',  vitals: healthy },
    { name: 'SPO2_CRITICAL      spo2 86',     expect: 'RED',    vitals: { ...healthy, spo2: 86 } },
    { name: 'TACHYCARDIA_SEVERE hr 148',      expect: 'RED',    vitals: { ...healthy, heartRate: 148 } },
    { name: 'BRADYCARDIA_SEVERE hr 42',       expect: 'RED',    vitals: { ...healthy, heartRate: 42 } },
    { name: 'HYPOTENSION_SHOCK  80/50',       expect: 'RED',    vitals: { ...healthy, bloodPressure: { systolic: 80, diastolic: 50 } } },
    { name: 'HYPERTENSION_SEV   176/104',     expect: 'RED',    vitals: { ...healthy, bloodPressure: { systolic: 176, diastolic: 104 } } },
    { name: 'HYPOGLYCEMIA       glu 48',      expect: 'RED',    vitals: { ...healthy, bloodGlucose: 48 } },
    { name: 'HYPERGLYCEMIA_CRIT glu 320',     expect: 'RED',    vitals: { ...healthy, bloodGlucose: 320 } },
    { name: 'RESP_RATE_CRITICAL rr 40',       expect: 'RED',    vitals: { ...healthy, respiratoryRate: 40 } },
    { name: 'RESP_RATE_LOW      rr 7',        expect: 'RED',    vitals: { ...healthy, respiratoryRate: 7 } },
    { name: 'CONSCIOUSNESS      AVPU=PAIN',   expect: 'RED',    vitals: { ...healthy, consciousness: 'PAIN' } },
    { name: 'HIGH_RISK_MATERNAL 158/98 +hdc', expect: 'RED',    vitals: { ...healthy, isPregnant: true, bloodPressure: { systolic: 158, diastolic: 98 }, injuryType: 'severe headache' } },
    { name: 'HIGH_RISK_PEDIATRIC 18mo rr 46', expect: 'RED',    vitals: { ...healthy, childAgeMonths: 18, respiratoryRate: 46 } },
    { name: 'SPO2_LOW           spo2 93',     expect: 'YELLOW', vitals: { ...healthy, spo2: 93 } },
    { name: 'TACHYCARDIA        hr 118',      expect: 'YELLOW', vitals: { ...healthy, heartRate: 118 } },
    { name: 'HYPERTENSION       146/92',      expect: 'YELLOW', vitals: { ...healthy, bloodPressure: { systolic: 146, diastolic: 92 } } },
    { name: 'RESP_RATE_HIGH     rr 30',       expect: 'YELLOW', vitals: { ...healthy, respiratoryRate: 30 } },
    { name: 'HIGH_FEVER         103.2 F',     expect: 'YELLOW', vitals: { ...healthy, temperature: 103.2 } },
    { name: 'HYPERGLYCEMIA      glu 210',     expect: 'YELLOW', vitals: { ...healthy, bloodGlucose: 210 } },
    { name: 'CONSCIOUSNESS      AVPU=VOICE',  expect: 'YELLOW', vitals: { ...healthy, consciousness: 'VOICE' } },
];

let pass = 0;
const failures: string[] = [];
const sources = new Set<string>();

for (const c of cases) {
    const r: TriageResult = await classifyTriage(c.vitals);
    const again: TriageResult = await classifyTriage(c.vitals);

    const problems: string[] = [];
    if (r.status !== c.expect) problems.push(`expected ${c.expect}, got ${r.status}`);
    if (r.status !== again.status || r.confidence !== again.confidence) problems.push('non-deterministic');
    if (r.decisionSource === 'NEURAL_NETWORK' && r.confidence !== r.probabilities[r.status]) {
        problems.push(`confidence ${r.confidence} != P(${r.status})=${r.probabilities[r.status]}`);
    }
    if (r.status === 'RED' && r.priority !== 'EMERGENCY') problems.push(`RED but priority ${r.priority}`);

    sources.add(r.decisionSource);
    const ok = problems.length === 0;
    if (ok) pass++;
    else failures.push(`${c.name}: ${problems.join('; ')}`);

    console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(28)} -> ${String(r.status).padEnd(6)} ` +
        `conf ${String(r.confidence).padEnd(4)} ${r.decisionSource.padEnd(17)} ` +
        `softmax R/Y/G ${r.probabilities.RED}/${r.probabilities.YELLOW}/${r.probabilities.GREEN}  ` +
        `${r.recommendedFacilityTier.padEnd(3)}  ${r.flagsDetected.join(',') || '-'}`
    );
}

console.log(`\n${pass}/${cases.length} passed · decision paths exercised: ${[...sources].sort().join(', ')}`);
for (const f of failures) console.log(`  FAIL ${f}`);

process.exit(failures.length === 0 ? 0 : 1);
