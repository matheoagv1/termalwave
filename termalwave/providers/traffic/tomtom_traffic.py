"""TomTom traffic adapter (stub until REST wiring)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import AOI, Period
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import require_credential


class TomtomTraffic:
    name = "tomtom_traffic"

    def __init__(
        self,
        *,
        meta: dict[str, Any],
        kind_cfg: dict[str, Any],
        credentials: dict[str, str],
        offline: bool,
        fixtures_dir: Path,
        endpoints: dict[str, str],
        cache: RequestCache,
    ) -> None:
        self.meta = meta
        self.credentials = credentials
        self.offline = offline

    def fetch(self, aoi: AOI, period: Period) -> list[dict[str, Any]]:
        if self.offline:
            return []
        key = require_credential(self.credentials, str(self.meta.get("credential") or ""))
        if key is None:
            raise RuntimeError(f"{self.name}: missing TOMTOM_API_KEY")
        return []


def build(**kwargs: Any) -> TomtomTraffic:
    return TomtomTraffic(**{k: v for k, v in kwargs.items() if k != "name"})
