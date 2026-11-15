"""Meteomatics weather adapter (requires user/password)."""

from __future__ import annotations

import base64
from datetime import date
from pathlib import Path
from typing import Any

from termalwave.model import AOI, DailyWeather, Period, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import http_get_json
from termalwave.providers.request_cache import RequestCache
from termalwave.providers.secrets import require_credential


class Meteomatics:
    name = "meteomatics"

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

    def fetch(self, aoi: AOI, period: Period) -> list[DailyWeather]:
        product = str(self.meta.get("product", "meteomatics"))
        license_name = str(self.meta.get("license", "Meteomatics proprietary"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
            return _from_fixture(payload, self.name, product, license_name, now)

        user = require_credential(self.credentials, "METEOMATICS_USER")
        password = require_credential(self.credentials, "METEOMATICS_PASSWORD")
        if user is None or password is None:
            raise RuntimeError(f"{self.name}: missing METEOMATICS_USER/PASSWORD")

        lat = (aoi.north + aoi.south) / 2.0
        lon = (aoi.east + aoi.west) / 2.0
        base = self.endpoints.get(self.name) or "https://api.meteomatics.com"
        # Example: /2024-01-01T00:00:00Z--2024-01-05T00:00:00Z:P1D/t_max_2m_24h:C,t_min_2m_24h:C,precip_24h:mm/lat,lon/json
        path = (
            f"{period.start.isoformat()}T00:00:00Z--"
            f"{period.end.isoformat()}T00:00:00Z:P1D/"
            f"t_max_2m_24h:C,t_min_2m_24h:C,precip_24h:mm/"
            f"{lat},{lon}/json"
        )
        url = f"{base.rstrip('/')}/{path}"
        token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
        payload = http_get_json(url, headers={"Authorization": f"Basic {token}"})
        return _from_meteomatics_json(payload, self.name, product, license_name, now)


def _from_fixture(
    payload: dict[str, Any],
    source: str,
    product: str,
    license_name: str,
    now: Any,
) -> list[DailyWeather]:
    out: list[DailyWeather] = []
    for row in payload.get("days") or []:
        out.append(
            DailyWeather(
                day=date.fromisoformat(str(row["day"])[:10]),
                temp_max_c=row.get("temp_max_c"),
                temp_min_c=row.get("temp_min_c"),
                precip_mm=row.get("precip_mm"),
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=20,
                license=license_name,
                filled=False,
            )
        )
    return out


def _from_meteomatics_json(
    payload: dict[str, Any],
    source: str,
    product: str,
    license_name: str,
    now: Any,
) -> list[DailyWeather]:
    # Normalize sparse API shape into daily rows when present; else empty.
    data = payload.get("data") or []
    by_day: dict[str, dict[str, float | None]] = {}
    for series in data:
        param = str(series.get("parameter") or "")
        for point in series.get("coordinates", [{}])[0].get("dates", []):
            day = str(point.get("date") or "")[:10]
            by_day.setdefault(day, {"temp_max_c": None, "temp_min_c": None, "precip_mm": None})
            value = point.get("value")
            if "t_max" in param:
                by_day[day]["temp_max_c"] = float(value) if value is not None else None
            elif "t_min" in param:
                by_day[day]["temp_min_c"] = float(value) if value is not None else None
            elif "precip" in param:
                by_day[day]["precip_mm"] = float(value) if value is not None else None
    out: list[DailyWeather] = []
    for day, vals in sorted(by_day.items()):
        out.append(
            DailyWeather(
                day=date.fromisoformat(day),
                temp_max_c=vals["temp_max_c"],
                temp_min_c=vals["temp_min_c"],
                precip_mm=vals["precip_mm"],
                source=source,
                product=product,
                retrieved_at=now,
                quality_rank=20,
                license=license_name,
                filled=False,
            )
        )
    return out


def build(**kwargs: Any) -> Meteomatics:
    return Meteomatics(**{k: v for k, v in kwargs.items() if k != "name"})
