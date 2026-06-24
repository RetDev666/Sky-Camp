// =============================================
//  Sky Camp — Service Worker
//  Офлайн підтримка + кешування
// =============================================

const CACHE_NAME   = 'skycamp-v1';
const STATIC_CACHE = 'skycamp-static-v1';

// Ресурси для кешування при встановленні
const PRECACHE = [
  '/',
  '/index.html',
  '/programs.html',
  '/faq.html',
  '/css/variables.css',
  '/css/global.css',
  '/css/navigation.css',
  '/css/home.css',
  '/css/responsive.css',
  '/css/animations.css',
  '/js/main.js',
  '/js/animations.js',
  '/manifest.json',
];

// ── Install: pre-cache static assets ─────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-first for API ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // API calls — network only (no caching)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline fallback

      // Return cached immediately, update in background
      return cached || networkFetch;
    })
  );
});

// ── Background sync placeholder ────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    // Future: sync pending bookings when back online
    console.log('[SW] Background sync: bookings');
  }
});
