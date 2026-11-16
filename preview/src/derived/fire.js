// fire weather (Fosberg FFWI) for a day, and its 72 h forecast with FIRMS hotspots per cell
import { handleFirms } from "../firms.js";
import {
  FORECAST,
  LEAD_WEIGHT,
  addDays,
  baseFor,
  cellFeature,
  featureCollection,
  meteo,
  round,
  sumDays,
  todayUtc,
} from "./common.js";

const HOURLY = "hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph";
const RAIN_DAY_MM = 1;
const DRY_LOOKBACK = 30;
// FFWI class edges; project thresholds stated in the catalog caveats
const CLASS_EDGES = [20, 40, 60];

/**
 * Fosberg (1978) Fire Weather Index with the Sharples et al. (2009) cap at 100.
 * T in F, RH in %, U in mph; equilibrium moisture content from Simard (1968).
 */
export function ffwi(tF, rh, uMph) {
  if (![tF, rh, uMph].every(Number.isFinite)) return null;
  let m;
  if (rh < 10) m = 0.03229 + 0.281073 * rh - 0.000578 * rh * tF;
  else if (rh < 50) m = 2.22749 + 0.160107 * rh - 0.01478 * tF;
  else m = 21.0606 + 0.005565 * rh * rh - 0.00035 * rh * tF - 0.483199 * rh;
  const x = Math.max(0, m) / 30;
  const eta = Math.max(0, 1 - 2 * x + 1.5 * x * x - 0.5 * x * x * x);
  return Math.min(100, (eta * Math.sqrt(1 + uMph * uMph)) / 0.3002);
}

export function ffwiClass(v) {
  if (!Number.isFinite(v)) return null;
  return CLASS_EDGES.filter((e) => v >= e).length;
}

/** daily maximum of hourly FFWI, keyed by YYYY-MM-DD */
function dailyMaxFfwi(hourly) {
  const out = {};
  (hourly?.time || []).forEach((t, i) => {
    const v = ffwi(hourly.temperature_2m?.[i], hourly.relative_humidity_2m?.[i], hourly.wind_speed_10m?.[i]);
    if (v == null) return;
    const day = t.slice(0, 10);
    if (out[day] == null || v > out[day]) out[day] = v;
  });
  return out;
}

function daysSinceRain(daily, date) {
  for (let k = 0; k <= DRY_LOOKBACK; k++) {
    const p = sumDays(daily, "precipitation_sum", addDays(date, -k), addDays(date, -k));
    if (p == null) return null;
    if (p >= RAIN_DAY_MM) return k;
  }
  return DRY_LOOKBACK + 1;
}

export async function fireWeather(cells, bbox, date) {
  const from = addDays(date, -DRY_LOOKBACK);
  const [wx, rain] = await Promise.all([
    meteo(baseFor(date), cells, `${HOURLY}&start_date=${date}&end_date=${date}`),
    meteo(baseFor(from), cells, `daily=precipitation_sum&start_date=${from}&end_date=${date}`),
  ]);
  const features = [];
  cells.forEach((c, i) => {
    const v = dailyMaxFfwi(wx[i].hourly)[date];
    if (v == null) return;
    features.push(
      cellFeature(c, {
        ffwi: round(v, 1),
        danger_class: ffwiClass(v),
        days_since_rain: daysSinceRain(rain[i].daily, date),
        rain_30d_mm: round(sumDays(rain[i].daily, "precipitation_sum", addDays(date, -29), date), 1),
      }),
    );
  });
  return featureCollection({ layer: "fire_weather_index", bbox, date, method: "fosberg_ffwi_daily_max" }, features);
}

export async function fireDanger3d(cells, bbox, env, ctx, cfg) {
  const issued = todayUtc();
  const days = [1, 2, 3].map((k) => addDays(issued, k));
  const [wx, hot] = await Promise.all([
    meteo(FORECAST, cells, `${HOURLY}&start_date=${days[0]}&end_date=${days[2]}`),
    hotspots(bbox, env, ctx, cfg),
  ]);
  const features = [];
  cells.forEach((c, i) => {
    const byDay = dailyMaxFfwi(wx[i].hourly);
    const vals = days.map((d) => byDay[d]);
    if (vals.some((v) => v == null)) return;
    const peak = vals.indexOf(Math.max(...vals));
    const classes = vals.map(ffwiClass);
    // agreement: 1 when the three days fall in one class, 0 when they span all four
    const agreement = 1 - (Math.max(...classes) - Math.min(...classes)) / CLASS_EDGES.length;
    const confidence = LEAD_WEIGHT.weather[peak] * (0.5 + 0.5 * agreement);
    const n = hot ? countIn(hot, c.box) : null;
    features.push(
      cellFeature(c, {
        ffwi_max_3d: round(vals[peak], 1),
        danger_class: classes[peak],
        peak_day: days[peak],
        ffwi_d1: round(vals[0], 1),
        ffwi_d2: round(vals[1], 1),
        ffwi_d3: round(vals[2], 1),
        hotspots_24h: n,
        burning_now: n == null ? null : n > 0,
        confidence: round(confidence, 3),
      }),
    );
  });
  return featureCollection(
    { layer: "fire_danger_3d", bbox, issued, days, hotspots: hot ? "ok" : "unavailable", method: "fosberg_ffwi_forecast" },
    features,
  );
}

/** FIRMS points through the existing route (same cache); null when FIRMS is off or down */
async function hotspots(bbox, env, ctx, cfg) {
  try {
    const res = await handleFirms(new URL(`https://edge.termalwave/api/firms?bbox=${bbox.join(",")}`), env, ctx, cfg || {});
    if (!res.ok) return null;
    const fc = await res.json();
    return (fc.features || []).map((f) => f.geometry.coordinates);
  } catch {
    return null;
  }
}

function countIn(points, [w, s, e, n]) {
  return points.filter(([x, y]) => x >= w && x < e && y >= s && y < n).length;
}
