// geocentric sun, moon and planets from jpl horizons (no cors upstream, so it goes through here)
// one utc day per answer: rows at 00:00 .. 24:00 every step_hours, astrometric icrf ra/dec + range
import { edgeJson, json } from "./edge-cache.js";

const AU_KM = 149_597_870.7;
const DAY_MS = 86_400_000;
const ARCHIVE_TTL_S = 365 * 86_400;
const LIVE_TTL_S = 6 * 3_600;
const BROWSER_ARCHIVE_S = 86_400;
const BROWSER_LIVE_S = 3_600;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const KEY = "https://edge.termalwave/ephemeris";

/**
 * GET /api/ephemeris?t=<iso> -> {t0, step_s, bodies: {name: [[raDeg, decDeg, distKm], ...]}}
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {Record<string, any>} cfg app-config.json
 */
export async function handleEphemeris(url, env, ctx, cfg) {
  const eph = cfg?.space?.ephemeris;
  if (!eph?.upstream || !eph.bodies) return json({ error: "ephemeris_not_configured" }, 503);
  const at = Date.parse(url.searchParams.get("t") || "");
  if (!Number.isFinite(at)) return json({ error: "bad_time" }, 400);
  const year = new Date(at).getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return json({ error: "time_out_of_range" }, 400);

  const step = Math.max(1, Math.min(24, Math.round(eph.step_hours || 1)));
  const dayStart = Math.floor(at / DAY_MS) * DAY_MS;
  const day = new Date(dayStart).toISOString().slice(0, 10);
  const archived = dayStart + DAY_MS < Date.now();
  const ttl = archived ? ARCHIVE_TTL_S : LIVE_TTL_S;
  const bodies = Object.entries(eph.bodies).sort(([a], [b]) => a.localeCompare(b));
  const ids = bodies.map(([name, id]) => `${name}:${id}`).join(",");

  try {
    const out = await edgeJson(`${KEY}/l2/${day}?step=${step}&bodies=${encodeURIComponent(ids)}`, ttl, ctx, async () => {
      // horizons answers 503 to parallel requests from one client, so one body at a time
      const parsed = [];
      for (const [, id] of bodies) {
        const raw = await edgeJson(`${KEY}/l1/${encodeURIComponent(id)}/${day}?step=${step}`, ttl, ctx, () => horizons(eph.upstream, id, dayStart, step));
        parsed.push(parseObserver(raw));
      }
      const expected = 24 / step + 1;
      for (const p of parsed) if (p.rows.length < expected) throw new Error("short table");
      return {
        t0: new Date(parsed[0].t0).toISOString(),
        step_s: step * 3600,
        bodies: Object.fromEntries(bodies.map(([name], i) => [name, parsed[i].rows.slice(0, expected)])),
      };
    });
    return json(out, 200, archived ? BROWSER_ARCHIVE_S : BROWSER_LIVE_S);
  } catch (err) {
    console.error("ephemeris", err && err.message ? err.message : "error");
    return json({ error: "upstream_failed" }, 502);
  }
}

function horizonsTime(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

/** raw horizons answer ({result: "<text>"}), stored as l1 */
async function horizons(upstream, id, dayStart, step) {
  const q = new URLSearchParams({
    format: "json",
    COMMAND: `'${id}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${horizonsTime(dayStart)}'`,
    STOP_TIME: `'${horizonsTime(dayStart + DAY_MS)}'`,
    STEP_SIZE: `'${step} h'`,
    QUANTITIES: "'1,20'",
    ANG_FORMAT: "'DEG'",
    CAL_FORMAT: "'JD'",
    CSV_FORMAT: "'YES'",
  });
  const r = await fetch(`${upstream}?${q}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`horizons ${r.status}`);
  const data = await r.json();
  if (data.error || typeof data.result !== "string") throw new Error("horizons error");
  return { result: data.result };
}

/** csv observer table -> {t0 ms, rows: [[raDeg, decDeg, distKm]]} */
function parseObserver(raw) {
  const text = raw.result;
  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe < 0 || eoe < soe) throw new Error("horizons table missing");
  const head = text.slice(0, soe).trimEnd().split("\n");
  const columns = head[head.length - 2].split(",").map((c) => c.trim());
  const col = (prefix) => {
    const i = columns.findIndex((c) => c.startsWith(prefix));
    if (i < 0) throw new Error(`horizons column ${prefix}`);
    return i;
  };
  const [iJd, iRa, iDec, iDelta] = [col("Date"), col("R.A."), col("DEC"), col("delta")];
  const lines = text.slice(soe + 5, eoe).trim().split("\n");
  let t0 = NaN;
  const rows = lines.map((line, n) => {
    const f = line.split(",").map((c) => c.trim());
    if (n === 0) t0 = Math.round((Number(f[iJd]) - 2440587.5) * DAY_MS);
    const row = [Number(f[iRa]), Number(f[iDec]), Math.round(Number(f[iDelta]) * AU_KM)];
    if (!row.every(Number.isFinite)) throw new Error("horizons row");
    return row;
  });
  return { t0, rows };
}
