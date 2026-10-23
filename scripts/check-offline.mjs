/**
 * Offline check of the built app — `npm run check:offline` (after `npm run build`)
 *
 * The platform's first promise is that a sub-centre with no signal keeps
 * working. This serves the static export in out/, lets the service worker
 * install, signs in as an ANM (the evaluation account), then stops the server
 * outright — not a DevTools toggle, which has let requests through before —
 * and opens each screen below with a full page load, as after a phone restart.
 * Each must start (the app's JavaScript runs), stay on its own address, and
 * fetch no build file it does not have.
 *
 * It needs an evaluation build (the default: it has the demo accounts) and a
 * Chromium that Playwright can launch, as check:a11y does.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../out/', import.meta.url).pathname;

// The ANM's screens, and the public ones a citizen opens. The ANM is the user
// most often without signal; /my-dashboard is where they land after signing in.
const ROUTES = ['/my-dashboard', '/opd', '/followup', '/record', '/referrals', '/teleconsult', '/',
    '/emergency', '/facilities', '/services-info', '/privacy'];

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
};

async function isFile(p) {
    try { return (await stat(p)).isFile() ? p : null; } catch { return null; }
}

const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const base = join(ROOT, path);
    const found = (await isFile(base)) || (await isFile(`${base}.html`)) || (await isFile(join(base, 'index.html')));
    if (!found) {
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        res.end(await readFile(join(ROOT, '404.html')));
        return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
    res.end(await readFile(found));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
let failed = 0;
try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/staff/login`);
    await page.getByRole('button', { name: /ANM/ }).first().click();
    await page.waitForURL(url => !url.pathname.startsWith('/staff/login'), { timeout: 20000 });

    // Installed means activated (install's own work finishes first) and in control.
    const installed = await page.waitForFunction(async () => {
        const registration = await navigator.serviceWorker.ready;
        return registration.active?.state === 'activated' && Boolean(navigator.serviceWorker.controller);
    }, null, { timeout: 60000, polling: 500 }).then(() => true, () => false);
    const cache = await page.evaluate(async () => {
        const name = (await caches.keys()).find(k => k.startsWith('nalammesh-'));
        const entries = name ? await (await caches.open(name)).keys() : [];
        return { name, pages: entries.filter(r => !r.url.includes('/_next/')).length, build: entries.filter(r => r.url.includes('/_next/static/')).length };
    });
    console.log(` service worker ${installed ? 'installed' : 'DID NOT INSTALL'}: ${cache.name ?? 'no cache'} — ${cache.pages} pages, ${cache.build} build files`);
    if (!installed) failed += 1;

    // Offline for real: no new connections, and the open ones dropped.
    server.close();
    server.closeAllConnections();
    const down = await fetch(`${BASE}/`).then(() => false, () => true);
    console.log(` server stopped: ${down}\n`);
    if (!down) throw new Error('the server is still answering; the check would prove nothing');

    for (const route of ROUTES) {
        const missing = [];
        const onFailed = r => { if (new URL(r.url()).pathname.startsWith('/_next/')) missing.push(new URL(r.url()).pathname); };
        const onResponse = r => { if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/_next/')) missing.push(`${r.status()} ${new URL(r.url()).pathname}`); };
        page.on('requestfailed', onFailed);
        page.on('response', onResponse);
        let error = '';
        await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 20000 }).catch(e => { error = e.message.split('\n')[0]; });
        await page.waitForTimeout(1500);
        const state = await page.evaluate(() => ({
            path: location.pathname,
            started: typeof window.next === 'object',
            offlinePage: document.title.includes('ऑफलाइन'),
        })).catch(() => ({ path: '?', started: false, offlinePage: false }));
        page.off('requestfailed', onFailed);
        page.off('response', onResponse);

        const problems = [
            error,
            !state.started && 'the app did not start',
            state.offlinePage && 'served the "not available offline" page',
            state.path !== route && `ended on ${state.path}`,
            missing.length > 0 && `${missing.length} build file(s) missing, e.g. ${missing.slice(0, 2).join(', ')}`,
        ].filter(Boolean);
        if (problems.length) failed += 1;
        console.log(` ${problems.length ? 'FAIL' : 'PASS'} ${route}${problems.length ? ` — ${problems.join('; ')}` : ''}`);
    }
} finally {
    await browser.close();
    server.close();
}

console.log(failed === 0
    ? `\nAll ${ROUTES.length} screens open offline after install, with every file they need.\n`
    : `\n${failed} problem(s): the app does not fully work offline.\n`);
process.exit(failed === 0 ? 0 : 1);
