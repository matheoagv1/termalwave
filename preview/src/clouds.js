// near real-time clouds: nowcoast wms global infrared mosaic behind the edge cache
// l1 = raw capabilities, l2 = our manifest; a tile for a listed hour never changes, so it is archived
// nowcoast stretches each GetMap independently — single 256 tiles seam. we fetch 4×4 metatiles
// (1024 px) so the stretch is shared, and the client crops the 256 it needs
import { edgeBytes, edgeJson, json } from "./edge-cache.js";

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
const UA = "TermalWave/0.1 (+https://termalwave.space)";

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
    if (rest === "/manifest") {
      try {
        return json(await manifest(cfg, ctx), 200, MANIFEST_BROWSER_S);
      } catch (err) {
        console.warn("clouds_manifest", err && err.message);
        return json(degradedManifest(cfg, err), 200, 15);
      }
    }
    const world = /^\/([0-9TZ:-]{20})\/world\.png$/.exec(rest);
    if (world) return await worldTile(cfg, ctx, world[1]);
    const m = TILE_PATH.exec(rest);
    if (!m) return json({ error: "not_found" }, 404);
    const metaN = m[5] ? Number(m[6]) : 1;
    if (metaN !== 1 && metaN !== META) return json({ error: "bad_meta" }, 400);
    return await tile(cfg, ctx, m[1], Number(m[2]), Number(m[3]), Number(m[4]), metaN);
  } catch (err) {
    if (err instanceof NotListed) return json({ error: "unknown_time" }, 404);
    console.warn("clouds", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

/** @returns {Promise<{ layer: string, latest: string, times: string[], bounds: number[] }>} */
function manifest(cfg, ctx) {
  const ttl = cfg.manifest_ttl_s;
  const layer = encodeURIComponent(cfg.layer);
  return edgeJson(`${EDGE}/l2/manifest/${layer}`, ttl, ctx, async () => {
    const caps = await edgeJson(`${EDGE}/l1/capabilities/${layer}`, ttl, ctx, async () => {
      const res = await fetch(wmsUrl(cfg, { request: "GetCapabilities" }), { headers: wmsHeaders() });
      if (!res.ok) throw new Error(`capabilities ${res.status}`);
      const xml = await res.text();
      if (!xml.includes("<Name") && !xml.includes(":Name")) throw new Error("capabilities_not_xml");
      return { xml };
    });
    return parseCapabilities(/** @type {{ xml: string }} */ (caps).xml, cfg.layer, Date.now());
  });
}

async function worldTile(cfg, ctx, time) {
  if (!TIME.test(time) || canonical(time) !== time) return json({ error: "bad_time" }, 400);
  const key = `${EDGE}/world/${encodeURIComponent(cfg.layer)}/${time}.png`;
  const img = await edgeBytes(key, ARCHIVE_EDGE_S, ctx, async () => {
    const { times } = await manifest(cfg, ctx);
    if (!times.includes(time)) throw new NotListed(time);
    const res = await fetch(
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
      { headers: wmsHeaders() },
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
async function tile(cfg, ctx, time, z, x, y, spanTiles) {
  const side = 2 ** z;
  if (!TIME.test(time) || canonical(time) !== time) return json({ error: "bad_time" }, 400);
  if (z > cfg.max_zoom || x % spanTiles || y % spanTiles) return json({ error: "tile_out_of_range" }, 404);
  if (x + spanTiles > side || y + spanTiles > side) return json({ error: "tile_out_of_range" }, 404);
  const kind = spanTiles > 1 ? `meta${spanTiles}` : "tiles";
  const key = `${EDGE}/${kind}/${encodeURIComponent(cfg.layer)}/${time}/${z}/${x}/${y}.png`;
  // cache before manifest: hours that left the upstream list stay servable
  const img = await edgeBytes(key, ARCHIVE_EDGE_S, ctx, async () => {
    const { times } = await manifest(cfg, ctx);
    // wms answers unknown hours with the nearest one — never archive those under this key
    if (!times.includes(time)) throw new NotListed(time);
    const res = await fetch(wmsUrl(cfg, getMapParams(cfg.layer, time, z, x, y, spanTiles)), { headers: wmsHeaders() });
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

function wmsHeaders() {
  return {
    Accept: "text/xml, application/xml, image/png, */*;q=0.8",
    "User-Agent": UA,
  };
}

function wmsUrl(cfg, params) {
  const u = new URL(cfg.upstream);
  u.search = new URLSearchParams({ service: "WMS", version: "1.3.0", ...params }).toString();
  return u.toString();
}

function degradedManifest(cfg, err) {
  return {
    status: "unavailable",
    code: "clouds_upstream",
    degraded: true,
    layer: cfg?.layer || "",
    latest: null,
    times: [],
    bounds: [-180, -85.0511, 180, 85.0511],
    detail: err && err.message ? String(err.message) : "clouds_upstream",
  };
}

/** @returns {string | null} utc second precision, the form our urls use */
function canonical(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

/**
 * reads the time dimension of one leaf layer
 * accepts a comma list or a start/end/period interval, with or without a namespace
 * @param {string} xml
 * @param {string} layer
 * @param {number} nowMs
 */
export function parseCapabilities(xml, layer, nowMs) {
  const leaf = leafFor(xml, layer);
  if (!leaf) throw new Error("layer_missing");
  const dim = dimensionBody(leaf);
  if (dim == null) throw new Error("time_dimension_missing");
  const times = instantsInWindow(dim, nowMs);
  if (!times.length) throw new Error("no_recent_times");
  const edge = (tag) => {
    const found = new RegExp(`<(?:[\\w.-]+:)?${tag}>([^<]+)</(?:[\\w.-]+:)?${tag}>`).exec(leaf);
    return found ? Number(found[1]) : NaN;
  };
  const bounds = ["westBoundLongitude", "southBoundLatitude", "eastBoundLongitude", "northBoundLatitude"].map(edge);
  return {
    status: "ok",
    code: "ok",
    degraded: false,
    layer,
    latest: times[times.length - 1],
    times,
    bounds: bounds.every(Number.isFinite) ? bounds : [-180, -85.0511, 180, 85.0511],
  };
}

function leafFor(xml, layer) {
  const escaped = layer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`<(?:[\\w.-]+:)?Name>\\s*${escaped}\\s*</(?:[\\w.-]+:)?Name>`);
  const found = nameRe.exec(xml);
  if (!found) return "";
  const rest = xml.slice(found.index + found[0].length);
  const next = rest.search(/<(?:[\w.-]+:)?Layer[\s>]/);
  return next < 0 ? xml.slice(found.index) : xml.slice(found.index, found.index + found[0].length + next);
}

function dimensionBody(leaf) {
  const re = /<(?:[\w.-]+:)?Dimension\b([^>]*)>([^<]*)<\/(?:[\w.-]+:)?Dimension>/g;
  let match;
  while ((match = re.exec(leaf))) {
    if (/\bname\s*=\s*["']time["']/i.test(match[1])) return match[2];
  }
  return null;
}

function instantsInWindow(body, nowMs) {
  const all = [];
  for (const part of body.split(",")) {
    const token = part.trim();
    if (!token) continue;
    if (token.includes("/")) all.push(...expandInterval(token, nowMs));
    else {
      const stamp = canonical(token);
      if (stamp) all.push(stamp);
    }
  }
  return [...new Set(all)]
    .filter((stamp) => nowMs - Date.parse(stamp) <= WINDOW_MS && Date.parse(stamp) <= nowMs + FUTURE_SLACK_MS)
    .sort();
}

function expandInterval(token, nowMs) {
  const bits = token.split("/");
  if (bits.length < 2) return [];
  const start = Date.parse(bits[0]);
  const end = Date.parse(bits[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const step = stepMs(bits[2] || "PT1H");
  const lo = nowMs - WINDOW_MS;
  const hi = nowMs + FUTURE_SLACK_MS;
  let t = start;
  if (t < lo) t += Math.ceil((lo - t) / step) * step;
  const out = [];
  for (; t <= end && t <= hi && out.length < 48; t += step) {
    const stamp = canonical(new Date(t).toISOString());
    if (stamp) out.push(stamp);
  }
  return out;
}

function stepMs(spec) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(String(spec || "").trim());
  if (!match) return 3600000;
  const ms = (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000;
  return ms > 0 ? ms : 3600000;
}
