# TermalWave

NISAR-oriented overlay pipeline for the site defined in the default TOML (`paths.default_config` in [`config/runtime.json`](config/runtime.json)). Process HDF5 granules into georeferenced PNG overlays and view them in a static map UI.

**Requires the Python minor pinned in [`config/runtime.json`](config/runtime.json).** Runtime libraries are vendored under `vendor/python/` for the platforms listed there. No macOS builds.

Site-specific values (AOI, paths, colormap, map UI) live in the site TOML (default [`config/santiago.toml`](config/santiago.toml) — Santiago del Estero). Point `paths.default_config` or `--config` at another TOML to use any region.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for platform tags, bootstrap behavior, and data policy.

## Case 1 — Run on the VPS (development)

On this networked machine you may use package managers to rebuild vendors and the web UI. Use a Python interpreter matching `config/runtime.json`.

```bash
# Optional: regenerate the synthetic fixture from the site TOML
python3 scripts/make_fixture.py

# Process (uses fixture or files under paths.raw_dir)
python3 -m termalwave run --offline

# View the committed (or freshly built) site
python3 -m http.server --directory web/dist
```

Web source rebuild (VPS only):

```bash
cd web && npm ci && npm run build
# Re-run the pipeline afterward so web/dist overlays + app-config.json stay in sync
python3 -m termalwave run --offline
```

## Case 2 — Run on another PC offline

Copy the repo to a machine that has **only** the Python minor from `config/runtime.json` (no pip/conda/npm/internet required).

```bash
# View results
python -m http.server --directory web/dist
# open http://127.0.0.1:8000/  (offline query flag name is in the site TOML [web] section)

# Reprocess from already-downloaded / fixture data
python -m termalwave run --offline
```

Prove isolation:

```bash
# Linux / Alpine
bash scripts/check_portable.sh

# Windows (PowerShell)
.\scripts\check_portable.ps1
```

Supported offline targets are exactly the `platforms` entries in `config/runtime.json`.

## Case 3 — Rebuild the vendor folder

Only on a networked machine (this VPS):

```bash
bash scripts/vendor.sh
```

This reads `config/runtime.json`, downloads the pinned official binary wheels for each platform entry, extracts them into `vendor/python/<tag>/`, and refreshes `vendor/MANIFEST.md` + `vendor/manifest.json`. License bundling is skipped for the hackathon.

Then rebuild the web bundle if UI dependencies changed:

```bash
cd web && npm ci && npm run build
python3 -m termalwave run --offline
```

## Quick CLI

```bash
python3 -m termalwave info
python3 -m termalwave run --offline --verify-vendor
```

## Data policy

| Path | Committed? |
|---|---|
| `data/raw/*.h5` | No — raw NISAR downloads stay local |
| Fixture HDF5 under `paths.fixture_h5` | Yes — tiny synthetic granule |
| `data/processed/*` | Yes — small PNG + JSON outputs |
| `web/dist/` | Yes — production static site |
| `vendor/python/` | Yes — extracted wheels per platform |
