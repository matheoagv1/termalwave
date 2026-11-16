# HANDOFF

## VPS → carne

Basemap list + credits now ship in `app-config.json` (`basemaps.default`, `basemaps.entries`, `basemaps.credits`). `scene.google_maps_enabled` is false.

Wire selector to GIBS (date from NISAR case dates), OpenFreeMap (MapLibre only), EOX, Cesium terrain. Keep attribution always visible. Engines: Cesium primary (vendored + `CESIUM_ION_TOKEN`), Leaflet 2D fallback (vendored). No CDN. Do not store EOX tiles in repo.

Elevation/geocode stay server-side (`termalwave.providers.resolve`) — never call from the browser.

## Docs

- Per provider: `docs/api/<name>.md`
- Rejected Google: `docs/api/REJECTED.md`
- Overview: `DATA.md`, `STATUS.md`
