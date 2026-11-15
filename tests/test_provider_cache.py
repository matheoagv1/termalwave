"""Offline tests for the request cache, per-request snapshots and atomic writes."""

from __future__ import annotations

import copy
import os
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

REPO = Path(__file__).resolve().parents[1]


def _tmp_files(root: Path) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and p.name.endswith(".tmp")]


class ProviderCacheTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored

        ensure_vendored(verify=False)

    def setUp(self) -> None:
        from termalwave.providers.registry import load_apis_config

        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.apis: dict[str, Any] = copy.deepcopy(load_apis_config(REPO))
        self.apis["paths"]["cache_dir"] = str(self.root)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _all_down(self) -> dict[str, Any]:
        apis = copy.deepcopy(self.apis)
        apis["geocode"]["search"] = ["does_not_exist"]
        apis["geocode"]["reverse"] = ["does_not_exist"]
        apis["elevation"]["order"] = ["does_not_exist"]
        return apis

    def test_search_snapshot_is_per_query(self) -> None:
        from termalwave.providers.resolve import resolve_geocode_search

        live = resolve_geocode_search("Termas de Rio Hondo", repo_root=REPO, offline=True, apis=self.apis)
        self.assertEqual(live["status"], "ok")

        down = self._all_down()
        same = resolve_geocode_search("  termas de RIO hondo ", repo_root=REPO, offline=True, apis=down)
        self.assertEqual(same["status"], "cache")
        self.assertEqual(same["records"], live["records"])

        other = resolve_geocode_search("Buenos Aires", repo_root=REPO, offline=True, apis=down)
        self.assertEqual(other["status"], "unavailable")
        self.assertFalse(other["from_cache"])
        self.assertEqual(other["records"], [])
        self.assertEqual(other["selected_sources"], [])

        other_limit = resolve_geocode_search(
            "Termas de Rio Hondo", repo_root=REPO, offline=True, apis=down, limit=1
        )
        self.assertEqual(other_limit["status"], "unavailable")

    def test_reverse_and_elevation_snapshots_are_per_point(self) -> None:
        from termalwave.model import LatLon
        from termalwave.providers.resolve import resolve_elevations, resolve_geocode_reverse

        a, b = LatLon(-27.4959, -64.8641), LatLon(-27.7951, -64.2615)
        self.assertEqual(
            resolve_geocode_reverse(a.lat, a.lon, repo_root=REPO, offline=True, apis=self.apis)["status"],
            "ok",
        )
        self.assertEqual(
            resolve_elevations([a, b], repo_root=REPO, offline=True, apis=self.apis)["status"],
            "ok",
        )

        down = self._all_down()
        rev_a = resolve_geocode_reverse(a.lat, a.lon, repo_root=REPO, offline=True, apis=down)
        rev_b = resolve_geocode_reverse(b.lat, b.lon, repo_root=REPO, offline=True, apis=down)
        self.assertEqual(rev_a["status"], "cache")
        self.assertEqual(rev_b["status"], "unavailable")

        swapped = resolve_elevations([b, a], repo_root=REPO, offline=True, apis=down)
        only_a = resolve_elevations([a], repo_root=REPO, offline=True, apis=down)
        self.assertEqual(swapped["status"], "cache")
        self.assertEqual(only_a["status"], "unavailable")

    def test_unavailable_run_writes_no_snapshot(self) -> None:
        from termalwave.providers.resolve import resolve_geocode_search

        result = resolve_geocode_search("Nowhere", repo_root=REPO, offline=True, apis=self._all_down())
        self.assertEqual(result["status"], "unavailable")
        self.assertFalse((self.root / "snapshots").exists())

    def test_corrupt_snapshot_is_a_miss(self) -> None:
        from termalwave.providers.resolve import resolve_geocode_search
        from termalwave.providers.snapshot import snapshot_path

        resolve_geocode_search("Termas de Rio Hondo", repo_root=REPO, offline=True, apis=self.apis)
        path = snapshot_path(self.root, "geocode_search", {"query": "termas de rio hondo", "limit": 5})
        self.assertTrue(path.is_file())
        path.write_text("{not json", encoding="utf-8")

        result = resolve_geocode_search(
            "Termas de Rio Hondo", repo_root=REPO, offline=True, apis=self._all_down()
        )
        self.assertEqual(result["status"], "unavailable")

    def test_request_cache_from_config(self) -> None:
        from termalwave.providers.request_cache import RequestCache

        self.apis["cache"] = {"request_max_age_s": 10}
        cache = RequestCache.from_config(REPO, self.apis)
        self.assertEqual(cache.root, self.root)
        self.assertEqual(cache.max_age_s, 10.0)

        relative = copy.deepcopy(self.apis)
        relative["paths"]["cache_dir"] = "data/cache"
        self.assertEqual(RequestCache.from_config(REPO, relative).root, (REPO / "data" / "cache").resolve())

        calls: list[int] = []

        def load() -> dict[str, Any]:
            calls.append(1)
            return {"results": []}

        with mock.patch("termalwave.providers.request_cache.time.time", return_value=1000.0):
            self.assertEqual(cache.fetch("ns", "k", load), {"results": []})
            self.assertEqual(cache.fetch("ns", "k", load), {"results": []})
        self.assertEqual(len(calls), 1)
        self.assertTrue(cache.path("ns", "k").is_relative_to(self.root / "requests" / "ns"))

        with mock.patch("termalwave.providers.request_cache.time.time", return_value=1011.0):
            self.assertIsNone(cache.get("ns", "k"))
            cache.fetch("ns", "k", load)
        self.assertEqual(len(calls), 2)

        cache.path("ns", "k").write_text("{broken", encoding="utf-8")
        self.assertIsNone(cache.get("ns", "k"))

    def test_load_error_is_not_cached(self) -> None:
        from termalwave.providers.request_cache import RequestCache

        cache = RequestCache(root=self.root)

        def boom() -> Any:
            raise RuntimeError("down")

        with self.assertRaises(RuntimeError):
            cache.fetch("ns", "k", boom)
        self.assertFalse(cache.path("ns", "k").exists())

    def test_providers_receive_configured_cache(self) -> None:
        from termalwave.providers.chain import ProviderEnv

        self.apis["cache"] = {"request_max_age_s": 42}
        env = ProviderEnv.load(REPO, offline=True, apis=self.apis)
        for provider in env.providers("geocode") + env.providers("elevation"):
            self.assertIs(provider.cache, env.cache)
        self.assertEqual(env.cache.root, self.root)
        self.assertEqual(env.cache.max_age_s, 42.0)

    def test_atomic_write_leaves_no_temp_files(self) -> None:
        from termalwave.providers.cache import read_json, write_json_atomic

        target = self.root / "nested" / "out.json"
        for i in range(5):
            write_json_atomic(target, {"i": i})
        self.assertEqual(read_json(target), {"i": 4})
        self.assertEqual(sorted(p.name for p in target.parent.iterdir()), ["out.json"])

        with mock.patch("termalwave.providers.cache.os.replace", side_effect=OSError("disk")):
            with self.assertRaises(OSError):
                write_json_atomic(target, {"i": 99})
        self.assertEqual(read_json(target), {"i": 4})
        self.assertEqual(_tmp_files(self.root), [])

    def test_resolve_and_ingest_leave_no_temp_files(self) -> None:
        from termalwave.model import LatLon
        from termalwave.process import ingest as ingest_mod
        from termalwave.process.config import load_config
        from termalwave.providers.chain import ProviderEnv
        from termalwave.providers.resolve import resolve_elevations
        from termalwave.runtime_config import default_site_config

        resolve_elevations([LatLon(-27.4959, -64.8641)], repo_root=REPO, offline=True, apis=self.apis)
        cfg = load_config(default_site_config(), REPO)
        env = ProviderEnv.load(REPO, offline=True, apis=self.apis)
        aoi = ingest_mod._aoi_from_cfg(cfg)
        period = ingest_mod._period_from_cfg(cfg)
        for kind in ("fires", "weather"):
            ingest_mod._run_kind(kind, env=env, aoi=aoi, period=period)
        self.assertTrue(any((self.root / "snapshots").rglob("*.json")))
        self.assertEqual(_tmp_files(self.root), [])
        self.assertFalse(any(name.startswith(".") for _, _, names in os.walk(self.root) for name in names))


if __name__ == "__main__":
    unittest.main()
