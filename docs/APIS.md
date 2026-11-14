# TermalWave — APIs y proveedores

Catalogo de servicios externos. **Sin secretos.** Las claves viven en `config/secrets.local.toml` (gitignored) o env vars con el mismo nombre.

Arquitectura: **un Protocol por tipo de dato** (`fires`, `weather`, `optical`, `radar`, …). Varios adapters del mismo kind se listan en `config/apis.toml` (`order` + `strategy`). El merge elige o une segun estrategia; la granulidad sale de lo que cada fuente pueda dar (dia, pasada, escena).

Registro vivo: `config/apis.toml`. Codigo: `termalwave/providers/`.

---

## Como se conectan

```text
apis.toml [kind].order  →  adapters  →  merge.py  →  ingest/*.json + provenance
                                                      ↓
                                            app-config.json / dataset.json
                                                      ↓
                                                   web UI
```

Credencial faltante → adapter skip (log), no crash.

---

## Kind: fires (focos termicos)

| Id | Servicio | Credential | Notas |
|---|---|---|---|
| `firms_viirs_sp` | NASA FIRMS VIIRS SNPP SP | `FIRMS_MAP_KEY` | Preferido (quality_rank bajo) |
| `firms_viirs_nrt` | NASA FIRMS VIIRS NRT | `FIRMS_MAP_KEY` | Rapido, menos estable |
| `firms_modis` | NASA FIRMS MODIS SP | `FIRMS_MAP_KEY` | Fallback |

Strategy: `union_dedupe` (distancia + tiempo).

Area CSV: `day_range` maximo 5 (API FIRMS). El adapter lo recorta solo.

Docs: https://firms.modaps.eosdis.nasa.gov/api/

---

## Kind: weather (clima diario)

| Id | Servicio | Credential | Notas |
|---|---|---|---|
| `open_meteo_archive` | Open-Meteo Archive | (ninguna) | Primera opcion; chunk ~1 anio |
| `meteomatics` | Meteomatics | `METEOMATICS_USER` + `METEOMATICS_PASSWORD` | Si hay cuenta |

Strategy: `first_available`.

---

## Kind: optical (imagen optica)

| Id | Servicio | Credential | Notas |
|---|---|---|---|
| `planetary_computer_s2` | Microsoft Planetary Computer / Sentinel-2 STAC | `PLANETARY_COMPUTER_TOKEN` (opcional) | Least cloudy near NISAR |

Strategy: `least_cloudy_near_nisar`.

---

## Kind: radar (SAR / NISAR)

| Id | Servicio | Credential | Notas |
|---|---|---|---|
| `earthdata_nisar_gcov` | NASA Earthdata CMR | `EARTHDATA_TOKEN` | GCOV L2 |

Strategy: `prefer_validated`.

---

## Kind: vessels (trafico maritimo) — pendiente adapter

| Id | Servicio | Credential | Uso previsto |
|---|---|---|---|
| `aisstream` | AISStream WebSocket/API | `AISSTREAM_API_KEY` | Embarcaciones cerca del AOI; eventos en timeline |

Strategy prevista: `union_dedupe` por mmsi + ventana temporal.

Docs: https://aisstream.io/

---

## Kind: aviation (trafico aereo) — pendiente adapter

| Id | Servicio | Credential | Uso previsto |
|---|---|---|---|
| `opensky` | OpenSky Network | `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` | Sobrevoltos / densidad sobre AOI |

Strategy prevista: `first_available`.

Docs: https://openskynetwork.github.io/opensky-api/

---

## Kind: traffic (caminos / movilidad) — pendiente adapter

| Id | Servicio | Credential | Uso previsto |
|---|---|---|---|
| `tomtom_traffic` | TomTom Traffic / Map Display | `TOMTOM_API_KEY` | Contexto vial cerca del AOI |

Docs: https://developer.tomtom.com/

---

## Kind: elevation / geocode (server-side)

| Id | Servicio | Credential | Uso |
|---|---|---|---|
| `open_meteo_elevation` | Open-Meteo elevation | — | DEM Copernicus GLO-90 |
| `opentopodata_srtm30m` | OpenTopoData | — | SRTM 30 m |
| `photon` | Photon/Komoot | — | search + reverse |
| `open_meteo_geocode` | Open-Meteo geocoding | — | search only |
| `nominatim` | OSM Nominatim | User-Agent in config | search + reverse |

Ver `docs/api/*.md`. Google Maps: **rechazado** (`docs/api/REJECTED.md`).

## Kind: basemap (frontend config → app-config)

GIBS MODIS/VIIRS · OpenFreeMap · EOX s2cloudless · Cesium World Terrain (`CESIUM_ION_TOKEN`). Detalle: `docs/api/basemaps.md`.

---

## Env / secrets checklist

| Variable | Kind / uso |
|---|---|
| `EARTHDATA_TOKEN` | radar |
| `FIRMS_MAP_KEY` | fires |
| `METEOMATICS_USER` / `METEOMATICS_PASSWORD` | weather |
| `PLANETARY_COMPUTER_TOKEN` | optical |
| `AISSTREAM_API_KEY` | vessels |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | aviation |
| `TOMTOM_API_KEY` | traffic |
| `GOOGLE_MAPS_*` | **disabled** — see docs/api/REJECTED.md |
| `CESIUM_ION_TOKEN` | terrain / 3D |

Nunca pegar valores en `comms/`, UI, board ni este archivo.

---

## Agregar una API nueva

1. Adapter en `termalwave/providers/<kind>/<id>.py` con `build(**kwargs)` + `fetch`.
2. Linea en `apis.toml` (`order` + `[providers.<id>]`).
3. Fixture offline en `tests/fixtures/providers/<id>/`.
4. Credential en `secrets.local.toml` / env (opcional si la API es publica).
