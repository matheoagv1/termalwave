// /api/derived/* : processed and prediction grids for config/catalog-derived.toml
import { edgeJson, json } from "../edge-cache.js";
import { bboxKey, buildCells, parseBbox, parseDate, todayUtc } from "./common.js";
import { fireDanger3d, fireWeather } from "./fire.js";
import { flood3d, forecastRain, landslide3d, landslideSusceptibility, terrain } from "./terrain.js";

const EDGE = "https://edge.termalwave/derived";
const BROWSER_S = 300;
// 7 x 7 cells keeps each request to a handful of upstream calls whatever the bbox
const PER_SIDE = 7;
const TTL_WEATHER_S = 1800;
const TTL_PAST_S = 86400;
const TTL_TERRAIN_S = 30 * 86400;

/**
 * @param {URL} url
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @param {Record<string, any>} cfg app-config
 */
export async function handleDerived(url, env, ctx, cfg) {
  const name = url.pathname.slice("/api/derived/".length);
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) return json({ error: "need bbox=w,s,e,n" }, 400);
  const date = parseDate((url.searchParams.get("date") || "").trim());
  if (!date) return json({ error: "date must be YYYY-MM-DD" }, 400);
  const cells = buildCells(bbox, PER_SIDE);
  const live = date === todayUtc();
  const ttlDay = live ? TTL_WEATHER_S : TTL_PAST_S;
  const key = (tag) => `${EDGE}/${tag}/${bboxKey(bbox)}/${PER_SIDE}`;
  const terr = () => edgeJson(key("terrain"), TTL_TERRAIN_S, ctx, () => terrain(cells));
  // predictions are always issued now; the date only selects analyses of observed weather
  const issueDay = todayUtc();
  // landslide and flood forecasts share one rain call
  const rain = () => edgeJson(`${key("rain3d")}/${issueDay}`, TTL_WEATHER_S, ctx, () => forecastRain(cells));

  const routes = {
    "fire-weather": () => edgeJson(`${key("fwi")}/${date}`, ttlDay, ctx, () => fireWeather(cells, bbox, date)),
    "fire-danger-3d": () =>
      edgeJson(`${key("fwi3d")}/${issueDay}`, TTL_WEATHER_S, ctx, () =>
        fireDanger3d(cells, bbox, env, ctx, cfg?.space?.firms || cfg?.firms || {}),
      ),
    landslide: () =>
      edgeJson(`${key("ls")}/${date}`, ttlDay, ctx, async () => landslideSusceptibility(cells, bbox, date, await terr())),
    "landslide-3d": () =>
      edgeJson(`${key("ls3d")}/${issueDay}`, TTL_WEATHER_S, ctx, async () => landslide3d(cells, bbox, await terr(), await rain())),
    "flood-3d": () => edgeJson(`${key("fl3d")}/${issueDay}`, TTL_WEATHER_S, ctx, async () => flood3d(cells, bbox, await terr(), await rain())),
  };
  const run = routes[name];
  if (!run) return json({ error: "not_found" }, 404);
  try {
    return json(await run(), 200, BROWSER_S);
  } catch (err) {
    console.warn("derived", name, err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}
