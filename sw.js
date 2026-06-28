// ============================================================
// FILE: public/sw.js (UPGRADED – FULLY OPTIMISED)
// ============================================================

const CACHE_VERSION = 'changex-v10';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const BOOK_CACHE = `books-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/offline.html'
];

// ─── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== API_CACHE && key !== BOOK_CACHE && key !== IMAGE_CACHE) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;

  // ─── API – Stale‑While‑Revalidate ──────────────────────
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            // If network fails and no cache, return offline message
            if (!cached) {
              return new Response(JSON.stringify({
                success: false,
                message: 'You are offline. Please check your connection.',
              }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503,
              });
            }
            return cached;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── Books / PDFs ────────────────────────────────────────
  if (url.pathname.includes('/books/') || url.pathname.includes('/uploads/books/')) {
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

  // ─── Images (Cloudinary) ────────────────────────────────
  if (url.hostname.includes('cloudinary.com') || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
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

  // ─── Static Assets – Cache First ────────────────────────
  if (STATIC_ASSETS.some((asset) => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // ─── Default – Network First with Offline Fallback ─────
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        return caches.match('/offline.html') || caches.match('/');
      });
    })
  );
});
