"""OpenSky Network aviation adapter (stub until REST wiring)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import AOI, Period
from termalwave.providers.secrets import require_credential


class OpenSky:
    name = "opensky"

    def __init__(
        self,
        *,
        meta: dict[str, Any],
        kind_cfg: dict[str, Any],
        credentials: dict[str, str],
        offline: bool,
        fixtures_dir: Path,
        endpoints: dict[str, str],
    ) -> None:
        self.meta = meta
        self.credentials = credentials
        self.offline = offline

    def fetch(self, aoi: AOI, period: Period) -> list[dict[str, Any]]:
        if self.offline:
            return []
        cid = require_credential(self.credentials, "OPENSKY_CLIENT_ID")
        secret = require_credential(self.credentials, "OPENSKY_CLIENT_SECRET")
        if cid is None or secret is None:
            raise RuntimeError(f"{self.name}: missing OpenSky OAuth credentials")
        return []


def build(**kwargs: Any) -> OpenSky:
    return OpenSky(**{k: v for k, v in kwargs.items() if k != "name"})
