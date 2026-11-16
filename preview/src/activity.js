// Globe activity entities: ADS-B (OpenSky) + AIS stub (WS later)
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/activity";
const BROWSER_S = 30;
const DEFAULT_TTL_S = 60;

/**
 * GET /api/activity/flights[?bbox=w,s,e,n]
 * OpenSky states → GeoJSON points (baro altitude / callsign / velocity).
 *
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {{ endpoint?: string, upstream?: string, cache_ttl_s?: number, attribution?: string }} cfg
 */
export async function handleFlights(url, env, ctx, cfg) {
  const upstream = cfg?.upstream || "https://opensky-network.org/api/states/all";
  const ttl = Number(cfg?.cache_ttl_s || DEFAULT_TTL_S);
  const bbox = parseBbox(url.searchParams.get("bbox"));
  const cacheKey = `${EDGE}/flights/${bbox ? bbox.map((v) => v.toFixed(2)).join(",") : "world"}`;
  try {
    const out = await edgeJson(cacheKey, ttl, ctx, async () => {
      const u = new URL(upstream);
      if (bbox) {
        u.searchParams.set("lamin", String(bbox[1]));
        u.searchParams.set("lomin", String(bbox[0]));
        u.searchParams.set("lamax", String(bbox[3]));
        u.searchParams.set("lomax", String(bbox[2]));
      }
      const headers = { Accept: "application/json" };
      // optional basic auth if both secrets present (OpenSky anonymous also works, rate-limited)
      if (env.OPENSKY_USERNAME && env.OPENSKY_PASSWORD) {
        headers.Authorization = `Basic ${btoa(`${env.OPENSKY_USERNAME}:${env.OPENSKY_PASSWORD}`)}`;
      }
      const res = await fetch(u.toString(), { headers });
      if (!res.ok) throw new Error(`opensky ${res.status}`);
      const body = await res.json();
      return {
        type: "FeatureCollection",
        attribution: cfg?.attribution || "OpenSky Network",
        time: body.time ?? null,
        bbox: bbox || [-180, -90, 180, 90],
        features: statesToFeatures(body.states || []),
      };
    });
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("flights", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

/**
 * GET /api/activity/vessels — stub until AISStream WS proxy
 * @param {URL} _url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} _ctx
 * @param {{ attribution?: string }} cfg
 */
export async function handleVessels(_url, _env, _ctx, cfg) {
  return json(
    {
      type: "FeatureCollection",
      attribution: cfg?.attribution || "AISStream (pending)",
      status: "stub",
      features: [],
    },
    200,
    BROWSER_S,
  );
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

/** OpenSky state vector → Feature; see https://openskynetwork.github.io/opensky-api/rest.html */
function statesToFeatures(states) {
  const out = [];
  for (const row of states) {
    if (!Array.isArray(row) || row.length < 8) continue;
    const lon = row[5];
    const lat = row[6];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        icao24: row[0] || null,
        callsign: typeof row[1] === "string" ? row[1].trim() || null : null,
        origin_country: row[2] || null,
        baro_altitude_m: row[7],
        on_ground: Boolean(row[8]),
        velocity_ms: row[9],
        true_track_deg: row[10],
        vertical_rate_ms: row[11],
        geo_altitude_m: row[13],
        squawk: row[14] || null,
      },
    });
  }
  return out;
}
