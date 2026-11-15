"""Archive policy, stats and prune for the provider cache."""

from __future__ import annotations

import sys
import time
import unittest
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave._bootstrap import ensure_vendored  # noqa: E402

ensure_vendored(verify=False)

from termalwave.providers.cache_admin import CachePolicy, format_stats, prune, stats  # noqa: E402
from termalwave.providers.request_cache import RequestCache  # noqa: E402


class CacheAdminTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(self._testMethodName + "-cache")
        # use tempfile via unittest? keep under /tmp
        import tempfile
        self._tmp = tempfile.TemporaryDirectory(prefix="tw-cache-")
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.cache = RequestCache(root=self.root, max_age_s=60, settle_days=3)

    def test_past_dates_go_to_archive(self) -> None:
        past = date.today() - timedelta(days=10)
        self.cache.put("weather", "day-a", {"ok": 1}, dated_until=past)
        path = self.cache.path("weather", "day-a", archived=True)
        self.assertTrue(path.is_file())
        self.assertIsNotNone(self.cache.get("weather", "day-a", dated_until=past))

    def test_latest_expires(self) -> None:
        short = RequestCache(root=self.root, max_age_s=0.05, settle_days=3)
        short.put("geocode", "q", {"r": 1})
        time.sleep(0.08)
        self.assertIsNone(short.get("geocode", "q"))

    def test_prune_dry_run_and_real(self) -> None:
        policy = CachePolicy(request_max_age_s=0.05, settle_days=3, max_bytes=10_000_000)
        self.cache.put("geocode", "old", {"r": 1})
        time.sleep(0.08)
        dry = prune(self.root, policy, dry_run=True)
        self.assertGreaterEqual(dry["removed"], 1)
        self.assertTrue(self.cache.path("geocode", "old").is_file())
        real = prune(self.root, policy, dry_run=False)
        self.assertGreaterEqual(real["removed"], 1)
        self.assertFalse(self.cache.path("geocode", "old").is_file())

    def test_prune_skips_archive(self) -> None:
        past = date.today() - timedelta(days=30)
        self.cache.put("weather", "keep", {"ok": 1}, dated_until=past)
        policy = CachePolicy(request_max_age_s=0.0, settle_days=3, max_bytes=10)
        prune(self.root, policy, dry_run=False)
        self.assertTrue(self.cache.path("weather", "keep", archived=True).is_file())

    def test_stats_lists_namespaces(self) -> None:
        self.cache.put("geocode", "x", {"r": 1})
        report = stats(self.root)
        self.assertIn("geocode", report["namespaces"])
        text = format_stats(report)
        self.assertIn("geocode", text)

    def test_policy_from_apis(self) -> None:
        p = CachePolicy.from_apis({"cache": {"request_max_age_s": 10, "settle_days": 2, "max_bytes": 99}})
        self.assertEqual(p.request_max_age_s, 10)
        self.assertTrue(p.is_archive(date.today() - timedelta(days=5)))
        self.assertFalse(p.is_archive(date.today()))


if __name__ == "__main__":
    unittest.main()
