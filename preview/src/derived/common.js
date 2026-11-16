// shared helpers for derived (processed + prediction) grids sampled from Open-Meteo
export const FORECAST = "https://api.open-meteo.com/v1/forecast";
export const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
export const ELEVATION = "https://api.open-meteo.com/v1/elevation";
export const SRTM = "https://api.opentopodata.org/v1/srtm30m";
export const ATTRIBUTION = "Open-Meteo (CC BY 4.0)";

const DAY_MS = 86400000;
// forecast api serves recent past from its own models; older days come from ERA5
const FORECAST_PAST_DAYS = 80;
const ELEVATION_BATCH = 100;

/** @returns {number[] | null} west,south,east,north */
export function parseBbox(raw) {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return null;
  return parts;
}

/** perSide x perSide cells over the bbox; the grid size is fixed so every request costs the same */
export function buildCells(bbox, perSide) {
  const [w, s, e, n] = bbox;
  const dx = (e - w) / perSide;
  const dy = (n - s) / perSide;
  const cells = [];
  for (let j = 0; j < perSide; j++) {
    for (let i = 0; i < perSide; i++) {
      const cw = w + i * dx;
      const cs = s + j * dy;
      cells.push({
        lon: +(cw + dx / 2).toFixed(4),
        lat: +(cs + dy / 2).toFixed(4),
        box: [cw, cs, cw + dx, cs + dy].map((v) => +v.toFixed(5)),
      });
    }
  }
  return cells;
}

export function cellFeature(cell, props) {
  const [w, s, e, n] = cell.box;
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    properties: { lat: cell.lat, lon: cell.lon, ...props },
  };
}

export function bboxKey(bbox) {
  return bbox.map((v) => v.toFixed(2)).join(",");
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD or null; future dates clamp to today because analyses describe observed weather */
export function parseDate(raw) {
  const today = todayUtc();
  if (!raw) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw))) return null;
  return raw > today ? today : raw;
}

/** forecast api for recent days, ERA5 archive for older ones */
export function baseFor(start) {
  return start >= addDays(todayUtc(), -FORECAST_PAST_DAYS) ? FORECAST : ARCHIVE;
}

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const round = (v, d = 2) => (Number.isFinite(v) ? +v.toFixed(d) : null);

/** one multi-location call; returns one block per cell, in order */
export async function meteo(base, cells, query) {
  const lat = cells.map((c) => c.lat).join(",");
  const lon = cells.map((c) => c.lon).join(",");
  const raw = await getJson(`${base}?latitude=${lat}&longitude=${lon}&timezone=UTC&${query}`);
  const rows = Array.isArray(raw) ? raw : [raw];
  if (rows.length !== cells.length) throw new Error(`open-meteo rows ${rows.length}/${cells.length}`);
  return rows;
}

/** elevations in metres for [lat, lon] pairs; Open-Meteo first, OpenTopoData SRTM when it refuses (config/apis.toml order) */
export async function elevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += ELEVATION_BATCH) {
    const chunk = points.slice(i, i + ELEVATION_BATCH);
    let z;
    try {
      z = await openMeteoElevation(chunk);
    } catch {
      // the public OpenTopoData server allows one call per second
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      z = await srtmElevation(chunk);
    }
    out.push(...z);
  }
  return out;
}

async function openMeteoElevation(chunk) {
  const lat = chunk.map((p) => p[0].toFixed(5)).join(",");
  const lon = chunk.map((p) => p[1].toFixed(5)).join(",");
  const raw = await getJson(`${ELEVATION}?latitude=${lat}&longitude=${lon}`);
  if (!Array.isArray(raw?.elevation) || raw.elevation.length !== chunk.length) throw new Error("elevation shape");
  return raw.elevation.map((v) => (Number.isFinite(v) ? v : NaN));
}

async function srtmElevation(chunk) {
  const locs = chunk.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join("|");
  const raw = await getJson(`${SRTM}?locations=${locs}`);
  if (!Array.isArray(raw?.results) || raw.results.length !== chunk.length) throw new Error("srtm shape");
  return raw.results.map((r) => (r.elevation == null ? NaN : Number(r.elevation)));
}

/** sum of a daily series over [from, to] inclusive */
export function sumDays(daily, key, from, to) {
  const expected = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
  if (!Number.isInteger(expected) || expected < 1) return null;
  let total = 0;
  const seen = new Set();
  for (let i = 0; i < (daily?.time?.length || 0); i++) {
    const t = daily.time[i];
    if (t < from || t > to) continue;
    const v = daily[key]?.[i];
    if (!Number.isFinite(v) || seen.has(t)) return null;
    seen.add(t);
    total += v;
  }
  return seen.size === expected ? total : null;
}

/**
 * forecast skill falls with lead time; these weights are the project's documented
 * heuristic (not a calibration) and are stated in each catalog entry's caveats
 */
export const LEAD_WEIGHT = { weather: [0.9, 0.8, 0.7], rain: [0.75, 0.6, 0.5] };

export function featureCollection(meta, features) {
  return { type: "FeatureCollection", attribution: ATTRIBUTION, ...meta, count: features.length, features };
}

const pending = new Map();
const MAX_ATTEMPTS = 3;
const MAX_RETRY_MS = 2000;

async function getJson(url) {
  if (pending.has(url)) return pending.get(url);
  const request = fetchJson(url);
  pending.set(url, request);
  try {
    return await request;
  } finally {
    pending.delete(url);
  }
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        cf: { cacheTtlByStatus: { "200-299": 300, "400-599": -1 } },
      });
    } catch (err) {
      if (attempt === MAX_ATTEMPTS - 1) throw err;
      await pause(250 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    const error = new Error(`${new URL(url).host} ${response.status}`);
    const retryable = response.status === 429 || response.status >= 500;
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter == null ? NaN : Number(retryAfter);
    const requested = Number.isFinite(seconds)
      ? seconds * 1000
      : retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
    const delay = Number.isFinite(requested) ? Math.max(0, requested) : 250 * 2 ** attempt;
    await response.body?.cancel();
    if (!retryable || attempt === MAX_ATTEMPTS - 1 || delay > MAX_RETRY_MS) throw error;
    await pause(delay);
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
