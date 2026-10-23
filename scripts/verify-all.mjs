/**
 * Every verify:* suite, one after another — `npm run verify`.
 * Prints each suite's result and a summary; exits non-zero if any fails, and
 * shows the failing suite's output so CI logs say what broke.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const suites = Object.keys(scripts).filter(name => name.startsWith('verify:'));
const failed = [];
for (const suite of suites) {
    const started = Date.now();
    const run = spawnSync('npm', ['run', '-s', suite], { encoding: 'utf8', env: process.env });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (run.status === 0) console.log(`PASS ${suite} (${seconds}s)`);
    else {
        failed.push(suite);
        console.log(`FAIL ${suite} (${seconds}s)\n${run.stdout}${run.stderr}`);
    }
}
console.log(`\n${suites.length - failed.length}/${suites.length} suites passed${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
