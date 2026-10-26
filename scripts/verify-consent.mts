/**
 * Data notice and consent (DPDP Act 2023) — `npm run verify:consent`
 *
 *   1. RULES     a basis must be chosen; under 18 needs a parent or guardian,
 *                named, with the relationship; an emergency is always allowed
 *                at registration and never when completing a pending one
 *   2. RECORD    what is stored: basis, language, notice version, who, when;
 *                an emergency is pending and keeps its time once completed
 *   3. STATUS    recorded / pending / not recorded (records made before)
 *   4. NOTICE    the same five points in English, Hindi and Marathi, each
 *                naming the Data Protection Board; problems in all three
 *   5. LATER     consent recorded on an existing record is a newer version than
 *                the copy other devices hold, and keeps the registration time
 */

const { consentProblems, buildConsent, emergencyConsent, consentStatus, NOTICE, NOTICE_VERSION, EMPTY_CONSENT, ADULT_AGE } = await import('../lib/consent/dataConsent');
const { isNewerPatient, patientVersion, stampChange } = await import('../lib/sync/patientVersion');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const staff = { staffId: 'ANM-PEM-1021', name: 'Test ANM' };
const at = new Date('2026-10-26T09:00:00.000Z');
const later = new Date('2026-10-27T11:30:00.000Z');

console.log('\n1. RULES');
check('no basis chosen is a problem', consentProblems(EMPTY_CONSENT, 30).length === 1);
check('an adult who consents is accepted', consentProblems({ ...EMPTY_CONSENT, basis: 'CONSENT' }, 30).length === 0);
check(`a patient under ${ADULT_AGE} cannot give their own consent`, consentProblems({ ...EMPTY_CONSENT, basis: 'CONSENT' }, 17).length === 1);
check('…a parent or guardian, named with the relationship, can', consentProblems({ ...EMPTY_CONSENT, basis: 'GUARDIAN_CONSENT', guardianName: 'Sunita Rahane', guardianRelation: 'Mother' }, 9).length === 0);
const missingGuardian = consentProblems({ ...EMPTY_CONSENT, basis: 'GUARDIAN_CONSENT', guardianName: ' ', guardianRelation: '' }, 9);
check('guardian consent with no name and no relationship lists both', missingGuardian.length === 2, JSON.stringify(missingGuardian));
check('a medical emergency is always allowed at registration — even for a child, even with no age', consentProblems({ ...EMPTY_CONSENT, basis: 'MEDICAL_EMERGENCY' }, 4).length === 0 && consentProblems({ ...EMPTY_CONSENT, basis: 'MEDICAL_EMERGENCY' }, undefined).length === 0);
check('…but cannot be chosen again when completing a pending emergency', consentProblems({ ...EMPTY_CONSENT, basis: 'MEDICAL_EMERGENCY' }, 40, false).length === 1);
check('an unknown age does not block an adult consent (the age check is on the form)', consentProblems({ ...EMPTY_CONSENT, basis: 'CONSENT' }, undefined).length === 0);

console.log('\n2. RECORD');
const consent = buildConsent({ ...EMPTY_CONSENT, basis: 'CONSENT', language: 'mr' }, staff, at);
check('consent: not pending, the notice language, version, who and when', consent.pending === false && consent.noticeLanguage === 'mr' && consent.noticeVersion === NOTICE_VERSION
    && consent.recordedBy === staff.staffId && consent.recordedByName === staff.name && consent.recordedAt === at.toISOString(), JSON.stringify(consent));
const guardian = buildConsent({ ...EMPTY_CONSENT, basis: 'GUARDIAN_CONSENT', language: 'hi', guardianName: '  Sunita Rahane ', guardianRelation: ' Mother ' }, staff, at);
check('guardian consent stores the guardian, trimmed', guardian.guardianName === 'Sunita Rahane' && guardian.guardianRelation === 'Mother' && guardian.noticeLanguage === 'hi');
check('patient consent stores no guardian', consent.guardianName === undefined && consent.guardianRelation === undefined);
const emergency = emergencyConsent(staff, at);
check('an emergency registration is pending, with no notice language yet, and records when', emergency.basis === 'MEDICAL_EMERGENCY' && emergency.pending && emergency.noticeLanguage === undefined && emergency.emergencyAt === at.toISOString());
const completed = buildConsent({ ...EMPTY_CONSENT, basis: 'CONSENT', language: 'en' }, staff, later, emergency);
check('completing it records the consent now and keeps when the emergency was', completed.pending === false && completed.basis === 'CONSENT' && completed.recordedAt === later.toISOString() && completed.emergencyAt === at.toISOString(), JSON.stringify(completed));
let threw = false;
try { buildConsent(EMPTY_CONSENT, staff, at); } catch { threw = true; }
check('nothing is built from a draft with no basis', threw);

console.log('\n3. STATUS');
check('recorded', consentStatus({ dataConsent: consent }) === 'RECORDED');
check('pending', consentStatus({ dataConsent: emergency }) === 'PENDING');
check('not recorded — a record made before this step', consentStatus({}) === 'NOT_RECORDED');

console.log('\n4. NOTICE');
for (const lang of ['en', 'hi', 'mr'] as const) {
    const n = NOTICE[lang];
    check(`${lang}: a title and five points, none empty`, n.title.trim().length > 0 && n.points.length === 5 && n.points.every(p => p.trim().length > 20), `${n.points.length}`);
    check(`${lang}: names the Data Protection Board`, n.points.some(p => p.includes('Data Protection Board')));
}
check('Hindi and Marathi are not the English text', NOTICE.hi.points[0] !== NOTICE.en.points[0] && NOTICE.mr.points[0] !== NOTICE.en.points[0] && NOTICE.hi.points[0] !== NOTICE.mr.points[0]);
const hi = consentProblems(EMPTY_CONSENT, 30, true, 'hi')[0];
const mr = consentProblems(EMPTY_CONSENT, 30, true, 'mr')[0];
const en = consentProblems(EMPTY_CONSENT, 30, true, 'en')[0];
check('problems come in the screen’s language', Boolean(hi && mr && en) && hi !== en && mr !== en && hi !== mr);

console.log('\n5. LATER');
const registered = { id: 'p1', timestamp: at.toISOString(), name: 'Test' };
const heldElsewhere = { ...registered };
const edited = stampChange({ ...registered, dataConsent: completed }, later);
check('the edit keeps the registration time', edited.timestamp === registered.timestamp);
check('…and is newer than the copy another device holds', isNewerPatient(edited, heldElsewhere));
check('…while the older copy is not newer than the edit', !isNewerPatient(heldElsewhere, edited));
check('a replay of the same copy is ignored', !isNewerPatient(edited, { ...edited }));
check('a record from an older build is versioned by its registration time', patientVersion(registered) === at.getTime());
check('a record with no usable time is version 0, so any real copy replaces it', patientVersion({ timestamp: 'not a date' }) === 0 && isNewerPatient(registered, { timestamp: 'not a date' }));

console.log(failures === 0 ? '\nAll consent checks passed.\n' : `\n${failures} consent check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
