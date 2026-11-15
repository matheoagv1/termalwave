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
import { BodiesLayer } from "./space/bodies";
import { CloudsLayer } from "./space/clouds";
import { SpaceScene, type SpaceConfig } from "./space";
import { SatellitesLayer } from "./space/satellites";
import { SkyLayer } from "./space/sky";
import type { Bounds } from "./space/satellites-geometry";

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
// AOI image layers stay off until the footprint covers ~this fraction of the shorter viewport edge.
const AOI_VIEWPORT_FRAC = 0.12;

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
  private ready = false;
  private queue: Array<() => void> = [];
  private markers: Marker[] = [];
  private ring: Marker | null = null;
  private handle!: HTMLDivElement;
  private raf = 0;
  private lastT = 0;
  private interacting = false;
  private resumeT: number | undefined;
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

    this.map = new maplibregl.Map({
      container: this.mapEl,
      style: this.baseStyle(),
      center: this.o.home ?? [0, 0],
      zoom: this.orbitZoom(),
      minZoom: 0.6,
      maxZoom: 17,
      maxPitch: 70,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    this.map.touchZoomRotate.disableRotation();
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
    this.map.on("dragstart", () => this.touch());
    this.map.on("zoomstart", (e) => {
      if ((e as { originalEvent?: unknown }).originalEvent) this.touch();
    });
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
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.cmpRaf);
    window.clearTimeout(this.resumeT);
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
      sky: this.o.space
        ? {
            "sky-color": "#000000",
            "horizon-color": "#000000",
            "atmosphere-blend": 0.15,
          }
        : {
            "sky-color": this.css("--scene-sphere", "#082460"),
            "horizon-color": this.css("--scene-grid", "#2474ec"),
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
          },
    } as StyleSpecification;
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
    map.setSky({
      "sky-color": this.css("--scene-sphere", "#082460"),
      "horizon-color": this.css("--scene-grid", "#2474ec"),
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    } as never);
  }

  private spaceMounted = false;

  private async mountSpace(): Promise<void> {
    if (!this.space || this.spaceMounted) return;
    this.spaceMounted = true;
    const aoi = this.o.aoi ?? null;
    try {
      await this.space.add(new SkyLayer({ labels: false }), true);
      await this.space.add(new BodiesLayer(), true);
      await this.space.add(
        new SatellitesLayer(aoi, { labels: true, swath: true, footprint: false, tracks: true }),
        true,
      );
      await this.space.add(new CloudsLayer({ opacity: 0.85 }), true);
    } catch (e) {
      console.warn("escena espacial:", e);
    }
  }

  setSpaceLayer(id: string, on: boolean): void {
    this.space?.setVisible(id, on);
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

  // en orbita el globo manda: sin caja ni anillo que ensucien el aterrizaje
  private updateAreaChrome(): void {
    const c = this.s.camera;
    const map = this.map;
    if (map.getLayer("tw-area")) {
      const on = c === "territory" || c === "detail";
      map.setPaintProperty("tw-area", "line-opacity", on ? 1 : 0);
    }
    if (this.ring) {
      this.ring.getElement().style.display = c === "approach" ? "block" : "none";
    }
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

  /** PNG SAR/fenómeno solo en territorio/detalle y con encuadre suficiente (no cuadrante flotante). */
  private aoiOverlaysVisible(): boolean {
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
  }

  private applyExtras(): void {
    if (!this.ready || !this.ds || !this.map.getSource("tw-area")) return;
    const map = this.map;
    const want = this.extras.filter((id) => id !== this.s.layer);
    const known = new Set((map.getStyle().layers ?? []).map((l) => l.id).filter((id) => id.startsWith("tw-x-")));
    for (const id of known) if (!want.includes(id.slice(5))) this.setOpacity(id, 0);
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
      (map.getSource(lid) as ImageSource).updateImage({ url: absolute(fr.url), coordinates: coordsOf(fr.bounds) });
      this.setOpacity(lid, fr.quality === "partial" ? 0.6 : 0.8);
    }
  }

  private setOpacity(layer: string, v: number): void {
    this.intendedOpacity.set(layer, v);
    if (!this.map.getLayer(layer)) return;
    this.map.setPaintProperty(layer, "raster-opacity", this.aoiOverlaysVisible() ? v : 0);
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
    this.pending = onData;
    map.on("sourcedata", onData);
    (map.getSource(slot.src) as ImageSource).updateImage({ url, coordinates: coords });
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
    if (!this.ds) return null;
    const b = this.ds.area.bounds;
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
    const area = this.ds?.area.center ?? [-64.25, -27.8];
    if (camera === "orbit") {
      const f = this.s.focus;
      const center = f ? f.lonlat : area;
      const z = f ? this.orbitZoom() * 1.0 : this.orbitZoom();
      map.easeTo({ center: center as [number, number], zoom: z, pitch: 0, bearing: 0, padding: this.pad, duration: dur, essential: true });
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
    const opts = { ...cam, padding: ZERO, duration: dur, essential: true };
    if (opt.fly) map.flyTo(opts);
    else map.easeTo(opts);
  }

  flyTo(camera: CameraMode): Promise<void> {
    return new Promise((resolve) => {
      this.flyId += 1;
      const id = this.flyId;
      const from = this.s.camera;
      const dur = camera === "orbit" ? 1800 : 2600;
      this.s.camera = camera === "territory" || camera === "orbit" ? "approach" : camera;
      this.emit();
      const finish = (): void => {
        if (id !== this.flyId) return resolve();
        this.s.camera = camera;
        this.emit();
        resolve();
      };
      if (!this.ready) return finish();
      this.map.once("moveend", finish);
      this.go(camera, { fly: from === "orbit" || camera === "orbit", ms: dur });
      // Sin animación (movimiento reducido o cámara que no se pudo calcular) no habrá moveend.
      window.setTimeout(() => {
        if (id === this.flyId && !this.map.isMoving()) {
          this.map.off("moveend", finish);
          finish();
        }
      }, 120);
    });
  }

  resetToOrbit(): Promise<void> {
    if (this.s.focus) delete this.s.focus;
    this.applyFocus();
    return this.flyTo("orbit");
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
      this.whenReady(() => this.go("orbit", { fly: false, ms: 900 }));
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
    if (!this.ready) return;
    const cam = this.s.camera;
    if (cam === "orbit") this.go("orbit", { fly: false, ms: 300 });
    else if (cam === "territory" || cam === "detail") this.go(cam, { fly: false, ms: 300 });
  }

  setReducedMotion(on: boolean): void {
    this.o.reducedMotion = on;
  }

  project(ll: [number, number]): { x: number; y: number } | null {
    if (!this.ready) return null;
    const p = this.map.project(ll);
    return { x: p.x, y: p.y };
  }

  private touch(): void {
    this.interacting = true;
    window.clearTimeout(this.resumeT);
    this.resumeT = window.setTimeout(() => (this.interacting = false), 4000);
  }

  // El globo gira despacio en orbita, salvo que haya movimiento reducido o se lo esté tocando.
  private loop = (t: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    if (!this.ready || this.s.camera !== "orbit" || this.interacting || this.s.focus || this.o.reducedMotion) return;
    if (this.map.isMoving()) return;
    const c = this.map.getCenter();
    this.map.setCenter([c.lng + 3 * dt, c.lat]);
  };
}
