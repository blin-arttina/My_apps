// Book Animator service worker — offline cache (with PDF.js support)
const CACHE = 'book-animator-v3';

const ASSETS = [
  // App shell
  './',
  './index.html',
  './manifest.webmanifest',

  // Libraries cached for offline
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',

  // FFmpeg-wasm (video/audio mux)
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.7/dist/ffmpeg.min.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js',

  // PDF.js (for PDF → text import)
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Use addAll so cross-origin CDN assets are pre-fetched & stored
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

// Cache-first for app shell and whitelisted CDNs; network fallback.
// When offline, serve cached if present.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === location.origin;
  const allowedCdnHosts = new Set(['cdn.jsdelivr.net']);

  if (sameOrigin || allowedCdnHosts.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const resp = await fetch(event.request);
        // Cache GET 200 responses for future offline use
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