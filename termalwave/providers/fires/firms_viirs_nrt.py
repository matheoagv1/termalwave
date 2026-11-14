"""FIRMS VIIRS SNPP near-real-time adapter."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import AOI, Hotspot, Period
from termalwave.providers._fixture import load_csv_fixture, parse_csv_text
from termalwave.providers.fires._common import quality_for, rows_to_hotspots
from termalwave.providers.http import http_get_text
from termalwave.providers.secrets import require_credential


class FirmsViirsNrt:
    name = "firms_viirs_nrt"

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
        self.kind_cfg = kind_cfg
        self.credentials = credentials
        self.offline = offline
        self.fixtures_dir = fixtures_dir
        self.endpoints = endpoints

    def fetch(self, aoi: AOI, period: Period) -> list[Hotspot]:
        product = str(self.meta.get("product", "VIIRS_SNPP_NRT"))
        license_name = str(self.meta.get("license", "NASA FIRMS"))
        rank = quality_for(self.kind_cfg, self.name, 20)
        if self.offline:
            rows = load_csv_fixture(self.fixtures_dir, self.name)
            return rows_to_hotspots(
                rows,
                source=self.name,
                product=product,
                quality_rank=rank,
                license_name=license_name,
            )
        key = require_credential(self.credentials, str(self.meta.get("credential") or ""))
        if key is None:
            raise RuntimeError(f"{self.name}: missing FIRMS_MAP_KEY")
        day_range = max(1, (period.end - period.start).days + 1)
        template = self.endpoints.get(self.name) or ""
        url = template.format(
            MAP_KEY=key,
            west=aoi.west,
            south=aoi.south,
            east=aoi.east,
            north=aoi.north,
            day_range=min(day_range, 10),
        )
        text = http_get_text(url)
        rows = parse_csv_text(text)
        return rows_to_hotspots(
            rows,
            source=self.name,
            product=product,
            quality_rank=rank,
            license_name=license_name,
        )


def build(**kwargs: Any) -> FirmsViirsNrt:
    return FirmsViirsNrt(**{k: v for k, v in kwargs.items() if k != "name"})
