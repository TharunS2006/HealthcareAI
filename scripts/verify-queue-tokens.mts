/**
 * OPD token numbering — `npm run verify:queue-tokens`
 *
 *   1. ORDER     tokens run 001, 002, … per prefix; the next follows the
 *                highest already issued, even after a gap
 *   2. SCOPE     another facility's tokens and yesterday's do not count
 *   3. UNIQUE    a morning of registrations never repeats a token
 */

const { nextTokenNumber } = await import('../lib/queue/token');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const now = new Date(2026, 8, 25, 10, 30);
const today = (h: number) => new Date(2026, 8, 25, h).toISOString();
const entry = (tokenNumber: string, facilityId = 'phc-bhamragad', registeredAt = today(9)) => ({ tokenNumber, facilityId, registeredAt });

console.log('\n1. ORDER');
check('the first token of the day is 001', nextTokenNumber([], 'phc-bhamragad', 'GEN', now) === 'GEN-001');
check('the next follows the highest issued', nextTokenNumber([entry('GEN-001'), entry('GEN-002')], 'phc-bhamragad', 'GEN', now) === 'GEN-003');
check('…even after a gap', nextTokenNumber([entry('GEN-001'), entry('GEN-007')], 'phc-bhamragad', 'GEN', now) === 'GEN-008');
check('each prefix keeps its own sequence', nextTokenNumber([entry('GEN-004'), entry('EMG-001')], 'phc-bhamragad', 'EMG', now) === 'EMG-002');

console.log('\n2. SCOPE');
check('another facility\'s tokens do not count', nextTokenNumber([entry('GEN-005', 'sc-kothi')], 'phc-bhamragad', 'GEN', now) === 'GEN-001');
check('yesterday\'s tokens do not count', nextTokenNumber([entry('GEN-040', 'phc-bhamragad', new Date(2026, 8, 24, 16).toISOString())], 'phc-bhamragad', 'GEN', now) === 'GEN-001');
check('an old random-style token does not break the sequence', nextTokenNumber([entry('GEN-731'), entry('A-12')], 'phc-bhamragad', 'GEN', now) === 'GEN-732');

console.log('\n3. UNIQUE');
const queue: { tokenNumber: string; facilityId: string; registeredAt: string }[] = [];
for (let i = 0; i < 300; i++) {
    const prefix = ['EMG', 'URG', 'GEN'][i % 3];
    queue.push(entry(nextTokenNumber(queue, 'phc-bhamragad', prefix, now)));
}
check('300 registrations in a morning get 300 different tokens', new Set(queue.map(q => q.tokenNumber)).size === 300);

console.log(failures === 0 ? '\nAll token checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
