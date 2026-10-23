/**
 * Identifier redaction on the device — `npm run verify:chat-redaction`
 *
 * Before the assistant sends a question to the cloud layer, lib/chat/redact.ts
 * replaces mobile, Aadhaar and ABHA numbers, ABHA addresses, emails and other
 * long ID numbers. The server does the same (backend/app/chat_guard.py,
 * checked by verify:chat-guard), and both are held to the one list of cases in
 * scripts/fixtures/redaction-cases.json — so the device and the server cannot
 * drift into removing different things.
 *
 * Two directions matter. Missing an identifier sends it to a third party;
 * removing a vital sign ("BP 180/110") breaks the clinical question. The
 * fixture asserts both.
 */

import { readFileSync } from 'node:fs';

const { redactIdentifiers } = await import('../lib/chat/redact');

interface Case { note: string; input: string; output: string; removed: number }
const { cases } = JSON.parse(
    readFileSync(new URL('./fixtures/redaction-cases.json', import.meta.url), 'utf8')
) as { cases: Case[] };

const failures: string[] = [];

console.log('\nEach case comes out exactly as the shared fixture says:');
for (const c of cases) {
    const got = redactIdentifiers(c.input);
    if (got.text === c.output && got.removed === c.removed) {
        console.log(`  PASS  ${c.note}`);
    } else {
        console.log(`  FAIL  ${c.note}\n        expected ${JSON.stringify(c.output)} (${c.removed})\n        got      ${JSON.stringify(got.text)} (${got.removed})`);
        failures.push(c.note);
    }
}

console.log('\nRunning it twice changes nothing more:');
for (const c of cases) {
    const again = redactIdentifiers(redactIdentifiers(c.input).text);
    if (again.removed !== 0 || again.text !== c.output) {
        console.log(`  FAIL  ${c.note} — a second pass removed ${again.removed} more`);
        failures.push(`idempotent: ${c.note}`);
    }
}
if (!failures.some(f => f.startsWith('idempotent'))) console.log('  PASS  every case is stable under a second pass');

console.log('');
if (failures.length) {
    console.log(`${failures.length} check(s) FAILED`);
    process.exit(1);
}
console.log(`All ${cases.length} cases match the shared fixture.\n`);
