"""Protocols per data kind (no inheritance trees)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from termalwave.model import (
    AOI,
    DailyWeather,
    ElevationSample,
    GranuleRef,
    Hotspot,
    LatLon,
    Period,
    Place,
    SceneRef,
)


@runtime_checkable
class FireHotspots(Protocol):
    name: str

    def fetch(self, aoi: AOI, period: Period) -> list[Hotspot]:
        ...


@runtime_checkable
class Weather(Protocol):
    name: str

    def fetch(self, aoi: AOI, period: Period) -> list[DailyWeather]:
        ...


@runtime_checkable
class OpticalScene(Protocol):
    name: str

    def fetch(self, aoi: AOI, date_window: Period) -> list[SceneRef]:
        ...


@runtime_checkable
class RadarScene(Protocol):
    name: str

    def fetch(self, aoi: AOI, date_window: Period) -> list[GranuleRef]:
        ...


@runtime_checkable
class Elevation(Protocol):
    name: str

    def elevations(self, points: list[LatLon]) -> list[ElevationSample]:
        ...


@runtime_checkable
class Geocoder(Protocol):
    name: str

    def search(self, query: str) -> list[Place]:
        ...

    def reverse(self, lat: float, lon: float) -> Place | None:
        ...
