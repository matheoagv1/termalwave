"""Load TermalWave TOML configuration (stdlib tomllib)."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path
from typing import Any


def load_config(path: Path, repo_root: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Config not found: {path}")

    with path.open("rb") as fh:
        data = tomllib.load(fh)

    def resolve(p: str | Path) -> Path:
        candidate = Path(p)
        if not candidate.is_absolute():
            candidate = (repo_root / candidate).resolve()
        return candidate

    data.setdefault("paths", {})
    paths = data["paths"]
    for key in (
        "raw_dir",
        "processed_dir",
        "fixture_dir",
        "input_h5",
        "fixture_h5",
        "web_config_out",
        "web_dist_config_out",
    ):
        if key in paths and paths[key]:
            paths[key] = str(resolve(paths[key]))

    if "overlay_mirrors" in paths:
        paths["overlay_mirrors"] = [str(resolve(p)) for p in paths["overlay_mirrors"]]

    return data


def write_web_app_config(
    cfg: dict[str, Any],
    repo_root: Path,
    timeline: dict[str, Any] | None = None,
    provenance: dict[str, Any] | None = None,
    apis: dict[str, Any] | None = None,
) -> list[Path]:
    """Emit JSON consumed by the static web UI (no hardcoded UI values in TS)."""
    project = cfg.get("project", {})
    aoi = cfg.get("aoi", {})
    product = cfg.get("product", {})
    web = cfg.get("web", {})
    paths = cfg.get("paths", {})

    if not web:
        raise KeyError("Config missing required [web] section")

    payload: dict[str, Any] = {
        "project": project,
        "aoi": aoi,
        "product": {
            "output_stem": product["output_stem"],
            "sidecar_type": product.get("sidecar_type", "termalwave_overlay"),
        },
        "web": web,
    }
    if timeline is not None:
        payload["timeline"] = timeline
    elif "timeline" in cfg and "layers" in cfg:
        # Minimal stub when frames were not generated in this pass.
        payload["timeline"] = {
            "years": [int(y) for y in cfg["timeline"]["years"]],
            "default_year": int(cfg["timeline"]["default_year"]),
            "default_layer": str(cfg["timeline"]["default_layer"]),
            "layers": [
                {"id": str(layer["id"]), "label": str(layer["label"])}
                for layer in cfg["layers"]
            ],
            "frames": {},
        }
    if provenance is not None:
        payload["provenance"] = provenance
        # Friendly alias for the web "Data sources" panel.
        payload["data_sources"] = provenance.get("layers", {})

    if apis is None:
        from termalwave.providers.registry import load_apis_config

        apis = load_apis_config(repo_root)
    from termalwave.merge import basemap_attributions
    from termalwave.providers.registry import basemap_defs

    basemaps_section = apis.get("basemaps") or {}
    if basemaps_section:
        payload["basemaps"] = {
            "default": basemaps_section.get("default"),
            "engine_primary": basemaps_section.get("engine_primary"),
            "engine_fallback_2d": basemaps_section.get("engine_fallback_2d"),
            "entries": basemap_defs(apis),
            "credits": basemap_attributions(apis),
        }
    scene = apis.get("scene") or {}
    payload["scene"] = {
        "google_maps_enabled": bool(scene.get("google_maps_enabled", False)),
        "cesium_ion_credential": scene.get("cesium_ion_credential"),
        "cesium_ion_asset_world_terrain": basemaps_section.get(
            "cesium_ion_asset_world_terrain"
        ),
    }

    written: list[Path] = []
    for key in ("web_config_out", "web_dist_config_out"):
        raw = paths.get(key)
        if not raw:
            continue
        out = Path(raw)
        if not out.is_absolute():
            out = (repo_root / out).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        written.append(out)
    return written
