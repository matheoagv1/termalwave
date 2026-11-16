// Feeds for catalog layers that need a same-origin proxy. No API key.
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/catalog";
const EONET = "https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open";
const EONET_TTL_S = 1800;
const BROWSER_S = 300;
const MAX_FEATURES = 3000;

/**
 * @param {URL} url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
export async function handleCatalog(url, _env, ctx) {
  if (url.pathname === "/api/catalog/eonet") return eonet(url, ctx);
  return json({ error: "not_found" }, 404);
}

async function eonet(url, ctx) {
  const bbox = parseBbox(url.searchParams.get("bbox")) || [-180, -90, 180, 90];
  try {
    // the whole open list is cached once; each bbox is a cheap filter over it
    const all = await edgeJson(`${EDGE}/eonet/open`, EONET_TTL_S, ctx, fetchEonet);
    const features = filterEonet(all.features, bbox).slice(0, MAX_FEATURES);
    return json({ type: "FeatureCollection", features, attribution: "NASA EONET" }, 200, BROWSER_S);
  } catch (err) {
    console.warn("catalog eonet", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

async function fetchEonet() {
  const r = await fetch(EONET, { headers: { accept: "application/geo+json, application/json" } });
  if (!r.ok) throw new Error(`eonet ${r.status}`);
  const body = await r.json();
  if (!body || !Array.isArray(body.features)) throw new Error("eonet format");
  return { features: body.features.map(flatten).filter(Boolean) };
}

// one point per event at its latest position, with the first category as a plain string
export function flatten(f) {
  const g = f && f.geometry;
  if (!g) return null;
  let c = null;
  if (g.type === "Point") c = g.coordinates;
  else if (g.type === "LineString" && g.coordinates.length) c = g.coordinates[g.coordinates.length - 1];
  else if (g.type === "Polygon" && g.coordinates[0] && g.coordinates[0].length) c = centroid(g.coordinates[0]);
  if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  const p = f.properties || {};
  const cat = Array.isArray(p.categories) && p.categories[0] ? p.categories[0] : {};
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [c[0], c[1]] },
    properties: {
      id: p.id || "",
      title: p.title || "",
      date: p.date || "",
      category: cat.id || "",
      category_title: cat.title || "",
      magnitude: Number.isFinite(p.magnitudeValue) ? p.magnitudeValue : null,
      magnitude_unit: p.magnitudeUnit || "",
      link: p.link || "",
    },
  };
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

export function filterEonet(features, [w, s, e, n]) {
  return features.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  });
}

/** @returns {number[] | null} west,south,east,north */
function parseBbox(raw) {
  if (!raw) return null;
  const v = raw.split(",").map(Number);
  if (v.length !== 4 || !v.every(Number.isFinite)) return null;
  const [w, s, e, n] = v;
  if (w >= e || s >= n || Math.abs(s) > 90 || Math.abs(n) > 90) return null;
  return v;
}
