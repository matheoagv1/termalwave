import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type RasterTileSource } from "maplibre-gl";
import { entryDate, text, type CatalogEntry } from "./entries";
import { catalog } from "./store";
import "./catalog.css";

type FC = { type: "FeatureCollection"; features: Array<{ properties?: Record<string, unknown> | null }> };
type Hit = { fc: FC; confidence: number | null };

const DEBOUNCE_MS = 450;
const CACHE_MAX = 48;
const WORLD = [-180, -90, 180, 90];
const FALLBACK_COLOR = "#5eebff";

const srcOf = (id: string): string => `tw-cat-${id}`;
const VECTOR_PARTS = ["-glow", "", "-line"] as const;

// value -> colour along the entry ramp; ramp stops sit on range, or on 0..1 when there is no range
function colorExpr(e: CatalogEntry): unknown {
  const ramp = e.ramp ?? [];
  if (!ramp.length) return FALLBACK_COLOR;
  if (!e.value_prop || ramp.length === 1) return ramp[ramp.length - 1][0];
  const [lo, hi] = e.range ?? [0, 1];
  const stops: unknown[] = [];
  let last = -Infinity;
  for (const [color, at] of ramp) {
    let v = lo + at * (hi - lo);
    // interpolate needs strictly ascending inputs
    if (v <= last) v = last + 1e-9;
    last = v;
    stops.push(v, color);
  }
  return ["interpolate", ["linear"], ["to-number", ["get", e.value_prop], lo], ...stops];
}

// 0..1 position of the value inside range, for point size
function normExpr(e: CatalogEntry): unknown {
  if (!e.value_prop) return 0.5;
  const [lo, hi] = e.range ?? [0, 1];
  const span = hi - lo || 1;
  return ["max", 0, ["min", 1, ["/", ["-", ["to-number", ["get", e.value_prop], lo], lo], span]]];
}

function radiusExpr(e: CatalogEntry, scale: number): unknown {
  const r = ["+", 2.2, ["*", 5, normExpr(e)]];
  return ["interpolate", ["linear"], ["zoom"], 1, ["*", 0.55 * scale, r], 5, ["*", 1 * scale, r], 10, ["*", 1.8 * scale, r]];
}

function viewBbox(map: maplibregl.Map): number[] {
  if (map.getZoom() < 3) return WORLD;
  const b = map.getBounds();
  let w = Math.floor(b.getWest());
  let e = Math.ceil(b.getEast());
  const s = Math.max(-90, Math.floor(b.getSouth()));
  const n = Math.min(90, Math.ceil(b.getNorth()));
  if (e - w >= 360 || w < -180 || e > 180) {
    w = -180;
    e = 180;
  }
  return [w, s, e, n];
}

function withQuery(url: string, bbox: number[], date: string): string {
  const u = url.replace("{date}", date);
  return `${u}${u.includes("?") ? "&" : "?"}bbox=${bbox.join(",")}&date=${date}`;
}

