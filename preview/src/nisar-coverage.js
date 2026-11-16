// GET /api/nisar/coverage?bbox=w,s,e,n
// public CMR metadata. never mode demo, never the retired short name NISAR_L2_GCOV
import { edgeJson, json } from "./edge-cache.js";

const EDGE = "https://edge.termalwave/nisar/coverage";
const BROWSER_S = 120;
const DEFAULT_TTL_S = 600;
const CMR = "https://cmr.earthdata.nasa.gov/search/granules.json";
const PAGE_SIZE = 2000;
const TEMPORAL_START = "2025-07-30T00:00:00Z";
const DEAD_SHORT_NAME = "NISAR_L2_GCOV";
const GCOV_COLLECTIONS = [
  "NISAR_L2_GCOV_V1",
  "NISAR_L2_GCOV_PROVISIONAL_V1",
  "NISAR_L2_GCOV_BETA_V1",
];
const MATURITY_RANK = { validated: 0, provisional: 1, beta: 2 };

const POL = {
  DHDH: "HH+HV",
  DVDV: "VV+VH",
  SHSH: "HH",
  SVSV: "VV",
  SH: "HH",
  SV: "VV",
};

/**
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {Record<string, any>} appCfg
 * @param {Request} request
 */
export async function handleNisarCoverage(url, _env, ctx, appCfg, _request) {
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) return json({ status: "invalid", code: "bad_bbox", mode: "cmr" }, 400);

  const names = collectionsFrom(appCfg);
  const radarCfg = appCfg?.radar?.coverage || appCfg?.space?.nisar_coverage || {};
  const ttl = Number(radarCfg.cache_ttl_s || DEFAULT_TTL_S);
  const upstream = String(radarCfg.upstream || CMR);
  const temporalStart = String(radarCfg.temporal_start || TEMPORAL_START);
  const cacheKey = `${EDGE}?bbox=${bbox.map((v) => v.toFixed(3)).join(",")}&c=${names.join("+")}`;

  try {
    const out = await edgeJson(cacheKey, ttl, ctx, async () => {
      return await queryCmrCoverage(bbox, { names, upstream, temporalStart });
    });
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("nisar_coverage", err && err.message);
    return json(
      {
        status: "unavailable",
        code: "cmr_upstream",
        mode: "cmr",
        collection: names[0] || GCOV_COLLECTIONS[0],
        collections: names,
        fetched_at: new Date().toISOString(),
        bbox,
        count: 0,
        validated_count: 0,
        granules: [],
      },
      200,
    );
  }
}

/**
 * @param {number[]} bbox west,south,east,north
 * @param {{ names?: string[], upstream?: string, temporalStart?: string }} [opts]
 */
export async function queryCmrCoverage(bbox, opts = {}) {
  const names = (opts.names && opts.names.length ? opts.names : GCOV_COLLECTIONS).filter(
    (name) => name && name !== DEAD_SHORT_NAME,
  );
  const upstream = opts.upstream || CMR;
  const temporal = `${String(opts.temporalStart || TEMPORAL_START).replace(/,.*$/, "")},`;
  const settled = await Promise.allSettled(
    names.map((name) => searchCollection(upstream, name, bbox, temporal)),
  );
  const fulfilled = settled.filter((row) => row.status === "fulfilled");
  if (!fulfilled.length) {
    const failed = settled.find((row) => row.status === "rejected");
    throw new Error(failed && failed.reason ? String(failed.reason.message || failed.reason) : "cmr");
  }
  if (fulfilled.length < names.length && fulfilled.every((row) => row.value.length === 0)) {
    throw new Error("cmr_partial");
  }
  const granules = dedupeGranules(fulfilled.flatMap((row) => row.value));
  return coverageBody(bbox, names, granules);
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

export function maturityFor(shortName) {
  const name = String(shortName || "").toUpperCase();
  if (name.includes("BETA")) return "beta";
  if (name.includes("PROVISIONAL")) return "provisional";
  if (name.endsWith("_V1")) return "validated";
  return "unknown";
}

/**
 * NISAR science id:
 * NISAR_L2_PR_GCOV_<cycle>_<track>_<A|D>_<frame>_<mode>_<pol>_<freq>_<start>_<end>_...
 * @param {string} id
 */
export function parseNisarId(id) {
  const parts = String(id || "").replace(/\.h5$/i, "").split("_");
  if (parts[0] !== "NISAR" || parts.length < 8) return {};
  const product = parts[3] || "";
  const parsed = {
    cycle: trimNum(parts[4]),
    track: trimNum(parts[5]),
    direction: parts[6] === "A" ? "ascending" : parts[6] === "D" ? "descending" : "",
    frame: trimNum(parts[7]),
    pol: "",
    start: "",
    end: "",
  };
  if (product === "GCOV" || product === "SME2") {
    parsed.pol = polLabel(parts[9]);
    parsed.start = isoFromStamp(parts[11]);
    parsed.end = isoFromStamp(parts[12]);
  } else if (product === "GUNW") {
    parsed.pol = polLabel(parts[10]);
    parsed.start = isoFromStamp(parts[11]);
    parsed.end = isoFromStamp(parts[14]) || isoFromStamp(parts[12]);
  }
  return parsed;
}

/**
 * @param {Record<string, any>} entry
 * @param {string} shortName
 */
export function granuleFromEntry(entry, shortName) {
  if (!entry || typeof entry !== "object") return null;
  const id = nisarId(entry);
  if (!id) return null;
  const parsed = parseNisarId(id);
  const start = cmrTime(entry.time_start) || parsed.start || "";
  const end = cmrTime(entry.time_end) || parsed.end || start;
  if (!start) return null;
  return {
    id,
    start,
    end,
    // area card reads date; start is the contract field
    date: start,
    cycle: parsed.cycle || "",
    track: parsed.track || "",
    direction: parsed.direction || "",
    frame: parsed.frame || "",
    pol: parsed.pol || "",
    maturity: maturityFor(shortName),
    footprint: footprintFromEntry(entry),
    h5_url: h5Href(entry),
    product: shortName,
  };
}

export function footprintFromEntry(entry) {
  const polys = entry && entry.polygons;
  if (!Array.isArray(polys) || !polys.length) return null;
  const rings = [];
  for (const poly of polys) {
    const chunks = Array.isArray(poly) ? poly : [poly];
    for (const chunk of chunks) {
      const ring = ringFromLatLon(String(chunk || ""));
      if (ring) rings.push(ring);
    }
  }
  if (!rings.length) return null;
  if (rings.length === 1) return { type: "Polygon", coordinates: [rings[0]] };
  return { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) };
}

