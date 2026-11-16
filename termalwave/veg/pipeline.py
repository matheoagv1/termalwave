"""Vegetation analytics per grid cell from MODIS (ORNL DAAC subsets) and Open-Meteo rain.

Offline because one bbox needs ~70 ORNL calls of 8 s each: far past a Worker's
time and subrequest budget. The Worker serves the JSON this writes.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import sys

# stdlib only, so it runs as a plain script without the vendored 3.11 bootstrap
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ornl import Ornl, chunks, pixel_lonlat  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "preview" / "src" / "veg" / "data"
CACHE = ROOT / ".tmp-veg" / "cache"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
RAIN_YEARS = 2  # rain history requested from Open-Meteo (keeps the call small)
OM_PAUSE_S = 2  # pause before each live Open-Meteo request
OM_RETRY_S = 30  # wait before the single retry after an HTTP 429
EPOCH = dt.date(1970, 1, 1)

NDVI = ("MOD13Q1", "250m_16_days_NDVI", -3000, 0.0001)
NPP = ("MOD17A3HGF", "Npp_500m", 32767, 0.0001)
LC = ("MCD12Q1", "LC_Type1", 255, 1)
GREENUP = ("MCD12Q2", "Greenup.Num_Modes_01", 32767, 1)
CROP, MOSAIC = 12, 14  # IGBP croplands, cropland/natural vegetation mosaic
SERIES_N = 46  # two years of 16-day composites for the sparkline
MIN_VALID = 0.3  # share of a cell's pixels that must be valid

# rain onset: first day whose 10-day rain reaches 25 mm and is not followed by
# 20 days under 5 mm (a common agronomic false-start rule)
ONSET_SUM_MM, ONSET_DAYS, DRY_SPELL_DAYS, DRY_SPELL_MM = 25.0, 10, 20, 5.0


def grid(bbox: list[float], nx: int, ny: int) -> list[dict]:
    w, s, e, n = bbox
    dx, dy = (e - w) / nx, (n - s) / ny
    cells = []
    for j in range(ny):
        for i in range(nx):
            cw, cs = w + i * dx, s + j * dy
            cells.append({
                "id": f"c{j}_{i}",
                "bounds": [round(cw, 4), round(cs, 4), round(cw + dx, 4), round(cs + dy, 4)],
                "lon": round(cw + dx / 2, 4),
                "lat": round(cs + dy / 2, 4),
            })
    return cells


def cell_index(meta: dict, cells: list[dict]) -> list[int]:
    """Cell id per pixel (-1 outside the grid)."""
    w, s = cells[0]["bounds"][:2]
    dx = cells[0]["bounds"][2] - w
    dy = cells[0]["bounds"][3] - s
    nx = sum(1 for c in cells if c["id"].startswith("c0_"))
    ny = len(cells) // nx
    idx = []
    for lon, lat in pixel_lonlat(meta):
        i, j = int((lon - w) // dx), int((lat - s) // dy)
        idx.append(j * nx + i if 0 <= i < nx and 0 <= j < ny else -1)
    return idx


def reduce(sub: dict, idx: list[int], ncell: int, fill: int, how: str) -> dict[str, list]:
    """Per date, one value per cell: mean / median / class counts of valid pixels."""
    out: dict[str, list] = {}
    for layer in sub["subset"]:
        buckets: list[list[int]] = [[] for _ in range(ncell)]
        totals = [0] * ncell
        for v, k in zip(layer["data"], idx):
            if k < 0:
                continue
            totals[k] += 1
            if v != fill:
                buckets[k].append(v)
        vals: list = []
        for b, t in zip(buckets, totals):
            if not t or len(b) / t < MIN_VALID:
                vals.append(None)
            elif how == "mean":
                vals.append(sum(b) / len(b))
            elif how == "median":
                vals.append(statistics.median(b))
            else:
                vals.append({str(c): b.count(c) for c in set(b)} | {"_n": len(b)})
        out[layer["calendar_date"]] = vals
    return out


def fetch_band(o: Ornl, spec: tuple, bbox: list[float], cells: list[dict], how: str, since: str = "A2000001") -> dict[str, list]:
    product, band, fill, _ = spec
    lat, lon = (bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2
    # 1 km margin so the request covers the bbox corners in the sinusoidal grid
    km_ab = int((bbox[3] - bbox[1]) / 2 * 111.2) + 1
    km_lr = int((bbox[2] - bbox[0]) / 2 * 111.32 * max(abs(_cos(bbox[1])), abs(_cos(bbox[3])))) + 1
    dates = [d for d in o.dates(product, round(lat, 4), round(lon, 4)) if d >= since]
    pieces = chunks(dates)

    def one(p: tuple[str, str]) -> dict:
        return o.subset(product, band, round(lat, 4), round(lon, 4), p[0], p[1], km_ab, km_lr)

    with ThreadPoolExecutor(3) as pool:
        subs = list(pool.map(one, pieces))
    idx = cell_index(subs[0], cells)
    merged: dict[str, list] = {}
    for sub in subs:
        merged |= reduce(sub, idx, len(cells), fill, how)
    return dict(sorted(merged.items()))


def _cos(lat: float) -> float:
    import math

    return math.cos(math.radians(lat))


def season_start(d: dt.date, south: bool) -> int:
    """Growing-season year: July to June in the south, calendar year in the north."""
    if not south:
        return d.year
    return d.year if d.month >= 7 else d.year - 1


def percentile(xs: list[float], q: float) -> float:
    s = sorted(xs)
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def _om_get(req: urllib.request.Request) -> Any:
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def rain(cells: list[dict], start: str, end: str) -> list[dict[str, float]]:
    """Daily precipitation per cell centre from the Open-Meteo archive."""
    out: list[dict[str, float]] = []
    for i in range(0, len(cells), 6):
        part = cells[i : i + 6]
        url = (
            f"{ARCHIVE}?latitude={','.join(str(c['lat']) for c in part)}"
            f"&longitude={','.join(str(c['lon']) for c in part)}"
            f"&start_date={start}&end_date={end}&daily=precipitation_sum&timezone=UTC"
        )
        key = CACHE / f"om-{hashlib.sha1(url.encode()).hexdigest()}.json"
        if key.exists():
            raw = json.loads(key.read_text())
        else:
            req = urllib.request.Request(url, headers={"User-Agent": "termalwave-veg"})
            time.sleep(OM_PAUSE_S)
            try:
                raw = _om_get(req)
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
                time.sleep(OM_RETRY_S)
                raw = _om_get(req)
            key.write_text(json.dumps(raw))
        for block in raw if isinstance(raw, list) else [raw]:
            d = block["daily"]
            out.append({t: p for t, p in zip(d["time"], d["precipitation_sum"]) if p is not None})
    return out


def onset(daily: dict[str, float], season: int, south: bool, last: dt.date) -> tuple[str | None, bool]:
    """Rain onset date in a season, and whether the false-start check was complete."""
    start = dt.date(season, 7, 1) if south else dt.date(season, 1, 1)
    d = start
    end = min(start + dt.timedelta(days=365), last)
    while d <= end:
        wsum = sum(daily.get((d + dt.timedelta(k)).isoformat(), 0.0) for k in range(ONSET_DAYS))
        if wsum >= ONSET_SUM_MM:
            after = d + dt.timedelta(ONSET_DAYS)
            complete = after + dt.timedelta(DRY_SPELL_DAYS) <= last
            spell_ok = True
            # any 20-day run under 5 mm right after the wet spell marks a false start
            look = [daily.get((after + dt.timedelta(k)).isoformat(), 0.0) for k in range(DRY_SPELL_DAYS)]
            if complete and sum(look) < DRY_SPELL_MM:
                spell_ok = False
            if spell_ok:
                return d.isoformat(), complete
        d += dt.timedelta(1)
    return None, True


def build(bbox: list[float], nx: int, ny: int, region: str) -> Path:
    o = Ornl(CACHE)
    cells = grid(bbox, nx, ny)
    south = (bbox[1] + bbox[3]) / 2 < 0
    today = dt.date.today()

    ndvi = fetch_band(o, NDVI, bbox, cells, "mean", since="A2001001")
    npp = fetch_band(o, NPP, bbox, cells, "median")
    lc = fetch_band(o, LC, bbox, cells, "classes")
    gu = fetch_band(o, GREENUP, bbox, cells, "median")
    last_rain = today - dt.timedelta(days=6)
    rain_start = today - dt.timedelta(days=365 * RAIN_YEARS)
    rains = rain(cells, rain_start.isoformat(), last_rain.isoformat())

    ndates = list(ndvi)
    latest = ndates[-1]
    latest_doy = dt.date.fromisoformat(latest).timetuple().tm_yday
    for k, c in enumerate(cells):
        # a. NDVI now and anomaly versus the same 16-day composite in past years
        series = [(d, ndvi[d][k]) for d in ndates]
        now = series[-1][1]
        same = [v for d, v in series[:-1] if v is not None and dt.date.fromisoformat(d).timetuple().tm_yday == latest_doy]
        c["ndvi"] = round(now * NDVI[3], 4) if now is not None else None
        c["ndvi_date"] = latest
        c["ndvi_clim_n"] = len(same)
        if now is not None and len(same) >= 5:
            mean = sum(same) / len(same)
            sd = statistics.pstdev(same)
            c["ndvi_clim_mean"] = round(mean * NDVI[3], 4)
            c["ndvi_anomaly"] = round((now - mean) * NDVI[3], 4)
            c["ndvi_anomaly_z"] = round((now - mean) / sd, 2) if sd > 0 else None
        tail = series[-SERIES_N:]
        c["series"] = [round(v * NDVI[3], 3) if v is not None else None for _, v in tail]
        c["series_dates"] = [d for d, _ in tail]

        # c. month of the NDVI peak per complete season
        by_season: dict[int, tuple[float, str]] = {}
        for d, v in series:
            if v is None:
                continue
            dd = dt.date.fromisoformat(d) + dt.timedelta(days=8)  # composite mid-point
            sy = season_start(dd, south)
            if sy not in by_season or v > by_season[sy][0]:
                by_season[sy] = (v, dd.isoformat())
        first, lastd = dt.date.fromisoformat(ndates[0]), dt.date.fromisoformat(latest)
        full = {
            sy: dd
            for sy, (_, dd) in by_season.items()
            if season_start(first, south) < sy < season_start(lastd, south)
        }
        months = [int(dd[5:7]) for dd in full.values()]
        if len(months) >= 5:
            mode = max(set(months), key=months.count)
            c["peak_month"] = mode
            c["peak_consistency"] = round(months.count(mode) / len(months), 2)
            c["peak_years"] = len(months)
            c["peak_months_by_season"] = {str(sy): int(dd[5:7]) for sy, dd in sorted(full.items())}

        # b. productivity: latest annual NPP against the cell's own record
        vals = [(d, v[k]) for d, v in npp.items() if v[k] is not None]
        if len(vals) >= 6:
            hist = [v for _, v in vals]
            ly, lv = vals[-1]
            p33, p67 = percentile(hist, 1 / 3), percentile(hist, 2 / 3)
            c["npp_year"] = int(ly[:4])
            c["npp_kgc_m2"] = round(lv * NPP[3], 4)
            c["npp_p33"] = round(p33 * NPP[3], 4)
            c["npp_p67"] = round(p67 * NPP[3], 4)
            c["npp_years"] = len(hist)
            c["productivity_class"] = 0 if lv < p33 else (2 if lv > p67 else 1)
            c["productivity_pct"] = round(sum(1 for h in hist if h <= lv) / len(hist), 2)
        lcl = list(lc.items())
        if lcl and lcl[-1][1][k]:
            year, counts = lcl[-1][0], lcl[-1][1][k]
            n = counts["_n"]
            c["lc_year"] = int(year[:4])
            c["cropland_share"] = round((counts.get(str(CROP), 0) + 0.5 * counts.get(str(MOSAIC), 0)) / n, 2)
            top = max((cl for cl in counts if cl != "_n"), key=lambda cl: counts[cl])
            c["lc_majority_igbp"] = int(top)

        # d. green-up date per season and the lag after rain onset
        rows = []
        for d, v in gu.items():
            if v[k] is None:
                continue
            gdate = EPOCH + dt.timedelta(days=int(v[k]))
            sy = season_start(gdate, south)
            on, _ = onset(rains[k], sy, south, last_rain)
            lag = (gdate - dt.date.fromisoformat(on)).days if on else None
            rows.append({"season": sy, "greenup": gdate.isoformat(), "rain_onset": on, "lag_days": lag})
        if rows:
            r = rows[-1]
            c["greenup_date"] = r["greenup"]
            c["greenup_doy"] = dt.date.fromisoformat(r["greenup"]).timetuple().tm_yday
            c["greenup_season"] = r["season"]
            c["rain_onset"] = r["rain_onset"]
            c["onset_to_greenup_days"] = r["lag_days"]
            c["greenup_history"] = rows

        # e. next green-up from past lags (or past dates) and this season's onset
        if len(rows) >= 5:
            cur = season_start(today, south)
            s0 = dt.date(cur, 7, 1) if south else dt.date(cur, 1, 1)
            on_now, complete = onset(rains[k], cur, south, last_rain)
            lags = [r["lag_days"] for r in rows if r["lag_days"] is not None and r["lag_days"] >= -30]
            offs = [(dt.date.fromisoformat(r["greenup"]) - (dt.date(r["season"], 7, 1) if south else dt.date(r["season"], 1, 1))).days for r in rows]
            if on_now and len(lags) >= 5:
                base, spread = dt.date.fromisoformat(on_now), lags
                c["pred_basis"] = "rain_onset_plus_lag"
            else:
                base, spread = s0, offs
                c["pred_basis"] = "past_greenup_dates"
            p25, p50, p75 = (percentile(spread, q) for q in (0.25, 0.5, 0.75))
            iqr = p75 - p25
            c["pred_greenup"] = (base + dt.timedelta(days=round(p50))).isoformat()
            c["pred_window_start"] = (base + dt.timedelta(days=round(p25))).isoformat()
            c["pred_window_end"] = (base + dt.timedelta(days=round(p75))).isoformat()
            c["pred_rain_onset"] = on_now
            c["pred_onset_provisional"] = bool(on_now and not complete)
            c["pred_years"] = len(spread)
            c["pred_iqr_days"] = round(iqr)
            # narrow past spread and a long record give a higher score
            c["pred_confidence"] = round(max(0.0, 1 - iqr / 90) * min(1.0, len(spread) / 10), 2)

    doc: dict[str, Any] = {
        "region": region,
        "bbox": bbox,
        "grid": [nx, ny],
        "built": today.isoformat(),
        "latest_ndvi_date": latest,
        "rain_until": last_rain.isoformat(),
        "cells": cells,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{region}.json"
    path.write_text(json.dumps(doc, separators=(",", ":")))
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bbox", default="-64.6,-28.2,-63.9,-27.4")
    ap.add_argument("--grid", default="6x6")
    ap.add_argument("--region", default="santiago")
    a = ap.parse_args()
    nx, ny = (int(v) for v in a.grid.split("x"))
    print(build([float(v) for v in a.bbox.split(",")], nx, ny, a.region))


if __name__ == "__main__":
    main()
