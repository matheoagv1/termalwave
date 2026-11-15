import { mat3 } from "gl-matrix";
import type { Feature, Polygon } from "geojson";

// astro frames shared by the space layers
// icrf/j2000 -> mean equator of date (iau 1976 precession) -> ecef (iau 1982 gmst).
// nutation (< 20"), polar motion and ut1-utc are ignored, and tt is taken as utc
// (69 s off, ~35" for the moon). net sky frame error stays under 0.01 deg.
// vectors are geocentric, km unless noted; matrices are gl-matrix (column-major).

export type Vec3 = [number, number, number];

export const AU_KM = 149_597_870.7;
const EARTH_EQUATORIAL_KM = 6378.137;
const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;
const J2000 = 2451545.0;
const OBLIQUITY_J2000 = 23.43928 * DEG;

export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

function centuries(date: Date): number {
  return (julianDate(date) - J2000) / 36525;
}

/** greenwich mean sidereal time, radians in [0, 2pi) */
export function gmst(date: Date): number {
  const d = julianDate(date) - J2000;
  const t = d / 36525;
  const deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000;
  return (((deg % 360) + 360) % 360) * DEG;
}

function fromRows(out: mat3, r: readonly number[]): mat3 {
  return mat3.set(out, r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]);
}

/** j2000 -> mean equator and equinox of date */
export function precession(date: Date, out: mat3 = mat3.create()): mat3 {
  const t = centuries(date);
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSEC;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSEC;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSEC;
  const [cA, sA, cZ, sZ, cT, sT] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)];
  return fromRows(out, [
    cA * cZ * cT - sA * sZ, -sA * cZ * cT - cA * sZ, -sT * cZ,
    cA * sZ * cT + sA * cZ, -sA * sZ * cT + cA * cZ, -sT * sZ,
    cA * sT, -sA * sT, cT,
  ]);
}

const scratch = mat3.create();

/** icrf/j2000 direction -> ecef at `date` */
export function icrfToEcef(date: Date, out: mat3 = mat3.create()): mat3 {
  const g = gmst(date);
  const c = Math.cos(g);
  const s = Math.sin(g);
  fromRows(scratch, [c, s, 0, -s, c, 0, 0, 0, 1]);
  return mat3.multiply(out, scratch, precession(date, out));
}

export function transform(m: mat3, v: readonly number[], out: Vec3 = [0, 0, 0]): Vec3 {
  const [x, y, z] = v;
  out[0] = m[0] * x + m[3] * y + m[6] * z;
  out[1] = m[1] * x + m[4] * y + m[7] * z;
  out[2] = m[2] * x + m[5] * y + m[8] * z;
  return out;
}

function transformTransposed(m: mat3, v: readonly number[]): Vec3 {
  const [x, y, z] = v;
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
}

export function raDecToVector(raDeg: number, decDeg: number, r = 1): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const c = Math.cos(dec);
  return [r * c * Math.cos(ra), r * c * Math.sin(ra), r * Math.sin(dec)];
}

function eclipticToEquatorial(v: Vec3, eps: number): Vec3 {
  const c = Math.cos(eps);
  const s = Math.sin(eps);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function ofDateToIcrf(v: Vec3, date: Date): Vec3 {
  return transformTransposed(precession(date, scratch), v);
}

/** sun, astronomical almanac low-precision formula (0.01 deg, 1950-2050) */
export function sunIcrf(date: Date): Vec3 {
  const n = julianDate(date) - J2000;
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lambda = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const r = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU_KM;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  return ofDateToIcrf(eclipticToEquatorial([r * Math.cos(lambda), r * Math.sin(lambda), 0], eps), date);
}

/** moon, astronomical almanac low-precision formula (0.3 deg in longitude, 0.2 in latitude) */
export function moonIcrf(date: Date): Vec3 {
  const t = centuries(date);
  const s = (a: number, b: number) => Math.sin((a + b * t) * DEG);
  const c = (a: number, b: number) => Math.cos((a + b * t) * DEG);
  const lambda =
    (218.32 + 481267.881 * t + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) +
      0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03)) * DEG;
  const beta = (5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21)) * DEG;
  const parallax =
    (0.9508 + 0.0518 * c(135.0, 477198.87) + 0.0095 * c(259.3, -413335.36) + 0.0078 * c(235.7, 890534.22) + 0.0028 * c(269.9, 954397.74)) * DEG;
  const r = EARTH_EQUATORIAL_KM / Math.sin(parallax);
  const eps = (23.439 - 0.013 * t) * DEG;
  const cb = Math.cos(beta);
  return ofDateToIcrf(eclipticToEquatorial([r * cb * Math.cos(lambda), r * cb * Math.sin(lambda), r * Math.sin(beta)], eps), date);
}

