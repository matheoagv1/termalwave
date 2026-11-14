# TermalWave architecture

## Purpose

TermalWave turns NISAR HDF5 granules into georeferenced PNG overlays and shows them in a static map UI with a multi-year timeline. The default study area is **Santiago del Estero**; any place on Earth works by swapping the site TOML. The project is designed to run on a clean machine that has **only Python 3.11** installed — no pip, conda, npm, or internet required for reprocessing or viewing (online basemap tiles and live APIs are optional).

## Supported platforms

All platform tags, Python pin, and wheel package pins live in [`config/runtime.json`](../config/runtime.json). Site AOI, HDF5 paths, colormap, fixture, and web UI values live in [`config/santiago.toml`](../config/santiago.toml) (or another site TOML pointed at by `paths.default_config` / `--config`). Application code does not embed those literals.

| Vendor tag | OS / libc | Arch |
|---|---|---|
| `linux_x86_64-cp311` | Linux (glibc / manylinux) | x86_64 |
| `linux_musl_x86_64-cp311` | Alpine Linux (musl) | x86_64 |
| `win_amd64-cp311` | Windows | x64 |

**No macOS builds.**

`termalwave/_bootstrap.py` prepends `vendor/python/<tag>/` to `sys.path` before numpy / h5py / Pillow are imported.

## Vendored Python libraries

Runtime set (minimal): numpy, h5py, Pillow. **No GDAL.** HTTP for providers uses the standard library (`urllib`).

Rebuild vendors on a networked VPS only: `bash scripts/vendor.sh`.

## Processing pipeline

```text
config/santiago.toml + config/apis.toml
        │
        ▼
termalwave run [--offline]
        │
        ├─ resolve HDF5 (data/raw → data/fixtures)
        ├─ read amplitude via h5py → PNG + JSON overlay
        ├─ synthetic/real timeline frames
        ├─ ingest providers (fires/weather/optical/radar)
        │     merge → data/processed/ingest/*.json
        │     stats → data/processed/stats.json
        │     cache → data/cache/<kind>.json
        └─ write web/public|dist/app-config.json
              (timeline + provenance/data_sources)
```

Raw NISAR `.h5` downloads are **not** committed (`data/raw/`, `*.h5` gitignored except `data/fixtures/`).

## Unified data providers

One interface per kind (`FireHotspots`, `Weather`, `OpticalScene`, `RadarScene` in `termalwave/providers/base.py`). Shared records in `termalwave/model.py`.

- Adapters live under `termalwave/providers/<kind>/<api>.py` and only map raw API/fixture payloads → dataclasses.
- Order and strategy come **only** from [`config/apis.toml`](../config/apis.toml) via `termalwave/providers/registry.py`.
- Merge policies are pure functions in `termalwave/merge.py`.
- Secrets: [`config/secrets.local.toml`](../config/secrets.local.toml.example) (gitignored) or env vars. Missing credentials → provider skipped (log), never crash.
- `--offline` uses `tests/fixtures/providers/`. All providers down → `data/cache/`; else layer `unavailable` in `stats.json` / provenance.

### Adding a new API (zero changes elsewhere)

1. Create `termalwave/providers/<kind>/<new_api>.py` with a `build(**kwargs)` factory and a `fetch(...)` method matching the kind Protocol.
2. Add one id to the kind `order` list in `config/apis.toml` and a `[providers.<id>]` table (`module`, `credential`, `product`, `license`).
3. Drop an offline fixture under `tests/fixtures/providers/<id>/`.

No edits to `pipeline.py`, `ingest.py`, or the web app are required for registration.

## Web UI

- Source: `web/` (Vite + TypeScript + **MapLibre GL**)
- Production build: `web/dist` (**committed**)
- Timeline Timelapse + layer picker + **Fuentes de datos** panel reading `provenance` from `app-config.json`
- Brand assets: `brand/`
- Offline: background + local PNG timeline frames (`?offline=1`)

```bash
python -m http.server --directory web/dist
```

## Agent coordination

See [`comms/README.md`](../comms/README.md): `STEERS.md`, `board.toml`, `scripts/comms.py`, Cursor hooks.

## Portability proof

`scripts/check_portable.sh` / `scripts/check_portable.ps1` run tests with `PYTHONNOUSERSITE=1` and empty `PYTHONPATH`.
