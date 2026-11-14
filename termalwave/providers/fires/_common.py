"""Shared FIRMS CSV → Hotspot mapping."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from termalwave.model import Hotspot, utc_now


def rows_to_hotspots(
    rows: list[dict[str, str]],
    *,
    source: str,
    product: str,
    quality_rank: int,
    license_name: str,
) -> list[Hotspot]:
    out: list[Hotspot] = []
    now = utc_now()
    for row in rows:
        try:
            lat = float(row.get("latitude") or row.get("lat") or "")
            lon = float(row.get("longitude") or row.get("lon") or "")
        except ValueError:
            continue
        acq_date = (row.get("acq_date") or row.get("date") or "").strip()
        acq_time = (row.get("acq_time") or "0000").strip().zfill(4)
        try:
            observed = datetime(
                int(acq_date[0:4]),
                int(acq_date[5:7]),
                int(acq_date[8:10]),
                int(acq_time[0:2]),
                int(acq_time[2:4]),
                tzinfo=timezone.utc,
            )
        except (ValueError, IndexError):
            continue
        brightness = None
        for key in ("brightness", "bright_ti4", "frp"):
            if row.get(key):
                try:
                    brightness = float(row[key])
                except ValueError:
                    brightness = None
                break
        out.append(
            Hotspot(
                lat=lat,
                lon=lon,
                observed_at=observed,
                brightness=brightness,
                confidence=(row.get("confidence") or None),
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=quality_rank,
                license=license_name,
            )
        )
    return out


def quality_for(kind_cfg: dict[str, Any], name: str, default: int = 50) -> int:
    ranks = kind_cfg.get("quality_rank") or {}
    return int(ranks.get(name, default))
