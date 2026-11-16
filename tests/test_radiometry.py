"""Radar values go to linear power, then dB, on a scale shared by every date."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave._bootstrap import ensure_vendored  # noqa: E402

ensure_vendored(verify=True)

import numpy as np  # noqa: E402

from termalwave.process.pipeline import (  # noqa: E402
    _normalize_to_uint8,
    colour_window,
    power_to_db,
    to_power,
)

POWER_NAMES = ["hhhh", "hvhv"]
CMAP = {
    "scale": "db_fixed",
    "db_min": -25.0,
    "db_max": 0.0,
    "alpha_positive": 200,
    "r_scale": 1.5,
    "r_offset": -0.2,
    "g_center": 0.5,
    "g_width": 2.5,
    "g_peak": 1.5,
    "b_scale": -1.5,
    "b_offset": 1.2,
}


class RadiometryTests(unittest.TestCase):
    def test_complex_samples_use_modulus_squared(self) -> None:
        z = np.array([[3 + 4j, 0 + 1j]], dtype=np.complex64)
        np.testing.assert_allclose(to_power(z, "/x/HH", POWER_NAMES), [[25.0, 1.0]])

    def test_gcov_terms_are_already_power(self) -> None:
        g = np.array([[0.1, 0.01]])
        np.testing.assert_allclose(to_power(g, "/science/LSAR/GCOV/grids/frequencyA/HHHH", POWER_NAMES), g)

    def test_amplitude_is_squared(self) -> None:
        np.testing.assert_allclose(to_power(np.array([[0.1]]), "/data/amplitude", POWER_NAMES), [[0.01]])

    def test_db_and_nodata(self) -> None:
        db = power_to_db(np.array([[0.1, 1.0, 0.0, np.nan, -1.0]]))
        np.testing.assert_allclose(db[0, :2], [-10.0, 0.0])
        self.assertTrue(np.isnan(db[0, 2:]).all())

    def test_fixed_window_is_independent_of_the_image(self) -> None:
        dim = power_to_db(np.full((4, 4), 0.001))
        bright = power_to_db(np.full((4, 4), 0.5))
        self.assertEqual(colour_window(dim, CMAP), colour_window(bright, CMAP))
        a, b = _normalize_to_uint8(dim, CMAP), _normalize_to_uint8(bright, CMAP)
        self.assertFalse(np.array_equal(a, b))

    def test_nodata_is_transparent(self) -> None:
        rgba = _normalize_to_uint8(power_to_db(np.array([[0.0, 0.1]])), CMAP)
        self.assertEqual(rgba[0, 0, 3], 0)
        self.assertEqual(rgba[0, 1, 3], 200)


if __name__ == "__main__":
    unittest.main()
