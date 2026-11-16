// anto design system: service worker template
//
// copy this file to your public root as sw.js and register it with
// registerServiceWorker from pwa.ts. cache-first for the app shell,
// network-first fallback for everything else. bump CACHE_NAME on every
// deploy that changes cached files, which is what triggers the update flow

const CACHE_NAME = 'anto-app-v1';

// add the files your app shell needs to boot offline. keep this list short,
// its loaded eagerly on install
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return res;
        })
        .catch(() => cached);
    })
  );
});
