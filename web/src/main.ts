import maplibregl, {
  type ImageSource,
  type Map as MapLibreMap,
  type MapSourceDataEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { COPY } from "./copy";

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

type StatusMode = "loading" | "online" | "offline";

const brandEl = document.querySelector<HTMLElement>("#brand-name");
const taglineEl = document.querySelector<HTMLElement>("#tagline");
const statusEl = document.querySelector<HTMLElement>("#status");
const timelineEl = document.querySelector<HTMLElement>("#timeline");
const layersEl = document.querySelector<HTMLElement>("#layers");
const panelTitleEl = document.querySelector<HTMLElement>("#panel-title");
const contextTitleEl = document.querySelector<HTMLElement>("#context-title");
const contextBodyEl = document.querySelector<HTMLElement>("#context-body");
const captionEl = document.querySelector<HTMLElement>("#map-caption");
const titleEl = document.querySelector("title");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setStatus(text: string, mode: StatusMode): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.mode = mode;
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
  setStatus(cfg.web.status_loading, "loading");
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

function fitAoi(map: MapLibreMap, bounds: Bounds, padding: number): void {
  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    { padding, animate: false },
  );
}

/**
 * Dos capas de imagen alternadas: la nueva carga atrás y se funde con la
 * actual cuando terminó de cargar. Así el scrub no parpadea ni deja huecos.
 */
function createOverlay(map: MapLibreMap, web: AppConfig["web"]) {
  const slots = (["a", "b"] as const).map((suffix) => ({
    source: `${web.overlay_source_id}-${suffix}`,
    layer: `${web.overlay_layer_id}-${suffix}`,
  }));
  let front = 0;
  let hasFront = false;
  let token = 0;
  let pending: ((event: MapSourceDataEvent) => void) | null = null;

  const fadeMs = (): number => (reducedMotion.matches ? 0 : web.overlay_fade_ms);

  const cancelPending = (): void => {
    if (pending) map.off("sourcedata", pending);
    pending = null;
  };

  const setOpacity = (index: number, value: number): void => {
    const slot = slots[index];
    if (slot && map.getLayer(slot.layer)) {
      map.setPaintProperty(slot.layer, "raster-opacity", value);
    }
  };

  const ensureSlot = (index: number, url: string, coords: ReturnType<typeof imageCoordinates>): void => {
    const slot = slots[index];
    if (!slot) return;
    const existing = map.getSource(slot.source) as ImageSource | undefined;
    if (existing) {
      existing.updateImage({ url, coordinates: coords });
      return;
    }
    map.addSource(slot.source, { type: "image", url, coordinates: coords });
    map.addLayer({
      id: slot.layer,
      type: "raster",
      source: slot.source,
      paint: { "raster-opacity": 0 },
    });
    map.setPaintProperty(slot.layer, "raster-opacity-transition", {
      duration: fadeMs(),
      delay: 0,
    });
  };

  return {
    /** Hay que llamarlo cuando cambia el estilo base: se pierden fuentes y capas. */
    reset(): void {
      cancelPending();
      hasFront = false;
      front = 0;
      token += 1;
    },
    show(frame: TimelineFrame): void {
      const mine = ++token;
      cancelPending();
      const coords = imageCoordinates(frame.bounds);
      const url = resolveFrameUrl(frame.png);
      const target = hasFront ? 1 - front : front;
      const slot = slots[target];
      if (!slot) return;

      const commit = (): void => {
        if (mine !== token) return;
        for (const s of slots) {
          if (map.getLayer(s.layer)) {
            map.setPaintProperty(s.layer, "raster-opacity-transition", {
              duration: fadeMs(),
              delay: 0,
            });
          }
        }
        setOpacity(target, web.overlay_opacity);
        if (hasFront && target !== front) setOpacity(front, 0);
        front = target;
        hasFront = true;
      };

      const onData = (event: MapSourceDataEvent): void => {
        if (event.sourceId !== slot.source || !event.isSourceLoaded) return;
        cancelPending();
        commit();
      };
      pending = onData;
      map.on("sourcedata", onData);
      ensureSlot(target, url, coords);
    },
  };
}

type TimelineUi = {
  setYear(year: number): void;
  setPlaying(playing: boolean): void;
};

