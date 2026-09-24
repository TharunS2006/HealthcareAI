/**
 * Referral lifecycle regression check — `npm run verify:referral-flow`
 *
 * Pins what must hold for a referral between facilities, because a clinician
 * acts on every one of these states:
 *
 *   1. LIFECYCLE   CREATED → SENT → DELIVERED → ACKNOWLEDGED → ACCEPTED →
 *                  PATIENT_ARRIVED → ADMITTED → DISCHARGED, one timeline event
 *                  per step, each with who and when, statuses chained.
 *   2. WHO MAY     only the receiving facility answers; only the sender
 *                  re-routes; DHO and Super Admin hold no clinical action;
 *                  nothing can skip a state.
 *   3. REJECTION   needs a reason; re-routing starts a fresh delivery and the
 *                  declining facility keeps sight of the patient.
 *   4. CAPACITY    accepting needs a held bed or an override on the record;
 *                  admission and discharge move bed counts exactly once.
 *   5. NOTIFY      the right people hear each change, nobody else, and the
 *                  same event from two devices is one notification.
 *   6. CLOCK       an unanswered Emergency escalates to the DHO at the
 *                  threshold (not before), idempotently; a held bed is
 *                  released when the patient does not come.
 *   7. SYNC        merging two copies keeps every comment and event.
 *   8. RELAY       a forged event is refused by the same rules.
 *   9. SEED        every seeded referral is a legal history.
 */

const wf = await import('../lib/referrals/workflow');
const { SEED_USERS } = await import('../lib/auth/users');
const { REFERRAL_TIMING } = await import('../lib/referrals/config');
const { SEED_REFERRALS, SEED_NOTIFICATIONS } = await import('../lib/data/referralSeed');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const user = (id: string) => SEED_USERS.find(u => u.id === id)!;
const actor = (id: string) => wf.actorFromUser(user(id), user(id).facilityId ?? undefined);
const fac = (id: string) => {
    const f = FACILITY_NETWORK.find(x => x.id === id)!;
    return { id: f.id, name: f.name, type: f.type };
};

const T0 = Date.parse('2026-09-23T10:00:00.000Z');
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
let seq = 0;
const eid = () => `e${++seq}`;

function mustOk<T extends { ok: boolean }>(r: T, label: string): Extract<T, { ok: true }> {
    if (!r.ok) throw new Error(`${label}: ${(r as unknown as { message: string }).message}`);
    return r as Extract<T, { ok: true }>;
}

function newReferral(priority: 'EMERGENCY' | 'URGENT' | 'ROUTINE' = 'EMERGENCY', reason = 'Acute gastroenteritis with severe dehydration — IV fluids') {
    return mustOk(wf.createReferral({
        id: `ref-t-${++seq}`,
        eventId: eid(),
        at: at(0),
        patient: { id: 'p-t', name: 'Test Patient', age: 45, gender: 'M' },
        from: fac('sc-kothi'),
        to: fac('phc-bhamragad'),
        reason,
        priority,
        transportMode: 'AMBULANCE_108',
    }, actor('u-anm-kothi')), 'create').referral;
}

const act = (ref: any, action: any, by: string | 'system', min: number, extra: Record<string, unknown> = {}) =>
    wf.applyAction(ref, { action, actor: by === 'system' ? wf.SYSTEM_ACTOR : actor(by), at: at(min), eventId: eid(), ...extra });

const reservation = { ward: 'GENERAL' as const, label: 'General ward bed', handoverInstructions: 'PHC ward, bed 3' };

// ---------------------------------------------------------------------------
console.log('\n1. LIFECYCLE');
// ---------------------------------------------------------------------------
let r = newReferral();
check('a new referral starts CREATED with one CREATE event', r.status === 'CREATED' && r.timeline.length === 1 && r.timeline[0].action === 'CREATE');

