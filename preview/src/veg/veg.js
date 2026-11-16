// Vegetation analytics as geojson grids: MODIS cells built offline by termalwave/veg,
// water balance computed live from Open-Meteo (keyless).
import { edgeJson, json } from "../edge-cache.js";
import santiago from "./data/santiago.json" with { type: "json" };

const REGIONS = [santiago];
const EDGE = "https://edge.termalwave/veg-v2";
const BROWSER_S = 600;
const STATIC_TTL_S = 86400;
const WATER_TTL_S = 3 * 3600;
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const ENSEMBLE = "https://ensemble-api.open-meteo.com/v1/ensemble";
const GRID_MAX = 6;
const WINDOW_D = 30; // water balance window, days
const LEAD_D = 16; // outlook horizon, days
const PAST_D = 92; // longest look-back the forecast api allows
const CROPLAND_MIN = 0.25; // cell flagged as farmland from this cropland share
const CLASS_NAMES = ["low", "medium", "high"];
const DAY_MS = 86400000;

const MODIS_ATTR = "NASA LP DAAC MODIS via ORNL DAAC Land Product Subsets";
const METEO_ATTR = "Open-Meteo (CC BY 4.0)";

/** @type {Record<string, (c: any, now: Date) => Record<string, unknown> | null>} */
const CELL_LAYERS = {
  ndvi: (c) =>
    c.ndvi == null
      ? null
      : {
          ndvi: c.ndvi,
          ndvi_date: c.ndvi_date,
          ndvi_anomaly: c.ndvi_anomaly ?? null,
          ndvi_anomaly_z: c.ndvi_anomaly_z ?? null,
          ndvi_clim_mean: c.ndvi_clim_mean ?? null,
          ndvi_clim_years: c.ndvi_clim_n,
          series: c.series,
          series_dates: c.series_dates,
        },
  productivity: (c) =>
    c.productivity_class == null
      ? null
      : {
          productivity_class: c.productivity_class,
          productivity_label: CLASS_NAMES[c.productivity_class],
          productivity_pct: c.productivity_pct,
          npp_kgc_m2: c.npp_kgc_m2,
          npp_year: c.npp_year,
          npp_p33: c.npp_p33,
          npp_p67: c.npp_p67,
          npp_years: c.npp_years,
          cropland_share: c.cropland_share ?? null,
          cropland: c.cropland_share != null ? c.cropland_share >= CROPLAND_MIN : null,
          lc_majority_igbp: c.lc_majority_igbp ?? null,
          lc_year: c.lc_year ?? null,
        },
  peak: (c) =>
    c.peak_month == null
      ? null
      : {
          peak_month: c.peak_month,
          confidence: c.peak_consistency,
          peak_years: c.peak_years,
          peak_months_by_season: c.peak_months_by_season,
        },
  greenup: (c) =>
    c.greenup_doy == null
      ? null
      : {
          greenup_season_day: seasonDay(c.greenup_date, c.greenup_season, c.bounds),
          greenup_doy: c.greenup_doy,
          greenup_date: c.greenup_date,
          greenup_season: c.greenup_season,
          rain_onset: c.rain_onset,
          onset_to_greenup_days: c.onset_to_greenup_days,
          greenup_history: c.greenup_history,
        },
  "greenup-next": (c, now) =>
    c.pred_greenup == null
      ? null
      : {
          days_until: Math.round((Date.parse(c.pred_greenup) - now.getTime()) / DAY_MS),
          pred_greenup: c.pred_greenup,
          window_start: c.pred_window_start,
          window_end: c.pred_window_end,
          basis: c.pred_basis,
          rain_onset_this_season: c.pred_rain_onset,
          rain_onset_provisional: c.pred_onset_provisional,
          years: c.pred_years,
          spread_iqr_days: c.pred_iqr_days,
          confidence: c.pred_confidence,
        },
};

/**
 * @param {URL} url
 * @param {Record<string, any>} _env
 * @param {ExecutionContext} ctx
 */
