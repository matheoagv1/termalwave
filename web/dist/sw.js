// Service worker minimo: la app abre sin conexion con lo ultimo que se vio.
// Solo toca recursos del mismo origen; las teselas de mapa externas no se guardan.
const V = "tw-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];
const LIVE = /(app-config|dataset|context)\.json$|\/(series|hotspots|overlays)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const networkFirst = r.mode === "navigate" || LIVE.test(u.pathname);
  e.respondWith(
    networkFirst
      ? fetch(r)
          .then((res) => {
            if (res.ok) caches.open(V).then((c) => c.put(r, res.clone()));
            return res;
          })
          .catch(() => caches.match(r).then((m) => m || caches.match("./index.html")))
      : caches.match(r).then(
          (m) =>
            m ||
            fetch(r).then((res) => {
              if (res.ok) caches.open(V).then((c) => c.put(r, res.clone()));
              return res;
            }),
        ),
  );
});