function buildTimeline(
  years: number[],
  activeYear: number,
  label: string,
  onPick: (year: number) => void,
  onToggle: () => void,
): TimelineUi {
  const root = timelineEl;
  const noop: TimelineUi = { setYear: () => undefined, setPlaying: () => undefined };
  if (!root) return noop;
  root.replaceChildren();

  const caption = document.createElement("span");
  caption.className = "timeline-label";
  caption.textContent = label;
  root.appendChild(caption);

  const play = document.createElement("button");
  play.type = "button";
  play.className = "timeline-play";
  play.textContent = COPY.play;
  play.setAttribute("aria-pressed", "false");
  play.addEventListener("click", onToggle);
  root.appendChild(play);

  const body = document.createElement("div");
  body.className = "timeline-body";
  root.appendChild(body);

  const track = document.createElement("div");
  track.className = "timeline-track";
  body.appendChild(track);

  const buttons = new Map<number, HTMLButtonElement>();
  for (const year of years) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-year";
    btn.textContent = String(year);
    btn.addEventListener("click", () => onPick(year));
    track.appendChild(btn);
    buttons.set(year, btn);
  }

  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.className = "timeline-scrub";
  scrub.min = "0";
  scrub.max = String(Math.max(years.length - 1, 0));
  scrub.step = "1";
  scrub.setAttribute("aria-label", label);
  scrub.addEventListener("input", () => {
    const next = years[Number(scrub.value)];
    if (next !== undefined) onPick(next);
  });
  body.appendChild(scrub);

  const setYear = (year: number): void => {
    for (const [value, btn] of buttons) {
      const on = value === year;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const idx = years.indexOf(year);
    if (idx >= 0) {
      scrub.value = String(idx);
      scrub.setAttribute("aria-valuetext", String(year));
    }
  };

  const setPlaying = (playing: boolean): void => {
    play.textContent = playing ? COPY.pause : COPY.play;
    play.setAttribute("aria-pressed", playing ? "true" : "false");
    play.classList.toggle("is-playing", playing);
  };

  setYear(activeYear);
  return { setYear, setPlaying };
}

type LayersUi = { setLayer(layerId: string): void };

function buildLayers(
  layers: TimelineConfig["layers"],
  activeLayer: string,
  onPick: (layerId: string) => void,
): LayersUi {
  const root = layersEl;
  if (!root) return { setLayer: () => undefined };
  root.replaceChildren();

  const buttons: Array<{ id: string; el: HTMLButtonElement }> = [];
  layers.forEach((layer, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "layer-btn";
    btn.textContent = layer.label;
    btn.setAttribute("role", "radio");
    btn.addEventListener("click", () => onPick(layer.id));
    btn.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
      if (!forward && !backward) return;
      event.preventDefault();
      const nextIndex =
        (index + (forward ? 1 : -1) + layers.length) % layers.length;
      const next = layers[nextIndex];
      if (!next) return;
      onPick(next.id);
      buttons[nextIndex]?.el.focus();
    });
    root.appendChild(btn);
    buttons.push({ id: layer.id, el: btn });
  });

  const setLayer = (layerId: string): void => {
    for (const { id, el } of buttons) {
      const on = id === layerId;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-checked", on ? "true" : "false");
      el.tabIndex = on ? 0 : -1;
    }
  };

  setLayer(activeLayer);
  return { setLayer };
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
  let styleReady = false;
  const overlay = createOverlay(map, web);

  if (mode === "online") {
    setStatus(web.status_online, "online");
    map.on("error", (event) => {
      const err = event.error as { status?: number; message?: string } | undefined;
      const msg = (err?.message ?? "").toLowerCase();
      if (!msg.includes("tile") && err?.status === undefined) return;
      tileErrors += 1;
      if (tileErrors >= web.tile_error_threshold && mode === "online") {
        mode = "offline";
        styleReady = false;
        overlay.reset();
        map.setStyle(offlineStyle(web));
        setStatus(web.status_fallback, "offline");
      }
    });
  } else {
    setStatus(web.status_offline, "offline");
  }

  const layerLabel = (id: string): string =>
    timeline.layers.find((layer) => layer.id === id)?.label ?? id;

  const updateCaption = (): void => {
    if (captionEl) {
      captionEl.textContent = `${layerLabel(layerId)}${COPY.captionSeparator}${year}`;
    }
  };

  const applyFrame = (): void => {
    updateCaption();
    if (!styleReady) return;
    const frame = timeline.frames[layerId]?.[String(year)];
    if (!frame) {
      setStatus(COPY.frameMissing(layerLabel(layerId), year), mode);
      return;
    }
    overlay.show(frame);
  };

  let timer: number | null = null;
  const stepMs = Math.max(1200, web.overlay_fade_ms * 3);

  const pickYear = (next: number): void => {
    year = next;
    timelineUi.setYear(year);
    applyFrame();
  };

  const stop = (): void => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    timelineUi.setPlaying(false);
  };

  const play = (): void => {
    timelineUi.setPlaying(true);
    timer = window.setInterval(() => {
      const idx = timeline.years.indexOf(year);
      const next = timeline.years[(idx + 1) % timeline.years.length];
      if (next !== undefined) pickYear(next);
    }, stepMs);
  };

  const timelineUi = buildTimeline(
    timeline.years,
    year,
    web.year_scrub_label,
    (next) => {
      stop();
      pickYear(next);
    },
    () => (timer === null ? play() : stop()),
  );

  const layersUi = buildLayers(timeline.layers, layerId, (next) => {
    layerId = next;
    layersUi.setLayer(layerId);
    applyFrame();
  });

  map.on("style.load", () => {
    styleReady = true;
    overlay.reset();
    fitAoi(map, cfg.aoi, web.fit_padding_px);
    applyFrame();
  });

  updateCaption();
}

void init();
