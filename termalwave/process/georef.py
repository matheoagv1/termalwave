"""Georeferencing helpers using HDF5 metadata and numpy (no GDAL)."""

from __future__ import annotations

from typing import Any, Sequence

import numpy as np


def bounds_from_geotransform(
    geotransform: tuple[float, float, float, float, float, float],
    width: int,
    height: int,
) -> dict[str, float]:
    """Convert a GDAL-style 6-tuple geotransform to WGS84-ish bounds dict.

    geotransform = (origin_x, pixel_width, 0, origin_y, 0, pixel_height)
    pixel_height is typically negative when origin is the NW corner.
    """
    origin_x, pixel_w, _, origin_y, _, pixel_h = geotransform
    west = float(origin_x)
    north = float(origin_y)
    east = float(origin_x + pixel_w * width)
    south = float(origin_y + pixel_h * height)
    return {
        "west": min(west, east),
        "east": max(west, east),
        "south": min(south, north),
        "north": max(south, north),
    }


def bounds_from_latlon_grids(
    lat: np.ndarray,
    lon: np.ndarray,
) -> dict[str, float]:
    """Compute bounding box from 2D latitude/longitude arrays."""
    return {
        "west": float(np.nanmin(lon)),
        "east": float(np.nanmax(lon)),
        "south": float(np.nanmin(lat)),
        "north": float(np.nanmax(lat)),
    }


def read_geotransform(
    attrs: Any,
    attr_keys: Sequence[str],
) -> tuple[float, float, float, float, float, float] | None:
    """Parse a geotransform attribute from an h5py attrs mapping."""
    raw = None
    for key in attr_keys:
        if key in attrs:
            raw = attrs[key]
            break
    if raw is None:
        return None
    values = np.asarray(raw, dtype=np.float64).ravel()
    if values.size != 6:
        raise ValueError(f"geotransform must have 6 values, got {values.size}")
    return tuple(float(v) for v in values)  # type: ignore[return-value]


def bounds_from_attrs(attrs: Any, keys: Sequence[str]) -> dict[str, float] | None:
    if not all(key in attrs for key in keys):
        return None
    return {key: float(attrs[key]) for key in keys}
