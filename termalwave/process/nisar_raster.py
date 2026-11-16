"""Crop a NISAR GCOV or GUNW grid to an AOI and paint a fixed palette.

Georeference comes from the file (x/y axes and EPSG). The site box only
chooses which pixels to keep. Output bounds are the cropped grid, not the
TOML rectangle pasted over the image.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

import h5py
import numpy as np
from PIL import Image

from termalwave.science.constants import NISAR_L_WAVELENGTH_M
from termalwave.science.radar import power_to_db

HV_DB = (-30.0, -5.0)
HH_DB = (-25.0, 0.0)
CHANGE_DB = (-6.0, 6.0)
LOS_MM = (-50.0, 50.0)
RVI_RANGE = (0.0, 1.0)
COH_RANGE = (0.0, 1.0)
RADAR_STOPS = (
    (0.0, (12, 22, 34)),
    (0.35, (36, 71, 106)),
    (0.70, (111, 163, 196)),
    (1.0, (226, 241, 248)),
)
DIVERGE_STOPS = (
    (0.0, (20, 70, 160)),
    (0.5, (40, 44, 52)),
    (1.0, (230, 180, 40)),
)
RVI_STOPS = (
    (0.0, (40, 32, 24)),
    (1.0, (80, 170, 90)),
)
COH_STOPS = (
    (0.0, (20, 24, 32)),
    (1.0, (94, 235, 255)),
)


@dataclass
class GeoGrid:
    values: np.ndarray
    lon: np.ndarray
    lat: np.ndarray

    @property
    def bounds(self) -> dict[str, float]:
        return {
            "west": float(np.min(self.lon)),
            "east": float(np.max(self.lon)),
            "south": float(np.min(self.lat)),
            "north": float(np.max(self.lat)),
        }


def db_stats(db: np.ndarray) -> dict[str, float | int | None]:
    finite = np.asarray(db, dtype=np.float64)
    finite = finite[np.isfinite(finite)]
    if finite.size == 0:
        return {"count": 0, "mean": None, "median": None, "p10": None, "p90": None}
    return {
        "count": int(finite.size),
        "mean": float(np.mean(finite)),
        "median": float(np.median(finite)),
        "p10": float(np.percentile(finite, 10)),
        "p90": float(np.percentile(finite, 90)),
    }


def change_db(later: np.ndarray, earlier: np.ndarray) -> np.ndarray:
    """Δ dB = dB_t2 - dB_t1. A missing sample on either date stays empty."""
    a = np.asarray(later, dtype=np.float64)
    b = np.asarray(earlier, dtype=np.float64)
    if a.shape != b.shape:
        raise ValueError("change_db needs the same shape; resample first")
    out = a - b
    bad = ~np.isfinite(a) | ~np.isfinite(b)
    out = np.where(bad, np.nan, out)
    return out


def rvi_linear(hh: np.ndarray, hv: np.ndarray) -> np.ndarray:
    """4·HV/(HH+HV) on linear power. Not a measured soil product."""
    hh_a = np.asarray(hh, dtype=np.float64)
    hv_a = np.asarray(hv, dtype=np.float64)
    den = hh_a + hv_a
    out = np.full(hh_a.shape, np.nan, dtype=np.float64)
    ok = np.isfinite(hh_a) & np.isfinite(hv_a) & (hh_a >= 0) & (hv_a >= 0) & (den > 0)
    out[ok] = 4.0 * hv_a[ok] / den[ok]
    return out


def los_mm(delta_phase_rad: np.ndarray, wavelength_m: float = NISAR_L_WAVELENGTH_M) -> np.ndarray:
    """LOS in millimetres if delta_phase_rad is radians. d = -λ Δφ / 4π.

    Matches F17: positive displacement is motion toward the satellite.
    The unwrapped phase still has an arbitrary zero, so a large median
    is not ground motion.
    """
    phase = np.asarray(delta_phase_rad, dtype=np.float64)
    out = -float(wavelength_m) * phase / (4.0 * math.pi) * 1000.0
    return np.where(np.isfinite(phase), out, np.nan)


def los_publishable(mm: np.ndarray) -> bool:
    """Refuse a field whose level is metres and whose zero is unknown.

    The GUNW pair of 9 to 21 Oct 2026 converted to about 1655 mm with
    only ~160 mm of spread, then got painted on the ±6 dB change ramp.
    That picture is saturated and is not a validated displacement.
    """
    stats = db_stats(mm)
    median = stats["median"]
    p10 = stats["p10"]
    p90 = stats["p90"]
    if not isinstance(median, float) or not isinstance(p10, float) or not isinstance(p90, float):
        return False
    spread = p90 - p10
    if abs(median) > 50.0 and abs(median) > max(spread, 1.0) * 2.0:
        return False
    return True


def colorize(values: np.ndarray, lo: float, hi: float, stops: tuple[tuple[float, tuple[int, int, int]], ...]) -> np.ndarray:
    data = np.asarray(values, dtype=np.float64)
    span = hi - lo
    if span == 0:
        raise ValueError("palette needs a non-zero range")
    t = np.clip((data - lo) / span, 0.0, 1.0)
    rgb = np.zeros(data.shape + (3,), dtype=np.float64)
    knots = sorted(stops, key=lambda item: item[0])
    for (t0, c0), (t1, c1) in zip(knots, knots[1:]):
        if t1 <= t0:
            continue
        w = np.clip((t - t0) / (t1 - t0), 0.0, 1.0)
        band = (t >= t0) & (t <= t1)
        for channel in range(3):
            mix = c0[channel] + (c1[channel] - c0[channel]) * w
            rgb[..., channel] = np.where(band, mix, rgb[..., channel])
    rgb[..., :] = np.where(t[..., None] <= knots[0][0], knots[0][1], rgb)
    alpha = np.where(np.isfinite(data), 200, 0).astype(np.uint8)
    return np.dstack([rgb.astype(np.uint8), alpha])


def paint(values: np.ndarray, kind: str) -> tuple[np.ndarray, tuple[float, float]]:
    if kind == "HV":
        return colorize(values, *HV_DB, RADAR_STOPS), HV_DB
    if kind == "HH":
        return colorize(values, *HH_DB, RADAR_STOPS), HH_DB
    if kind == "change":
        return colorize(values, *CHANGE_DB, DIVERGE_STOPS), CHANGE_DB
    if kind == "los":
        return colorize(values, *LOS_MM, DIVERGE_STOPS), LOS_MM
    if kind == "rvi":
        return colorize(values, *RVI_RANGE, RVI_STOPS), RVI_RANGE
    if kind == "coherence":
        return colorize(values, *COH_RANGE, COH_STOPS), COH_RANGE
    raise ValueError(f"unknown palette {kind}")


def save_png(path: str | Any, rgba: np.ndarray) -> None:
    from pathlib import Path

    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(out)


def resample_onto(src: GeoGrid, dst: GeoGrid) -> np.ndarray:
    """Nearest sample of src onto dst's lon/lat axes."""
    lon_axis = _increasing_index(src.lon)
    lat_axis = _increasing_index(src.lat)
    cols = np.interp(dst.lon, lon_axis[0], lon_axis[1])
    rows = np.interp(dst.lat, lat_axis[0], lat_axis[1])
    col_i = np.clip(np.rint(cols).astype(int), 0, src.values.shape[1] - 1)
    row_i = np.clip(np.rint(rows).astype(int), 0, src.values.shape[0] - 1)
    return src.values[row_i][:, col_i]


