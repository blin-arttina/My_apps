// Book Animator service worker — offline cache
const CACHE = 'book-animator-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  // libs cached for offline:
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.7/dist/ffmpeg.min.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

// Cache-first for our app + the CDN libraries above.
// Network fallback; when offline, return cached if present.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === location.origin;
  const isAllowedCdn = url.hostname === 'cdn.jsdelivr.net';

  if (sameOrigin || isAllowedCdn) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const resp = await fetch(event.request);
        if (event.request.method === 'GET' && resp.status === 200) {
          cache.put(event.request, resp.clone());
        }
        return resp;
      } catch {
        return cached || new Response('Offline', { status: 503 });
      }
    })());
  }
});