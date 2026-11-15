// dev-only: node dev/frames.check.ts [horizons-day.json ...]
// sanity checks for frames.ts; with /api/ephemeris answers it also reports the offline formulas' error vs jpl horizons
import { readFileSync } from "node:fs";
import { gmst, icrfToEcef, isPlanet, moonIcrf, nightPolygon, phaseAngle, planetIcrf, raDecToVector, subsolarPoint, sunIcrf, transform } from "../src/scene/space/frames.ts";

const DEG = 180 / Math.PI;
let failed = 0;
function check(label: string, value: number, expected: number, tol: number): void {
  const ok = Math.abs(value - expected) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${value.toFixed(4)} (expected ${expected} ± ${tol})`);
}
function sepDeg(a: readonly number[], b: readonly number[]): number {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]));
  return Math.acos(Math.min(1, d)) * DEG;
}

// gmst at j2000.0 is 280.46061837 deg by definition; meeus example 12.a: 1987-04-10 0h ut = 13h 10m 46.3668s
check("gmst j2000 deg", gmst(new Date("2000-01-01T12:00:00Z")) * DEG, 280.46061837, 1e-6);
check("gmst meeus 12.a hours", (gmst(new Date("1987-04-10T00:00:00Z")) * DEG) / 15, 13 + 10 / 60 + 46.3668 / 3600, 1e-5);

// june solstice 2026-06-21 08:24 utc: subsolar lat = obliquity
const sol = subsolarPoint(new Date("2026-06-21T08:24:00Z"));
check("solstice subsolar lat", sol.lat, 23.436, 0.02);
// equation of time near the solstice is about -1.7 min, so local noon at greenwich is ~12:01:40
check("solstice noon subsolar lon", subsolarPoint(new Date("2026-06-21T12:01:40Z")).lon, 0, 0.1);

// polaris (j2000 37.95, +89.26) stays within a degree of the ecef pole at any time
const polaris = transform(icrfToEcef(new Date()), raDecToVector(37.95456, 89.26411));
check("polaris colatitude deg", sepDeg(polaris, [0, 0, 1]), 0.6, 0.35);

const night = nightPolygon(new Date("2026-11-16T03:00:00Z"));
check("night ring closed", night.geometry.coordinates[0].length, 364, 0);

for (const file of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(file, "utf8")) as { t0: string; step_s: number; bodies: Record<string, [number, number, number][]> };
  console.log(`\n${file} (offline formula vs horizons, worst over the day)`);
  for (const [name, rows] of Object.entries(d.bodies)) {
    let worst = 0;
    rows.forEach(([ra, dec, km], i) => {
      const at = new Date(Date.parse(d.t0) + i * d.step_s * 1000);
      const est = name === "sun" ? sunIcrf(at) : name === "moon" ? moonIcrf(at) : isPlanet(name) ? planetIcrf(name, at) : null;
      if (est) worst = Math.max(worst, sepDeg(est, raDecToVector(ra, dec, km)));
    });
    console.log(`  ${name.padEnd(8)} ${worst.toFixed(3)} deg`);
    if (worst > (name === "moon" ? 0.5 : 0.1)) failed++;
  }
  const mid = Math.floor(d.bodies.moon.length / 2);
  const [mr, md, mk] = d.bodies.moon[mid];
  const [sr, sd, sk] = d.bodies.sun[mid];
  const i = phaseAngle(raDecToVector(mr, md, mk), raDecToVector(sr, sd, sk));
  console.log(`  moon illuminated at row ${mid}: ${(((1 + Math.cos(i)) / 2) * 100).toFixed(1)}%`);
}

console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
