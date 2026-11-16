"""Build a provider chain from config once and run it, skipping providers that fail."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, TypeVar

from termalwave.providers.registry import load_apis_config, providers_for_kind
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import load_credentials

log = logging.getLogger("termalwave.chain")

T = TypeVar("T")


@dataclass(frozen=True)
class ProviderEnv:
    """Everything a provider factory needs, resolved from config/apis.toml."""

    apis: dict[str, Any]
    credentials: dict[str, str]
    offline: bool
    fixtures_dir: Path
    cache: RequestCache

    @classmethod
    def load(
        cls,
        repo_root: Path,
        *,
        offline: bool,
        apis: dict[str, Any] | None = None,
    ) -> ProviderEnv:
        apis = apis or load_apis_config(repo_root)
        fixtures_dir = Path(
            (apis.get("paths") or {}).get("fixtures_dir", "tests/fixtures/providers")
        )
        if not fixtures_dir.is_absolute():
            fixtures_dir = (repo_root / fixtures_dir).resolve()
        return cls(
            apis=apis,
            credentials=load_credentials(repo_root, apis),
            offline=offline,
            fixtures_dir=fixtures_dir,
            cache=RequestCache.from_config(repo_root, apis),
        )

    def providers(self, kind: str, *, order_key: str | None = None) -> list[Any]:
        return providers_for_kind(
            kind,
            self.apis,
            credentials=self.credentials,
            offline=self.offline,
            fixtures_dir=self.fixtures_dir,
            cache=self.cache,
            order_key=order_key,
        )


def run_chain(
    providers: list[Any],
    call: Callable[[Any], list[T]],
    *,
    label: str,
    stop_on_nonempty: bool = False,
) -> tuple[list[list[T]], list[dict[str, Any]]]:
    """Batches from providers that answered, plus a `tried` entry per provider."""
    batches: list[list[T]] = []
    tried: list[dict[str, Any]] = []
    for provider in providers:
        name = getattr(provider, "name", provider.__class__.__name__)
        entry: dict[str, Any] = {"provider": name, "ok": False}
        tried.append(entry)
        try:
            batch = call(provider)
        except Exception as exc:  # noqa: BLE001 — skip failed providers
            entry["error"] = str(exc)
            log.warning("%s provider %s skipped: %s", label, name, exc)
            continue
        entry["ok"] = True
        entry["count"] = len(batch)
        batches.append(batch)
        if stop_on_nonempty and batch:
            break
    return batches, tried
