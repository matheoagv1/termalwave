"""Photon (Komoot) geocoder — OpenStreetMap data."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from termalwave.model import Place, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json
from termalwave.providers.rate_limit import wait_from_meta
from termalwave.providers.request_cache import get_json, put_json
from termalwave.runtime_config import REPO_ROOT


class PhotonGeocode:
    name = "photon"

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
        product = str(self.meta.get("product", "photon"))
        license_name = str(self.meta.get("license", "ODbL (OpenStreetMap)"))
        now = utc_now()
        q = query.strip()
        if not q:
            return []
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, f"{self.name}_search")
            return _places_from_geojson(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 10),
                limit=limit,
            )

        base = self.endpoints.get(self.name) or "https://photon.komoot.io/api/"
        cache_key = f"search:{q}:{limit}"
        cached = get_json(self.cache_root, self.name, cache_key, max_age_s=7 * 86400)
        if cached is None:
            wait_from_meta(self.name, self.meta, self.kind_cfg)
            url = build_url(base.rstrip("/") + "/", {"q": q, "limit": str(limit)})
            cached = http_get_json(url)
            put_json(self.cache_root, self.name, cache_key, cached)
        return _places_from_geojson(
            cached,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
            quality_rank=int(self.meta.get("quality_rank") or 10),
            limit=limit,
        )

    def reverse(self, lat: float, lon: float) -> Place | None:
        product = str(self.meta.get("product", "photon"))
        license_name = str(self.meta.get("license", "ODbL (OpenStreetMap)"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, f"{self.name}_reverse")
            places = _places_from_geojson(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                quality_rank=int(self.meta.get("quality_rank") or 10),
                limit=1,
            )
            return places[0] if places else None

        base = self.endpoints.get(f"{self.name}_reverse") or "https://photon.komoot.io/reverse"
        cache_key = f"reverse:{lat:.5f},{lon:.5f}"
        cached = get_json(self.cache_root, self.name, cache_key, max_age_s=7 * 86400)
        if cached is None:
            wait_from_meta(self.name, self.meta, self.kind_cfg)
            url = build_url(base, {"lat": str(lat), "lon": str(lon)})
            cached = http_get_json(url)
            put_json(self.cache_root, self.name, cache_key, cached)
        places = _places_from_geojson(
            cached,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
            quality_rank=int(self.meta.get("quality_rank") or 10),
            limit=1,
        )
        return places[0] if places else None


def _places_from_geojson(
    payload: Any,
    *,
    source: str,
    product: str,
    license_name: str,
    now: Any,
    quality_rank: int,
    limit: int,
) -> list[Place]:
    features = list(payload.get("features") or [])
    out: list[Place] = []
    for feat in features[:limit]:
        props = feat.get("properties") or {}
        coords = (feat.get("geometry") or {}).get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        name = str(props.get("name") or props.get("city") or props.get("street") or "")
        display = str(props.get("displayname") or _photon_display(props) or name)
        if not name and display:
            name = display.split(",")[0].strip()
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


def _photon_display(props: dict[str, Any]) -> str:
    parts = [
        props.get("name"),
        props.get("street"),
        props.get("housenumber"),
        props.get("city") or props.get("town") or props.get("village"),
        props.get("state"),
        props.get("country"),
    ]
    return ", ".join(str(p) for p in parts if p)


def build(**kwargs: Any) -> PhotonGeocode:
    return PhotonGeocode(**{k: v for k, v in kwargs.items() if k != "name"})
