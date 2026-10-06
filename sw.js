// Service worker mínimo: hace la página instalable y la abre rápido.
// Siempre intenta primero la red (así las actualizaciones se ven al instante)
// y solo usa la copia guardada si no hay internet. NUNCA guarda datos del salón.
const CACHE = 'maison-v1';
const SHELL = ['./', 'index.html', 'config.js', 'logo.jpg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // el servidor de Google y otros no se tocan
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