const steps: Array<[string, string, number, Record<string, unknown>?]> = [
    ['SEND', 'u-anm-kothi', 0, { sentVia: 'RELAY' }],
    ['OPEN', 'u-mo-bhamragad', 2],
    ['ACKNOWLEDGE', 'u-mo-bhamragad', 3],
    ['ACCEPT', 'u-mo-bhamragad', 4, { reservation }],
    ['DISPATCH', 'u-anm-kothi', 5, { dispatch: { vehicleNo: 'AMB-1', etaMinutes: 30 } }],
    ['MARK_ARRIVED', 'u-mo-bhamragad', 40],
    ['ADMIT', 'u-mo-bhamragad', 42],
    ['DISCHARGE', 'u-mo-bhamragad', 600],
];
const expected = ['SENT', 'DELIVERED', 'ACKNOWLEDGED', 'ACCEPTED', 'ACCEPTED', 'PATIENT_ARRIVED', 'ADMITTED', 'DISCHARGED'];
const deltas: any[] = [];
steps.forEach(([action, by, min, extra], i) => {
    const res = act(r, action, by, min, extra);
    check(`${action} by ${user(by).role} → ${expected[i]}`, res.ok && res.referral.status === expected[i], res.ok ? res.referral.status : res.message);
    if (res.ok) { r = res.referral; if (res.resourceDelta) deltas.push(res.resourceDelta); }
});
check('one timeline event per step', r.timeline.length === steps.length + 1, `${r.timeline.length}`);
check('every event names the user and the time', r.timeline.every(e => e.actor.name && !Number.isNaN(Date.parse(e.at))));
check('statuses chain with no gaps', r.timeline.every((e, i) => i === 0 || e.fromStatus === r.timeline[i - 1].toStatus));
check('deliveredAt stamped when the receiver opened it', r.deliveredAt === at(2));
check('dispatch recorded vehicle and ETA', r.ambulanceVehicleNo === 'AMB-1' && r.etaMinutes === 30 && r.inTransitAt === at(5));
check('admission and discharge each move one bed, in the same ward',
    deltas.length === 2 && deltas[0].occupied === 1 && deltas[1].occupied === -1 && deltas[0].ward === deltas[1].ward && deltas[0].facilityId === 'phc-bhamragad',
    JSON.stringify(deltas));
check('the held bed became occupied on admission, then released on discharge', r.reservation?.state === 'RELEASED' && r.reservation?.releaseReason === 'DISCHARGED');

// ---------------------------------------------------------------------------
console.log('\n2. WHO MAY');
// ---------------------------------------------------------------------------
let d = newReferral();
d = mustOk(act(d, 'SEND', 'u-anm-kothi', 0), 'send').referral;
check('the receiver cannot accept before opening (SENT → ACCEPTED refused)', act(d, 'ACCEPT', 'u-mo-bhamragad', 1, { reservation }).ok === false);
check('the receiver cannot see a referral still CREATED on the sender device',
    !wf.canViewReferral({ role: 'MO', facilityId: 'phc-bhamragad' }, newReferral()));
d = mustOk(act(d, 'OPEN', 'u-mo-bhamragad', 1), 'open').referral;
const denied = (by: string, action = 'ACCEPT') => {
    const res = act(d, action, by, 2, { reservation });
    return res.ok ? 'ALLOWED' : res.code;
};
check('ANM cannot accept her own referral', denied('u-anm-kothi') === 'FORBIDDEN', denied('u-anm-kothi'));
check('an MO at a different PHC cannot accept it', denied('u-mo-perimili') === 'WRONG_FACILITY', denied('u-mo-perimili'));
check('a Specialist cannot accept', denied('u-sp-chc') === 'FORBIDDEN');
check('the DHO cannot accept', denied('u-dho') === 'FORBIDDEN');
check('Super Admin cannot accept', denied('u-sa') === 'FORBIDDEN');
check('nobody can escalate to the DHO by hand', denied('u-mo-bhamragad', 'EMERGENCY_ESCALATION') === 'FORBIDDEN');
check('cannot admit a patient who has not arrived', denied('u-mo-bhamragad', 'ADMIT') === 'ILLEGAL_TRANSITION');
check('buttons offered to the receiving MO after opening are Acknowledge / Accept / Reject',
    JSON.stringify(wf.availableActions(actor('u-mo-bhamragad'), d, T0)) === JSON.stringify(['ACKNOWLEDGE', 'ACCEPT', 'REJECT']),
    JSON.stringify(wf.availableActions(actor('u-mo-bhamragad'), d, T0)));
