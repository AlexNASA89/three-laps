// build: c546bb5a07
// Service worker: всё в кэш при установке, дальше cache-first (офлайн). Версия и список файлов — precache.json (tools/build_sw.py).
const CACHE_PREFIX = "threelaps-";
let CACHE = null;
async function manifest() { const r = await fetch("precache.json", { cache: "no-store" }); return r.json(); }
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const m = await manifest(); CACHE = CACHE_PREFIX + m.version;
    const c = await caches.open(CACHE); let n = 0;
    const post = async () => { for (const cl of await self.clients.matchAll({ includeUncontrolled: true })) cl.postMessage({ type: "precache", n, total: m.files.length, version: m.version }); };
    for (let i = 0; i < m.files.length; i += 8) { await Promise.all(m.files.slice(i, i + 8).map((f) => c.add(new Request(f, { cache: "reload" })).then(() => n++))); await post(); }
    await post();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const m = await manifest().catch(() => null); const keep = m ? CACHE_PREFIX + m.version : null;
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== keep) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(e.request); } catch { const h = await caches.match("index.html"); return h || Response.error(); }
  })());
});
