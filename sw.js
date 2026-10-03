// Setiap update: ganti angka CACHE_NAME ini DAN angka ?v= di index.html (harus sama)
const CACHE_NAME = 'kasir-daeng-v4.15';

const urlsToCache = [
  './',
  './index.html',
  './style.css?v=4.15',
  './main.js?v=4.15',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// INSTALL: simpan file penting satu per satu.
// Kalau ada 1 file yang tidak ada (mis. icon-512.png), yang lain tetap tersimpan.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        urlsToCache.map(url =>
          cache.add(url).catch(err => console.log('Gagal cache:', url, err))
        )
      )
    )
  );
});

// ACTIVATE: hapus cache versi lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(
          names.map(name => {
            if (name !== CACHE_NAME) return caches.delete(name);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// FETCH: Network First, kalau offline ambil dari cache
self.addEventListener('fetch', event => {
  const req = event.request;

  // Abaikan selain GET dan selain file milik aplikasi sendiri
  // (Supabase, CDN, dan Google Login tidak disentuh service worker)
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
          // Kalau halaman dibuka saat offline dan tidak ketemu, tampilkan index.html
          if (req.mode === 'navigate') return caches.match('./index.html');
        })
      )
  );
});
