"""Resolve elevation / geocode through registry + merge + cache fallback."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from termalwave.merge import merge_elevation_first_available, merge_geocode_first_nonempty
from termalwave.model import ElevationSample, LatLon, Place, record_to_dict
from termalwave.providers.cache import read_cache, write_cache
from termalwave.providers.registry import load_apis_config, providers_for_kind
from termalwave.providers.secrets import load_credentials

log = logging.getLogger("termalwave.resolve")


def resolve_elevations(
    points: list[LatLon],
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    apis = apis or load_apis_config(repo_root)
    section = apis.get("elevation") or {}
    fixtures_dir = repo_root / str(
        (apis.get("paths") or {}).get("fixtures_dir", "tests/fixtures/providers")
    )
    credentials = load_credentials(repo_root, apis)
    providers = providers_for_kind(
        "elevation",
        apis,
        credentials=credentials,
        offline=offline,
        fixtures_dir=fixtures_dir,
    )
    batches: list[list[ElevationSample]] = []
    tried: list[dict[str, Any]] = []
    for provider in providers:
        name = getattr(provider, "name", provider.__class__.__name__)
        entry: dict[str, Any] = {"provider": name, "ok": False}
        try:
            batch = provider.elevations(points)
            entry["ok"] = True
            entry["count"] = len(batch)
            batches.append(batch)
            tried.append(entry)
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            tried.append(entry)
            log.warning("elevation provider %s skipped: %s", name, exc)

    if not any(t.get("ok") for t in tried):
        cached = read_cache(repo_root, apis, "elevation")
        if cached and cached.get("records") is not None:
            return {
                "kind": "elevation",
                "status": "cache",
                "from_cache": True,
                "tried": tried,
                "records": cached.get("records") or [],
                "selected_sources": cached.get("selected_sources") or [],
            }
        return {
            "kind": "elevation",
            "status": "unavailable",
            "from_cache": False,
            "tried": tried,
            "records": [],
            "selected_sources": [],
        }

    disagree = float(section.get("disagree_meters") or 30.0)
    merged = merge_elevation_first_available(batches, disagree_meters=disagree)
    records = [record_to_dict(r) for r in merged]
    sources = sorted({r.source for r in merged if r.meters is not None})
    payload = {
        "kind": "elevation",
        "status": "ok",
        "from_cache": False,
        "tried": tried,
        "records": records,
        "selected_sources": sources,
    }
    write_cache(repo_root, apis, "elevation", payload)
    return payload


def resolve_geocode_search(
    query: str,
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    apis = apis or load_apis_config(repo_root)
    section = apis.get("geocode") or {}
    fixtures_dir = repo_root / str(
        (apis.get("paths") or {}).get("fixtures_dir", "tests/fixtures/providers")
    )
    credentials = load_credentials(repo_root, apis)
    providers = providers_for_kind(
        "geocode",
        apis,
        credentials=credentials,
        offline=offline,
        fixtures_dir=fixtures_dir,
        order_key="search",
    )
    batches: list[list[Place]] = []
    tried: list[dict[str, Any]] = []
    for provider in providers:
        name = getattr(provider, "name", provider.__class__.__name__)
        entry: dict[str, Any] = {"provider": name, "ok": False}
        try:
            batch = provider.search(query)
            entry["ok"] = True
            entry["count"] = len(batch)
            batches.append(batch)
            tried.append(entry)
            if batch:
                break  # first non-empty; still record later only if needed for merge fill
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            tried.append(entry)
            log.warning("geocode search %s skipped: %s", name, exc)

    # If first non-empty stopped early, still allow merge of only that batch.
    if not any(t.get("ok") and (t.get("count") or 0) > 0 for t in tried):
        # Try remaining providers that were not attempted after early break — already all tried if empty.
        cached = read_cache(repo_root, apis, "geocode_search")
        if cached and cached.get("records") is not None:
            return {
                "kind": "geocode_search",
                "status": "cache",
                "from_cache": True,
                "tried": tried,
                "records": cached.get("records") or [],
                "selected_sources": cached.get("selected_sources") or [],
            }
        return {
            "kind": "geocode_search",
            "status": "unavailable",
            "from_cache": False,
            "tried": tried,
            "records": [],
            "selected_sources": [],
        }

    dedupe_m = float(section.get("dedupe_distance_m") or 500.0)
    merged = merge_geocode_first_nonempty(batches, dedupe_distance_m=dedupe_m)
    records = [record_to_dict(r) for r in merged]
    sources = sorted({r.source for r in merged})
    payload = {
        "kind": "geocode_search",
        "status": "ok",
        "from_cache": False,
        "tried": tried,
        "records": records,
        "selected_sources": sources,
    }
    write_cache(repo_root, apis, "geocode_search", payload)
    return payload


def resolve_geocode_reverse(
    lat: float,
    lon: float,
    *,
    repo_root: Path,
    offline: bool = False,
    apis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    apis = apis or load_apis_config(repo_root)
    fixtures_dir = repo_root / str(
        (apis.get("paths") or {}).get("fixtures_dir", "tests/fixtures/providers")
    )
    credentials = load_credentials(repo_root, apis)
    providers = providers_for_kind(
        "geocode",
        apis,
        credentials=credentials,
        offline=offline,
        fixtures_dir=fixtures_dir,
        order_key="reverse",
    )
    tried: list[dict[str, Any]] = []
    place: Place | None = None
    for provider in providers:
        name = getattr(provider, "name", provider.__class__.__name__)
        entry: dict[str, Any] = {"provider": name, "ok": False}
        try:
            result = provider.reverse(lat, lon)
            entry["ok"] = True
            entry["count"] = 1 if result else 0
            tried.append(entry)
            if result is not None:
                place = result
                break
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            tried.append(entry)
            log.warning("geocode reverse %s skipped: %s", name, exc)

    if place is None:
        cached = read_cache(repo_root, apis, "geocode_reverse")
        if cached and cached.get("records") is not None:
            return {
                "kind": "geocode_reverse",
                "status": "cache",
                "from_cache": True,
                "tried": tried,
                "records": cached.get("records") or [],
                "selected_sources": cached.get("selected_sources") or [],
            }
        return {
            "kind": "geocode_reverse",
            "status": "unavailable",
            "from_cache": False,
            "tried": tried,
            "records": [],
            "selected_sources": [],
        }

    records = [record_to_dict(place)]
    payload = {
        "kind": "geocode_reverse",
        "status": "ok",
        "from_cache": False,
        "tried": tried,
        "records": records,
        "selected_sources": [place.source],
    }
    write_cache(repo_root, apis, "geocode_reverse", payload)
    return payload
