// near real-time clouds: nowcoast wms global infrared mosaic behind the edge cache
// l1 = raw capabilities, l2 = our manifest; a tile for a listed hour never changes, so it is archived
// nowcoast stretches each GetMap independently — single 256 tiles seam. we fetch 4×4 metatiles
// (1024 px) so the stretch is shared, and the client crops the 256 it needs
import { edgeBytes, edgeJson, json } from "./edge-cache.js";
import { relayFetch } from "./relay.js";

const EDGE = "https://edge.termalwave/clouds";
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// /{time}/{z}/{x}/{y}.png  or  /{time}/{z}/{x}/{y}.m4.png (metatile origin, 4×4 → 1024 px)
const TILE_PATH = /^\/([0-9TZ:-]{20})\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(\.m(\d+))?\.png$/;
const WINDOW_MS = 24 * 36e5;
const FUTURE_SLACK_MS = 5 * 6e4;
const ARCHIVE_EDGE_S = 30 * 86400;
const IMMUTABLE = "public, max-age=31536000, immutable";
const MERCATOR_HALF = 20037508.342789244;
const TILE_PX = 256;
const META = 4;
const MANIFEST_BROWSER_S = 60;

class NotListed extends Error {}

/**
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {{ endpoint: string, upstream: string, layer: string, manifest_ttl_s: number, max_zoom: number }} cfg
 * @returns {Promise<Response>}
 */
