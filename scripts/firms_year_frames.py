#!/usr/bin/env python3
"""Annual fire-detection frames for the Santiago del Estero AOI from NASA FIRMS.

Reads FIRMS_MAP_KEY from the environment. Does not print the key.
VIIRS SNPP SP covers past years (5-day windows). The current year also
tries VIIRS SNPP NRT when SP has no rows. Years that cannot be fetched
stay without an image.

On the VPS:

    cd /srv/sites/nasaspaceappchallenge
    FIRMS_MAP_KEY="$FIRMS_MAP_KEY" python3 scripts/firms_year_frames.py
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from termalwave._bootstrap import ensure_vendored

ensure_vendored()

from PIL import Image, ImageDraw

WEST, EAST = -64.35, -64.15
SOUTH, NORTH = -27.90, -27.70
YEARS = (2018, 2020, 2022, 2024, 2026)
DATASET = _REPO / "web" / "public" / "dataset.json"
OUT_DIR = _REPO / "web" / "public" / "overlays" / "timeline" / "incendios"
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
SOURCE = "NASA FIRMS (VIIRS SNPP)"
WIDTH, HEIGHT = 200, 160
# FIRMS area CSV rejects a day range above 5.
WINDOW = 5


def main() -> int:
    key = os.environ.get("FIRMS_MAP_KEY", "").strip()
    if not key:
        print(
            "FIRMS_MAP_KEY is not set. On the VPS:\n"
            "  cd /srv/sites/nasaspaceappchallenge\n"
            "  FIRMS_MAP_KEY=\"$FIRMS_MAP_KEY\" python3 scripts/firms_year_frames.py",
            file=sys.stderr,
        )
        return 2
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written: dict[int, int] = {}
    for year in YEARS:
        end = date(year, 12, 31)
        if year == date.today().year:
            end = min(end, date.today())
        points, ok = collect(key, date(year, 1, 1), end)
        if not ok:
            print(f"incendios {year} unavailable")
            continue
        write_png(OUT_DIR / f"{year}.png", points)
        written[year] = len(points)
        print(f"incendios {year} detections {len(points)}")
    if written:
        patch_dataset(written)
    return 0


def collect(key: str, start: date, end: date) -> tuple[list[tuple[float, float]], bool]:
    points: list[tuple[float, float]] = []
    ok = False
    cursor = start
    products = ["VIIRS_SNPP_SP"]
    if end.year >= date.today().year - 1:
        products.append("VIIRS_SNPP_NRT")
    while cursor <= end:
        window_end = min(cursor + timedelta(days=WINDOW - 1), end)
        day_range = (window_end - cursor).days + 1
        batch: list[tuple[float, float]] = []
        window_ok = False
        for product in products:
            rows = fetch(key, product, window_end, day_range)
            if rows is None:
                continue
            window_ok = True
            batch.extend(rows)
            if rows and product.endswith("_SP"):
                break
        if window_ok:
            ok = True
            points.extend(batch)
        time.sleep(0.25)
        cursor = window_end + timedelta(days=1)
    # unique to a hundredth of a degree and the calendar day is already lost; keep each hit
    return points, ok


def fetch(key: str, product: str, window_end: date, day_range: int) -> list[tuple[float, float]] | None:
    # date is the last day; day_range counts backward, inclusive
    url = (
        f"{BASE}/{key}/{product}/{WEST},{SOUTH},{EAST},{NORTH}/{day_range}/{window_end.isoformat()}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "TermalWave/0.1 (+https://termalwave.space)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        # 400/404 means this product has no archive for that date
        if exc.code in (400, 404):
            return None
        print(f"  {product} {window_end.isoformat()} HTTP {exc.code}", file=sys.stderr)
        return None
    except Exception as exc:
        print(f"  {product} {window_end.isoformat()} failed: {exc}", file=sys.stderr)
        return None
    rows = list(csv.DictReader(io.StringIO(text)))
    out: list[tuple[float, float]] = []
    for row in rows:
        try:
            lat = float(row.get("latitude") or "")
            lon = float(row.get("longitude") or "")
        except ValueError:
            continue
        if not (SOUTH <= lat <= NORTH and WEST <= lon <= EAST):
            continue
        out.append((lon, lat))
    return out


def write_png(path: Path, points: list[tuple[float, float]]) -> None:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for lon, lat in points:
        x = int(round((lon - WEST) / (EAST - WEST) * (WIDTH - 1)))
        y = int(round((NORTH - lat) / (NORTH - SOUTH) * (HEIGHT - 1)))
        r = 3
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 176, 48, 230))
    image.save(path)


def patch_dataset(counts: dict[int, int]) -> None:
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    for row in data.get("layers") or []:
        if row.get("id") != "incendios":
            continue
        row["honesty"] = "measured"
        row["unit"] = "detecciones"
        row["range"] = [0, max(1, max(counts.values()))]
        row["note"] = SOURCE
        row["decimals"] = 0
    for seg in data.get("segments") or []:
        for tick in seg.get("ticks") or []:
            label = str(tick.get("label") or "")
            if not label.isdigit():
                continue
            year = int(label)
            frames = tick.setdefault("frames", {})
            if year not in counts:
                if (frames.get("incendios") or {}).get("honesty") == "example":
                    frames["incendios"] = None
                continue
            frames["incendios"] = {
                "url": f"./overlays/timeline/incendios/{year}.png",
                "bounds": {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH},
                "kind": "composite",
                "honesty": "measured",
                "source": SOURCE,
                "mean": counts[year],
            }
    DATASET.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {DATASET.relative_to(_REPO)}")


if __name__ == "__main__":
    raise SystemExit(main())
