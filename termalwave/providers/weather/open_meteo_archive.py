"""Open-Meteo archive weather adapter (no credential required)."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Any

from termalwave.model import AOI, DailyWeather, Period, utc_now
from termalwave.providers._fixture import load_json_fixture
from termalwave.providers.http import build_url, http_get_json

# archive rejects multi-year spans and future end dates; chunk ~1 year
_CHUNK_DAYS = 366


def _clamp_archive_period(period: Period) -> Period | None:
    today = utc_now().date()
    end = min(period.end, today)
    start = period.start
    if start > end:
        return None
    return Period(start=start, end=end)


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
            payloads = [load_json_fixture(self.fixtures_dir, self.name)]
        else:
            clamped = _clamp_archive_period(period)
            if clamped is None:
                return []
            lat = (aoi.north + aoi.south) / 2.0
            lon = (aoi.east + aoi.west) / 2.0
            base = self.endpoints.get(self.name) or "https://archive-api.open-meteo.com/v1/archive"
            payloads = []
            chunk_start = clamped.start
            while chunk_start <= clamped.end:
                chunk_end = min(clamped.end, chunk_start + timedelta(days=_CHUNK_DAYS - 1))
                url = build_url(
                    base,
                    {
                        "latitude": lat,
                        "longitude": lon,
                        "start_date": chunk_start.isoformat(),
                        "end_date": chunk_end.isoformat(),
                        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                        "timezone": "UTC",
                    },
                )
                payloads.append(http_get_json(url))
                chunk_start = chunk_end + timedelta(days=1)

        out: list[DailyWeather] = []
        for payload in payloads:
            daily = payload.get("daily") or {}
            days = daily.get("time") or []
            tmax = daily.get("temperature_2m_max") or [None] * len(days)
            tmin = daily.get("temperature_2m_min") or [None] * len(days)
            precip = daily.get("precipitation_sum") or [None] * len(days)
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
