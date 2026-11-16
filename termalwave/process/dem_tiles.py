"""Cache MapLibre raster-dem (Terrarium) tiles for the AOI.

Google Elevation is preferred for point samples (see providers/terrain) but is
not a MapLibre tile source. Cesium World Terrain is quantized-mesh (CesiumJS).
For globe relief we mirror AWS Terrarium tiles covering the AOI so the scene
can render offline after the first online bake.
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any

from termalwave.providers.http import ProviderHttpError, http_get

log = logging.getLogger("termalwave.dem")

DEFAULT_TERRARIUM = (
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
)


def _lon2tile(lon: float, z: int) -> int:
    return int(math.floor((lon + 180.0) / 360.0 * (1 << z)))


def _lat2tile(lat: float, z: int) -> int:
    lat = max(min(lat, 85.05112878), -85.05112878)
    r = math.radians(lat)
    return int(
        math.floor(
            (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * (1 << z)
        )
    )


def tile_range(
    west: float, south: float, east: float, north: float, z: int
) -> tuple[range, range]:
    x0 = _lon2tile(west, z)
    x1 = _lon2tile(east, z)
    y0 = _lat2tile(north, z)
    y1 = _lat2tile(south, z)
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    n = 1 << z
    x0 = max(0, min(x0, n - 1))
    x1 = max(0, min(x1, n - 1))
    y0 = max(0, min(y0, n - 1))
    y1 = max(0, min(y1, n - 1))
    return range(x0, x1 + 1), range(y0, y1 + 1)


def bake_aoi_dem(
    cfg: dict[str, Any],
    repo_root: Path,
    *,
    offline: bool = False,
) -> dict[str, Any]:
    """Download Terrarium tiles for AOI into overlay mirrors; set dem_url_template."""
    web = cfg.setdefault("web", {})
    aoi = cfg["aoi"]
    west = float(aoi["west"])
    east = float(aoi["east"])
    south = float(aoi["south"])
    north = float(aoi["north"])

    template = str(
        web.get("dem_source_template")
        or web.get("dem_url_template")
        or DEFAULT_TERRARIUM
    )
    # Prefer remote AWS as source when baking; local path is the output.
    if template.startswith("./") or template.startswith("../"):
        source_template = DEFAULT_TERRARIUM
    else:
        source_template = template

    z_min = int(web.get("dem_min_zoom", 8))
    z_max = int(web.get("dem_max_zoom", 12))
    rel_dir = str(web.get("dem_cache_dir", "overlays/dem"))

    mirrors = [Path(p) for p in cfg.get("paths", {}).get("overlay_mirrors", [])]
    if not mirrors:
        mirrors = [repo_root / "web" / "public" / "overlays"]

    out_dirs = [(m if m.is_absolute() else repo_root / m) / "dem" for m in mirrors]
    # dem_cache_dir may already include overlays/dem — keep flat under each mirror
    if rel_dir.rstrip("/").endswith("dem"):
        out_dirs = [(m if m.is_absolute() else repo_root / m) for m in mirrors]
        # mirrors point at .../overlays; dem lives at .../overlays/dem
        out_dirs = [d / "dem" if d.name != "dem" else d for d in out_dirs]

    meta: dict[str, Any] = {
        "encoding": "terrarium",
        "source_template": source_template,
        "z_min": z_min,
        "z_max": z_max,
        "tiles": 0,
        "errors": 0,
        "offline": offline,
    }

    if offline:
        # Keep whatever is already on disk; point web at local template if tiles exist.
        local_ok = any(d.is_dir() and any(d.rglob("*.png")) for d in out_dirs)
        if local_ok:
            web["dem_url_template"] = "./overlays/dem/{z}/{x}/{y}.png"
            meta["status"] = "cache"
        else:
            web.setdefault("dem_url_template", DEFAULT_TERRARIUM)
            meta["status"] = "unavailable"
        _write_meta(out_dirs, meta, west, south, east, north)
        return meta

    headers = {"User-Agent": "TermalWave/1.0 (relief cache)"}
    for z in range(z_min, z_max + 1):
        xs, ys = tile_range(west, south, east, north, z)
        for x in xs:
            for y in ys:
                rel = f"{z}/{x}/{y}.png"
                primary = out_dirs[0] / rel
                if primary.is_file() and primary.stat().st_size > 0:
                    meta["tiles"] += 1
                    continue
                url = source_template.format(z=z, x=x, y=y)
                try:
                    blob = http_get(url, headers=headers, timeout=60.0)
                except ProviderHttpError as exc:
                    log.warning("dem tile skip %s: %s", rel, exc)
                    meta["errors"] += 1
                    continue
                for out in out_dirs:
                    dest = out / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(blob)
                meta["tiles"] += 1

    if meta["tiles"] > 0:
        web["dem_url_template"] = "./overlays/dem/{z}/{x}/{y}.png"
        meta["status"] = "ok"
    else:
        web["dem_url_template"] = source_template
        meta["status"] = "remote_fallback"

    web.setdefault("dem_attribution", "Relieve Terrarium (AWS Open Data)")
    web.setdefault("dem_encoding", "terrarium")
    _write_meta(out_dirs, meta, west, south, east, north)
    return meta


def _write_meta(
    out_dirs: list[Path],
    meta: dict[str, Any],
    west: float,
    south: float,
    east: float,
    north: float,
) -> None:
    payload = {
        **meta,
        "bounds": {"west": west, "south": south, "east": east, "north": north},
    }
    text = json.dumps(payload, indent=2)
    for out in out_dirs:
        out.mkdir(parents=True, exist_ok=True)
        (out / "manifest.json").write_text(text + "\n", encoding="utf-8")
