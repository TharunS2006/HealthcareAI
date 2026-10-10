/**
 * Accessibility check of the built pages — `npm run check:a11y` (after `npm run build`)
 *
 * GIGW 3.0 asks a government portal to meet WCAG 2.1 AA, and the
 * Accessibility Statement says this one is designed to. This serves the static
 * export in out/, signs in with each role's evaluation account where a page
 * needs one, and runs axe-core's WCAG 2.1 A and AA rules on every page listed
 * below. Any violation fails the check, with the element and the reason.
 *
 * It needs an evaluation build (the default: it has the demo accounts) and a
 * Chromium that Playwright can launch — `npx playwright install chromium`
 * once, or PLAYWRIGHT_BROWSERS_PATH where one is already installed.
 * Automated rules catch roughly a third of WCAG failures; they are a floor,
 * not an audit, and a manual audit with assistive technology is still due.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const ROOT = new URL('../out/', import.meta.url).pathname;

const PAGES = {
    visitor: ['/', '/services-info', '/facilities', '/emergency', '/login', '/staff/login', '/privacy', '/terms',
        '/accessibility', '/rti', '/feedback', '/copyright', '/hyperlinking'],
    'District Health Officer': ['/dashboard', '/audit', '/data'],
    'Medical Officer': ['/referrals', '/incoming', '/opd', '/queue', '/medicine', '/diagnostics', '/appointments',
        '/followup', '/facility-resources'],
    'ANM / Nurse': ['/my-dashboard', '/teleconsult'],
    'Super Admin': ['/admin'],
};

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
};

async function isFile(p) {
    try { return (await stat(p)).isFile() ? p : null; } catch { return null; }
}

// The export's own URLs: /queue is out/queue.html.
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
let checked = 0;
try {
    for (const [role, paths] of Object.entries(PAGES)) {
        const context = await browser.newContext();
        const page = await context.newPage();
        if (role !== 'visitor') {
            await page.goto(`${BASE}/staff/login`);
            await page.getByRole('button', { name: new RegExp(role.replace(/[/]/g, '\\/')) }).first().click();
            await page.waitForURL(url => !url.pathname.startsWith('/staff/login'), { timeout: 20000 });
        }
        for (const path of paths) {
            await page.goto(`${BASE}${path}`);
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(800);
            await page.addScriptTag({ content: AXE });
            const violations = await page.evaluate(async () => {
                // eslint-disable-next-line no-undef
                const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
                return result.violations.map(v => ({
                    id: v.id, impact: v.impact, help: v.help,
                    nodes: v.nodes.slice(0, 5).map(n => `${n.target.join(' ')} — ${(n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? ''}`),
                }));
            });
            checked += 1;
            if (violations.length === 0) {
                console.log(` PASS ${role.padEnd(24)} ${path}`);
            } else {
                failed += 1;
                console.log(` FAIL ${role.padEnd(24)} ${path}`);
                for (const v of violations) console.log(`      [${v.impact}] ${v.id}: ${v.help}\n        ${v.nodes.join('\n        ')}`);
            }
        }
        await context.close();
    }
} finally {
    await browser.close();
    server.close();
}

console.log(failed === 0
    ? `\nAll ${checked} pages pass axe-core's WCAG 2.1 A/AA rules.\n`
    : `\n${failed} of ${checked} page(s) have WCAG 2.1 A/AA violations.\n`);
process.exit(failed === 0 ? 0 : 1);
