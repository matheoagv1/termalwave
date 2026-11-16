"""ORNL DAAC MODIS subset client with a disk cache (the service allows 10 dates per call)."""

from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

BASE = "https://modis.ornl.gov/rst/api/v1"
R_SIN = 6371007.181  # MODIS sinusoidal sphere radius, metres
MAX_DATES = 10


class Ornl:
    def __init__(self, cache: Path) -> None:
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)

    def get(self, path: str) -> Any:
        key = hashlib.sha1(path.encode()).hexdigest()
        f = self.cache / f"{key}.json"
        if f.exists():
            return json.loads(f.read_text())
        req = urllib.request.Request(BASE + path, headers={"Accept": "application/json", "User-Agent": "termalwave-veg"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = json.loads(r.read())
                break
            except (urllib.error.URLError, TimeoutError) as err:
                if attempt == 3:
                    raise RuntimeError(f"ornl {path}: {err}") from err
                time.sleep(5 * (attempt + 1))
        f.write_text(json.dumps(data))
        return data

    def dates(self, product: str, lat: float, lon: float) -> list[str]:
        d = self.get(f"/{product}/dates?latitude={lat}&longitude={lon}")
        return [x["modis_date"] for x in d["dates"]]

    def subset(self, product: str, band: str, lat: float, lon: float, start: str, end: str, km_ab: int, km_lr: int) -> dict:
        return self.get(
            f"/{product}/subset?latitude={lat}&longitude={lon}&band={band}"
            f"&startDate={start}&endDate={end}&kmAboveBelow={km_ab}&kmLeftRight={km_lr}"
        )


def chunks(dates: list[str], n: int = MAX_DATES) -> list[tuple[str, str]]:
    return [(dates[i], dates[min(i + n, len(dates)) - 1]) for i in range(0, len(dates), n)]


def pixel_lonlat(meta: dict) -> list[tuple[float, float]]:
    """Centre lon/lat of each pixel, row-major from the north-west corner."""
    x0, y0 = float(meta["xllcorner"]), float(meta["yllcorner"])
    cs, nr, nc = float(meta["cellsize"]), int(meta["nrows"]), int(meta["ncols"])
    out = []
    for r in range(nr):
        y = y0 + (nr - r - 0.5) * cs
        lat = math.degrees(y / R_SIN)
        coslat = math.cos(math.radians(lat))
        for c in range(nc):
            x = x0 + (c + 0.5) * cs
            out.append((math.degrees(x / (R_SIN * coslat)), lat))
    return out
