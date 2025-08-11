const CACHE_NAME = 'pdb-client-cache-v1';
const FILES = ['/client/','/client/index.html','/client/styles.css','/client/client-app.js','/client/firebaseConfig.js','/assets/logo.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      return caches.open(CACHE_NAME).then(cache => { cache.put(e.request, res.clone()); return res; });
    })).catch(()=>caches.match('/client/index.html'))
  );
});
