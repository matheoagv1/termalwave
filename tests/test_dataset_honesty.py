"""Honesty is per layer and per frame, not one global flag."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave.process.dataset_export import (  # noqa: E402
    BEFORE_NISAR_EN,
    apply_honesty,
    series_for_layer,
)


def _dataset() -> dict:
    def frame(url: str, **extra: object) -> dict:
        row = {"url": url, "bounds": {}, "kind": "composite"}
        row.update(extra)
        return row

    return {
        "timelineSynthetic": True,
        "isMock": True,
        "layers": [
            {"id": "radar", "label": "Radar", "note": ""},
            {"id": "suelo", "label": "Suelo", "note": ""},
        ],
        "segments": [
            {
                "id": "anual",
                "ticks": [
                    {
                        "id": "y-2018",
                        "start": "2018-01-01",
                        "label": "2018",
                        "frames": {"radar": frame("r2018.png"), "suelo": frame("s2018.png")},
                    },
                    {
                        "id": "y-2026",
                        "start": "2026-01-01",
                        "label": "2026",
                        "frames": {
                            "radar": frame("r2026.png", granule="NISAR_L2_PR_GCOV_x", honesty="measured", mean_db=-18.5),
                            "suelo": frame("s2026.png"),
                        },
                    },
                ],
            }
        ],
    }


class HonestyTests(unittest.TestCase):
    def test_pre_nisar_radar_is_example_and_later_measured_stays(self) -> None:
        ds = apply_honesty(_dataset(), synthetic=True)
        frames = {t["label"]: t["frames"] for t in ds["segments"][0]["ticks"]}
        old = frames["2018"]["radar"]
        new = frames["2026"]["radar"]
        self.assertEqual(old["honesty"], "example")
        self.assertEqual(old["note_en"], BEFORE_NISAR_EN)
        self.assertIn("Antes de NISAR", old["note_es"])
        self.assertEqual(new["honesty"], "measured")
        self.assertFalse(ds["isMock"])
        by_id = {layer["id"]: layer["honesty"] for layer in ds["layers"]}
        self.assertEqual(by_id["radar"], "measured")
        self.assertEqual(by_id["suelo"], "example")

    def test_series_uses_mean_db_and_leaves_the_rest_empty(self) -> None:
        ds = apply_honesty(_dataset(), synthetic=True)
        rows = series_for_layer(ds, "radar")
        self.assertIsNone(rows[0]["value"])
        self.assertEqual(rows[1]["value"], -18.5)
        suelo = series_for_layer(ds, "suelo")
        self.assertTrue(all(row["value"] is None for row in suelo))


if __name__ == "__main__":
    unittest.main()
