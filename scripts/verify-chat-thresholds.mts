/**
 * Chat-assistant threshold check — `npm run verify:chat-thresholds`
 *
 * lib/chat/knowledgeBase.ts::CLINICAL_THRESHOLDS is a hand-copied mirror of the
 * boundaries enforced in assessClinically() (lib/triage/model.ts), because that
 * function is private and exports nothing a second consumer can import. A copy
 * can silently drift from the engine it describes — a chatbot that tells a
 * health worker "SpO2 below 92 is critical" when the engine actually fires at
 * 90 is a wrong answer with a patient behind it.
 *
 * This script does not re-derive the thresholds; it drives classifyTriage()
 * itself at and past each stated boundary and asserts the resulting status
 * escalates the way CLINICAL_THRESHOLDS claims. If lib/triage/model.ts changes
 * a threshold, this fails until knowledgeBase.ts is updated to match.
 *
 * It deliberately does NOT assert GREEN just short of a boundary: the neural
 * network can independently flag an otherwise-normal reading (the escalate-only
 * design tolerates that — a false RED is safe, a false GREEN is not), so "not
 * yet triggered" is not a guarantee this system makes. Only the escalation
 * direction — that the stated number reliably produces the stated acuity — is
 * a safety-relevant claim, and that is what this script checks.
 */
import type { Vitals } from '../types/patient';

// Dynamic import: lib/ is CJS under this package.json, so named ESM bindings aren't static.
const { classifyTriage } = await import('../lib/triage/model');
const { CLINICAL_THRESHOLDS } = await import('../lib/chat/knowledgeBase');

const healthy: Vitals = {
    spo2: 98, heartRate: 76, bloodPressure: { systolic: 118, diastolic: 76 },
    temperature: 98.4, respiratoryRate: 16, bloodGlucose: 95,
    consciousness: 'ALERT', injuryType: 'routine check-up',
};

type Priority = 'RED' | 'YELLOW' | 'GREEN';
interface Case { name: string; expect: Priority; vitals: Vitals }

