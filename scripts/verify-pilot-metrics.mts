/**
 * Clinician triage review and pilot measures — `npm run verify:pilot-metrics`
 *
 *   1. AGREEMENT  tool vs clinician: agree, under (tool lower), over (tool higher)
 *   2. RAISE ONLY a more urgent clinician raises the record's urgency; a less
 *                 urgent one is kept for the study and lowers nothing
 *   3. SUMMARY    counts, under/over-triage, RED caught, the 3x3 table, and
 *                 referral times as medians of recorded times only
 *   4. SCOPE      facility and date limits
 *   5. EXPORT     one row per review; no name, ID, phone, ABHA, village or exact
 *                 age; the referral raised for it linked by time; dated in IST;
 *                 a synced value cannot become a spreadsheet formula
 *   6. ROBUST     a malformed review from another device is left out, not fatal
 *   7. MERGE      the district store and this device: one copy each, the newer
 */

import type { Patient, ReferralRecord, TriageStatus } from '../types/patient';
const { agreement, applyReview } = await import('../lib/pilot/triageReview');
const { pilotSummary, pilotCsv, median, minutesBetween, ageBand, PILOT_CSV_COLUMNS, istDate, mergeRecords } = await import('../lib/pilot/metrics');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const T0 = Date.parse('2026-11-02T09:00:00.000Z');
const iso = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();
const patient = (id: string, status: TriageStatus, extra: Partial<Patient> = {}): Patient => ({
    id, name: `Secret Name ${id}`, age: 27, gender: 'F', phone: '9876543210', abhaId: '91-1234-5678-9012', village: 'Secretvillage',
    tehsil: 'Sangamner', district: 'Ahilyanagar', vitals: { spo2: 95, heartRate: 90, injuryType: 'test' },
    triageStatus: status, triagePriority: status === 'RED' ? 'EMERGENCY' : status === 'YELLOW' ? 'URGENT' : 'ROUTINE',
    gps: { lat: 0, lng: 0 }, isSynced: true, timestamp: iso(0), registeredAtFacilityId: 'sc-kothi', ...extra,
});
const review = (tool: TriageStatus, clinician: TriageStatus, minutes = 5, facilityId = 'sc-kothi') => ({
    at: iso(minutes), facilityId, tool, decisionSource: 'NEURAL_NETWORK' as const, clinician,
    reviewerId: 'MO-1', reviewerRole: 'MO' as const, reviewerName: 'Secret Doctor',
});

console.log('\n1. AGREEMENT');
check('same level agrees', agreement('RED', 'RED') === 'AGREE' && agreement('GREEN', 'GREEN') === 'AGREE');
check('tool lower than the clinician is under-triage', agreement('YELLOW', 'RED') === 'UNDER' && agreement('GREEN', 'YELLOW') === 'UNDER' && agreement('GREEN', 'RED') === 'UNDER');
check('tool higher is over-triage', agreement('RED', 'GREEN') === 'OVER' && agreement('YELLOW', 'GREEN') === 'OVER');

console.log('\n2. RAISE ONLY');
const raised = applyReview(patient('p1', 'YELLOW'), review('YELLOW', 'RED'));
check('a clinician RED raises a YELLOW record to RED / EMERGENCY', raised.triageStatus === 'RED' && raised.triagePriority === 'EMERGENCY');
check('…keeps the review and marks the record for upload', raised.triageReviews?.length === 1 && raised.isSynced === false);
const kept = applyReview(patient('p2', 'RED'), review('RED', 'GREEN'));
check('a clinician GREEN on a RED record is recorded but does not lower it', kept.triageStatus === 'RED' && kept.triagePriority === 'EMERGENCY' && kept.triageReviews?.[0].clinician === 'GREEN');
const twice = applyReview(kept, review('RED', 'RED', 30));
check('a second review is added, not replacing the first', twice.triageReviews?.length === 2);

