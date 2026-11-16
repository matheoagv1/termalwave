import maplibregl from "maplibre-gl";

// light client tile cache (Cache API + LRU). edge cache stays on the Worker.
// only caches GET image/tile responses; skips auth-sensitive paths

const CACHE_NAME = "tw-tiles-v1";
const TTL_MS = 45 * 60 * 1000;
const MAX_ENTRIES = 360;
const PROTO = "twtile";
const META = "x-tw-cached-at";

let installed = false;
const order: string[] = [];

function touch(key: string): void {
  const i = order.indexOf(key);
  if (i >= 0) order.splice(i, 1);
  order.push(key);
}

async function trim(cache: Cache): Promise<void> {
  while (order.length > MAX_ENTRIES) {
    const key = order.shift();
    if (!key) break;
    await cache.delete(key);
  }
}

function cacheable(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\/api\/(auth|session|login)/i.test(url)) return false;
  return (
    /\/(tiles|clouds|basemap|terrarium|assets)\b/i.test(url) ||
    /\.(png|jpe?g|webp|pbf)(\?|$)/i.test(url)
  );
}

async function load(url: string, signal?: AbortSignal): Promise<{ data: ArrayBuffer }> {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(url);
  if (hit) {
    const at = Number(hit.headers.get(META) || 0);
    if (at && Date.now() - at < TTL_MS) {
      touch(url);
      return { data: await hit.arrayBuffer() };
    }
    await cache.delete(url);
  }
  const res = await fetch(url, { signal, credentials: "same-origin" });
  if (!res.ok) throw new Error(`tile ${res.status}`);
  const data = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set(META, String(Date.now()));
  headers.set("content-type", res.headers.get("content-type") || "image/png");
  await cache.put(url, new Response(data.slice(0), { status: 200, headers }));
  touch(url);
  await trim(cache);
  return { data };
}

/** Register once. Call before Map construction. */
export function installTileCache(): void {
  if (installed || typeof window === "undefined") return;
  if (!("caches" in window)) return;
  installed = true;
  maplibregl.addProtocol(PROTO, async (req) => {
    const raw = req.url.replace(new RegExp(`^${PROTO}://`), "https://");
    // twtile://host/path → https://host/path
    const real = raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;
    return load(real);
  });
}

/** Rewrite cacheable http(s) tile urls to the twtile protocol. */
export function cachedTileUrl(url: string): string {
  if (!installed || !cacheable(url)) return url;
  return `${PROTO}://${url.replace(/^https?:\/\//i, "")}`;
}

export function tileCacheTransformRequest(
  url: string,
  resourceType?: string,
): { url: string } {
  if (resourceType === "Tile" || resourceType === "Image") {
    return { url: cachedTileUrl(url) };
  }
  return { url };
}
