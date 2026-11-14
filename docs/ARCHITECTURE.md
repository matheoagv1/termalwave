# TermalWave architecture

## Purpose

TermalWave turns NISAR HDF5 granules into georeferenced PNG overlays and shows them in a static map UI. The default study area is **Santiago del Estero**; any place on Earth works by swapping the site TOML. The project is designed to run on a clean machine that has **only Python 3.11** installed — no pip, conda, npm, or internet required for reprocessing or viewing (GIBS basemap tiles are optional).

## Supported platforms

All platform tags, Python pin, and wheel package pins live in [`config/runtime.json`](../config/runtime.json). Site AOI, HDF5 paths, colormap, fixture, and web UI values live in [`config/santiago.toml`](../config/santiago.toml) (or another site TOML pointed at by `paths.default_config` / `--config`). Application code does not embed those literals.

Current runtime (see the JSON for the source of truth):

| Vendor tag | OS / libc | Arch |
|---|---|---|
| `linux_x86_64-cp311` | Linux (glibc / manylinux) | x86_64 |
| `linux_musl_x86_64-cp311` | Alpine Linux (musl) | x86_64 |
| `win_amd64-cp311` | Windows | x64 |

**No macOS builds** — the team does not have Macs.

`termalwave/_bootstrap.py` reads `config/runtime.json`, detects the platform with the standard library (`sys`, `platform`, musl probes from config), and prepends `vendor/python/<tag>/` to `sys.path` before numpy / h5py / Pillow are imported. Missing tags or the wrong Python minor version fail with a message that lists the supported tags.

## Vendored Python libraries

Runtime set (minimal):

- numpy
- h5py
- Pillow

Plus whatever transitive files those official wheels ship. **GDAL and rasterio are intentionally not vendored.** Georeferencing uses HDF5 metadata (geotransform attributes and/or latitude/longitude grids) with numpy and the standard library.

Artifacts:

- `vendor/python/<tag>/` — extracted wheels
- `vendor/MANIFEST.md` — human-readable package / version / SHA256 table
- `vendor/manifest.json` — machine-readable hashes verified by bootstrap (`--verify-vendor`) and tests

Hackathon note: third-party license files are not collected or tracked yet.

Rebuild on a networked VPS only: `bash scripts/vendor.sh`.

## Processing pipeline

```text
config/santiago.toml
        │
        ▼
termalwave run [--offline]
        │
        ├─ resolve HDF5 (data/raw → data/fixtures)
        ├─ read amplitude via h5py
        ├─ bounds from geotransform / lat-lon / AOI
        └─ write PNG + JSON sidecar
                ├─ data/processed/
                ├─ web/public/overlays/  (source for Vite)
                └─ web/dist/overlays/    (served offline without rebuild)
```

Raw NISAR `.h5` downloads are **not** committed (`data/raw/`, `*.h5` gitignored except the small fixture under `data/fixtures/`).

## Web UI

- Source: `web/` (Vite + TypeScript + Leaflet)
- Production build: `web/dist` (**committed**)
- All JS/CSS/fonts/map icons are bundled locally — no CDN
- UI settings are emitted to `web/public/app-config.json` (and `web/dist/app-config.json`) from the site TOML `[web]` / `[project]` sections when the pipeline runs
- Online / offline basemap behavior, overlay path, zooms, and chrome text come from that JSON (no hardcoded site values in TypeScript)
- Offline: plain background grid + processed PNG image overlay (query flag / tile failures / `navigator.onLine === false` — flag name from config)

Serve with the standard library only:

```bash
python -m http.server --directory web/dist
```

## Portability proof

`scripts/check_portable.sh` (Linux/Alpine) and `scripts/check_portable.ps1` (Windows) run unit + smoke tests with:

- `PYTHONNOUSERSITE=1`
- empty `PYTHONPATH`

Tests assert that numpy / h5py / Pillow `__file__` paths live under `vendor/python/<tag>/`.
