// Service worker: permite instalar Forest War como app y guarda los archivos
// del juego para que cargue rápido. Siempre intenta la red primero para
// recibir actualizaciones; la partida en sí necesita conexión.
const CACHE = 'forest-war-v1';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/css/style.css',
  '/js/art.js', '/js/audio.js', '/js/game.js', '/js/ui.js', '/socket.io/socket.io.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/socket.io/') && url.search) return; // tráfico en tiempo real
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('/index.html')))
  );
});