console.log('\n3. SUMMARY');
const referral = (id: string, patientId: string, minutes: number, extra: Partial<ReferralRecord> = {}): ReferralRecord => ({
    id, patientId, patientName: 'x', patientAge: 27, patientGender: 'F', fromFacilityId: 'sc-kothi', fromFacilityName: 'x', fromFacilityType: 'SC',
    toFacilityId: 'phc-bhamragad', toFacilityName: 'y', toFacilityType: 'PHC', reason: 'r', priority: 'EMERGENCY', status: 'SENT', referredBy: 'ANM',
    referredAt: iso(minutes), updatedAt: iso(minutes), transportMode: 'AMBULANCE_108', timeline: [], comments: [], ...extra,
});
const patients = [
    applyReview(patient('a', 'RED'), review('RED', 'RED')),          // agree, RED caught
    applyReview(patient('b', 'YELLOW'), review('YELLOW', 'RED')),    // under, RED missed
    applyReview(patient('c', 'RED'), review('RED', 'YELLOW')),       // over
    applyReview(patient('d', 'GREEN'), review('GREEN', 'GREEN')),    // agree
    patient('e', 'GREEN'),                                           // never reviewed
];
const referrals = [
    referral('r-a', 'a', 1, { acknowledgedAt: iso(4), arrivedAt: iso(61), admittedAt: iso(70) }),
    referral('r-b', 'b', 2, { acknowledgedAt: iso(12), escalation: { level: 1, firstAt: iso(12), lastAt: iso(12), sendEventId: 's' } }),
    referral('r-c', 'c', 3, { acknowledgedAt: iso(2) }),             // acknowledged before sent: clock error, ignored
    referral('r-x', 'zz', 0),                                         // never acknowledged
];
const s = pilotSummary(patients, referrals);
check('four reviews; two agree, one under, one over', s.reviews === 4 && s.agree === 2 && s.under === 1 && s.over === 1, JSON.stringify(s));
check('RED caught: one of the two the clinician rated RED', s.clinicianRed === 2 && s.toolRedOfClinicianRed === 1);
check('the table puts each review in its tool/clinician cell', s.matrix.YELLOW.RED === 1 && s.matrix.RED.YELLOW === 1 && s.matrix.RED.RED === 1 && s.matrix.GREEN.GREEN === 1);
check('referral times use recorded times only (a time before the referral is ignored); median of 3 and 10 min rounds to 7', s.referrals === 4 && s.acknowledged === 2 && s.medianMinutesToAcknowledge === 7 && s.arrived === 1 && s.medianMinutesToArrival === 60, JSON.stringify(s));
check('escalations are counted', s.escalated === 1);
check('the time recorded before its referral is counted as a clock error', s.clockErrors === 1, `${s.clockErrors}`);
const empty = pilotSummary([], []);
check('with no records every time is not recorded, not zero', empty.reviews === 0 && empty.medianMinutesToAcknowledge === null && empty.medianMinutesToArrival === null);
check('median of an even count is the middle pair’s mean', median([3, 1, 10, 6]) === 5 && median([7]) === 7 && median([]) === null);
check('minutesBetween refuses a missing or reversed pair', minutesBetween(iso(5), iso(1)) === null && minutesBetween(undefined, iso(1)) === null && minutesBetween(iso(0), iso(15)) === 15);

console.log('\n4. SCOPE');
const other = applyReview(patient('f', 'GREEN', { registeredAtFacilityId: 'sc-govindpur' }), review('GREEN', 'RED', 5, 'sc-govindpur'));
const scoped = pilotSummary([...patients, other], referrals, { facilityIds: new Set(['sc-kothi']) });
check('a facility scope leaves other facilities out', scoped.reviews === 4 && scoped.under === 1);
const dated = pilotSummary(patients, referrals, { from: new Date(T0 + 60 * 60_000) });
check('a date scope leaves earlier reviews and referrals out', dated.reviews === 0 && dated.referrals === 0);

