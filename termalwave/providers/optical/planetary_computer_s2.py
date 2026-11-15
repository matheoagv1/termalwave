"""Planetary Computer Sentinel-2 STAC adapter."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from termalwave.model import AOI, Period, SceneRef, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import http_get_json
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import require_credential


class PlanetaryComputerS2:
    name = "planetary_computer_s2"

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

    def fetch(self, aoi: AOI, date_window: Period) -> list[SceneRef]:
        product = str(self.meta.get("product", "sentinel-2-l2a"))
        license_name = str(self.meta.get("license", "ESA Sentinel / Microsoft PC"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _scenes_from_items(
                payload.get("features") or payload.get("items") or [],
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
            )

        # Token optional for public STAC search; if credential key set but empty, continue without.
        token = require_credential(
            self.credentials, str(self.meta.get("credential") or "PLANETARY_COMPUTER_TOKEN")
        )
        base = self.endpoints.get(self.name) or (
            "https://planetarycomputer.microsoft.com/api/stac/v1/search"
        )
        # STAC search via GET query params (stdlib; no POST body).
        query = urlencode(
            {
                "collections": "sentinel-2-l2a",
                "bbox": f"{aoi.west},{aoi.south},{aoi.east},{aoi.north}",
                "datetime": f"{date_window.start.isoformat()}/{date_window.end.isoformat()}",
                "limit": 50,
            }
        )
        headers = {"Accept": "application/geo+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        payload = http_get_json(f"{base}?{query}", headers=headers)
        return _scenes_from_items(
            payload.get("features") or [],
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
        )


def _scenes_from_items(
    items: list[dict[str, Any]],
    *,
    source: str,
    product: str,
    license_name: str,
    now: datetime,
) -> list[SceneRef]:
    out: list[SceneRef] = []
    for item in items:
        props = item.get("properties") or {}
        assets = item.get("assets") or {}
        href = ""
        for key in ("visual", "overview", "B04"):
            if key in assets and assets[key].get("href"):
                href = str(assets[key]["href"])
                break
        acquired_s = props.get("datetime") or props.get("start_datetime") or ""
        try:
            acquired = datetime.fromisoformat(str(acquired_s).replace("Z", "+00:00"))
        except ValueError:
            continue
        if acquired.tzinfo is None:
            acquired = acquired.replace(tzinfo=timezone.utc)
        cloud = props.get("eo:cloud_cover")
        out.append(
            SceneRef(
                scene_id=str(item.get("id") or props.get("s2:product_uri") or acquired_s),
                acquired_at=acquired,
                cloud_pct=float(cloud) if cloud is not None else None,
                href=href,
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=10,
                license=license_name,
            )
        )
    return out


def build(**kwargs: Any) -> PlanetaryComputerS2:
    return PlanetaryComputerS2(**{k: v for k, v in kwargs.items() if k != "name"})