export async function handleVeg(url, _env, ctx) {
  const name = url.pathname.slice("/api/veg/".length);
  const raw = url.searchParams.get("bbox");
  const bbox = parseBbox(raw);
  if (raw && !bbox) return json({ error: "bad bbox, want w,s,e,n" }, 400);
  const now = parseDate(url.searchParams.get("date")) || new Date();
  if (CELL_LAYERS[name]) return json(cellLayer(name, bbox, now), 200, BROWSER_S);
  if (name !== "water" && name !== "water-outlook") return json({ error: "not_found" }, 404);
  if (!bbox) return json({ error: "need bbox=w,s,e,n" }, 400);
  const day = now.toISOString().slice(0, 10);
  const key = `${EDGE}/${name}/${bbox.map((v) => v.toFixed(2)).join(",")}/${day}`;
  try {
    const out = await edgeJson(key, WATER_TTL_S, ctx, () => (name === "water" ? water(bbox, day) : outlook(bbox)));
    return json(out, 200, BROWSER_S);
  } catch (err) {
    console.warn("veg", name, err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

function cellLayer(name, bbox, now) {
  const features = [];
  const covered = [];
  for (const r of REGIONS) {
    covered.push({ region: r.region, bbox: r.bbox, built: r.built });
    if (bbox && !overlaps(bbox, r.bbox)) continue;
    for (const c of r.cells) {
      if (bbox && !overlaps(bbox, c.bounds)) continue;
      const props = CELL_LAYERS[name](c, now);
      if (props) features.push(cellFeature(c.id, c.bounds, props));
    }
  }
  return {
    type: "FeatureCollection",
    features,
    meta: {
      attribution: name === "greenup" || name === "greenup-next" ? `${MODIS_ATTR}; ${METEO_ATTR}` : MODIS_ATTR,
      count: features.length,
      coverage: covered,
      // cells are precomputed: an empty answer outside coverage is a gap, not a zero
      note: features.length ? undefined : "no precomputed cells in this area",
      ttl_s: STATIC_TTL_S,
    },
  };
}

// processed: 30-day rain minus reference evapotranspiration, and when the deficit run began
async function water(bbox, day) {
  const cells = grid(bbox);
  const end = new Date(`${day}T00:00:00Z`);
  const recent = Date.now() - end.getTime() < 5 * DAY_MS;
  const lats = cells.map((c) => c.lat).join(",");
  const lons = cells.map((c) => c.lon).join(",");
  const vars = "daily=precipitation_sum,et0_fao_evapotranspiration&timezone=UTC";
  const src = recent
    ? `${FORECAST}?latitude=${lats}&longitude=${lons}&${vars}&past_days=${PAST_D}&forecast_days=1`
    : `${ARCHIVE}?latitude=${lats}&longitude=${lons}&${vars}&start_date=${iso(end.getTime() - (PAST_D - 1) * DAY_MS)}&end_date=${day}`;
  const rows = asList(await getJson(src));
  const features = [];
  rows.forEach((row, i) => {
    const d = row.daily;
    if (!d?.time) return;
    // today is still partly forecast, so the live window ends yesterday
    const upto = d.time.indexOf(recent ? iso(Date.now() - DAY_MS) : day);
    const last = upto >= 0 ? upto : d.time.length - 1;
    const bal = dailyBalance(d, last);
    const roll = rolling(bal);
    const k = roll.length - 1;
    if (k < 0 || roll[k] == null) return;
    let start = null;
    let before = false;
    if (roll[k] < 0) {
      let j = k;
      while (j > 0 && roll[j - 1] != null && roll[j - 1] < 0) j--;
      start = d.time[j + WINDOW_D - 1];
      before = j === 0; // run already going when our look-back starts
    }
    features.push(
      cellFeature(cells[i].id, cells[i].bounds, {
        balance_mm: round1(roll[k]),
        rain_mm: round1(sum(d.precipitation_sum, last - WINDOW_D + 1, last)),
        et0_mm: round1(sum(d.et0_fao_evapotranspiration, last - WINDOW_D + 1, last)),
        deficit: roll[k] < 0,
        deficit_since: start,
        deficit_since_is_lower_bound: before,
        window_end: d.time[last],
        series: roll.slice(-60).map(round1),
        series_dates: d.time.slice(last - Math.min(60, roll.length) + 1, last + 1),
      }),
    );
  });
  return { type: "FeatureCollection", features, meta: { attribution: METEO_ATTR, count: features.length, window_days: WINDOW_D } };
}

// prediction: the same 30-day balance ending 16 days ahead, per ensemble member
async function outlook(bbox) {
  const cells = grid(bbox);
  const lats = cells.map((c) => c.lat).join(",");
  const lons = cells.map((c) => c.lon).join(",");
  const vars = "daily=precipitation_sum,et0_fao_evapotranspiration&timezone=UTC";
  const [pastRows, ensRows] = await Promise.all([
    getJson(`${FORECAST}?latitude=${lats}&longitude=${lons}&${vars}&past_days=${WINDOW_D}&forecast_days=1`).then(asList),
    getJson(`${ENSEMBLE}?latitude=${lats}&longitude=${lons}&${vars}&forecast_days=${LEAD_D}&models=gfs025`).then(asList),
  ]);
  const features = [];
  cells.forEach((cell, i) => {
    const p = pastRows[i]?.daily;
    const e = ensRows[i]?.daily;
    if (!p?.time || !e?.time) return;
    const today = iso(Date.now());
    const t0 = e.time.indexOf(today) >= 0 ? e.time.indexOf(today) : 0;
    const members = memberKeys(e);
    let end = t0 - 1;
    for (let day = t0; day < e.time.length; day++) {
      const complete = members.filter(([pk, ek]) =>
        Number.isFinite(sum(e[pk], t0, day)) && Number.isFinite(sum(e[ek], t0, day)));
      if (complete.length < 5) break;
      end = day;
    }
    const lead = end - t0 + 1;
    if (lead < 1) return;
    // observed days fill the part of the window before today
    const pastEnd = p.time.indexOf(today) - 1;
    const keep = WINDOW_D - lead;
    if (pastEnd < keep - 1 || keep < 0) return;
    const observed = sum(p.precipitation_sum, pastEnd - keep + 1, pastEnd) - sum(p.et0_fao_evapotranspiration, pastEnd - keep + 1, pastEnd);
    if (!Number.isFinite(observed)) return;
    const totals = [];
    for (const [pk, ek] of members) {
      const rain = sum(e[pk], t0, end);
      const et0 = sum(e[ek], t0, end);
      if (Number.isFinite(rain) && Number.isFinite(et0)) totals.push(observed + rain - et0);
    }
    if (totals.length < 5) return;
    totals.sort((a, b) => a - b);
    const med = totals[Math.floor(totals.length / 2)];
    const agree = totals.filter((v) => (v < 0) === (med < 0)).length / totals.length;
    features.push(
      cellFeature(cell.id, cell.bounds, {
        balance_mm: round1(med),
        balance_p10_mm: round1(totals[Math.floor(totals.length * 0.1)]),
        balance_p90_mm: round1(totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.9))]),
        deficit: med < 0,
        members: totals.length,
        confidence: Math.round(agree * 100) / 100,
        window_end: e.time[end],
        lead_days: lead,
        requested_lead_days: LEAD_D,
      }),
    );
  });
  return {
    type: "FeatureCollection",
    features,
    meta: { attribution: `${METEO_ATTR}; NOAA GFS ensemble`, count: features.length, window_days: WINDOW_D, requested_lead_days: LEAD_D,
      lead_days: features.length ? Math.min(...features.map((f) => f.properties.lead_days)) : null,
      note: features.length ? undefined : "insufficient complete forecast members", },
  };
}

