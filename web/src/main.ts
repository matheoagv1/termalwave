import maplibregl, {
  type ImageSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

type Bounds = { west: number; east: number; south: number; north: number };

type TimelineFrame = {
  png: string;
  bounds: Bounds;
};

type TimelineConfig = {
  years: number[];
  default_year: number;
  default_layer: string;
  layers: Array<{ id: string; label: string }>;
  frames: Record<string, Record<string, TimelineFrame>>;
};

type AppConfig = {
  project: { name: string; tagline: string };
  aoi: Bounds & { name?: string };
  product: { output_stem: string; sidecar_type: string };
  timeline: TimelineConfig;
  web: {
    overlay_sidecar: string;
    map_center_lat: number;
    map_center_lon: number;
    map_zoom: number;
    map_min_zoom: number;
    map_max_zoom: number;
    fit_padding_px: number;
    overlay_opacity: number;
    overlay_fade_ms: number;
    overlay_source_id: string;
    overlay_layer_id: string;
    base_source_id: string;
    base_layer_id: string;
    bg_layer_id: string;
    offline_query_param: string;
    tile_error_threshold: number;
    gibs_url_template: string;
    gibs_attribution: string;
    gibs_max_zoom: number;
    gibs_tile_size: number;
    offline_attribution: string;
    status_loading: string;
    status_online: string;
    status_offline: string;
    status_fallback: string;
    timeline_aria: string;
    layers_aria: string;
    panel_title: string;
    context_slot_title: string;
    context_slot_body: string;
    year_scrub_label: string;
    bg_color: string;
  };
};

const brandEl = document.querySelector<HTMLElement>("#brand-name");
const taglineEl = document.querySelector<HTMLElement>("#tagline");
const statusEl = document.querySelector<HTMLElement>("#status");
const timelineEl = document.querySelector<HTMLElement>("#timeline");
const layersEl = document.querySelector<HTMLElement>("#layers");
const panelTitleEl = document.querySelector<HTMLElement>("#panel-title");
const contextTitleEl = document.querySelector<HTMLElement>("#context-title");
const contextBodyEl = document.querySelector<HTMLElement>("#context-body");
const titleEl = document.querySelector("title");

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function applyChrome(cfg: AppConfig): void {
  if (brandEl) brandEl.textContent = cfg.project.name;
  if (taglineEl) taglineEl.textContent = cfg.project.tagline;
  if (titleEl) titleEl.textContent = cfg.project.name;
  if (panelTitleEl) panelTitleEl.textContent = cfg.web.panel_title;
  if (contextTitleEl) contextTitleEl.textContent = cfg.web.context_slot_title;
  if (contextBodyEl) contextBodyEl.textContent = cfg.web.context_slot_body;
  if (timelineEl) timelineEl.setAttribute("aria-label", cfg.web.timeline_aria);
  if (layersEl) layersEl.setAttribute("aria-label", cfg.web.layers_aria);
  setStatus(cfg.web.status_loading);
}

function imageCoordinates(bounds: Bounds): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [bounds.east, bounds.south],
    [bounds.west, bounds.south],
  ];
}

function offlineStyle(web: AppConfig["web"]): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: web.bg_layer_id,
        type: "background",
        paint: { "background-color": web.bg_color },
      },
    ],
  };
}

function gibsStyle(web: AppConfig["web"]): StyleSpecification {
  return {
    version: 8,
    sources: {
      [web.base_source_id]: {
        type: "raster",
        tiles: [web.gibs_url_template],
        tileSize: web.gibs_tile_size,
        maxzoom: web.gibs_max_zoom,
        attribution: web.gibs_attribution,
      },
    },
    layers: [
      {
        id: web.bg_layer_id,
        type: "background",
        paint: { "background-color": web.bg_color },
      },
      {
        id: web.base_layer_id,
        type: "raster",
        source: web.base_source_id,
      },
    ],
  };
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

function resolveFrameUrl(png: string): string {
  return new URL(png, window.location.href).href;
}

function ensureOverlay(
  map: MapLibreMap,
  web: AppConfig["web"],
  frame: TimelineFrame,
): void {
  const coords = imageCoordinates(frame.bounds);
  const url = resolveFrameUrl(frame.png);
  const existing = map.getSource(web.overlay_source_id) as ImageSource | undefined;

  if (existing) {
    existing.updateImage({ url, coordinates: coords });
    if (map.getLayer(web.overlay_layer_id)) {
      map.setPaintProperty(web.overlay_layer_id, "raster-opacity", web.overlay_opacity);
    }
    return;
  }

  map.addSource(web.overlay_source_id, {
    type: "image",
    url,
    coordinates: coords,
  });
  map.addLayer({
    id: web.overlay_layer_id,
    type: "raster",
    source: web.overlay_source_id,
    paint: {
      "raster-opacity": web.overlay_opacity,
      "raster-fade-duration": web.overlay_fade_ms,
    },
  });
}

function fitAoi(map: MapLibreMap, bounds: Bounds, padding: number): void {
  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    { padding, animate: false },
  );
}

