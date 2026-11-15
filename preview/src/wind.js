// Open-Meteo wind for the globe (forecast + optional archive). No API key.
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/wind";
const BROWSER_S = 120;
const DEFAULT_TTL_S = 900;
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const MAX_POINTS = 64;
const DEG = Math.PI / 180;

/**
 * @param {URL} url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} ctx
 * @param {{ endpoint?: string, forecast?: string, archive?: string, cache_ttl_s?: number, attribution?: string }} cfg
 */
export async function handleWind(url, _env, ctx, cfg) {
  const forecast = cfg?.forecast || FORECAST;
  const archive = cfg?.archive || ARCHIVE;
  const ttl = Number(cfg?.cache_ttl_s || DEFAULT_TTL_S);
  const attribution = cfg?.attribution || "Open-Meteo (CC BY 4.0)";
  const date = (url.searchParams.get("date") || "").trim(); // YYYY-MM-DD for archive
  const point = parseLatLon(url.searchParams.get("lat"), url.searchParams.get("lon"));
  const bbox = parseBbox(url.searchParams.get("bbox"));

  if (!point && !bbox) {
    return json({ error: "need lat,lon or bbox=w,s,e,n" }, 400);
  }

  try {
    if (point) {
      const key = `${EDGE}/pt/${point[0].toFixed(3)},${point[1].toFixed(3)}/${date || "live"}`;
      const out = await edgeJson(key, ttl, ctx, () => fetchPoint(forecast, archive, point, date, attribution));
      return json(out, 200, BROWSER_S);
    }
    const step = Math.min(20, Math.max(0.5, Number(url.searchParams.get("step") || autoStep(bbox))));
    const cells = buildGrid(bbox, step);
    if (cells.lats.length === 0) return json({ error: "empty_grid" }, 400);
    const key = `${EDGE}/g/${bbox.map((v) => v.toFixed(2)).join(",")}/${step.toFixed(2)}/${date || "live"}`;
    const out = await edgeJson(key, ttl, ctx, () => fetchGrid(forecast, archive, cells, bbox, date, attribution));
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("wind", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

/** @returns {[number, number] | null} lat, lon */
function parseLatLon(latRaw, lonRaw) {
  // Number(null)===0; require explicit query params
  if (latRaw == null || lonRaw == null || latRaw === "" || lonRaw === "") return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}

/** @returns {number[] | null} west,south,east,north */
function parseBbox(raw) {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return null;
  return parts;
}

function autoStep(bbox) {
  const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  if (span > 80) return 20;
  if (span > 30) return 8;
  if (span > 10) return 3;
  return 1;
}

function buildGrid(bbox, step) {
  const [w, s, e, n] = bbox;
  const lats = [];
  const lons = [];
  for (let lat = s + step / 2; lat < n; lat += step) {
    for (let lon = w + step / 2; lon < e; lon += step) {
      if (lats.length >= MAX_POINTS) break;
      lats.push(+lat.toFixed(4));
      lons.push(+lon.toFixed(4));
    }
    if (lats.length >= MAX_POINTS) break;
  }
  return { lats, lons };
}

async function fetchPoint(forecast, archive, point, date, attribution) {
  const [lat, lon] = point;
  const raw = date
    ? await getJson(archiveUrl(archive, [lat], [lon], date))
    : await getJson(
        `${forecast}?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto`,
      );
  const block = Array.isArray(raw) ? raw[0] : raw;
  const cur = currentFromBlock(block);
  const speed = Number(cur.wind_speed_10m);
  const dir = Number(cur.wind_direction_10m);
  const gusts = Number(cur.wind_gusts_10m);
  const { u, v } = uvFromMeteo(speed, dir);
  return {
    kind: "point",
    attribution,
    unit: "km/h",
    lat,
    lon,
    current: {
      time: cur.time || null,
      speed_kmh: speed,
      direction_deg: dir,
      gusts_kmh: Number.isFinite(gusts) ? gusts : null,
      u_east: u,
      v_north: v,
    },
    hourly: slimHourly(block.hourly),
  };
}

async function fetchGrid(forecast, archive, cells, bbox, date, attribution) {
  const { lats, lons } = cells;
  const raw = date
    ? await getJson(archiveUrl(archive, lats, lons, date))
    : await getJson(
        `${forecast}?latitude=${lats.join(",")}&longitude=${lons.join(",")}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC`,
      );
  const rows = Array.isArray(raw) ? raw : [raw];
  const samples = [];
  for (let i = 0; i < rows.length; i++) {
    const cur = currentFromBlock(rows[i]);
    const speed = Number(cur.wind_speed_10m);
    const dir = Number(cur.wind_direction_10m);
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) continue;
    const { u, v } = uvFromMeteo(speed, dir);
    samples.push({
      lat: lats[i],
      lon: lons[i],
      speed_kmh: speed,
      direction_deg: dir,
      u_east: u,
      v_north: v,
    });
  }
  return {
    kind: "grid",
    attribution,
    unit: "km/h",
    bbox,
    count: samples.length,
    samples,
  };
}

function archiveUrl(base, lats, lons, date) {
  // hourly keeps the same shape as forecast current/hourly for fire-day lookups
  return `${base}?latitude=${lats.join(",")}&longitude=${lons.join(",")}&start_date=${date}&end_date=${date}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC`;
}

/** meteo dir = where wind comes from; u/v = blow-toward (east/north), km/h */
function uvFromMeteo(speedKmh, dirDeg) {
  if (!Number.isFinite(speedKmh) || !Number.isFinite(dirDeg)) return { u: 0, v: 0 };
  const r = dirDeg * DEG;
  return { u: -speedKmh * Math.sin(r), v: -speedKmh * Math.cos(r) };
}

/** forecast has current; archive-only responses expose hourly[noon] as current */
function currentFromBlock(block) {
  if (block?.current) return block.current;
  const h = block?.hourly;
  if (!h?.time?.length) return {};
  const mid = Math.floor(h.time.length / 2);
  return {
    time: h.time[mid],
    wind_speed_10m: h.wind_speed_10m?.[mid],
    wind_direction_10m: h.wind_direction_10m?.[mid],
  };
}

function slimHourly(hourly) {
  if (!hourly?.time) return [];
  const n = Math.min(48, hourly.time.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: hourly.time[i],
      speed_kmh: hourly.wind_speed_10m?.[i] ?? null,
      direction_deg: hourly.wind_direction_10m?.[i] ?? null,
    });
  }
  return out;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  return res.json();
}
