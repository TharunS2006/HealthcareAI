/**
 * Offline pre-cache rules — `npm run verify:service-worker`
 *
 * `npm run check:offline` (after a build, in a browser) proves the built app
 * opens with the server stopped. This covers the rules behind that without a
 * browser or a build:
 *
 *   1. every pre-cached route is a real page, and every role's home after
 *      sign-in is pre-cached — the ANM's dashboard once was not
 *   2. build-file names are read whole from pages, payloads and stylesheets:
 *      never half a name cut at a script-tag boundary, never a source map
 *   3. the post-build stamp fills in the build id and the complete file list,
 *      the stamped worker still parses, each build gets its own cache, and an
 *      unstamped worker still runs
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');

const failures: string[] = [];
function check(label: string, condition: boolean, detail = '') {
    console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${condition ? '' : `\n        ${detail}`}`);
    if (!condition) failures.push(label);
}

interface Worker {
    PRECACHE_ROUTES: string[];
    CACHE_VERSION: string;
    CACHE_NAME: string;
    STAMPED: boolean;
    BUILD_ID: string;
    BUILD_ASSETS: string[];
    staticAssetsIn: (text: string) => Set<string>;
    listeners: string[];
}

/** Run a worker script in a bare context, as a browser would load it, and read its settings. */
function load(source: string): Worker {
    const listeners: string[] = [];
    const context = vm.createContext({
        self: {
            addEventListener: (type: string) => { listeners.push(type); },
            skipWaiting() {},
            clients: { claim() {} },
            location: { origin: 'http://localhost' },
        },
        console,
        URL,
    });
    vm.runInContext(source, context, { filename: 'sw.js' });
    const settings = vm.runInContext(
        '({ PRECACHE_ROUTES, CACHE_VERSION, CACHE_NAME, STAMPED, BUILD_ID, BUILD_ASSETS, staticAssetsIn })',
        context,
    ) as Omit<Worker, 'listeners'>;
    return { ...settings, listeners };
}

console.log('\nNalamMesh — offline pre-cache rules\n');

// ── 1. What is pre-cached ────────────────────────────────────────────────────
console.log('Pre-cached routes:');
const worker = load(SOURCE);
check('the worker installs, activates and serves (all three handlers registered)',
    ['install', 'activate', 'fetch'].every(t => worker.listeners.includes(t)), worker.listeners.join(', '));

// '/404' is Next.js's own not-found page, which the export always writes.
const missingPages = worker.PRECACHE_ROUTES.filter(route => route !== '/404'
    && !existsSync(join(ROOT, 'app', route === '/' ? '' : route, 'page.tsx')));
check(`every one of the ${worker.PRECACHE_ROUTES.length} pre-cached routes is a page in app/`,
    missingPages.length === 0, `no page for: ${missingPages.join(', ')}`);

const { ROLE_HOME } = await import('../lib/auth/permissions');
const homes = Object.entries(ROLE_HOME) as [string, string][];
const homesMissing = homes.filter(([, route]) => !worker.PRECACHE_ROUTES.includes(route));
check('every role\'s home after sign-in is pre-cached (the ANM\'s dashboard above all)',
    homesMissing.length === 0, homesMissing.map(([role, route]) => `${role} → ${route}`).join(', '));
check('…and the sign-in page itself', worker.PRECACHE_ROUTES.includes('/staff/login'));

// ── 2. Reading build-file names ──────────────────────────────────────────────
console.log('\nBuild-file names read from pages and stylesheets:');
const page = [
    '<link rel="stylesheet" href="/_next/static/css/5517e41a6f794e14.css" data-precedence="next"/>',
    '<script src="/_next/static/chunks/webpack-4a1b.js" async></script>',
    // The inline payload, split across two script tags mid-name, as Next.js does.
    '<script>self.__next_f.push([1,"2:I[1,[\\"static/chunks/8660-f061e0e1df9928"])</script>',
    '<script>self.__next_f.push([1,"ab.js\\",\\"static/chunks/app/opd/page-1a2b.js\\"]"])</script>',
    '<script src="/_next/static/chunks/app/dashboard/%5Bid%5D/page-9c.js" async></script>',
    '<script src="/_next/static/chunks/main-app-77.js?dpl=dpl_abc" async></script>',
    '<!-- /_next/static/chunks/main-app-77.js.map -->',
].join('\n');
const names = worker.staticAssetsIn(page);
check('script and stylesheet tags are read', names.has('/_next/static/chunks/webpack-4a1b.js') && names.has('/_next/static/css/5517e41a6f794e14.css'), [...names].join(' '));
check('chunks the inline payload names without /_next/ are read, with the prefix added',
    names.has('/_next/static/chunks/app/opd/page-1a2b.js'), [...names].join(' '));
