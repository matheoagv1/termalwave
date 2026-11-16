"""Snapshot celestrak gp elements into web/public/satellites/gp-<group>.json.

Same shape as GET /api/satellites (preview/src/satellites.js), so the web app
runs offline and under vite dev, where /api is not served.

usage: build_satellite_snapshot.py [GROUP ...]   (default: every group in app-config.json)
celestrak asks clients not to refetch a group more often than every 2 h.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_CONFIG = ROOT / "web" / "public" / "app-config.json"
OUT = ROOT / "web" / "public" / "satellites"

# fields json2satrec reads; keep in sync with OMM_FIELDS in preview/src/satellites.js
OMM_FIELDS = (
    "OBJECT_NAME",
    "OBJECT_ID",
    "EPOCH",
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "NORAD_CAT_ID",
    "ELEMENT_SET_NO",
    "BSTAR",
    "MEAN_MOTION_DOT",
    "MEAN_MOTION_DDOT",
)


def fetch_group(upstream: str, group: str) -> list[dict]:
    url = f"{upstream}?{urllib.parse.urlencode({'GROUP': group, 'FORMAT': 'json'})}"
    req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": "termalwave-snapshot"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise SystemExit(f"{group}: celestrak answered non-json: {text[:80]!r}")
    if not isinstance(data, list) or not data:
        raise SystemExit(f"{group}: empty group")
    return data


def normalize(group: str, day: str, raw: list[dict]) -> dict:
    sats = [
        {"name": str(rec["OBJECT_NAME"]).strip(), "norad": int(rec["NORAD_CAT_ID"]), "omm": {f: rec.get(f) for f in OMM_FIELDS}}
        for rec in raw
        if rec.get("OBJECT_NAME") and rec.get("NORAD_CAT_ID") is not None
    ]
    return {"group": group, "day": day, "satellites": sats}


def main(argv: list[str]) -> int:
    cfg = json.loads(APP_CONFIG.read_text(encoding="utf-8"))["space"]["satellites"]
    groups = argv or cfg["groups"]
    unknown = [g for g in groups if g not in cfg["groups"]]
    if unknown:
        print(f"not in space.satellites.groups: {', '.join(unknown)}", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for group in groups:
        doc = normalize(group, day, fetch_group(cfg["upstream"], group))
        path = OUT / f"gp-{group}.json"
        path.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{path.relative_to(ROOT)}: {len(doc['satellites'])} satellites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
