/**
 * Enterprise POS Service Worker
 * Provides offline shell caching, stale-while-revalidate for assets, and network fallback
 */

const CACHE_NAME = 'angkor-pos-v1';
const STATIC_ASSETS = [
  '/',
  '/pos',
  '/customer-display',
  '/settings/sync',
  '/settings/hardware',
  '/manifest.json',
];

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching static assets non-critical error:', err);
      });
    }),
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

// Fetch: Network-first for navigations and API catalog, cache-first/stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (e.g. POST /api/checkout) — handled by IndexedDB offline queue
  if (req.method !== 'GET') {
    return;
  }

  // Next.js static assets and chunks: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cached) => {
          const fetched = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fetched;
        });
      }),
    );
    return;
  }

  // Navigation requests (HTML pages): Network-first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            // Fallback to POS shell if specific page is not in cache
            return caches.match('/pos');
          });
        }),
    );
    return;
  }

  // API GET requests (e.g. /api/pos/init or /api/health): Network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !url.pathname.includes('/health')) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req);
        }),
    );
  }
});
