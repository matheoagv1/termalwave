import { createRoot } from "react-dom/client";
import "./app/theme.css";
import { App } from "./app/App";
import { hashParams } from "./app/hash";
import { ConfigProvider } from "./data/config-provider";
import { MapLibreScene, type BasemapTiles } from "./scene/maplibre-scene";
import { MockProvider } from "./tw/mock-provider.js";
import { MockScene } from "./tw/mock-scene.js";
import type { BasemapOption, DataProvider, SceneApi, SceneOptions } from "./tw/contract";

// Modo demo: #mock=1 o cualquier #escenario=... usa los datos de ejemplo.
// Sin eso la app lee el backend (dataset.json o app-config.json).
const params = hashParams();
const demo = params.mock === "1" || !!params.escenario;

type WebCfg = {
  gibs_url_template?: string;
  gibs_attribution?: string;
  gibs_max_zoom?: number;
  gibs_tile_size?: number;
  dem_url_template?: string;
};

type BmEntry = {
  id?: string;
  kind?: string;
  url_template?: string;
  attribution?: string;
  max_zoom?: number;
  label?: string;
  tile_size?: number;
};
type BmCfg = { default?: string; entries?: Record<string, BmEntry>; labels?: Record<string, string> };

const BM_LABELS: Record<string, string> = {
  gibs_modis_truecolor: "NASA GIBS MODIS",
  gibs_viirs_truecolor: "NASA GIBS VIIRS",
  eox_s2cloudless_2025: "Sentinel-2 sin nubes (EOX)",
};

// GIBS publica el dia en curso a medias: se pide una fecha ya procesada.
function gibsDate(): string {
  return new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
}

// Solo se ofrecen los rasters; el vector (OpenFreeMap) y el relieve de Cesium no son de esta escena.
function basemapOptions(cfg: BmCfg | undefined): BasemapOption[] {
  const list = Object.values(cfg?.entries ?? {})
    .filter((e) => e.kind === "raster" && e.url_template)
    .map((e) => ({
      id: String(e.id),
      label: e.label ?? BM_LABELS[String(e.id)] ?? String(e.id),
      url: String(e.url_template).replace("{date}", gibsDate()),
      tileSize: e.tile_size ?? 256,
      maxzoom: e.max_zoom ?? 8,
      attribution: e.attribution ?? "",
    }));
  const first = list.findIndex((o) => o.id === cfg?.default);
  if (first > 0) list.unshift(...list.splice(first, 1));
  return list;
}

async function appConfig(): Promise<{ web: WebCfg; basemaps?: BmCfg }> {
  try {
    const res = await fetch("./app-config.json");
    if (!res.ok) return { web: {} };
    const c = (await res.json()) as { web?: WebCfg; basemaps?: BmCfg };
    return { web: c.web ?? {}, basemaps: c.basemaps };
  } catch {
    return { web: {} };
  }
}

function hasWebGL(): boolean {
  try {
    const cv = document.createElement("canvas");
    return !!(cv.getContext("webgl2") ?? cv.getContext("webgl"));
  } catch {
    return false;
  }
}

// Terrarium en AWS Open Data: relieve opcional, solo con conexion.
const DEFAULT_DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

async function start(): Promise<void> {
  const cfg = await appConfig();
  const web = cfg.web;
  const bmOpts = basemapOptions(cfg.basemaps);
  const basemapTiles: BasemapTiles | undefined = bmOpts[0]
    ? { url: bmOpts[0].url, tileSize: bmOpts[0].tileSize, maxzoom: bmOpts[0].maxzoom, attribution: bmOpts[0].attribution }
    : web.gibs_url_template
    ? {
        url: web.gibs_url_template,
        tileSize: web.gibs_tile_size ?? 256,
        maxzoom: web.gibs_max_zoom ?? 8,
        attribution: web.gibs_attribution ?? "",
      }
    : undefined;
  const useDom = params.scene === "dom" || !hasWebGL();

  const makeProvider = (scenario: string): DataProvider =>
    demo ? (new MockProvider({ scenario }) as unknown as DataProvider) : new ConfigProvider("./");

  const makeScene = (opts: SceneOptions): SceneApi => {
    if (useDom) return new MockScene(opts) as unknown as SceneApi;
    return new MapLibreScene({ ...opts, basemapTiles, demTiles: web.dem_url_template ?? DEFAULT_DEM });
  };

  const el = document.getElementById("root");
  if (el) {
    createRoot(el).render(
      <App
        makeProvider={makeProvider}
        makeScene={makeScene}
        allowScenarios={demo}
        // con WebGL y conexion hay relieve; el estado se informa tal cual
        realTerrain={!useDom}
        basemaps={useDom ? undefined : bmOpts}
        theme="dark"
        reducedMotion={false}
      />,
    );
  }
}

void start();

// PWA: registro del service worker (solo en la version publicada)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
