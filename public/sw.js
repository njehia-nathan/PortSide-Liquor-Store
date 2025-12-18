const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `portside-pos-app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `portside-pos-static-${CACHE_VERSION}`;
const NEXT_STATIC_CACHE = `portside-pos-next-static-${CACHE_VERSION}`;

// Note: This is a Next.js app. There is no /index.html or /index.css in production.
// We cache the app shell (/) and manifest/icons so the UI can boot offline.
const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      console.log('[SW] Caching app shell assets');
      await cache.addAll(APP_SHELL_ASSETS);
    })()
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => ![
            APP_SHELL_CACHE,
            STATIC_CACHE,
            NEXT_STATIC_CACHE,
          ].includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isNextStatic = url.pathname.startsWith('/_next/static/');
  const isIconOrManifest = url.pathname === '/manifest.json' || url.pathname.startsWith('/icons/');

  // Navigation requests: network-first, fallback to cached app shell.
  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(APP_SHELL_CACHE);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (e) {
          // If offline, serve the cached home page (app shell)
          const cached = await caches.match('/', { cacheName: APP_SHELL_CACHE });
          return cached || caches.match('/');
        }
      })()
    );
    return;
  }

  // Next.js build assets: cache-first (critical for offline usability).
  if (isNextStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(NEXT_STATIC_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (e) {
          return cached;
        }
      })()
    );
    return;
  }

  // Icons/manifest and other same-origin static files: stale-while-revalidate.
  if (isIconOrManifest) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        return cached || (await networkPromise) || cached;
      })()
    );
    return;
  }

  // Default: network-first with cache fallback.
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (e) {
        return cache.match(event.request);
      }
    })()
  );
});
