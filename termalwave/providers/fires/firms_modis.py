"""FIRMS MODIS standard processing adapter."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import AOI, Hotspot, Period
from termalwave.providers._fixture import load_csv_fixture
from termalwave.providers.fires._common import fetch_firms_area_csv, quality_for, rows_to_hotspots
from termalwave.providers.secrets import require_credential


class FirmsModis:
    name = "firms_modis"

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
        product = str(self.meta.get("product", "MODIS_SP"))
        license_name = str(self.meta.get("license", "NASA FIRMS"))
        rank = quality_for(self.kind_cfg, self.name, 30)
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
        rows = fetch_firms_area_csv(
            template=self.endpoints.get(self.name) or "",
            map_key=key,
            aoi=aoi,
            period=period,
        )
        return rows_to_hotspots(
            rows,
            source=self.name,
            product=product,
            quality_rank=rank,
            license_name=license_name,
        )


def build(**kwargs: Any) -> FirmsModis:
    return FirmsModis(**{k: v for k, v in kwargs.items() if k != "name"})