check('the sender is offered nothing while awaiting an answer', wf.availableActions(actor('u-anm-kothi'), d, T0).length === 0);
check('the DHO is offered nothing', wf.availableActions(actor('u-dho'), d, T0).length === 0);

// ---------------------------------------------------------------------------
console.log('\n3. REJECTION & RE-ROUTING');
// ---------------------------------------------------------------------------
check('rejecting without a reason is refused', act(d, 'REJECT', 'u-mo-bhamragad', 2).ok === false);
check('"Other" without a description is refused', act(d, 'REJECT', 'u-mo-bhamragad', 2, { reject: { code: 'OTHER' } }).ok === false);
const rej = mustOk(act(d, 'REJECT', 'u-mo-bhamragad', 2, { reject: { code: 'NO_BED' } }), 'reject').referral;
check('REJECTED carries the reason and who rejected', rej.status === 'REJECTED' && rej.rejection?.code === 'NO_BED' && rej.rejection.byName === 'Dr. Suresh Atram');
check('the receiver cannot re-route; only the sender can', act(rej, 'REROUTE', 'u-mo-bhamragad', 3, { reroute: fac('phc-perimili') }).ok === false);
check('re-routing back to the facility that rejected is refused', act(rej, 'REROUTE', 'u-anm-kothi', 3, { reroute: fac('phc-bhamragad') }).ok === false);
const rr = mustOk(act(rej, 'REROUTE', 'u-anm-kothi', 3, { reroute: fac('phc-perimili') }), 'reroute').referral;
check('re-route targets the new facility and starts again at CREATED', rr.toFacilityId === 'phc-perimili' && rr.status === 'CREATED');
check('the declining facility is kept in route history', rr.routeHistory?.[0]?.facilityId === 'phc-bhamragad' && rr.routeHistory[0].code === 'NO_BED');
check('delivery and escalation state reset for the new receiver', !rr.deliveredAt && !rr.rejection && !rr.escalation);
check('the declining facility can still see the patient it declined', wf.canViewReferral({ role: 'MO', facilityId: 'phc-bhamragad' }, rr));
const rrSent = mustOk(act(rr, 'SEND', 'u-anm-kothi', 4), 'resend').referral;
const reNotes = wf.notificationsFor(rrSent, rrSent.timeline.at(-1)!, SEED_USERS);
check('the new receiver is notified of the re-routed referral, the old one is not',
    reNotes.length > 0 && reNotes.every(n => n.recipient_user_id === 'u-mo-perimili') && reNotes[0].message.startsWith('Re-routed'),
    reNotes.map(n => n.recipient_user_id).join(','));

// ---------------------------------------------------------------------------
console.log('\n4. CAPACITY AT ACCEPTANCE');
// ---------------------------------------------------------------------------
const noBed = act(d, 'ACCEPT', 'u-mo-bhamragad', 2);
check('accepting an inpatient referral with no bed and no override is refused', !noBed.ok && noBed.code === 'NO_CAPACITY');
check('an override needs a real reason', act(d, 'ACCEPT', 'u-mo-bhamragad', 2, { override: { reason: 'ok' } }).ok === false);
const ov = act(d, 'ACCEPT', 'u-mo-bhamragad', 2, { override: { reason: 'Corridor bed; transferring within 2 h' } });
check('an override with a reason is accepted and recorded', ov.ok && ov.referral.capacityOverride?.reason.startsWith('Corridor') === true);
let out = newReferral('ROUTINE', 'Follow-up sputum CBNAAT test for pulmonary TB, month 3');
out = mustOk(act(out, 'SEND', 'u-anm-kothi', 0), 's').referral;
out = mustOk(act(out, 'OPEN', 'u-mo-bhamragad', 1), 'o').referral;
check('outpatient work (routine test) is accepted without a bed', act(out, 'ACCEPT', 'u-mo-bhamragad', 2).ok === true);
const acc = mustOk(act(d, 'ACCEPT', 'u-mo-bhamragad', 2, { reservation }), 'accept').referral;
check(`a held bed expires after ${REFERRAL_TIMING.RESERVATION_HOLD_HOURS} h`,
    Date.parse(acc.reservation!.expiresAt) - Date.parse(acc.reservation!.reservedAt) === REFERRAL_TIMING.RESERVATION_HOLD_HOURS * 3_600_000);

