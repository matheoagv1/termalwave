"""Snapshot cache for provider outputs (offline fallback)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def cache_dir(repo_root: Path, apis: dict[str, Any]) -> Path:
    rel = apis.get("paths", {}).get("cache_dir", "data/cache")
    path = Path(rel)
    if not path.is_absolute():
        path = (repo_root / path).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def kind_cache_path(repo_root: Path, apis: dict[str, Any], kind: str) -> Path:
    return cache_dir(repo_root, apis) / f"{kind}.json"


def write_cache(repo_root: Path, apis: dict[str, Any], kind: str, payload: dict[str, Any]) -> Path:
    path = kind_cache_path(repo_root, apis, kind)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def read_cache(repo_root: Path, apis: dict[str, Any], kind: str) -> dict[str, Any] | None:
    path = kind_cache_path(repo_root, apis, kind)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
