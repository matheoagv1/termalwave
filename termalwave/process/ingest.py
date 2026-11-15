"""Fetch/merge provider data into provenance + cache (no provider names in callers)."""

from __future__ import annotations

import json
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
from termalwave.providers.chain import ProviderEnv, run_chain
from termalwave.providers.snapshot import fallback_payload, resolved_payload


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


def _request_key(aoi: AOI, period: Period) -> dict[str, Any]:
    return {
        "bounds": [f"{v:.5f}" for v in (aoi.west, aoi.south, aoi.east, aoi.north)],
        "period": [period.start.isoformat(), period.end.isoformat()],
    }


def _merge_kind(
    kind: str,
    batches: list[list[Any]],
    *,
    section: dict[str, Any],
    period: Period,
) -> list[Any]:
    if kind == "fires":
        return merge_fires_union_dedupe(
            batches,
            distance_km=float(section.get("dedupe_distance_km", 1.0)),
            time_hours=float(section.get("dedupe_time_hours", 12.0)),
        )
    if kind == "weather":
        return merge_weather_first_available(batches)
    flat = [item for batch in batches for item in batch]
    if kind == "optical":
        # Use radar-less fallback: sample midpoints of timeline years as targets.
        targets = [
            datetime(period.start.year, 6, 15, tzinfo=timezone.utc),
            datetime(period.end.year, 6, 15, tzinfo=timezone.utc),
        ]
        return pick_optical_near_nisar(
            flat,
            targets,
            max_cloud_pct=float(section.get("max_cloud_pct", 40.0)),
            max_day_delta=int(section.get("max_day_delta", 16)),
        )
    if kind == "radar":
        return prefer_validated_granules(flat)
    return flat


def _run_kind(
    kind: str,
    *,
    env: ProviderEnv,
    aoi: AOI,
    period: Period,
) -> dict[str, Any]:
    section = env.apis.get(kind) or {}
    strategy = str(section.get("strategy") or "first_available")
    key = _request_key(aoi, period)
    batches, tried = run_chain(
        env.providers(kind),
        lambda provider: provider.fetch(aoi, period),
        label=kind,
    )
    if not batches:
        payload = fallback_payload(env.cache.root, kind, key, tried=tried)
    else:
        record_dicts = [
            record_to_dict(r)
            for r in _merge_kind(kind, batches, section=section, period=period)
        ]
        payload = resolved_payload(
            env.cache.root,
            kind,
            key,
            tried=tried,
            records=record_dicts,
            selected_sources=sorted(
                {str(r.get("source", "")) for r in record_dicts if r.get("source")}
            ),
        )
    return {**payload, "strategy": strategy, "count": len(payload["records"])}


def run_ingest(
    cfg: dict[str, Any],
    *,
    repo_root: Path,
    offline: bool,
) -> dict[str, Any]:
    env = ProviderEnv.load(repo_root, offline=offline)
    apis = env.apis

    aoi = _aoi_from_cfg(cfg)
    period = _period_from_cfg(cfg)

    # vessels/aviation/traffic are registered in apis.toml; stubs return []
    # until live adapters land. Phenomenon kinds stay first for provenance UI.
    kinds = ("fires", "weather", "optical", "radar", "vessels", "aviation", "traffic")
    layers: dict[str, Any] = {}
    for kind in kinds:
        layers[kind] = _run_kind(kind, env=env, aoi=aoi, period=period)

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