// ---------------------------------------------------------------------------
console.log('\n5. NOTIFICATIONS');
// ---------------------------------------------------------------------------
let n = newReferral();
n = mustOk(act(n, 'SEND', 'u-anm-kothi', 0), 's').referral;
const onSend = wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS);
check('SEND notifies the receiving PHC\'s Medical Officer and nobody else',
    onSend.length === 1 && onSend[0].recipient_user_id === 'u-mo-bhamragad' && onSend[0].type === 'REFERRAL_RECEIVED',
    onSend.map(x => x.recipient_user_id).join(','));
check('the notification row has the table\'s columns', ['id', 'recipient_user_id', 'facility_id', 'referral_id', 'type', 'message', 'is_read', 'created_at']
    .every(k => k in onSend[0]) && onSend[0].is_read === false);
n = mustOk(act(n, 'OPEN', 'u-mo-bhamragad', 2), 'o').referral;
const onOpen = wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS);
check('opening tells the Sub Centre "Seen by PHC at [time]"',
    onOpen.length === 1 && onOpen[0].recipient_user_id === 'u-anm-kothi' && onOpen[0].message.startsWith('Seen by'), onOpen[0]?.message);
for (const [action, extra] of [['ACKNOWLEDGE', {}], ['ACCEPT', { reservation }]] as const) {
    n = mustOk(act(n, action, 'u-mo-bhamragad', 3, extra), action).referral;
    const notes = wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS);
    check(`${action} notifies the Sub Centre`, notes.some(x => x.recipient_user_id === 'u-anm-kothi'));
}
const acceptNote = wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS).find(x => x.recipient_user_id === 'u-anm-kothi')!;
check('acceptance tells the sender the bed and the handover instructions',
    acceptNote.message.includes('General ward bed') && acceptNote.message.includes('PHC ward, bed 3'), acceptNote.message);
check('the same event yields the same notification ids (two devices → one bell)',
    JSON.stringify(wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS).map(x => x.id)) ===
    JSON.stringify(wf.notificationsFor(n, n.timeline.at(-1)!, SEED_USERS).map(x => x.id)));
const cm = wf.addComment(n, actor('u-mo-bhamragad'), 'Bed 3 ready', at(4), 'c1');
check('a comment from the PHC goes to the Sub Centre only',
    cm.ok && wf.notificationsForComment(cm.referral, cm.comment, SEED_USERS).every(x => x.recipient_user_id === 'u-anm-kothi'));
check('an unrelated facility cannot comment', wf.addComment(n, actor('u-anm-govindpur'), 'hi', at(4), 'c2').ok === false);

// ---------------------------------------------------------------------------
console.log('\n6. THE CLOCK');
// ---------------------------------------------------------------------------
const ACK = REFERRAL_TIMING.EMERGENCY_ACK_MINUTES;
const RE = REFERRAL_TIMING.EMERGENCY_REALERT_MINUTES;
let e = mustOk(act(newReferral('EMERGENCY'), 'SEND', 'u-anm-kothi', 0), 's').referral;
const sweepAt = (refs: any[], min: number) => wf.sweepReferrals(refs, T0 + min * 60_000, SEED_USERS);
check(`no escalation before ${ACK} minutes`, sweepAt([e], ACK - 0.5).length === 0);
const s1 = sweepAt([e], ACK);
check(`escalates at ${ACK} minutes`, s1.length === 1 && s1[0].referral.escalation?.level === 1);
check('the DHO is alerted, and the receiver reminded',
    s1[0].notifications.some(x => x.recipient_user_id === 'u-dho' && x.type === 'EMERGENCY_ESCALATION') &&
    s1[0].notifications.some(x => x.recipient_user_id === 'u-mo-bhamragad' && x.type === 'EMERGENCY_REMINDER'));
