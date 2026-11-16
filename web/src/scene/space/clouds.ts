import maplibregl from "maplibre-gl";
import type { CloudsConfig, SpaceHost, SpaceLayer } from "./types";

// near real-time clouds from the hourly global infrared mosaic, drawn over the globe
// as two raster layers: soft-keyed white clouds and, under them, their shadow cast away
// from the sun of the observation hour

export interface CloudsManifest {
  layer: string;
  latest: string;
  times: string[];
  bounds: [number, number, number, number];
}

export interface CloudsOptions {
  opacity?: number;
}

type TileKind = "cloud" | "shadow";

const PROTOCOL = "twclouds";
const LAYER = "tw-clouds";
const SHADOW = "tw-clouds-shadow";
const TILE = 256;
// nowcoast stretches each GetMap on its own bbox — 256 tiles seam. 4×4 metatiles share one stretch;
// leftover seams between metas are closed by remapping each metatile onto a fixed world reference
const META = 4;
const META_PX = TILE * META;
const WORLD_PX = 512;
const MERCATOR_HALF = 20037508.342789244;
const EARTH_CIRCUMFERENCE_KM = 40075.017;
const WINDOW_MS = 24 * 36e5;
const DEG = Math.PI / 180;
const DECODED_TILES = 64;
const DECODED_METAS = 24;
const FIT_SAMPLES = 256;

// infrared key ported from god's eye view (mit), src/layers/weather/infraredAlpha.js:
// smoothstep over the linearized brightest channel, so warm ground drops out and cold tops stay
const IR_T0 = 0.4;
const IR_T1 = 0.7;
const IR_KEY = new Float32Array(256).map((_, v) => {
  const t = Math.min(1, Math.max(0, (Math.pow(v / 255, 2.2) - IR_T0) / (IR_T1 - IR_T0)));
  return t * t * (3 - 2 * t);
});

// same shell height god's eye view draws its cloud layer at
const CLOUD_HEIGHT_KM = 5.5;
const SHADOW_MAX_PX = 8;
const SHADOW_BLUR_PX = 2;
const SHADOW_RGB = [6, 10, 20] as const;

const canonical = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Subsolar point (lon, lat in degrees), low-precision almanac formula, ~0.01 deg. */
export function subsolar(at: Date): [number, number] {
  const d = at.getTime() / 864e5 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * DEG;
  const q = 280.459 + 0.98564736 * d;
  const lambda = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 3.6e-7 * d) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) / DEG;
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15;
  const lon = ((((ra - gmst + 180) % 360) + 360) % 360) - 180;
  return [lon, dec];
}

/** Reads the time dimension and extent of one leaf layer from WMS 1.3.0 capabilities. */
export function parseCapabilities(xml: string, layer: string, nowMs: number): CloudsManifest | null {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const leaf = [...doc.getElementsByTagName("Name")].find((n) => n.textContent === layer)?.parentElement;
  const dim = leaf && [...leaf.children].find((c) => c.tagName === "Dimension" && c.getAttribute("name") === "time");
  if (!leaf || !dim) return null;
  const times = [
    ...new Set(
      (dim.textContent ?? "")
        .split(",")
        .map((v) => Date.parse(v.trim()))
        .filter((t) => Number.isFinite(t) && nowMs - t <= WINDOW_MS && t <= nowMs + 3e5)
        .map(canonical),
    ),
  ].sort();
  const edge = (tag: string) => Number(leaf.getElementsByTagName(tag)[0]?.textContent);
  const b = ["westBoundLongitude", "southBoundLatitude", "eastBoundLongitude", "northBoundLatitude"].map(edge);
  if (!times.length) return null;
  return {
    layer,
    latest: times[times.length - 1],
    times,
    bounds: b.every(Number.isFinite) ? [b[0], b[1], b[2], b[3]] : [-180, -85.0511, 180, 85.0511],
  };
}

