"""Resolve elevation / geocode through registry + merge + per-request snapshot fallback."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.merge import merge_elevation_first_available, merge_geocode_first_nonempty
from termalwave.model import LatLon, Place, record_to_dict
from termalwave.providers.chain import ProviderEnv, run_chain
from termalwave.providers.snapshot import fallback_payload, resolved_payload


def _point_key(lat: float, lon: float) -> str:
    return f"{lat:.5f},{lon:.5f}"


def _reverse_batch(provider: Any, lat: float, lon: float) -> list[Place]:
    place = provider.reverse(lat, lon)
    return [place] if place is not None else []


def resolve_elevations(
    points: list[LatLon],
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    env = ProviderEnv.load(repo_root, offline=offline, apis=apis)
    key = {"points": sorted(_point_key(p.lat, p.lon) for p in points)}
    batches, tried = run_chain(
        env.providers("elevation"),
        lambda provider: provider.elevations(points),
        label="elevation",
    )
    if not batches:
        return fallback_payload(env.cache.root, "elevation", key, tried=tried)

    section = env.apis.get("elevation") or {}
    merged = merge_elevation_first_available(
        batches, disagree_meters=float(section.get("disagree_meters") or 30.0)
    )
    return resolved_payload(
        env.cache.root,
        "elevation",
        key,
        tried=tried,
        records=[record_to_dict(r) for r in merged],
        selected_sources=sorted({r.source for r in merged if r.meters is not None}),
    )


def resolve_geocode_search(
    query: str,
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    env = ProviderEnv.load(repo_root, offline=offline, apis=apis)
    key = {"query": " ".join(query.split()).casefold(), "limit": limit}
    batches, tried = run_chain(
        env.providers("geocode", order_key="search"),
        lambda provider: provider.search(query, limit=limit),
        label="geocode search",
        stop_on_nonempty=True,
    )
    if not any(batches):
        return fallback_payload(env.cache.root, "geocode_search", key, tried=tried)

    section = env.apis.get("geocode") or {}
    merged = merge_geocode_first_nonempty(
        batches, dedupe_distance_m=float(section.get("dedupe_distance_m") or 500.0)
    )
    return resolved_payload(
        env.cache.root,
        "geocode_search",
        key,
        tried=tried,
        records=[record_to_dict(r) for r in merged],
        selected_sources=sorted({r.source for r in merged}),
    )


def resolve_geocode_reverse(
    lat: float,
    lon: float,
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    env = ProviderEnv.load(repo_root, offline=offline, apis=apis)
    key = {"point": _point_key(lat, lon)}
    batches, tried = run_chain(
        env.providers("geocode", order_key="reverse"),
        lambda provider: _reverse_batch(provider, lat, lon),
        label="geocode reverse",
        stop_on_nonempty=True,
    )
    place = next((batch[0] for batch in batches if batch), None)
    if place is None:
        return fallback_payload(env.cache.root, "geocode_reverse", key, tried=tried)

    return resolved_payload(
        env.cache.root,
        "geocode_reverse",
        key,
        tried=tried,
        records=[record_to_dict(place)],
        selected_sources=[place.source],
    )
