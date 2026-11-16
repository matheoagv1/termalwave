// dev-only harness for the space layers; not part of the app build
import maplibregl from "maplibre-gl";
import { SpaceScene } from "../src/scene/space";
import type { SpaceConfig, SpaceLayer } from "../src/scene/space";

const q = new URLSearchParams(location.search);
const cfg = await (await fetch("/app-config.json")).json();
const map = new maplibregl.Map({
  container: "m",
  style: {
    version: 8,
    projection: { type: "globe" },
    sources: { base: { type: "raster", tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"], tileSize: 256, maxzoom: 8 } },
    layers: [{ id: "base", type: "raster", source: "base" }],
  },
  center: [Number(q.get("lon") ?? -64.25), Number(q.get("lat") ?? -27.8)],
  zoom: Number(q.get("z") ?? 1.3),
  pitch: Number(q.get("pitch") ?? 0),
  bearing: Number(q.get("bearing") ?? 0),
  attributionControl: false,
  canvasContextAttributes: { antialias: true },
});
const space = new SpaceScene(map, cfg.space as SpaceConfig);
if (q.get("at")) space.setClock(new Date(q.get("at")!));
(window as unknown as { space: SpaceScene; map: maplibregl.Map }).space = space;
(window as unknown as { map: maplibregl.Map }).map = map;

// each layer module registers itself here once it exists: ?layers=sky,satellites,clouds
const loaders: Record<string, () => Promise<SpaceLayer>> = {
  clouds: async () => new (await import("../src/scene/space/clouds")).CloudsLayer(),
  sky: async () => { cfg.space.sky_assets = "/sky/"; return new (await import("../src/scene/space/sky")).SkyLayer({ labels: q.get("labels") !== "0" }); },
  bodies: async () => { const b = await import("../src/scene/space/bodies"); const night = () => { map.addSource("night", { type: "geojson", data: b.nightPolygon(space.now()) }); map.addLayer({ id: "night", type: "fill", source: "night", paint: { "fill-color": "#000814", "fill-opacity": 0.5, "fill-antialias": false } }); }; if (map.isStyleLoaded()) night(); else map.once("load", night); return new b.BodiesLayer(); },
  satellites: async () => new (await import("../src/scene/space/satellites")).SatellitesLayer(cfg.aoi, { groups: (q.get("groups") ?? "").split(",").filter(Boolean) }),
  probe: async () => ({ id: "probe", mount: (h) => { h.back.style.background = "#a00"; }, setVisible() {}, frame() {}, destroy() {} }),
};
for (const id of (q.get("layers") ?? "").split(",").filter(Boolean)) if (loaders[id]) await space.add(await loaders[id]());
map.once("idle", () => setTimeout(() => document.body.setAttribute("data-ready", "1"), Number(q.get("settle") ?? 1500)));
