const CACHE_NAME = 'pdb-dash-cache-v1';
const FILES = ['/dashboard/','/dashboard/index.html','/dashboard/styles.css','/dashboard/dashboard-app.js','/dashboard/firebaseConfig.js','/assets/logo.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { return caches.open(CACHE_NAME).then(cache => { cache.put(e.request, res.clone()); return res; }); })).catch(()=>caches.match('/dashboard/index.html'))); });
