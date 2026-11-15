import { mat4, vec3, vec4 } from "gl-matrix";
import type maplibregl from "maplibre-gl";

// one camera for everything drawn around the globe (sky, bodies, satellites)
// mirrors maplibre's vertical perspective (globe) matrix so overlays line up
// with the rendered earth; units are earth radii, frame is ecef
// (x to lon 0, y to lon 90e, z to the north pole)

export const EARTH_RADIUS_KM = 6371.0088;

export interface SpaceView {
  // ecef earth-radii -> clip space
  viewProj: mat4;
  // ecef direction -> clip space, translation dropped (stars, sun, planets)
  dirProj: mat4;
  // camera position in ecef earth radii
  eye: [number, number, number];
  width: number;
  height: number;
  pixelRatio: number;
}

// fields of maplibre's ITransform that the globe matrix is built from
interface GlobeTransformLike {
  width: number;
  height: number;
  worldSize: number;
  fovInRadians: number;
  pitchInRadians: number;
  bearingInRadians: number;
  rollInRadians: number;
  cameraToCenterDistance: number;
  centerOffset: { x: number; y: number };
  center: { lng: number; lat: number };
}

const DEG = Math.PI / 180;

// maplibre's unit sphere is (sin lon cos lat, sin lat, cos lon cos lat): a pure
// axis permutation of ecef, applied as the first matrix so callers stay in ecef
const ECEF_TO_MAPLIBRE = mat4.fromValues(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

export function spaceView(map: maplibregl.Map): SpaceView | null {
  const t = (map as unknown as { transform: GlobeTransformLike }).transform;
  if (!t.width || !t.height) return null;
  const radiusPx = t.worldSize / (2 * Math.PI) / Math.cos(t.center.lat * DEG);
  const dist = t.cameraToCenterDistance;
  const far = dist + radiusPx * 2;

  const proj = mat4.perspective(mat4.create(), t.fovInRadians, t.width / t.height, 0.5, far);
  proj[8] = (-t.centerOffset.x * 2) / t.width;
  proj[9] = (t.centerOffset.y * 2) / t.height;

  // rotation shared by points and directions
  const rot = mat4.create();
  mat4.rotateZ(rot, rot, t.rollInRadians);
  mat4.rotateX(rot, rot, -t.pitchInRadians);
  mat4.rotateZ(rot, rot, t.bearingInRadians);
  const globe = mat4.create();
  mat4.rotateX(globe, globe, t.center.lat * DEG);
  mat4.rotateY(globe, globe, -t.center.lng * DEG);
  mat4.multiply(globe, globe, ECEF_TO_MAPLIBRE);

  const viewProj = mat4.clone(proj);
  mat4.translate(viewProj, viewProj, [0, 0, -dist]);
  mat4.multiply(viewProj, viewProj, rot);
  mat4.translate(viewProj, viewProj, [0, 0, -radiusPx]);
  mat4.multiply(viewProj, viewProj, globe);
  mat4.scale(viewProj, viewProj, [radiusPx, radiusPx, radiusPx]);

  const dirProj = mat4.clone(proj);
  mat4.multiply(dirProj, dirProj, rot);
  mat4.multiply(dirProj, dirProj, globe);

  return { viewProj, dirProj, eye: eyeOf(t, dist / radiusPx), width: t.width, height: t.height, pixelRatio: window.devicePixelRatio || 1 };
}

// same steps as maplibre's _cameraPosition, then back to ecef
function eyeOf(t: GlobeTransformLike, distRadii: number): [number, number, number] {
  const o = [0, 0, 0] as const;
  const p = vec3.fromValues(0, 0, distRadii);
  vec3.rotateZ(p, p, o, -t.rollInRadians);
  vec3.rotateX(p, p, o, t.pitchInRadians);
  vec3.rotateZ(p, p, o, -t.bearingInRadians);
  vec3.add(p, p, [0, 0, 1]);
  vec3.rotateX(p, p, o, -t.center.lat * DEG);
  vec3.rotateY(p, p, o, t.center.lng * DEG);
  return [p[2], p[0], p[1]];
}

export interface ScreenPoint {
  x: number;
  y: number;
  // hidden behind the earth or behind the camera
  hidden: boolean;
}

export function projectPoint(v: SpaceView, p: readonly [number, number, number]): ScreenPoint {
  const c = vec4.transformMat4(vec4.create(), [p[0], p[1], p[2], 1], v.viewProj);
  if (c[3] <= 0) return { x: 0, y: 0, hidden: true };
  return {
    x: ((c[0] / c[3] + 1) / 2) * v.width,
    y: ((1 - c[1] / c[3]) / 2) * v.height,
    hidden: occludedByEarth(v.eye, p),
  };
}

export function projectDirection(v: SpaceView, d: readonly [number, number, number]): ScreenPoint {
  const c = vec4.transformMat4(vec4.create(), [d[0], d[1], d[2], 0], v.dirProj);
  if (c[3] <= 0) return { x: 0, y: 0, hidden: true };
  return {
    x: ((c[0] / c[3] + 1) / 2) * v.width,
    y: ((1 - c[1] / c[3]) / 2) * v.height,
    // a direction is behind the earth when the ray from the eye hits the sphere
    hidden: rayHitsEarth(v.eye, d),
  };
}

// segment eye -> p crosses the unit sphere before reaching p
export function occludedByEarth(eye: readonly number[], p: readonly number[]): boolean {
  const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const u = [d[0] / len, d[1] / len, d[2] / len];
  const t = hitDistance(eye, u);
  return t !== null && t < len - 1e-9;
}

export function rayHitsEarth(eye: readonly number[], dir: readonly number[]): boolean {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  return hitDistance(eye, [dir[0] / len, dir[1] / len, dir[2] / len]) !== null;
}

function hitDistance(o: readonly number[], u: readonly number[]): number | null {
  const b = o[0] * u[0] + o[1] * u[1] + o[2] * u[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - 1;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

export function lonLatToEcef(lon: number, lat: number, altKm = 0): [number, number, number] {
  const r = 1 + altKm / EARTH_RADIUS_KM;
  const cl = Math.cos(lat * DEG);
  return [r * cl * Math.cos(lon * DEG), r * cl * Math.sin(lon * DEG), r * Math.sin(lat * DEG)];
}
