"""Cache dir resolution, key fingerprints and atomic JSON files (shared by request + snapshot caches)."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any


def cache_dir(repo_root: Path, apis: dict[str, Any]) -> Path:
    rel = (apis.get("paths") or {}).get("cache_dir", "data/cache")
    path = Path(rel)
    if not path.is_absolute():
        path = (repo_root / path).resolve()
    return path


def fingerprint(namespace: str, key: str) -> str:
    raw = f"{namespace}:{key}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:40]


def read_json(path: Path) -> Any | None:
    """Missing, unreadable or corrupt file reads as None (a cache miss)."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def write_json_atomic(path: Path, data: Any) -> Path:
    """Temp file in the same dir + os.replace: readers never see a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(data, indent=2) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return path
