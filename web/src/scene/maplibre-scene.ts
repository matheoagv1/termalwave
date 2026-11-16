import maplibregl, {
  type GeoJSONSource,
  type ImageSource,
  type MapSourceDataEvent,
  type Marker,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  BasemapTiles,
  CameraMode,
  Dataset,
  FrameRef,
  Hotspot,
  Padding,
  SceneApi,
  SceneOptions,
  SceneState,
  TimeTick,
} from "../tw/contract";
import { attachCatalog } from "./catalog";
import { Layers3D } from "./layers3d";
import { BodiesLayer } from "./space/bodies";
import { CloudsLayer } from "./space/clouds";
import { SpaceScene, type SpaceConfig } from "./space";
import { SatellitesLayer } from "./space/satellites";
import { SkyLayer } from "./space/sky";
import { WindLayer } from "./space/wind";
import type { Bounds } from "./space/satellites-geometry";
import type { NisarPass } from "../data/nisar-passes";
import { installTileCache, tileCacheTransformRequest } from "./tile-cache";

export type { BasemapTiles } from "../tw/contract";
export type BasemapLayers = BasemapTiles & { underlay?: BasemapTiles };

export interface MapSceneOptions extends SceneOptions {
  basemapTiles?: BasemapLayers;
  // centro del area de estudio (app-config aoi); sin eso arranca en 0,0
  home?: [number, number];
  aoi?: Bounds;
  // cielo, satelites y nubes alrededor del globo (app-config space)
  space?: SpaceConfig;
  // plantilla de teselas de relieve (codificacion terrarium). Opcional.
  demTiles?: string;
}

