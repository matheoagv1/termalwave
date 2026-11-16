"""On-disk JSON cache for provider HTTP responses, built once from config/apis.toml."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Callable

from termalwave.providers.cache import cache_dir, fingerprint, read_json, write_json_atomic
from termalwave.providers.cache_admin import CachePolicy

DEFAULT_MAX_AGE_S = 604800.0


@dataclass(frozen=True)
class RequestCache:
    root: Path
    max_age_s: float | None = DEFAULT_MAX_AGE_S
    settle_days: int = 3

    @classmethod
    def from_config(cls, repo_root: Path, apis: dict[str, Any]) -> RequestCache:
        """Root from [paths].cache_dir, freshness from [cache]."""
        policy = CachePolicy.from_apis(apis)
        return cls(
            root=cache_dir(repo_root, apis),
            max_age_s=policy.request_max_age_s,
            settle_days=policy.settle_days,
        )

    def path(self, namespace: str, key: str, *, archived: bool = False) -> Path:
        leaf = f"{fingerprint(namespace, key)}.json"
        if archived:
            return self.root / "archive" / "requests" / namespace / leaf
        return self.root / "requests" / namespace / leaf

    def _policy(self) -> CachePolicy:
        return CachePolicy(request_max_age_s=self.max_age_s, settle_days=self.settle_days)

    def get(self, namespace: str, key: str, *, dated_until: date | None = None) -> Any | None:
        archived = self._policy().is_archive(dated_until)
        for path in (self.path(namespace, key, archived=True), self.path(namespace, key)):
            payload = read_json(path)
            if not isinstance(payload, dict):
                continue
            if payload.get("key") not in (None, key):
                continue
            if not (archived or payload.get("_archive")) and self.max_age_s is not None:
                stored = float(payload.get("_cached_at") or 0)
                if time.time() - stored > self.max_age_s:
                    continue
            return payload.get("data")
        return None

    def put(
        self,
        namespace: str,
        key: str,
        data: Any,
        *,
        dated_until: date | None = None,
    ) -> Path:
        archived = self._policy().is_archive(dated_until)
        return write_json_atomic(
            self.path(namespace, key, archived=archived),
            {
                "_cached_at": time.time(),
                "_archive": archived,
                "key": key,
                "data": data,
            },
        )

    def fetch(
        self,
        namespace: str,
        key: str,
        load: Callable[[], Any],
        *,
        dated_until: date | None = None,
    ) -> Any:
        """Fresh cached value, else load() and store it. Errors from load() are not cached."""
        cached = self.get(namespace, key, dated_until=dated_until)
        if cached is not None:
            return cached
        data = load()
        self.put(namespace, key, data, dated_until=dated_until)
        return data