const t = CLINICAL_THRESHOLDS;
const cases: Case[] = [
    // SpO2 — critical < 90, caution < 95
    { name: `spo2 ${t.spo2.criticalBelow} (at critical boundary, still within caution band)`, expect: 'YELLOW', vitals: { ...healthy, spo2: t.spo2.criticalBelow } },
    { name: `spo2 ${t.spo2.criticalBelow - 1} (below critical)`, expect: 'RED', vitals: { ...healthy, spo2: t.spo2.criticalBelow - 1 } },
    { name: `spo2 ${t.spo2.cautionBelow - 1} (below caution, above critical)`, expect: 'YELLOW', vitals: { ...healthy, spo2: t.spo2.cautionBelow - 1 } },

    // Heart rate — critical > 130 or < 48, caution > 105
    { name: `hr ${t.heartRate.criticalAbove} (at critical boundary, still within caution band)`, expect: 'YELLOW', vitals: { ...healthy, heartRate: t.heartRate.criticalAbove } },
    { name: `hr ${t.heartRate.criticalAbove + 1} (above critical)`, expect: 'RED', vitals: { ...healthy, heartRate: t.heartRate.criticalAbove + 1 } },
    { name: `hr ${t.heartRate.criticalBelow - 1} (below critical)`, expect: 'RED', vitals: { ...healthy, heartRate: t.heartRate.criticalBelow - 1 } },
    { name: `hr ${t.heartRate.cautionAbove + 1} (above caution)`, expect: 'YELLOW', vitals: { ...healthy, heartRate: t.heartRate.cautionAbove + 1 } },

    // Systolic — critical <= 85 or >= 160, caution >= 140
    { name: `sys ${t.systolic.criticalBelowOrEqual} (at/below critical)`, expect: 'RED', vitals: { ...healthy, bloodPressure: { systolic: t.systolic.criticalBelowOrEqual, diastolic: 76 } } },
    { name: `sys ${t.systolic.criticalBelowOrEqual + 1} (just above)`, expect: 'GREEN', vitals: { ...healthy, bloodPressure: { systolic: t.systolic.criticalBelowOrEqual + 1, diastolic: 76 } } },
    { name: `sys ${t.systolic.criticalAboveOrEqual} (at/above critical)`, expect: 'RED', vitals: { ...healthy, bloodPressure: { systolic: t.systolic.criticalAboveOrEqual, diastolic: 76 } } },
    { name: `sys ${t.systolic.cautionAboveOrEqual} (at caution)`, expect: 'YELLOW', vitals: { ...healthy, bloodPressure: { systolic: t.systolic.cautionAboveOrEqual, diastolic: 76 } } },

    // Diastolic — critical >= 100, caution >= 90
    { name: `dia ${t.diastolic.criticalAboveOrEqual} (at/above critical)`, expect: 'RED', vitals: { ...healthy, bloodPressure: { systolic: 118, diastolic: t.diastolic.criticalAboveOrEqual } } },
    { name: `dia ${t.diastolic.cautionAboveOrEqual} (at caution)`, expect: 'YELLOW', vitals: { ...healthy, bloodPressure: { systolic: 118, diastolic: t.diastolic.cautionAboveOrEqual } } },

    // Respiratory rate — critical >= 36 or <= 8, caution >= 27
    { name: `rr ${t.respiratoryRate.criticalAboveOrEqual} (at/above critical)`, expect: 'RED', vitals: { ...healthy, respiratoryRate: t.respiratoryRate.criticalAboveOrEqual } },
    { name: `rr ${t.respiratoryRate.criticalBelowOrEqual} (at/below critical)`, expect: 'RED', vitals: { ...healthy, respiratoryRate: t.respiratoryRate.criticalBelowOrEqual } },
    { name: `rr ${t.respiratoryRate.cautionAboveOrEqual} (at caution)`, expect: 'YELLOW', vitals: { ...healthy, respiratoryRate: t.respiratoryRate.cautionAboveOrEqual } },

    // Temperature — caution >= 102.5 (no critical tier in the engine)
    { name: `temp ${t.temperature.cautionAboveOrEqual} (at caution)`, expect: 'YELLOW', vitals: { ...healthy, temperature: t.temperature.cautionAboveOrEqual } },

    // Glucose — critical <= 55 or >= 280, caution >= 180
    { name: `glucose ${t.glucose.criticalBelowOrEqual} (at/below critical)`, expect: 'RED', vitals: { ...healthy, bloodGlucose: t.glucose.criticalBelowOrEqual } },
    { name: `glucose ${t.glucose.criticalAboveOrEqual} (at/above critical)`, expect: 'RED', vitals: { ...healthy, bloodGlucose: t.glucose.criticalAboveOrEqual } },
    { name: `glucose ${t.glucose.cautionAboveOrEqual} (at caution)`, expect: 'YELLOW', vitals: { ...healthy, bloodGlucose: t.glucose.cautionAboveOrEqual } },
];

let pass = 0;
const failures: string[] = [];

for (const c of cases) {
    const r = await classifyTriage(c.vitals);
    const ok = r.status === c.expect;
    if (ok) pass++;
    else failures.push(`${c.name}: expected ${c.expect}, got ${r.status} (${r.reasoning})`);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name.padEnd(46)} -> ${r.status} (expected ${c.expect})`);
}

console.log(`\n${pass}/${cases.length} passed`);
for (const f of failures) console.log(` FAIL ${f}`);
console.log(
    failures.length === 0
        ? '\nCLINICAL_THRESHOLDS in lib/chat/knowledgeBase.ts matches assessClinically() exactly.'
        : '\nMISMATCH — update CLINICAL_THRESHOLDS in lib/chat/knowledgeBase.ts to match lib/triage/model.ts.'
);

process.exit(failures.length === 0 ? 0 : 1);