function wmsUrl(upstream: string, params: Record<string, string>): string {
  const u = new URL(upstream);
  u.search = new URLSearchParams({ service: "WMS", version: "1.3.0", ...params }).toString();
  return u.toString();
}

function getMapUrl(cfg: CloudsConfig, time: string, z: number, x: number, y: number, spanTiles = META): string {
  const span = (2 * MERCATOR_HALF) / 2 ** z;
  const west = -MERCATOR_HALF + x * span;
  const north = MERCATOR_HALF - y * span;
  const px = TILE * spanTiles;
  return wmsUrl(cfg.upstream, {
    request: "GetMap",
    layers: cfg.layer,
    styles: "",
    crs: "EPSG:3857",
    bbox: [west, north - span * spanTiles, west + span * spanTiles, north].map((v) => v.toFixed(2)).join(","),
    width: String(px),
    height: String(px),
    format: "image/png",
    transparent: "true",
    time,
  });
}

function worldMapUrl(cfg: CloudsConfig, time: string): string {
  return wmsUrl(cfg.upstream, {
    request: "GetMap",
    layers: cfg.layer,
    styles: "",
    crs: "EPSG:3857",
    bbox: [-MERCATOR_HALF, -MERCATOR_HALF, MERCATOR_HALF, MERCATOR_HALF].map((v) => v.toFixed(2)).join(","),
    width: String(WORLD_PX),
    height: String(WORLD_PX),
    format: "image/png",
    transparent: "true",
    time,
  });
}

function maxChannel(img: ImageData): Uint8Array {
  const p = img.data;
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = Math.max(p[i], p[i + 1], p[i + 2]);
  return out;
}

/**
 * Fit world ≈ g·tile + o on mid-tone samples, then rewrite RGB so every metatile
 * shares the world stretch (closes seams between independently normalized GetMaps).
 */
function remapToWorld(img: ImageData, world: Uint8Array, z: number, mx: number, my: number): void {
  const side = img.width;
  const tiles = 2 ** z;
  const worldScale = (WORLD_PX - 1) / (tiles * TILE);
  const tile = maxChannel(img);
  let sw = 0;
  let st = 0;
  let swt = 0;
  let stt = 0;
  let n = 0;
  for (let s = 0; s < FIT_SAMPLES; s++) {
    const px = ((s * 97) % side);
    const py = ((s * 57 + 13) % side);
    const t = tile[py * side + px];
    if (t < 16 || t > 240) continue;
    const wx = Math.min(WORLD_PX - 1, Math.max(0, Math.round((mx * TILE + px + 0.5) * worldScale)));
    const wy = Math.min(WORLD_PX - 1, Math.max(0, Math.round((my * TILE + py + 0.5) * worldScale)));
    const w = world[wy * WORLD_PX + wx];
    if (w < 8) continue;
    sw += w;
    st += t;
    swt += w * t;
    stt += t * t;
    n++;
  }
  if (n < 24) return;
  const denom = n * stt - st * st;
  if (Math.abs(denom) < 1e-6) return;
  // world 512 compresses the dynamic range; clamp so we only nudge seams, not crush clouds
  const gRaw = (n * swt - st * sw) / denom;
  const oRaw = (sw - gRaw * st) / n;
  if (!(gRaw > 0.25 && gRaw < 4)) return;
  const g = Math.min(1.15, Math.max(0.85, gRaw));
  const o = Math.min(20, Math.max(-20, oRaw * (g / gRaw)));
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = Math.min(255, Math.max(0, g * p[i] + o));
    p[i + 1] = Math.min(255, Math.max(0, g * p[i + 1] + o));
    p[i + 2] = Math.min(255, Math.max(0, g * p[i + 2] + o));
  }
}

async function decode(res: Response, size: number): Promise<ImageData> {
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const ctx = new OffscreenCanvas(size, size).getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bmp, 0, 0, size, size);
  bmp.close();
  return ctx.getImageData(0, 0, size, size);
}

