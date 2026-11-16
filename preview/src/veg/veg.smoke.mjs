// live smoke test: node preview/src/veg/veg.smoke.mjs [bbox]
// caches.default is mocked as an in-memory map; every call hits the real upstreams
import { handleVeg } from "./veg.js";

const store = new Map();
globalThis.caches = {
  default: {
    match: async (req) => store.get(req.url)?.clone(),
    put: async (req, res) => void store.set(req.url, res),
  },
};
const ctx = { waitUntil: (p) => p };
const bbox = process.argv[2] || "-64.6,-28.2,-63.9,-27.4";
const layers = {
  ndvi: ["ndvi", "ndvi_anomaly"],
  productivity: ["productivity_class", "npp_kgc_m2", "cropland_share"],
  peak: ["peak_month", "confidence"],
  greenup: ["greenup_season_day", "onset_to_greenup_days"],
  "greenup-next": ["days_until", "confidence"],
  water: ["balance_mm"],
  "water-outlook": ["balance_mm", "confidence"],
};

let failed = 0;
for (const [name, props] of Object.entries(layers)) {
  const t = Date.now();
  const res = await handleVeg(new URL(`https://x/api/veg/${name}?bbox=${bbox}`), {}, ctx);
  const body = await res.json();
  const feats = body.features || [];
  const ranges = props.map((p) => {
    const v = feats.map((f) => f.properties[p]).filter((x) => typeof x === "number");
    return `${p}=[${v.length ? Math.min(...v) : "-"}, ${v.length ? Math.max(...v) : "-"}] n=${v.length}`;
  });
  if (res.status !== 200 || !feats.length) failed++;
  console.log(`${name} ${res.status} ${feats.length} cells ${Date.now() - t}ms ${ranges.join(" ")}`);
  if (name === "water" && feats[0]) console.log("  sample", JSON.stringify({ ...feats[0].properties, series: undefined, series_dates: undefined }));
}
process.exit(failed ? 1 : 0);