function memberKeys(d) {
  const out = [["precipitation_sum", "et0_fao_evapotranspiration"]];
  for (const k of Object.keys(d)) {
    const m = k.match(/^precipitation_sum_(member\d+)$/);
    if (m && d[`et0_fao_evapotranspiration_${m[1]}`]) out.push([k, `et0_fao_evapotranspiration_${m[1]}`]);
  }
  return out;
}

function dailyBalance(d, last) {
  const out = [];
  for (let i = 0; i <= last; i++) {
    const p = d.precipitation_sum?.[i];
    const e = d.et0_fao_evapotranspiration?.[i];
    out.push(p == null || e == null ? null : p - e);
  }
  return out;
}

/** 30-day sums; index j covers days j..j+29 */
function rolling(bal) {
  const out = [];
  for (let j = 0; j + WINDOW_D <= bal.length; j++) {
    const w = bal.slice(j, j + WINDOW_D);
    out.push(w.some((v) => v == null) ? null : w.reduce((a, b) => a + b, 0));
  }
  return out;
}

function grid(bbox) {
  const [w, s, e, n] = bbox;
  const dx = (e - w) / GRID_MAX;
  const dy = (n - s) / GRID_MAX;
  const cells = [];
  for (let j = 0; j < GRID_MAX; j++) {
    for (let i = 0; i < GRID_MAX; i++) {
      const cw = w + i * dx;
      const cs = s + j * dy;
      cells.push({
        id: `w${j}_${i}`,
        bounds: [cw, cs, cw + dx, cs + dy].map((v) => +v.toFixed(4)),
        lon: +(cw + dx / 2).toFixed(4),
        lat: +(cs + dy / 2).toFixed(4),
      });
    }
  }
  return cells;
}

// days after 1 Jul (south) or 1 Jan (north): keeps a Dec/Jan green-up continuous on the ramp
function seasonDay(date, season, [, s, , n]) {
  const start = s + n < 0 ? `${season}-07-01` : `${season}-01-01`;
  return Math.round((Date.parse(date) - Date.parse(start)) / DAY_MS);
}

function cellFeature(id, [w, s, e, n], properties) {
  return {
    type: "Feature",
    id,
    geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    properties: { cell: id, ...properties },
  };
}

function overlaps(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** @returns {number[] | null} west,south,east,north */
function parseBbox(raw) {
  if (!raw) return null;
  const p = raw.split(",").map(Number);
  if (p.length !== 4 || p.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, n] = p;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return null;
  return p;
}

function parseDate(raw) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  // future dates fall back to today: the live answers stop there
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() ? null : d;
}

function sum(arr, a, b) {
  let t = 0;
  for (let i = Math.max(0, a); i <= b; i++) t += Number(arr?.[i] ?? NaN);
  return t;
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const asList = (raw) => (Array.isArray(raw) ? raw : [raw]);

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  return res.json();
}
