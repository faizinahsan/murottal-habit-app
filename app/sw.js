// App shell: stale-while-revalidate (no version bump needed, the next load gets the update).
// API: network first, cached copy when offline. Fonts: cache first. Audio: always network.
const SHELL = 'shell', DATA = 'data', FONTS = 'fonts';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'search.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API first: it may share the app's origin, and its data must not be served stale from the shell cache.
  if (url.pathname.startsWith('/surahs')) {
    e.respondWith(fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); } return res; })
      .catch(async () => (await caches.match(req)) ?? Response.error()));
  } else if (url.origin === location.origin) {
    e.respondWith(caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
      return hit ?? fresh;
    }));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
      const copy = res.clone(); caches.open(FONTS).then((c) => c.put(req, copy)); return res;
    })));
  }
});
