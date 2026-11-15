"""Build web/public/sky/: bright stars + milky way (from god's eye view) and
constellation figures + names (d3-celestial, BSD-3).

usage: build_sky_assets.py [--gev DIR] [--d3 DIR]
  --gev  god's eye view sky data dir (default references/gods-eye-view/src/data/local_data/sky)
  --d3   dir with constellations.lines.json, constellations.json, LICENSE
         (default: fetched from github once)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "sky"
D3_BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/"
D3_FILES = ("data/constellations.lines.json", "data/constellations.json", "LICENSE")
FACES = ("px", "nx", "py", "ny", "pz", "nz")

# names people in argentina use; d3-celestial "es" covers the rest
ES_OVERRIDES = {
    "Ari": "Aries",
    "Tau": "Tauro",
    "Gem": "Géminis",
    "Cnc": "Cáncer",
    "Leo": "Leo",
    "Vir": "Virgo",
    "Lib": "Libra",
    "Psc": "Piscis",
    "Car": "Quilla",
    "Oct": "Octante",
    "Nor": "Escuadra",
}


def fetch_d3(dest: Path) -> dict[str, str]:
    dest.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for rel in D3_FILES:
        with urllib.request.urlopen(D3_BASE + rel, timeout=30) as r:
            body = r.read()
        (dest / Path(rel).name).write_bytes(body)
        hashes[Path(rel).name] = hashlib.sha256(body).hexdigest()
    return hashes


def ra(lon: float) -> float:
    # d3-celestial stores ra as longitude in -180..180
    return round(lon % 360.0, 3)


def build_constellations(d3: Path) -> dict:
    lines = json.loads((d3 / "constellations.lines.json").read_text())
    names = json.loads((d3 / "constellations.json").read_text())
    figures: dict[str, list[list[float]]] = {}
    for f in lines["features"]:
        strips = figures.setdefault(f["id"], [])
        for strip in f["geometry"]["coordinates"]:
            strips.append([v for lon, lat in strip for v in (ra(lon), round(lat, 3))])
    labels = []
    for f in names["features"]:
        p = f["properties"]
        es = ES_OVERRIDES.get(f["id"], p.get("es") or p["name"]).replace("\u2005", " ")
        lon, lat = f["geometry"]["coordinates"]
        labels.append([f["id"], es, p["name"], ra(lon), round(lat, 3), int(p.get("rank", 3))])
    return {
        "meta": {
            "source": "d3-celestial (Olaf Frohn), data/constellations.lines.json + data/constellations.json",
            "url": "https://github.com/ofrohn/d3-celestial",
            "license": "BSD-3-Clause",
            "frame": "ICRF/J2000, degrees",
            "lines": "id -> strips of [raDeg, decDeg, ...]",
            "labels": ["id", "es", "la", "raDeg", "decDeg", "rank"],
        },
        "lines": figures,
        "labels": labels,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gev", type=Path, default=ROOT / "references/gods-eye-view/src/data/local_data/sky")
    ap.add_argument("--d3", type=Path)
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.gev / "bright_stars.json", OUT / "bright_stars.json")
    for face in FACES:
        shutil.copyfile(args.gev / f"milkyway_{face}.webp", OUT / f"milkyway_{face}.webp")

    d3 = args.d3 or OUT / ".d3-celestial"
    if not args.d3:
        fetch_d3(d3)
    data = build_constellations(d3)
    (OUT / "constellations.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    shutil.copyfile(d3 / "LICENSE", OUT / "LICENSE.d3-celestial.txt")
    if not args.d3:
        shutil.rmtree(d3)
    print(f"sky assets -> {OUT.relative_to(ROOT)} ({len(data['lines'])} figures, {len(data['labels'])} labels)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