e = s1[0].referral;
check('sweeping again at the same moment does nothing', sweepAt([e], ACK + 1).length === 0);
const e0 = mustOk(act(newReferral('EMERGENCY'), 'SEND', 'u-anm-kothi', 0), 's').referral;
const deviceA = sweepAt([e0], ACK)[0];
const deviceB = sweepAt([e0], ACK + 0.2)[0];
const twinMerged = wf.mergeReferral(deviceA.referral, deviceB.referral);
check('two devices sweeping the same referral produce one escalation event, not two',
    deviceA.event.id === deviceB.event.id &&
    twinMerged.timeline.filter(x => x.action === 'EMERGENCY_ESCALATION').length === 1,
    `${deviceA.event.id} vs ${deviceB.event.id}`);
check('their notifications collapse too', deviceA.notifications.map(x => x.id).join() === deviceB.notifications.map(x => x.id).join());
const s2 = sweepAt([e], ACK + RE);
check(`re-alerts after a further ${RE} minutes`, s2.length === 1 && s2[0].referral.escalation?.level === 2);
const ackd = mustOk(act(mustOk(act(e, 'OPEN', 'u-mo-bhamragad', ACK + 1), 'o').referral, 'ACKNOWLEDGE', 'u-mo-bhamragad', ACK + 2), 'a').referral;
check('an acknowledged Emergency stops escalating', sweepAt([ackd], ACK + 5 * RE).length === 0);
const urgent = mustOk(act(newReferral('URGENT'), 'SEND', 'u-anm-kothi', 0), 's').referral;
check('an Urgent referral never escalates on this clock', sweepAt([urgent], 10 * ACK).length === 0);
const rerouted = mustOk(act(mustOk(act(mustOk(act(e, 'OPEN', 'u-mo-bhamragad', ACK + 1), 'o').referral, 'REJECT', 'u-mo-bhamragad', ACK + 2, { reject: { code: 'NO_BED' } }), 'r').referral,
    'REROUTE', 'u-anm-kothi', ACK + 3, { reroute: fac('phc-perimili') }), 'rr').referral;
const resent = mustOk(act(rerouted, 'SEND', 'u-anm-kothi', ACK + 3), 'rs').referral;
check('a re-routed Emergency gets a fresh acknowledgement clock', sweepAt([resent], ACK + 3 + ACK - 1).length === 0 && sweepAt([resent], ACK + 3 + ACK).length === 1);
const hold = REFERRAL_TIMING.RESERVATION_HOLD_HOURS * 60;
check('a held bed is not released before the hold ends', sweepAt([acc], 2 + hold - 1).length === 0);
const exp = sweepAt([acc], 2 + hold);
check('a held bed is released when the patient has not arrived', exp.length === 1 && exp[0].referral.reservation?.state === 'RELEASED' && exp[0].referral.status === 'ACCEPTED');
check('both sides are told the bed was released',
    exp[0].notifications.some(x => x.recipient_user_id === 'u-anm-kothi') && exp[0].notifications.some(x => x.recipient_user_id === 'u-mo-bhamragad'));
check('an arrived patient\'s bed is never released by the clock',
    sweepAt([mustOk(act(acc, 'MARK_ARRIVED', 'u-mo-bhamragad', 10), 'arr').referral], 5 * hold).length === 0);

