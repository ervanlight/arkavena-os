// Minimal service worker: installability (Chrome requires a registered SW
// with a fetch handler before it will offer "Add to Home Screen") plus a
// static offline fallback page. The real offline capability D3 asks for --
// read cache + a per-field outbox -- lives in the application layer
// (IndexedDB), not here. Caching authenticated, dynamic Next.js pages at
// the HTTP layer is fragile and is not what this file is for; it only
// makes sure a field user with zero connectivity sees a clear Indonesian
// message instead of the browser's own error page.

const CACHE_NAME = 'siteflow-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only ever intercept page navigations. Everything else (RSC data
  // fetches, server action POSTs, static assets) passes straight through --
  // intercepting those risks serving a stale or wrong response for
  // something the app itself needs to reason about (e.g. the outbox
  // deciding whether a mutation actually reached the server).
  if (event.request.mode !== 'navigate') return;

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
