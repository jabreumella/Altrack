/* Service worker — Abreu Lantigua v2
   Estrategia mixta:
   - El HTML de la app va "red primero": así cada versión nueva que subas a
     GitHub Pages llega al iPhone sin tener que borrar la app. Si no hay red,
     se sirve la última copia cacheada y la app abre igual.
   - Las librerías de CDN y los íconos van "caché primero": no cambian.
   Sin llamadas de red adicionales: solo se cachea lo que la app ya pide. */
const CACHE = 'abreu-lantigua-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ¿Es el documento de la app? Navegaciones e index.html. */
function esDocumento(req) {
  return req.mode === 'navigate' ||
         (req.destination === 'document') ||
         req.url.endsWith('/index.html') ||
         req.url.endsWith('/');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (esDocumento(e.request)) {
    // Red primero, caché como respaldo.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Resto: caché primero.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const url = e.request.url;
        const cacheable = res && res.status === 200 &&
          (url.startsWith(self.location.origin) || url.startsWith('https://cdnjs.cloudflare.com'));
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
