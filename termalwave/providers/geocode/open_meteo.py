"""Open-Meteo geocoding API (search only)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import Place, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json
from termalwave.providers.rate_limit import wait_from_meta
from termalwave.providers.request_cache import get_json, put_json
from termalwave.runtime_config import REPO_ROOT


class OpenMeteoGeocode:
    name = "open_meteo_geocode"

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

    def search(self, query: str, *, limit: int = 5) -> list[Place]:
        product = str(self.meta.get("product", "open-meteo-geocoding"))
        license_name = str(self.meta.get("license", "Open-Meteo CC BY 4.0"))
        now = utc_now()
        q = query.strip()
        if not q:
            return []
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _places_from_payload(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 20),
                limit=limit,
            )

        base = (
            self.endpoints.get(self.name)
            or "https://geocoding-api.open-meteo.com/v1/search"
        )
        cache_key = f"search:{q}:{limit}"
        cached = get_json(self.cache_root, self.name, cache_key, max_age_s=7 * 86400)
        if cached is None:
            wait_from_meta(self.name, self.meta, self.kind_cfg)
            url = build_url(
                base,
                {"name": q, "count": str(limit), "language": "es"},
            )
            cached = http_get_json(url)
            put_json(self.cache_root, self.name, cache_key, cached)
        return _places_from_payload(
            cached,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
            quality_rank=int(self.meta.get("quality_rank") or 20),
            limit=limit,
        )

    def reverse(self, lat: float, lon: float) -> Place | None:
        # Open-Meteo geocoding has no reverse endpoint.
        return None


def _places_from_payload(
    payload: Any,
    *,
    source: str,
    product: str,
    license_name: str,
    now: Any,
    quality_rank: int,
    limit: int,
) -> list[Place]:
    rows = list(payload.get("results") or [])
    out: list[Place] = []
    for row in rows[:limit]:
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        name = str(row.get("name") or "")
        parts = [
            name,
            row.get("admin1"),
            row.get("country"),
        ]
        display = ", ".join(str(p) for p in parts if p)
        out.append(
            Place(
                name=name or display,
                lat=lat,
                lon=lon,
                display=display or name,
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=quality_rank,
                license=license_name,
            )
        )
    return out


def build(**kwargs: Any) -> OpenMeteoGeocode:
    return OpenMeteoGeocode(**{k: v for k, v in kwargs.items() if k != "name"})
