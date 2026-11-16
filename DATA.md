# DATA

Unified provider layer (server-side). Config: `config/apis.toml`. Secrets: `config/secrets.local.toml` (gitignored).

## Phenomenon kinds

fires · weather · optical · radar (+ stubs vessels/aviation/traffic)

## Spatial helpers (no browser calls)

| Kind | Order / strategy | Adapters |
|---|---|---|
| elevation | open_meteo_elevation → opentopodata_srtm30m; first non-null per point; disagree > 30 m flagged | Copernicus GLO-90, SRTM30m |
| geocode search | photon → open_meteo_geocode → nominatim; first non-empty; dedupe < 500 m | Photon, Open-Meteo, Nominatim |
| geocode reverse | photon → nominatim | Photon, Nominatim |

Shared: `rate_limit.py`, `request_cache.py`. Resolve entrypoints: `termalwave.providers.resolve`.

## Basemaps (frontend config → app-config.json)

GIBS MODIS/VIIRS · OpenFreeMap Liberty · EOX s2cloudless 2025 · Cesium World Terrain (ion asset 1).

Google Maps is **not** required — see `docs/api/REJECTED.md`.

## Fixtures

`tests/fixtures/providers/<id>/sample.json` recorded at Termas de Río Hondo (-27.4959, -64.8641) / query "Termas de Rio Hondo".
