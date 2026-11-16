# REJECTED providers

## Google Maps Platform

**Status:** rejected as a required dependency.

**Reason:** Elevation, Geocoding, and Map Tiles require a billing account. Without billing, calls return `REQUEST_DENIED` / inactive. The app must run with zero Google keys.

**Replaced by:**

| Former use | Free replacement |
|---|---|
| Elevation | Open-Meteo elevation, OpenTopoData SRTM30m |
| Geocoding / reverse | Photon, Open-Meteo geocode, Nominatim |
| Basemap tiles | NASA GIBS, OpenFreeMap, EOX s2cloudless, Cesium ion World Terrain |

Google credential env names may remain in `config/apis.toml` under `[scene]` with `google_maps_enabled = false` for optional local experiments only. They are never required for ingest, merge, or the static UI.
