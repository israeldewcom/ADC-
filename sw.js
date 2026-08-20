// ============================================================
// FILE: public/sw.js (COMPLETE – PRODUCTION READY)
// ============================================================

// 🔥 IMPORTANT: Change this on EVERY deploy
const CACHE_VERSION = 'changex-v13';  // ← BUMP THIS ON EVERY DEPLOY!

// ─── CACHE NAMES ─────────────────────────────────────────────────────
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const BOOK_CACHE = `books-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/offline.html'
];

// ─── INSTALL ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing:', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const validCaches = [STATIC_CACHE, API_CACHE, BOOK_CACHE, IMAGE_CACHE];
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ─── FETCH ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;

  // ─── 1. HTML – NETWORK FIRST ──────────────────────────────────────
  if (request.mode === 'navigate' || request.url.includes('index.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request) || caches.match('/offline.html') || caches.match('/');
        })
    );
    return;
  }

  // ─── 2. API – STALE-WHILE-REVALIDATE ─────────────────────────────
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── 3. BOOKS & PDFs ──────────────────────────────────────────────
  if (url.pathname.includes('/books/') || url.pathname.includes('/uploads/books/')) {
    event.respondWith(
      caches.open(BOOK_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
        });
      })
    );
    return;
  }

  // ─── 4. IMAGES ─────────────────────────────────────────────────────
  if (
    url.hostname.includes('cloudinary.com') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|avif)$/i)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
        });
      })
    );
    return;
  }

  // ─── 5. STATIC ASSETS (JS, CSS, fonts) – Cache First ─────────────
  if (url.pathname.match(/\.(js|css|woff2|ttf|eot)$/i)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request);
      })
    );
    return;
  }

  // ─── 6. DEFAULT – Network First ───────────────────────────────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── UPDATE CHECK ────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
