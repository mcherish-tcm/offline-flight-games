/*
 * Service worker — เก็บทุกไฟล์ไว้ในเครื่อง แล้วเปิดจากเครื่องก่อนเสมอ (cache-first)
 * แก้ไฟล์ใดก็ตามแล้วจะส่งขึ้นเว็บ → เพิ่มเลข CACHE_VERSION ทุกครั้ง
 * (มือถือจะเห็นแถบ "มีเวอร์ชันใหม่ — แตะเพื่อรีโหลด")
 */
const CACHE_VERSION = 'v7.1';
const CACHE_PREFIX = 'flightgames-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

importScripts('shared/games.js');
const FILES = self.FG_ALL_FILES;

function abs(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' = ข้าม HTTP cache ของเบราว์เซอร์ ได้ไฟล์ใหม่จริง
      cache.addAll(FILES.map((f) => new Request(abs(f), { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;

      // "games/2048" (ไม่มี / ท้าย) หรือ "games/2048/" → index.html ของโฟลเดอร์นั้น
      if (req.mode === 'navigate') {
        const base = url.href.split(/[?#]/)[0];
        if (base.endsWith('/')) {
          hit = await cache.match(base + 'index.html');
          if (hit) return hit;
        } else if (await cache.match(base + '/')) {
          // ต้องพาไปที่อยู่ที่มี / ท้าย ไม่งั้นลิงก์แบบ relative ในหน้าจะเพี้ยน
          return Response.redirect(base + '/', 302);
        }
      }

      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') {
          const home = await cache.match(abs('./'));
          if (home) return home;
        }
        return new Response('ออฟไลน์อยู่ และไฟล์นี้ยังไม่ได้เก็บไว้ในเครื่อง', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'status') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(FILES.map((f) => cache.match(abs(f)).then((r) => (r ? null : f)))))
      .then((results) => {
        const missing = results.filter(Boolean);
        port.postMessage({
          version: CACHE_VERSION,
          total: FILES.length,
          have: FILES.length - missing.length,
          missing: missing
        });
      })
      .catch(() => port.postMessage({ version: CACHE_VERSION, total: FILES.length, have: 0, missing: FILES }));
  }
});
