/**
 * Capacity-check regression check — `npm run verify:capacity`
 *
 * Acceptance is decided against these numbers, so each is pinned:
 *
 *   1. REQUIREMENTS  the referral asks for the right ward, equipment and
 *                    specialist — and "blood pressure" is not a blood bank.
 *   2. ARITHMETIC    available = total − occupied − maintenance − reserved,
 *                    with maintenance and holds derived, never stored.
 *   3. THREE STATES  an unreported facility is UNKNOWN, never green.
 *   4. ALTERNATIVES  suggestions exclude the sender, the decliner and Sub
 *                    Centres; full matches first, nearest first.
 *   5. SEED          the seeded district is internally consistent.
 */

const { requirementsFor } = await import('../lib/capacity/requirements');
const A = await import('../lib/capacity/availability');
const { SEED_RESOURCES, SEED_MAINTENANCE } = await import('../lib/data/resources');
const { SEED_REFERRALS } = await import('../lib/data/referralSeed');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const req = (reason: string, priority: any = 'URGENT', extra: Record<string, unknown> = {}) => requirementsFor({ reason, priority, ...extra });
const eq = (r: any) => r.equipment.map((e: any) => e.kind).sort().join(',');
const sp = (r: any) => r.specialists.map((s: any) => s.specialty).sort().join(',');

// ---------------------------------------------------------------------------
console.log('\n1. REQUIREMENTS');
// ---------------------------------------------------------------------------
const pe = req('Severe gestational hypertension at 32 weeks, headache', 'EMERGENCY');
check('obstetric emergency → maternity bed, obstetrician, blood bank', pe.bed?.ward === 'MATERNITY' && sp(pe) === 'OBSTETRICS' && eq(pe).includes('BLOOD_BANK'), `${pe.bed?.ward} ${eq(pe)} ${sp(pe)}`);
const sam = req('SAM child with fast breathing', 'EMERGENCY', { patientAge: 1.5, vitals: { spo2: 91, heartRate: 138, injuryType: '' } });
check('sick child → paediatric bed, paediatrician, oxygen', sam.bed?.ward === 'PEDIATRIC' && sp(sam).includes('PAEDIATRICS') && eq(sam).includes('OXYGEN'), `${sam.bed?.ward} ${eq(sam)}`);
const hypoxic = req('Community acquired pneumonia', 'EMERGENCY', { patientAge: 60, vitals: { spo2: 86, heartRate: 120, injuryType: '' } });
check('adult with SpO2 86% → ICU and ventilator', hypoxic.bed?.ward === 'ICU' && eq(hypoxic).includes('VENTILATOR'));
const bp = req('Hypertension, blood pressure 170/100, blood sugar 240', 'URGENT');
check('"blood pressure" / "blood sugar" do not demand a blood bank', !eq(bp).includes('BLOOD_BANK'), eq(bp));
const foot = req('Diabetic foot ulcer needing surgical debridement and X-ray');
check('surgical case asking for an X-ray → general bed, surgeon, X-ray', foot.bed?.ward === 'GENERAL' && sp(foot) === 'GENERAL_SURGERY' && eq(foot) === 'XRAY');
const tb = req('Follow-up sputum CBNAAT test for pulmonary TB', 'ROUTINE');
check('routine test referral needs no bed', tb.bed === null);
const frac = req('Road traffic accident — closed fracture right tibia', 'EMERGENCY');
check('fracture → emergency bed, X-ray, orthopaedics', frac.bed?.ward === 'EMERGENCY' && eq(frac) === 'XRAY' && sp(frac) === 'ORTHOPAEDICS');
const age = req('Acute gastroenteritis with severe dehydration', 'EMERGENCY');
check('an unspecific Emergency still asks for an emergency bed and an admitting clinician', age.bed?.ward === 'EMERGENCY' && sp(age) === 'GENERAL_MEDICINE');
check('every requirement explains itself', [pe, sam, hypoxic, foot, frac].every(r => [...r.equipment, ...r.specialists].every((x: any) => x.reason.length > 0)));

