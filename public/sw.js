/**
 * NalamMesh Service Worker — Offline-First App Shell
 * Government of Maharashtra • Public Health Department • NHM
 *
 * Strategy:
 *   • Static export routes (HTML) → network-first, cache fallback (fresh when online, works offline)
 *   • /_next/static/* (content-hashed, immutable) → cache-first (instant + offline safe)
 *   • Everything else GET → network-first, cache fallback
 *   • Navigation miss → cached shell for that route, else '/' , else offline response
 *
 * Pre-caching is intentionally NON-ATOMIC: each asset is added individually so a single
 * 404 cannot abort the whole install (cache.addAll() rejects the install on any failure).
 *
 * A route's HTML alone does not work offline: it names the JavaScript and CSS that make
 * the screen run, and the page that installs this worker loads them before the worker
 * controls it. So install also caches the build's own files — every /_next/static file
 * the build produced (BUILD_ASSETS), plus any the pre-cached pages and their stylesheets
 * name. Without that, a phone that installed the app and then lost signal opened screens
 * that rendered but never became usable. */

// Bump on every change to PRECACHE_URLS — the activate handler deletes caches whose
// key doesn't match, so a stale client would otherwise keep serving the old app shell
// and never pick up newly added routes.
const CACHE_VERSION = 'v4.1.0';

// Filled in after `next build` by scripts/stamp-service-worker.mjs (npm run build runs
// it): this build's id, so every deploy installs afresh and caches its own files, and
// every /_next/static file it produced — including chunks a screen loads on demand,
// which no page names. Left unstamped (a bare `next build`), the worker still caches
// what the pre-cached pages name.
const BUILD_ID = '__NALAMMESH_BUILD_ID__';
const BUILD_ASSETS = [/*__NALAMMESH_BUILD_ASSETS__*/];
const STAMPED = !BUILD_ID.includes('NALAMMESH_BUILD_ID');
const CACHE_NAME = `nalammesh-${CACHE_VERSION}${STAMPED ? `-${BUILD_ID}` : ''}`;

/**
 * App-shell routes. Every entry below MUST exist in the static export (`out/`).
 * Keep in sync with app/ route segments. */
const PRECACHE_ROUTES = [
    '/',
    '/opd',
    '/dashboard',
    '/followup',
    '/diagnostics',
    '/medicine',
    '/referrals',
    '/queue',
    '/appointments',
    '/teleconsult',
    '/facilities',
    '/services-info',
    '/emergency',
    '/record',
    '/audit',
    '/login',
    '/staff',
    '/staff/login',
    '/404',
    '/403',
    // Each role's home after sign-in (ROLE_HOME in lib/auth/permissions.ts) — the
    // ANM's above all, who is the one most often without signal — and the screens
    // that say plainly what needs the network rather than falling back to '/'.
    '/my-dashboard',
    '/facility-resources',
    '/admin',
    '/incoming',
    '/data',
    // Statutory pages (GIGW): small, and a citizen offline should still be able to
    // read the privacy and grievance information the footer promises.
    '/privacy',
    '/terms',
    '/accessibility',
    '/rti',
    '/feedback',
    '/hyperlinking',
    '/copyright',
];

const PRECACHE_ASSETS = [
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

const PRECACHE_URLS = [...PRECACHE_ROUTES, ...PRECACHE_ASSETS];

const OFFLINE_FALLBACK_ROUTE = '/';

// ---------------------------------------------------------------------------
// Install — warm the shell, tolerating individual failures
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            const results = await Promise.allSettled(
                PRECACHE_URLS.map(async (url) => {
                    // { cache: 'reload' } bypasses the HTTP cache so the shell is genuinely fresh.
                    let response = await fetch(new Request(url, { cache: 'reload' }));

                    // Static-export hosting differs: Next writes a directory (with
                    // index.html) only for routes that have children, and a bare
                    // "<route>.html" for leaf routes. Hosts like Vercel/Netlify map the
                    // extension-less path for you; a plain file server (python -m
                    // http.server, GitHub Pages without config) returns 404 and the whole
                    // offline shell would quietly shrink to a handful of routes. Retry with
                    // the .html form so offline works regardless of how this is served.
                    if (!response.ok && !url.includes('.') && url !== '/') {
                        const alt = await fetch(new Request(`${url}.html`, { cache: 'reload' }));
                        if (alt.ok) {
                            // Store under the route the app actually navigates to.
                            await cache.put(url, alt);
                            return url;
                        }
                    }

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    await cache.put(url, response);
                    return url;
                })
            );

            const failed = results
                .map((r, i) => (r.status === 'rejected' ? PRECACHE_URLS[i] : null))
                .filter(Boolean);

            if (failed.length) {
                console.warn('[SW] Pre-cache skipped (not fatal):', failed);
            }
            console.log(`[SW] App shell cached: ${PRECACHE_URLS.length - failed.length}/${PRECACHE_URLS.length}`);

            // The build output: everything the build listed, and whatever the pages
            // name; then anything their stylesheets name that is not already there.
            const pages = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
            const assets = new Set(BUILD_ASSETS);
            for (const url of pages) {
                const cached = await cache.match(url);
                if (cached) staticAssetsIn(await cached.text()).forEach((a) => assets.add(a));
            }
            const media = new Set();
            const first = await cacheAll(cache, [...assets], async (url, response) => {
                if (url.endsWith('.css')) staticAssetsIn(await response.clone().text()).forEach((a) => media.add(a));
            });
            const second = await cacheAll(cache, [...media].filter((a) => !assets.has(a)));
            const missed = first.missed + second.missed;
            console.log(`[SW] Build assets cached: ${first.cached + second.cached}${missed ? `, ${missed} skipped` : ''}`);
        })()
    );

    self.skipWaiting();
});