function renderTimeline(
  years: number[],
  activeYear: number,
  label: string,
  onPick: (year: number) => void,
): void {
  if (!timelineEl) return;
  timelineEl.replaceChildren();

  const caption = document.createElement("span");
  caption.className = "timeline-label";
  caption.textContent = label;
  timelineEl.appendChild(caption);

  const track = document.createElement("div");
  track.className = "timeline-track";
  timelineEl.appendChild(track);

  for (const year of years) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-year";
    btn.textContent = String(year);
    btn.setAttribute("aria-pressed", year === activeYear ? "true" : "false");
    if (year === activeYear) btn.classList.add("is-active");
    btn.addEventListener("click", () => onPick(year));
    track.appendChild(btn);
  }

  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.className = "timeline-scrub";
  scrub.min = "0";
  scrub.max = String(Math.max(years.length - 1, 0));
  scrub.step = "1";
  scrub.value = String(Math.max(0, years.indexOf(activeYear)));
  scrub.setAttribute("aria-label", label);
  scrub.addEventListener("input", () => {
    const idx = Number(scrub.value);
    const next = years[idx];
    if (next !== undefined) onPick(next);
  });
  timelineEl.appendChild(scrub);
}

function renderLayers(
  layers: TimelineConfig["layers"],
  activeLayer: string,
  onPick: (layerId: string) => void,
): void {
  if (!layersEl) return;
  layersEl.replaceChildren();

  for (const layer of layers) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "layer-btn";
    btn.textContent = layer.label;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", layer.id === activeLayer ? "true" : "false");
    if (layer.id === activeLayer) btn.classList.add("is-active");
    btn.addEventListener("click", () => onPick(layer.id));
    layersEl.appendChild(btn);
  }
}

async function init(): Promise<void> {
  const cfg = await loadJson<AppConfig>("./app-config.json");
  applyChrome(cfg);
  const web = cfg.web;
  const timeline = cfg.timeline;

  let year = timeline.default_year;
  let layerId = timeline.default_layer;
  if (!timeline.years.includes(year)) {
    year = timeline.years[timeline.years.length - 1] ?? year;
  }
  if (!timeline.layers.some((layer) => layer.id === layerId)) {
    layerId = timeline.layers[0]?.id ?? layerId;
  }

  const forceOffline =
    new URLSearchParams(window.location.search).has(web.offline_query_param) ||
    !navigator.onLine;

  const map = new maplibregl.Map({
    container: "map",
    style: forceOffline ? offlineStyle(web) : gibsStyle(web),
    center: [web.map_center_lon, web.map_center_lat],
    zoom: web.map_zoom,
    minZoom: web.map_min_zoom,
    maxZoom: web.map_max_zoom,
    attributionControl: { compact: true },
  });

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: false }),
    "bottom-right",
  );

  let mode: "online" | "offline" = forceOffline ? "offline" : "online";
  let tileErrors = 0;

  if (mode === "online") {
    setStatus(web.status_online);
    map.on("error", (event) => {
      const err = event.error as { status?: number; message?: string } | undefined;
      const msg = (err?.message ?? "").toLowerCase();
      if (!msg.includes("tile") && err?.status === undefined) return;
      tileErrors += 1;
      if (tileErrors >= web.tile_error_threshold && mode === "online") {
        mode = "offline";
        map.setStyle(offlineStyle(web));
        setStatus(web.status_fallback);
      }
    });
  } else {
    setStatus(web.status_offline);
  }

  const applyFrame = (): void => {
    const frame = timeline.frames[layerId]?.[String(year)];
    if (!frame) {
      setStatus(`Frame missing: ${layerId}/${year}`);
      return;
    }
    ensureOverlay(map, web, frame);
  };

  const syncUi = (): void => {
    renderTimeline(timeline.years, year, web.year_scrub_label, (next) => {
      year = next;
      syncUi();
      if (map.isStyleLoaded()) applyFrame();
    });
    renderLayers(timeline.layers, layerId, (next) => {
      layerId = next;
      syncUi();
      if (map.isStyleLoaded()) applyFrame();
    });
  };

  const onStyleReady = (): void => {
    fitAoi(map, cfg.aoi, web.fit_padding_px);
    applyFrame();
  };

  map.on("load", onStyleReady);
  map.on("style.load", onStyleReady);
  syncUi();
}

void init();