console.log('\n5. EXPORT');
const csv = pilotCsv(patients, referrals);
const lines = csv.trim().split('\n');
check('a header and one row per review', lines[0] === PILOT_CSV_COLUMNS.join(',') && lines.length === 5, `${lines.length}`);
check('no name, staff name, phone, ABHA number, village or patient id', !/Secret|9876543210|91-1234|Secretvillage/.test(csv) && !lines.slice(1).some(l => /,a,|,b,/.test(l)));
check('ages are bands, not years', lines.slice(1).every(l => l.split(',')[3] === '18-34') && ageBand(4) === '0-4' && ageBand(17) === '5-17' && ageBand(65) === '65+');
const rowA = lines.find(l => l.includes(',RED,NEURAL_NETWORK,RED,AGREE,'))?.split(',') ?? [];
const col = (name: (typeof PILOT_CSV_COLUMNS)[number]) => rowA[PILOT_CSV_COLUMNS.indexOf(name)];
check('the referral raised for a review is linked: minutes to acknowledge and arrive, admitted', col('referred') === 'Y' && col('minutes_to_acknowledge') === '3' && col('minutes_to_arrival') === '60' && col('admitted') === 'Y', rowA.join(','));
const rowD = lines.find(l => l.includes(',GREEN,NEURAL_NETWORK,GREEN,AGREE,'))?.split(',') ?? [];
check('a review with no referral says so and leaves the times blank', rowD[PILOT_CSV_COLUMNS.indexOf('referred')] === 'N' && rowD[PILOT_CSV_COLUMNS.indexOf('minutes_to_arrival')] === '');

check('the review date is the date in India, not UTC (20:00 UTC is the next morning in IST)', istDate('2026-11-02T20:00:00.000Z') === '2026-11-03' && istDate('2026-11-02T10:00:00.000Z') === '2026-11-02');
const sly = applyReview(patient('s', 'GREEN', { gender: '=HYPERLINK("http://x")' as unknown as 'F' }), { ...review('GREEN', 'GREEN'), facilityId: '+cmd', reviewerRole: '@SUM' as unknown as 'MO' });
const slyCsv = pilotCsv([sly], []);
check('a synced value that a spreadsheet would run as a formula is neutralised', !/(^|,)"?[=+@]/m.test(slyCsv.split('\n').slice(1).join('\n')) && slyCsv.includes("'+cmd") && slyCsv.includes("'@SUM"), slyCsv);

console.log('\n6. ROBUST');
const broken = { ...patient('x', 'GREEN'), triageReviews: [{ ...review('GREEN', 'GREEN'), clinician: 'PURPLE' }, null, { at: 5 }, review('YELLOW', 'RED')] } as unknown as Patient;
let summary: ReturnType<typeof pilotSummary> | null = null;
try { summary = pilotSummary([broken], []); } catch (e) { summary = null; console.log(String(e)); }
check('malformed reviews are left out and the well-formed one counted', summary?.reviews === 1 && summary?.under === 1, JSON.stringify(summary));
check('…and the export still works', pilotCsv([broken], []).trim().split('\n').length === 2);

console.log('\n7. MERGE');
const onDevice = { ...patient('m', 'GREEN'), updatedAt: iso(30), notes: 'device' };
const inDistrict = { ...patient('m', 'GREEN'), updatedAt: iso(10), notes: 'district' };
const onlyDistrict = applyReview(patient('n', 'YELLOW'), review('YELLOW', 'YELLOW'));
const merged = mergeRecords({ patients: [onDevice], referrals: [referral('rr', 'm', 0, { updatedAt: iso(5) })] },
    { patients: [inDistrict, onlyDistrict], referrals: [referral('rr', 'm', 0, { updatedAt: iso(9), acknowledgedAt: iso(3) }), referral('rd', 'n', 0)] });
check('one copy per patient, the newer — here the device\'s', merged.patients.length === 2 && merged.patients.find(p => p.id === 'm')?.notes === 'device');
check('a record only the district holds is included', merged.patients.some(p => p.id === 'n'));
check('one copy per referral, the one changed last — here the district\'s', merged.referrals.length === 2 && merged.referrals.find(r => r.id === 'rr')?.acknowledgedAt === iso(3));
check('junk without an id is ignored', mergeRecords({ patients: [null as unknown as Patient], referrals: [] }, { patients: [], referrals: [{} as ReferralRecord] }).patients.length === 0);

console.log(failures === 0 ? '\nAll pilot measure checks passed.\n' : `\n${failures} pilot measure check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
