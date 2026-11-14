"""Offline tests for provider merge policies and ingest fallback."""

from __future__ import annotations

import json
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


class MergePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored

        ensure_vendored(verify=False)

    def test_fires_dedupe_prefers_sp_over_nrt(self) -> None:
        from termalwave.merge import merge_fires_union_dedupe
        from termalwave.model import Hotspot

        now = datetime(2024, 6, 15, 1, 30, tzinfo=timezone.utc)
        sp = [
            Hotspot(
                lat=-27.80,
                lon=-64.25,
                observed_at=now,
                brightness=330.0,
                confidence="high",
                source="firms_viirs_sp",
                product="VIIRS_SNPP_SP",
                retrieved_at=now,
                quality_rank=10,
                license="NASA FIRMS",
            )
        ]
        nrt = [
            Hotspot(
                lat=-27.8005,
                lon=-64.2505,
                observed_at=now.replace(minute=40),
                brightness=329.0,
                confidence="nominal",
                source="firms_viirs_nrt",
                product="VIIRS_SNPP_NRT",
                retrieved_at=now,
                quality_rank=20,
                license="NASA FIRMS",
            ),
            Hotspot(
                lat=-27.85,
                lon=-64.20,
                observed_at=datetime(2024, 6, 16, 2, 0, tzinfo=timezone.utc),
                brightness=320.0,
                confidence="low",
                source="firms_viirs_nrt",
                product="VIIRS_SNPP_NRT",
                retrieved_at=now,
                quality_rank=20,
                license="NASA FIRMS",
            ),
        ]
        merged = merge_fires_union_dedupe([sp, nrt], distance_km=1.0, time_hours=12.0)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0].source, "firms_viirs_sp")

    def test_weather_fills_missing_days(self) -> None:
        from termalwave.merge import merge_weather_first_available
        from termalwave.model import DailyWeather

        now = datetime(2024, 6, 15, tzinfo=timezone.utc)
        primary = [
            DailyWeather(
                day=date(2024, 6, 14),
                temp_max_c=28.0,
                temp_min_c=14.0,
                precip_mm=0.0,
                source="open_meteo_archive",
                product="open-meteo-archive",
                retrieved_at=now,
                quality_rank=10,
                license="Open-Meteo",
            ),
            DailyWeather(
                day=date(2024, 6, 15),
                temp_max_c=29.0,
                temp_min_c=15.0,
                precip_mm=None,
                source="open_meteo_archive",
                product="open-meteo-archive",
                retrieved_at=now,
                quality_rank=10,
                license="Open-Meteo",
            ),
        ]
        secondary = [
            DailyWeather(
                day=date(2024, 6, 15),
                temp_max_c=30.0,
                temp_min_c=16.0,
                precip_mm=1.0,
                source="meteomatics",
                product="meteomatics",
                retrieved_at=now,
                quality_rank=20,
                license="Meteomatics",
            ),
            DailyWeather(
                day=date(2024, 6, 16),
                temp_max_c=27.0,
                temp_min_c=14.0,
                precip_mm=0.2,
                source="meteomatics",
                product="meteomatics",
                retrieved_at=now,
                quality_rank=20,
                license="Meteomatics",
            ),
        ]
        merged = merge_weather_first_available([primary, secondary])
        by_day = {row.day.isoformat(): row for row in merged}
        self.assertIn("2024-06-14", by_day)
        self.assertIn("2024-06-16", by_day)
        self.assertTrue(by_day["2024-06-15"].filled)
        self.assertEqual(by_day["2024-06-15"].precip_mm, 1.0)
        self.assertEqual(by_day["2024-06-16"].source, "meteomatics")

    def test_offline_ingest_and_cache_fallback(self) -> None:
        from termalwave.process.config import load_config
        from termalwave.process.ingest import run_ingest
        from termalwave.providers.cache import kind_cache_path, write_cache
        from termalwave.providers.registry import load_apis_config
        from termalwave.runtime_config import default_site_config

        cfg = load_config(default_site_config(), REPO)
        result = run_ingest(cfg, repo_root=REPO, offline=True)
        self.assertEqual(result["provenance"]["layers"]["fires"]["status"], "ok")
        self.assertGreater(result["provenance"]["layers"]["fires"]["count"], 0)
        self.assertEqual(result["provenance"]["layers"]["radar"]["status"], "ok")

        # Simulate all providers down → cache.
        apis = load_apis_config(REPO)
        write_cache(
            REPO,
            apis,
            "weather",
            {
                "records": [{"day": "2024-01-01", "source": "cached"}],
                "selected_sources": ["cached"],
            },
        )
        # Point order to a fake provider name so registry builds nothing.
        apis["weather"]["order"] = ["does_not_exist"]
        from termalwave.process import ingest as ingest_mod

        aoi = ingest_mod._aoi_from_cfg(cfg)
        period = ingest_mod._period_from_cfg(cfg)
        payload = ingest_mod._run_kind(
            "weather",
            apis=apis,
            aoi=aoi,
            period=period,
            credentials={},
            offline=True,
            fixtures_dir=REPO / "tests" / "fixtures" / "providers",
            repo_root=REPO,
        )
        self.assertEqual(payload["status"], "cache")
        self.assertTrue(payload["from_cache"])
        self.assertTrue(kind_cache_path(REPO, apis, "weather").is_file())

    def test_registry_order_from_config_only(self) -> None:
        from termalwave.providers.registry import load_apis_config, providers_for_kind

        apis = load_apis_config(REPO)
        fixtures = REPO / "tests" / "fixtures" / "providers"
        providers = providers_for_kind(
            "fires",
            apis,
            credentials={},
            offline=True,
            fixtures_dir=fixtures,
        )
        names = [p.name for p in providers]
        self.assertEqual(names, apis["fires"]["order"])


class PipelineProvenanceSmoke(unittest.TestCase):
    def test_offline_pipeline_writes_provenance(self) -> None:
        if str(REPO) not in sys.path:
            sys.path.insert(0, str(REPO))
        from termalwave._bootstrap import ensure_vendored
        from termalwave.process.config import load_config
        from termalwave.process.pipeline import run_pipeline
        from termalwave.runtime_config import default_site_config

        ensure_vendored(verify=False)
        cfg = load_config(default_site_config(), REPO)
        run_pipeline(config_path=default_site_config(), offline=True, repo_root=REPO)
        web_cfg = Path(cfg["paths"]["web_config_out"])
        app = json.loads(web_cfg.read_text(encoding="utf-8"))
        self.assertIn("provenance", app)
        self.assertIn("fires", app["provenance"]["layers"])
        stats = Path(REPO / "data" / "processed" / "stats.json")
        self.assertTrue(stats.is_file())


if __name__ == "__main__":
    unittest.main()
