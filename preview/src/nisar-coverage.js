// GET /api/nisar/coverage?bbox=w,s,e,n
// demo frames when the bbox hits the default AOI; else CMR granules (token) or empty
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/nisar/coverage";
const BROWSER_S = 120;
const DEFAULT_TTL_S = 600;
const DEFAULT_COLLECTION = "NISAR_L2_GCOV";
const CMR = "https://cmr.earthdata.nasa.gov/search/granules.json";
const PAGE_SIZE = 50;

/**
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {Record<string, any>} appCfg full app-config.json
 * @param {Request} request used to fetch sibling assets (dataset.json)
 */
export async function handleNisarCoverage(url, env, ctx, appCfg, request) {
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) return json({ error: "bad_bbox", hint: "bbox=w,s,e,n" }, 400);

  const aoi = aoiFromConfig(appCfg);
  const radarCfg = appCfg?.radar?.coverage || appCfg?.space?.nisar_coverage || {};
  const collection = String(radarCfg.collection || appCfg?.radar?.collection || DEFAULT_COLLECTION);
  const ttl = Number(radarCfg.cache_ttl_s || DEFAULT_TTL_S);
  const cmr = String(radarCfg.upstream || CMR);

  if (aoi && boxesIntersect(bbox, aoi.bbox)) {
    const demo = await demoCoverage(request, env, bbox, aoi, collection);
    return json(demo, 200, BROWSER_S);
  }

  const token = env.EARTHDATA_TOKEN;
  if (!token) {
    return json(emptyCoverage(bbox, collection, "no_token"), 200, BROWSER_S);
  }

  const cacheKey = `${EDGE}/cmr/${collection}/${bbox.map((v) => v.toFixed(3)).join(",")}`;
  try {
    const out = await edgeJson(cacheKey, ttl, ctx, async () => {
      return await cmrCoverage(cmr, token, bbox, collection);
    });
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("nisar_coverage", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

/** @returns {number[] | null} west,south,east,north */
export function parseBbox(raw) {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return null;
  return parts;
}

/** @param {number[]} a @param {number[]} b */
export function boxesIntersect(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/**
 * @param {Record<string, any>} appCfg
 * @returns {{ name: string, bounds: {west:number,east:number,south:number,north:number}, bbox: number[] } | null}
 */
export function aoiFromConfig(appCfg) {
  const a = appCfg?.aoi;
  if (!a) return null;
  const w = Number(a.west);
  const e = Number(a.east);
  const s = Number(a.south);
  const n = Number(a.north);
  if (![w, e, s, n].every(Number.isFinite) || w >= e || s >= n) return null;
  return {
    name: String(a.name || "AOI"),
    bounds: { west: w, east: e, south: s, north: n },
    bbox: [w, s, e, n],
  };
}

function emptyCoverage(bbox, collection, reason) {
  return {
    type: "FeatureCollection",
    status: "empty",
    mode: "empty",
    reason,
    bbox,
    collection,
    attribution: "NASA Earthdata NISAR GCOV",
    area: null,
    frames: [],
    features: [],
  };
}

async function demoCoverage(request, env, bbox, aoi, collection) {
  const frames = await loadDemoFrames(request, env, aoi.bounds);
  return {
    type: "FeatureCollection",
    status: frames.length ? "ok" : "empty",
    mode: "demo",
    bbox,
    collection,
    attribution: "TermalWave demo · overlays locales (Santiago del Estero)",
    area: { name: aoi.name, bounds: aoi.bounds },
    frames,
    features: frames.map((f) => frameToFeature(f)),
  };
}

async function loadDemoFrames(request, env, fallbackBounds) {
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/dataset.json", request.url)));
    if (!res.ok) throw new Error(`dataset ${res.status}`);
    const ds = await res.json();
    return framesFromDataset(ds, fallbackBounds);
  } catch (err) {
    console.warn("nisar_coverage_demo", err && err.message);
    return fallbackDemoFrames(fallbackBounds);
  }
}

/** pull radar timeline urls from dataset.json — honest paths already on disk */
export function framesFromDataset(ds, fallbackBounds) {
  const out = [];
  const segs = Array.isArray(ds?.segments) ? ds.segments : [];
  for (const seg of segs) {
    for (const tick of seg.ticks || []) {
      const radar = tick.frames?.radar;
      if (!radar?.url) continue;
      const bounds = normalizeBounds(radar.bounds) || fallbackBounds;
      out.push({
        id: String(tick.id || `radar-${tick.label || out.length}`),
        label: String(tick.label || tick.id || ""),
        start: tick.start || null,
        end: tick.end || null,
        url: String(radar.url),
        bounds,
        kind: radar.kind === "acquisition" ? "acquisition" : "composite",
        source: "demo",
        product: "demo_overlay",
      });
    }
  }
  return out;
}

function fallbackDemoFrames(bounds) {
  const years = [2018, 2020, 2022, 2024, 2026];
  return years.map((y) => ({
    id: `y-${y}`,
    label: String(y),
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    url: `./overlays/timeline/radar/${y}.png`,
    bounds,
    kind: "composite",
    source: "demo",
    product: "demo_overlay",
  }));
}

async function cmrCoverage(upstream, token, bbox, collection) {
  const u = new URL(upstream);
  u.searchParams.set("short_name", collection);
  u.searchParams.set("bounding_box", bbox.join(","));
  u.searchParams.set("page_size", String(PAGE_SIZE));
  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`cmr ${res.status}`);
  const payload = await res.json();
  const frames = granulesToFrames(payload, collection);
  return {
    type: "FeatureCollection",
    status: frames.length ? "ok" : "empty",
    mode: "cmr",
    bbox,
    collection,
    attribution: "NASA Earthdata · NISAR L2 GCOV",
    area: null,
    frames,
    features: frames.map((f) => frameToFeature(f)),
  };
}

export function granulesToFrames(payload, collection) {
  const entries = (payload?.feed || {}).entry || payload?.items || [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const id = String(entry.id || entry.producer_granule_id || entry.title || "");
    if (!id) continue;
    const timeStart = entry.time_start || entry.datetime || null;
    const bounds = boundsFromCmr(entry) || null;
    const href = dataHref(entry);
    // cmr gives granule metadata; no local png until ingest — url is remote data or null
    out.push({
      id,
      label: String(entry.title || id),
      start: timeStart,
      end: entry.time_end || timeStart,
      url: href || null,
      bounds,
      kind: "acquisition",
      source: "earthdata_nisar_gcov",
      product: collection,
      status: granuleStatus(entry),
    });
  }
  return out;
}

function granuleStatus(entry) {
  const title = String(entry.title || "").toLowerCase();
  const flag = String(entry.day_night_flag || entry.data_center || "").toLowerCase();
  if (entry.processing_level === "validated" || title.includes("validated") || flag.includes("validated")) {
    return "validated";
  }
  if (entry.processing_level === "provisional" || title.includes("provisional") || flag.includes("provisional")) {
    return "provisional";
  }
  return "unknown";
}

function dataHref(entry) {
  let href = "";
  for (const link of entry.links || []) {
    if (!link || typeof link !== "object" || !link.href) continue;
    if (String(link.rel || "").includes("data")) return String(link.href);
    if (!href) href = String(link.href);
  }
  return href;
}

function boundsFromCmr(entry) {
  // cmr boxes: "west south east north" (space-separated) or polygons
  const boxes = entry.boxes;
  if (Array.isArray(boxes) && boxes.length) {
    const parts = String(boxes[0]).trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [s, w, n, e] = parts;
      // cmr box order is south west north east
      if (w < e && s < n) return { west: w, east: e, south: s, north: n };
    }
  }
  return null;
}

function normalizeBounds(b) {
  if (!b || typeof b !== "object") return null;
  const west = Number(b.west);
  const east = Number(b.east);
  const south = Number(b.south);
  const north = Number(b.north);
  if (![west, east, south, north].every(Number.isFinite) || west >= east || south >= north) return null;
  return { west, east, south, north };
}

function frameToFeature(frame) {
  const b = frame.bounds;
  const ring = b
    ? [
        [b.west, b.south],
        [b.east, b.south],
        [b.east, b.north],
        [b.west, b.north],
        [b.west, b.south],
      ]
    : null;
  return {
    type: "Feature",
    geometry: ring ? { type: "Polygon", coordinates: [ring] } : null,
    properties: {
      id: frame.id,
      label: frame.label,
      start: frame.start,
      end: frame.end,
      url: frame.url,
      bounds: frame.bounds,
      kind: frame.kind,
      source: frame.source,
      product: frame.product,
      status: frame.status || (frame.source === "demo" ? "demo" : null),
    },
  };
}