// ---------------------------------------------------------------------------
console.log('\n2. ARITHMETIC');
// ---------------------------------------------------------------------------
const NOW = Date.parse('2026-09-23T10:00:00Z');
const res: any = {
    facilityId: 'f1',
    wards: [{ ward: 'GENERAL', total: 10, occupied: 5 }, { ward: 'ICU', total: 2, occupied: 2 }],
    equipment: [{ kind: 'VENTILATOR', units: 3 }, { kind: 'XRAY', units: 1 }],
    shift: 'MORNING',
    staffOnDuty: [{ specialty: 'GENERAL_MEDICINE', count: 1 }],
    updatedAt: '', updatedBy: '',
};
const ticket = (id: string, target: any, units: number, severity: any, status: any = 'OPEN'): any =>
    ({ id, facilityId: 'f1', target, units, severity, status, description: '', reportedAt: '', reportedBy: '' });
const tickets = [
    ticket('t1', { kind: 'BEDS', ward: 'GENERAL' }, 2, 'UNDER_MAINTENANCE'),
    ticket('t2', { kind: 'EQUIPMENT', equipment: 'VENTILATOR' }, 1, 'OUT_OF_ORDER'),
    ticket('t3', { kind: 'EQUIPMENT', equipment: 'XRAY' }, 1, 'UNDER_MAINTENANCE'),
    ticket('t4', { kind: 'BEDS', ward: 'GENERAL' }, 3, 'UNDER_MAINTENANCE', 'RESOLVED'),
];
const hold = (id: string, status: any, expiresInMin: number): any => ({
    id, status, reservation: { facilityId: 'f1', ward: 'GENERAL', state: 'HELD', reservedAt: '', expiresAt: new Date(NOW + expiresInMin * 60_000).toISOString(), label: '', handoverInstructions: '' },
});
const refs = [hold('r1', 'ACCEPTED', 30), hold('r2', 'ACCEPTED', -1), hold('r3', 'PATIENT_ARRIVED', -60), hold('r4', 'REJECTED', 30)];
const av = A.availabilityFor('f1', res, tickets, refs, NOW);
const g = av.wards.GENERAL!;
check('general: 10 − 5 occupied − 2 maintenance − 2 held = 1', g.available === 1 && g.maintenance === 2 && g.reserved === 2, JSON.stringify(g));
check('a resolved ticket no longer removes beds', g.maintenance === 2);
check('an expired hold is free again; an arrived patient\'s hold is not', g.reserved === 2);
check('a full ward reads 0 free, not negative', av.wards.ICU!.available === 0 && av.wards.ICU!.overBy === 0);
check('ventilators: 3 held, 1 out of order → 2 working', av.equipment.VENTILATOR!.working === 2 && av.equipment.VENTILATOR!.status === 'WORKING');
check('X-ray with its only unit in maintenance reads UNDER_MAINTENANCE', av.equipment.XRAY!.working === 0 && av.equipment.XRAY!.status === 'UNDER_MAINTENANCE');
const resolvedAll = A.availabilityFor('f1', res, tickets.map(t => ({ ...t, status: 'RESOLVED' })), [], NOW);
check('resolving every ticket returns all the capacity', resolvedAll.wards.GENERAL!.available === 5 && resolvedAll.equipment.XRAY!.working === 1);
const over = A.availabilityFor('f1', { ...res, wards: [{ ward: 'GENERAL', total: 2, occupied: 3 }] }, [], [], NOW);
check('admitting past capacity is shown as over, not hidden', over.wards.GENERAL!.available === 0 && over.wards.GENERAL!.overBy === 1);

