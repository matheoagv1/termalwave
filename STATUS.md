# STATUS

## Done (T034)

- Protocols + dataclasses: Elevation, Geocoder, BasemapDef
- Adapters: open_meteo/opentopodata elevation; photon/nominatim/open_meteo geocode
- Shared rate limiter + on-disk request cache
- `config/apis.toml` elevation/geocode/basemaps; Google `enabled=false`
- Merge: elevation first-available + disagree; geocode first-nonempty + 500 m dedupe
- Resolve helpers + offline fixtures/tests
- Docs under `docs/api/`; app-config emits `basemaps` + `scene.google_maps_enabled=false`

## Pending (UI / carne)

- CesiumJS (vendored) + Leaflet fallback wired to `basemaps` in app-config
- Attribution control + Credits section from `basemaps.credits`
- Optional Cesium ion asset 3954 probe
- MapLibre already in tree — OpenFreeMap vector only if MapLibre path kept

## Runtime

App runs with zero Google keys. Cesium ion token optional for World Terrain only.
