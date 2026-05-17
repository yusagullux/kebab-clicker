// Kebab Clicker Empire — Service Worker
// Strategy: Cache-first for the shell (index.html + CDN assets), network-first for Firebase.

const CACHE_NAME = 'kebab-clicker-v2';

// Assets to pre-cache on install
const PRECACHE_URLS = [
    '/',
    '/index.html',
];

// CDN origins we cache but don't pre-fetch
const CDN_ORIGINS = [
    'cdn.tailwindcss.com',
    'www.gstatic.com',
];

// Firebase origins — always go to network, never cache
const NETWORK_ONLY_ORIGINS = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebase.googleapis.com',
    'www.googleapis.com',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Firebase / auth APIs — always network only (never cache)
    if (NETWORK_ONLY_ORIGINS.some((o) => url.hostname.includes(o))) {
        return; // let browser handle it normally
    }

    // 2. Non-GET requests — pass through
    if (event.request.method !== 'GET') return;

    // 3. CDN assets (Tailwind, Firebase SDKs) — cache-first with network fallback
    if (CDN_ORIGINS.some((o) => url.hostname.includes(o))) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // 4. Same-origin requests (index.html, sw.js, etc.) — network-first, fall back to cache
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});
