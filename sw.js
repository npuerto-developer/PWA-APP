// sw.js //
const CACHE_NAME = 'mi-pwa-cache-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './webrtc.js',
  './manifest.json',
  './icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