/** Cloud cover 0..1 per pixel; `side` is width (= height) of the source. */
function cover(src: ImageData, side: number): Float32Array {
  const p = src.data;
  const out = new Float32Array(side * side);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (p[i + 3] / 255) * IR_KEY[Math.max(p[i], p[i + 1], p[i + 2])];
  }
  return out;
}

/** Crop a TILE×TILE cover from a META×META metatile cover. */
function cropCover(meta: Float32Array, ox: number, oy: number): Float32Array {
  const out = new Float32Array(TILE * TILE);
  for (let row = 0; row < TILE; row++) {
    const src = (oy + row) * META_PX + ox;
    out.set(meta.subarray(src, src + TILE), row * TILE);
  }
  return out;
}

function cloudPixels(a: Float32Array): ImageData {
  const out = new ImageData(TILE, TILE);
  const p = out.data;
  for (let j = 0, i = 0; j < a.length; j++, i += 4) {
    const f = a[j];
    // thin edges read slightly blue-grey, thick cores white
    p[i] = 214 + 41 * f;
    p[i + 1] = 220 + 35 * f;
    p[i + 2] = 230 + 25 * f;
    p[i + 3] = 255 * f;
  }
  return out;
}

/** One separable box blur pass with clamped edges, in place via `tmp`. */
function boxBlur(a: Float32Array, tmp: Float32Array, r: number): void {
  const n = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    const [src, dst] = pass === 0 ? [a, tmp] : [tmp, a];
    for (let line = 0; line < TILE; line++) {
      for (let k = 0; k < TILE; k++) {
        let s = 0;
        for (let o = -r; o <= r; o++) {
          const m = Math.min(TILE - 1, Math.max(0, k + o));
          s += pass === 0 ? src[line * TILE + m] : src[m * TILE + line];
        }
        if (pass === 0) dst[line * TILE + k] = s / n;
        else dst[k * TILE + line] = s / n;
      }
    }
  }
}

function shadowPixels(a: Float32Array, time: string, z: number, x: number, y: number): ImageData {
  const [sunLon, sunLat] = subsolar(new Date(time));
  const sd = Math.sin(sunLat * DEG);
  const cd = Math.cos(sunLat * DEG);
  const world = TILE * 2 ** z;
  const latOf = (py: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * TILE + py)) / world)));
  const lonOf = (px: number) => ((x * TILE + px) / world) * 2 * Math.PI - Math.PI;

  // shift of the whole tile, from the sun at its centre: the shadow lands h·tan(zenith) away from the sun
  const phi = latOf(TILE / 2);
  const dl = sunLon * DEG - lonOf(TILE / 2);
  const mu = Math.sin(phi) * sd + Math.cos(phi) * cd * Math.cos(dl);
  let dx = 0;
  let dy = 0;
  if (mu > 0.05) {
    const east = cd * Math.sin(dl);
    const north = Math.cos(phi) * sd - Math.sin(phi) * cd * Math.cos(dl);
    const pxPerKm = world / (EARTH_CIRCUMFERENCE_KM * Math.cos(phi));
    dx = (-CLOUD_HEIGHT_KM * east * pxPerKm) / mu;
    dy = (CLOUD_HEIGHT_KM * north * pxPerKm) / mu;
    const len = Math.hypot(dx, dy);
    if (len > SHADOW_MAX_PX) {
      dx *= SHADOW_MAX_PX / len;
      dy *= SHADOW_MAX_PX / len;
    }
  }

  const shifted = new Float32Array(TILE * TILE);
  const fx = Math.floor(dx);
  const fy = Math.floor(dy);
  const tx = dx - fx;
  const ty = dy - fy;
  const at = (px: number, py: number) =>
    a[Math.min(TILE - 1, Math.max(0, py)) * TILE + Math.min(TILE - 1, Math.max(0, px))];
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const sx = px - fx;
      const sy = py - fy;
      const top = at(sx, sy) * (1 - tx) + at(sx - 1, sy) * tx;
      const bottom = at(sx, sy - 1) * (1 - tx) + at(sx - 1, sy - 1) * tx;
      shifted[py * TILE + px] = top * (1 - ty) + bottom * ty;
    }
  }
  const tmp = new Float32Array(TILE * TILE);
  boxBlur(shifted, tmp, SHADOW_BLUR_PX);
  boxBlur(shifted, tmp, SHADOW_BLUR_PX);

  const cosDl = new Float32Array(TILE);
  for (let px = 0; px < TILE; px++) cosDl[px] = Math.cos(sunLon * DEG - lonOf(px + 0.5));
  const out = new ImageData(TILE, TILE);
  const p = out.data;
  for (let py = 0; py < TILE; py++) {
    const lat = latOf(py + 0.5);
    const s = Math.sin(lat) * sd;
    const c = Math.cos(lat) * cd;
    for (let px = 0; px < TILE; px++) {
      const j = py * TILE + px;
      const i = j * 4;
      // no shadow on the night side, fading in across the terminator
      const lit = smoothstep(0, 0.15, s + c * cosDl[px]);
      p[i] = SHADOW_RGB[0];
      p[i + 1] = SHADOW_RGB[1];
      p[i + 2] = SHADOW_RGB[2];
      p[i + 3] = 255 * shifted[j] * lit;
    }
  }
  return out;
}

