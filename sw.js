/* Service worker — Abreu Lantigua v2
   Estrategia mixta:
   - El HTML de la app va "red primero": así cada versión nueva que subas a
     GitHub Pages llega al iPhone sin tener que borrar la app. Si no hay red,
     se sirve la última copia cacheada y la app abre igual.
   - Las librerías de CDN y los íconos van "caché primero": no cambian.
   Sin llamadas de red adicionales: solo se cachea lo que la app ya pide. */
const CACHE = 'abreu-lantigua-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './libs/chart.umd.min.js',
  './libs/jspdf.umd.min.js',
  './libs/html2canvas.min.js'
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
        const tipo = res && res.headers ? (res.headers.get('content-type') || '') : '';
        // Un script solo se cachea si de verdad vino como JavaScript. Cachear un
        // HTML de error bajo la URL de Chart.js dejaría la app sin gráficos
        // hasta borrarla del teléfono.
        const tipoOk = e.request.destination !== 'script' || tipo.indexOf('javascript') >= 0 || tipo.indexOf('/ecmascript') >= 0;
        const cacheable = res && res.status === 200 && tipoOk &&
          (url.startsWith(self.location.origin) || url.startsWith('https://cdnjs.cloudflare.com'));
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => {
        /* Antes esto devolvía index.html como respaldo de CUALQUIER recurso.
           Para un <script> del CDN eso significaba entregar HTML con
           content-type text/html: el navegador lo descartaba y Chart quedaba
           sin definir, sin ningún error visible. Mejor devolver un error real
           para que la app lo detecte y reintente la carga. */
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      });
    })
  );
});
