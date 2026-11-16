"""Earthdata CMR search for NISAR GCOV, GUNW and SME2 granules.

CMR has no short_name NISAR_L2_GCOV. Metadata search is public, so a token
is not required to list granules. Downloads still need EARTHDATA_TOKEN.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from termalwave.model import AOI, GranuleRef, Period, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import ProviderHttpError, http_get_json
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import require_credential

# Science data starts with the observatory. Earlier timeline years are not NISAR.
DEFAULT_TEMPORAL_START = "2025-07-30T00:00:00Z"
DEFAULT_GCOV = (
    "NISAR_L2_GCOV_V1",
    "NISAR_L2_GCOV_PROVISIONAL_V1",
    "NISAR_L2_GCOV_BETA_V1",
)
DEFAULT_GUNW = ("NISAR_L2_GUNW_V1",)
DEFAULT_SME2 = ("NISAR_L3_SME2_PROVISIONAL_V1",)
PAGE_SIZE = 2000
CMR_GRANULES = "https://cmr.earthdata.nasa.gov/search/granules.json"


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
        license_name = str(self.meta.get("license", "NASA Earthdata"))
        now = utc_now()
        if self.offline:
            product = str(self.meta.get("product") or DEFAULT_GCOV[0])
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _granules_from_cmr(
                payload,
                source=self.name,
                product=product,
                license_name=license_name,
                now=now,
                maturity=None,
            )

        base = self.endpoints.get(self.name) or CMR_GRANULES
        temporal = _temporal(self.kind_cfg, date_window)
        bbox = f"{aoi.west},{aoi.south},{aoi.east},{aoi.north}"
        headers = {"Accept": "application/json"}
        token = require_credential(self.credentials, str(self.meta.get("credential") or "EARTHDATA_TOKEN"))
        if token:
            headers["Authorization"] = f"Bearer {token}"

        out: list[GranuleRef] = []
        errors: list[Exception] = []
        names = _collection_names(self.kind_cfg)
        for short_name in names:
            try:
                payload = _search_collection(base, short_name, bbox, temporal, headers)
            except (ProviderHttpError, TimeoutError, OSError) as exc:
                errors.append(exc)
                continue
            out.extend(
                _granules_from_cmr(
                    payload,
                    source=self.name,
                    product=short_name,
                    license_name=license_name,
                    now=now,
                    maturity=maturity_for(short_name),
                )
            )
        if not out and errors and len(errors) == len(names):
            raise errors[-1]
        return out


def maturity_for(short_name: str) -> str:
    """Collection name carries maturity. Granule titles do not."""
    name = short_name.upper()
    if "BETA" in name:
        return "beta"
    if "PROVISIONAL" in name:
        return "provisional"
    if name.endswith("_V1"):
        return "validated"
    return "unknown"


def _collection_names(kind_cfg: dict[str, Any]) -> list[str]:
    names: list[str] = []
    groups = (
        ("gcov_collections", DEFAULT_GCOV),
        ("gunw_collections", DEFAULT_GUNW),
        ("sme2_collections", DEFAULT_SME2),
    )
    for key, default in groups:
        raw = kind_cfg.get(key)
        if isinstance(raw, list) and raw:
            picked = [str(item).strip() for item in raw if str(item).strip()]
        else:
            picked = list(default)
        for name in picked:
            if name not in names and name != "NISAR_L2_GCOV":
                names.append(name)
    return names


def _temporal(kind_cfg: dict[str, Any], window: Period) -> str:
    raw = str(kind_cfg.get("temporal_start") or DEFAULT_TEMPORAL_START)
    floor = date.fromisoformat(raw[:10])
    start = window.start if window.start > floor else floor
    end = window.end if window.end >= start else start
    return f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z"


def _search_collection(
    base: str,
    short_name: str,
    bbox: str,
    temporal: str,
    headers: dict[str, str],
) -> dict[str, Any]:
    """Page CMR until a short page. Returns one feed payload."""
    entries: list[Any] = []
    page = 1
    while page <= 10:
        query = urlencode(
            {
                "short_name": short_name,
                "bounding_box": bbox,
                "temporal": temporal,
                "page_size": PAGE_SIZE,
                "page_num": page,
            }
        )
        payload = http_get_json(f"{base}?{query}", headers=headers, timeout=60.0)
        batch = (payload.get("feed") or {}).get("entry") or payload.get("items") or []
        if not isinstance(batch, list):
            break
        entries.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        page += 1
    return {"feed": {"entry": entries}}


def _granule_id(entry: dict[str, Any]) -> str:
    for key in ("producer_granule_id", "title", "id"):
        value = str(entry.get(key) or "")
        if value.startswith("NISAR"):
            return value
    return str(entry.get("id") or entry.get("producer_granule_id") or entry.get("title") or "")


def _h5_href(entry: dict[str, Any]) -> str:
    fallback = ""
    for link in entry.get("links") or []:
        if not isinstance(link, dict):
            continue
        href = str(link.get("href") or "")
        rel = str(link.get("rel") or "")
        if not href or "data" not in rel or href.startswith("s3:"):
            continue
        if ".h5" in href:
            return href
        if not fallback:
            fallback = href
    return fallback


def _granules_from_cmr(
    payload: dict[str, Any],
    *,
    source: str,
    product: str,
    license_name: str,
    now: datetime,
    maturity: str | None,
) -> list[GranuleRef]:
    entries = (payload.get("feed") or {}).get("entry") or payload.get("items") or []
    out: list[GranuleRef] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        granule_id = _granule_id(entry)
        if not granule_id:
            continue
        time_start = entry.get("time_start") or entry.get("datetime") or ""
        try:
            acquired = datetime.fromisoformat(str(time_start).replace("Z", "+00:00"))
        except ValueError:
            continue
        if acquired.tzinfo is None:
            acquired = acquired.replace(tzinfo=timezone.utc)
        level = str(entry.get("processing_level") or "")
        if level in {"validated", "provisional", "beta"}:
            status = level
        elif maturity:
            status = maturity
        else:
            status = _status_from_text(entry)
        rank = {"validated": 10, "provisional": 20, "beta": 30}.get(status, 40)
        out.append(
            GranuleRef(
                granule_id=granule_id,
                acquired_at=acquired,
                status=status,
                href=_h5_href(entry),
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=rank,
                license=license_name,
            )
        )
    return out


def _status_from_text(entry: dict[str, Any]) -> str:
    title = str(entry.get("title") or "").lower()
    raw_status = str(entry.get("day_night_flag") or entry.get("data_center") or "").lower()
    blob = f"{title} {raw_status}"
    if "validated" in blob:
        return "validated"
    if "provisional" in blob:
        return "provisional"
    if "beta" in blob:
        return "beta"
    return "unknown"


def build(**kwargs: Any) -> EarthdataNisarGcov:
    return EarthdataNisarGcov(**{k: v for k, v in kwargs.items() if k != "name"})