// ---------------------------------------------------------------------------
console.log('\n7. SYNC');
// ---------------------------------------------------------------------------
const base = acc;
const left = wf.addComment(base, actor('u-anm-kothi'), 'Leaving now', at(10), 'cl');
const right = act(base, 'MARK_ARRIVED', 'u-mo-bhamragad', 11);
if (left.ok && right.ok) {
    const m1 = wf.mergeReferral(left.referral, right.referral);
    const m2 = wf.mergeReferral(right.referral, left.referral);
    check('merge keeps the comment made on one device and the status made on the other',
        m1.status === 'PATIENT_ARRIVED' && m1.comments.some(c => c.id === 'cl'));
    check('merge is symmetric', m1.status === m2.status && m1.timeline.length === m2.timeline.length && m1.comments.length === m2.comments.length);
    check('merging a copy with itself changes nothing', wf.mergeReferral(m1, m1).timeline.length === m1.timeline.length);
    check('isNewer spots the missing comment', wf.isNewer(right.referral, left.referral) && !wf.isNewer(m1, left.referral));
}
const legacy = wf.normalizeReferral({ id: 'old', status: 'IN_TRANSIT', referredAt: at(0), fromFacilityId: 'a', toFacilityId: 'b', referredBy: 'X' } as any);
check('a pre-lifecycle IN_TRANSIT record becomes ACCEPTED with a dispatch time', legacy.status === 'ACCEPTED' && Boolean(legacy.inTransitAt));
check('its reconstructed timeline says the middle steps were not captured', legacy.timeline.at(-1)?.note?.includes('not captured') === true);
check('COMPLETED maps to ADMITTED, INITIATED to SENT',
    wf.normalizeReferral({ id: 'o2', status: 'COMPLETED', referredAt: at(0) } as any).status === 'ADMITTED' &&
    wf.normalizeReferral({ id: 'o3', status: 'INITIATED', referredAt: at(0) } as any).status === 'SENT');

// ---------------------------------------------------------------------------
console.log('\n8. RELAY CHECK');
// ---------------------------------------------------------------------------
const opened = d;
const forged = { ...opened, status: 'ACCEPTED', timeline: [...opened.timeline, { id: 'forged', action: 'ACCEPT', fromStatus: 'DELIVERED', toStatus: 'ACCEPTED', at: at(3), actor: actor('u-anm-kothi') }] };
check('the relay refuses an ANM "accepting" her own referral', wf.verifyPublishedReferral(opened, forged as any).ok === false);
const wrongFac = { ...forged, timeline: [...opened.timeline, { ...forged.timeline.at(-1)!, actor: actor('u-mo-perimili') }] };
check('the relay refuses an MO answering another PHC\'s referral', wf.verifyPublishedReferral(opened, wrongFac as any).ok === false);
check('the relay passes a legitimate acceptance', wf.verifyPublishedReferral(opened, acc).ok === true);

// ---------------------------------------------------------------------------
console.log('\n9. SEED');
// ---------------------------------------------------------------------------
const statuses = new Set(SEED_REFERRALS.map(x => x.status));
for (const s of ['SENT', 'DELIVERED', 'ACKNOWLEDGED', 'ACCEPTED', 'REJECTED', 'PATIENT_ARRIVED', 'ADMITTED', 'DISCHARGED']) {
    check(`seed has a referral in ${s}`, statuses.has(s as any));
}
check('every seeded timeline is ordered in time', SEED_REFERRALS.every(x => x.timeline.every((ev, i) => i === 0 || Date.parse(ev.at) >= Date.parse(x.timeline[i - 1].at))));
check('every seeded notification is addressed to a seeded user', SEED_NOTIFICATIONS.every(x => SEED_USERS.some(u => u.id === x.recipient_user_id)));
check('seed notification ids are unique', new Set(SEED_NOTIFICATIONS.map(x => x.id)).size === SEED_NOTIFICATIONS.length);
const seedEsc = wf.sweepReferrals(SEED_REFERRALS, Date.now(), SEED_USERS);
check('the seeded unanswered Emergency escalates on first sweep', seedEsc.some(u => u.event.action === 'EMERGENCY_ESCALATION'));

console.log(failures === 0 ? '\nAll referral-flow checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
