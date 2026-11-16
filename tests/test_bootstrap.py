"""Bootstrap and vendor isolation tests (stdlib unittest)."""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def _runtime() -> dict:
    return json.loads((REPO / "config" / "runtime.json").read_text(encoding="utf-8"))


class BootstrapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        os.environ["PYTHONNOUSERSITE"] = "1"

    def test_required_python_and_tag(self) -> None:
        from termalwave._bootstrap import (
            REQUIRED_PYTHON,
            SUPPORTED_TAGS,
            active_tag,
            ensure_vendored,
            vendor_dir_for_tag,
        )

        runtime = _runtime()
        expected = (int(runtime["python"]["major"]), int(runtime["python"]["minor"]))
        self.assertEqual(REQUIRED_PYTHON, expected)
        self.assertEqual(
            SUPPORTED_TAGS,
            tuple(p["tag"] for p in runtime["platforms"]),
        )
        vendor = ensure_vendored(verify=True)
        tag = active_tag()
        self.assertIsNotNone(tag)
        assert tag is not None
        self.assertIn(tag, SUPPORTED_TAGS)
        self.assertTrue(vendor.is_dir())
        self.assertEqual(vendor, vendor_dir_for_tag(tag))

    def test_third_party_comes_from_vendor(self) -> None:
        from termalwave._bootstrap import ensure_vendored, vendor_dir_for_tag

        vendor = ensure_vendored()
        import h5py
        import numpy
        from PIL import Image

        for module in (numpy, h5py, Image):
            path = Path(module.__file__).resolve()
            self.assertTrue(
                str(path).startswith(str(vendor.resolve())),
                f"{module} loaded from {path}, expected under {vendor}",
            )

        site_markers = ("site-packages", "dist-packages")
        for module in (numpy, h5py):
            path = str(Path(module.__file__).resolve())
            self.assertFalse(any(marker in path for marker in site_markers))


class GeorefTests(unittest.TestCase):
    def test_geotransform_bounds(self) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored

        ensure_vendored()
        from termalwave.process.georef import bounds_from_geotransform

        # Synthetic geotransform inputs for the math unit (not site AOI literals).
        origin_x, pixel_w, origin_y, pixel_h = 10.0, 0.5, 20.0, -0.25
        width, height = 4, 8
        bounds = bounds_from_geotransform(
            (origin_x, pixel_w, 0.0, origin_y, 0.0, pixel_h), width, height
        )
        self.assertAlmostEqual(bounds["west"], origin_x)
        self.assertAlmostEqual(bounds["east"], origin_x + pixel_w * width)
        self.assertAlmostEqual(bounds["north"], origin_y)
        self.assertAlmostEqual(bounds["south"], origin_y + pixel_h * height)


if __name__ == "__main__":
    unittest.main()