export async function handleClouds(url, env, ctx, cfg) {
  if (!cfg?.upstream || !cfg.layer) return json({ error: "clouds_disabled" }, 503);
  const rest = url.pathname.slice(cfg.endpoint.length);
  try {
    if (rest === "/manifest") return json(await manifest(cfg, ctx, env), 200, MANIFEST_BROWSER_S);
    const world = /^\/([0-9TZ:-]{20})\/world\.png$/.exec(rest);
    if (world) return await worldTile(cfg, ctx, world[1], env);
    const m = TILE_PATH.exec(rest);
    if (!m) return json({ error: "not_found" }, 404);
    const metaN = m[5] ? Number(m[6]) : 1;
    if (metaN !== 1 && metaN !== META) return json({ error: "bad_meta" }, 400);
    return await tile(cfg, ctx, m[1], Number(m[2]), Number(m[3]), Number(m[4]), metaN, env);
  } catch (err) {
    if (err instanceof NotListed) return json({ error: "unknown_time" }, 404);
    console.warn("clouds", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

/** @returns {Promise<{ layer: string, latest: string, times: string[], bounds: number[] }>} */
function manifest(cfg, ctx, env) {
  const ttl = cfg.manifest_ttl_s;
  const layer = encodeURIComponent(cfg.layer);
  return edgeJson(`${EDGE}/l2/manifest/${layer}`, ttl, ctx, async () => {
    const caps = await edgeJson(`${EDGE}/l1/capabilities/${layer}`, ttl, ctx, async () => {
      const res = await relayFetch(env, wmsUrl(cfg, { request: "GetCapabilities" }));
      if (!res.ok) throw new Error(`capabilities ${res.status}`);
      return { xml: await res.text() };
    });
    return parseCapabilities(/** @type {{ xml: string }} */ (caps).xml, cfg.layer, Date.now());
  });
}

async function worldTile(cfg, ctx, time, env) {
  if (!TIME.test(time) || canonical(time) !== time) return json({ error: "bad_time" }, 400);
  const key = `${EDGE}/world/${encodeURIComponent(cfg.layer)}/${time}.png`;
  const img = await edgeBytes(key, ARCHIVE_EDGE_S, ctx, async () => {
    const { times } = await manifest(cfg, ctx, env);
    if (!times.includes(time)) throw new NotListed(time);
    const res = await relayFetch(
      env,
      wmsUrl(cfg, {
        request: "GetMap",
        layers: cfg.layer,
        styles: "",
        crs: "EPSG:3857",
        bbox: [-MERCATOR_HALF, -MERCATOR_HALF, MERCATOR_HALF, MERCATOR_HALF].map((v) => v.toFixed(2)).join(","),
        width: "512",
        height: "512",
        format: "image/png",
        transparent: "true",
        time,
      }),
    );
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/png")) throw new Error(`getmap world ${res.status} ${type}`);
    return { body: await res.arrayBuffer(), type: "image/png" };
  });
  return new Response(img.body, { headers: { "content-type": img.type, "cache-control": IMMUTABLE } });
}

/**
 * @param {number} spanTiles 1 = single tile; META = metatile origin (multiple of META)
 */
async function tile(cfg, ctx, time, z, x, y, spanTiles, env) {
  const side = 2 ** z;
  if (!TIME.test(time) || canonical(time) !== time) return json({ error: "bad_time" }, 400);
  if (z > cfg.max_zoom || x % spanTiles || y % spanTiles) return json({ error: "tile_out_of_range" }, 404);
  if (x + spanTiles > side || y + spanTiles > side) return json({ error: "tile_out_of_range" }, 404);
  const kind = spanTiles > 1 ? `meta${spanTiles}` : "tiles";
  const key = `${EDGE}/${kind}/${encodeURIComponent(cfg.layer)}/${time}/${z}/${x}/${y}.png`;
  // cache before manifest: hours that left the upstream list stay servable
  const img = await edgeBytes(key, ARCHIVE_EDGE_S, ctx, async () => {
    const { times } = await manifest(cfg, ctx, env);
    // wms answers unknown hours with the nearest one — never archive those under this key
    if (!times.includes(time)) throw new NotListed(time);
    const res = await relayFetch(env, wmsUrl(cfg, getMapParams(cfg.layer, time, z, x, y, spanTiles)));
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/png")) throw new Error(`getmap ${res.status} ${type}`);
    return { body: await res.arrayBuffer(), type: "image/png" };
  });
  return new Response(img.body, { headers: { "content-type": img.type, "cache-control": IMMUTABLE } });
}

function getMapParams(layer, time, z, x, y, spanTiles = 1) {
  const span = (2 * MERCATOR_HALF) / 2 ** z;
  const west = -MERCATOR_HALF + x * span;
  const north = MERCATOR_HALF - y * span;
  const px = TILE_PX * spanTiles;
  return {
    request: "GetMap",
    layers: layer,
    styles: "",
    crs: "EPSG:3857",
    bbox: [west, north - span * spanTiles, west + span * spanTiles, north].map((v) => v.toFixed(2)).join(","),
    width: String(px),
    height: String(px),
    format: "image/png",
    transparent: "true",
    time,
  };
}

function wmsUrl(cfg, params) {
  const u = new URL(cfg.upstream);
  u.search = new URLSearchParams({ service: "WMS", version: "1.3.0", ...params }).toString();
  return u.toString();
}

/** @returns {string | null} utc second precision, the form our urls use */
function canonical(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

/**
 * reads the time dimension and extent of one leaf layer; never expands intervals
 * @param {string} xml
 * @param {string} layer
 * @param {number} nowMs
 */
export function parseCapabilities(xml, layer, nowMs) {
  const start = xml.indexOf(`<Name>${layer}</Name>`);
  if (start < 0) throw new Error("layer_missing");
  const next = xml.indexOf("<Layer", start);
  const leaf = xml.slice(start, next < 0 ? undefined : next);
  const dim = /<Dimension\b[^>]*\bname="time"[^>]*>([^<]*)<\/Dimension>/.exec(leaf);
  if (!dim) throw new Error("time_dimension_missing");
  const times = [
    ...new Set(
      dim[1]
        .split(",")
        .map((v) => v.trim())
        .filter((v) => !v.includes("/"))
        .map(canonical),
    ),
  ]
    .filter((t) => t !== null && nowMs - Date.parse(t) <= WINDOW_MS && Date.parse(t) <= nowMs + FUTURE_SLACK_MS)
    .sort();
  if (!times.length) throw new Error("no_recent_times");
  const edge = (tag) => Number(new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(leaf)?.[1]);
  const bounds = ["westBoundLongitude", "southBoundLatitude", "eastBoundLongitude", "northBoundLatitude"].map(edge);
  return {
    layer,
    latest: /** @type {string} */ (times.at(-1)),
    times: /** @type {string[]} */ (times),
    bounds: bounds.every(Number.isFinite) ? bounds : [-180, -85.0511, 180, 85.0511],
  };
}
