"""Offline tests for elevation/geocode adapters, merge, cache, attributions."""

from __future__ import annotations

import copy
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from _sandbox import sandbox_root  # noqa: E402


class ElevationGeocodeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored

        ensure_vendored(verify=False)

    def test_offline_elevation_fallback_order(self) -> None:
        from termalwave.model import LatLon
        from termalwave.providers.resolve import resolve_elevations
        from termalwave.providers.registry import load_apis_config

        apis = load_apis_config(REPO)
        self.assertEqual(
            apis["elevation"]["order"],
            ["open_meteo_elevation", "opentopodata_srtm30m"],
        )
        pt = LatLon(lat=-27.4959, lon=-64.8641)
        result = resolve_elevations([pt], repo_root=REPO, offline=True, apis=apis)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["records"][0]["source"], "open_meteo_elevation")
        self.assertAlmostEqual(result["records"][0]["meters"], 267.0)
        self.assertEqual(result["records"][0]["dem"], "copernicus-glo90")
        self.assertIn("open_meteo_elevation", result["tried"][0]["provider"])

    def test_elevation_disagree_flag(self) -> None:
        from termalwave.merge import merge_elevation_first_available
        from termalwave.model import ElevationSample

        now = datetime(2024, 6, 1, tzinfo=timezone.utc)
        a = [
            ElevationSample(
                lat=-27.5,
                lon=-64.8,
                meters=267.0,
                dem="glo90",
                resolution_m=90,
                source="open_meteo_elevation",
                product="om",
                retrieved_at=now,
                quality_rank=10,
                license="x",
            )
        ]
        b = [
            ElevationSample(
                lat=-27.5,
                lon=-64.8,
                meters=310.0,
                dem="srtm",
                resolution_m=30,
                source="opentopodata_srtm30m",
                product="srtm",
                retrieved_at=now,
                quality_rank=20,
                license="y",
            )
        ]
        merged = merge_elevation_first_available([a, b], disagree_meters=30.0)
        self.assertEqual(merged[0].source, "open_meteo_elevation")
        self.assertTrue(merged[0].disagree)

    def test_offline_geocode_search_photon_first(self) -> None:
        from termalwave.providers.resolve import resolve_geocode_search
        from termalwave.providers.registry import load_apis_config

        apis = load_apis_config(REPO)
        self.assertEqual(apis["geocode"]["search"][0], "photon")
        result = resolve_geocode_search(
            "Termas de Rio Hondo",
            repo_root=REPO,
            offline=True,
            apis=apis,
        )
        self.assertEqual(result["status"], "ok")
        self.assertGreater(len(result["records"]), 0)
        self.assertEqual(result["records"][0]["source"], "photon")
        # Termas, not Santiago city center
        lat = result["records"][0]["lat"]
        self.assertLess(abs(lat - (-27.4959)), 0.5)

    def test_offline_geocode_reverse(self) -> None:
        from termalwave.providers.resolve import resolve_geocode_reverse

        result = resolve_geocode_reverse(
            -27.4959,
            -64.8641,
            repo_root=REPO,
            offline=True,
        )
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["records"][0]["source"], "photon")

    def test_geocode_dedupe_distance(self) -> None:
        from termalwave.merge import merge_geocode_first_nonempty
        from termalwave.model import Place

        now = datetime(2024, 6, 1, tzinfo=timezone.utc)
        a = Place(
            name="A",
            lat=-27.4959,
            lon=-64.8641,
            display="A",
            source="photon",
            product="p",
            retrieved_at=now,
            quality_rank=10,
            license="x",
        )
        b = Place(
            name="B",
            lat=-27.4960,
            lon=-64.8642,
            display="B",
            source="nominatim",
            product="n",
            retrieved_at=now,
            quality_rank=30,
            license="y",
        )
        far = Place(
            name="C",
            lat=-27.8,
            lon=-64.25,
            display="Santiago",
            source="open_meteo_geocode",
            product="om",
            retrieved_at=now,
            quality_rank=20,
            license="z",
        )
        merged = merge_geocode_first_nonempty([[a], [b, far]], dedupe_distance_m=500.0)
        names = [p.name for p in merged]
        self.assertIn("A", names)
        self.assertNotIn("B", names)
        self.assertIn("C", names)

    def test_rate_limiter_waits(self) -> None:
        from termalwave.providers import rate_limit

        rate_limit._LAST.clear()
        sleeps: list[float] = []

        def fake_sleep(s: float) -> None:
            sleeps.append(s)

        with mock.patch.object(rate_limit.time, "sleep", side_effect=fake_sleep):
            with mock.patch.object(rate_limit.time, "monotonic", side_effect=[0.0, 0.0, 0.5, 0.5]):
                rate_limit.wait("t", 1.0)
                rate_limit.wait("t", 1.0)
        self.assertTrue(any(s > 0 for s in sleeps))

    def test_request_cache_hit(self) -> None:
        from termalwave.providers.request_cache import RequestCache

        with tempfile.TemporaryDirectory() as tmp:
            cache = RequestCache(root=Path(tmp), max_age_s=3600)
            cache.put("ns", "key", {"ok": True})
            self.assertEqual(cache.get("ns", "key"), {"ok": True})
            self.assertIsNone(cache.get("ns", "other"))

    def test_all_down_uses_cached_snapshot(self) -> None:
        from termalwave.model import LatLon
        from termalwave.providers.registry import load_apis_config
        from termalwave.providers.resolve import resolve_elevations

        pt = LatLon(-27.4959, -64.8641)
        with tempfile.TemporaryDirectory() as tmp:
            apis = copy.deepcopy(load_apis_config(REPO))
            apis["paths"]["cache_dir"] = tmp
            live = resolve_elevations([pt], repo_root=REPO, offline=True, apis=apis)
            self.assertEqual(live["status"], "ok")

            apis["elevation"]["order"] = ["does_not_exist"]
            result = resolve_elevations([pt], repo_root=REPO, offline=True, apis=apis)
        self.assertEqual(result["status"], "cache")
        self.assertTrue(result["from_cache"])
        self.assertEqual(result["records"], live["records"])
        self.assertEqual(result["selected_sources"], live["selected_sources"])

    def test_attributions_from_config(self) -> None:
        from termalwave.merge import basemap_attributions
        from termalwave.providers.registry import basemap_defs, load_apis_config

        apis = load_apis_config(REPO)
        credits = basemap_attributions(apis)
        attrs = " ".join(c["attribution"] for c in credits)
        self.assertIn("GIBS", attrs)
        self.assertIn("Open-Meteo", attrs)
        self.assertIn("OpenStreetMap", attrs)
        self.assertIn("EOxCloudless", attrs)
        defs = basemap_defs(apis)
        ids = [d["id"] for d in defs]
        self.assertEqual(ids[0], "gibs_modis_truecolor")
        self.assertIn("openfreemap_liberty", ids)
        self.assertIn("eox_s2cloudless_2025", ids)
        self.assertIn("cesium_world_terrain", ids)

    def test_google_disabled_and_no_secret_in_git(self) -> None:
        import subprocess

        from termalwave.providers.registry import load_apis_config

        apis = load_apis_config(REPO)
        self.assertFalse(apis.get("scene", {}).get("google_maps_enabled", True))
        # No committed secret files / AIza keys in tracked tree (git grep).
        tracked = set(
            subprocess.check_output(
                ["git", "ls-files", "config/"],
                cwd=REPO,
                text=True,
            ).splitlines()
        )
        self.assertNotIn("config/secrets.local.toml", tracked)
        self.assertIn("config/secrets.local.toml.example", tracked)
        grep = subprocess.run(
            ["git", "grep", "-I", "-n", "-E", "AIza[0-9A-Za-z_-]{35}"],
            cwd=REPO,
            capture_output=True,
            text=True,
        )
        self.assertEqual(grep.returncode, 1, msg=grep.stdout)

    def test_app_config_emits_basemaps(self) -> None:
        import json

        from termalwave.process.config import load_config, write_web_app_config
        from termalwave.runtime_config import default_site_config

        from termalwave.providers.registry import load_apis_config

        root = sandbox_root(self)
        config_path = root / default_site_config().relative_to(REPO)
        cfg = load_config(config_path, root)
        written = write_web_app_config(cfg, root)
        self.assertTrue(written)
        self.assertTrue(all(p.is_relative_to(root) for p in written))
        payload = json.loads(written[0].read_text(encoding="utf-8"))
        self.assertIn("basemaps", payload)
        self.assertEqual(payload["basemaps"]["default"], load_apis_config(REPO)["basemaps"]["default"])
        self.assertFalse(payload["scene"]["google_maps_enabled"])
        self.assertTrue(payload["basemaps"]["credits"])


if __name__ == "__main__":
    unittest.main()
