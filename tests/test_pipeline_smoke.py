"""Offline pipeline smoke test using the configured fixture."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


class PipelineSmokeTests(unittest.TestCase):
    def test_offline_run_writes_overlay(self) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored
        from termalwave.runtime_config import default_site_config

        ensure_vendored(verify=True)
        from termalwave.process.config import load_config
        from termalwave.process.pipeline import run_pipeline

        config_path = default_site_config()
        cfg = load_config(config_path, REPO)
        result = run_pipeline(
            config_path=config_path,
            offline=True,
            repo_root=REPO,
        )
        png = Path(result["png"])
        sidecar = Path(result["sidecar"])
        self.assertTrue(png.is_file())
        self.assertTrue(sidecar.is_file())
        data = json.loads(sidecar.read_text(encoding="utf-8"))
        self.assertEqual(data["type"], cfg["product"]["sidecar_type"])
        for key in cfg["hdf5"]["bounds_attr_keys"]:
            self.assertIn(key, data["bounds"])
        stem = cfg["product"]["output_stem"]
        mirrors = [Path(p) for p in cfg["paths"]["overlay_mirrors"]]
        self.assertTrue(any((m / f"{stem}.png").is_file() for m in mirrors))
        web_cfg = Path(cfg["paths"]["web_config_out"])
        self.assertTrue(web_cfg.is_file())


if __name__ == "__main__":
    unittest.main()
