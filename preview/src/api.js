// authenticated json api: keeps server keys and upstream rate limits off the browser
import { edgeJson, json } from "./edge-cache.js";
import { searchChain } from "./search.js";
import { handleClouds } from "./clouds.js";
import { handleEphemeris } from "./ephemeris.js";
import { handleFirms } from "./firms.js";
import { handleNisarCoverage } from "./nisar-coverage.js";
import { handleDerived } from "./derived/index.js";
import { handleCatalog } from "./catalog.js";
import { handleVeg } from "./veg/veg.js";
import { handleGunwCoverage } from "./insar/gunw-coverage.js";
import { handleSatellites } from "./satellites.js";
import { handleTile } from "./tiles.js";
import { handleWind } from "./wind.js";

const MAX_QUERY = 200;
const BROWSER_TTL_S = 300;

/** @type {Promise<Record<string, any>> | null} */
let appConfig = null;

// app-config.json ships with the assets of this same deploy, so one read per isolate is enough
function loadAppConfig(request, env) {
  if (!appConfig) {
    appConfig = env.ASSETS.fetch(new Request(new URL("/app-config.json", request.url))).then((r) => {
      if (!r.ok) throw new Error(`app-config ${r.status}`);
      return r.json();
    });
    appConfig.catch(() => (appConfig = null));
  }
  return appConfig;
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response | null>} null when the path is not an api or tile route
 */
export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/api/search") return search(url, request, env, ctx);
  if (url.pathname === "/api/ephemeris") {
    const cfg = await loadAppConfig(request, env);
    return handleEphemeris(url, env, ctx, cfg);
  }
  if (url.pathname === "/api/satellites") {
    const cfg = await loadAppConfig(request, env);
    return handleSatellites(url, env, ctx, cfg.space?.satellites || cfg);
  }
  if (url.pathname === "/api/clouds" || url.pathname.startsWith("/api/clouds/")) {
    const cfg = await loadAppConfig(request, env);
    return handleClouds(url, env, ctx, cfg.space?.clouds || cfg);
  }
  if (url.pathname === "/api/firms") {
    const cfg = await loadAppConfig(request, env);
    return handleFirms(url, env, ctx, cfg.space?.firms || cfg.firms || {});
  }
  if (url.pathname.startsWith("/api/derived/")) return handleDerived(url, env, ctx, await loadAppConfig(request, env));
  if (url.pathname === "/api/catalog/eonet") return handleCatalog(url, env, ctx);
  if (url.pathname.startsWith("/api/veg/")) return handleVeg(url, env, ctx);
  if (url.pathname === "/api/insar/gunw") return handleGunwCoverage(url, env, ctx);
  if (url.pathname === "/api/nisar/coverage") {
    const cfg = await loadAppConfig(request, env);
    return handleNisarCoverage(url, env, ctx, cfg, request);
  }
  if (url.pathname === "/api/wind") {
    const cfg = await loadAppConfig(request, env);
    return handleWind(url, env, ctx, cfg.space?.wind || cfg.wind || {});
  }
  if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
  return handleTile(request, env, ctx, () => loadAppConfig(request, env));
}

async function search(url, request, env, ctx) {
  const q = (url.searchParams.get("q") || "").trim().replace(/\s+/g, " ");
  if (!q) return json({ results: [], source: null }, 200, BROWSER_TTL_S);
  if (q.length > MAX_QUERY) return json({ error: "query_too_long" }, 400);
  const cfg = (await loadAppConfig(request, env)).search;
  if (!cfg?.proxy?.length) return json({ error: "search_disabled" }, 503);

  // no near= still biases on the Santiago del Estero study center
  const bias = parseBias(url.searchParams.get("near")) || [-64.26, -27.8];
  const cfgOrdered = { ...cfg, proxy: searchOrder(cfg.proxy) };
  const ttl = cfg.cache_ttl_s || 0;
  // l2 caches our merged answer, l1 each upstream answer
  const keyFor = (layer) => {
    const key = new URL(`https://edge.termalwave/search/${layer}`);
    key.searchParams.set("q", q.toLowerCase());
    // rounding the bias keeps nearby callers on the same cache entry
    if (bias) key.searchParams.set("near", bias.map((v) => v.toFixed(1)).join(","));
    return key.toString();
  };
  const perProvider = (name, produce) => edgeJson(keyFor(`l1/${name}`), ttl, ctx, produce);
  try {
    const out = await edgeJson(keyFor("l2"), ttl, ctx, async () => {
      const r = await searchChain(cfgOrdered, { q, bias, env }, perProvider);
      if (!r.tried.some((t) => t.ok)) throw new Error("all providers failed");
      return { results: r.results, source: r.source };
    });
    return json(out, 200, BROWSER_TTL_S);
  } catch (err) {
    console.warn("search", err && err.message);
    return json({ error: "upstream_unavailable" }, 502);
  }
}

// keyed providers stay first; photon (no key) is the fallback before open-meteo
function searchOrder(proxy) {
  const names = Array.isArray(proxy) ? proxy.map(String) : [];
  const head = names.filter((name) => name !== "photon" && name !== "open_meteo_geocode");
  const tail = [];
  if (names.includes("photon")) tail.push("photon");
  if (names.includes("open_meteo_geocode")) tail.push("open_meteo_geocode");
  return [...head, ...tail];
}

/** @returns {[number, number] | null} lon, lat */
function parseBias(raw) {
  if (!raw) return null;
  const [lon, lat] = raw.split(",").map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return [lon, lat];
}
