// landslide and flood layers: terrain from Open-Meteo elevation plus observed or forecast rain
import {
  FORECAST,
  LEAD_WEIGHT,
  addDays,
  baseFor,
  cellFeature,
  clamp,
  elevations,
  featureCollection,
  meteo,
  round,
  sumDays,
  todayUtc,
} from "./common.js";

// ~110 m north-south offset: about one cell of the 90 m Copernicus DEM behind the api
const OFFSET_DEG = 0.001;
const M_PER_DEG = 111320;
// Guzzetti et al. (2008) global minimum intensity-duration threshold I = 2.20 D^-0.44 (mm/h, h)
const D_HOURS = 72;
const RAIN_THRESHOLD_MM = 2.2 * Math.pow(D_HOURS, -0.44) * D_HOURS;
// slope range over which shallow landslide susceptibility rises from none to full
const SLOPE_MIN = 5;
const SLOPE_FULL = 35;
// 72 h total treated as flood-capable rain on flat low ground
const FLOOD_RAIN_MM = 50;
const FLAT_DEG = 5;

/** centre elevation and slope (degrees, central differences) per cell; 5 samples per cell */
export async function terrain(cells) {
  const pts = [];
  for (const c of cells) {
    const dLon = OFFSET_DEG / Math.max(0.1, Math.cos((c.lat * Math.PI) / 180));
    pts.push([c.lat, c.lon], [c.lat, c.lon + dLon], [c.lat, c.lon - dLon], [c.lat + OFFSET_DEG, c.lon], [c.lat - OFFSET_DEG, c.lon]);
  }
  const z = await elevations(pts);
  const span = 2 * OFFSET_DEG * M_PER_DEG;
  return cells.map((_, i) => {
    const [zc, ze, zw, zn, zs] = z.slice(i * 5, i * 5 + 5);
    const gx = (ze - zw) / span;
    const gy = (zn - zs) / span;
    return { elev_m: zc, slope_deg: (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI };
  });
}

function slopeFactor(deg) {
  return clamp((deg - SLOPE_MIN) / (SLOPE_FULL - SLOPE_MIN));
}

/** forecast confidence for rain-driven layers: lead weights averaged by each day's share of rain */
function rainConfidence(perDay) {
  const total = perDay.reduce((a, b) => a + b, 0);
  const w = LEAD_WEIGHT.rain;
  if (total <= 0) return w.reduce((a, b) => a + b, 0) / w.length;
  return perDay.reduce((acc, p, k) => acc + (p / total) * w[k], 0);
}

export async function forecastRain(cells) {
  const issued = todayUtc();
  const days = [1, 2, 3].map((k) => addDays(issued, k));
  const rows = await meteo(FORECAST, cells, `daily=precipitation_sum&start_date=${days[0]}&end_date=${days[2]}`);
  return { issued, days, perDay: rows.map((r) => days.map((d) => sumDays(r.daily, "precipitation_sum", d, d))) };
}

export async function landslideSusceptibility(cells, bbox, date, terr) {
  const from = addDays(date, -2);
  const rows = await meteo(baseFor(from), cells, `daily=precipitation_sum&start_date=${from}&end_date=${date}`);
  const features = [];
  cells.forEach((c, i) => {
    const t = terr[i];
    const p72 = sumDays(rows[i].daily, "precipitation_sum", from, date);
    if (!Number.isFinite(t.slope_deg) || p72 == null) return;
    const ratio = p72 / RAIN_THRESHOLD_MM;
    features.push(
      cellFeature(c, {
        index: round(slopeFactor(t.slope_deg) * clamp(ratio), 3),
        slope_deg: round(t.slope_deg, 1),
        elev_m: round(t.elev_m, 0),
        rain_72h_mm: round(p72, 1),
        rain_vs_threshold: round(ratio, 2),
      }),
    );
  });
  return featureCollection(
    { layer: "landslide_susceptibility", bbox, date, threshold_mm_72h: round(RAIN_THRESHOLD_MM, 1), method: "slope_x_guzzetti2008_id" },
    features,
  );
}

export async function landslide3d(cells, bbox, terr, rain) {
  const { issued, days, perDay } = rain;
  const features = [];
  cells.forEach((c, i) => {
    const t = terr[i];
    if (!Number.isFinite(t.slope_deg) || perDay[i].some((p) => p == null)) return;
    const p72 = perDay[i].reduce((a, b) => a + b, 0);
    const ratio = p72 / RAIN_THRESHOLD_MM;
    features.push(
      cellFeature(c, {
        likelihood: round(slopeFactor(t.slope_deg) * clamp(ratio), 3),
        slope_deg: round(t.slope_deg, 1),
        rain_72h_forecast_mm: round(p72, 1),
        rain_vs_threshold: round(ratio, 2),
        confidence: round(rainConfidence(perDay[i]), 3),
      }),
    );
  });
  return featureCollection({ layer: "landslide_3d", bbox, issued, days, method: "slope_x_guzzetti2008_id_forecast" }, features);
}

export async function flood3d(cells, bbox, terr, rain) {
  const { issued, days, perDay } = rain;
  const z = terr.map((t) => t.elev_m).filter(Number.isFinite);
  const mean = z.reduce((a, b) => a + b, 0) / Math.max(1, z.length);
  const sd = Math.max(1, Math.sqrt(z.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, z.length)));
  const features = [];
  cells.forEach((c, i) => {
    const t = terr[i];
    if (!Number.isFinite(t.elev_m) || !Number.isFinite(t.slope_deg) || perDay[i].some((p) => p == null)) return;
    const p72 = perDay[i].reduce((a, b) => a + b, 0);
    // low = below the mean of the viewed area, in standard deviations; flat = gentle slope
    const lowness = clamp(0.5 + (mean - t.elev_m) / (4 * sd));
    const flatness = clamp(1 - t.slope_deg / FLAT_DEG);
    features.push(
      cellFeature(c, {
        potential: round(clamp(p72 / FLOOD_RAIN_MM) * (0.5 * flatness + 0.5 * lowness), 3),
        rain_72h_forecast_mm: round(p72, 1),
        elev_rel_m: round(t.elev_m - mean, 0),
        slope_deg: round(t.slope_deg, 1),
        confidence: round(rainConfidence(perDay[i]), 3),
      }),
    );
  });
  return featureCollection({ layer: "flood_3d", bbox, issued, days, method: "rain_x_low_flat_terrain" }, features);
}
