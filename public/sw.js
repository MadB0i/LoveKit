/* ============================================================
   LoveKit service worker — app-shell caching, offline-first.
   - Same-origin GET only. No analytics, no tracking, no third parties.
   - Caches the APP SHELL (html/js/css/icons). User content lives in
     localStorage/IndexedDB on the device and is NEVER put in this cache:
     share-link payloads travel in the URL hash (never sent to any server),
     capsules stay ciphertext in localStorage.
   - Versioned cache: bump CACHE_VERSION per release; old caches are purged.
   ============================================================ */

const CACHE_VERSION = 'lovekit-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon-180.png',
];
const RUNTIME_MAX_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        /* offline on first install — runtime caching covers later visits */
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting();
});

async function trimRuntime() {
  try {
    const cache = await caches.open(CACHE_VERSION);
    const keys = await cache.keys();
    const overflow = keys.length - (SHELL.length + RUNTIME_MAX_ENTRIES);
    for (let i = 0; i < overflow; i++) await cache.delete(keys[i]);
  } catch {
    /* cache API hiccup — never break the page over it */
  }
}

function backgroundRefresh(request) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        eventRefCachePut(request, copy);
      }
      return res;
    })
    .catch(() => undefined);
}

function eventRefCachePut(request, response) {
  caches
    .open(CACHE_VERSION)
    .then((cache) => cache.put(request, response).then(() => trimRuntime()))
    .catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // never touch third parties

  // Navigations (including inbound share-target GETs): network first so the
  // shell stays fresh, cached shell when offline. Hash routes render client-side.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) eventRefCachePut('./index.html', res.clone());
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((hit) => {
            if (hit) return hit;
            return new Response('LoveKit needs to load once while online. Please reconnect. ❤️', {
              status: 503,
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            });
          }),
        ),
    );
    return;
  }

  // Static assets: cache-first for instant launches, refresh in background.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        event.waitUntil(backgroundRefresh(req));
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) eventRefCachePut(req, res.clone());
          return res;
        })
        .catch(() => Response.error());
    }),
  );
});