function collectionsFrom(appCfg) {
  const radar = appCfg?.radar?.coverage || appCfg?.space?.nisar_coverage || {};
  const listed = Array.isArray(radar.collections) ? radar.collections : [];
  const names = listed.map((item) => String(item).trim()).filter((item) => item && item !== DEAD_SHORT_NAME);
  if (names.length) return names;
  const one = String(radar.collection || "").trim();
  if (one && one !== DEAD_SHORT_NAME) return [one];
  return GCOV_COLLECTIONS.slice();
}

async function searchCollection(upstream, shortName, bbox, temporal) {
  const entries = [];
  for (let page = 1; page <= 10; page += 1) {
    const u = new URL(upstream);
    u.searchParams.set("short_name", shortName);
    u.searchParams.set("bounding_box", bbox.join(","));
    u.searchParams.set("temporal", temporal);
    u.searchParams.set("page_size", String(PAGE_SIZE));
    u.searchParams.set("page_num", String(page));
    const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`cmr ${res.status} ${shortName}`);
    const payload = await res.json();
    const batch = (payload && payload.feed && payload.feed.entry) || payload.items || [];
    if (!Array.isArray(batch) || !batch.length) break;
    for (const entry of batch) {
      const granule = granuleFromEntry(entry, shortName);
      if (granule) entries.push(granule);
    }
    if (batch.length < PAGE_SIZE) break;
  }
  return entries;
}

function coverageBody(bbox, names, granules) {
  const validated = granules.filter((row) => row.maturity === "validated").length;
  const status = granules.length ? "ok" : "empty";
  return {
    status,
    code: status,
    mode: "cmr",
    collection: names[0] || GCOV_COLLECTIONS[0],
    collections: names,
    fetched_at: new Date().toISOString(),
    bbox,
    count: granules.length,
    validated_count: validated,
    granules,
  };
}

function dedupeGranules(rows) {
  const byId = new Map();
  for (const row of rows) {
    const prev = byId.get(row.id);
    if (!prev || (MATURITY_RANK[row.maturity] ?? 9) < (MATURITY_RANK[prev.maturity] ?? 9)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

function nisarId(entry) {
  for (const key of ["producer_granule_id", "title", "id"]) {
    const value = String(entry[key] || "");
    if (value.startsWith("NISAR")) return value;
  }
  return "";
}

function h5Href(entry) {
  let fallback = "";
  for (const link of entry.links || []) {
    if (!link || typeof link !== "object") continue;
    const href = String(link.href || "");
    const rel = String(link.rel || "");
    if (!href || !rel.includes("data") || href.startsWith("s3:")) continue;
    if (href.includes(".h5")) return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

function cmrTime(value) {
  if (!value) return "";
  const text = String(value);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function trimNum(value) {
  const text = String(value || "");
  if (!/^\d+$/.test(text)) return "";
  return String(parseInt(text, 10));
}

function polLabel(value) {
  const text = String(value || "").toUpperCase();
  return POL[text] || text;
}

function isoFromStamp(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

// cmr rings are lat lon pairs; geojson wants lon lat
function ringFromLatLon(text) {
  const nums = text.trim().split(/\s+/).map(Number);
  if (nums.length < 8 || nums.length % 2 !== 0 || nums.some((n) => !Number.isFinite(n))) return null;
  const ring = [];
  for (let i = 0; i < nums.length; i += 2) ring.push([nums[i + 1], nums[i]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring;
}
