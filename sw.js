/* Dead Time — offline cache.
   Online: grab the fresh file (so your GitHub uploads still show up).
   Weak or no signal: after 3 seconds, fall back to the saved copy. */
const CACHE = 'dead-time-v1';
const CORE  = ['./', './index.html'];
const EXTRA = ['./teaser.html'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    for (const f of EXTRA) { try { await c.add(f); } catch (_) {} }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache  = await caches.open(CACHE);
    const cached = await cache.match(e.request, { ignoreSearch: true });

    const net = fetch(e.request).then(r => {
      if (r && r.ok) cache.put(e.request, r.clone());
      return r;
    });
    net.catch(() => {});

    try {
      return await Promise.race([
        net,
        new Promise((_, no) => setTimeout(() => no('slow'), 3000))
      ]);
    } catch (_) {
      if (cached) return cached;
      try { return await net; }
      catch (_) { return (await cache.match('./index.html')) || Response.error(); }
    }
  })());
});
