/**
 * NalamMesh Service Worker
 * Provides offline caching for the PWA shell
 * Falls back to cached content when offline
 */

const CACHE_NAME = 'nalammesh-v2.4.0';
const STATIC_ASSETS = [
    '/',
    '/triage',
    '/dashboard',
    '/ambulance',
    '/mesh-demo',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Install: Pre-cache critical app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching app shell');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-first with cache fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and WebSocket connections
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/socket.io/')) return;
    if (event.request.url.includes('hot-update')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Offline: serve from cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;

                    // Fallback for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }

                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
