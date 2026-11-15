"""Stats and prune for the on-disk provider cache (volatile vs archive)."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from termalwave.providers.cache import cache_dir, fingerprint, read_json, write_json_atomic

DEFAULT_SETTLE_DAYS = 3
DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024  # 2 GiB of volatile entries


@dataclass(frozen=True)
class CachePolicy:
    request_max_age_s: float | None = 604800.0
    settle_days: int = DEFAULT_SETTLE_DAYS
    max_bytes: int = DEFAULT_MAX_BYTES

    @classmethod
    def from_apis(cls, apis: dict[str, Any]) -> CachePolicy:
        section = apis.get("cache") or {}
        raw_age = section.get("request_max_age_s", 604800)
        return cls(
            request_max_age_s=None if raw_age is None else float(raw_age),
            settle_days=int(section.get("settle_days", DEFAULT_SETTLE_DAYS)),
            max_bytes=int(section.get("max_bytes", DEFAULT_MAX_BYTES)),
        )

    def is_archive(self, dated_until: date | None, *, today: date | None = None) -> bool:
        """Past subjects past the settle window never expire."""
        if dated_until is None:
            return False
        today = today or datetime.now(timezone.utc).date()
        return dated_until <= today.fromordinal(today.toordinal() - self.settle_days)


@dataclass
class EntryInfo:
    path: Path
    namespace: str
    bytes: int
    mtime: float
    archived: bool
    cached_at: float | None
    corrupt: bool = False


def _iter_json(root: Path) -> Iterator[Path]:
    if not root.is_dir():
        return
    for path in root.rglob("*.json"):
        if path.name.endswith(".tmp") or path.name.startswith("."):
            continue
        yield path
    for path in root.rglob("*.tmp"):
        yield path


def classify_path(path: Path, root: Path) -> tuple[str, bool]:
    """Return (namespace, archived) from a path under the cache root."""
    try:
        rel = path.relative_to(root)
    except ValueError:
        return ("?", False)
    parts = rel.parts
    archived = parts[0] == "archive"
    if archived and len(parts) >= 3:
        return (parts[2] if parts[1] in {"requests", "snapshots"} else parts[1], True)
    if parts[0] in {"requests", "snapshots"} and len(parts) >= 2:
        return (parts[1], False)
    return (parts[0], False)


def scan(root: Path) -> list[EntryInfo]:
    out: list[EntryInfo] = []
    for path in _iter_json(root):
        try:
            st = path.stat()
        except OSError:
            continue
        ns, archived = classify_path(path, root)
        cached_at: float | None = None
        corrupt = path.suffix == ".tmp" or path.name.endswith(".tmp")
        if path.suffix == ".json" and not corrupt:
            payload = read_json(path)
            if not isinstance(payload, dict):
                corrupt = True
            else:
                raw = payload.get("_cached_at")
                cached_at = float(raw) if raw is not None else None
                archived = archived or bool(payload.get("_archive"))
        out.append(
            EntryInfo(
                path=path,
                namespace=ns,
                bytes=st.st_size,
                mtime=st.st_mtime,
                archived=archived,
                cached_at=cached_at,
                corrupt=corrupt,
            )
        )
    return out


def stats(root: Path) -> dict[str, Any]:
    entries = scan(root)
    by_ns: dict[str, dict[str, Any]] = {}
    for e in entries:
        bucket = by_ns.setdefault(
            e.namespace,
            {"entries": 0, "bytes": 0, "archive": 0, "volatile": 0, "oldest": None, "newest": None},
        )
        bucket["entries"] += 1
        bucket["bytes"] += e.bytes
        if e.archived:
            bucket["archive"] += 1
        else:
            bucket["volatile"] += 1
        ts = e.cached_at or e.mtime
        if bucket["oldest"] is None or ts < bucket["oldest"]:
            bucket["oldest"] = ts
        if bucket["newest"] is None or ts > bucket["newest"]:
            bucket["newest"] = ts
    return {
        "root": str(root),
        "entries": len(entries),
        "bytes": sum(e.bytes for e in entries),
        "namespaces": by_ns,
    }


def format_stats(report: dict[str, Any]) -> str:
    lines = [f"cache root: {report['root']}", f"total: {report['entries']} files, {report['bytes']} bytes"]
    for ns, row in sorted((report.get("namespaces") or {}).items()):
        oldest = datetime.fromtimestamp(row["oldest"], tz=timezone.utc).date() if row["oldest"] else "-"
        newest = datetime.fromtimestamp(row["newest"], tz=timezone.utc).date() if row["newest"] else "-"
        lines.append(
            f"  {ns}: {row['entries']} files ({row['bytes']} B) "
            f"archive={row['archive']} volatile={row['volatile']} {oldest}..{newest}"
        )
    return "\n".join(lines)


def prune(
    root: Path,
    policy: CachePolicy,
    *,
    dry_run: bool = False,
    now: float | None = None,
) -> dict[str, Any]:
    """Drop expired volatile entries, temps, corrupt JSON; LRU-trim volatile to max_bytes."""
    now = time.time() if now is None else now
    removed: list[str] = []
    kept_bytes = 0
    volatile: list[EntryInfo] = []

    for e in scan(root):
        drop = e.corrupt
        if not drop and not e.archived and policy.request_max_age_s is not None:
            age_from = e.cached_at if e.cached_at is not None else e.mtime
            drop = now - age_from > policy.request_max_age_s
        if drop:
            removed.append(str(e.path))
            if not dry_run:
                e.path.unlink(missing_ok=True)
            continue
        if e.archived:
            continue
        volatile.append(e)
        kept_bytes += e.bytes

    volatile.sort(key=lambda e: e.mtime)
    while kept_bytes > policy.max_bytes and volatile:
        e = volatile.pop(0)
        removed.append(str(e.path))
        kept_bytes -= e.bytes
        if not dry_run:
            e.path.unlink(missing_ok=True)

    return {"removed": len(removed), "paths": removed, "volatile_bytes": kept_bytes, "dry_run": dry_run}


def archive_path(root: Path, kind: str, namespace: str, key: str) -> Path:
    """L1 requests and L2 snapshots under archive/ when the subject is dated."""
    leaf = f"{fingerprint(namespace, key)}.json"
    return root / "archive" / kind / namespace / leaf


def write_entry(
    root: Path,
    *,
    kind: str,
    namespace: str,
    key: str,
    data: Any,
    archived: bool,
) -> Path:
    path = archive_path(root, kind, namespace, key) if archived else root / kind / namespace / f"{fingerprint(namespace, key)}.json"
    return write_json_atomic(
        path,
        {"_cached_at": time.time(), "_archive": archived, "key": key, "data": data},
    )