function meanConfidence(e: CatalogEntry, fc: FC): number | null {
  if (!e.confidence_prop) return null;
  let sum = 0;
  let n = 0;
  for (const f of fc.features) {
    const v = Number(f.properties?.[e.confidence_prop]);
    if (Number.isFinite(v) && v >= 0 && v <= 1) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : null;
}

function lang(): string {
  return (document.documentElement.lang || "en").toLowerCase().startsWith("es") ? "es" : "en";
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

// small inline chart for features that carry series = [{date, value}]
function sparkline(series: unknown): string {
  const pts = (Array.isArray(series) ? series : [])
    .map((p) => (p && typeof p === "object" ? Number((p as { value?: unknown }).value) : NaN))
    .filter((v) => Number.isFinite(v));
  if (pts.length < 2) return "";
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const W = 160;
  const H = 36;
  const d = pts
    .map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`)
    .join(" ");
  return `<svg class="twc-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
}

export class CatalogRenderer {
  private urls = new Map<string, string>();
  private keys = new Map<string, string>();
  private ctrls = new Map<string, AbortController>();
  private cache = new Map<string, Hit>();
  private loaded = new Set<string>();
  private rasters = new Set<string>();
  private clickable = new Set<string>();
  private timer = 0;
  private popup: maplibregl.Popup | null = null;
  private unsub: () => void;

  constructor(private readonly map: maplibregl.Map) {
    this.unsub = catalog.subscribe(() => this.sync());
    map.on("moveend", this.schedule);
    map.on("error", this.onError);
    map.on("sourcedata", this.onData);
    this.sync();
  }

  destroy(): void {
    this.unsub();
    window.clearTimeout(this.timer);
    this.ctrls.forEach((c) => c.abort());
    this.map.off("moveend", this.schedule);
    this.map.off("error", this.onError);
    this.map.off("sourcedata", this.onData);
    this.popup?.remove();
  }

  private schedule = (): void => {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.sync(), DEBOUNCE_MS);
  };

  private onError = (ev: { sourceId?: string; error?: { status?: number; message?: string } }): void => {
    const id = this.idOf(ev.sourceId);
    if (!id || this.loaded.has(id)) return;
    const http = Number(ev.error?.status);
    catalog.setStatus(id, { state: "error", reason: http ? "http" : "network", http: http || undefined });
  };

  private onData = (ev: { sourceId?: string; tile?: unknown }): void => {
    const id = this.idOf(ev.sourceId);
    if (!id || !ev.tile || this.loaded.has(id)) return;
    this.loaded.add(id);
    catalog.setStatus(id, { state: "ok", reason: "" });
  };

  private idOf(src: string | undefined): string {
    return src && src.startsWith("tw-cat-") && this.rasters.has(src.slice(7)) ? src.slice(7) : "";
  }

  private before(raster: boolean): string | undefined {
    const layers = this.map.getStyle()?.layers ?? [];
    if (raster) {
      const img = layers.find((l) => l.id === "tw-img-a");
      if (img) return img.id;
    }
    return layers.find((l) => l.id.startsWith("tw-ent-"))?.id;
  }

  sync(): void {
    const map = this.map;
    if (!map.getStyle()) return;
    for (const e of catalog.entries()) {
      try {
        if (catalog.isOn(e.id)) this.show(e);
        else this.hide(e.id);
      } catch (err) {
        console.warn(`catalog: ${e.id} failed to draw`, err);
        catalog.setStatus(e.id, { state: "error", reason: "format" });
      }
    }
  }

  private hide(id: string): void {
    const map = this.map;
    this.ctrls.get(id)?.abort();
    this.ctrls.delete(id);
    this.keys.delete(id);
    this.urls.delete(id);
    this.loaded.delete(id);
    this.rasters.delete(id);
    const src = srcOf(id);
    for (const part of VECTOR_PARTS) if (map.getLayer(src + part)) map.removeLayer(src + part);
    if (map.getSource(src)) map.removeSource(src);
  }

  private show(e: CatalogEntry): void {
    const date = entryDate(e, catalog.timelineDate(), new Date(), catalog.dailyDate());
    if (e.min_zoom != null && this.map.getZoom() < e.min_zoom) {
      catalog.setStatus(e.id, { state: "empty", reason: "zoom", date });
      return;
    }
    if (e.kind === "raster_tiles") this.showRaster(e, date);
    else this.showVector(e, date);
  }

  private showRaster(e: CatalogEntry, date: string): void {
    const map = this.map;
    const src = srcOf(e.id);
    const url = e.url.replace("{date}", date);
    if (this.urls.get(e.id) === url && map.getSource(src)) return;
    this.urls.set(e.id, url);
    this.rasters.add(e.id);
    this.loaded.delete(e.id);
    const existing = map.getSource(src) as RasterTileSource | undefined;
    if (existing && typeof existing.setTiles === "function") {
      existing.setTiles([url]);
      catalog.setStatus(e.id, { state: "loading", reason: "", date, count: 0 });
      return;
    }
    map.addSource(src, {
      type: "raster",
      tiles: [url],
      tileSize: e.tile_size ?? 256,
      maxzoom: e.max_zoom ?? 9,
      attribution: e.attribution,
    });
    map.addLayer(
      {
        id: src,
        type: "raster",
        source: src,
        minzoom: e.min_zoom ?? 0,
        paint: { "raster-opacity": 0, "raster-fade-duration": 350, "raster-opacity-transition": { duration: 700, delay: 0 } },
      },
      this.before(true),
    );
    // fade the whole layer in once it exists
    requestAnimationFrame(() => {
      if (map.getLayer(src)) map.setPaintProperty(src, "raster-opacity", e.opacity ?? 0.75);
    });
    // status last: it re-enters sync, which must already see the source
    catalog.setStatus(e.id, { state: "loading", reason: "", date, count: 0 });
  }

  private showVector(e: CatalogEntry, date: string): void {
    const bbox = e.query === false ? WORLD : viewBbox(this.map);
    const url = e.query === false ? e.url.replace("{date}", date) : withQuery(e.url, bbox, date);
    const key = `${e.id}|${bbox.join(",")}|${date}`;
    this.urls.set(e.id, url);
    if (this.keys.get(e.id) === key && (this.map.getSource(srcOf(e.id)) || this.ctrls.has(e.id))) return;
    this.keys.set(e.id, key);
    const hit = this.cache.get(key);
    if (hit) {
      this.draw(e, hit, date);
      return;
    }
    this.ctrls.get(e.id)?.abort();
    const ctrl = new AbortController();
    this.ctrls.set(e.id, ctrl);
    catalog.setStatus(e.id, { state: "loading", reason: "", date });
    fetch(url, { signal: ctrl.signal, credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) {
          if (this.ctrls.get(e.id) === ctrl) this.ctrls.delete(e.id);
          catalog.setStatus(e.id, { state: "error", reason: "http", http: r.status, count: 0 });
          return;
        }
        const body = (await r.json()) as FC;
        if (ctrl.signal.aborted || !catalog.isOn(e.id)) return;
        this.ctrls.delete(e.id);
        if (!body || body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
          catalog.setStatus(e.id, { state: "error", reason: "format", count: 0 });
          return;
        }
        const got: Hit = { fc: body, confidence: meanConfidence(e, body) };
        this.cache.set(key, got);
        if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
        this.draw(e, got, date);
      })
      .catch((err: Error) => {
        if (err?.name === "AbortError") return;
        if (this.ctrls.get(e.id) === ctrl) this.ctrls.delete(e.id);
        this.keys.delete(e.id);
        catalog.setStatus(e.id, { state: "error", reason: "network", count: 0 });
      });
  }

  private draw(e: CatalogEntry, hit: Hit, date: string): void {
    const map = this.map;
    const src = srcOf(e.id);
    const n = hit.fc.features.length;
    catalog.setStatus(e.id, { state: n ? "ok" : "empty", reason: "", count: n, confidence: hit.confidence, date });
    const existing = map.getSource(src) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(hit.fc as unknown as GeoJSON.GeoJSON);
      return;
    }
    map.addSource(src, { type: "geojson", data: hit.fc as unknown as GeoJSON.GeoJSON, attribution: e.attribution });
    const before = this.before(false);
    const color = colorExpr(e) as string;
    const op = e.opacity ?? 0.9;
    const minzoom = e.min_zoom ?? 0;
    if (e.kind === "geojson_points") {
      // soft halo under a bright core: the glowing-ember look of the fire marks
      map.addLayer({ id: `${src}-glow`, type: "circle", source: src, minzoom, paint: { "circle-radius": radiusExpr(e, 2.4) as number, "circle-color": color, "circle-blur": 1, "circle-opacity": 0.35 * op } }, before);
      map.addLayer({ id: src, type: "circle", source: src, minzoom, paint: { "circle-radius": radiusExpr(e, 1) as number, "circle-color": color, "circle-blur": 0.25, "circle-opacity": op } }, before);
    } else if (e.kind === "geojson_polygons") {
      map.addLayer({ id: src, type: "fill", source: src, minzoom, paint: { "fill-color": color, "fill-opacity": 0.12 * op } }, before);
      map.addLayer({ id: `${src}-glow`, type: "line", source: src, minzoom, paint: { "line-color": color, "line-width": 4, "line-blur": 4, "line-opacity": 0.35 * op } }, before);
      map.addLayer({ id: `${src}-line`, type: "line", source: src, minzoom, paint: { "line-color": color, "line-width": 1.1, "line-opacity": op } }, before);
    } else {
      // grid cells stay flat: extrusions read badly on the globe at continental zoom
      map.addLayer({ id: src, type: "fill", source: src, minzoom, paint: { "fill-color": color, "fill-opacity": 0.5 * op, "fill-antialias": true } }, before);
      map.addLayer({ id: `${src}-line`, type: "line", source: src, minzoom, paint: { "line-color": color, "line-width": 0.5, "line-opacity": 0.4 * op } }, before);
    }
    if (!this.clickable.has(src)) {
      this.clickable.add(src);
      map.on("click", src, (ev: MapLayerMouseEvent) => this.inspect(e.id, ev));
      map.on("mouseenter", src, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", src, () => (map.getCanvas().style.cursor = ""));
    }
  }

  private inspect(id: string, ev: MapLayerMouseEvent): void {
    const e = catalog.entries().find((x) => x.id === id);
    const f = ev.features?.[0];
    if (!e || !f) return;
    const L = lang();
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const name = String(p.title ?? p.name ?? p.place ?? "");
    const raw = e.value_prop ? p[e.value_prop] : undefined;
    const num = Number(raw);
    const value = raw == null || raw === "" ? "" : Number.isFinite(num) ? `${+num.toFixed(2)}${e.unit ? ` ${e.unit}` : ""}` : String(raw);
    const conf = e.confidence_prop ? Number(p[e.confidence_prop]) : NaN;
    // series arrives as a JSON string when it went through a GeoJSON source
    let series: unknown = p.series;
    if (typeof series === "string") {
      try {
        series = JSON.parse(series);
      } catch {
        series = null;
      }
    }
    const rows = [
      `<div class="twc-pop-k">${esc(text(e, "label", L))}</div>`,
      name ? `<div class="twc-pop-name">${esc(name)}</div>` : "",
      value ? `<div class="twc-pop-v">${esc(value)}</div>` : "",
      Number.isFinite(conf) ? `<div class="twc-pop-sub">${L === "es" ? "Confianza" : "Confidence"} ${Math.round(conf * 100)} %</div>` : "",
      sparkline(series),
      e.attribution ? `<div class="twc-pop-sub">${esc(e.attribution)}</div>` : "",
    ];
    this.popup?.remove();
    this.popup = new maplibregl.Popup({ className: "twc-pop", closeButton: true, maxWidth: "240px" })
      .setLngLat(ev.lngLat)
      .setHTML(rows.join(""))
      .addTo(this.map);
  }
}

const live = new WeakMap<maplibregl.Map, CatalogRenderer>();

// one renderer per map; the scene calls this once its style is ready
export function attachCatalog(map: maplibregl.Map): CatalogRenderer {
  let r = live.get(map);
  if (!r) {
    r = new CatalogRenderer(map);
    live.set(map, r);
    map.once("remove", () => r?.destroy());
  } else r.sync();
  return r;
}
