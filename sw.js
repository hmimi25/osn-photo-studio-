const VERSION = 'osn-studio-v4';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'jszip.min.js', 'cover.png', 'minimal.png', 'crest.png', 'favicon.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.json'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* serve from cache at once, refresh it in the background */
function staleWhileRevalidate(req) {
  return caches.open(VERSION).then(cache => cache.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || net.then(res => res || Response.error());
  }));
}

/* pages: network first (so updates arrive), cache when offline or slow */
function networkFirst(req) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);
  return fetch(req, { signal: ctrl.signal }).then(res => { clearTimeout(t); if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; })
    .catch(() => { clearTimeout(t); return caches.match(req).then(hit => hit || caches.match('index.html')); });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate' && u.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (u.origin === location.origin || FONT_HOSTS.includes(u.hostname)) e.respondWith(staleWhileRevalidate(req));
});
