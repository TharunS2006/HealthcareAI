/**
 * OPD intake check — `npm run verify:intake`
 *
 * lib/triage/intake.ts turns what a health worker typed into vitals for
 * triage. It must never invent a reading:
 *
 *   1. EMPTY        an untouched form yields no vitals and names every
 *                   required reading
 *   2. COMPLETE     the required readings give vitals; optional ones not
 *                   measured are absent, not filled with normal values
 *   3. IMPLAUSIBLE  typing slips are refused with the reason
 *   4. COHORTS      pregnancy weeks and an under-five's age in months carry
 *                   through; a child must have an age
 *   5. TRIAGE       a complete record of a sick patient still triages RED
 */

const { EMPTY_INTAKE, readIntake } = await import('../lib/triage/intake');
const { classifyTriage } = await import('../lib/triage/model');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const complete = { ...EMPTY_INTAKE, spo2: '97', pulse: '84', systolic: '124', diastolic: '82', respiratoryRate: '16', avpu: 'ALERT' as const, complaint: 'Cough 3 days' };

console.log('\n1. EMPTY');
const empty = readIntake(EMPTY_INTAKE);
check('an untouched form gives no vitals', empty.vitals === null);
const named = empty.problems.map(p => p.field).sort().join(',');
check('…and names every required reading', named === 'avpu,diastolic,pulse,respiratoryRate,spo2,systolic', named);

console.log('\n2. COMPLETE');
const ok = readIntake(complete);
check('the required readings give vitals', ok.vitals !== null && ok.problems.length === 0, JSON.stringify(ok.problems));
check('…with exactly what was typed', ok.vitals?.spo2 === 97 && ok.vitals?.heartRate === 84 && ok.vitals?.bloodPressure?.systolic === 124 && ok.vitals?.bloodPressure?.diastolic === 82 && ok.vitals?.respiratoryRate === 16 && ok.vitals?.consciousness === 'ALERT');
check('temperature and glucose not measured are absent, not 98.6 °F and 110 mg/dL',
    ok.vitals !== null && !('temperature' in ok.vitals) && !('bloodGlucose' in ok.vitals), JSON.stringify(ok.vitals));
check('not pregnant unless ticked', ok.vitals !== null && !('isPregnant' in ok.vitals));
const withOptional = readIntake({ ...complete, temperature: '101.2', glucose: '240' });
check('measured temperature and glucose are kept', withOptional.vitals?.temperature === 101.2 && withOptional.vitals?.bloodGlucose === 240);

console.log('\n3. IMPLAUSIBLE');
for (const [field, value] of [['spo2', '970'], ['pulse', '8'], ['systolic', '1200'], ['respiratoryRate', '0'], ['temperature', '37'], ['spo2', 'abc']] as const) {
    const r = readIntake({ ...complete, [field]: value });
    check(`${field} ${value} is refused, with the reason`, r.vitals === null && r.problems.some(p => p.field === field && p.message.includes(value)), JSON.stringify(r.problems));
}
const inverted = readIntake({ ...complete, systolic: '80', diastolic: '120' });
check('diastolic above systolic is refused', inverted.vitals === null && inverted.problems.some(p => p.field === 'diastolic'));
const onlySystolic = readIntake({ ...complete, diastolic: '' });
check('one blood-pressure number is never completed with a made-up other', onlySystolic.vitals === null && onlySystolic.problems.some(p => p.field === 'diastolic'));

console.log('\n4. COHORTS');
const anc = readIntake({ ...complete, pregnant: true, gestationalWeeks: '34' });
check('pregnancy and its weeks carry through', anc.vitals?.isPregnant === true && anc.vitals?.gestationalWeeks === 34);
const ancNoWeeks = readIntake({ ...complete, pregnant: true });
check('weeks not entered stay unknown — not 32', ancNoWeeks.vitals?.isPregnant === true && ancNoWeeks.vitals !== null && !('gestationalWeeks' in ancNoWeeks.vitals));
const child = readIntake({ ...complete, child: true, childAgeMonths: '18' });
check('an under-five keeps the age in months that was entered', child.vitals?.childAgeMonths === 18);
check('an under-five with no age is refused — not assumed 18 months', readIntake({ ...complete, child: true }).vitals === null);
check('pregnant and under-five together is refused', readIntake({ ...complete, pregnant: true, child: true, childAgeMonths: '12' }).vitals === null);

console.log('\n5. TRIAGE');
const sick = readIntake({ ...complete, spo2: '91', pulse: '118', systolic: '172', diastolic: '114', respiratoryRate: '24', pregnant: true, gestationalWeeks: '34', complaint: 'severe headache, blurred vision' });
const result = sick.vitals ? await classifyTriage(sick.vitals) : null;
check('a complete record of pre-eclampsia signs triages RED', result?.status === 'RED', result?.status);

console.log(failures === 0 ? '\nAll intake checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
