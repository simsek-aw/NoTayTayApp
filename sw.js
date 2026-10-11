// ============================================================================
//  Service Worker — Offline-Cache (App-Shell)
// ============================================================================
const CACHE = 'schlummer-v6';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/store.js',
  './js/engine.js',
  './js/sync.js',
  './js/notify.js',
  './js/seed-data.js',
  './js/firebase-config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first für App-Shell, Netzwerk-Fallback (mit Nachcachen)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Externe Anfragen (Firebase-SDK vom CDN, Firestore) NICHT abfangen —
  // die brauchen direkten Netzwerkzugriff (u. a. WebSockets/Long-Polling).
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Netzwerk zuerst: online immer die aktuelle Version (Updates von Code &
  // Config setzen sich sofort durch); offline dient der Cache als Fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
