"""Nominatim (OSM) geocoder — identifying User-Agent required."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import Place, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json
from termalwave.providers.rate_limit import wait_from_meta
from termalwave.providers.request_cache import RequestCache


class NominatimGeocode:
    name = "nominatim"

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
        self.kind_cfg = kind_cfg
        self.credentials = credentials
        self.offline = offline
        self.fixtures_dir = fixtures_dir
        self.endpoints = endpoints
        self.cache = cache
        self.user_agent = str(
            meta.get("user_agent")
            or kind_cfg.get("user_agent")
            or "TermalWave/0.1 (+https://termalwave.space)"
        )

    def search(self, query: str, *, limit: int = 5) -> list[Place]:
        product = str(self.meta.get("product", "nominatim"))
        license_name = str(self.meta.get("license", "ODbL (OpenStreetMap)"))
        now = utc_now()
        q = query.strip()
        if not q:
            return []
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, f"{self.name}_search")
            return _places_from_jsonv2(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 30),
                limit=limit,
            )

        base = self.endpoints.get(self.name) or "https://nominatim.openstreetmap.org/search"

        def load() -> Any:
            wait_from_meta(self.name, self.meta, self.kind_cfg)
            url = build_url(
                base,
                {"q": q, "format": "jsonv2", "limit": str(limit)},
            )
            return http_get_json(url, headers={"User-Agent": self.user_agent})

        data = self.cache.fetch(self.name, f"search:{q}:{limit}", load)
        return _places_from_jsonv2(
            data,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
            quality_rank=int(self.meta.get("quality_rank") or 30),
            limit=limit,
        )

    def reverse(self, lat: float, lon: float) -> Place | None:
        product = str(self.meta.get("product", "nominatim"))
        license_name = str(self.meta.get("license", "ODbL (OpenStreetMap)"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, f"{self.name}_reverse")
            places = _places_from_jsonv2(
                [payload] if isinstance(payload, dict) else payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 30),
                limit=1,
            )
            return places[0] if places else None

        base = (
            self.endpoints.get(f"{self.name}_reverse")
            or "https://nominatim.openstreetmap.org/reverse"
        )

        def load() -> Any:
            wait_from_meta(self.name, self.meta, self.kind_cfg)
            url = build_url(
                base,
                {"lat": str(lat), "lon": str(lon), "format": "jsonv2"},
            )
            return http_get_json(url, headers={"User-Agent": self.user_agent})

        data = self.cache.fetch(self.name, f"reverse:{lat:.5f},{lon:.5f}", load)
        places = _places_from_jsonv2(
            [data] if isinstance(data, dict) else data,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
            quality_rank=int(self.meta.get("quality_rank") or 30),
            limit=1,
        )
        return places[0] if places else None


def _places_from_jsonv2(
    payload: Any,
    *,
    source: str,
    product: str,
    license_name: str,
    now: Any,
    quality_rank: int,
    limit: int,
) -> list[Place]:
    rows = payload if isinstance(payload, list) else [payload]
    out: list[Place] = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            continue
        if row.get("error"):
            continue
        try:
            lat = float(row["lat"])
            lon = float(row["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        display = str(row.get("display_name") or "")
        name = str(row.get("name") or (display.split(",")[0].strip() if display else ""))
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


def build(**kwargs: Any) -> NominatimGeocode:
    return NominatimGeocode(**{k: v for k, v in kwargs.items() if k != "name"})