/**
 * The /_next/static files a page or stylesheet names. Script and stylesheet tags carry
 * the full path; the inline React Server Components payload names its chunks without
 * the /_next/ prefix ("static/chunks/…"), and CSS names fonts as url(/_next/static/media/…).
 * Only whole names count, ending in a file extension: the inline payload is split across
 * script tags, and a name cut in two there must not become a request for half of it.
 * Content-hashed, so a name is a version: caching one is never stale. */
const STATIC_NAME = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-.~/[\]%@]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)(?![A-Za-z0-9_\-.~/[\]%@])/g;

function staticAssetsIn(text) {
    const found = new Set();
    for (const match of text.matchAll(STATIC_NAME)) {
        found.add(`/_next/${match[0].replace(/^\/_next\//, '')}`);
    }
    return found;
}

/**
 * Cache each build file, tolerating failures; `onCached` sees each response cached.
 * A file the previous version already holds is copied from there rather than downloaded
 * again — names are content hashes, so the same name is the same bytes, and an update
 * then costs a facility on metered data only what actually changed. */
async function cacheAll(cache, urls, onCached) {
    let cached = 0;
    let missed = 0;
    await Promise.all(urls.map(async (url) => {
        try {
            const response = (await caches.match(url)) || (await fetch(url));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (onCached) await onCached(url, response);
            await cache.put(url, response);
            cached += 1;
        } catch {
            missed += 1;
        }
    }));
    return { cached, missed };
}

// ---------------------------------------------------------------------------
// Activate — drop superseded caches, take over open clients
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key.startsWith('nalammesh-') && key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Removing stale cache:', key);
                        return caches.delete(key);
                    })
            );
            await self.clients.claim();
        })()
    );
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Never interfere with non-GET (POST/PUT to APIs must fail loudly when offline)
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Same-origin only — leave CDN fonts/tiles to the browser HTTP cache
    if (url.origin !== self.location.origin) return;

    // Next.js dev HMR + build manifests must always hit the network
    if (url.pathname.includes('/_next/webpack-hmr') || url.pathname.includes('hot-update')) return;

    // Content-hashed immutable build output → cache-first
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

/**
 * Immutable assets: serve from cache, populate on first miss. */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        return new Response('', { status: 504, statusText: 'Offline — asset not cached' });
    }
}

/**
 * Everything else: prefer the network, fall back to cache, then to the app shell. */
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);
        // Only cache real, complete responses (skip opaque/partial/error)
        if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
            return response;
        }

        // A 4xx/5xx is a *successful* fetch — it does not throw — so without this the
        // error page would be served even though the shell is sitting in the cache.
        // Static hosts that don't map extension-less paths ("/appointments" ->
        // appointments.html) return 404 for every leaf route; prefer what we cached.
        if (response && !response.ok) {
            const url = new URL(request.url);
            const fallback =
                (await cache.match(request)) ||
                (await cache.match(url.pathname)) ||
                (request.mode === 'navigate' ? await cache.match(OFFLINE_FALLBACK_ROUTE) : null);
            if (fallback) return fallback;
        }

        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Navigations: fall back to the cached shell for that route, then to '/'
        if (request.mode === 'navigate') {
            const url = new URL(request.url);
            const routeMatch =
                (await cache.match(url.pathname)) ||
                (await cache.match(url.pathname.replace(/\/$/, ''))) ||
                (await cache.match(OFFLINE_FALLBACK_ROUTE));
            if (routeMatch) return routeMatch;

            return new Response(
                `<!DOCTYPE html><html lang="mr"><head><meta charset="utf-8">
                 <meta name="viewport" content="width=device-width,initial-scale=1">
                 <title>ऑफलाइन — NalamMesh</title></head>
                 <body style="font-family:system-ui,sans-serif;padding:2.5rem;text-align:center;color:#0F172A">
                 <h1 style="color:#1F3A6E;font-size:1.25rem">ऑफलाइन / Offline</h1>
                 <p style="font-size:.875rem;color:#475569">
                   हे पृष्ठ ऑफलाइन उपलब्ध नाही. कृपया इंटरनेट जोडणी तपासा.<br>
                   This page is not available offline. Saved records remain safe on this device.
                 </p></body></html>`,
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }

        return new Response('', { status: 504, statusText: 'Offline' });
    }
}

// ---------------------------------------------------------------------------
// Allow the page to trigger an immediate activation after an update
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
