const CACHE_NAME = 'secredit-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/style.css',
  './js/i18n.js',
  './js/main.js',
  './js/ui.js',
  './js/encoding.js',
  './js/crypto.js',
  './js/worker.js',
  './js/locales/en.js'
];

const shouldCacheResponse = (response) => response && response.ok && response.type === 'basic';

const putInCache = async (request, response) => {
  if (!shouldCacheResponse(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

self.addEventListener('install', (event) => {
  // Skip waiting to activate the new worker immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately so the new worker controls the page
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate'
    || event.request.destination === 'document'
    || (event.request.headers.get('accept') || '').includes('text/html');

  const isCodeAsset = event.request.destination === 'script'
    || event.request.destination === 'style'
    || event.request.destination === 'worker';

  const networkFirst = async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      event.waitUntil(putInCache(event.request, response.clone()));
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error('Network error');
    }
  };

  const staleWhileRevalidate = async () => {
    const cached = await caches.match(event.request);
    const update = fetch(event.request).then((response) => putInCache(event.request, response.clone()));
    event.waitUntil(update);
    return cached || fetch(event.request);
  };

  event.respondWith((isNavigation || isCodeAsset) ? networkFirst() : staleWhileRevalidate());
});