check('an encoded dynamic segment ([id]) is kept as written', names.has('/_next/static/chunks/app/dashboard/%5Bid%5D/page-9c.js'), [...names].join(' '));
check('a query string is not part of the name', names.has('/_next/static/chunks/main-app-77.js'), [...names].join(' '));
check('a name cut in two at a script-tag boundary is not requested',
    ![...names].some(n => n.includes('8660-f061e0e1df9928')), [...names].join(' '));
check('source maps are not cached', ![...names].some(n => n.endsWith('.map')), [...names].join(' '));
const css = '@font-face{font-family:x;src:url(/_next/static/media/e4af272c-s.p.woff2) format("woff2")}'
    + '.logo{background:url(/_next/static/media/logo.3f2a.svg)}';
const media = worker.staticAssetsIn(css);
check('fonts and images a stylesheet names are read',
    media.has('/_next/static/media/e4af272c-s.p.woff2') && media.has('/_next/static/media/logo.3f2a.svg'), [...media].join(' '));

// ── 3. The post-build stamp ──────────────────────────────────────────────────
console.log('\nThe post-build stamp:');
check('unstamped, the worker still runs on its own version and lists no build files',
    !worker.STAMPED && worker.CACHE_NAME === `nalammesh-${worker.CACHE_VERSION}` && worker.BUILD_ASSETS.length === 0,
    `${worker.STAMPED} ${worker.CACHE_NAME} ${worker.BUILD_ASSETS.length}`);

const { stamp } = await import('./stamp-service-worker.mjs');
const out = mkdtempSync(join(tmpdir(), 'nalammesh-sw-'));
writeFileSync(join(out, 'sw.js'), SOURCE);
const files = ['chunks/main-app-77.js', 'chunks/main-app-77.js.map', 'chunks/app/opd/page-1a2b.js',
    'css/5517e41a6f794e14.css', 'media/e4af272c-s.p.woff2', 'BUILDXYZ/_buildManifest.js'];
for (const file of files) {
    const path = join(out, '_next/static', file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, '/* build output */');
}
const result = await stamp(out, 'BUILDXYZ');
const stamped = load(readFileSync(join(out, 'sw.js'), 'utf8'));
const expected = files.filter(f => !f.endsWith('.map')).map(f => `/_next/static/${f}`).sort();
check('the stamped worker still parses and runs', stamped.listeners.includes('install'));
check('it carries the build id, and its cache is named for that build',
    stamped.STAMPED && stamped.BUILD_ID === 'BUILDXYZ' && stamped.CACHE_NAME === `nalammesh-${stamped.CACHE_VERSION}-BUILDXYZ`,
    `${stamped.BUILD_ID} ${stamped.CACHE_NAME}`);
check('it lists every build file, including ones no page names, and no source map',
    JSON.stringify(stamped.BUILD_ASSETS) === JSON.stringify(expected), JSON.stringify(stamped.BUILD_ASSETS));
check('the stamp reports what it wrote', result.already === false && result.assets.length === expected.length);
const again = await stamp(out, 'BUILDXYZ');
check('stamping the same build twice changes nothing', again.already === true
    && JSON.stringify(load(readFileSync(join(out, 'sw.js'), 'utf8')).BUILD_ASSETS) === JSON.stringify(expected));
writeFileSync(join(out, 'sw.js'), 'self.addEventListener("fetch", () => {});');
let refused = '';
try { await stamp(out, 'BUILDXYZ'); } catch (err) { refused = (err as Error).message; }
check('a worker with nothing to fill in fails the build instead of shipping', refused.includes('no build placeholders'), refused);

console.log('');
if (failures.length) {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
}
console.log('All checks passed — every role\'s screens are pre-cached with the build files they need,');
console.log('and each build installs with its own complete file list.\n');
