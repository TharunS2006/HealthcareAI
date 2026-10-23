/**
 * Chat-assistant retrieval coverage — `npm run verify:chat-retrieval`
 *
 * Its sibling, verify-chat-safety.mts, checks that what the assistant says is
 * safe. This one checks that it says anything at all.
 *
 * The offline retriever matched only exact phrases somebody had thought to
 * write into a keyword list, so the app's own placeholder question — "Where do
 * I refer a RED case?" — returned "no entry found". A worker told that once
 * stops asking, and the intent it failed on is the one that routes emergencies.
 * Coverage is therefore a safety property here, not a nicety.
 *
 * Two things are asserted, and the second matters as much as the first:
 *
 *   1. Questions a worker would really type are answered — asked the way they
 *      would actually be phrased, not in the keyword list's wording.
 *   2. The right intent answers them. A confident answer to a question nobody
 *      asked ("how do I register a new patient" → "Inpatient Care is available
 *      at the CHC") is worse than silence, so near-miss pairs that used to
 *      collide are pinned apart.
 *
 * Out-of-scope questions must still return null — verify-chat-safety.mts owns
 * that boundary; widening the matcher must not erode it, so a reminder to run
 * both is at the end.
 */

// Dynamic import: lib/ is CJS under this package.json, so named ESM bindings aren't static.
const { retrieveOffline } = await import('../lib/chat/retrieve');

type Language = 'en' | 'mr' | 'hi';

const failures: string[] = [];
const pass = (label: string) => console.log(`  PASS  ${label}`);
const fail = (label: string, detail: string) => {
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failures.push(label);
};

const ask = (q: string, role = 'MO', language: Language = 'en') =>
    retrieveOffline(q, { role, language });

/**
 * A question, and a fragment that only the correct intent's answer contains.
 *
 * Matching on the fragment rather than on "did anything come back" is what
 * catches an answer from the wrong intent, which is the failure that a pure
 * coverage check would wave through.
 */
type Case = { q: string; expect: RegExp; why: string };

const CASES: Case[] = [
    // ── referral routing: the intent that was completely dead ───────────────
    {
        q: 'Where do I refer a RED case?',
        expect: /RED case/i,
        why: "the app's own placeholder question",
    },
    {
        q: 'Where should I send this RED patient?',
        expect: /RED case/i,
        why: 'send, not refer',
    },
    {
        q: 'Which hospital for an emergency case?',
        expect: /RED case/i,
        why: 'urgency named as "emergency", no referral verb at all',
    },
    {
        q: 'refer a yellow patient where',
        expect: /YELLOW case/i,
        why: 'word order a hurried worker would actually type',
    },
    {
        q: 'Can I keep a green case at the PHC?',
        expect: /GREEN case/i,
        why: 'routing asked as a keep-or-send question',
    },

    // ── danger signs ────────────────────────────────────────────────────────
    {
        q: 'What SpO2 counts as a danger sign?',
        expect: /SpO2 < 90%/,
        why: 'thresholds by vital name',
    },
    {
        q: 'What is the danger sign for pulse?',
        expect: /HR > 130/,
        why: '"pulse" rather than "heart rate"',
    },

    // ── facility directory ──────────────────────────────────────────────────
    {
        q: 'Which facility has a blood bank?',
        expect: /Blood Bank/i,
        why: 'service named in full',
    },
    {
        q: 'Where can I get a CT scan?',
        expect: /CT Scan/i,
        why: 'equipment named in full',
    },
    {
        q: 'Who has a ventilator?',
        expect: /Ventilator/i,
        why: 'singular, where the directory writes the plural',
    },

    // ── entitlements and schedules ──────────────────────────────────────────
    {
        q: 'Is treatment free under Ayushman Bharat?',
        expect: /free/i,
        why: 'scheme named',
    },
    {
        q: 'When is the ANC clinic?',
        expect: /Antenatal/i,
        why: 'a clinic day asked without the word "day"',
    },
    {
        q: 'When is the next immunisation day?',
        expect: /Immunisation/i,
        why: 'the phrasing on the wall poster',
    },

    // ── app navigation ──────────────────────────────────────────────────────
    {
        q: 'Where is the pre-arrival board?',
        expect: /\/incoming/,
        why: 'the newest screen, asked for by its name',
    },
    {
        q: 'How do I register a new patient?',
        expect: /\/record|\/opd/,
        why: 'must route to a screen, not to a lookalike service name',
    },

    // ── medicine stock ──────────────────────────────────────────────────────
    {
        q: 'What medicines are in stock?',
        expect: /Medicine Stock/i,
        why: 'stock question that collides with the service "General Medicine"',
    },
];

console.log('\nQuestions a worker would really type are answered by the right intent:');
for (const c of CASES) {
    const a = ask(c.q);
    if (!a) {
        fail(`"${c.q}"`, `returned null — ${c.why}`);
    } else if (!c.expect.test(a.text)) {
        fail(`"${c.q}"`, `wrong intent answered (${c.why}): ${JSON.stringify(a.text.slice(0, 120))}`);
    } else {
        pass(`"${c.q}"`);
    }
}

// ── near-miss pairs ─────────────────────────────────────────────────────────
// Each of these two questions shares most of its words with the other, and each
// belongs to a different intent. They are asserted together because widening
// one matcher is exactly what makes it swallow the other.