/**
 * Near real-time cloud cover over the globe. Tiles come from the clouds endpoint
 * (edge-cached WMS), or straight from the WMS when the endpoint is missing (dev).
 */
export class CloudsLayer implements SpaceLayer {
  readonly id = "clouds";
  attribution = "";
  private host: SpaceHost | null = null;
  private cfg: CloudsConfig | null = null;
  private direct = false;
  private manifest: CloudsManifest | null = null;
  private pinned: Date | null = null;
  private shown: string | null = null;
  private visible = true;
  private opacity: number;
  private painted: number | null = null;
  private syncing = false;
  private refresh: ReturnType<typeof setInterval> | null = null;
  private readonly decoded = new Map<string, Promise<Float32Array | null>>();
  private readonly decodedMeta = new Map<string, Promise<Float32Array | null>>();
  private readonly worldBright = new Map<string, Promise<Uint8Array | null>>();
  private readonly onStyle = () => this.sync();

  constructor(opts: CloudsOptions = {}) {
    this.opacity = opts.opacity ?? 0.9;
  }

  async mount(host: SpaceHost): Promise<void> {
    this.host = host;
    this.cfg = host.config.clouds;
    this.attribution = this.cfg.attribution;
    maplibregl.addProtocol(PROTOCOL, (params) => this.loadTile(params.url));
    host.map.on("styledata", this.onStyle);
    await this.loadManifest();
    this.refresh = setInterval(() => void this.loadManifest(), this.cfg.manifest_ttl_s * 1000);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    const map = this.host?.map;
    for (const id of [SHADOW, LAYER]) if (map?.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }

  frame(): void {}

  destroy(): void {
    if (this.refresh) clearInterval(this.refresh);
    const map = this.host?.map;
    if (map) {
      map.off("styledata", this.onStyle);
      for (const id of [LAYER, SHADOW]) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
    }
    maplibregl.removeProtocol(PROTOCOL);
    this.decoded.clear();
    this.decodedMeta.clear();
    this.worldBright.clear();
    this.host = null;
  }

  setOpacity(v: number): void {
    this.opacity = v;
    this.sync();
  }

  /** Hours on offer, oldest first (ISO, UTC). */
  get times(): readonly string[] {
    return this.manifest?.times ?? [];
  }

  /** Hour on screen, or null before the first manifest. */
  get time(): string | null {
    return this.shown;
  }

  /** Pin to the available hour nearest `at`, or follow the latest with null. */
  setTime(at: Date | null): string | null {
    this.pinned = at;
    this.sync();
    return this.shown;
  }

  private pick(): string | null {
    const m = this.manifest;
    if (!m) return null;
    const at = this.pinned;
    if (!at) return m.latest;
    let best = m.latest;
    for (const t of m.times) if (Math.abs(Date.parse(t) - at.getTime()) < Math.abs(Date.parse(best) - at.getTime())) best = t;
    return best;
  }

  private async loadManifest(): Promise<void> {
    const cfg = this.cfg;
    if (!cfg) return;
    let m: CloudsManifest | null = null;
    try {
      const res = await fetch(`${cfg.endpoint}/manifest`);
      if (res.ok && res.headers.get("content-type")?.includes("json")) {
        const body = (await res.json()) as CloudsManifest & { degraded?: boolean; status?: string };
        const listed = Array.isArray(body.times) ? body.times : [];
        if (!body.degraded && body.status !== "unavailable" && body.latest && listed.length) {
          m = body;
          this.direct = false;
        }
      } else {
        // no worker in vite dev; nowcoast sends access-control-allow-origin: *
        const caps = await fetch(wmsUrl(cfg.upstream, { request: "GetCapabilities" }));
        if (caps.ok) m = parseCapabilities(await caps.text(), cfg.layer, Date.now());
        this.direct = true;
      }
    } catch {
      m = null;
    }
    if (!m || !this.host) return;
    this.manifest = m;
    this.sync();
  }

  private metaUrl(time: string, z: number, mx: number, my: number): string {
    const cfg = this.cfg as CloudsConfig;
    return this.direct
      ? getMapUrl(cfg, time, z, mx, my, META)
      : `${cfg.endpoint}/${time}/${z}/${mx}/${my}.m${META}.png`;
  }

  private worldUrl(time: string): string {
    const cfg = this.cfg as CloudsConfig;
    return this.direct ? worldMapUrl(cfg, time) : `${cfg.endpoint}/${time}/world.png`;
  }

  private worldOf(time: string): Promise<Uint8Array | null> {
    let hit = this.worldBright.get(time);
    if (!hit) {
      hit = fetch(this.worldUrl(time))
        .then(async (res) => (res.ok ? maxChannel(await decode(res, WORLD_PX)) : null))
        .catch(() => null);
      this.worldBright.set(time, hit);
      while (this.worldBright.size > 3) this.worldBright.delete(this.worldBright.keys().next().value as string);
    }
    return hit;
  }

  private metaCover(time: string, z: number, mx: number, my: number): Promise<Float32Array | null> {
    const key = `${time}/${z}/${mx}/${my}`;
    let hit = this.decodedMeta.get(key);
    if (hit) {
      this.decodedMeta.delete(key);
    } else {
      hit = Promise.all([
        fetch(this.metaUrl(time, z, mx, my)).then(async (res) => (res.ok ? decode(res, META_PX) : null)),
        this.worldOf(time),
      ])
        .then(([img, world]) => {
          if (!img) return null;
          if (world) remapToWorld(img, world, z, mx, my);
          return cover(img, META_PX);
        })
        .catch(() => null);
    }
    this.decodedMeta.set(key, hit);
    while (this.decodedMeta.size > DECODED_METAS) this.decodedMeta.delete(this.decodedMeta.keys().next().value as string);
    return hit;
  }

  private coverOf(time: string, z: number, x: number, y: number): Promise<Float32Array | null> {
    const key = `${time}/${z}/${x}/${y}`;
    let hit = this.decoded.get(key);
    if (hit) {
      this.decoded.delete(key);
    } else {
      const side = 2 ** z;
      const mx = Math.floor(x / META) * META;
      const my = Math.floor(y / META) * META;
      // z0 is one tile; the last row/col of an odd side would spill past the mercator square
      if (mx + META > side || my + META > side) {
        const cfg = this.cfg as CloudsConfig;
        const url = this.direct
          ? getMapUrl(cfg, time, z, x, y, 1)
          : `${cfg.endpoint}/${time}/${z}/${x}/${y}.png`;
        hit = Promise.all([
          fetch(url).then(async (res) => (res.ok ? decode(res, TILE) : null)),
          this.worldOf(time),
        ])
          .then(([img, world]) => {
            if (!img) return null;
            if (world) remapToWorld(img, world, z, x, y);
            return cover(img, TILE);
          })
          .catch(() => null);
      } else {
        hit = this.metaCover(time, z, mx, my).then((meta) =>
          meta ? cropCover(meta, (x - mx) * TILE, (y - my) * TILE) : null,
        );
      }
    }
    this.decoded.set(key, hit);
    while (this.decoded.size > DECODED_TILES) this.decoded.delete(this.decoded.keys().next().value as string);
    return hit;
  }

  // a failed tile resolves transparent: tile errors on the map would trip the scene's degrade path
  private async loadTile(url: string): Promise<{ data: ImageBitmap }> {
    const [kind, time, zs, xs, ys] = url.slice(PROTOCOL.length + 3).split("/");
    const z = Number(zs);
    const x = Number(xs);
    const y = Number(ys);
    const a = (await this.coverOf(time, z, x, y)) ?? new Float32Array(TILE * TILE);
    const k = kind as TileKind;
    let img: ImageData;
    switch (k) {
      case "cloud":
        img = cloudPixels(a);
        break;
      case "shadow":
        img = shadowPixels(a, time, z, x, y);
        break;
      default: {
        const never: never = k;
        throw new Error(`unknown cloud tile ${String(never)}`);
      }
    }
    return { data: await createImageBitmap(img) };
  }

  // runs on every styledata too, so each step only touches the style when something differs
  private sync(): void {
    const map = this.host?.map;
    const cfg = this.cfg;
    const m = this.manifest;
    const time = this.pick();
    // isStyleLoaded() also waits for tiles, so it can stay false long after style.load fired
    const ready = (map?.style as unknown as { _loaded?: boolean } | undefined)?._loaded;
    if (!map || !cfg || !m || !time || !ready || this.syncing) return;
    this.syncing = true;
    try {
      const tiles = (kind: TileKind) => [`${PROTOCOL}://${kind}/${time}/{z}/{x}/{y}`];
      for (const [id, kind] of [
        [SHADOW, "shadow"],
        [LAYER, "cloud"],
      ] as const) {
        const src = map.getSource(id) as maplibregl.RasterTileSource | undefined;
        if (!src) {
          map.addSource(id, {
            type: "raster",
            tiles: tiles(kind),
            tileSize: TILE,
            maxzoom: cfg.max_zoom,
            bounds: m.bounds,
            attribution: kind === "cloud" ? cfg.attribution : undefined,
          });
        } else if (time !== this.shown) {
          src.setTiles(tiles(kind));
        }
        if (!map.getLayer(id)) {
          map.addLayer({ id, type: "raster", source: id, layout: { visibility: this.visible ? "visible" : "none" } });
          this.painted = null;
        }
      }
      this.shown = time;
      // fade clouds at study zoom so terrain/layers stay readable
      const cloudOp: unknown = [
        "interpolate",
        ["linear"],
        ["zoom"],
        2,
        this.opacity,
        6,
        this.opacity * 0.55,
        9,
        this.opacity * 0.12,
        11,
        0,
      ];
      const shadowOp: unknown = [
        "interpolate",
        ["linear"],
        ["zoom"],
        1,
        0.22 * this.opacity,
        5,
        0.45 * this.opacity,
        8,
        0.08 * this.opacity,
        10,
        0,
      ];
      if (this.painted !== this.opacity) {
        this.painted = this.opacity;
        map.setPaintProperty(LAYER, "raster-opacity", cloudOp);
        map.setPaintProperty(SHADOW, "raster-opacity", shadowOp);
      }
      // stay over the basemap and sar overlays, even those added after us
      const order = map.getLayersOrder();
      if (order[order.length - 1] !== LAYER || order[order.length - 2] !== SHADOW) {
        map.moveLayer(SHADOW);
        map.moveLayer(LAYER);
      }
    } finally {
      this.syncing = false;
    }
  }
}
