"""Earthdata CMR search for NISAR GCOV granules."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from termalwave.model import AOI, GranuleRef, Period, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import http_get_json
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import require_credential


class EarthdataNisarGcov:
    name = "earthdata_nisar_gcov"

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

    def fetch(self, aoi: AOI, date_window: Period) -> list[GranuleRef]:
        product = str(self.meta.get("product") or self.kind_cfg.get("collection") or "NISAR_L2_GCOV")
        license_name = str(self.meta.get("license", "NASA Earthdata"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _granules_from_cmr(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
            )

        token = require_credential(self.credentials, str(self.meta.get("credential") or "EARTHDATA_TOKEN"))
        if token is None:
            raise RuntimeError(f"{self.name}: missing EARTHDATA_TOKEN")

        base = self.endpoints.get(self.name) or "https://cmr.earthdata.nasa.gov/search/granules.json"
        query = urlencode(
            {
                "short_name": self.kind_cfg.get("collection") or "NISAR_L2_GCOV",
                "bounding_box": f"{aoi.west},{aoi.south},{aoi.east},{aoi.north}",
                "temporal": f"{date_window.start.isoformat()}T00:00:00Z,{date_window.end.isoformat()}T23:59:59Z",
                "page_size": 50,
            }
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        payload = http_get_json(f"{base}?{query}", headers=headers)
        return _granules_from_cmr(
            payload,
            source=self.name,
            product=product,
            license_name=license_name,
            now=now,
        )


def _granules_from_cmr(
    payload: dict[str, Any],
    *,
    source: str,
    product: str,
    license_name: str,
    now: datetime,
) -> list[GranuleRef]:
    entries = (payload.get("feed") or {}).get("entry") or payload.get("items") or []
    out: list[GranuleRef] = []
    for entry in entries:
        granule_id = str(entry.get("id") or entry.get("producer_granule_id") or entry.get("title") or "")
        time_start = entry.get("time_start") or entry.get("datetime") or ""
        try:
            acquired = datetime.fromisoformat(str(time_start).replace("Z", "+00:00"))
        except ValueError:
            continue
        if acquired.tzinfo is None:
            acquired = acquired.replace(tzinfo=timezone.utc)
        status = "unknown"
        raw_status = str(entry.get("day_night_flag") or entry.get("data_center") or "").lower()
        title = str(entry.get("title") or "").lower()
        if "validated" in title or "validated" in raw_status:
            status = "validated"
        elif "provisional" in title or "provisional" in raw_status:
            status = "provisional"
        # Prefer explicit fixture field when present.
        if entry.get("processing_level") == "validated":
            status = "validated"
        if entry.get("processing_level") == "provisional":
            status = "provisional"
        href = ""
        for link in entry.get("links") or []:
            if isinstance(link, dict) and link.get("href") and "data" in str(link.get("rel", "")):
                href = str(link["href"])
                break
            if isinstance(link, dict) and not href and link.get("href"):
                href = str(link["href"])
        quality = 10 if status == "validated" else 20 if status == "provisional" else 30
        out.append(
            GranuleRef(
                granule_id=granule_id,
                acquired_at=acquired,
                status=status,
                href=href,
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=quality,
                license=license_name,
            )
        )
    return out


def build(**kwargs: Any) -> EarthdataNisarGcov:
    return EarthdataNisarGcov(**{k: v for k, v in kwargs.items() if k != "name"})
