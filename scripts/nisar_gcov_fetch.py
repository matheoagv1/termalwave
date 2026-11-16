#!/usr/bin/env python3
"""Download NISAR GCOV (and optional GUNW) and write map overlays.

CMR search is public. The .h5 download needs EARTHDATA_TOKEN in the
environment. The token is not printed and the .h5 files stay in data/raw/.

On the VPS:

    cd /srv/sites/nasaspaceappchallenge
    # EARTHDATA_TOKEN is already in the environment. Do not echo it.
    python3 scripts/nisar_gcov_fetch.py

Expect, when the token can fetch the files:

    data/raw/NISAR_L2_PR_GCOV_....h5          (gitignored)
    web/public/overlays/nisar/*_HV.png        measured, -30 to -5 dB
    web/public/overlays/nisar/*_HH.png        measured, -25 to 0 dB
    web/public/overlays/nisar/change_*.png    derived, -6 to +6 dB
    web/public/overlays/nisar/rvi_*.png       inferred, 4*HV/(HH+HV)
    web/public/dataset.json                   frames updated

Then rebuild web (do not commit web/dist from a laptop copy of this repo)
and deploy. Commit the png files and dataset.json if they should stay on
master. Never commit data/raw/*.h5 or the token.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from termalwave._bootstrap import ensure_vendored

ensure_vendored()

import h5py
import numpy as np

from termalwave.process.nisar_raster import (
    GeoGrid,
    change_db,
    db_stats,
    list_datasets,
    los_mm,
    paint,
    read_window,
    resample_onto,
    rvi_linear,
    save_png,
)

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
AOI = (-64.35, -27.90, -64.15, -27.70)  # west, south, east, north. Study crop, not a fake georef.
OUT = _REPO / "web" / "public" / "overlays" / "nisar"
DATASET = _REPO / "web" / "public" / "dataset.json"
RAW = _REPO / "data" / "raw"


def main() -> int:
    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    granules = pick_gcov(search("NISAR_L2_GCOV_V1"))
    if len(granules) < 1:
        print("No validated GCOV on track 140 descending for the study area.", file=sys.stderr)
        return 1
    grids = []
    for item in granules:
        path = download(item, token)
        print(f"h5 {path.name}")
        print_tree(path)
        hv, epsg = read_window(str(path), "HVHV", AOI, to_db=True)
        print(f"  EPSG:{epsg}")
        hh, _ = read_window(str(path), "HHHH", AOI, to_db=True)
        hh_lin, _ = read_window(str(path), "HHHH", AOI, to_db=False)
        hv_lin, _ = read_window(str(path), "HVHV", AOI, to_db=False)
        stem = f"{item['date']}_t{item['track']}_f{item['frame']}"
        write_measured(stem + "_HV", hv, "HV", item)
        write_measured(stem + "_HH", hh, "HH", item)
        rvi = GeoGrid(rvi_linear(hh_lin.values, hv_lin.values), hv.lon, hv.lat)
        write_layer(stem + "_RVI", rvi, "rvi", "inferred", item, product="RVI")
        grids.append((item, hv))
        print(f"  HV stats {db_stats(hv.values)}")

    if len(grids) >= 2:
        earlier_item, earlier = grids[0]
        later_item, later = grids[-1]
        aligned = earlier
        if earlier.values.shape != later.values.shape or not np.array_equal(earlier.lon, later.lon):
            aligned = GeoGrid(resample_onto(earlier, later), later.lon, later.lat)
        delta = GeoGrid(change_db(later.values, aligned.values), later.lon, later.lat)
        name = f"change_{earlier_item['date']}_{later_item['date']}_HV"
        write_layer(name, delta, "change", "derived", later_item, product="GCOV_CHANGE")
        print(f"change {name} {db_stats(delta.values)}")
        patch_dataset(later_item, later, delta, name)

    gunw = pick_gunw(search("NISAR_L2_GUNW_V1"))
    if gunw:
        path = download(gunw, token)
        print(f"gunw {path.name}")
        print_tree(path)
        write_gunw(path, gunw)
    return 0


def search(short_name: str) -> list[dict]:
    west, south, east, north = AOI
    query = urllib.parse.urlencode(
        {
            "short_name": short_name,
            "bounding_box": f"{west},{south},{east},{north}",
            "temporal": "2025-07-30T00:00:00Z,",
            "page_size": 100,
        }
    )
    with urllib.request.urlopen(f"{CMR}?{query}", timeout=60) as resp:
        payload = json.loads(resp.read().decode())
    rows = []
    for entry in (payload.get("feed") or {}).get("entry") or []:
        title = str(entry.get("producer_granule_id") or entry.get("title") or "")
        parsed = parse_name(title)
        if not parsed:
            continue
        href = h5_href(entry)
        if not href:
            continue
        parsed["href"] = href
        parsed["title"] = title
        rows.append(parsed)
    return rows


def pick_gcov(rows: list[dict]) -> list[dict]:
    hits = [row for row in rows if row["track"] == 140 and row["direction"] == "D" and row["frame"] in {101, 102, 103}]
    by_date: dict[str, dict] = {}
    for row in hits:
        current = by_date.get(row["date"])
        if current is None or abs(row["frame"] - 102) < abs(current["frame"] - 102):
            by_date[row["date"]] = row
    dates = sorted(by_date)
    october = [d for d in dates if d[4:6] == "10"]
    november = [d for d in dates if d.startswith("20261102")]
    chosen = []
    if october:
        chosen.append(by_date[october[-1]])
    if november:
        chosen.append(by_date[november[-1]])
    elif dates:
        extra = by_date[dates[-1]]
        if extra not in chosen:
            chosen.append(extra)
    return chosen


def pick_gunw(rows: list[dict]) -> dict | None:
    hits = [row for row in rows if row.get("track") == 140 and row.get("direction") == "D"]
    return hits[-1] if hits else None


def parse_name(title: str) -> dict | None:
    parts = title.replace(".h5", "").split("_")
    if len(parts) < 12 or parts[0] != "NISAR" or parts[3] not in {"GCOV", "GUNW"}:
        return None
    try:
        track = int(parts[5])
        frame = int(parts[7])
    except ValueError:
        return None
    stamp = parts[11]
    if len(stamp) < 8 or not stamp[:8].isdigit():
        return None
    return {
        "product": parts[3],
        "track": track,
        "direction": parts[6],
        "frame": frame,
        "date": stamp[:8],
        "acquired_at": f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}T{stamp[9:11]}:{stamp[11:13]}:{stamp[13:15]}Z"
        if len(stamp) >= 15
        else f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}T00:00:00Z",
        "maturity": "validated",
    }


def h5_href(entry: dict) -> str:
    for link in entry.get("links") or []:
        href = str(link.get("href") or "")
        rel = str(link.get("rel") or "")
        if "data" in rel and href.startswith("https://") and ".h5" in href:
            return href
    return ""


def cached_h5(item: dict) -> Path | None:
    key = str(item.get("title") or "").replace(".h5", "")
    if not key or not RAW.is_dir():
        return None
    matches = [path for path in RAW.glob("*.h5") if key in path.name and path.stat().st_size > 1_000_000]
    if not matches:
        return None
    matches.sort(key=lambda path: path.stat().st_size, reverse=True)
    return matches[0]


def download(item: dict, token: str) -> Path:
    dest = cached_h5(item)
    if dest is not None:
        print(f"reuse {dest.name} ({dest.stat().st_size} bytes)")
        return dest
    if not token:
        raise SystemExit(
            "EARTHDATA_TOKEN is not set and data/raw has no matching .h5. "
            "Export the token to download. Do not paste it into git."
        )
    dest = RAW / f"{item['title'].replace('.h5', '')}.h5"
    request = urllib.request.Request(item["href"], headers={"Authorization": f"Bearer {token}"})
    opener = urllib.request.build_opener(_Redirect())
    print(f"download {item['title']}")
    with opener.open(request, timeout=180) as resp, dest.open("wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    print(f"  wrote {dest.stat().st_size} bytes")
    return dest


class _Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is None:
            return None
        host = urllib.parse.urlparse(newurl).hostname or ""
        if "earthdata.nasa.gov" not in host and "asf.earthdatacloud" not in host:
            new.remove_header("Authorization")
        return new


def print_tree(path: Path) -> None:
    with h5py.File(path, "r") as handle:
        names = list_datasets(handle)
    print(f"  datasets {len(names)}")
    for name in names[:40]:
        print(f"    {name}")


def write_measured(stem: str, grid, kind: str, item: dict) -> None:
    write_layer(stem, grid, kind, "measured", item, product="NISAR_L2_GCOV_V1")


def write_layer(stem: str, grid, kind: str, honesty: str, item: dict, product: str) -> None:
    rgba, window = paint(grid.values, kind)
    png = OUT / f"{stem}.png"
    save_png(png, rgba)
    stats = db_stats(grid.values)
    sidecar = {
        "png": f"./overlays/nisar/{png.name}",
        "bounds": grid.bounds,
        "honesty": honesty,
        "product": product,
        "granule": item.get("title"),
        "acquired_at": item.get("acquired_at"),
        "maturity": item.get("maturity"),
        "pol": kind,
        "range": list(window),
        "stats": stats,
    }
    (OUT / f"{stem}.json").write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print(f"  {png.relative_to(_REPO)}")


def write_gunw(path: Path, item: dict) -> None:
    for suffix in ("coherenceMagnitude", "coherence", "coh"):
        try:
            grid, _ = read_window(str(path), suffix, AOI, to_db=False)
        except ValueError:
            continue
        write_layer(f"gunw_{item['date']}_coh", grid, "coherence", "measured", item, product="NISAR_L2_GUNW_V1")
        break
    else:
        print("  no coherence dataset; see the list above")
    for suffix in ("unwrappedPhase", "unwrappedInterferogram"):
        try:
            grid, _ = read_window(str(path), suffix, AOI, to_db=False)
        except ValueError:
            continue
        grid.values = los_mm(grid.values)
        write_layer(f"gunw_{item['date']}_los_mm", grid, "change", "derived", item, product="NISAR_L2_GUNW_V1")
        print("  LOS mm from unwrapped phase, lambda 0.24 m")
        break


def patch_dataset(item: dict, hv, delta, change_name: str) -> None:
    if not DATASET.is_file():
        print("dataset.json missing; png files are still on disk")
        return
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    year = int(item["date"][:4])
    hv_png = OUT / f"{item['date']}_t{item['track']}_f{item['frame']}_HV.png"
    frame = {
        "url": f"./overlays/nisar/{hv_png.name}",
        "bounds": hv.bounds,
        "kind": "acquisition",
        "honesty": "measured",
        "product": "NISAR_L2_GCOV_V1",
        "granule": item["title"],
        "acquired_at": item["acquired_at"],
        "maturity": "validated",
        "pol": "HV",
        "mean_db": db_stats(hv.values)["mean"],
    }
    _set_frame(data, "radar", year, frame)
    _ensure_layer(data, "change", "Change between dates", "derived", "dB", [-6, 6])
    _set_frame(
        data,
        "change",
        year,
        {
            "url": f"./overlays/nisar/{change_name}.png",
            "bounds": delta.bounds,
            "kind": "acquisition",
            "honesty": "derived",
            "product": "GCOV_CHANGE",
            "granule": item["title"],
            "acquired_at": item["acquired_at"],
            "pol": "HV",
            "mean_db": db_stats(delta.values)["mean"],
        },
    )
    rvi_name = f"{item['date']}_t{item['track']}_f{item['frame']}_RVI.png"
    _ensure_layer(data, "rvi", "RVI", "inferred", "", [0, 1])
    _set_frame(
        data,
        "rvi",
        year,
        {
            "url": f"./overlays/nisar/{rvi_name}",
            "bounds": hv.bounds,
            "kind": "acquisition",
            "honesty": "inferred",
            "product": "RVI",
            "granule": item["title"],
            "acquired_at": item["acquired_at"],
            "formula": "4*HV/(HH+HV)",
        },
    )
    for layer in data.get("layers") or []:
        if layer.get("id") == "radar":
            layer["honesty"] = "measured"
            layer["unit"] = "dB"
            layer["range"] = [-30, -5]
    DATASET.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"updated {DATASET.relative_to(_REPO)}")


def _ensure_layer(data: dict, lid: str, label: str, honesty: str, unit: str, rng: list[float]) -> None:
    layers = data.setdefault("layers", [])
    if any(row.get("id") == lid for row in layers):
        return
    layers.append(
        {
            "id": lid,
            "label": label,
            "label_en": label,
            "label_es": {"change": "Cambio entre fechas", "rvi": "RVI"}.get(lid, label),
            "unit": unit,
            "range": rng,
            "ramp": [],
            "note": "",
            "honesty": honesty,
        }
    )


def _set_frame(data: dict, lid: str, year: int, frame: dict) -> None:
    for seg in data.get("segments") or []:
        for tick in seg.get("ticks") or []:
            label = str(tick.get("label") or "")
            tick_year = int(label) if label.isdigit() else 0
            frames = tick.setdefault("frames", {})
            if tick_year == year:
                frames[lid] = frame
            elif lid not in frames:
                frames[lid] = None


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"nisar_gcov_fetch failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
