"""Shared typed records for unified data providers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class AOI:
    west: float
    east: float
    south: float
    north: float
    name: str = ""

    def as_bbox(self) -> tuple[float, float, float, float]:
        return (self.west, self.south, self.east, self.north)


@dataclass(frozen=True)
class Period:
    start: date
    end: date


@dataclass
class ProvenanceFields:
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str


@dataclass
class Hotspot:
    lat: float
    lon: float
    observed_at: datetime
    brightness: float | None
    confidence: str | None
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str


@dataclass
class DailyWeather:
    day: date
    temp_max_c: float | None
    temp_min_c: float | None
    precip_mm: float | None
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str
    filled: bool = False


@dataclass
class SceneRef:
    scene_id: str
    acquired_at: datetime
    cloud_pct: float | None
    href: str
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str


@dataclass
class GranuleRef:
    granule_id: str
    acquired_at: datetime
    status: str  # validated | provisional | unknown
    href: str
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str


@dataclass(frozen=True)
class LatLon:
    lat: float
    lon: float


@dataclass
class ElevationSample:
    lat: float
    lon: float
    meters: float | None
    dem: str
    resolution_m: float | None
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str
    disagree: bool = False


@dataclass
class Place:
    name: str
    lat: float
    lon: float
    display: str
    source: str
    product: str
    retrieved_at: datetime
    quality_rank: int
    license: str


@dataclass(frozen=True)
class BasemapDef:
    id: str
    kind: str  # raster | vector | terrain
    url_template: str
    attribution: str
    license: str
    max_zoom: int
    time_dimension: bool = False


def record_to_dict(obj: Any) -> dict[str, Any]:
    data = asdict(obj)
    for key, value in list(data.items()):
        if isinstance(value, datetime):
            data[key] = value.isoformat()
        elif isinstance(value, date):
            data[key] = value.isoformat()
    return data
