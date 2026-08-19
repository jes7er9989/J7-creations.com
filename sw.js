// J7 Creations - Service Worker for PWA Offline Support

const CACHE_NAME = 'j7-creations-v10';
const urlsToCache = [
    '/',
    '/index.html',
    '/pages/about',
    '/pages/portfolio',
    '/pages/faq',
    '/pages/services-it',
    '/pages/services-fabrication',
    '/pages/services-installation',
    '/css/styles.css?v=a8fe23a5',
    '/css/mobile-fix.css?v=499ac820',
    '/js/app.js?v=847c3b8a',
    '/js/pricing.js?v=504b612c',
    '/manifest.json',
    '/assets/images/j7-mark-nav.379b77f9.png',
    '/assets/images/j7-wall.fd59da6c.jpg',
    '/assets/images/j7-wall-sm.faab30a7.jpg'
];

// Install event - cache assets
// Files are cached individually rather than via cache.addAll(), which is
// atomic: a single 404 there rejects the whole promise, install never
// completes, and offline support silently stops working site-wide.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.all(
                urlsToCache.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('SW: could not cache', url, err);
                    })
                )
            ))
    );
    self.skipWaiting();
});

// Fetch event
//
// Content (pages, scripts, styles) is network-first: a plain cache-first
// worker keeps serving an old copy long after a change is deployed, which
// means an updated price would never reach anyone who had visited before.
// The cache is still there as the offline fallback.
//
// Images and media are cache-first, since they are large, change rarely, and
// get new filenames when they do.
function isContent(request) {
    if (request.mode === 'navigate') return true;
    return ['script', 'style', 'document'].includes(request.destination);
}

function cacheIfOk(request, response) {
    if (!response || response.status !== 200 || response.type !== 'basic') return response;
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    return response;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    // Leave third-party requests (fonts, analytics) alone entirely — they have
    // their own caching and we have no useful offline copy of them.
    if (new URL(request.url).origin !== self.location.origin) return;

    if (isContent(request)) {
        // Network first, falling back to cache when offline.
        // Only a navigation may fall back to the homepage: handing index.html
        // to a failed script or stylesheet request just yields a parse error.
        event.respondWith(
            fetch(request)
                .then(response => cacheIfOk(request, response))
                .catch(() => caches.match(request).then(hit => {
                    if (hit) return hit;
                    if (request.mode === 'navigate') return caches.match('/index.html');
                    return Response.error();
                }))
        );
        return;
    }

    // Cache first for everything else
    event.respondWith(
        caches.match(request).then(hit =>
            hit || fetch(request).then(response => cacheIfOk(request, response))
        )
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
