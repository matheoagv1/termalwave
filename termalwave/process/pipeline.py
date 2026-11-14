"""NISAR HDF5 → georeferenced PNG overlay pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Sequence

import h5py
import numpy as np
from PIL import Image

from termalwave.process.config import load_config, write_web_app_config
from termalwave.process.georef import (
    bounds_from_attrs,
    bounds_from_geotransform,
    bounds_from_latlon_grids,
    read_geotransform,
)
from termalwave.process.ingest import run_ingest
from termalwave.process.timeline import build_timeline_frames


def _find_dataset(
    group: h5py.Group,
    candidates: Sequence[str],
    name_hints: Sequence[str],
) -> h5py.Dataset | None:
    for name in candidates:
        if name in group:
            obj = group[name]
            if isinstance(obj, h5py.Dataset):
                return obj
        if name.startswith("/"):
            if name in group.file:
                obj = group.file[name]
                if isinstance(obj, h5py.Dataset):
                    return obj
    hints = {h.lower() for h in name_hints}
    for key, obj in group.items():
        if isinstance(obj, h5py.Dataset) and key.lower() in hints:
            return obj
        if isinstance(obj, h5py.Group):
            found = _find_dataset(obj, candidates, name_hints)
            if found is not None:
                return found
    return None


def _normalize_to_uint8(arr: np.ndarray, colormap: dict[str, Any]) -> np.ndarray:
    data = np.asarray(arr, dtype=np.float64)
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)
    finite = data[np.isfinite(data)]
    if finite.size == 0:
        return np.zeros((*data.shape, 4), dtype=np.uint8)

    lo_p = float(colormap["percentile_low"])
    hi_p = float(colormap["percentile_high"])
    lo, hi = np.percentile(finite, (lo_p, hi_p))
    if hi <= lo:
        lo, hi = float(finite.min()), float(finite.max())
    if hi <= lo:
        return np.zeros((*data.shape, 4), dtype=np.uint8)

    scaled = np.clip((data - lo) / (hi - lo), 0.0, 1.0)
    r = np.clip(
        float(colormap["r_scale"]) * scaled + float(colormap["r_offset"]), 0, 1
    )
    g = np.clip(
        float(colormap["g_peak"])
        - np.abs(scaled - float(colormap["g_center"])) * float(colormap["g_width"]),
        0,
        1,
    )
    b = np.clip(
        float(colormap["b_scale"]) * scaled + float(colormap["b_offset"]), 0, 1
    )
    alpha = int(colormap["alpha_positive"])
    return np.dstack(
        [
            (r * 255).astype(np.uint8),
            (g * 255).astype(np.uint8),
            (b * 255).astype(np.uint8),
            np.where(data > 0, alpha, 0).astype(np.uint8),
        ]
    )


def _resolve_input(cfg: dict[str, Any], offline: bool) -> Path:
    paths = cfg["paths"]
    for key in ("input_h5", "fixture_h5"):
        explicit = paths.get(key)
        if explicit:
            candidate = Path(explicit)
            if candidate.is_file():
                return candidate

    raw_dir = Path(paths["raw_dir"])
    if raw_dir.is_dir():
        h5_files = sorted(raw_dir.glob("*.h5"))
        if h5_files:
            return h5_files[0]

    fixture_dir = Path(paths["fixture_dir"])
    if fixture_dir.is_dir():
        h5_files = sorted(fixture_dir.glob("*.h5"))
        if h5_files:
            return h5_files[0]

    mode = "Offline mode" if offline else "No HDF5 input found"
    raise FileNotFoundError(
        f"{mode}: configure paths.input_h5 / paths.fixture_h5 or place a "
        f"granule under {paths.get('raw_dir')} or {paths.get('fixture_dir')}."
    )


def extract_raster_and_bounds(
    h5_path: Path,
    hdf5_cfg: dict[str, Any],
) -> tuple[np.ndarray, dict[str, float] | None]:
    raster_candidates = tuple(hdf5_cfg["raster_candidates"])
    name_hints = tuple(hdf5_cfg["raster_name_hints"])
    lat_candidates = tuple(hdf5_cfg["latitude_candidates"])
    lon_candidates = tuple(hdf5_cfg["longitude_candidates"])
    gt_keys = tuple(hdf5_cfg["geotransform_attr_keys"])
    bounds_keys = tuple(hdf5_cfg["bounds_attr_keys"])

    with h5py.File(h5_path, "r") as handle:
        dataset = _find_dataset(handle, raster_candidates, name_hints)
        if dataset is None:
            raise ValueError(f"No raster dataset found in {h5_path}")

        raster = np.asarray(dataset[...])
        if raster.ndim > 2:
            raster = raster[0]

        bounds: dict[str, float] | None = None
        gt = read_geotransform(dataset.attrs, gt_keys) or read_geotransform(
            handle.attrs, gt_keys
        )
        if gt is not None:
            height, width = raster.shape[-2], raster.shape[-1]
            bounds = bounds_from_geotransform(gt, width, height)
        else:
            lat_ds = _find_dataset(handle, lat_candidates, ())
            lon_ds = _find_dataset(handle, lon_candidates, ())
            if lat_ds is not None and lon_ds is not None:
                bounds = bounds_from_latlon_grids(
                    np.asarray(lat_ds[...]),
                    np.asarray(lon_ds[...]),
                )

        if bounds is None:
            bounds = bounds_from_attrs(handle.attrs, bounds_keys)

    return raster, bounds


def write_overlay(
    raster: np.ndarray,
    bounds: dict[str, float],
    out_png: Path,
    out_json: Path,
    source: Path,
    product: dict[str, Any],
    colormap: dict[str, Any],
    mirror_dirs: list[Path] | None = None,
) -> None:
    out_png.parent.mkdir(parents=True, exist_ok=True)
    rgba = _normalize_to_uint8(raster, colormap)
    Image.fromarray(rgba, mode="RGBA").save(out_png)

    sidecar = {
        "type": product["sidecar_type"],
        "source": str(source.name),
        "png": out_png.name,
        "bounds": bounds,
        "width": int(rgba.shape[1]),
        "height": int(rgba.shape[0]),
    }
    payload = json.dumps(sidecar, indent=2) + "\n"
    out_json.write_text(payload, encoding="utf-8")

    for mirror in mirror_dirs or []:
        mirror.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, mode="RGBA").save(mirror / out_png.name)
        (mirror / out_json.name).write_text(payload, encoding="utf-8")


def run_pipeline(
    config_path: Path,
    offline: bool,
    repo_root: Path,
) -> dict[str, str]:
    cfg = load_config(config_path, repo_root)
    for section in (
        "paths",
        "hdf5",
        "product",
        "colormap",
        "aoi",
        "web",
        "timeline",
        "layers",
    ):
        if section not in cfg:
            raise KeyError(f"Config missing required [{section}] section")

    h5_path = _resolve_input(cfg, offline=offline)
    raster, bounds = extract_raster_and_bounds(h5_path, cfg["hdf5"])

    aoi = cfg["aoi"]
    required_aoi = ("west", "east", "south", "north")
    if all(k in aoi for k in required_aoi):
        bounds = {k: float(aoi[k]) for k in required_aoi}
    elif bounds is None:
        raise ValueError(
            "No georeferencing found in HDF5 and [aoi] bounds are incomplete in config."
        )

    processed_dir = Path(cfg["paths"]["processed_dir"])
    stem = cfg["product"]["output_stem"]
    out_png = processed_dir / f"{stem}.png"
    out_json = processed_dir / f"{stem}.json"
    mirrors = [Path(p) for p in cfg["paths"].get("overlay_mirrors", [])]

    write_overlay(
        raster,
        bounds,
        out_png,
        out_json,
        h5_path,
        product=cfg["product"],
        colormap=cfg["colormap"],
        mirror_dirs=mirrors,
    )
    timeline_index = build_timeline_frames(cfg, bounds, repo_root)
    ingest = run_ingest(cfg, repo_root=repo_root, offline=offline)
    write_web_app_config(
        cfg,
        repo_root,
        timeline=timeline_index,
        provenance=ingest["provenance"],
    )
    return {
        "png": str(out_png),
        "sidecar": str(out_json),
        "source": str(h5_path),
        "timeline_layers": str(len(timeline_index["layers"])),
        "timeline_years": str(len(timeline_index["years"])),
        "stats": ingest["stats_path"],
    }
