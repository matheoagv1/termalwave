// smoke for nisar-coverage helpers (no wrangler, no network)
import {
  parseBbox,
  parseNisarId,
  granuleFromEntry,
  footprintFromEntry,
  maturityFor,
} from "./nisar-coverage.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sgo = parseBbox("-65.5,-29,-62,-26");
assert(sgo && sgo.length === 4, "parse regional bbox");
assert(parseBbox("bad") === null, "reject bad bbox");
assert(parseBbox("10,10,-5,20") === null, "reject inverted lon");

assert(maturityFor("NISAR_L2_GCOV_V1") === "validated", "validated collection");
assert(maturityFor("NISAR_L2_GCOV_PROVISIONAL_V1") === "provisional", "provisional collection");
assert(maturityFor("NISAR_L2_GCOV_BETA_V1") === "beta", "beta collection");

const id = "NISAR_L2_PR_GCOV_034_140_D_101_2005_DHDH_A_20261102T222238_20261102T222313_P05036_N_F_J_001";
const parsed = parseNisarId(id);
assert(parsed.cycle === "34", "cycle");
assert(parsed.track === "140", "track");
assert(parsed.direction === "descending", "direction");
assert(parsed.frame === "101", "frame");
assert(parsed.pol === "HH+HV", "pol");
assert(parsed.start === "2026-11-02T22:22:38Z", "start from name");

const granule = granuleFromEntry(
  {
    title: id,
    time_start: "2026-11-02T22:22:38.000Z",
    time_end: "2026-11-02T22:23:13.999Z",
    polygons: [["-27.9 -64.35 -27.7 -64.35 -27.7 -64.15 -27.9 -64.15 -27.9 -64.35"]],
    links: [
      {
        rel: "http://esipfed.org/ns/fedsearch/1.1/data#",
        href: `https://example.test/${id}.h5`,
      },
    ],
  },
  "NISAR_L2_GCOV_V1",
);
assert(granule && granule.mode !== "demo", "granule is not a demo frame");
assert(granule.maturity === "validated", "granule maturity");
assert(granule.date === "2026-11-02T22:22:38.000Z", "date alias for the area card");
assert(granule.h5_url.endsWith(".h5"), "h5 url");
assert(granule.footprint.type === "Polygon", "footprint type");
assert(granule.footprint.coordinates[0][0][0] === -64.35, "footprint lon");
assert(granule.footprint.coordinates[0][0][1] === -27.9, "footprint lat");

const emptyFoot = footprintFromEntry({});
assert(emptyFoot === null, "missing polygon is null");

const gunw = parseNisarId(
  "NISAR_L2_PR_GUNW_032_140_D_101_033_2000_SH_20261009T222238_20261009T222313_20261021T222238_20261021T222313_P05036_N_F_J_001",
);
assert(gunw.track === "140" && gunw.frame === "101" && gunw.direction === "descending", "gunw name");
assert(gunw.pol === "HH", "gunw pol");

console.log("nisar-coverage smoke ok");