// jpl "approximate positions of the planets" (standish), table 1, 1800-2050:
// a au, e, i, mean longitude, longitude of perihelion, node (deg) and rates per century
const KEPLER = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.05508612],
} as const;

export type PlanetName = keyof typeof KEPLER;

export function isPlanet(name: string): name is PlanetName {
  return Object.hasOwn(KEPLER, name);
}

function heliocentric(name: PlanetName, t: number): Vec3 {
  const k = KEPLER[name];
  const at = (i: number) => k[i] + k[i + 6] * t;
  const a = at(0);
  const e = at(1);
  const inc = at(2) * DEG;
  const peri = at(4) * DEG;
  const node = at(5) * DEG;
  const w = peri - node;
  const m = ((((at(3) * DEG - peri) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  let ea = m + e * Math.sin(m);
  for (let i = 0; i < 8; i++) ea -= (ea - e * Math.sin(ea) - m) / (1 - e * Math.cos(ea));
  const xp = a * (Math.cos(ea) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(ea);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(w), Math.sin(w), Math.cos(node), Math.sin(node), Math.cos(inc), Math.sin(inc)];
  return [
    ((cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp) * AU_KM,
    ((cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp) * AU_KM,
    (sw * si * xp + cw * si * yp) * AU_KM,
  ];
}

/** geocentric planet from keplerian elements (arcminutes; light time ignored) */
export function planetIcrf(name: PlanetName, date: Date): Vec3 {
  const h = eclipticToEquatorial(heliocentric(name, centuries(date)), OBLIQUITY_J2000);
  const sun = sunIcrf(date);
  return [h[0] + sun[0], h[1] + sun[1], h[2] + sun[2]];
}

export interface LonLat {
  lon: number;
  lat: number;
}

export function ecefToLonLat(v: readonly number[]): LonLat {
  return { lon: Math.atan2(v[1], v[0]) / DEG, lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / DEG };
}

/** point on the ground with the sun at the zenith */
export function subsolarPoint(date: Date, sun: readonly number[] = sunIcrf(date)): LonLat {
  return ecefToLonLat(transform(icrfToEcef(date), sun));
}

/** night side bounded by the geometric terminator, 1 deg steps, split at the antimeridian edges */
export function nightPolygon(date: Date, sun?: readonly number[]): Feature<Polygon> {
  const s = subsolarPoint(date, sun);
  const dec = s.lat * DEG;
  // equinox: keep tan(dec) off zero so the curve stays a function of longitude
  const tanDec = Math.abs(dec) < 1e-6 ? (dec < 0 ? -1e-6 : 1e-6) : Math.tan(dec);
  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon++) {
    const lat = Math.atan(-Math.cos((lon - s.lon) * DEG) / tanDec) / DEG;
    ring.push([lon, lat]);
  }
  const pole = dec >= 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole], ring[0]);
  if (pole < 0) ring.reverse();
  return { type: "Feature", properties: { subsolarLon: s.lon, subsolarLat: s.lat }, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** sun-target-observer angle in radians (0 = full, pi = new), geocentric observer */
export function phaseAngle(target: readonly number[], sun: readonly number[]): number {
  const ts = [sun[0] - target[0], sun[1] - target[1], sun[2] - target[2]];
  const dot = -(ts[0] * target[0] + ts[1] * target[1] + ts[2] * target[2]);
  return Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(ts[0], ts[1], ts[2]) * Math.hypot(target[0], target[1], target[2])))));
}
