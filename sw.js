// Offline cache. Bump VERSION whenever the game files change so phones fetch the new ones.
const VERSION = 'nami-v3.18';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './src/main.js', './src/version.js', './src/album.js', './src/ui.js', './src/choice.js', './src/bridge.js', './src/bridgeart.js', './src/garden.js', './src/gardenart.js', './src/sim.js', './src/ocean.js', './src/art.js', './src/audio.js', './src/input.js', './src/tilt.js', './src/waveshape.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // always ask GitHub for the newest file (no-cache = check before using the browser's copy), so a new version shows on the next open
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
