/**
 * High-risk follow-up — `npm run verify:followup`
 *
 *   1. FROM RECORDS  one task per high-risk flag, carrying that patient's own
 *                    name, age and village — never another patient's
 *   2. DUE           due days follow the flag's next follow-up date; the most
 *                    urgent come first
 *   3. VISITS        a recorded visit is saved on the flag, moves the next date
 *                    on by the cohort interval, marks the task visited, and
 *                    leaves the stored record untouched until saved
 *   4. NO MEDICINE   suggested actions are checks, never a drug or a dose
 */

const { recallTasksFrom, recordFollowUpVisit, FOLLOW_UP_INTERVAL_DAYS } = await import('../lib/followup/recall');
const { SEED_PATIENTS } = await import('../lib/data/facilities');
type HighRiskFlag = NonNullable<(typeof SEED_PATIENTS)[number]['highRiskFlags']>[number];

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const now = new Date(2026, 8, 25, 10);
const tasks = recallTasksFrom(SEED_PATIENTS, now);

console.log('\n1. FROM RECORDS');
const flagCount = SEED_PATIENTS.reduce((n, p) => n + (p.highRiskFlags?.length ?? 0), 0);
check(`one task per high-risk flag (${flagCount})`, tasks.length === flagCount, String(tasks.length));
const mismatched = tasks.filter(t => {
    const p = SEED_PATIENTS.find(x => x.id === t.patientId);
    return !p || p.name !== t.patientName || p.age !== t.age || p.gender !== t.gender;
});
check('every task carries its own patient\'s name, age and sex', mismatched.length === 0, mismatched.map(t => t.id).join(', '));
check('no flags, no tasks', recallTasksFrom([{ ...SEED_PATIENTS[0], highRiskFlags: [] }], now).length === 0);

console.log('\n2. DUE');
const day = 86_400_000;
const flags: HighRiskFlag[] = [
    { type: 'MATERNAL', severity: 'HIGH', identifiedDate: now.toISOString(), nextFollowUpDate: new Date(now.getTime() - 3 * day).toISOString() },
    { type: 'NCD_HYPERTENSION', severity: 'LOW', identifiedDate: now.toISOString(), nextFollowUpDate: new Date(now.getTime() + 5 * day).toISOString() },
];
const patient = { ...SEED_PATIENTS[0], highRiskFlags: flags };
const due = recallTasksFrom([patient], now);
check('three days past the date is overdue by 3', due[0].dueInDays === -3, String(due[0].dueInDays));
check('the overdue task comes first', due[0].flagIndex === 0 && due[1].dueInDays === 5);
check('severity sets priority (HIGH → CRITICAL, LOW → ROUTINE)', due[0].priority === 'CRITICAL' && due[1].priority === 'ROUTINE');
check('pregnancy is the maternal cohort, hypertension chronic', due[0].cohort === 'MATERNAL' && due[1].cohort === 'CHRONIC');

console.log('\n3. VISITS');
const visited = recordFollowUpVisit(patient, 0, now);
const flag = visited.highRiskFlags![0];
check('the visit is saved on the flag', flag.lastVisitAt === now.toISOString());
check(`…and the next follow-up moves on ${FOLLOW_UP_INTERVAL_DAYS.MATERNAL} days for a pregnancy`,
    Math.round((Date.parse(String(flag.nextFollowUpDate)) - now.getTime()) / day) === FOLLOW_UP_INTERVAL_DAYS.MATERNAL);
const after = recallTasksFrom([visited], now).find(t => t.flagIndex === 0)!;
check('the task now reads visited and due in the future', after.visited && (after.dueInDays ?? 0) > 0);
check('the other flag is untouched', JSON.stringify(visited.highRiskFlags![1]) === JSON.stringify(patient.highRiskFlags[1]));
check('the stored record is not changed until it is saved', patient.highRiskFlags[0].lastVisitAt === undefined);
check('the record is queued to sync', visited.isSynced === false);
let threw = false;
try { recordFollowUpVisit(patient, 7, now); } catch { threw = true; }
check('a flag that does not exist is refused, not invented', threw);

console.log('\n4. NO MEDICINE');
const DOSE = /\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b|\btab(let)?s?\b|\binj(ection)?\b|\bsyrup\b|dispense|administer|labetalol|metformin|magnesium|rutf|ifa\b/i;
const withDrugs = [...new Set(tasks.map(t => t.actionNeeded))].filter(a => DOSE.test(a));
check('no suggested action names a medicine or a dose', withDrugs.length === 0, withDrugs.join(' | '));

console.log(failures === 0 ? '\nAll follow-up checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
