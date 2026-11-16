"""Fixed palettes, change, RVI and UTM axes. No granule download."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave._bootstrap import ensure_vendored

ensure_vendored()

import numpy as np

import h5py

from termalwave.process.nisar_raster import (
    change_db,
    colorize,
    crop_lonlat,
    db_stats,
    los_mm,
    los_publishable,
    read_window,
    rvi_linear,
    utm_to_lonlat,
)


class RasterMathTests(unittest.TestCase):
    def test_change_is_later_minus_earlier(self) -> None:
        later = np.array([[-10.0, np.nan], [-12.0, -8.0]])
        earlier = np.array([[-12.0, -4.0], [-12.0, -14.0]])
        delta = change_db(later, earlier)
        self.assertAlmostEqual(float(delta[0, 0]), 2.0)
        self.assertTrue(np.isnan(delta[0, 1]))
        self.assertAlmostEqual(float(delta[1, 1]), 6.0)

    def test_rvi_formula(self) -> None:
        hh = np.array([0.1, -1.0])
        hv = np.array([0.1, 0.2])
        out = rvi_linear(hh, hv)
        self.assertAlmostEqual(float(out[0]), 4 * 0.1 / 0.2)
        self.assertTrue(np.isnan(out[1]))

    def test_los_sign(self) -> None:
        # positive phase is range increase, so displacement along LOS is negative
        mm = los_mm(np.array([math_pi()]))
        self.assertLess(float(mm[0]), 0)

    def test_los_metre_offset_is_not_published(self) -> None:
        # the 9-21 Oct GUNW pair: median ~1655 mm, spread ~160 mm, painted on ±6
        field = np.array([1572.0, 1657.0, 1736.0])
        self.assertFalse(los_publishable(field))
        near_zero = np.array([-12.0, 0.0, 8.0])
        self.assertTrue(los_publishable(near_zero))

    def test_crop_uses_the_grid_not_the_request_box(self) -> None:
        lon = np.array([-64.40, -64.30, -64.20, -64.10])
        lat = np.array([-27.95, -27.85, -27.75, -27.65])
        values = np.arange(16, dtype=np.float64).reshape(4, 4)
        grid = crop_lonlat(values, lon, lat, (-64.35, -27.90, -64.16, -27.70))
        self.assertGreater(grid.bounds["west"], -64.40)
        self.assertLess(grid.bounds["east"], -64.10)
        self.assertEqual(grid.values.shape[0], grid.lat.size)
        self.assertEqual(grid.values.shape[1], grid.lon.size)

    def test_empty_samples_have_no_fake_mean(self) -> None:
        stats = db_stats(np.array([np.nan, np.nan]))
        self.assertEqual(stats["count"], 0)
        self.assertIsNone(stats["mean"])

    def test_palette_hides_nodata(self) -> None:
        rgba = colorize(np.array([[-20.0, np.nan]]), -30.0, -5.0, ((0.0, (0, 0, 0)), (1.0, (255, 255, 255))))
        self.assertEqual(int(rgba[0, 1, 3]), 0)
        self.assertGreater(int(rgba[0, 0, 3]), 0)

    def test_projection_dataset_value_is_epsg(self) -> None:
        import tempfile

        lons = np.array([-64.40, -64.30, -64.20, -64.10])
        lats = np.array([-27.95, -27.85, -27.75, -27.65])
        east = np.array([_forward_utm(float(lon), -27.80, 20, False)[0] for lon in lons])
        north = np.array([_forward_utm(-64.25, float(lat), 20, False)[1] for lat in lats])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "gcov.h5"
            with h5py.File(path, "w") as handle:
                grid = handle.create_group("/science/LSAR/GCOV/grids/frequencyA")
                grid.create_dataset("HVHV", data=np.arange(16, dtype=np.float32).reshape(4, 4))
                grid.create_dataset("xCoordinates", data=east)
                grid.create_dataset("yCoordinates", data=north)
                proj = grid.create_dataset("projection", data=np.int32(32720))
                proj.attrs["epsg_code"] = np.int32(32720)
                proj.attrs["spatial_ref"] = b'PROJCS["WGS 84 / UTM zone 20S",AUTHORITY["EPSG","32720"]]'
                other = handle.create_group("/science/LSAR/GCOV/grids/frequencyB")
                other.create_dataset("projection", data=np.int32(32618))
                meta = handle.create_group("/science/LSAR/GCOV/metadata")
                meta.create_dataset("utm_zone", data=b"20N")
            grid, epsg = read_window(str(path), "HVHV", (-64.35, -27.90, -64.16, -27.70), to_db=True)
        self.assertEqual(epsg, 32720)
        self.assertGreater(grid.values.size, 0)
        self.assertLess(grid.bounds["west"], -64.16)
        self.assertGreater(grid.bounds["east"], -64.35)

    def test_utm_zone_metadata_when_projection_is_empty(self) -> None:
        import tempfile

        lons = np.array([-64.40, -64.20])
        lats = np.array([-27.90, -27.70])
        east = np.array([_forward_utm(float(lon), -27.80, 20, False)[0] for lon in lons])
        north = np.array([_forward_utm(-64.25, float(lat), 20, False)[1] for lat in lats])
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "gcov.h5"
            with h5py.File(path, "w") as handle:
                grid = handle.create_group("/science/LSAR/GCOV/grids/frequencyA")
                grid.create_dataset("HVHV", data=np.ones((2, 2), dtype=np.float32))
                grid.create_dataset("xCoordinates", data=east)
                grid.create_dataset("yCoordinates", data=north)
                grid.create_dataset("projection", data=np.int32(0))
                handle.create_dataset("/science/LSAR/GCOV/metadata/utm_zone", data=b"20S")
            _, epsg = read_window(str(path), "HVHV", (-64.35, -27.90, -64.16, -27.70), to_db=False)
        self.assertEqual(epsg, 32720)

    def test_utm_roundtrip_near_santiago(self) -> None:
        lon0, lat0 = -64.25, -27.80
        east, north = _forward_utm(lon0, lat0, zone=20, northern=False)
        lon, lat = utm_to_lonlat(np.array([east]), np.array([north]), 20, False)
        self.assertAlmostEqual(float(lon[0]), lon0, places=4)
        self.assertAlmostEqual(float(lat[0]), lat0, places=4)


def math_pi() -> float:
    return 3.141592653589793


def _forward_utm(lon: float, lat: float, zone: int, northern: bool) -> tuple[float, float]:
    import math

    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    phi = math.radians(lat)
    lam = math.radians(lon) - lon0
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = ep2 * math.cos(phi) ** 2
    aa = math.cos(phi) * lam
    m = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * phi)
    )
    east = k0 * n * (aa + (1 - t + c) * aa ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5 / 120) + 500000.0
    north = k0 * (
        m
        + n
        * math.tan(phi)
        * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24 + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6 / 720)
    )
    if not northern:
        north += 10000000.0
    return east, north


if __name__ == "__main__":
    unittest.main()
