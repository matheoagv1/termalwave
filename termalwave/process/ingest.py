"""Fetch/merge provider data into provenance + cache (no provider names in callers)."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from termalwave.merge import (
    merge_fires_union_dedupe,
    merge_weather_first_available,
    pick_optical_near_nisar,
    prefer_validated_granules,
)
from termalwave.model import AOI, Period, record_to_dict
from termalwave.providers.cache import read_cache, write_cache
from termalwave.providers.registry import load_apis_config, providers_for_kind
from termalwave.providers.secrets import load_credentials

log = logging.getLogger("termalwave.ingest")


def _aoi_from_cfg(cfg: dict[str, Any]) -> AOI:
    aoi = cfg["aoi"]
    return AOI(
        west=float(aoi["west"]),
        east=float(aoi["east"]),
        south=float(aoi["south"]),
        north=float(aoi["north"]),
        name=str(aoi.get("name") or ""),
    )


def _period_from_cfg(cfg: dict[str, Any]) -> Period:
    timeline = cfg.get("timeline") or {}
    years = [int(y) for y in timeline.get("years") or []]
    if years:
        start = date(min(years), 1, 1)
        end = date(max(years), 12, 31)
    else:
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=30)
    return Period(start=start, end=end)


def _run_kind(
    kind: str,
    *,
    apis: dict[str, Any],
    aoi: AOI,
    period: Period,
    credentials: dict[str, str],
    offline: bool,
    fixtures_dir: Path,
    repo_root: Path,
) -> dict[str, Any]:
    section = apis.get(kind) or {}
    strategy = str(section.get("strategy") or "first_available")
    tried: list[dict[str, Any]] = []
    batches: list[Any] = []
    providers = providers_for_kind(
        kind,
        apis,
        credentials=credentials,
        offline=offline,
        fixtures_dir=fixtures_dir,
    )
    for provider in providers:
        name = getattr(provider, "name", provider.__class__.__name__)
        entry: dict[str, Any] = {"provider": name, "ok": False}
        try:
            batch = provider.fetch(aoi, period)
            entry["ok"] = True
            entry["count"] = len(batch)
            batches.append(batch)
            tried.append(entry)
        except Exception as exc:  # noqa: BLE001 — skip failed providers
            entry["error"] = str(exc)
            tried.append(entry)
            log.warning("%s provider %s skipped: %s", kind, name, exc)

    records: list[Any] = []
    unavailable = False
    from_cache = False

    if not any(t.get("ok") for t in tried):
        cached = read_cache(repo_root, apis, kind)
        if cached and cached.get("records") is not None:
            from_cache = True
            return {
                "kind": kind,
                "strategy": strategy,
                "status": "cache",
                "tried": tried,
                "from_cache": True,
                "records": cached.get("records") or [],
                "selected_sources": cached.get("selected_sources") or [],
            }
        unavailable = True
    else:
        if kind == "fires":
            records = merge_fires_union_dedupe(
                batches,
                distance_km=float(section.get("dedupe_distance_km", 1.0)),
                time_hours=float(section.get("dedupe_time_hours", 12.0)),
            )
        elif kind == "weather":
            records = merge_weather_first_available(batches)
        elif kind == "optical":
            flat = [item for batch in batches for item in batch]
            # Use radar-less fallback: sample midpoints of timeline years as targets.
            targets = [
                datetime(period.start.year, 6, 15, tzinfo=timezone.utc),
                datetime(period.end.year, 6, 15, tzinfo=timezone.utc),
            ]
            records = pick_optical_near_nisar(
                flat,
                targets,
                max_cloud_pct=float(section.get("max_cloud_pct", 40.0)),
                max_day_delta=int(section.get("max_day_delta", 16)),
            )
        elif kind == "radar":
            flat = [item for batch in batches for item in batch]
            records = prefer_validated_granules(flat)
        else:
            records = [item for batch in batches for item in batch]

    record_dicts = [record_to_dict(r) for r in records]
    sources = sorted({str(r.get("source", "")) for r in record_dicts if r.get("source")})
    payload = {
        "kind": kind,
        "strategy": strategy,
        "status": "unavailable" if unavailable else "ok",
        "tried": tried,
        "from_cache": from_cache,
        "records": record_dicts,
        "selected_sources": sources,
        "count": len(record_dicts),
    }
    if not unavailable and record_dicts:
        write_cache(repo_root, apis, kind, payload)
    return payload


def run_ingest(
    cfg: dict[str, Any],
    *,
    repo_root: Path,
    offline: bool,
) -> dict[str, Any]:
    apis = load_apis_config(repo_root)
    credentials = load_credentials(repo_root, apis)
    fixtures_rel = apis.get("paths", {}).get("fixtures_dir", "tests/fixtures/providers")
    fixtures_dir = Path(fixtures_rel)
    if not fixtures_dir.is_absolute():
        fixtures_dir = (repo_root / fixtures_dir).resolve()

    aoi = _aoi_from_cfg(cfg)
    period = _period_from_cfg(cfg)

    kinds = ("fires", "weather", "optical", "radar")
    layers: dict[str, Any] = {}
    for kind in kinds:
        layers[kind] = _run_kind(
            kind,
            apis=apis,
            aoi=aoi,
            period=period,
            credentials=credentials,
            offline=offline,
            fixtures_dir=fixtures_dir,
            repo_root=repo_root,
        )

    # Optical refine using actual radar acquisition times when available.
    radar_times: list[datetime] = []
    for rec in layers["radar"].get("records") or []:
        raw = rec.get("acquired_at")
        if not raw:
            continue
        try:
            radar_times.append(datetime.fromisoformat(str(raw).replace("Z", "+00:00")))
        except ValueError:
            continue
    if radar_times and layers["optical"].get("status") == "ok":
        # Re-merge optical from cached raw is not stored; keep prior pick unless empty.
        pass

    stats = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "offline": offline,
        "aoi": {
            "west": aoi.west,
            "east": aoi.east,
            "south": aoi.south,
            "north": aoi.north,
            "name": aoi.name,
        },
        "period": {"start": period.start.isoformat(), "end": period.end.isoformat()},
        "layers": {
            kind: {
                "status": layers[kind]["status"],
                "count": layers[kind].get("count", len(layers[kind].get("records") or [])),
                "from_cache": layers[kind].get("from_cache", False),
                "selected_sources": layers[kind].get("selected_sources") or [],
            }
            for kind in kinds
        },
    }

    provenance = {
        "version": 1,
        "generated_at": stats["generated_at"],
        "layers": {
            kind: {
                "strategy": layers[kind]["strategy"],
                "status": layers[kind]["status"],
                "tried": layers[kind]["tried"],
                "selected_sources": layers[kind].get("selected_sources") or [],
                "from_cache": layers[kind].get("from_cache", False),
                "count": layers[kind].get("count", 0),
            }
            for kind in kinds
        },
    }

    stats_rel = apis.get("paths", {}).get("stats_out", "data/processed/stats.json")
    stats_path = Path(stats_rel)
    if not stats_path.is_absolute():
        stats_path = (repo_root / stats_path).resolve()
    stats_path.parent.mkdir(parents=True, exist_ok=True)
    import json

    stats_path.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")

    # Persist per-kind record sidecars for debugging / web optional use.
    processed = Path(cfg["paths"]["processed_dir"])
    ingest_dir = processed / "ingest"
    ingest_dir.mkdir(parents=True, exist_ok=True)
    for kind, payload in layers.items():
        (ingest_dir / f"{kind}.json").write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )

    return {
        "stats": stats,
        "provenance": provenance,
        "layers": layers,
        "stats_path": str(stats_path),
    }
