const CACHE_NAME = 'kasir-daeng-v4.12'; // Ganti angkanya misal jadi v4.11 kalau lu ada update codingan besar di Github
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];

// Tahap Install: Simpan semua file penting ke Cache HP
self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa Service Worker baru buat langsung aktif (nggak nunggu browser ditutup)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache berhasil dibuka');
        return cache.addAll(urlsToCache);
      })
  );
});

// Tahap Activate: Bersihkan sisa-sisa Cache versi lama biar memori HP nggak penuh
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Langsung ambil alih halaman yang lagi kebuka
  );
});

// Tahap Fetch (Strategi: Network First, Fallback to Cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Kalau online dan sukses dapat data terbaru dari server, simpan ke cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // Kalau gagal fetch (berarti lagi OFFLINE/Sinyal jelek), ambil dari Cache
        return caches.match(event.request);
      })
  );
});