console.log('\nLookalike questions are kept apart:');

const PAIRS: { a: Case; b: Case }[] = [
    {
        a: {
            q: 'Which facility has an emergency department?',
            expect: /available at/i,
            why: 'directory lookup — "emergency" here names a department, not a triage colour',
        },
        b: {
            q: 'Which facility for an emergency patient?',
            expect: /RED case/i,
            why: 'routing — "emergency" here describes the patient',
        },
    },
    {
        a: {
            q: 'Is the medicine stock updated?',
            expect: /Medicine Stock/i,
            why: 'stock screen',
        },
        b: {
            q: 'Where can I get general medicine?',
            expect: /available at/i,
            why: 'directory lookup for the named service',
        },
    },
];

for (const { a, b } of PAIRS) {
    for (const c of [a, b]) {
        const got = ask(c.q);
        if (!got) fail(`"${c.q}"`, `returned null — ${c.why}`);
        else if (!c.expect.test(got.text)) {
            fail(`"${c.q}"`, `${c.why}; got ${JSON.stringify(got.text.slice(0, 120))}`);
        } else pass(`"${c.q}" → ${c.why.split(' —')[0]}`);
    }
}

// ── role scoping survives the widening ──────────────────────────────────────
// Navigation answers are filtered by role on purpose: an ASHA in the field has
// no receiving-hospital board, and pointing them at a screen they cannot open
// wastes the one question they asked. The looser matcher must not bypass this.

console.log('\nNavigation stays scoped to the role that has the screen:');
const asha = ask('Where is the pre-arrival board?', 'ASHA');
if (asha === null) {
    pass('an ASHA is not sent to the receiving-facility board');
} else {
    fail('an ASHA is not sent to the receiving-facility board', `got ${JSON.stringify(asha.text)}`);
}
for (const role of ['ANM', 'MO', 'DHO']) {
    const got = ask('Where is the pre-arrival board?', role);
    if (got && /\/incoming/.test(got.text)) pass(`${role} is given the board`);
    else fail(`${role} is given the board`, `got ${got ? JSON.stringify(got.text) : 'null'}`);
}

// ── a greeting is not a dead end ────────────────────────────────────────────
// Typing "hi" first is what almost everyone does, and it used to come back as
// "no offline protocol entry for that" — which reads as a broken assistant and
// costs the question the worker was actually about to ask. The orientation must
// name what can be looked up, and must not swallow a real question that happens
// to open with a greeting.

console.log('\nA greeting gets an orientation, not a dead end:');
for (const hello of ['hi', 'Hello', 'hii', 'hey there', 'Namaste', 'good morning', 'नमस्ते', 'help']) {
    const got = ask(hello);
    if (got && /Try:|पूछकर देखें|विचारून पहा/.test(got.text)) pass(`"${hello}" is answered with examples`);
    else fail(`"${hello}" is answered with examples`, `got ${got ? JSON.stringify(got.text.slice(0, 90)) : 'null'}`);
}

const thanked = ask('thanks');
if (thanked && !/Try:/.test(thanked.text)) pass('"thanks" gets an acknowledgement, not the menu again');
else fail('"thanks" gets an acknowledgement, not the menu again', `got ${thanked ? JSON.stringify(thanked.text.slice(0, 90)) : 'null'}`);

console.log('\nA greeting in front of a real question does not swallow it:');
for (const q of ['hi, where do I refer a RED case?', 'hello which facility has a blood bank']) {
    const got = ask(q);
    if (got && !/Try:/.test(got.text)) pass(`"${q}" reaches the real intent`);
    else fail(`"${q}" reaches the real intent`, `got ${got ? JSON.stringify(got.text.slice(0, 90)) : 'null'}`);
}

// "help me" is not treated as small talk: it may not be. The caller's fallback
// names a Medical Officer and the helpline, which is the safer answer.
const helpMe = ask('help me');
if (helpMe === null) pass('"help me" is left to the supervisor fallback, not answered with a menu');
else fail('"help me" is left to the supervisor fallback', `got ${JSON.stringify(helpMe.text.slice(0, 90))}`);

// ── the citizen wording differs from the staff wording ──────────────────────
console.log('\nA visitor is not offered screens they have no login for:');
const staffHi = ask('hi', 'MO');
const publicHi = retrieveOffline('hi', { role: null, language: 'en' });
if (staffHi && publicHi && staffHi.text !== publicHi.text) {
    pass('staff and public greetings are worded for their audience');
} else {
    fail('staff and public greetings are worded for their audience', 'both audiences got the same text');
}

// ── every answer still carries its source ───────────────────────────────────
console.log('\nEvery answer is attributed:');
const unattributed = CASES.map((c) => ({ c, a: ask(c.q) })).filter(
    ({ a }) => a && (!a.source || a.source.trim() === '')
);
if (unattributed.length === 0) {
    pass('no answer arrives without a source line');
} else {
    fail('no answer arrives without a source line', unattributed.map(({ c }) => c.q).join('; '));
}

console.log('');
if (failures.length === 0) {
    console.log('All checks passed — the offline assistant answers how workers actually ask,');
    console.log('the right intent answers each one, and role scoping still holds.');
    console.log('Run verify:chat-safety alongside this: it owns the other half of the');
    console.log('boundary, that out-of-scope questions still return null.\n');
    process.exit(0);
} else {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
}
