"""Open-Meteo archive weather adapter (no credential required)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from termalwave.model import AOI, DailyWeather, Period, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json


class OpenMeteoArchive:
    name = "open_meteo_archive"

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

    def fetch(self, aoi: AOI, period: Period) -> list[DailyWeather]:
        product = str(self.meta.get("product", "open-meteo-archive"))
        license_name = str(self.meta.get("license", "Open-Meteo / CC-BY"))
        now = utc_now()
        if self.offline:
            payload = load_json_fixture(self.fixtures_dir, self.name)
        else:
            lat = (aoi.north + aoi.south) / 2.0
            lon = (aoi.east + aoi.west) / 2.0
            base = self.endpoints.get(self.name) or "https://archive-api.open-meteo.com/v1/archive"
            url = build_url(
                base,
                {
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": period.start.isoformat(),
                    "end_date": period.end.isoformat(),
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                    "timezone": "UTC",
                },
            )
            payload = http_get_json(url)
        daily = payload.get("daily") or {}
        days = daily.get("time") or []
        tmax = daily.get("temperature_2m_max") or [None] * len(days)
        tmin = daily.get("temperature_2m_min") or [None] * len(days)
        precip = daily.get("precipitation_sum") or [None] * len(days)
        out: list[DailyWeather] = []
        for idx, day_s in enumerate(days):
            out.append(
                DailyWeather(
                    day=date.fromisoformat(str(day_s)[:10]),
                    temp_max_c=_f(tmax[idx]) if idx < len(tmax) else None,
                    temp_min_c=_f(tmin[idx]) if idx < len(tmin) else None,
                    precip_mm=_f(precip[idx]) if idx < len(precip) else None,
                    source=self.name,
                    product=product,
                    retrieved_at=now,
                    quality_rank=10,
                    license=license_name,
                    filled=False,
                )
            )
        return out


def _f(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def build(**kwargs: Any) -> OpenMeteoArchive:
    return OpenMeteoArchive(**{k: v for k, v in kwargs.items() if k != "name"})
