"""Pure merge policies for unified providers."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Iterable

from termalwave.model import (
    DailyWeather,
    ElevationSample,
    GranuleRef,
    Hotspot,
    Place,
    SceneRef,
)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def merge_fires_union_dedupe(
    batches: Iterable[list[Hotspot]],
    *,
    distance_km: float,
    time_hours: float,
) -> list[Hotspot]:
    """Union all batches; drop duplicates preferring lower quality_rank (better)."""
    merged: list[Hotspot] = []
    window = timedelta(hours=time_hours)
    for batch in batches:
        for spot in batch:
            dup_idx = None
            for idx, existing in enumerate(merged):
                if abs(existing.observed_at - spot.observed_at) > window:
                    continue
                if _haversine_km(existing.lat, existing.lon, spot.lat, spot.lon) > distance_km:
                    continue
                dup_idx = idx
                break
            if dup_idx is None:
                merged.append(spot)
                continue
            current = merged[dup_idx]
            if spot.quality_rank < current.quality_rank:
                merged[dup_idx] = spot
            elif spot.quality_rank == current.quality_rank and spot.observed_at > current.observed_at:
                merged[dup_idx] = spot
    merged.sort(key=lambda h: h.observed_at)
    return merged


def merge_weather_first_available(
    batches: list[list[DailyWeather]],
) -> list[DailyWeather]:
    """Per day: take first provider that has the day; later providers fill gaps."""
    by_day: dict = {}
    for batch_idx, batch in enumerate(batches):
        for row in batch:
            key = row.day.isoformat()
            if key not in by_day:
                by_day[key] = row
                continue
            # Fill missing numeric fields from later providers; mark filled.
            current = by_day[key]
            if batch_idx == 0:
                continue
            changed = False
            temp_max = current.temp_max_c
            temp_min = current.temp_min_c
            precip = current.precip_mm
            if temp_max is None and row.temp_max_c is not None:
                temp_max = row.temp_max_c
                changed = True
            if temp_min is None and row.temp_min_c is not None:
                temp_min = row.temp_min_c
                changed = True
            if precip is None and row.precip_mm is not None:
                precip = row.precip_mm
                changed = True
            if changed:
                by_day[key] = DailyWeather(
                    day=current.day,
                    temp_max_c=temp_max,
                    temp_min_c=temp_min,
                    precip_mm=precip,
                    source=f"{current.source}+{row.source}",
                    product=current.product,
                    retrieved_at=row.retrieved_at,
                    quality_rank=current.quality_rank,
                    license=current.license,
                    filled=True,
                )
    return [by_day[k] for k in sorted(by_day.keys())]


def pick_optical_near_nisar(
    scenes: list[SceneRef],
    nisar_times: list[datetime],
    *,
    max_cloud_pct: float,
    max_day_delta: int,
) -> list[SceneRef]:
    """For each NISAR time, pick least cloudy scene within day window."""
    picked: list[SceneRef] = []
    for target in nisar_times:
        candidates: list[SceneRef] = []
        for scene in scenes:
            delta = abs((scene.acquired_at.date() - target.date()).days)
            if delta > max_day_delta:
                continue
            cloud = scene.cloud_pct if scene.cloud_pct is not None else 100.0
            if cloud > max_cloud_pct:
                continue
            candidates.append(scene)
        if not candidates:
            continue
        candidates.sort(
            key=lambda s: (
                s.cloud_pct if s.cloud_pct is not None else 100.0,
                abs((s.acquired_at - target).total_seconds()),
            )
        )
        best = candidates[0]
        if best not in picked:
            picked.append(best)
    return picked


def prefer_validated_granules(granules: list[GranuleRef]) -> list[GranuleRef]:
    """Prefer validated over provisional for the same calendar day."""
    by_day: dict[str, GranuleRef] = {}
    rank = {"validated": 0, "provisional": 1, "unknown": 2}
    for granule in granules:
        key = granule.acquired_at.date().isoformat()
        current = by_day.get(key)
        if current is None:
            by_day[key] = granule
            continue
        if rank.get(granule.status, 9) < rank.get(current.status, 9):
            by_day[key] = granule
        elif rank.get(granule.status, 9) == rank.get(current.status, 9):
            if granule.quality_rank < current.quality_rank:
                by_day[key] = granule
    return [by_day[k] for k in sorted(by_day.keys())]


def merge_elevation_first_available(
    batches: list[list[ElevationSample]],
    *,
    disagree_meters: float = 30.0,
) -> list[ElevationSample]:
    """Per point index: first non-null meters; flag if later providers differ > threshold."""
    if not batches:
        return []
    length = max((len(b) for b in batches), default=0)
    out: list[ElevationSample] = []
    for idx in range(length):
        chosen: ElevationSample | None = None
        others: list[float] = []
        for batch in batches:
            if idx >= len(batch):
                continue
            sample = batch[idx]
            if sample.meters is None:
                continue
            if chosen is None:
                chosen = sample
            else:
                others.append(float(sample.meters))
        if chosen is None:
            # Keep a placeholder from the first batch that had this index.
            for batch in batches:
                if idx < len(batch):
                    out.append(batch[idx])
                    break
            continue
        disagree = False
        if chosen.meters is not None and others:
            base = float(chosen.meters)
            disagree = any(abs(v - base) > disagree_meters for v in others)
        if disagree != chosen.disagree:
            chosen = ElevationSample(
                lat=chosen.lat,
                lon=chosen.lon,
                meters=chosen.meters,
                dem=chosen.dem,
                resolution_m=chosen.resolution_m,
                source=chosen.source,
                product=chosen.product,
                retrieved_at=chosen.retrieved_at,
                quality_rank=chosen.quality_rank,
                license=chosen.license,
                disagree=disagree,
            )
        out.append(chosen)
    return out


def merge_geocode_first_nonempty(
    batches: list[list[Place]],
    *,
    dedupe_distance_m: float = 500.0,
) -> list[Place]:
    """First non-empty provider wins; drop later hits within distance threshold."""
    primary: list[Place] = []
    for batch in batches:
        if batch:
            primary = list(batch)
            break
    if not primary:
        return []
    distance_km = dedupe_distance_m / 1000.0
    merged: list[Place] = []
    for place in primary:
        if any(
            _haversine_km(place.lat, place.lon, existing.lat, existing.lon) < distance_km
            for existing in merged
        ):
            continue
        merged.append(place)
    # Fold later batches only as gap-fill far from existing.
    started = False
    for batch in batches:
        if not batch:
            continue
        if not started:
            started = True
            continue
        for place in batch:
            if any(
                _haversine_km(place.lat, place.lon, existing.lat, existing.lon) < distance_km
                for existing in merged
            ):
                continue
            merged.append(place)
    return merged


def basemap_attributions(apis: dict) -> list[dict[str, str]]:
    """Build visible credits list from [basemaps.entries] + provider attributions."""
    credits: list[dict[str, str]] = []
    seen: set[str] = set()
    basemaps = apis.get("basemaps") or {}
    entries = basemaps.get("entries") or {}
    for key in list(basemaps.get("list") or []) + list(entries.keys()):
        entry = entries.get(key) or {}
        attr = str(entry.get("attribution") or "").strip()
        if not attr or attr in seen:
            continue
        seen.add(attr)
        credits.append(
            {
                "id": str(entry.get("id") or key),
                "attribution": attr,
                "license": str(entry.get("license") or ""),
                "docs_url": str(entry.get("docs_url") or ""),
            }
        )
    catalog = apis.get("providers") or {}
    for name, meta in catalog.items():
        if meta.get("kind") not in ("elevation", "geocode"):
            continue
        attr = str(meta.get("attribution") or "").strip()
        if not attr or attr in seen:
            continue
        seen.add(attr)
        credits.append(
            {
                "id": str(name),
                "attribution": attr,
                "license": str(meta.get("license") or ""),
                "docs_url": str(meta.get("docs_url") or ""),
            }
        )
    return credits
