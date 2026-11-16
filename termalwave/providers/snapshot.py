"""Last good merged result per request (offline fallback when every provider fails).

Keyed by kind + a canonical request key, so a fallback never answers a
different query, point set or AOI than the one that produced it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from termalwave.providers.cache import fingerprint, read_json, write_json_atomic


def canonical_key(key: Any) -> str:
    return json.dumps(key, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def snapshot_path(root: Path, kind: str, key: Any) -> Path:
    return root / "snapshots" / kind / f"{fingerprint(kind, canonical_key(key))}.json"


def read_snapshot(root: Path, kind: str, key: Any) -> dict[str, Any] | None:
    data = read_json(snapshot_path(root, kind, key))
    if not isinstance(data, dict) or not isinstance(data.get("records"), list):
        return None
    if data.get("key") != canonical_key(key):
        return None
    return data


def write_snapshot(root: Path, kind: str, key: Any, payload: dict[str, Any]) -> Path | None:
    """Only status ok with records is worth replaying offline."""
    if payload.get("status") != "ok" or not payload.get("records"):
        return None
    return write_json_atomic(
        snapshot_path(root, kind, key),
        {
            "kind": kind,
            "key": canonical_key(key),
            "records": payload["records"],
            "selected_sources": payload.get("selected_sources") or [],
        },
    )


def resolved_payload(
    root: Path,
    kind: str,
    key: Any,
    *,
    tried: list[dict[str, Any]],
    records: list[dict[str, Any]],
    selected_sources: list[str],
) -> dict[str, Any]:
    """Payload for a successful chain run; snapshots it for later offline use."""
    payload = {
        "kind": kind,
        "status": "ok",
        "from_cache": False,
        "tried": tried,
        "records": records,
        "selected_sources": selected_sources,
    }
    write_snapshot(root, kind, key, payload)
    return payload


def fallback_payload(
    root: Path,
    kind: str,
    key: Any,
    *,
    tried: list[dict[str, Any]],
) -> dict[str, Any]:
    """Payload when every provider failed: this request's snapshot, else unavailable."""
    snap = read_snapshot(root, kind, key)
    if snap is None:
        return {
            "kind": kind,
            "status": "unavailable",
            "from_cache": False,
            "tried": tried,
            "records": [],
            "selected_sources": [],
        }
    return {
        "kind": kind,
        "status": "cache",
        "from_cache": True,
        "tried": tried,
        "records": snap["records"],
        "selected_sources": list(snap.get("selected_sources") or []),
    }
