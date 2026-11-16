"""layers.toml publishes both languages for the layers on screen."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave.process.config import load_layers_taxonomy  # noqa: E402


class LayersBilingualTests(unittest.TestCase):
    def test_shipped_layers_have_both_languages(self) -> None:
        tax = load_layers_taxonomy(REPO)
        by_id = {row["id"]: row for row in tax["layers"]}
        for lid in ("radar", "suelo", "contaminacion", "incendios"):
            row = by_id[lid]
            self.assertTrue(row["label_en"])
            self.assertTrue(row["label_es"])
            self.assertTrue(row["what_en"])
            self.assertTrue(row["what_es"])
            self.assertNotEqual(row["what_en"], row["what_es"])
        radar = by_id["radar"]
        self.assertEqual(radar["unit"], "dB")
        self.assertEqual(radar["range"], [-30.0, -5.0])
        self.assertIn("log10", radar["formula"])
        self.assertGreaterEqual(len(radar["ramp"]), 2)
        self.assertIn("Contaminación", by_id["contaminacion"]["label_es"])


if __name__ == "__main__":
    unittest.main()
