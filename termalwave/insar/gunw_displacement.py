"""Ground displacement (line of sight, mm) from one NISAR L2 GUNW interferogram.

Finds a GUNW pair over a bbox in NASA CMR, reads only the HDF5 bytes it needs over
HTTP range requests (Earthdata token), converts unwrapped phase to millimetres with
``los_mm`` (F17 sign: positive = toward the satellite), masks unreliable pixels,
and writes a PNG, a bounds JSON and a stats JSON for the globe.

Run (needs h5py, numpy, pillow, fsspec, aiohttp, requests, pyproj):
    python termalwave/insar/gunw_displacement.py --inspect
    python termalwave/insar/gunw_displacement.py
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path

import fsspec
import h5py
import numpy as np
import requests
from PIL import Image
from pyproj import Transformer

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
if "--bootstrap" not in sys.argv:
    # the package __init__ pins the vendored cp311 wheels; this tool runs in any venv with its deps
    import types

    _pkg = types.ModuleType("termalwave")
    _pkg.__path__ = [str(REPO / "termalwave")]
    sys.modules["termalwave"] = _pkg

from termalwave.process.nisar_raster import colorize, los_mm  # noqa: E402
from termalwave.science.constants import NISAR_L_WAVELENGTH_M  # noqa: E402

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
COLLECTIONS = ("NISAR_L2_GUNW_V1", "NISAR_L2_GUNW_PROVISIONAL_V1", "NISAR_L2_GUNW_BETA_V1")
SECRETS = Path("/srv/sites/nasaspaceappchallenge/config/secrets.local.toml")
OUT = REPO / "web" / "public" / "insar"
# Santiago del Estero and La Banda, the demo area
DEFAULT_BBOX = (-64.50, -27.95, -64.00, -27.55)
FULL_DOWNLOAD_LIMIT_MB = 2048
COHERENCE_MIN = 0.3
OUT_PX = 900
TILE_ZOOMS = tuple(range(8, 14))
RANGE_MM = 30.0
# blue = away from the satellite, red = toward it
RAMP = ((0.0, (33, 102, 172)), (0.25, (103, 169, 207)), (0.5, (247, 247, 247)), (0.75, (239, 138, 98)), (1.0, (178, 24, 43)))


def token() -> str:
    return tomllib.loads(SECRETS.read_text())["credentials"]["EARTHDATA_TOKEN"]


def find_granule(bbox: tuple[float, ...], prefer: str | None) -> dict:
    """Validated first, then the smallest file whose footprint holds the whole bbox."""
    w, s, e, n = bbox
    for name in COLLECTIONS:
        params = {"short_name": name, "bounding_box": f"{w},{s},{e},{n}", "page_size": 200, "sort_key": "-start_date"}
        entries = requests.get(CMR, params=params, timeout=60).json()["feed"]["entry"]
        rows = []
        for entry in entries:
            if prefer and prefer not in entry["title"]:
                continue
            ring = [float(v) for v in entry["polygons"][0][0].split()]
            lats, lons = ring[0::2], ring[1::2]
            if not all(point_in_ring(x, y, lons, lats) for x, y in ((w, s), (w, n), (e, s), (e, n))):
                continue
            h5 = next(l["href"] for l in entry["links"] if l["href"].startswith("https") and l["href"].endswith(".h5"))
            browse = next((l["href"] for l in entry["links"] if l["href"].startswith("https") and l["href"].endswith("_LATLON.png")), "")
            rows.append({"title": entry["title"], "collection": name, "size_mb": float(entry["granule_size"]), "h5": h5, "browse": browse})
        if rows:
            return min(rows, key=lambda r: r["size_mb"])
    raise SystemExit("no GUNW pair in CMR covers the whole bbox")


def point_in_ring(x: float, y: float, xs: list[float], ys: list[float]) -> bool:
    inside = False
    for i in range(len(xs) - 1):
        if (ys[i] > y) != (ys[i + 1] > y) and x < xs[i] + (y - ys[i]) * (xs[i + 1] - xs[i]) / (ys[i + 1] - ys[i]):
            inside = not inside
    return inside


def open_remote(h5_url: str):
    """Earthdata answers with a signed CloudFront URL; h5py then reads byte ranges from it."""
    res = requests.get(h5_url, headers={"Authorization": f"Bearer {token()}", "Range": "bytes=0-0"}, allow_redirects=False, timeout=60)
    signed = res.headers.get("location")
    if res.status_code not in (301, 302, 303, 307) or not signed:
        raise SystemExit(f"Earthdata did not redirect (HTTP {res.status_code}); check the token")
    handle = fsspec.filesystem("http").open(signed, block_size=8 << 20, cache_type="blockcache")
    return h5py.File(handle, "r")


def find_paths(h5: h5py.File) -> dict[str, str]:
    """Locate datasets by name so a product spec change fails loudly, not silently."""
    found: dict[str, str] = {}

    def visit(name: str, obj) -> None:
        if not isinstance(obj, h5py.Dataset) or "/grids/" not in name or "unwrappedInterferogram" not in name:
            return
        leaf = name.rsplit("/", 1)[-1]
        found.setdefault(leaf, name)

    h5.visititems(visit)
    return found


def inspect(h5: h5py.File) -> None:
    def show(name: str, obj) -> None:
        if isinstance(obj, h5py.Dataset) and "/grids/" in name:
            print(name, obj.shape, obj.dtype, dict((k, v) for k, v in obj.attrs.items() if k in ("units", "_FillValue", "epsg_code")))

    h5.visititems(show)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--bbox", type=float, nargs=4, default=DEFAULT_BBOX, metavar=("W", "S", "E", "N"))
    ap.add_argument("--prefer", help="substring of the granule name to force a pair")
    ap.add_argument("--bootstrap", action="store_true", help="use the vendored cp311 runtime")
    ap.add_argument("--no-deramp", dest="deramp", action="store_false", help="keep the long-wavelength plane")
    # off by default: on the demo pair, subtracting the screen left a larger curved residual than the plane fit alone
    ap.add_argument("--iono", action="store_true", help="subtract the product ionosphere phase screen")
    ap.add_argument("--out", default="gunw_los_mm", help="output file stem under web/public/insar")
    ap.add_argument("--inspect", action="store_true", help="list HDF5 grid datasets and exit")
    args = ap.parse_args()
    bbox = tuple(args.bbox)

    g = find_granule(bbox, args.prefer)
    print(f"granule {g['title']} ({g['collection']}, {g['size_mb']:.0f} MB)")
    # range reads touch only the crop; the limit guards a fallback full download we never do
    if g["size_mb"] > FULL_DOWNLOAD_LIMIT_MB:
        print(f"file is {g['size_mb']:.0f} MB, above {FULL_DOWNLOAD_LIMIT_MB} MB: reading only the crop over HTTP ranges")
    h5 = open_remote(g["h5"])
    if args.inspect:
        inspect(h5)
        return

    paths = find_paths(h5)
    need = ("unwrappedPhase", "connectedComponents", "coherenceMagnitude", "ionospherePhaseScreen", "xCoordinates", "yCoordinates", "projection")
    missing = [k for k in need if k not in paths]
    if missing:
        raise SystemExit(f"GUNW datasets not found: {missing}; run --inspect")
    epsg = int(h5[paths["projection"]].attrs.get("epsg_code", h5[paths["projection"]][()]))
    xs = h5[paths["xCoordinates"]][()]
    ys = h5[paths["yCoordinates"]][()]

    to_grid = Transformer.from_crs(4326, epsg, always_xy=True)
    w, s, e, n = bbox
    cx, cy = to_grid.transform([w, e, w, e], [s, s, n, n])
    col = np.searchsorted(xs, [min(cx), max(cx)])
    # y runs north to south in the grid
    row = np.sort(len(ys) - np.searchsorted(ys[::-1], [min(cy), max(cy)]))
    c0, c1 = max(int(col[0]) - 2, 0), min(int(col[1]) + 2, len(xs))
    r0, r1 = max(int(row[0]) - 2, 0), min(int(row[1]) + 2, len(ys))
    print(f"crop rows {r0}:{r1} cols {c0}:{c1} of {len(ys)}x{len(xs)}, EPSG {epsg}")

    phase = h5[paths["unwrappedPhase"]][r0:r1, c0:c1].astype(np.float64)
    comp = h5[paths["connectedComponents"]][r0:r1, c0:c1]
    coh = h5[paths["coherenceMagnitude"]][r0:r1, c0:c1].astype(np.float64)
    # the product ships a split-spectrum ionosphere estimate but does not apply it
    iono = h5[paths["ionospherePhaseScreen"]][r0:r1, c0:c1].astype(np.float64)
    iono_ok = args.iono and bool(np.isfinite(iono).mean() > 0.5)
    if iono_ok:
        phase = phase - np.where(np.isfinite(iono), iono, 0.0)
    fill = h5[paths["unwrappedPhase"]].attrs.get("_FillValue")
    comp_fill = h5[paths["connectedComponents"]].attrs.get("_FillValue")

    valid = np.isfinite(phase) & np.isfinite(coh) & (coh >= COHERENCE_MIN) & (comp > 0)
    if fill is not None:
        valid &= phase != float(np.asarray(fill).ravel()[0])
    if comp_fill is not None:
        valid &= comp != np.asarray(comp_fill).ravel()[0]
    if not valid.any():
        raise SystemExit("no reliable pixels in the crop; nothing written")

    # unwrapping is only consistent inside one component: reference the largest one to its own median
    labels, counts = np.unique(comp[valid], return_counts=True)
    main_comp = labels[np.argmax(counts)]
    keep = valid & (comp == main_comp)
    phase = np.where(keep, phase - np.median(phase[keep]), np.nan)
    raw_mm = los_mm(phase, NISAR_L_WAVELENGTH_M)
    # a plane over 50 km in 12 days is mostly troposphere or ionosphere, not ground; remove it and say so
    yy, xx = np.nonzero(keep)
    design = np.column_stack([np.ones(xx.size), xx, yy])
    coef, *_ = np.linalg.lstsq(design, raw_mm[keep], rcond=None)
    plane = coef[0] + coef[1] * np.arange(raw_mm.shape[1])[None, :] + coef[2] * np.arange(raw_mm.shape[0])[:, None]
    disp = raw_mm - plane if args.deramp else raw_mm
    if args.deramp:
        disp = disp - np.nanmedian(disp)
    ramp_mm = float(np.nanmax(plane[keep]) - np.nanmin(plane[keep]))

    # resample to a regular lon/lat grid so the PNG drops onto the globe as an image source
    to_ll = Transformer.from_crs(epsg, 4326, always_xy=True)
    lon_px = OUT_PX
    lat_px = max(int(OUT_PX * (n - s) / ((e - w) * math.cos(math.radians((n + s) / 2)))), 1)
    glon, glat = np.meshgrid(np.linspace(w, e, lon_px), np.linspace(n, s, lat_px))
    origin = (xs[c0], ys[r0], xs[1] - xs[0], ys[1] - ys[0])
    out = sample(disp, origin, to_grid, glon, glat)

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(colorize(out, -RANGE_MM, RANGE_MM, RAMP), "RGBA").save(OUT / f"{args.out}.png", optimize=True)
    tiles = write_tiles(disp, origin, to_grid, bbox, OUT / "tiles" / args.out)
    good = out[np.isfinite(out)]
    parts = g["title"].split("_")
    ref, sec = parts[11][:8], parts[13][:8]
    bounds = {"bbox": [w, s, e, n], "coordinates": [[w, n], [e, n], [e, s], [w, s]], "image": f"/insar/{args.out}.png"}
    stats = {
        "granule": g["title"],
        "collection": g["collection"],
        "maturity": "validated" if g["collection"] == "NISAR_L2_GUNW_V1" else g["collection"].split("_")[3].lower(),
        "track": int(parts[5]),
        "direction": "ascending" if parts[6] == "A" else "descending",
        "frame": int(parts[7]),
        "reference_date": f"{ref[:4]}-{ref[4:6]}-{ref[6:]}",
        "secondary_date": f"{sec[:4]}-{sec[4:6]}-{sec[6:]}",
        "browse_url": g["browse"],
        "datasets": {k: paths[k] for k in ("unwrappedPhase", "connectedComponents", "coherenceMagnitude", "ionospherePhaseScreen")},
        "ionosphere_removed": iono_ok,
        "plane_removed": bool(args.deramp),
        "plane_span_mm": round(ramp_mm, 1),
        "raw_mm_p05_p95": [round(float(np.nanpercentile(raw_mm, 5)), 1), round(float(np.nanpercentile(raw_mm, 95)), 1)],
        "epsg": epsg,
        "wavelength_m": NISAR_L_WAVELENGTH_M,
        "sign": "positive = toward the satellite (F17)",
        "reference": "median of the largest connected component in the crop set to 0",
        "coherence_min": COHERENCE_MIN,
        "valid_fraction": round(float(good.size) / float(out.size), 4),
        "mm": {
            "p05": round(float(np.percentile(good, 5)), 2),
            "median": round(float(np.median(good)), 2),
            "p95": round(float(np.percentile(good, 95)), 2),
            "min": round(float(good.min()), 2),
            "max": round(float(good.max()), 2),
        },
        "display_range_mm": [-RANGE_MM, RANGE_MM],
        "tiles": f"/insar/tiles/{args.out}/{{z}}/{{x}}/{{y}}.png",
        "tile_zooms": [TILE_ZOOMS[0], TILE_ZOOMS[-1]],
        "tile_count": tiles,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "honesty": "derived",
    }
    (OUT / f"{args.out}.bounds.json").write_text(json.dumps(bounds, indent=1) + "\n")
    (OUT / f"{args.out}.stats.json").write_text(json.dumps(stats, indent=1) + "\n")
    print(json.dumps(stats["mm"]), "valid", stats["valid_fraction"])


def sample(disp: np.ndarray, origin: tuple[float, ...], to_grid: Transformer, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """Nearest grid value for each lon/lat; NaN outside the crop."""
    x0, y0, dx, dy = origin
    gx, gy = to_grid.transform(lon, lat)
    ci = np.round((gx - x0) / dx).astype(int)
    ri = np.round((gy - y0) / dy).astype(int)
    inside = (ci >= 0) & (ci < disp.shape[1]) & (ri >= 0) & (ri < disp.shape[0])
    out = np.full(lon.shape, np.nan)
    out[inside] = disp[ri[inside], ci[inside]]
    return out


def write_tiles(disp: np.ndarray, origin: tuple[float, ...], to_grid: Transformer, bbox: tuple[float, ...], root: Path) -> int:
    """Static XYZ web-mercator tiles, so the catalog draws the result as a plain raster layer."""
    w, s, e, n = bbox
    count = 0
    for z in TILE_ZOOMS:
        size = 2 ** z
        tx0, tx1 = int((w + 180) / 360 * size), int((e + 180) / 360 * size)
        ty0, ty1 = merc_row(n, size), merc_row(s, size)
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                px = (tx + (np.arange(256) + 0.5) / 256) / size
                py = (ty + (np.arange(256) + 0.5) / 256) / size
                lon = px * 360 - 180
                lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * py))))
                glon, glat = np.meshgrid(lon, lat)
                vals = sample(disp, origin, to_grid, glon, glat)
                vals[(glon < w) | (glon > e) | (glat < s) | (glat > n)] = np.nan
                if not np.isfinite(vals).any():
                    continue
                path = root / str(z) / str(tx) / f"{ty}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(colorize(vals, -RANGE_MM, RANGE_MM, RAMP), "RGBA").save(path, optimize=True)
                count += 1
    return count


def merc_row(lat: float, size: int) -> int:
    return int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * size)


if __name__ == "__main__":
    main()
