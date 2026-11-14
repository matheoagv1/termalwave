"""Protocols per data kind (no inheritance trees)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from termalwave.model import AOI, DailyWeather, GranuleRef, Hotspot, Period, SceneRef


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
