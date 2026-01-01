const CACHE_NAME = 'secredit-v6';
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
  './js/locales/en.js',
  './js/locales/es.js',
  './js/locales/ar.js',
  './js/locales/it.js',
  './js/locales/fr.js',
  './js/locales/de.js',
  './js/locales/zh.js',
  './js/locales/hi.js',
  './js/locales/pt.js',
  './js/locales/bn.js'
];

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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});
