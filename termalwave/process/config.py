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


def write_web_app_config(cfg: dict[str, Any], repo_root: Path) -> list[Path]:
    """Emit JSON consumed by the static web UI (no hardcoded UI values in TS)."""
    project = cfg.get("project", {})
    aoi = cfg.get("aoi", {})
    product = cfg.get("product", {})
    web = cfg.get("web", {})
    paths = cfg.get("paths", {})

    if not web:
        raise KeyError("Config missing required [web] section")

    payload = {
        "project": project,
        "aoi": aoi,
        "product": {
            "output_stem": product["output_stem"],
            "sidecar_type": product.get("sidecar_type", "termalwave_overlay"),
        },
        "web": web,
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
