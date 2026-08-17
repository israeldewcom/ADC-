// ============================================================
// FILE: public/sw.js (PERFECT – UPDATE VERSION ON EVERY DEPLOY)
// ============================================================

// ─── CONFIGURATION ─────────────────────────────────────────────────────
// 🔥 IMPORTANT: Increment this number every time you deploy a new frontend version.
// This forces the service worker to update and clear all old caches.
const CACHE_VERSION = 'changex-v11';

// Cache names – versioned to allow easy cleanup
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const BOOK_CACHE = `books-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Static assets that are required for the app to work offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/offline.html'
];

// ─── INSTALL ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete any caches that are not part of the current version
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
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// ─── FETCH ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;

  // ─── 1. API REQUESTS – Stale‑While‑Revalidate ─────────────────────
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Make network request and update cache
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              // Only cache successful responses
              if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // If network fails and we have a cached response, return it
              if (cachedResponse) {
                return cachedResponse;
              }
              // No cache and network failed – return offline JSON
              return new Response(
                JSON.stringify({
                  success: false,
                  message: 'You are offline. Please check your connection.',
                }),
                {
                  headers: { 'Content-Type': 'application/json' },
                  status: 503,
                }
              );
            });

          // Return cached response immediately if available, else wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── 2. BOOKS & PDFs – Cache with Network Fallback ────────────────
  if (url.pathname.includes('/books/') || url.pathname.includes('/uploads/books/')) {
    event.respondWith(
      caches.open(BOOK_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── 3. IMAGES (Cloudinary & local) ───────────────────────────────
  if (
    url.hostname.includes('cloudinary.com') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ─── 4. STATIC ASSETS (Cache First) ────────────────────────────────
  // This includes index.html, manifest, etc.
  if (STATIC_ASSETS.some((asset) => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request);
      })
    );
    return;
  }

  // ─── 5. DEFAULT – Network First with Offline Fallback ─────────────
  // For everything else (e.g., external fonts, dynamic content)
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback to offline.html (or the home page)
        return caches.match('/offline.html') || caches.match('/');
      });
    })
  );
});
