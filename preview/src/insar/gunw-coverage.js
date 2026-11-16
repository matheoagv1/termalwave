// GET /api/insar/gunw?bbox=w,s,e,n[&date=YYYY-MM-DD]
// interferogram pairs (NISAR L2 GUNW) as geojson polygons, from public CMR metadata
import { edgeJson, json } from "../edge-cache.js";
import { footprintFromEntry, maturityFor, parseBbox } from "../nisar-coverage.js";

const EDGE = "https://edge.termalwave/insar/gunw";
const CMR = "https://cmr.earthdata.nasa.gov/search/granules.json";
const BROWSER_S = 120;
const TTL_S = 900;
const PAGE_SIZE = 500;
const MAX_PAGES = 4;
// before NISAR science ops there are no GUNW pairs
const TEMPORAL_START = "2025-07-30T00:00:00Z";
const GUNW_COLLECTIONS = ["NISAR_L2_GUNW_V1", "NISAR_L2_GUNW_PROVISIONAL_V1", "NISAR_L2_GUNW_BETA_V1"];
const MATURITY_RANK = { validated: 0, provisional: 1, beta: 2 };

/**
 * @param {URL} url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} ctx
 */
export async function handleGunwCoverage(url, _env, ctx) {
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) return json({ status: "invalid", code: "bad_bbox" }, 400);
  const until = parseDate(url.searchParams.get("date"));
  const key = `${EDGE}?bbox=${bbox.map((v) => v.toFixed(2)).join(",")}&until=${until || ""}`;
  try {
    const body = await edgeJson(key, TTL_S, ctx, () => queryGunw(bbox, until));
    return json(body, 200, BROWSER_S);
  } catch (err) {
    console.warn("insar_gunw", err && err.message);
    return json(featureCollection(bbox, [], "unavailable"), 200);
  }
}

/**
 * @param {number[]} bbox
 * @param {string} [until] YYYY-MM-DD, keeps pairs whose secondary date is on or before it
 */
export async function queryGunw(bbox, until = "") {
  const temporal = `${TEMPORAL_START},${until ? `${until}T23:59:59Z` : ""}`;
  const settled = await Promise.allSettled(GUNW_COLLECTIONS.map((name) => searchCollection(name, bbox, temporal)));
  const ok = settled.filter((row) => row.status === "fulfilled");
  if (!ok.length) throw new Error("cmr");
  const byId = new Map();
  for (const row of ok.flatMap((r) => r.value)) {
    const prev = byId.get(row.properties.id);
    if (!prev || MATURITY_RANK[row.properties.maturity] < MATURITY_RANK[prev.properties.maturity]) {
      byId.set(row.properties.id, row);
    }
  }
  const features = [...byId.values()].sort((a, b) =>
    a.properties.secondary_date < b.properties.secondary_date ? 1 : -1,
  );
  return featureCollection(bbox, features, ok.length < settled.length ? "partial" : features.length ? "ok" : "empty");
}

/**
 * NISAR_L2_PR_GUNW_<cycle>_<track>_<A|D>_<frame>_<cycle2>_<mode>_<pol>_<ref start>_<ref end>_<sec start>_<sec end>_...
 * @param {string} id
 */
export function parseGunwId(id) {
  const p = String(id || "").replace(/\.h5$/i, "").split("_");
  if (p[0] !== "NISAR" || p[3] !== "GUNW" || p.length < 15) return null;
  return {
    track: trimNum(p[5]),
    direction: p[6] === "A" ? "ascending" : p[6] === "D" ? "descending" : "",
    frame: trimNum(p[7]),
    reference_date: isoDay(p[11]),
    secondary_date: isoDay(p[13]),
  };
}

/**
 * @param {Record<string, any>} entry
 * @param {string} shortName
 */
export function featureFromEntry(entry, shortName) {
  const id = String(entry.producer_granule_id || entry.title || "");
  const parsed = parseGunwId(id);
  const geometry = footprintFromEntry(entry);
  if (!parsed || !geometry || !parsed.reference_date || !parsed.secondary_date) return null;
  const days = Math.round((Date.parse(parsed.secondary_date) - Date.parse(parsed.reference_date)) / 86400000);
  return {
    type: "Feature",
    geometry,
    properties: {
      id,
      ...parsed,
      temporal_baseline_days: days,
      maturity: maturityFor(shortName),
      collection: shortName,
      size_mb: Math.round(Number(entry.granule_size) || 0),
      h5_url: link(entry, "/data#", ".h5"),
      browse_url: link(entry, "/browse#", "_LATLON.png"),
      thumb_url: link(entry, "/browse#", "_LATLON_thumbnail.png"),
      honesty: "measured",
    },
  };
}

async function searchCollection(shortName, bbox, temporal) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const u = new URL(CMR);
    u.searchParams.set("short_name", shortName);
    u.searchParams.set("bounding_box", bbox.join(","));
    u.searchParams.set("temporal", temporal);
    u.searchParams.set("sort_key", "-start_date");
    u.searchParams.set("page_size", String(PAGE_SIZE));
    u.searchParams.set("page_num", String(page));
    const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`cmr ${res.status} ${shortName}`);
    const batch = (await res.json())?.feed?.entry || [];
    for (const entry of batch) {
      const f = featureFromEntry(entry, shortName);
      if (f) rows.push(f);
    }
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function featureCollection(bbox, features, status) {
  return {
    type: "FeatureCollection",
    status,
    source: "NASA CMR (ASF DAAC), NISAR L2 GUNW",
    honesty: "measured",
    fetched_at: new Date().toISOString(),
    bbox,
    count: features.length,
    features,
  };
}

// https only: s3 links need in-region credentials
function link(entry, rel, suffix) {
  for (const l of entry.links || []) {
    const href = String(l?.href || "");
    if (href.startsWith("https:") && String(l.rel || "").endsWith(rel) && href.endsWith(suffix)) return href;
  }
  return "";
}

function parseDate(raw) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function trimNum(value) {
  return /^\d+$/.test(String(value || "")) ? String(parseInt(value, 10)) : "";
}

function isoDay(stamp) {
  const m = String(stamp || "").match(/^(\d{4})(\d{2})(\d{2})T/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
