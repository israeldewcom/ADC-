const CACHE_VERSION = 'changex-v8';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const BOOK_CACHE = `books-${CACHE_VERSION}`;

// Core assets to cache on install (add your own critical files)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512x512.png',
  // Add any other critical files (e.g., CSS, fonts, etc.)
];

// ─── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())  // Activate immediately
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !key.startsWith('changex-v')) // Keep only current version
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // Take control of all pages
  );
});

// ─── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;

  // 1. API requests – stale‑while‑revalidate
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 2. Book files (Cloudinary / raw uploads) – cache with fallback
  if (url.pathname.includes('/raw/upload/') || url.pathname.includes('/books/')) {
    event.respondWith(
      caches.open(BOOK_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Static assets – cache first
  if (STATIC_ASSETS.some((asset) => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // 4. Default – network with offline fallback
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match('/offline.html') || caches.match('/');
    })
  );
});
