"""Synthetic multi-year / multi-layer timeline frames (stdlib + numpy/Pillow)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


def _layer_field(
    layer_id: str,
    year: int,
    height: int,
    width: int,
    years: list[int],
) -> np.ndarray:
    """Build a synthetic field that visibly drifts with year and layer."""
    yy, xx = np.mgrid[0:height, 0:width]
    t = years.index(year) / max(len(years) - 1, 1)
    cx = width * (0.35 + 0.35 * t)
    cy = height * (0.40 + 0.20 * (1.0 - t))

    if layer_id == "radar":
        field = np.exp(-(((xx - cx) / 45) ** 2 + ((yy - cy) / 30) ** 2))
        field += 0.25 * np.sin((xx + year) / 9.0) * np.cos(yy / 7.0)
    elif layer_id == "suelo":
        field = 0.55 + 0.35 * np.sin((xx / 18.0) + t * 3) * np.cos(yy / 22.0)
        field += 0.15 * (yy / height)
    elif layer_id == "contaminacion":
        plume = np.exp(-(((xx - (width * 0.7)) / (25 + 20 * t)) ** 2 + ((yy - cy) / 40) ** 2))
        field = 0.2 + 0.8 * plume
    elif layer_id == "incendios":
        seed = year * 17 + sum(ord(c) * (i + 1) for i, c in enumerate(layer_id))
        rng = np.random.default_rng(seed)
        sparks = rng.random((height, width))
        mask = sparks > (0.92 - 0.08 * t)
        field = mask.astype(np.float64)
        field = (
            np.pad(field, 2, mode="edge")[2:-2, 2:-2]
            + np.pad(field, 2, mode="edge")[1:-3, 2:-2]
            + np.pad(field, 2, mode="edge")[2:-2, 1:-3]
        ) / 3.0
    else:
        field = np.sin(xx / 12.0 + t) * np.cos(yy / 14.0)
        field = (field - field.min()) / (field.max() - field.min() + 1e-9)

    field = np.nan_to_num(field, nan=0.0)
    lo, hi = float(field.min()), float(field.max())
    if hi > lo:
        field = (field - lo) / (hi - lo)
    return field.astype(np.float64)


def _to_rgba(field: np.ndarray, layer_id: str) -> np.ndarray:
    x = np.clip(field, 0.0, 1.0)
    if layer_id == "suelo":
        r, g, b = 0.45 + 0.4 * x, 0.35 + 0.5 * x, 0.15 + 0.2 * x
    elif layer_id == "contaminacion":
        r, g, b = 0.3 + 0.7 * x, 0.15 + 0.2 * (1 - x), 0.55 + 0.3 * x
    elif layer_id == "incendios":
        r, g, b = 0.2 + 0.8 * x, 0.05 + 0.35 * x, 0.02 * (1 - x)
    else:
        r = np.clip(1.5 * x - 0.2, 0, 1)
        g = np.clip(1.5 - np.abs(x - 0.5) * 2.5, 0, 1)
        b = np.clip(1.2 - 1.5 * x, 0, 1)
    alpha = np.where(x > 0.05, 200, 0).astype(np.uint8)
    return np.dstack(
        [
            (r * 255).astype(np.uint8),
            (g * 255).astype(np.uint8),
            (b * 255).astype(np.uint8),
            alpha,
        ]
    )


def build_timeline_frames(
    cfg: dict[str, Any],
    bounds: dict[str, float],
    repo_root: Path,
) -> dict[str, Any]:
    """Write PNG/JSON frames and return the timeline index for app-config."""
    timeline = cfg["timeline"]
    layers = cfg["layers"]
    years = [int(y) for y in timeline["years"]]
    height = int(timeline.get("frame_height", 160))
    width = int(timeline.get("frame_width", 200))

    processed = Path(cfg["paths"]["processed_dir"]) / "timeline"
    mirrors = [Path(p) / "timeline" for p in cfg["paths"].get("overlay_mirrors", [])]

    frames: dict[str, dict[str, Any]] = {}
    layer_meta = []

    for layer in layers:
        layer_id = str(layer["id"])
        layer_meta.append({"id": layer_id, "label": str(layer["label"])})
        frames[layer_id] = {}
        for year in years:
            field = _layer_field(layer_id, year, height, width, years)
            rgba = _to_rgba(field, layer_id)
            rel_png = f"{layer_id}/{year}.png"
            rel_json = f"{layer_id}/{year}.json"
            out_dir = processed / layer_id
            out_dir.mkdir(parents=True, exist_ok=True)
            png_path = processed / rel_png
            json_path = processed / rel_json
            Image.fromarray(rgba, mode="RGBA").save(png_path)
            sidecar = {
                "type": "termalwave_timeline_frame",
                "layer": layer_id,
                "year": year,
                "png": f"{year}.png",
                "bounds": bounds,
                "width": width,
                "height": height,
            }
            payload = json.dumps(sidecar, indent=2) + "\n"
            json_path.write_text(payload, encoding="utf-8")
            for mirror in mirrors:
                dest = mirror / layer_id
                dest.mkdir(parents=True, exist_ok=True)
                Image.fromarray(rgba, mode="RGBA").save(dest / f"{year}.png")
                (dest / f"{year}.json").write_text(payload, encoding="utf-8")
            frames[layer_id][str(year)] = {
                "png": f"./overlays/timeline/{rel_png}",
                "bounds": bounds,
            }

    return {
        "years": years,
        "default_year": int(timeline["default_year"]),
        "default_layer": str(timeline["default_layer"]),
        "layers": layer_meta,
        "frames": frames,
    }