def _increasing_index(axis: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    values = np.asarray(axis, dtype=np.float64)
    index = np.arange(values.size, dtype=np.float64)
    if values.size >= 2 and values[0] > values[-1]:
        values = values[::-1]
        index = index[::-1]
    return values, index


def crop_lonlat(values: np.ndarray, lon: np.ndarray, lat: np.ndarray, bbox: tuple[float, float, float, float]) -> GeoGrid:
    """Keep pixels whose lon/lat axes fall inside west,south,east,north."""
    west, south, east, north = bbox
    lon_a = np.asarray(lon, dtype=np.float64).reshape(-1)
    lat_a = np.asarray(lat, dtype=np.float64).reshape(-1)
    if values.shape != (lat_a.size, lon_a.size):
        raise ValueError(f"grid {values.shape} does not match lat {lat_a.size} lon {lon_a.size}")
    cols = np.flatnonzero((lon_a >= west) & (lon_a <= east))
    rows = np.flatnonzero((lat_a >= south) & (lat_a <= north))
    if cols.size == 0 or rows.size == 0:
        raise ValueError("AOI does not intersect this grid")
    r0, r1 = int(rows[0]), int(rows[-1]) + 1
    c0, c1 = int(cols[0]), int(cols[-1]) + 1
    # axes may be unordered; take the index span then the matching coordinates
    if rows[0] > rows[-1]:
        r0, r1 = int(rows[-1]), int(rows[0]) + 1
    if cols[0] > cols[-1]:
        c0, c1 = int(cols[-1]), int(cols[0]) + 1
    return GeoGrid(values[r0:r1, c0:c1], lon_a[c0:c1], lat_a[r0:r1])


def utm_to_lonlat(easting: np.ndarray, northing: np.ndarray, zone: int, northern: bool) -> tuple[np.ndarray, np.ndarray]:
    """Inverse WGS84 UTM. easting and northing are metres."""
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    x = np.asarray(easting, dtype=np.float64) - 500000.0
    y = np.asarray(northing, dtype=np.float64)
    if not northern:
        y = y - 10000000.0
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi = (
        mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * np.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * np.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * np.sin(6 * mu)
    )
    sin_p = np.sin(phi)
    cos_p = np.cos(phi)
    tan_p = np.tan(phi)
    n = a / np.sqrt(1 - e2 * sin_p * sin_p)
    t = tan_p * tan_p
    c = ep2 * cos_p * cos_p
    r = a * (1 - e2) / (1 - e2 * sin_p * sin_p) ** 1.5
    d = x / (n * k0)
    lat = phi - (n * tan_p / r) * (
        d * d / 2
        - (5 + 3 * t + 10 * c - 4 * c * c - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t + 298 * c + 45 * t * t - 252 * ep2 - 3 * c * c) * d ** 6 / 720
    )
    lon = (
        d
        - (1 + 2 * t + c) * d ** 3 / 6
        + (5 - 2 * c + 28 * t - 3 * c * c + 8 * ep2 + 24 * t * t) * d ** 5 / 120
    ) / cos_p
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    return np.degrees(lon0 + lon), np.degrees(lat)


def epsg_utm(epsg: int) -> tuple[int, bool] | None:
    if 32601 <= epsg <= 32660:
        return epsg - 32600, True
    if 32701 <= epsg <= 32760:
        return epsg - 32700, False
    return None


def axes_to_lonlat(x: np.ndarray, y: np.ndarray, epsg: int | None) -> tuple[np.ndarray, np.ndarray]:
    """Return lon for each column and lat for each row."""
    x_a = np.asarray(x, dtype=np.float64).reshape(-1)
    y_a = np.asarray(y, dtype=np.float64).reshape(-1)
    if epsg in (4326, 4269) or _looks_geographic(x_a, y_a):
        return x_a, y_a
    if epsg is None:
        raise ValueError("projected axes have no EPSG code; refusing to paste the TOML box onto them")
    utm = epsg_utm(epsg)
    if utm is None:
        raise ValueError(f"EPSG:{epsg} is not geographic and not UTM")
    zone, northern = utm
    # x is easting along columns, y is northing along rows
    lon, _ = utm_to_lonlat(x_a, np.full(x_a.shape, float(np.median(y_a))), zone, northern)
    _, lat = utm_to_lonlat(np.full(y_a.shape, float(np.median(x_a))), y_a, zone, northern)
    return lon, lat


def _looks_geographic(x: np.ndarray, y: np.ndarray) -> bool:
    return bool(np.max(np.abs(x)) <= 180 and np.max(np.abs(y)) <= 90)


def _as_text(raw: Any) -> str:
    if isinstance(raw, bytes):
        return raw.decode("utf-8", "replace")
    if isinstance(raw, str):
        return raw
    arr = np.asarray(raw)
    if arr.dtype.kind in {"S", "O", "U"}:
        parts = []
        for item in arr.ravel()[:8]:
            parts.append(item.decode("utf-8", "replace") if isinstance(item, bytes) else str(item))
        return " ".join(parts)
    return str(raw)


def _code_in_text(text: str) -> int | None:
    for match in re.finditer(r"EPSG[\"'\s,:]*(\d{4,5})", text, re.I):
        code = int(match.group(1))
        if code in (4326, 4269) or epsg_utm(code):
            return code
    for match in re.finditer(r"UTM zone (\d{1,2})\s*([NS])", text, re.I):
        zone = int(match.group(1))
        return (32600 if match.group(2).upper() == "N" else 32700) + zone
    return None


def _zone_to_epsg(raw: Any) -> int | None:
    if isinstance(raw, (int, np.integer)):
        zone = int(raw)
        if 1 <= zone <= 60:
            return 32700 + zone
        return None
    text = _as_text(raw).strip()
    coded = _code_in_text(text)
    if coded and epsg_utm(coded):
        return coded
    match = re.search(r"(\d{1,2})\s*([NSns])?", text)
    if not match:
        return None
    zone = int(match.group(1))
    if not 1 <= zone <= 60:
        return None
    hemi = (match.group(2) or "S").upper()
    return (32600 if hemi == "N" else 32700) + zone


def _usable_epsg(code: int) -> int | None:
    if code in (4326, 4269) or epsg_utm(code):
        return code
    return None


def epsg_from_projection(dataset: h5py.Dataset) -> int | None:
    """NISAR stores the EPSG as the projection dataset value, plus epsg_code and spatial_ref."""
    try:
        raw = dataset[()]
    except Exception:
        raw = None
    if raw is not None and _is_number(raw):
        code = _usable_epsg(int(np.asarray(raw).reshape(-1)[0]))
        if code:
            return code
    elif raw is not None:
        coded = _code_in_text(_as_text(raw))
        if coded:
            return coded
    for key in ("epsg_code", "EPSG_code", "epsg"):
        if key not in dataset.attrs:
            continue
        try:
            code = _usable_epsg(int(np.asarray(dataset.attrs[key]).reshape(-1)[0]))
        except (TypeError, ValueError):
            code = None
        if code:
            return code
    for key in ("spatial_ref", "crs_wkt", "wkt", "crs"):
        if key not in dataset.attrs:
            continue
        coded = _code_in_text(_as_text(dataset.attrs[key]))
        if coded:
            return coded
    return None


def _is_number(raw: Any) -> bool:
    arr = np.asarray(raw)
    return arr.dtype.kind in {"i", "u", "f"} and arr.size >= 1


def epsg_from_utm_zone(handle: h5py.File) -> int | None:
    """Last resort: granule metadata field utm_zone, for example 20S."""
    found: list[int] = []

    def take(name: str, raw: Any) -> None:
        if "utm" not in name.lower() or "zone" not in name.lower():
            return
        code = _zone_to_epsg(raw)
        if code:
            found.append(code)

    def walk(group: h5py.Group) -> None:
        for key, value in group.attrs.items():
            take(str(key), value)
        for key, obj in group.items():
            if isinstance(obj, h5py.Dataset) and "utm" in key.lower() and "zone" in key.lower():
                try:
                    take(key, obj[()])
                except Exception:
                    continue
            elif isinstance(obj, h5py.Group):
                walk(obj)

    walk(handle)
    return found[0] if found else None


def resolve_epsg(handle: h5py.File, data: h5py.Dataset) -> int | None:
    parent = data.parent
    proj = parent.get("projection") if parent is not None else None
    if not isinstance(proj, h5py.Dataset):
        for freq in ("frequencyA", "frequencyB"):
            path = f"/science/LSAR/GCOV/grids/{freq}/projection"
            if path in handle:
                proj = handle[path]
                break
    if isinstance(proj, h5py.Dataset):
        code = epsg_from_projection(proj)
        if code:
            return code
    return epsg_from_utm_zone(handle)


def find_epsg(handle: h5py.File) -> int | None:
    for freq in ("frequencyA", "frequencyB"):
        path = f"/science/LSAR/GCOV/grids/{freq}/projection"
        if path in handle and isinstance(handle[path], h5py.Dataset):
            code = epsg_from_projection(handle[path])
            if code:
                return code
    return epsg_from_utm_zone(handle)


def _dataset_by_suffix(handle: h5py.File, suffix: str) -> h5py.Dataset | None:
    want = suffix.strip("/").lower()
    found: h5py.Dataset | None = None

    def walk(group: h5py.Group) -> None:
        nonlocal found
        for key, obj in group.items():
            if found is not None:
                return
            path = f"{group.name.rstrip('/')}/{key}".lower()
            if isinstance(obj, h5py.Dataset) and (path.endswith("/" + want) or path.endswith(want)):
                found = obj
                return
            if isinstance(obj, h5py.Group):
                walk(obj)

    walk(handle)
    return found


def list_datasets(handle: h5py.File) -> list[str]:
    names: list[str] = []

    def walk(group: h5py.Group) -> None:
        for key, obj in group.items():
            path = f"{group.name.rstrip('/')}/{key}"
            if isinstance(obj, h5py.Dataset):
                names.append(path)
            elif isinstance(obj, h5py.Group):
                walk(obj)

    walk(handle)
    return names


def _pol_dataset(handle: h5py.File, suffix: str) -> h5py.Dataset | None:
    for freq in ("frequencyA", "frequencyB"):
        path = f"/science/LSAR/GCOV/grids/{freq}/{suffix}"
        if path in handle and isinstance(handle[path], h5py.Dataset):
            return handle[path]
    return _dataset_by_suffix(handle, suffix)


def _axes(data: h5py.Dataset, handle: h5py.File) -> tuple[h5py.Dataset | None, h5py.Dataset | None]:
    parent = data.parent
    x_ds = parent.get("xCoordinates") if parent is not None else None
    y_ds = parent.get("yCoordinates") if parent is not None else None
    if not isinstance(x_ds, h5py.Dataset):
        x_ds = parent.get("xCoordinate") if parent is not None else None
    if not isinstance(y_ds, h5py.Dataset):
        y_ds = parent.get("yCoordinate") if parent is not None else None
    if not isinstance(x_ds, h5py.Dataset):
        x_ds = _dataset_by_suffix(handle, "xCoordinates")
    if not isinstance(y_ds, h5py.Dataset):
        y_ds = _dataset_by_suffix(handle, "yCoordinates")
    return x_ds if isinstance(x_ds, h5py.Dataset) else None, y_ds if isinstance(y_ds, h5py.Dataset) else None


def read_grid(path: str, suffix: str, *, linear_power: bool) -> tuple[GeoGrid, int | None]:
    """Read one 2D dataset plus its x/y axes, cropped later by the caller."""
    with h5py.File(path, "r") as handle:
        data_ds = _pol_dataset(handle, suffix)
        if data_ds is None:
            names = "\n".join(list_datasets(handle)[:80])
            raise ValueError(f"{suffix} not found in {path}. First datasets:\n{names}")
        x_ds, y_ds = _axes(data_ds, handle)
        if x_ds is None or y_ds is None:
            raise ValueError(f"{path} has {suffix} but no x/y coordinates")
        values = np.asarray(data_ds[...], dtype=np.float64)
        if values.ndim > 2:
            values = values[0]
        x = np.asarray(x_ds[...], dtype=np.float64).reshape(-1)
        y = np.asarray(y_ds[...], dtype=np.float64).reshape(-1)
        epsg = resolve_epsg(handle, data_ds)
    if linear_power:
        values = power_to_db(values)
    lon, lat = axes_to_lonlat(x, y, epsg)
    if values.shape == (lon.size, lat.size) and values.shape != (lat.size, lon.size):
        values = values.T
    return GeoGrid(values, lon, lat), epsg


def gamma_db(path: str, pol: str) -> tuple[GeoGrid, int | None]:
    suffix = "HHHH" if pol == "HH" else "HVHV"
    return read_grid(path, suffix, linear_power=True)


def read_window(
    path: str,
    suffix: str,
    bbox: tuple[float, float, float, float],
    *,
    to_db: bool,
) -> tuple[GeoGrid, int | None]:
    """Slice the AOI in the file. The full frame is not loaded."""
    with h5py.File(path, "r") as handle:
        data_ds = _pol_dataset(handle, suffix)
        if data_ds is None:
            names = "\n".join(list_datasets(handle)[:80])
            raise ValueError(f"{suffix} missing in {path}. First datasets:\n{names}")
        x_ds, y_ds = _axes(data_ds, handle)
        if x_ds is None or y_ds is None:
            names = "\n".join(list_datasets(handle)[:80])
            raise ValueError(f"{suffix} or axes missing in {path}. First datasets:\n{names}")
        x = np.asarray(x_ds[...], dtype=np.float64).reshape(-1)
        y = np.asarray(y_ds[...], dtype=np.float64).reshape(-1)
        epsg = resolve_epsg(handle, data_ds)
        lon, lat = axes_to_lonlat(x, y, epsg)
        west, south, east, north = bbox
        cols = np.flatnonzero((lon >= west) & (lon <= east))
        rows = np.flatnonzero((lat >= south) & (lat <= north))
        if cols.size == 0 or rows.size == 0:
            raise ValueError(f"AOI {bbox} misses {suffix} in {path}")
        r0, r1 = int(rows.min()), int(rows.max()) + 1
        c0, c1 = int(cols.min()), int(cols.max()) + 1
        if data_ds.shape[0] == lon.size and data_ds.shape[-1] == lat.size and data_ds.shape[0] != lat.size:
            window = np.asarray(data_ds[c0:c1, r0:r1], dtype=np.float64).T
        else:
            window = np.asarray(data_ds[r0:r1, c0:c1], dtype=np.float64)
        if window.ndim > 2:
            window = window[0]
    if to_db:
        window = power_to_db(window)
    return GeoGrid(window, lon[c0:c1], lat[r0:r1]), epsg


def linear_pol(path: str, pol: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, int | None]:
    suffix = "HHHH" if pol == "HH" else "HVHV"
    with h5py.File(path, "r") as handle:
        data_ds = _pol_dataset(handle, suffix)
        if data_ds is None:
            raise ValueError(f"missing {suffix} in {path}")
        x_ds, y_ds = _axes(data_ds, handle)
        if x_ds is None or y_ds is None:
            raise ValueError(f"missing {suffix} axes in {path}")
        values = np.asarray(data_ds[...], dtype=np.float64)
        if values.ndim > 2:
            values = values[0]
        x = np.asarray(x_ds[...]).reshape(-1)
        y = np.asarray(y_ds[...]).reshape(-1)
        epsg = resolve_epsg(handle, data_ds)
    lon, lat = axes_to_lonlat(x, y, epsg)
    if values.shape == (lon.size, lat.size) and values.shape != (lat.size, lon.size):
        values = values.T
    return values, lon, lat, epsg
