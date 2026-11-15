// place search providers behind one shape
// Place = { kind: "place", label, lonlat: [lon, lat], bbox?: [w, s, e, n], source }
// order, urls and limits come from app-config.json (config/apis.toml [geocode.web])

const BIAS_RADIUS_M = 50_000;
const PHOTON_BIAS_ZOOM = 8;

/**
 * @typedef {{ q: string, bias: [number, number] | null, limit: number, url: string, env: Record<string, string>, ua: string }} Query
 * @typedef {{ kind: "place", label: string, lonlat: [number, number], bbox?: [number, number, number, number], source: string }} Place
 * @typedef {(query: Query) => Promise<Place[] | null>} Provider null means skipped, not answered
 */

/** @type {Record<string, Provider>} */
export const PROVIDERS = {
  async google_places({ q, bias, limit, url, env }) {
    const key = env.GOOGLE_MAPS_SERVER_API_KEY;
    if (!key) return null;
    const body = { textQuery: q, pageSize: limit, languageCode: "es" };
    if (bias) body.locationBias = { circle: { center: { latitude: bias[1], longitude: bias[0] }, radius: BIAS_RADIUS_M } };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        "x-goog-fieldmask": "places.displayName,places.formattedAddress,places.location,places.viewport",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`google_places ${res.status}`);
    const data = await res.json();
    return (data.places || []).map((p) => ({
      kind: "place",
      label: [p.displayName?.text, p.formattedAddress].filter(Boolean).join(" · "),
      lonlat: [p.location.longitude, p.location.latitude],
      bbox: p.viewport
        ? [p.viewport.low.longitude, p.viewport.low.latitude, p.viewport.high.longitude, p.viewport.high.latitude]
        : undefined,
      source: "google_places",
    }));
  },

  async photon({ q, bias, limit, url, ua }) {
    const u = new URL(url);
    u.searchParams.set("q", q);
    u.searchParams.set("limit", String(limit));
    if (bias) {
      u.searchParams.set("lon", String(bias[0]));
      u.searchParams.set("lat", String(bias[1]));
      // without a zoom photon barely weighs the bias (frias -> colombia)
      u.searchParams.set("zoom", String(PHOTON_BIAS_ZOOM));
    }
    const res = await fetch(u, { headers: { "user-agent": ua } });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    const data = await res.json();
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      // photon extent is [minLon, maxLat, maxLon, minLat]
      const e = p.extent;
      return {
        kind: "place",
        label: [p.name, p.city, p.state, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", "),
        lonlat: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        bbox: Array.isArray(e) && e.length === 4 ? [e[0], e[3], e[2], e[1]] : undefined,
        source: "photon",
      };
    });
  },

  async open_meteo_geocode({ q, limit, url, ua }) {
    const u = new URL(url);
    u.searchParams.set("name", q);
    u.searchParams.set("count", String(limit));
    u.searchParams.set("language", "es");
    const res = await fetch(u, { headers: { "user-agent": ua } });
    if (!res.ok) throw new Error(`open_meteo_geocode ${res.status}`);
    const data = await res.json();
    return (data.results || []).map((r) => ({
      kind: "place",
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lonlat: [r.longitude, r.latitude],
      source: "open_meteo_geocode",
    }));
  },
};

/**
 * first provider with results wins; failures fall through to the next one
 * @param {{ proxy: string[], endpoints: Record<string, string>, limit: number, user_agent: string }} cfg
 * @param {Omit<Query, "url" | "ua" | "limit">} query
 * @param {(provider: string, produce: () => Promise<Place[] | null>) => Promise<Place[] | null>} perProvider
 *   per-provider cache so a later miss in the chain never re-asks an upstream that already answered
 */
export async function searchChain(cfg, query, perProvider = (_name, produce) => produce()) {
  const tried = [];
  for (const name of cfg.proxy) {
    const run = PROVIDERS[name];
    const url = cfg.endpoints[name];
    if (!run || !url) continue;
    try {
      const out = await perProvider(name, () => run({ ...query, url, limit: cfg.limit, ua: cfg.user_agent }));
      if (out === null) continue;
      tried.push({ provider: name, ok: true, count: out.length });
      if (out.length) return { results: out, source: name, tried };
    } catch (err) {
      tried.push({ provider: name, ok: false });
      console.warn("search", name, err && err.message);
    }
  }
  return { results: [], source: null, tried };
}
