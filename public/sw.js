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
 */

const CACHE_VERSION = 'v3.0.0';
const CACHE_NAME = `nalammesh-${CACHE_VERSION}`;

/**
 * App-shell routes. Every entry below MUST exist in the static export (`out/`).
 * Keep in sync with app/ route segments.
 */
const PRECACHE_ROUTES = [
    '/',
    '/opd',
    '/dashboard',
    '/followup',
    '/diagnostics',
    '/medicine',
    '/referrals',
    '/queue',
    '/teleconsult',
    '/facilities',
    '/emergency',
    '/record',
    '/login',
    '/404',
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
                    const response = await fetch(new Request(url, { cache: 'reload' }));
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
        })()
    );

    self.skipWaiting();
});

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
 * Immutable assets: serve from cache, populate on first miss.
 */
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
 * Everything else: prefer the network, fall back to cache, then to the app shell.
 */
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);
        // Only cache real, complete responses (skip opaque/partial/error)
        if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
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
