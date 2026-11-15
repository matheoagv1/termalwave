// tile proxy: edge cache (L1) in front of the nginx origin (L2 + archive), see docs/CACHE.md
// which sources, routes and ttls come from app-config basemaps (config/apis.toml [tiles])
import { json } from "./edge-cache.js";

const TILE_PATH = /\/([a-z0-9_]+)\/(\d{4}-\d{2}-\d{2}|-)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/;
const DAY_MS = 864e5;

/**
 * @param {Request} request
 * @param {{ TILE_ORIGIN?: string, TILE_ORIGIN_HEADER?: string, TILE_ORIGIN_KEY?: string }} env
 * @param {ExecutionContext} ctx
 * @param {() => Promise<Record<string, any>>} loadConfig
 * @returns {Promise<Response | null>} null when the path is not a tile route
 */
export async function handleTile(request, env, ctx, loadConfig) {
  const url = new URL(request.url);
  const m = TILE_PATH.exec(url.pathname);
  if (!m) return null;
  const [, source, date, zs, xs, ys] = m;
  const entries = (await loadConfig()).basemaps?.entries || [];
  const entry = entries.find((e) => e.id === source && e.proxy_template && e.tile_cache);
  if (!entry) return null;

  const tmpl = String(entry.proxy_template);
  const path = tmpl.replace("{date}", date).replace("{z}", zs).replace("{x}", xs).replace("{y}", ys);
  if (path !== url.pathname) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);

  const z = Number(zs);
  const x = Number(xs);
  const y = Number(ys);
  const side = 2 ** z;
  if (z > Number(entry.max_zoom ?? 22) || x >= side || y >= side) return json({ error: "tile_out_of_range" }, 404);

  const policy = pickPolicy(entry.tile_cache, tmpl.includes("{date}") ? date : null);
  if (!policy) return json({ error: "bad_date" }, 400);
  if (!env.TILE_ORIGIN || !env.TILE_ORIGIN_HEADER || !env.TILE_ORIGIN_KEY) {
    return json({ error: "tile_origin_unset" }, 503);
  }

  const route = tmpl.slice(0, tmpl.indexOf(`/${source}/`));
  const tail = `${route}/${policy.name}/${source}/${date}/${z}/${x}/${y}`;
  const key = new Request(`https://edge.termalwave${tail}`);
  const cache = caches.default;

  const hit = await cache.match(key);
  if (hit) return forBrowser(hit, policy, "edge");

  const res = await fetch(env.TILE_ORIGIN.replace(/\/$/, "") + tail, {
    headers: { [env.TILE_ORIGIN_HEADER]: env.TILE_ORIGIN_KEY },
  });
  if (res.status === 404) return json({ error: "tile_not_found" }, 404);
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.startsWith("image/")) {
    console.warn("tile_origin", source, res.status);
    return json({ error: "upstream_unavailable" }, 502);
  }

  const body = await res.arrayBuffer();
  const stored = new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${policy.edge_ttl_s}${policy.immutable ? ", immutable" : ""}`,
    },
  });
  ctx.waitUntil(cache.put(key, stored));
  const origin = (res.headers.get("x-cache-status") || "unknown").toLowerCase();
  return forBrowser(new Response(body, { headers: { "content-type": type } }), policy, `origin-${origin}`);
}

/**
 * dated tiles close to today may still be filling in upstream, so they get the short
 * "recent" ttls instead of being archived; future dates are rejected
 * @returns {{ name: string, edge_ttl_s: number, browser_ttl_s: number, immutable: boolean } | null}
 */
function pickPolicy(tc, date) {
  const base = { name: tc.policy, edge_ttl_s: tc.edge_ttl_s, browser_ttl_s: tc.browser_ttl_s, immutable: tc.immutable };
  if (date === null) return base;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== date) return null;
  const ageDays = Math.floor((Date.now() - t) / DAY_MS);
  if (ageDays < 0) return null;
  if (tc.recent && ageDays < tc.recent.days) {
    return { name: "recent", edge_ttl_s: tc.recent.edge_ttl_s, browser_ttl_s: tc.recent.browser_ttl_s, immutable: false };
  }
  return base;
}

function forBrowser(res, policy, via) {
  const out = new Response(res.body, { headers: { "content-type": res.headers.get("content-type") || "image/png" } });
  out.headers.set(
    "cache-control",
    `private, max-age=${policy.browser_ttl_s}${policy.immutable ? ", immutable" : ""}`,
  );
  out.headers.set("x-tile-cache", via);
  return out;
}
