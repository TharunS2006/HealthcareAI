/**
 * The whole system in production mode — `npm run check:production`
 *
 * Builds the app with NEXT_PUBLIC_DEPLOYMENT_MODE=production into out/ (run
 * check:a11y and check:offline first, or rebuild after: they need an evaluation
 * build), starts a production relay with a store file and the district service
 * against throwaway state on free ports, serves the export, and drives in a
 * browser what a district does on its first day:
 *
 *   0. PRODUCTION     no demo accounts or "fictional data" banner; relay in
 *                     production on a file store; API docs hidden
 *   1. SUPER ADMIN    signs in with the bootstrap PIN; creates an ANM, an MO
 *                     and a DHO
 *   2. ANM            signs in by Staff ID on a new device; registers a RED
 *                     patient: token, decision-support notice, emergency
 *                     referral to the PHC above
 *   3. RECEIVING MO   the patient on the Pre-Arrival Board (district service)
 *                     and the referral on Referrals (relay)
 *   4. DHO            the access log names the upload and the read; the Data
 *                     Inspector reads the district store
 *   5. REVOCATION     a deactivated MO cannot sign in, and their open session
 *                     is refused by the district service
 *   6. RESTART        a restarted relay still knows every account (store
 *                     file) and ignores a new bootstrap PIN
 *
 * The two screens with real data on them are also checked with axe-core.
 * Needs the district service's Python packages and a Chromium Playwright can
 * launch, as check:a11y does.
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer, connect } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'out');
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TSX = require.resolve('tsx/cli');
const WORK = mkdtempSync(join(tmpdir(), 'nalammesh-production-'));
const SECRET = randomBytes(36).toString('base64url');
const STORE_FILE = join(WORK, 'state', 'relay-store.json');

const failures = [];
const check = (label, ok, detail = '') => {
    console.log(` ${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — ${String(detail).slice(0, 1000)}`}`);
    if (!ok) failures.push(label);
};

async function freePort() {
    const server = createNetServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    await new Promise(resolve => server.close(resolve));
    return port;
}
const portOpen = port => new Promise(resolve => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
});
async function until(condition, what, ms = 30000) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (await condition()) return;
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`timed out waiting for ${what}`);
}

const [relayPort, districtPort, appPort] = [await freePort(), await freePort(), await freePort()];
const APP = `http://localhost:${appPort}`;
const RELAY = `http://127.0.0.1:${relayPort}`;
const DISTRICT = `http://127.0.0.1:${districtPort}`;

// ── the build ────────────────────────────────────────────────────────────────
console.log(`\nBuilding the production app (relay :${relayPort}, district :${districtPort}, app :${appPort})…`);
const build = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT, encoding: 'utf8',
    env: {
        ...process.env,
        NEXT_PUBLIC_DEPLOYMENT_MODE: 'production',
        NEXT_PUBLIC_MESH_URL: `http://localhost:${relayPort}`,
        NEXT_PUBLIC_MESH_TRANSPORT: '',
        NEXT_PUBLIC_REPORTING_URL: `http://localhost:${districtPort}`,
        NEXT_PUBLIC_CHAT_URL: `http://localhost:${districtPort}`,
    },
});
if (build.status !== 0) {
    console.log(`${build.stdout}\n${build.stderr}`.slice(-3000));
    console.log('\nThe production build failed.\n');
    process.exit(1);
}

// ── the services ─────────────────────────────────────────────────────────────
// Each runs in its own process group, so stopping it stops every process it started.
const children = new Set();
function start(name, command, args, options) {
    const log = createWriteStream(join(WORK, `${name}.log`), { flags: 'a' });
    const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    children.add(child);
    return child;
}
async function stop(child, port) {
    children.delete(child);
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    if (port) await until(async () => !(await portOpen(port)), `port ${port} to close`, 15000);
}
const startRelay = bootstrapPin => start('relay', process.execPath, [TSX, 'server/mesh-server.ts'], {
    cwd: ROOT,
    env: {
        ...process.env, PORT: String(relayPort), NALAMMESH_DEPLOYMENT_MODE: 'production',
        NALAMMESH_BOOTSTRAP_ADMIN_PIN: bootstrapPin, NALAMMESH_BOOTSTRAP_ADMIN_NAME: 'Dr. Test Administrator',
        NALAMMESH_AUTH_SECRET: SECRET, NALAMMESH_RELAY_STORE_FILE: STORE_FILE,
        UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '',
    },
});
const healthy = url => fetch(url).then(r => r.ok, () => false);

// The export's own URLs: /queue is out/queue.html.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
async function isFile(p) { try { return (await stat(p)).isFile() ? p : null; } catch { return null; } }
const appServer = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const base = join(OUT, path);
    const found = (await isFile(base)) || (await isFile(`${base}.html`)) || (await isFile(join(base, 'index.html')));
    if (!found) { res.writeHead(404, { 'content-type': TYPES['.html'] }); res.end(await readFile(join(OUT, '404.html'))); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
    res.end(await readFile(found));
});

let relay;
let browser;
const pageErrors = [];
const toasts = [];
try {
    start('district', 'python3', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(districtPort)], {
        cwd: join(ROOT, 'backend'),
        env: {
            ...process.env, DATABASE_URL: `sqlite:///${join(WORK, 'district.db')}`, NALAMMESH_AUTH_SECRET: SECRET,
            NALAMMESH_RELAY_URL: RELAY, NALAMMESH_RELAY_CHECK_SECONDS: '2', API_DOCS: 'off', CORS_ORIGINS: APP,
            CHAT_PROVIDER: '', GROQ_API_KEY: '', XAI_API_KEY: '', ANTHROPIC_API_KEY: '', CHAT_BASE_URL: '',
        },
    });
    relay = startRelay('135790');
    await new Promise(resolve => appServer.listen(appPort, '127.0.0.1', resolve));
    await until(() => healthy(`${RELAY}/health`), 'the relay');
    await until(() => healthy(`${DISTRICT}/health`), 'the district service');

    browser = await chromium.launch();
    async function device(name) {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.on('pageerror', e => pageErrors.push(`${name}: ${e.message.slice(0, 160)}`));
        await page.exposeFunction('__toast', text => toasts.push(`${name}: ${text}`));
        await page.addInitScript(() => {
            new MutationObserver(() => {
                document.querySelectorAll('[role="status"]').forEach(el => {
                    const text = el.textContent.trim();
                    if (text && el.dataset.seenText !== text) { el.dataset.seenText = text; window.__toast?.(text); }
                });
            }).observe(document, { childList: true, subtree: true, characterData: true });
        });
        return { context, page };
    }
    async function signIn(page, staffId, pin) {
        await page.goto(`${APP}/staff/login`);
        await page.locator('#staff-id').fill(staffId);
        await page.locator('#staff-id-pin').fill(pin);
        await page.getByRole('button', { name: /Sign in with Staff ID/ }).click();
        await page.waitForURL(url => !url.pathname.startsWith('/staff/login'), { timeout: 20000 }).catch(() => {});
        return new URL(page.url()).pathname;
    }
    async function noViolations(page, label) {
        // Every page fades in (app/template.tsx, 0.35 s); measured mid-fade, any
        // text reads as low contrast.
        await page.waitForTimeout(600);
        await page.addScriptTag({ content: AXE });
        const found = await page.evaluate(async () =>
            // eslint-disable-next-line no-undef
            (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
                .violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map(n => `${n.target.join(' ')} — ${(n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? ''}`).join(' | ')}`));
        check(`${label}: no WCAG 2.1 A/AA violation with real data on screen`, found.length === 0, found.join(' || ').slice(0, 900));
    }

    console.log('\n0. PRODUCTION');
    const visitor = await device('visitor');
    await visitor.page.goto(`${APP}/staff/login`);
    check('no demo-account buttons on the sign-in page',
        (await visitor.page.getByRole('button', { name: /^(District Health Officer|Medical Officer|ANM|Super Admin)/ }).count()) === 0);
    check('no "fictional data" banner', (await visitor.page.getByText(/fictional/i).count()) === 0);
    const relayHealth = await (await fetch(`${RELAY}/health`)).json();
    check('the relay runs in production on its store file', relayHealth.mode === 'production' && relayHealth.store === 'file', JSON.stringify(relayHealth));
    check('the district service hides its API docs', (await fetch(`${DISTRICT}/docs`)).status === 404);
    check('a wrong bootstrap PIN does not sign in', (await signIn(visitor.page, 'ADMIN-01', '000000')) === '/staff/login');
    await visitor.context.close();

    console.log('\n1. SUPER ADMIN');
    const admin = await device('admin');
    check('the first Super Admin signs in with the bootstrap PIN and lands on /admin', (await signIn(admin.page, 'ADMIN-01', '135790')) === '/admin');
    async function addUser(name, staffId, role, facilityId, pin) {
        const p = admin.page;
        await p.getByRole('button', { name: '+ Add user' }).click();
        await p.getByLabel(/^Name/).fill(name);
        await p.getByLabel(/^Staff ID/).fill(staffId);
        await p.getByLabel(/^Role/).selectOption(role);
        if (facilityId) await p.getByLabel(/^Posting/).selectOption(facilityId);
        await p.getByLabel(/^PIN/).fill(pin);
        await p.getByRole('button', { name: 'Add user', exact: true }).click();
        await until(async () => toasts.includes(`admin: ${name} saved`), `${name} to be saved`, 10000).catch(() => {});
        return toasts.includes(`admin: ${name} saved`);
    }
    const created = [
        await addUser('Test ANM Kothi', 'ANM-KOT-0001', 'ANM', 'sc-kothi', '482913'),
        await addUser('Test MO Bhamragad', 'MO-BHA-0001', 'MO', 'phc-bhamragad', '615273'),
        await addUser('Test DHO', 'DHO-0001', 'DHO', null, '739104'),
    ];
    check('the Super Admin creates an ANM, an MO and a DHO', created.every(Boolean), toasts.filter(t => t.startsWith('admin')).join(' | '));

    console.log('\n2. ANM, ON A NEW DEVICE');
    const anm = await device('anm');
    check('the ANM signs in by Staff ID and lands on My Dashboard', (await signIn(anm.page, 'ANM-KOT-0001', '482913')) === '/my-dashboard');
    const p = anm.page;
    await p.goto(`${APP}/opd`);
    await p.locator('#opd-name').fill('Test Patient Kothi');
    await p.locator('#opd-age').fill('27');
    await p.getByRole('radiogroup', { name: /Gender/ }).getByRole('radio').nth(1).click();
    await p.locator('#opd-village').fill('Kothi');
    await p.getByLabel(/SpO2/).fill('86');
    await p.getByLabel(/Pulse Rate/).fill('124');
    await p.getByLabel('Systolic').fill('150');
    await p.getByLabel('Diastolic').fill('96');
    await p.getByLabel(/Respiratory Rate/).fill('26');
    await p.getByRole('radiogroup', { name: /Consciousness/ }).getByRole('radio', { name: 'Alert' }).click();
    await p.getByRole('button', { name: /Run AI Triage/ }).click();
    await p.getByText(/EMG-\d+/).first().waitFor({ timeout: 60000 }).catch(() => {});
    const slip = await p.locator('body').innerText();
    check('SpO2 86% triages RED and gets an emergency token', /EMG-\d+/.test(slip) && /\(RED\)/.test(slip), slip.slice(0, 200));
    check('the slip says triage is decision support and the health worker decides', slip.includes('Decision support only'));
    await until(async () => toasts.some(t => t.startsWith('anm: RED: emergency referral')), 'the referral toast', 15000).catch(() => {});
    check('the RED patient is referred at once to the PHC above',
        toasts.some(t => /^anm: RED: emergency referral \S+ raised to .*Bhamragad/.test(t)), toasts.filter(t => t.startsWith('anm')).join(' | '));

    console.log('\n3. RECEIVING MO');
    const mo = await device('mo');
    check('the MO signs in and lands on Referrals', (await signIn(mo.page, 'MO-BHA-0001', '615273')) === '/referrals');
    let onBoard = false;
    for (let i = 0; i < 20 && !onBoard; i++) {
        await mo.page.goto(`${APP}/incoming`);
        await mo.page.waitForTimeout(1500);
        onBoard = (await mo.page.getByText('Test Patient Kothi').count()) > 0;
    }
    check('the patient is on the MO\'s Pre-Arrival Board, from the district service', onBoard);
    if (onBoard) await noViolations(mo.page, 'Pre-Arrival Board');
    await mo.page.goto(`${APP}/referrals`);
    let referred = false;
    for (let i = 0; i < 20 && !referred; i++) {
        await mo.page.waitForTimeout(1000);
        referred = (await mo.page.getByText('Test Patient Kothi').count()) > 0;
    }
    check('the referral is on the MO\'s Referrals board, through the relay', referred);

    console.log('\n4. DISTRICT HEALTH OFFICER');
    const dho = await device('dho');
    check('the DHO signs in and lands on the command centre', (await signIn(dho.page, 'DHO-0001', '739104')) === '/dashboard');
    await dho.page.goto(`${APP}/audit`);
    const accessLog = dho.page.getByRole('region', { name: 'District record service access log' });
    await accessLog.waitFor({ timeout: 20000 }).catch(() => {});
    const logText = (await accessLog.count()) ? await accessLog.innerText() : '';
    check('the access log names the ANM\'s upload of the patient record',
        /POST \/api\/v1\/records\/patients/.test(logText) && /patient PAT-/.test(logText), logText.slice(0, 300));
    check('…and the MO reading the PHC\'s pre-arrival board', /GET \/api\/v1\/records\/incoming\?facility_id=phc-bhamragad/.test(logText));
    if (logText) await noViolations(dho.page, 'Audit screen');
    await dho.page.goto(`${APP}/data`);
    await dho.page.getByRole('button', { name: /Patient records\s*patient_records/ }).click({ timeout: 20000 }).catch(() => {});
    await dho.page.waitForTimeout(1000);
    check('the Data Inspector reads the district store', (await dho.page.locator('body').innerText()).includes('Test Patient Kothi'));

    console.log('\n5. REVOCATION');
    await admin.page.goto(`${APP}/admin`);
    await admin.page.getByPlaceholder('Search name, staff ID, role, facility').fill('MO-BHA-0001');
    await admin.page.getByRole('button', { name: 'Edit' }).first().click();
    await admin.page.getByLabel('Active').uncheck();
    await admin.page.getByRole('button', { name: 'Save changes' }).click();
    await until(async () => toasts.filter(t => t === 'admin: Test MO Bhamragad saved').length >= 2, 'the deactivation to save', 10000).catch(() => {});
    check('the Super Admin deactivates the MO without resetting their PIN', toasts.filter(t => t === 'admin: Test MO Bhamragad saved').length >= 2,
        toasts.filter(t => t.startsWith('admin')).slice(-3).join(' | '));
    const moAgain = await device('mo-again');
    check('the deactivated MO cannot sign in', (await signIn(moAgain.page, 'MO-BHA-0001', '615273')) === '/staff/login');
    await mo.page.waitForTimeout(3000); // past the district service's revocation cache (2 s here)
    await mo.page.goto(`${APP}/incoming`);
    await mo.page.waitForTimeout(2500);
    check('the MO\'s open session is refused by the district service', !(await mo.page.locator('body').innerText()).includes('Test Patient Kothi'));

    console.log('\n6. RELAY RESTART');
    await stop(relay, relayPort);
    relay = startRelay('999999');
    await until(() => healthy(`${RELAY}/health`), 'the restarted relay');
    const uptime = (await (await fetch(`${RELAY}/health`)).json()).uptime;
    check('the relay really restarted', uptime < 30, `uptime ${uptime}`);
    check('the ANM still signs in: the store file kept the account', (await signIn((await device('anm-again')).page, 'ANM-KOT-0001', '482913')) === '/my-dashboard');
    check('…and the new bootstrap PIN is ignored, since a Super Admin exists', (await signIn((await device('admin-new-pin')).page, 'ADMIN-01', '999999')) === '/staff/login');

    check('no page threw an error', pageErrors.length === 0, pageErrors.join(' | '));
} catch (err) {
    failures.push(`stopped: ${err.message}`);
    console.log(`\n The check stopped: ${err.message}`);
} finally {
    await browser?.close();
    await Promise.all([...children].map(child => stop(child)));
    appServer.close();
}

if (failures.length) {
    console.log(`\n── what the screens said ──\n  ${toasts.slice(-25).join('\n  ')}`);
    for (const name of ['relay', 'district']) {
        try { console.log(`\n── ${name} log (last lines) ──\n${readFileSync(join(WORK, `${name}.log`), 'utf8').split('\n').slice(-15).join('\n')}`); } catch { /* none */ }
    }
}
console.log(failures.length === 0
    ? '\nThe production flow works end to end: accounts, registration, referral, pre-arrival board, access log, revocation and restart.\n'
    : `\n${failures.length} problem(s) in the production flow.\n`);
process.exit(failures.length === 0 ? 0 : 1);
