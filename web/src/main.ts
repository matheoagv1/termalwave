import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker assets when bundling locally (no CDN).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type Bounds = { west: number; east: number; south: number; north: number };

type OverlaySidecar = {
  type: string;
  png: string;
  bounds: Bounds;
  source?: string;
};

type AppConfig = {
  project: { name: string; tagline: string };
  aoi: Bounds & { name?: string };
  product: { output_stem: string; sidecar_type: string };
  web: {
    overlay_sidecar: string;
    map_center_lat: number;
    map_center_lon: number;
    map_zoom: number;
    map_min_zoom: number;
    map_max_zoom: number;
    fit_padding_px: number;
    overlay_opacity: number;
    overlay_class_name: string;
    offline_query_param: string;
    tile_error_threshold: number;
    gibs_url_template: string;
    gibs_attribution: string;
    gibs_max_zoom: number;
    gibs_max_native_zoom: number;
    offline_attribution: string;
    status_loading: string;
    status_online: string;
    status_offline: string;
    status_fallback: string;
    tile_size: number;
    plain_fill: string;
    plain_gradient_start: string;
    plain_gradient_end: string;
    plain_stroke: string;
    plain_label: string;
    plain_label_font: string;
    plain_label_x: number;
    plain_label_y: number;
  };
};

const brandEl = document.querySelector<HTMLElement>("#brand-name");
const taglineEl = document.querySelector<HTMLElement>("#tagline");
const statusEl = document.querySelector<HTMLElement>("#status");
const titleEl = document.querySelector("title");

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function applyChrome(cfg: AppConfig): void {
  if (brandEl) brandEl.textContent = cfg.project.name;
  if (taglineEl) taglineEl.textContent = cfg.project.tagline;
  if (titleEl) titleEl.textContent = cfg.project.name;
  setStatus(cfg.web.status_loading);
}

function plainBackgroundLayer(web: AppConfig["web"]): L.GridLayer {
  class PlainBackgroundLayer extends L.GridLayer {
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const tile = document.createElement("canvas");
      tile.width = web.tile_size;
      tile.height = web.tile_size;
      const ctx = tile.getContext("2d");
      if (ctx) {
        ctx.fillStyle = web.plain_fill;
        ctx.fillRect(0, 0, web.tile_size, web.tile_size);
        const gradient = ctx.createLinearGradient(0, 0, web.tile_size, web.tile_size);
        gradient.addColorStop(0, web.plain_gradient_start);
        gradient.addColorStop(1, web.plain_gradient_end);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, web.tile_size, web.tile_size);
        ctx.strokeStyle = web.plain_stroke;
        ctx.strokeRect(0.5, 0.5, web.tile_size - 1, web.tile_size - 1);
        ctx.fillStyle = web.plain_label;
        ctx.font = web.plain_label_font;
        ctx.fillText(
          `${coords.z}/${coords.x}/${coords.y}`,
          web.plain_label_x,
          web.plain_label_y,
        );
      }
      setTimeout(() => done(undefined, tile), 0);
      return tile;
    }
  }

  return new PlainBackgroundLayer({
    attribution: web.offline_attribution,
    tileSize: web.tile_size,
  });
}

function gibsLayer(web: AppConfig["web"]): L.TileLayer {
  return L.tileLayer(web.gibs_url_template, {
    attribution: web.gibs_attribution,
    maxZoom: web.gibs_max_zoom,
    maxNativeZoom: web.gibs_max_native_zoom,
    crossOrigin: true,
  });
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

async function init(): Promise<void> {
  const cfg = await loadJson<AppConfig>("./app-config.json");
  applyChrome(cfg);
  const web = cfg.web;

  const forceOffline =
    new URLSearchParams(window.location.search).has(web.offline_query_param) ||
    !navigator.onLine;

  const map = L.map("map", {
    center: [web.map_center_lat, web.map_center_lon],
    zoom: web.map_zoom,
    minZoom: web.map_min_zoom,
    maxZoom: web.map_max_zoom,
    zoomControl: true,
  });

  let base: L.Layer;
  let mode: "online" | "offline" = forceOffline ? "offline" : "online";

  if (mode === "online") {
    const tiles = gibsLayer(web);
    let tileErrors = 0;
    tiles.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors >= web.tile_error_threshold && mode === "online") {
        mode = "offline";
        map.removeLayer(tiles);
        base = plainBackgroundLayer(web).addTo(map);
        setStatus(web.status_fallback);
      }
    });
    base = tiles.addTo(map);
    setStatus(web.status_online);
  } else {
    base = plainBackgroundLayer(web).addTo(map);
    setStatus(web.status_offline);
  }

  void base;

  try {
    const sidecar = await loadJson<OverlaySidecar>(web.overlay_sidecar);
    const bounds: L.LatLngBoundsExpression = [
      [sidecar.bounds.south, sidecar.bounds.west],
      [sidecar.bounds.north, sidecar.bounds.east],
    ];
    const overlayUrl = new URL(sidecar.png, new URL(web.overlay_sidecar, window.location.href));
    L.imageOverlay(overlayUrl.href, bounds, {
      opacity: web.overlay_opacity,
      interactive: false,
      className: web.overlay_class_name,
    }).addTo(map);
    map.fitBounds(bounds, { padding: [web.fit_padding_px, web.fit_padding_px] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(`Overlay unavailable: ${message}`);
  }
}

void init();
