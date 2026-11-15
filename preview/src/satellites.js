// celestrak gp elements for the satellites layer, double cached at the edge
//
// keys (https://edge.termalwave/satellites/...):
//   l1/<group>/latest        raw celestrak json, ttl = cfg.cache_ttl_s (celestrak asks for >= 2 h)
//   l1/<group>/day/<yyyy-mm-dd>  raw json as first fetched on that utc day, archive ttl;
//                            serves ?day= for the timeline and is the stale copy when celestrak fails
//   l2/<group>/latest        normalized answer for the latest elements, ttl = cfg.cache_ttl_s
//   l2/<group>/day/<yyyy-mm-dd>  normalized answer for an archived day, archive ttl
// caches.default is per colo and may evict, so the archive is best effort
import { edgeJson, json } from "./edge-cache.js";

const ARCHIVE_TTL_S = 365 * 86400;
const BROWSER_TTL_S = 600;
const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// fields json2satrec reads; the client (web/src/scene/space/satellites.ts) and
// scripts/build_satellite_snapshot.py share this shape
const OMM_FIELDS = [
  "OBJECT_NAME",
  "OBJECT_ID",
  "EPOCH",
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "NORAD_CAT_ID",
  "ELEMENT_SET_NO",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
];

class NotArchived extends Error {}

/**
 * GET /api/satellites?group=<name>[&day=yyyy-mm-dd]
 * @param {URL} url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} ctx
 * @param {{upstream: string, groups: string[], cache_ttl_s: number} | undefined} cfg space.satellites of app-config.json
 * @returns {Promise<Response>}
 */
export async function handleSatellites(url, _env, ctx, cfg) {
  if (!cfg?.groups?.length) return json({ error: "satellites_disabled" }, 503);
  const group = url.searchParams.get("group") || "";
  if (!cfg.groups.includes(group)) return json({ error: "unknown_group" }, 400);
  const day = url.searchParams.get("day");
  if (day !== null && (!DAY_RE.test(day) || Number.isNaN(Date.parse(day)))) return json({ error: "bad_day" }, 400);

  const today = utcDay(Date.now());
  const key = (layer, slot) => `https://edge.termalwave/satellites/${layer}/${encodeURIComponent(group)}/${slot}`;
  const archived = (d) =>
    edgeJson(key("l1", `day/${d}`), ARCHIVE_TTL_S, ctx, async () => {
      throw new NotArchived(d);
    });

  try {
    if (day && day !== today) {
      if (day > today) return json({ error: "future_day" }, 400);
      const out = await edgeJson(key("l2", `day/${day}`), ARCHIVE_TTL_S, ctx, async () => normalize(group, day, await archived(day)));
      return json(out, 200, ARCHIVE_TTL_S);
    }
    const ttl = cfg.cache_ttl_s || 0;
    const out = await edgeJson(key("l2", "latest"), ttl, ctx, async () => {
      const raw = await latestRaw(cfg.upstream, group, ttl, ctx, key, archived, today);
      return normalize(group, today, raw);
    });
    return json(out, 200, Math.min(BROWSER_TTL_S, ttl));
  } catch (err) {
    if (err instanceof NotArchived) return json({ error: "not_archived", day }, 404);
    console.warn("satellites", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

// latest celestrak copy; also files it under today's archive key, and falls back
// to the newest archived day when celestrak is down or throttling us
async function latestRaw(upstream, group, ttl, ctx, key, archived, today) {
  try {
    const raw = await edgeJson(key("l1", "latest"), ttl, ctx, () => fetchGroup(upstream, group));
    await edgeJson(key("l1", `day/${today}`), ARCHIVE_TTL_S, ctx, async () => raw);
    return raw;
  } catch (err) {
    for (const d of [today, utcDay(Date.now() - DAY_MS)]) {
      try {
        return await archived(d);
      } catch {
        // try the previous day
      }
    }
    throw err;
  }
}

async function fetchGroup(upstream, group) {
  const u = new URL(upstream);
  u.searchParams.set("GROUP", group);
  u.searchParams.set("FORMAT", "json");
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`celestrak ${r.status}`);
  // celestrak answers throttled or unknown groups with plain text and 200
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`celestrak non-json: ${text.slice(0, 80)}`);
  }
  if (!Array.isArray(data) || data.length === 0) throw new Error("celestrak empty group");
  return data;
}

/**
 * @param {string} group
 * @param {string} day utc day the elements were fetched
 * @param {Array<Record<string, unknown>>} raw celestrak gp json
 */
function normalize(group, day, raw) {
  const satellites = [];
  for (const rec of raw) {
    if (!rec || typeof rec !== "object" || !rec.OBJECT_NAME || rec.NORAD_CAT_ID == null) continue;
    const omm = {};
    for (const f of OMM_FIELDS) omm[f] = rec[f];
    satellites.push({ name: String(rec.OBJECT_NAME).trim(), norad: Number(rec.NORAD_CAT_ID), omm });
  }
  return { group, day, satellites };
}

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
