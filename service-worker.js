const basePath = self.location.pathname.replace(/\/[^/]*$/, '');

const filesToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/user.json'
].map(path => basePath + path);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('qoopio-cache').then((cache) => cache.addAll(filesToCache))
  );
});


self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
