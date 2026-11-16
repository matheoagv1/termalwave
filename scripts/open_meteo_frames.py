#!/usr/bin/env python3
"""Annual soil-moisture and PM2.5 frames for the Santiago del Estero AOI.

No API key. Soil is ERA5-Land via the Open-Meteo archive. PM2.5 is CAMS
via the Open-Meteo air-quality API. Years the archive does not cover are
left without an image (unavailable), not as example paintings.

    python3 scripts/open_meteo_frames.py
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from termalwave._bootstrap import ensure_vendored

ensure_vendored()

import numpy as np
from PIL import Image

WEST, EAST = -64.35, -64.15
SOUTH, NORTH = -27.90, -27.70
NX, NY = 8, 6
YEARS = (2018, 2020, 2022, 2024, 2026)
# 15th of each month. 2026 stops before a date the archive has not published.
MONTHS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
SOIL_URL = "https://archive-api.open-meteo.com/v1/archive"
PM_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
SOURCE = "Open-Meteo (ERA5/ICON)"
PM_SOURCE = "Open-Meteo Air Quality (CAMS)"
DATASET = _REPO / "web" / "public" / "dataset.json"
SOIL_DIR = _REPO / "web" / "public" / "overlays" / "timeline" / "suelo"
PM_DIR = _REPO / "web" / "public" / "overlays" / "timeline" / "contaminacion"
BOUNDS = {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH}
SOIL_RANGE = (0.05, 0.40)
PM_RANGE = (0.0, 40.0)
SOIL_STOPS = ((0.0, (90, 58, 28)), (0.45, (196, 176, 110)), (1.0, (42, 120, 130)))
PM_STOPS = ((0.0, (28, 32, 48)), (0.45, (150, 90, 160)), (1.0, (230, 150, 70)))


def main() -> int:
    lons, lats = grid()
    soil_means: dict[int, np.ndarray] = {}
    pm_means: dict[int, np.ndarray] = {}
    for year in YEARS:
        soil = year_grid(SOIL_URL, "soil_moisture_0_to_7cm", year, lats, lons)
        if soil is not None:
            soil_means[year] = soil
            write_png(SOIL_DIR / f"{year}.png", soil, SOIL_RANGE, SOIL_STOPS)
            print(f"suelo {year} mean {float(np.nanmean(soil)):.3f} m3/m3", flush=True)
        else:
            print(f"suelo {year} unavailable", flush=True)
        pm = year_grid(PM_URL, "pm2_5", year, lats, lons)
        if pm is not None:
            pm_means[year] = pm
            write_png(PM_DIR / f"{year}.png", pm, PM_RANGE, PM_STOPS)
            print(f"pm2.5 {year} mean {float(np.nanmean(pm)):.1f} ug/m3", flush=True)
        else:
            print(f"pm2.5 {year} unavailable", flush=True)
    patch_dataset(soil_means, pm_means)
    return 0


def grid() -> tuple[np.ndarray, np.ndarray]:
    # row 0 is north, matching an image
    lats = np.linspace(NORTH, SOUTH, NY)
    lons = np.linspace(WEST, EAST, NX)
    return lons, lats


def year_grid(base: str, param: str, year: int, lats: np.ndarray, lons: np.ndarray) -> np.ndarray | None:
    acc = np.zeros((NY, NX), dtype=np.float64)
    count = np.zeros((NY, NX), dtype=np.float64)
    months = [m for m in MONTHS if not (year == 2026 and m > 10)]
    any_ok = False
    flat_lat = np.repeat(lats, NX)
    flat_lon = np.tile(lons, NY)
    for month in months:
        start = f"{year}-{month:02d}-15"
        end = start
        values = fetch_day(base, param, flat_lat, flat_lon, start, end)
        if values is None:
            continue
        any_ok = True
        shaped = values.reshape(NY, NX)
        ok = np.isfinite(shaped)
        acc[ok] += shaped[ok]
        count[ok] += 1
    if not any_ok or not np.any(count):
        return None
    out = np.full((NY, NX), np.nan, dtype=np.float64)
    good = count > 0
    out[good] = acc[good] / count[good]
    return out


def fetch_day(base: str, param: str, lats: np.ndarray, lons: np.ndarray, start: str, end: str) -> np.ndarray | None:
    # a few points per call; the archive rejects very long coordinate lists
    out = np.full(lats.shape, np.nan, dtype=np.float64)
    step = 48
    got = False
    for i in range(0, lats.size, step):
        query = urllib.parse.urlencode(
            {
                "latitude": ",".join(f"{v:.4f}" for v in lats[i : i + step]),
                "longitude": ",".join(f"{v:.4f}" for v in lons[i : i + step]),
                "start_date": start,
                "end_date": end,
                "hourly": param,
            }
        )
        try:
            with urllib.request.urlopen(f"{base}?{query}", timeout=45) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as exc:
            print(f"  {param} {start} batch {i} failed: {exc}", file=sys.stderr)
            continue
        rows = payload if isinstance(payload, list) else [payload]
        for j, row in enumerate(rows):
            series = ((row.get("hourly") or {}).get(param)) or []
            nums = [float(v) for v in series if isinstance(v, (int, float))]
            if not nums:
                continue
            out[i + j] = float(np.mean(nums))
            got = True
    return out if got else None


def write_png(path: Path, values: np.ndarray, rng: tuple[float, float], stops: tuple) -> None:
    lo, hi = rng
    t = np.clip((values - lo) / (hi - lo), 0.0, 1.0)
    rgb = np.zeros(values.shape + (3,), dtype=np.float64)
    knots = list(stops)
    for (t0, c0), (t1, c1) in zip(knots, knots[1:]):
        w = np.clip((t - t0) / (t1 - t0), 0.0, 1.0)
        band = (t >= t0) & (t <= t1)
        for ch in range(3):
            mix = c0[ch] + (c1[ch] - c0[ch]) * w
            rgb[..., ch] = np.where(band, mix, rgb[..., ch])
    alpha = np.where(np.isfinite(values), 210, 0).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    image = Image.fromarray(rgba, mode="RGBA").resize((200, 160), Image.Resampling.NEAREST)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def patch_dataset(soil: dict[int, np.ndarray], pm: dict[int, np.ndarray]) -> None:
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    by_id = {row["id"]: row for row in data.get("layers") or []}
    _layer(by_id.get("suelo"), "model", "m³/m³", [0.05, 0.40], SOURCE, 2)
    _layer(by_id.get("contaminacion"), "model", "µg/m³", [0.0, 40.0], PM_SOURCE, 0)
    if "incendios" in by_id and by_id["incendios"].get("honesty") == "example":
        # painted frames are removed below; do not keep the example badge
        by_id["incendios"].pop("honesty", None)
    data.pop("timelineSynthetic", None)
    for seg in data.get("segments") or []:
        for tick in seg.get("ticks") or []:
            year = int(tick["label"]) if str(tick.get("label") or "").isdigit() else 0
            frames = tick.setdefault("frames", {})
            if year < 2025:
                frames["radar"] = None
            if year in soil:
                frames["suelo"] = _frame(f"./overlays/timeline/suelo/{year}.png", "model", SOURCE, float(np.nanmean(soil[year])))
            else:
                frames["suelo"] = None
            if year in pm:
                frames["contaminacion"] = _frame(
                    f"./overlays/timeline/contaminacion/{year}.png",
                    "model",
                    PM_SOURCE,
                    float(np.nanmean(pm[year])),
                )
            else:
                frames["contaminacion"] = None
            if year == 2022 and isinstance(frames.get("contaminacion"), dict):
                # CAMS pm2_5 at this AOI starts in August 2022
                frames["contaminacion"]["quality"] = "partial"
            if year == 2026:
                for lid in ("suelo", "contaminacion"):
                    if isinstance(frames.get(lid), dict):
                        frames[lid]["quality"] = "partial"
            # example paintings are not fire detections
            if frames.get("incendios") and (frames["incendios"] or {}).get("honesty") == "example":
                frames["incendios"] = None
    DATASET.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _write_series(soil, pm)
    print(f"updated {DATASET.relative_to(_REPO)}")


def _layer(row: dict | None, honesty: str, unit: str, rng: list[float], source: str, decimals: int) -> None:
    if not row:
        return
    row["honesty"] = honesty
    row["unit"] = unit
    row["range"] = rng
    row["note"] = source
    row["decimals"] = decimals
    row.pop("note_en", None)
    row.pop("note_es", None)


def _write_series(soil: dict[int, np.ndarray], pm: dict[int, np.ndarray]) -> None:
    root = _REPO / "web" / "public" / "series"
    root.mkdir(parents=True, exist_ok=True)
    def rows(means: dict[int, np.ndarray]) -> list[dict]:
        out = []
        for year in YEARS:
            out.append({
                "tickId": f"y-{year}",
                "date": f"{year}-01-01",
                "value": None if year not in means else round(float(np.nanmean(means[year])), 4),
            })
        return out
    (root / "suelo.json").write_text(json.dumps(rows(soil), indent=2) + "\n", encoding="utf-8")
    (root / "contaminacion.json").write_text(json.dumps(rows(pm), indent=2) + "\n", encoding="utf-8")


def _frame(url: str, honesty: str, source: str, mean: float) -> dict:
    return {
        "url": url,
        "bounds": BOUNDS,
        "kind": "composite",
        "honesty": honesty,
        "source": source,
        "mean": mean,
    }


if __name__ == "__main__":
    raise SystemExit(main())
