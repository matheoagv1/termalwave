// FIRMS hotspots as GeoJSON for globe entities (points, not timeline PNGs)
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/firms";
const BROWSER_S = 120;
const DEFAULT_TTL_S = 600;
const DEFAULT_DAYS = 2;
// VIIRS_SNPP_NRT returns 0 rows since NASA dropped it; these are tried in order until one has hotspots
const SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"];

/**
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {{ endpoint?: string, upstream?: string, source?: string, day_range?: number, cache_ttl_s?: number, attribution?: string }} cfg
 */
export async function handleFirms(url, env, ctx, cfg) {
  const key = env.FIRMS_MAP_KEY;
  if (!key) return json({ error: "firms_disabled" }, 503);
  const upstream = cfg?.upstream || "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
  const sources = cfg?.source && cfg.source !== "VIIRS_SNPP_NRT" ? [cfg.source, ...SOURCES.filter((s) => s !== cfg.source)] : SOURCES;
  const days = Math.min(10, Math.max(1, Number(cfg?.day_range || DEFAULT_DAYS)));
  const ttl = Number(cfg?.cache_ttl_s || DEFAULT_TTL_S);
  // optional viewport bbox; default = world (shell / far LOD)
  const bbox = parseBbox(url.searchParams.get("bbox")) || [-180, -90, 180, 90];
  const cacheKey = `${EDGE}/v2/${days}/${bbox.map((v) => v.toFixed(2)).join(",")}`;
  try {
    const out = await edgeJson(cacheKey, ttl, ctx, async () => {
      let used = sources[0];
      let features = [];
      let reached = false;
      for (const source of sources) {
        try {
          const path = `${upstream.replace(/\/$/, "")}/${encodeURIComponent(key)}/${source}/${bbox.join(",")}/${days}`;
          const res = await fetch(path, { headers: { Accept: "text/csv" }, signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          reached = true;
          features = csvToFeatures(await res.text());
          used = source;
          if (features.length) break;
        } catch (err) {
          console.warn("firms source", source, err && err.name); // never log the url: it carries the key
        }
      }
      if (!reached) throw new Error("firms unreachable");
      return {
        type: "FeatureCollection",
        attribution: cfg?.attribution || "NASA FIRMS",
        status: features.length ? "ok" : "empty",
        code: features.length ? "ok" : "no_hotspots_in_range",
        source: used,
        day_range: days,
        bbox,
        features,
      };
    });
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("firms", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
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

function csvToFeatures(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const latI = headers.indexOf("latitude");
  const lonI = headers.indexOf("longitude");
  if (latI < 0 || lonI < 0) return [];
  const brightI = headers.findIndex((h) => h.includes("bright"));
  const frpI = headers.indexOf("frp");
  const dateI = headers.indexOf("acq_date");
  const timeI = headers.indexOf("acq_time");
  const confI = headers.indexOf("confidence");
  const satI = headers.indexOf("satellite");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i]);
    const lat = Number(cols[latI]);
    const lon = Number(cols[lonI]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        brightness: brightI >= 0 ? Number(cols[brightI]) : null,
        frp: frpI >= 0 ? Number(cols[frpI]) : null,
        acq_date: dateI >= 0 ? cols[dateI] : null,
        acq_time: timeI >= 0 ? cols[timeI] : null,
        confidence: confI >= 0 ? cols[confI] : null,
        satellite: satI >= 0 ? cols[satI] : null,
      },
    });
  }
  return out;
}

function splitCsv(line) {
  // FIRMS CSV is simple (no embedded commas in fields we care about)
  return line.split(",");
}
