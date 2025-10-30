self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('qoopio-cache').then((cache) => {
    return cache.addAll(['/', '/index.html', '/manifest.json', '/icon.png', '/user.json']);
  }));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
