"""Open-Meteo elevation (Copernicus GLO-90)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import ElevationSample, LatLon, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json
from termalwave.providers.rate_limit import wait_from_meta
from termalwave.providers.request_cache import get_json, put_json
from termalwave.runtime_config import REPO_ROOT


_BATCH = 100


class OpenMeteoElevation:
    name = "open_meteo_elevation"

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
        self.cache_root = REPO_ROOT / "data" / "cache"

    def elevations(self, points: list[LatLon]) -> list[ElevationSample]:
        product = str(self.meta.get("product", "open-meteo-elevation"))
        license_name = str(self.meta.get("license", "Open-Meteo / Copernicus DEM CC BY 4.0"))
        dem = str(self.meta.get("dem", "copernicus-glo90"))
        resolution = self.meta.get("resolution_m")
        res_m = float(resolution) if resolution is not None else 90.0
        now = utc_now()
        if not points:
            return []
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _samples_from_payload(
                points,
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                dem=dem,
                resolution_m=res_m,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 10),
            )

        base = self.endpoints.get(self.name) or "https://api.open-meteo.com/v1/elevation"
        out: list[ElevationSample] = []
        for i in range(0, len(points), _BATCH):
            chunk = points[i : i + _BATCH]
            cache_key = "|".join(f"{p.lat:.5f},{p.lon:.5f}" for p in chunk)
            cached = get_json(self.cache_root, self.name, cache_key, max_age_s=7 * 86400)
            if cached is None:
                wait_from_meta(self.name, self.meta, self.kind_cfg)
                url = build_url(
                    base,
                    {
                        "latitude": ",".join(f"{p.lat}" for p in chunk),
                        "longitude": ",".join(f"{p.lon}" for p in chunk),
                    },
                )
                cached = http_get_json(url)
                put_json(self.cache_root, self.name, cache_key, cached)
            out.extend(
                _samples_from_payload(
                    chunk,
                    cached,
                    source=self.name,
                    product=product,
                    license_name=license_name,
                    dem=dem,
                    resolution_m=res_m,
                    now=now,
                    quality_rank=int(self.meta.get("quality_rank") or 10),
                )
            )
        return out


def _samples_from_payload(
    points: list[LatLon],
    payload: Any,
    *,
    source: str,
    product: str,
    license_name: str,
    dem: str,
    resolution_m: float,
    now: Any,
    quality_rank: int,
) -> list[ElevationSample]:
    elev = list(payload.get("elevation") or [])
    out: list[ElevationSample] = []
    for idx, pt in enumerate(points):
        meters = None
        if idx < len(elev) and elev[idx] is not None:
            meters = float(elev[idx])
        out.append(
            ElevationSample(
                lat=pt.lat,
                lon=pt.lon,
                meters=meters,
                dem=dem,
                resolution_m=resolution_m,
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=quality_rank,
                license=license_name,
            )
        )
    return out


def build(**kwargs: Any) -> OpenMeteoElevation:
    return OpenMeteoElevation(**{k: v for k, v in kwargs.items() if k != "name"})