// ---------------------------------------------------------------------------
console.log('\n3. THREE STATES');
// ---------------------------------------------------------------------------
const unreported = A.availabilityFor('nowhere', undefined, [], [], NOW);
const unk = A.capacityCheck(pe, unreported);
check('an unreported facility is UNKNOWN on every line', unk.overall === 'UNKNOWN' && unk.items.every(i => i.state === 'UNKNOWN'));
check('...and never offers a bed', unk.bedAvailable === false);
const xr = A.capacityCheck(foot, av);
check('X-ray down → the check is SHORT, and says why', xr.overall === 'SHORT' && xr.items.find(i => i.kind === 'EQUIPMENT')!.available.includes('maintenance'));
const phc = A.availabilityFor('phc', { ...res, facilityId: 'phc', wards: [{ ward: 'GENERAL', total: 6, occupied: 3 }], equipment: [] }, [], [], NOW);
check('a PHC with no emergency ward takes an emergency into general beds', A.capacityCheck(age, phc).bedWard === 'GENERAL' && A.capacityCheck(age, phc).bedAvailable);
check('...but a maternity case does not fall back to general beds', A.capacityCheck(pe, phc).bedAvailable === false);

// ---------------------------------------------------------------------------
console.log('\n4. ALTERNATIVES');
// ---------------------------------------------------------------------------
const byId = (id: string) => A.availabilityFor(id, SEED_RESOURCES.find(r => r.facilityId === id), SEED_MAINTENANCE, SEED_REFERRALS, Date.now());
const origin = FACILITY_NETWORK.find(f => f.id === 'phc-perimili')!;
const alts = A.suggestAlternatives(frac, origin, FACILITY_NETWORK, byId, ['chc-etapalli']);
check('never suggests a Sub Centre, the sender, or the facility that declined', alts.every(a => a.facility.type !== 'SC' && a.facility.id !== origin.id && a.facility.id !== 'chc-etapalli'));
check('facilities meeting every need come first', alts.findIndex(a => a.check.overall !== 'OK') === -1 || alts.slice(alts.findIndex(a => a.check.overall !== 'OK')).every(a => a.check.overall !== 'OK'));
const oks = alts.filter(a => a.check.overall === 'OK');
check('among full matches, nearest first', oks.every((a, i) => i === 0 || oks[i - 1].distanceKm <= a.distanceKm));
check('the rejected fracture case has somewhere to go (SDH or DH)', oks.some(a => a.facility.id === 'sdh-aheri' || a.facility.id === 'dh-district'), alts.map(a => `${a.facility.id}:${a.check.overall}`).join(' '));

// ---------------------------------------------------------------------------
console.log('\n5. SEED');
// ---------------------------------------------------------------------------
const receiving = FACILITY_NETWORK.filter(f => f.type !== 'SC');
check('every facility that receives referrals reports resources', receiving.every(f => SEED_RESOURCES.some(r => r.facilityId === f.id)));
check('ward totals match the bed totals in the facility directory', SEED_RESOURCES.every(r => {
    const f = FACILITY_NETWORK.find(x => x.id === r.facilityId)!;
    return r.wards.reduce((s, w) => s + w.total, 0) === f.beds.total;
}), SEED_RESOURCES.map(r => `${r.facilityId}:${r.wards.reduce((s, w) => s + w.total, 0)}`).join(' '));
check('no seeded ward starts over capacity', SEED_RESOURCES.every(r => Object.values(byId(r.facilityId).wards).every(w => w!.overBy === 0)));
check('every seeded hold names a ward the facility has', SEED_REFERRALS.filter(r => r.reservation).every(r => {
    const res = SEED_RESOURCES.find(x => x.facilityId === r.reservation!.facilityId);
    return Boolean(res?.wards.some(w => w.ward === r.reservation!.ward));
}));
check('every maintenance ticket targets something the facility holds', SEED_MAINTENANCE.every(t => {
    const res = SEED_RESOURCES.find(x => x.facilityId === t.facilityId);
    return Boolean(res && (t.target.kind === 'BEDS' ? res.wards.some(w => w.ward === (t.target as any).ward) : res.equipment.some(e => e.kind === (t.target as any).equipment)));
}));
check('the seeded CHC X-ray outage shows up in its availability', byId('chc-etapalli').equipment.XRAY?.working === 0);

console.log(failures === 0 ? '\nAll capacity checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
