"""on-disk json cache for elevation/geocode http responses."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any


def _key_hash(namespace: str, key: str) -> str:
    raw = f"{namespace}:{key}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:40]


def cache_path(cache_root: Path, namespace: str, key: str) -> Path:
    folder = cache_root / "requests" / namespace
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{_key_hash(namespace, key)}.json"


def get_json(
    cache_root: Path,
    namespace: str,
    key: str,
    *,
    max_age_s: float | None = None,
) -> Any | None:
    path = cache_path(cache_root, namespace, key)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if max_age_s is not None:
        stored = float(payload.get("_cached_at") or 0)
        if time.time() - stored > max_age_s:
            return None
    return payload.get("data")


def put_json(cache_root: Path, namespace: str, key: str, data: Any) -> Path:
    path = cache_path(cache_root, namespace, key)
    path.write_text(
        json.dumps({"_cached_at": time.time(), "data": data}, indent=2) + "\n",
        encoding="utf-8",
    )
    return path