type Coords = [[number, number], [number, number], [number, number], [number, number]];
type Slot = { src: string; layer: string };

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const ZERO: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
const URBAN_ZOOM = 1.85;
const URBAN_DETAIL = 1.35;
const URBAN_PITCH = 6;
// busqueda de lugar desde orbita; duracion y zoom cortos
const PLACE_FLY_MS = 3000;
const PLACE_FLY_MS_MIN = 2200;
const PLACE_FLY_MS_MAX = 4000;
const PLACE_FLY_KM = 0.2;
const PLACE_ZOOM = 10;
const PLACE_FLY_CURVE = 1.12;
const CITY_HALF_DEG = 0.75;
// wide view keeps the configured area in front; the fallback is only used when app-config has no aoi
const GLOBE_ZOOM = 1.6;
const MIN_GLOBE_SHARE = 0.3;
const ORBIT_ALTITUDE_ZOOM = 1.1;
const ASCEND_MS = 2800;
const SETTLE_MS = 1800;
const GLOBE_FALLBACK: [number, number] = [-63.5, -27.5];
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// AOI image layers stay off until the footprint covers ~this fraction of the shorter viewport edge.
const AOI_VIEWPORT_FRAC = 0.12;

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]);
  const dLon = toR(b[0] - a[0]);
  const lat1 = toR(a[1]);
  const lat2 = toR(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function placeFlyMs(from: [number, number], to: [number, number]): number {
  const km = haversineKm(from, to);
  return Math.round(clamp(PLACE_FLY_MS_MIN + km * PLACE_FLY_KM, PLACE_FLY_MS_MIN, PLACE_FLY_MS_MAX));
}

function cityBounds(lon: number, lat: number, half = CITY_HALF_DEG): Bounds {
  return {
    west: lon - half,
    east: lon + half,
    south: Math.max(-85, lat - half),
    north: Math.min(85, lat + half),
  };
}

function boundsNear(a: Bounds, b: Bounds, eps = 0.08): boolean {
  return (
    Math.abs(a.west - b.west) < eps &&
    Math.abs(a.east - b.east) < eps &&
    Math.abs(a.south - b.south) < eps &&
    Math.abs(a.north - b.north) < eps
  );
}

export { cityBounds, placeFlyMs };

// extra map layers some entity ids add next to their main one
const ENTITY_EXTRA = ["-glow", "-line"] as const;
// share of the shorter image side that fades out at each border
const SOFT_EDGE_FRAC = 0.045;
// newest NISAR quick-look previews drawn at once
const BROWSE_MAX = 6;
const BROWSE_OPACITY = 0.85;

function coordsOf(b: { west: number; east: number; south: number; north: number }): Coords {
  return [
    [b.west, b.north],
    [b.east, b.north],
    [b.east, b.south],
    [b.west, b.south],
  ];
}

const BASE_IDS = ["tw-under", "tw-base"] as const;

function baseLayers(bt: BasemapLayers): Array<[(typeof BASE_IDS)[number], BasemapTiles]> {
  return bt.underlay ? [["tw-under", bt.underlay], ["tw-base", bt]] : [["tw-base", bt]];
}

function rasterSource(bt: BasemapTiles): maplibregl.RasterSourceSpecification {
  return { type: "raster", tiles: [bt.url], tileSize: bt.tileSize, maxzoom: bt.maxzoom, attribution: bt.attribution };
}

function absolute(url: string): string {
  return url.startsWith("data:") ? url : new URL(url, window.location.href).href;
}

export class MapLibreScene implements SceneApi {
  private o: MapSceneOptions;
  private s: SceneState = { camera: "orbit", layer: "", tickId: "", tilt: 35, northUp: true, viewScale: "campo" };
  private cbC = new Set<(s: SceneState) => void>();
  private cbP = new Set<(id: string | null) => void>();
  private ds: Dataset | null = null;
  private ticks: Record<string, TimeTick> = {};
  private pad: Padding = { top: 60, right: 20, bottom: 20, left: 460 };
  private host!: HTMLElement;
  private mapEl!: HTMLDivElement;
  private map!: maplibregl.Map;
  private space: SpaceScene | null = null;
  // 3d marks (fire columns, swath curtains); holds its data until the space scene mounts it
  private fx = new Layers3D();
  private soft = new Map<string, Promise<string>>();
  private extraSeq = new Map<string, number>();
  private browse: NisarPass[] = [];
  private browseKey = "";
  private browseSeq = 0;
  private dead = false;
  private ready = false;
  private queue: Array<() => void> = [];
  private markers: Marker[] = [];
  private ring: Marker | null = null;
  private handle!: HTMLDivElement;
  private flyId = 0;
  private slots: Slot[] = [
    { src: "tw-img-a", layer: "tw-img-a" },
    { src: "tw-img-b", layer: "tw-img-b" },
  ];
  private front = 0;
  private hasFront = false;
  private token = 0;
  private pending: ((e: MapSourceDataEvent) => void) | null = null;
  private images = new Map<string, HTMLImageElement>();
  private cmpRaf = 0;
  private territoryZoom = 11;
  private aoiMinZoom = 8;
  private intendedOpacity = new Map<string, number>();
  private gapFill = 0;
  private dragCurtain = false;
  // zona activa desde busqueda; sin eso no hay outline ni PNG del AOI
  private placeOn = false;
  private placeBounds: Bounds | null = null;
  // wide view is the framed continent; a place search turns it off until Back to Earth
  private wide = true;
  private flyingHome = false;

  constructor(o: Partial<MapSceneOptions> = {}) {
    this.o = {
      online: true,
      terrain: false,
      basemap: true,
      reducedMotion: false,
      labels: { curtain: "Cortina" },
      ...o,
    };
  }

  // ciclo de vida

  mount(el: HTMLElement): void {
    this.host = el;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    this.mapEl = document.createElement("div");
    this.mapEl.style.cssText = "position:absolute;inset:0;background:#000";
    el.appendChild(this.mapEl);

    installTileCache();
    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: this.baseStyle(),
      center: this.globeCenter(),
      zoom: GLOBE_ZOOM,
      minZoom: 0.6,
      maxZoom: 17,
      maxPitch: 70,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      transformRequest: tileCacheTransformRequest,
    });
    this.map.touchZoomRotate.disableRotation();
    // a long soft coast after a drag, like a spun globe, instead of a short stop
    this.map.dragPan.enable({ linearity: 0.25, easing: (t: number) => 1 - Math.pow(1 - t, 3), deceleration: 1600, maxSpeed: 1400 });
    this.limitZoomOut();
    this.map.on("resize", () => this.limitZoomOut());
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    if (this.o.space) this.space = new SpaceScene(this.map, this.o.space);

    this.handle = document.createElement("div");
    this.handle.style.cssText =
      "position:absolute;left:0;top:0;width:24px;height:44px;margin:-22px 0 0 -12px;display:none;cursor:ew-resize;touch-action:none;z-index:2";
    this.handle.tabIndex = 0;
    this.handle.setAttribute("role", "slider");
    this.handle.setAttribute("aria-label", this.o.labels.curtain);
    this.handle.setAttribute("aria-valuemin", "0");
    this.handle.setAttribute("aria-valuemax", "100");
    this.handle.setAttribute("data-scene-handle", "1");
    this.handle.innerHTML =
      '<div style="position:absolute;left:4px;top:14px;width:16px;height:16px;border:2px solid var(--acc);background:var(--bg)"></div>';
    el.appendChild(this.handle);
    this.bindHandle();

    this.map.on("style.load", () => this.onStyle());
    this.map.on("move", () => {
      this.placeHandle();
      this.syncAoiOverlays();
      this.cbMove();
    });
    this.map.on("error", (e) => {
      const msg = String((e.error as Error | undefined)?.message ?? "").toLowerCase();
      if (msg.includes("tile") || msg.includes("dem")) this.degrade();
    });
    this.map.on("click", (ev) => {
      if (this.s.camera !== "detail") return;
      const t = ev.originalEvent?.target;
      if (t instanceof HTMLElement && t.closest("[data-spot]")) return;
      this.cbP.forEach((cb) => cb(null));
    });
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.cmpRaf);
    this.markers.forEach((m) => m.remove());
    this.ring?.remove();
    this.space?.destroy();
    this.map?.remove();
    this.mapEl?.remove();
    this.handle?.remove();
    this.cbC.clear();
    this.cbP.clear();
  }

  // estilo

  private css(name: string, fallback: string): string {
    const v = getComputedStyle(this.host).getPropertyValue(name).trim();
    return v || fallback;
  }

  private baseStyle(): StyleSpecification {
    const sources: StyleSpecification["sources"] = {};
    const layers: StyleSpecification["layers"] = [
      { id: "tw-bg", type: "background", paint: { "background-color": this.o.space ? "#000000" : this.css("--scene-ground", "#0b1220"), "background-opacity": this.o.space ? 0 : 1 } },
    ];
    const bt = this.o.basemapTiles;
    if (this.o.basemap && this.o.online && bt) {
      for (const [id, tiles] of baseLayers(bt)) {
        sources[id] = rasterSource(tiles);
        layers.push({ id, type: "raster", source: id });
      }
    }
    return {
      version: 8,
      projection: { type: "globe" },
      sources,
      layers,
      sky: this.skySpec(),
    } as StyleSpecification;
  }

  // space: a thin dim limb, desaturated so data colours win (the reference runs its
  // atmosphere at about a third of the engine default light, saturation -12 %,
  // brightness -8 %); fades out as you enter study zoom
  private skySpec(): Record<string, unknown> {
    return this.o.space
      ? {
          "sky-color": "#010409",
          "horizon-color": "#1b355c",
          "fog-color": "#6fb2dc",
          "fog-ground-blend": 0.7,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 4, 0.4, 7, 0.06, 9, 0],
        }
      : {
          "sky-color": this.css("--scene-sphere", "#082460"),
          "horizon-color": this.css("--scene-grid", "#2474ec"),
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
        };
  }

  setBasemap(bt: BasemapLayers): void {
    this.o.basemapTiles = bt;
    const map = this.map;
    if (!map || !this.ready || !this.o.basemap || !this.o.online) return;
    try {
      const ids = map.getStyle().layers.map((l) => l.id);
      const before = ids[ids.indexOf("tw-bg") + 1 + BASE_IDS.filter((id) => map.getLayer(id)).length];
      for (const id of BASE_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
      for (const [id, tiles] of baseLayers(bt)) {
        map.addSource(id, rasterSource(tiles));
        map.addLayer({ id, type: "raster", source: id }, before);
      }
    } catch {
      /* si falla se conserva el estilo actual */
    }
  }

  private onStyle(): void {
    const map = this.map;
    if (!map.getSource("tw-curtain")) {
      map.addSource("tw-curtain", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    if (this.o.terrain && this.o.online && this.o.demTiles && !map.getSource("tw-dem")) {
      map.addSource("tw-dem", {
        type: "raster-dem",
        tiles: [this.o.demTiles],
        tileSize: 256,
        maxzoom: 13,
        encoding: "terrarium",
      });
      map.setTerrain({ source: "tw-dem", exaggeration: 1.4 });
    }
    // las capas del dataset se arman cuando hay limites
    this.ready = true;
    if (this.s.camera === "orbit") this.go("orbit", { fly: false, ms: 0 });
    this.buildLayers();
    attachCatalog(map);
    this.refreshStyle();
    void this.mountSpace();
    const q = this.queue;
    this.queue = [];
    q.forEach((f) => {
      try {
        f();
      } catch (e) {
        console.warn("escena: tarea pendiente falló", e);
      }
    });
  }

  private buildLayers(): void {
    const map = this.map;
    if (!this.ds || !this.ready || map.getSource("tw-area")) return;
    const b = this.ds.area.bounds;
    const ring = [
      [b.west, b.north],
      [b.east, b.north],
      [b.east, b.south],
      [b.west, b.south],
      [b.west, b.north],
    ];
    map.addSource("tw-area", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
    });
    const blank = coordsOf(b);
    for (const sl of this.slots) {
      map.addSource(sl.src, { type: "image", url: BLANK, coordinates: blank });
      map.addLayer({ id: sl.layer, type: "raster", source: sl.src, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } });
      map.setPaintProperty(sl.layer, "raster-opacity-transition", { duration: this.fade(), delay: 0 });
    }
    map.addSource("tw-cmp", { type: "image", url: BLANK, coordinates: blank });
    map.addLayer({ id: "tw-cmp", type: "raster", source: "tw-cmp", paint: { "raster-opacity": 0, "raster-fade-duration": 0 } });
    map.addLayer({ id: "tw-gap", type: "fill", source: "tw-area", paint: { "fill-color": this.css("--scene-hatch", "#ffb43a"), "fill-opacity": 0 } });
    map.addLayer({
      id: "tw-area",
      type: "line",
      source: "tw-area",
      paint: { "line-color": this.css("--scene-outline", "#f4f1e8"), "line-width": 1.2, "line-opacity": 0 },
    });
    map.addLayer({ id: "tw-curtain", type: "line", source: "tw-curtain", paint: { "line-color": this.css("--acc", "#f0a014"), "line-width": 2 } });
    this.raiseEntities();
    this.refreshAoiMinZoom();
    this.applyFrame();
    this.applyCompare();
    this.updateAreaChrome();
  }

  refreshStyle(): void {
    if (!this.ready) return;
    const map = this.map;
    const set = (id: string, prop: string, value: string): void => {
      if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
    };
    set("tw-bg", "background-color", this.css("--scene-ground", "#0b1220"));
    set("tw-gap", "fill-color", this.css("--scene-hatch", "#ffb43a"));
    set("tw-area", "line-color", this.css("--scene-outline", "#f4f1e8"));
    set("tw-curtain", "line-color", this.css("--acc", "#f0a014"));
    if (map.getLayer("tw-ent-firms")) map.setPaintProperty("tw-ent-firms", "circle-color", this.fireColor());
    for (const id of ["tw-ent-nisar-glow", "tw-ent-nisar-line"]) set(id, "line-color", this.css("--accB", "#5eebff"));
    set("tw-ent-nisar", "fill-color", this.css("--accB", "#5eebff"));
    this.fx.refreshColors();
    map.setSky(this.skySpec() as never);
  }

  // hotspot ground dot in the same frp ramp as the glow sprites; theme heat colour when frp is missing
  private fireColor(): unknown[] {
    return [
      "step",
      ["to-number", ["coalesce", ["get", "frp"], ["get", "frp_mw"], -1], -1],
      this.css("--warn", "#ff7a1a"),
      0, "#9e2a1b",
      5, "#d2401f",
      20, "#f06a28",
      50, "#fb9a2e",
      100, "#fdc84a",
      300, "#fff3b0",
    ];
  }

  private spaceMounted = false;

  private async mountSpace(): Promise<void> {
    if (!this.space || this.spaceMounted) return;
    this.spaceMounted = true;
    const aoi = this.o.aoi ?? null;
    try {
      await this.space.add(new SkyLayer({ labels: false }), true);
      await this.space.add(new BodiesLayer(), true);
      this.fx.setReducedMotion(this.o.reducedMotion);
      await this.space.add(this.fx, true);
      await this.space.add(
        new SatellitesLayer(aoi, { labels: true, swath: true, footprint: false, tracks: true }),
        true,
      );
      await this.space.add(new CloudsLayer({ opacity: 0.85 }), true);
      // wind off by default; App toggles via setSpaceLayer("wind", ...)
      await this.space.add(new WindLayer(), false);
    } catch (e) {
      console.warn("escena espacial:", e);
    }
  }

  setSpaceLayer(id: string, on: boolean): void {
    this.space?.setVisible(id, on);
  }

  // geojson global (firms, etc); null limpia la capa
  setEntities(id: string, data: unknown | null): void {
    this.whenReady(() => this.applyEntities(id, data));
  }

  // quick-look previews of the newest passes in view; they follow the radar toggle
  showNisarBrowse(passes: NisarPass[]): void {
    this.browse = passes
      .filter((p) => p.browseUrl && p.bounds)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, BROWSE_MAX);
    this.whenReady(() => this.syncBrowse());
  }

  setActivePlace(bounds: Bounds | null): void {
    this.placeOn = !!bounds;
    this.placeBounds = bounds;
    this.whenReady(() => {
      this.syncPlaceChrome();
      this.refreshAoiMinZoom();
      this.updateAreaChrome();
    });
  }

  private syncPlaceChrome(): void {
    if (!this.ready || !this.map.getSource("tw-area")) return;
    const b = this.placeBounds ?? this.ds?.area.bounds;
    if (!b) return;
    const ring = [
      [b.west, b.north],
      [b.east, b.north],
      [b.east, b.south],
      [b.west, b.south],
      [b.west, b.north],
    ];
    (this.map.getSource("tw-area") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    if (this.ring) {
      this.ring.setLngLat([(b.west + b.east) / 2, (b.south + b.north) / 2]);
    }
  }

  private radarOn(): boolean {
    return this.s.layer === "radar" || this.extras.includes("radar");
  }

  private applyEntities(id: string, data: unknown | null): void {
    if (!this.ready) return;
    const map = this.map;
    const srcId = `tw-ent-${id}`;
    const layerId = `tw-ent-${id}`;
    const raw = data as { type?: string; features?: unknown[] } | null;
    const ok = !!raw && raw.type === "FeatureCollection" && Array.isArray(raw.features);
    if (data && !ok) return;
    if (id === "firms") this.fx.setFires(data);
    if (id === "nisar") this.fx.setSwaths(data);
    if (!data) {
      for (const lid of [layerId, ...ENTITY_EXTRA.map((x) => layerId + x)]) if (map.getLayer(lid)) map.removeLayer(lid);
      if (map.getSource(srcId)) map.removeSource(srcId);
      if (id === "nisar") {
        this.browse = [];
        this.syncBrowse();
      }
      return;
    }
    const fc = data as GeoJSON.GeoJSON;
    const src = map.getSource(srcId) as GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      return;
    }
    map.addSource(srcId, { type: "geojson", data: fc });
    if (id === "nisar") {
      // swath on the ground: faint fill, soft halo, thin bright edge. the curtain above it is drawn by fx
      const cyan = this.css("--accB", "#5eebff");
      map.addLayer({ id: layerId, type: "fill", source: srcId, paint: { "fill-color": cyan, "fill-opacity": 0.07 } });
      map.addLayer({
        id: `${layerId}-glow`,
        type: "line",
        source: srcId,
        paint: { "line-color": cyan, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 3, 6, 6, 10, 9], "line-blur": 5, "line-opacity": 0.4 },
      });
      map.addLayer({
        id: `${layerId}-line`,
        type: "line",
        source: srcId,
        paint: { "line-color": cyan, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 6, 1.2, 10, 1.6], "line-opacity": 0.95 },
      });
      this.syncSwaths();
      return;
    }
    const fire = id === "firms";
    map.addLayer({
      id: layerId,
      type: "circle",
      source: srcId,
      paint: fire
        ? {
            // ember under the 3d column; blurred so it reads as light, and it carries the layer alone at street zoom
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.4, 3, 2.6, 6, 5, 10, 9],
            "circle-color": this.fireColor() as unknown as string,
            "circle-blur": 0.7,
            "circle-opacity": 0.9,
          }
        : {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 3, 2.5, 6, 4.5, 10, 7],
            "circle-color": this.css("--acc", "#ff6b35"),
            "circle-opacity": 0.85,
            "circle-stroke-width": 0.6,
            "circle-stroke-color": this.css("--scene-outline", "#f4f1e8"),
          },
    });
  }

  // swaths belong to the radar layer: they follow its toggle
  private syncSwaths(): void {
    const on = this.radarOn();
    this.fx.setSwathsVisible(on);
    this.syncBrowse();
    if (!this.ready) return;
    for (const lid of ["tw-ent-nisar", "tw-ent-nisar-glow", "tw-ent-nisar-line"]) {
      if (this.map.getLayer(lid)) this.map.setLayoutProperty(lid, "visibility", on ? "visible" : "none");
    }
  }

  // previews sit under the swath outlines and exist only while the radar layer is on
  private syncBrowse(): void {
    if (!this.ready) return;
    const want = this.radarOn() ? this.browse : [];
    const key = want.map((p) => p.browseUrl).join("|");
    if (key === this.browseKey) return;
    this.browseKey = key;
    const map = this.map;
    const seq = ++this.browseSeq;
    for (let i = 0; i < BROWSE_MAX; i++) {
      if (map.getLayer(`tw-nisar-browse-${i}`)) map.removeLayer(`tw-nisar-browse-${i}`);
      if (map.getSource(`tw-nisar-browse-${i}`)) map.removeSource(`tw-nisar-browse-${i}`);
    }
    if (!want.length) return;
    // a preview that fails to load is skipped; nothing is added for it
    void Promise.all(want.map((p) => this.loadImage(p.browseUrl as string).then(() => true, () => false))).then((ok) => {
      if (seq !== this.browseSeq || this.dead || !this.ready) return;
      const before = map.getLayer("tw-ent-nisar") ? "tw-ent-nisar" : undefined;
      want.forEach((p, i) => {
        if (!ok[i] || !p.bounds) return;
        const id = `tw-nisar-browse-${i}`;
        map.addSource(id, { type: "image", url: p.browseUrl as string, coordinates: coordsOf(p.bounds) });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": BROWSE_OPACITY } }, before);
      });
    });
  }

  // entity marks stay above the dataset rasters, which are added later than them
  private raiseEntities(): void {
    const map = this.map;
    for (const l of map.getStyle().layers ?? []) {
      if (l.id === "tw-ent-nisar" || l.id === "tw-ent-nisar-glow" || l.id === "tw-ent-nisar-line") map.moveLayer(l.id);
    }
    for (const l of map.getStyle().layers ?? []) {
      if (l.id.startsWith("tw-ent-") && !l.id.startsWith("tw-ent-nisar")) map.moveLayer(l.id);
    }
  }

  // image with its border faded to transparent, so a draped raster reads as
  // data inside a swath and not as a pasted rectangle. falls back to the url
  private softEdge(url: string): Promise<string> {
    if (url.startsWith("data:")) return Promise.resolve(url);
    const hit = this.soft.get(url);
    if (hit) return hit;
    const p = this.loadImage(url)
      .then((img) => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w < 8 || h < 8 || w * h > 4096 * 4096) return url;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) return url;
        ctx.drawImage(img, 0, 0);
        const e = Math.max(2, Math.round(Math.min(w, h) * SOFT_EDGE_FRAC));
        ctx.globalCompositeOperation = "destination-in";
        const gx = ctx.createLinearGradient(0, 0, w, 0);
        gx.addColorStop(0, "rgba(0,0,0,0)");
        gx.addColorStop(e / w, "rgba(0,0,0,1)");
        gx.addColorStop(1 - e / w, "rgba(0,0,0,1)");
        gx.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gx;
        ctx.fillRect(0, 0, w, h);
        const gy = ctx.createLinearGradient(0, 0, 0, h);
        gy.addColorStop(0, "rgba(0,0,0,0)");
        gy.addColorStop(e / h, "rgba(0,0,0,1)");
        gy.addColorStop(1 - e / h, "rgba(0,0,0,1)");
        gy.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gy;
        ctx.fillRect(0, 0, w, h);
        return cv.toDataURL("image/png");
      })
      .catch(() => url);
    this.soft.set(url, p);
    return p;
  }

  // Si fallan teselas o relieve se sigue con lo que haya, sin romper la escena.
  private degrade(): void {
    if (this.map.getTerrain()) this.map.setTerrain(null);
  }

  // datos

  setDataset(ds: Dataset): void {
    this.ds = ds;
    this.ticks = {};
    ds.segments.forEach((seg) => seg.ticks.forEach((t) => (this.ticks[t.id] = t)));
    this.whenReady(() => {
      this.buildLayers();
      this.buildRing();
      this.refreshAoiMinZoom();
      this.applyFrame();
      this.applyCompare();
      // El arranque desde la URL pide cámara antes de que existan los límites del área.
      if (!this.map.isMoving()) this.go(this.s.camera === "approach" ? "territory" : this.s.camera, { fly: false, ms: 0 });
    });
  }

  // Anillo que marca el área en la vista de la Tierra completa.
  private buildRing(): void {
    if (!this.ds || this.ring) return;
    const el = document.createElement("div");
    el.className = "tw-ring";
    el.setAttribute("aria-hidden", "true");
    this.ring = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(this.ds.area.center).addTo(this.map);
    this.updateRing();
  }

  private updateRing(): void {
    this.updateAreaChrome();
  }

  // outline y anillo solo con zona activa + radar; en orbita el globo manda
  private updateAreaChrome(): void {
    const c = this.s.camera;
    const map = this.map;
    const gate = this.placeOn && this.radarOn();
    if (map.getLayer("tw-area")) {
      const on = gate && (c === "territory" || c === "detail");
      map.setPaintProperty("tw-area", "line-opacity", on ? 1 : 0);
    }
    if (this.ring) {
      const onOrbit = c === "orbit" && !!this.ds;
      this.ring.getElement().style.display = onOrbit || (gate && c === "approach") ? "block" : "none";
    }
    this.syncSwaths();
    this.syncAoiOverlays();
  }

  private refreshAoiMinZoom(): void {
    const cam = this.territoryCam();
    const orbitZ = this.orbitZoom();
    if (cam?.zoom != null) {
      this.aoiMinZoom = Math.max(orbitZ + 1.25, cam.zoom - 2.5);
      this.territoryZoom = cam.zoom;
    } else {
      this.aoiMinZoom = orbitZ + 2;
    }
  }

  private aoiSpanPx(): number {
    if (!this.ds || !this.ready) return 0;
    const b = this.ds.area.bounds;
    const pts = [
      this.map.project([b.west, b.north]),
      this.map.project([b.east, b.north]),
      this.map.project([b.east, b.south]),
      this.map.project([b.west, b.south]),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return Math.min(maxX - minX, maxY - minY);
  }

  // PNG SAR/fenomeno: solo si la zona activa es el AOI del dataset (demo)
  private aoiOverlaysVisible(): boolean {
    if (!this.placeOn || !this.radarOn() || !this.ds || !this.placeBounds) return false;
    if (!boundsNear(this.placeBounds, this.ds.area.bounds)) return false;
    const c = this.s.camera;
    if (c !== "territory" && c !== "detail") return false;
    const vmin = Math.min(this.mapEl.clientWidth, this.mapEl.clientHeight);
    if (vmin < 40) return false;
    const span = this.aoiSpanPx();
    if (span >= vmin * AOI_VIEWPORT_FRAC) return true;
    return this.map.getZoom() >= this.aoiMinZoom;
  }

  private syncAoiOverlays(): void {
    if (!this.ready) return;
    const on = this.aoiOverlaysVisible();
    for (const [layer, v] of this.intendedOpacity) {
      if (this.map.getLayer(layer)) this.map.setPaintProperty(layer, "raster-opacity", on ? v : 0);
    }
    if (this.map.getLayer("tw-gap")) {
      this.map.setPaintProperty("tw-gap", "fill-opacity", on ? this.gapFill : 0);
    }
  }

  private whenReady(fn: () => void): void {
    if (this.ready) fn();
    else this.queue.push(fn);
  }

  setHotspots(list: Hotspot[]): void {
    this.markers.forEach((m) => m.remove());
    this.markers = list.map((h) => {
      const b = document.createElement("button");
      b.className = "tw-spot";
      b.setAttribute("data-spot", h.id);
      b.setAttribute("aria-label", h.title);
      b.dataset.ll = h.lonlat.join(",");
      b.style.cssText =
        "width:32px;height:32px;padding:0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center";
      const dot = document.createElement("span");
      b.appendChild(dot);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.cbP.forEach((cb) => cb(h.id));
      });
      return new maplibregl.Marker({ element: b, anchor: "center" }).setLngLat(h.lonlat).addTo(this.map);
    });
    this.applyFocus();
  }

  private applyFocus(): void {
    const fl = this.s.focus?.lonlat.join(",");
    this.markers.forEach((m) => {
      const el = m.getElement();
      const on = el.dataset.ll === fl;
      const dot = el.firstElementChild as HTMLElement | null;
      if (!dot) return;
      const z = on ? 16 : 10;
      dot.style.cssText = `display:block;width:${z}px;height:${z}px;border:2px solid ${on ? "var(--acc)" : "var(--scene-spot)"};background:${on ? "var(--acc)" : "transparent"}`;
    });
  }

  // imagenes de capa con fundido

  private fade(): number {
    return this.o.reducedMotion ? 0 : 280;
  }

  private frameOf(tickId: string): FrameRef | null {
    return this.ticks[tickId]?.frames[this.s.layer] ?? null;
  }

  private extras: string[] = [];

  setExtras(ids: string[]): void {
    this.extras = ids;
    this.applyExtras();
    this.updateAreaChrome();
  }

  private applyExtras(): void {
    if (!this.ready || !this.ds || !this.map.getSource("tw-area")) return;
    const map = this.map;
    const want = this.extras.filter((id) => id !== this.s.layer);
    const known = new Set((map.getStyle().layers ?? []).map((l) => l.id).filter((id) => id.startsWith("tw-x-")));
    for (const id of known) {
      if (want.includes(id.slice(5))) continue;
      // drop a load that is still in flight, or it paints the layer back on
      this.extraSeq.set(id, (this.extraSeq.get(id) ?? 0) + 1);
      this.setOpacity(id, 0);
    }
    for (const id of want) {
      const lid = `tw-x-${id}`;
      const fr = this.ticks[this.s.tickId]?.frames[id];
      if (!fr) {
        this.setOpacity(lid, 0);
        continue;
      }
      if (!map.getSource(lid)) {
        map.addSource(lid, { type: "image", url: BLANK, coordinates: coordsOf(fr.bounds) });
        map.addLayer({ id: lid, type: "raster", source: lid, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } }, "tw-cmp");
      }
      const seq = (this.extraSeq.get(lid) ?? 0) + 1;
      this.extraSeq.set(lid, seq);
      void this.softEdge(absolute(fr.url)).then((u) => {
        if (this.extraSeq.get(lid) !== seq || this.dead) return;
        if ((this.intendedOpacity.get(lid) ?? 0) <= 0) return;
        (map.getSource(lid) as ImageSource | undefined)?.updateImage({ url: u, coordinates: coordsOf(fr.bounds) });
        this.setOpacity(lid, this.intendedOpacity.get(lid) ?? 0);
      });
      this.setOpacity(lid, fr.quality === "partial" ? 0.6 : 0.8);
    }
  }

  private setOpacity(layer: string, v: number): void {
    this.intendedOpacity.set(layer, v);
    if (!this.map.getLayer(layer)) return;
    const show = this.aoiOverlaysVisible() && v > 0;
    this.map.setLayoutProperty(layer, "visibility", show ? "visible" : "none");
    this.map.setPaintProperty(layer, "raster-opacity", show ? v : 0);
  }

  private applyFrame(): void {
    if (!this.ready || !this.ds || !this.map.getSource("tw-area")) return;
    const map = this.map;
    this.applyExtras();
    const tick = this.ticks[this.s.tickId];
    const fr = this.frameOf(this.s.tickId);
    this.token += 1;
    const mine = this.token;
    if (this.pending) map.off("sourcedata", this.pending);
    this.pending = null;
    this.gapFill = tick && !fr ? 0.25 : 0;
    if (map.getLayer("tw-gap")) map.setPaintProperty("tw-gap", "fill-opacity", this.aoiOverlaysVisible() ? this.gapFill : 0);
    if (!fr) {
      this.slots.forEach((sl) => this.setOpacity(sl.layer, 0));
      this.hasFront = false;
      return;
    }
    const target = this.hasFront ? 1 - this.front : this.front;
    const slot = this.slots[target];
    if (!slot) return;
    const url = absolute(fr.url);
    const coords = coordsOf(fr.bounds);
    const commit = (): void => {
      if (mine !== this.token) return;
      this.slots.forEach((sl) =>
        map.getLayer(sl.layer) && map.setPaintProperty(sl.layer, "raster-opacity-transition", { duration: this.fade(), delay: 0 }),
      );
      const full = fr.quality === "partial" ? 0.7 : 0.92;
      this.setOpacity(slot.layer, full);
      if (this.hasFront && target !== this.front) this.setOpacity(this.slots[this.front]?.layer ?? "", 0);
      this.front = target;
      this.hasFront = true;
    };
    const onData = (e: MapSourceDataEvent): void => {
      if (e.sourceId !== slot.src || !e.isSourceLoaded) return;
      map.off("sourcedata", onData);
      this.pending = null;
      commit();
    };
    void this.softEdge(url).then((u) => {
      if (mine !== this.token || this.dead) return;
      // listen only once the new image is on its way, so an older load cannot commit this frame
      this.pending = onData;
      map.on("sourcedata", onData);
      (map.getSource(slot.src) as ImageSource | undefined)?.updateImage({ url: u, coordinates: coords });
    });
  }

  // comparar (cortina)

  private applyCompare(): void {
    if (!this.ready || !this.ds || !this.map.getSource("tw-cmp")) return;
    const c = this.s.compare;
    if (!c) {
      this.setOpacity("tw-cmp", 0);
      (this.map.getSource("tw-curtain") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] });
      this.handle.style.display = "none";
      return;
    }
    const b = this.ds.area.bounds;
    const lon = b.west + c.split * (b.east - b.west);
    (this.map.getSource("tw-curtain") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [[lon, b.south], [lon, b.north]] },
    });
    this.handle.style.display = "block";
    this.handle.setAttribute("aria-valuenow", String(Math.round(c.split * 100)));
    this.placeHandle();
    cancelAnimationFrame(this.cmpRaf);
    this.cmpRaf = requestAnimationFrame(() => void this.drawCmp());
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    const hit = this.images.get(url);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(url, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error("imagen"));
      img.src = url;
    });
  }

  // La cortina recorta la imagen B en su parte izquierda y la dibuja encima de A.
  private async drawCmp(): Promise<void> {
    const c = this.s.compare;
    if (!c || !this.ds) return;
    const fr = this.frameOf(c.tickId);
    if (!fr) {
      this.setOpacity("tw-cmp", 0);
      return;
    }
    const b = this.ds.area.bounds;
    const lon = b.west + c.split * (b.east - b.west);
    const fb = fr.bounds;
    const f = clamp((lon - fb.west) / (fb.east - fb.west), 0, 1);
    if (f <= 0.002) {
      this.setOpacity("tw-cmp", 0);
      return;
    }
    const tickAtStart = c.tickId;
    const img = await this.loadImage(absolute(fr.url)).catch(() => null);
    if (!img || this.s.compare?.tickId !== tickAtStart) return;
    const w = Math.max(1, Math.round(img.naturalWidth * f));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = img.naturalHeight;
    cv.getContext("2d")?.drawImage(img, 0, 0, w, img.naturalHeight, 0, 0, w, img.naturalHeight);
    const east = fb.west + f * (fb.east - fb.west);
    const src = this.map.getSource("tw-cmp") as ImageSource | undefined;
    src?.updateImage({ url: cv.toDataURL("image/png"), coordinates: coordsOf({ ...fb, east }) });
    this.setOpacity("tw-cmp", fr.quality === "partial" ? 0.7 : 0.92);
  }

  private bindHandle(): void {
    const h = this.handle;
    h.addEventListener("pointerdown", (e) => {
      this.dragCurtain = true;
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener("pointermove", (e) => {
      if (!this.dragCurtain || !this.s.compare || !this.ds) return;
      const r = this.host.getBoundingClientRect();
      const ll = this.map.unproject([e.clientX - r.left, e.clientY - r.top]);
      const b = this.ds.area.bounds;
      this.setSplit(clamp((ll.lng - b.west) / (b.east - b.west), 0, 1));
    });
    h.addEventListener("pointerup", () => {
      this.dragCurtain = false;
    });
    h.addEventListener("keydown", (e) => {
      if (!this.s.compare) return;
      const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
      if (d) {
        e.preventDefault();
        e.stopPropagation();
        this.setSplit(clamp(this.s.compare.split + d, 0, 1));
      }
    });
  }

  private setSplit(v: number): void {
    if (!this.s.compare) return;
    this.s.compare = { ...this.s.compare, split: v };
    this.applyCompare();
    this.emit();
  }

  private placeHandle(): void {
    const c = this.s.compare;
    if (!c || !this.ds || this.handle.style.display === "none") return;
    const b = this.ds.area.bounds;
    const lon = b.west + c.split * (b.east - b.west);
    const p = this.map.project([lon, (b.south + b.north) / 2]);
    this.handle.style.transform = `translate(${p.x}px,${p.y}px)`;
  }

  // camara

  private orbitZoom(): number {
    const fw = Math.max(80, (this.host?.clientWidth ?? 900) - this.pad.left - this.pad.right);
    const fh = Math.max(80, (this.host?.clientHeight ?? 700) - this.pad.top - this.pad.bottom);
    return Math.log2((0.85 * Math.min(fw, fh) * Math.PI) / 512);
  }

  private dur(ms: number): number {
    return this.o.reducedMotion ? 0 : ms;
  }

  private urban(): boolean {
    return this.s.viewScale === "urbano";
  }

  private territoryCam(): { center: [number, number]; zoom: number; pitch: number; bearing: number } | null {
    if (!this.ds && !this.placeBounds) return null;
    const b = this.placeBounds ?? this.ds!.area.bounds;
    const pitch = clamp(this.s.tilt + (this.urban() ? URBAN_PITCH : 0), 0, 70);
    const bearing = this.s.northUp ? 0 : -18;
    const box: [[number, number], [number, number]] = [[b.west, b.south], [b.east, b.north]];
    // Si los paneles ocupan casi todo el lienzo (pantalla chica), se achican los márgenes.
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    const kx = Math.min(1, Math.max(0, W - 140) / Math.max(1, this.pad.left + this.pad.right + 24));
    const ky = Math.min(1, Math.max(0, H - 140) / Math.max(1, this.pad.top + this.pad.bottom + 24));
    const padding: Padding = {
      top: Math.floor((this.pad.top + 12) * ky),
      bottom: Math.floor((this.pad.bottom + 12) * ky),
      left: Math.floor((this.pad.left + 12) * kx),
      right: Math.floor((this.pad.right + 12) * kx),
    };
    let cam: ReturnType<maplibregl.Map["cameraForBounds"]> | undefined;
    try {
      cam = this.map.cameraForBounds(box, { padding, bearing, pitch, maxZoom: 14 });
    } catch {
      cam = undefined;
    }
    if (!cam || !cam.center) {
      try {
        cam = this.map.cameraForBounds(box, { bearing, pitch, maxZoom: 14 });
      } catch {
        cam = undefined;
      }
    }
    if (!cam || !cam.center) return null;
    const c = maplibregl.LngLat.convert(cam.center as [number, number]);
    const zoom = Math.min(17, (cam.zoom ?? 11) + (this.urban() ? URBAN_ZOOM : 0));
    return { center: [c.lng, c.lat], zoom, pitch, bearing };
  }

  private go(camera: CameraMode, opt: { fly: boolean; ms: number }): void {
    if (this.flyingHome) return;
    try {
      this.goUnsafe(camera, opt);
    } catch (e) {
      // Un fallo de cámara no debe tumbar la interfaz.
      console.warn("escena: no se pudo mover la cámara", e);
    }
  }

  private goUnsafe(camera: CameraMode, opt: { fly: boolean; ms: number }): void {
    if (!this.ready) return;
    const map = this.map;
    const dur = this.dur(opt.ms);
    if (camera === "orbit") {
      const f = this.s.focus;
      if (this.wide || !f) {
        map.easeTo({
          ...this.globeView(),
          duration: dur,
          essential: true,
        });
        return;
      }
      const center = f.lonlat;
      const pitch = clamp(this.s.tilt, 25, 30);
      const bearing = this.s.northUp ? 0 : -18;
      const opts = {
        center: center as [number, number],
        zoom: PLACE_ZOOM,
        pitch,
        bearing,
        padding: this.pad,
        duration: dur,
        essential: true,
        curve: PLACE_FLY_CURVE,
        easing: easeInOutCubic,
      };
      if (opt.fly && dur > 0) map.flyTo(opts);
      else map.easeTo(opts);
      return;
    }
    if (camera === "detail" && this.s.focus) {
      const boost = this.urban() ? URBAN_DETAIL : 1;
      const z = Math.min(17, this.territoryZoom + Math.log2((this.s.focus.zoom || 1.7) * boost));
      const pitch = clamp(this.s.tilt + (this.urban() ? URBAN_PITCH : 0), 0, 70);
      map.easeTo({
        center: this.s.focus.lonlat as [number, number],
        zoom: z,
        pitch,
        bearing: this.s.northUp ? 0 : -18,
        padding: this.pad,
        duration: dur,
        essential: true,
      });
      return;
    }
    const cam = this.territoryCam();
    if (!cam) return;
    this.territoryZoom = cam.zoom;
    const opts = { ...cam, padding: ZERO, duration: dur, essential: true, easing: easeInOutCubic };
    if (opt.fly) map.flyTo(opts);
    else map.easeTo(opts);
  }

  private flightMsTo(center: [number, number]): number {
    if (!this.ready) return PLACE_FLY_MS;
    const c = this.map.getCenter();
    return placeFlyMs([c.lng, c.lat], center);
  }

  flyTo(camera: CameraMode): Promise<void> {
    if (camera === "orbit") return this.backToEarth();
    this.wide = false;
    return new Promise((resolve) => {
      this.flyId += 1;
      const id = this.flyId;
      const from = this.s.camera;
      let dur = PLACE_FLY_MS;
      if (camera === "territory" || camera === "detail") {
        const cam = this.territoryCam();
        const to =
          camera === "detail" && this.s.focus
            ? (this.s.focus.lonlat as [number, number])
            : cam?.center;
        if (to) dur = this.flightMsTo(to);
      }
      this.s.camera = camera === "territory" ? "approach" : camera;
      this.emit();
      const finish = (): void => {
        if (id !== this.flyId) return resolve();
        this.s.camera = camera;
        this.emit();
        resolve();
      };
      if (!this.ready) return finish();
      this.map.once("moveend", finish);
      this.go(camera, { fly: from === "orbit", ms: dur });
      // sin moveend si reducedMotion o camara no calculable
      window.setTimeout(() => {
        if (id === this.flyId && !this.map.isMoving()) {
          this.map.off("moveend", finish);
          finish();
        }
      }, 120);
    });
  }

  resetToOrbit(): Promise<void> {
    return this.backToEarth();
  }

  // decorative ring for the zoom-out, not a measurement
  private spellRing(): void {
    if (this.o.reducedMotion || !this.host) return;
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;left:50%;top:50%;width:140px;height:140px;margin:-70px 0 0 -70px;border:1px solid rgba(94,235,255,.35);border-radius:50%;pointer-events:none;z-index:4;transform:scale(.15);opacity:.7;transition:transform 600ms ease-out,opacity 600ms ease-out";
    this.host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "scale(7)";
      el.style.opacity = "0";
    });
    window.setTimeout(() => el.remove(), 650);
  }

  // the farthest a hand can zoom out keeps the globe at least MIN_GLOBE_SHARE of
  // the screen height across, so it never shrinks to a speck among the stars
  private limitZoomOut(): void {
    const h = this.mapEl?.clientHeight || this.host?.clientHeight || 0;
    if (!h) return;
    const z = Math.log2((MIN_GLOBE_SHARE * h * Math.PI) / 512);
    this.map.setMinZoom(clamp(z, 0, GLOBE_ZOOM - 0.3));
  }

  private globeCenter(): [number, number] {
    const a = this.o.aoi;
    if (!a) return GLOBE_FALLBACK;
    return [(a.west + a.east) / 2, (a.south + a.north) / 2];
  }

  private globeView(): { center: [number, number]; zoom: number; pitch: number; bearing: number } {
    return { center: this.globeCenter(), zoom: GLOBE_ZOOM, pitch: 0, bearing: 0 };
  }

  zoomBy(delta: number): void {
    this.whenReady(() => {
      const map = this.map;
      map.easeTo({ zoom: clamp(map.getZoom() + delta, map.getMinZoom(), map.getMaxZoom()), duration: this.dur(300), essential: true });
    });
  }

  // straight down <-> oblique, like the reference dock; 55 deg is the oblique pitch
  toggleTilt(): void {
    this.whenReady(() => {
      const next = this.map.getPitch() > 5 ? 0 : 55;
      this.s.tilt = next;
      this.map.easeTo({ pitch: next, duration: this.dur(400), essential: true });
      this.emit();
    });
  }

  resetNorth(): void {
    this.whenReady(() => {
      this.s.northUp = true;
      this.map.easeTo({ bearing: 0, duration: this.dur(400), essential: true });
      this.emit();
    });
  }

  locate(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(false);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          this.whenReady(() => {
            this.map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: Math.max(this.map.getZoom(), 8), duration: this.dur(1200), essential: true });
            resolve(true);
          });
        },
        () => resolve(false),
        { timeout: 8000 },
      );
    });
  }

  backToEarth(): Promise<void> {
    return new Promise((resolve) => {
      this.flyId += 1;
      const id = this.flyId;
      this.wide = true;
      if (!this.ready) {
        this.s.camera = "orbit";
        this.flyingHome = false;
        this.emit();
        resolve();
        return;
      }
      const map = this.map;
      map.stop();
      const view = this.globeView();
      const finish = (): void => {
        if (id !== this.flyId) {
          resolve();
          return;
        }
        this.flyingHome = false;
        this.s.camera = "orbit";
        this.emit();
        resolve();
      };
      if (this.o.reducedMotion) {
        map.jumpTo(view);
        finish();
        return;
      }
      this.flyingHome = true;
      this.spellRing();
      let cancelled = false;
      const onUser = (): void => {
        cancelled = true;
        map.stop();
      };
      map.once("dragstart", onUser);
      map.once("wheel", onUser);
      const here = map.getCenter();
      map.flyTo({
        center: here,
        zoom: ORBIT_ALTITUDE_ZOOM,
        pitch: 0,
        bearing: 0,
        duration: ASCEND_MS,
        curve: 1.6,
        easing: easeInOutCubic,
        essential: true,
      });
      map.once("moveend", () => {
        map.off("dragstart", onUser);
        map.off("wheel", onUser);
        if (id !== this.flyId || cancelled) {
          finish();
          return;
        }
        map.easeTo({ ...view, duration: SETTLE_MS, easing: easeInOutCubic, essential: true });
        map.once("moveend", finish);
      });
    });
  }

  fitBounds(bounds: Bounds): Promise<void> {
    this.wide = false;
    this.placeOn = true;
    this.placeBounds = bounds;
    return new Promise((resolve) => {
      this.flyId += 1;
      const id = this.flyId;
      const finish = (): void => {
        if (id !== this.flyId) {
          resolve();
          return;
        }
        this.s.camera = "territory";
        this.emit();
        resolve();
      };
      if (!this.ready) {
        finish();
        return;
      }
      const dur = this.dur(2000);
      this.map.stop();
      this.map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: this.pad, duration: dur, maxZoom: 14, essential: true },
      );
      if (dur === 0) {
        finish();
        return;
      }
      const done = (): void => {
        this.map.off("moveend", done);
        finish();
      };
      this.map.once("moveend", done);
      window.setTimeout(() => {
        if (id === this.flyId && !this.map.isMoving()) done();
      }, dur + 400);
    });
  }

  set(n: Parameters<SceneApi["set"]>[0], opt: { instant?: boolean } = {}): void {
    const s = this.s;
    const tiltChanged = n.tilt !== undefined && n.tilt !== s.tilt;
    const northChanged = n.northUp !== undefined && n.northUp !== s.northUp;
    const scaleChanged = n.viewScale !== undefined && n.viewScale !== s.viewScale;
    if (n.layer !== undefined) s.layer = n.layer;
    if (n.tickId !== undefined) s.tickId = n.tickId;
    if (n.tilt !== undefined) s.tilt = n.tilt;
    if (n.northUp !== undefined) s.northUp = n.northUp;
    if (n.viewScale !== undefined) s.viewScale = n.viewScale;
    if ("compare" in n) {
      if (n.compare) s.compare = { ...n.compare };
      else delete s.compare;
    }
    if ("focus" in n) {
      if (n.focus) s.focus = { ...n.focus };
      else delete s.focus;
    }
    if (n.camera && n.camera !== s.camera) {
      if (opt.instant) {
        s.camera = n.camera;
        this.whenReady(() => {
          const cam = this.territoryCam();
          if (cam && n.camera !== "orbit") {
            this.territoryZoom = cam.zoom;
            this.map.jumpTo({ ...cam, padding: ZERO });
          } else this.go(n.camera as CameraMode, { fly: false, ms: 0 });
        });
      } else if (n.camera === "detail" || n.camera === "territory") {
        this.s.camera = n.camera;
        this.whenReady(() => this.go(n.camera as CameraMode, { fly: false, ms: 700 }));
      } else void this.flyTo(n.camera);
    } else if ((tiltChanged || northChanged || scaleChanged) && (s.camera === "territory" || s.camera === "detail")) {
      const zoomDelta = scaleChanged ? (s.viewScale === "urbano" ? URBAN_ZOOM : -URBAN_ZOOM) : 0;
      this.whenReady(() => {
        const minZoom = this.map.getMinZoom();
        const maxZoom = this.map.getMaxZoom();
        this.territoryZoom = clamp(this.territoryZoom + zoomDelta, minZoom, maxZoom);
        this.map.easeTo({
          center: this.map.getCenter(),
          zoom: clamp(this.map.getZoom() + zoomDelta, minZoom, maxZoom),
          pitch: clamp(s.tilt + (this.urban() ? URBAN_PITCH : 0), 0, 70),
          bearing: s.northUp ? 0 : -18,
          duration: this.dur(700),
          essential: true,
        });
      });
    } else if ("focus" in n && s.camera === "detail" && s.focus) {
      this.whenReady(() => this.go("detail", { fly: false, ms: 700 }));
    } else if ("focus" in n && s.camera === "orbit") {
      const place = Boolean(s.focus);
      this.whenReady(() => {
        let ms = 900;
        if (place && s.focus) {
          const c = this.map.getCenter();
          ms = placeFlyMs([c.lng, c.lat], s.focus.lonlat as [number, number]);
        }
        this.go("orbit", { fly: place, ms });
      });
    }
    this.whenReady(() => {
      this.applyFrame();
      this.applyCompare();
      this.applyFocus();
    });
    this.emit();
  }

  getState(): SceneState {
    const s = this.s;
    return { ...s, compare: s.compare ? { ...s.compare } : undefined, focus: s.focus ? { ...s.focus } : undefined };
  }

  status(): { online: boolean; terrain: boolean; basemap: boolean } {
    return { online: this.o.online, terrain: this.o.terrain, basemap: this.o.basemap };
  }

  onChange(cb: (s: SceneState) => void): () => void {
    this.cbC.add(cb);
    return () => this.cbC.delete(cb);
  }

  onPick(cb: (id: string | null) => void): () => void {
    this.cbP.add(cb);
    return () => this.cbP.delete(cb);
  }

  private emit(): void {
    this.updateRing();
    const st = this.getState();
    this.cbC.forEach((cb) => cb(st));
  }

  private cbMove(): void {
    // La tarjeta de detalle se reancla sola; no hay estado que emitir.
  }

  setPadding(p: Padding): void {
    this.pad = { ...p };
    this.host?.style.setProperty("--tw-pad-b", p.bottom + "px");
    this.host?.style.setProperty("--tw-pad-r", p.right + "px");
    if (!this.ready || this.flyingHome || this.map.isMoving()) return;
    const cam = this.s.camera;
    if (cam === "orbit") this.go("orbit", { fly: false, ms: 300 });
    else if (cam === "territory" || cam === "detail") this.go(cam, { fly: false, ms: 300 });
  }

  setReducedMotion(on: boolean): void {
    this.o.reducedMotion = on;
    this.fx.setReducedMotion(on);
  }

  project(ll: [number, number]): { x: number; y: number } | null {
    if (!this.ready) return null;
    const p = this.map.project(ll);
    return { x: p.x, y: p.y };
  }

}
