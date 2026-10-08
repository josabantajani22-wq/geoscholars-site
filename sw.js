// Geo Scholars Academy — service worker: offline shell + faster repeat visits. Network-first for pages/data, cache-first for assets.
const VERSION = "gsa-v13";
const SHELL = ["/", "/index.html", "/css/style.css", "/js/config.js", "/js/store.js", "/js/app.js", "/data/site.js", "/assets/logo.png", "/assets/hero-contours.svg", "/assets/bg-contours.svg"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;           // never touch Firebase / Google APIs
  const isAsset = /\.(png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);
  if (isAsset) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; }))); return; }
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return res; }).catch(() => caches.match(e.request).then(r => r || caches.match("/index.html"))));
});
