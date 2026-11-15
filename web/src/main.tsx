import { createRoot } from "react-dom/client";
import "./app/theme.css";
import { App } from "./app/App";
import { hashParams } from "./app/hash";
import { ConfigProvider } from "./data/config-provider";
import { MapLibreScene, type BasemapTiles } from "./scene/maplibre-scene";
import type { SpaceConfig } from "./scene/space";
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
  proxy_template?: string;
  underlay?: string;
  resolved_url?: string;
  resolved_date?: string;
  date_lag_days?: number;
  attribution?: string;
  max_zoom?: number;
  label?: string;
  tile_size?: number;
};
type BmCfg = {
  default?: string;
  entries?: BmEntry[] | Record<string, BmEntry>;
  labels?: Record<string, string>;
};

const BM_LABELS: Record<string, string> = {
  gibs_modis_truecolor: "NASA GIBS MODIS",
  gibs_viirs_truecolor: "NASA GIBS VIIRS",
  carto_voyager: "Calles (CARTO Voyager)",
  carto_dark_matter: "Calles oscuras (CARTO)",
  eox_s2cloudless_2025: "Sentinel-2 sin nubes (EOX)",
};

// GIBS truecolor lags (VIIRS often ~14d). Prefer resolved_url from app-config.
function gibsDate(lagDays = 4): string {
  return new Date(Date.now() - lagDays * 86400000).toISOString().slice(0, 10);
}

function entryUrl(e: BmEntry, proxied: boolean): string {
  const lag = e.date_lag_days ?? 4;
  const day = e.resolved_date ?? gibsDate(lag);
  if (proxied && e.proxy_template) return absolute(e.proxy_template.replace("{date}", day));
  if (e.resolved_url) return e.resolved_url;
  return String(e.url_template ?? "").replace("{date}", day);
}

// maplibre resolves tile urls against the worker, not the page
function absolute(path: string): string {
  return new URL(path, window.location.href).href;
}

// the tile cache lives in the edge worker; vite dev and offline copies go direct
async function tileProxyUp(entries: BmEntry[]): Promise<boolean> {
  const probe = entries.find((e) => e.proxy_template);
  if (!probe?.proxy_template) return false;
  const day = probe.resolved_date ?? gibsDate(probe.date_lag_days ?? 4);
  const url = probe.proxy_template.replace("{date}", day).replace("{z}", "0").replace("{x}", "0").replace("{y}", "0");
  try {
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

// Rasters only here; OpenFreeMap vector needs a full style swap (see board T036).
function bmEntries(cfg: BmCfg | undefined): BmEntry[] {
  const raw = cfg?.entries;
  return Array.isArray(raw) ? raw : Object.values(raw ?? {});
}

function basemapOptions(cfg: BmCfg | undefined, proxied: boolean): BasemapOption[] {
  const values = bmEntries(cfg);
  const byId = new Map(values.map((e) => [String(e.id), e]));
  const tiles = (e: BmEntry) => ({
    url: entryUrl(e, proxied),
    tileSize: e.tile_size ?? 256,
    maxzoom: e.max_zoom ?? 8,
    attribution: e.attribution ?? "",
  });
  const list = values
    .filter((e) => e.kind === "raster" && (e.resolved_url || e.url_template))
    .map((e) => {
      const under = e.underlay ? byId.get(e.underlay) : undefined;
      return {
        id: String(e.id),
        label: e.label ?? BM_LABELS[String(e.id)] ?? String(e.id),
        ...tiles(e),
        ...(under ? { underlay: tiles(under) } : {}),
      };
    });
  const first = list.findIndex((o) => o.id === cfg?.default);
  if (first > 0) list.unshift(...list.splice(first, 1));
  return list;
}

type AoiCfg = { west: number; east: number; south: number; north: number };
type AppCfg = { web: WebCfg; basemaps?: BmCfg; aoi?: AoiCfg; space?: SpaceConfig };

async function appConfig(): Promise<AppCfg> {
  try {
    const res = await fetch("./app-config.json");
    if (!res.ok) return { web: {} };
    const c = (await res.json()) as Partial<AppCfg>;
    return { web: c.web ?? {}, basemaps: c.basemaps, aoi: c.aoi, space: c.space };
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
  const bmOpts = basemapOptions(cfg.basemaps, await tileProxyUp(bmEntries(cfg.basemaps)));
  const basemapTiles: BasemapTiles | undefined = bmOpts[0]
    ? bmOpts[0]
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
    return new MapLibreScene({
      ...opts,
      basemapTiles,
      demTiles: web.dem_url_template ?? DEFAULT_DEM,
      // globo libre al abrir: sin home en el AOI (Santiago u otro)
      aoi: cfg.aoi,
      space: cfg.space,
    });
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
