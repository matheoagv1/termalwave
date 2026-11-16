"""Load TermalWave TOML configuration (stdlib tomllib)."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path
from typing import Any

from termalwave.merge import basemap_attributions
from termalwave.providers.registry import (
    basemap_defs,
    load_apis_config,
    search_web_config,
    space_web_config,
)


_LAYER_TEXT = (
    "label",
    "label_en",
    "label_es",
    "what_en",
    "what_es",
    "decision_en",
    "decision_es",
    "nodata_en",
    "nodata_es",
    "caveats_en",
    "caveats_es",
    "unit",
    "product",
    "formula",
    "notes",
    "tier",
)


def load_layers_taxonomy(repo_root: Path) -> dict[str, Any]:
    """category/core/presets plus bilingual copy from config/layers.toml."""
    path = repo_root / "config" / "layers.toml"
    if not path.is_file():
        return {"policy": {}, "layers": [], "presets": []}
    with path.open("rb") as fh:
        raw = tomllib.load(fh)
    layers = []
    for row in raw.get("layers") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        item: dict[str, Any] = {
            "id": str(row["id"]),
            "category": str(row.get("category") or "data"),
            "core": bool(row.get("core", False)),
        }
        for key in _LAYER_TEXT:
            if key not in row or row[key] in (None, ""):
                continue
            item[key] = row[key]
        if "range" in row:
            item["range"] = [float(v) for v in row["range"]]
        if isinstance(row.get("ramp"), list) and row["ramp"]:
            item["ramp"] = [
                {"at": float(stop["at"]), "color": str(stop["color"])}
                for stop in row["ramp"]
                if isinstance(stop, dict) and "at" in stop and stop.get("color")
            ]
        item.setdefault("label", str(row.get("label") or row["id"]))
        layers.append(item)
    presets = []
    for row in raw.get("presets") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        enable = [str(x) for x in (row.get("enable") or []) if str(x).strip()]
        presets.append(
            {
                "id": str(row["id"]),
                "trade": str(row.get("trade") or row["id"]),
                "enable": enable,
            }
        )
    return {
        "policy": dict(raw.get("policy") or {}),
        "layers": layers,
        "presets": presets,
    }


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

    # site layers keep id/label; taxonomy overlays category/core/presets
    data["layers_taxonomy"] = load_layers_taxonomy(repo_root)
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
        apis = load_apis_config(repo_root)

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

    search = search_web_config(apis)
    if search:
        payload["search"] = search
    space = space_web_config(apis)
    if space:
        payload["space"] = space

    tax = cfg.get("layers_taxonomy") or {}
    # Enrich timeline.layers[] with category/core so UI doesn't need a join.
    tl = payload.get("timeline")
    if tl and isinstance(tl.get("layers"), list) and tax.get("layers"):
        tax_by_id = {r["id"]: r for r in tax["layers"] if r.get("id")}
        enriched_tl_layers = []
        for lrow in tl["layers"]:
            row = dict(lrow)
            meta = tax_by_id.get(row.get("id", "")) or {}
            if meta.get("category"):
                row["category"] = str(meta["category"])
            row["core"] = bool(meta.get("core", row.get("id") == "radar"))
            enriched_tl_layers.append(row)
        payload["timeline"] = dict(tl, layers=enriched_tl_layers)

    if tax.get("layers") or tax.get("presets"):
        payload["layers_taxonomy"] = {
            "policy": tax.get("policy") or {},
            "layers": tax.get("layers") or [],
            "presets": tax.get("presets") or [],
        }
        # flat presets for UI rubros: trade name -> layer ids (core always implied)
        payload["presets"] = {
            str(p["trade"]): [x for x in p.get("enable") or [] if x != "radar"]
            for p in (tax.get("presets") or [])
            if p.get("trade")
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
