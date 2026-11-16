# Basemaps (frontend config)

Configured in `config/apis.toml` `[basemaps]`, emitted into `app-config.json`.

| Id | Kind | Notes |
|---|---|---|
| `gibs_modis_truecolor` | raster | NASA GIBS, time dimension |
| `gibs_viirs_truecolor` | raster | NASA GIBS VIIRS |
| `openfreemap_liberty` | vector | needs MapLibre; skip on Cesium/Leaflet-only |
| `eox_s2cloudless_2025` | raster | CC BY-NC-SA 4.0 — do not store tiles in repo |
| `cesium_world_terrain` | terrain | Cesium ion asset 1; needs `CESIUM_ION_TOKEN` |

Engines: primary CesiumJS (vendored), fallback 2D Leaflet (vendored). No CDN.

Optional probe: Cesium ion asset 3954 (Sentinel-2) — add only if HTTP 200 with our token.
