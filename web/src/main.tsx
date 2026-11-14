import { createRoot } from "react-dom/client";
import "./app/theme.css";
import { App } from "./app/App";
import { hashParams } from "./app/hash";
import { ConfigProvider } from "./data/config-provider";
import { MapLibreScene, type BasemapTiles } from "./scene/maplibre-scene";
import { MockProvider } from "./tw/mock-provider.js";
import { MockScene } from "./tw/mock-scene.js";
import type { DataProvider, SceneApi, SceneOptions } from "./tw/contract";

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

async function webConfig(): Promise<WebCfg> {
  try {
    const res = await fetch("./app-config.json");
    if (!res.ok) return {};
    return ((await res.json()) as { web?: WebCfg }).web ?? {};
  } catch {
    return {};
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
  const web = await webConfig();
  const basemapTiles: BasemapTiles | undefined = web.gibs_url_template
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
        theme="dark"
        reducedMotion={false}
      />,
    );
  }
}

void start();
