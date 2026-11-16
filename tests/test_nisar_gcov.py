"""NISAR CMR short_name: validated GCOV, then provisional, then beta."""

from __future__ import annotations

import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave.merge import prefer_validated_granules  # noqa: E402
from termalwave.model import AOI, GranuleRef, Period  # noqa: E402
from termalwave.providers.radar.earthdata_nisar_gcov import (  # noqa: E402
    EarthdataNisarGcov,
    _collection_names,
    _temporal,
    maturity_for,
)
from termalwave.providers.registry import load_apis_config  # noqa: E402


def _provider(offline: bool) -> EarthdataNisarGcov:
    apis = load_apis_config(REPO)
    radar = apis["radar"]
    meta = apis["providers"]["earthdata_nisar_gcov"]
    return EarthdataNisarGcov(
        meta=meta,
        kind_cfg=radar,
        credentials={},
        offline=offline,
        fixtures_dir=REPO / "tests" / "fixtures" / "providers",
        endpoints=radar.get("endpoints") or {},
        cache=None,  # type: ignore[arg-type]
    )


def _ref(granule_id: str, status: str, day: int, rank: int) -> GranuleRef:
    return GranuleRef(
        granule_id=granule_id,
        acquired_at=datetime(2026, 10, day, 22, 0, tzinfo=timezone.utc),
        status=status,
        href="",
        source="earthdata_nisar_gcov",
        product="NISAR_L2_GCOV_V1",
        retrieved_at=datetime(2026, 11, 15, tzinfo=timezone.utc),
        quality_rank=rank,
        license="NASA Earthdata",
    )


class NisarShortNameTests(unittest.TestCase):
    def test_maturity_follows_collection(self) -> None:
        self.assertEqual(maturity_for("NISAR_L2_GCOV_V1"), "validated")
        self.assertEqual(maturity_for("NISAR_L2_GCOV_PROVISIONAL_V1"), "provisional")
        self.assertEqual(maturity_for("NISAR_L2_GCOV_BETA_V1"), "beta")
        self.assertEqual(maturity_for("NISAR_L2_GUNW_V1"), "validated")
        self.assertEqual(maturity_for("NISAR_L3_SME2_PROVISIONAL_V1"), "provisional")

    def test_dead_short_name_is_dropped(self) -> None:
        names = _collection_names(
            {"gcov_collections": ["NISAR_L2_GCOV", "NISAR_L2_GCOV_V1"]}
        )
        self.assertNotIn("NISAR_L2_GCOV", names)
        self.assertEqual(names[0], "NISAR_L2_GCOV_V1")

    def test_temporal_starts_when_nisar_measures(self) -> None:
        window = _temporal({}, Period(date(2018, 1, 1), date(2026, 12, 31)))
        self.assertTrue(window.startswith("2025-07-30T00:00:00Z,"), msg=window)

    def test_frames_on_the_same_day_all_stay(self) -> None:
        rows = [
            _ref("frame-101", "validated", 21, 10),
            _ref("frame-102", "validated", 21, 10),
            _ref("frame-101", "provisional", 21, 20),
        ]
        kept = prefer_validated_granules(rows)
        self.assertEqual(sorted(g.granule_id for g in kept), ["frame-101", "frame-102"])
        chosen = next(g for g in kept if g.granule_id == "frame-101")
        self.assertEqual(chosen.status, "validated")

    def test_offline_fixture_still_parses(self) -> None:
        rows = _provider(True).fetch(
            AOI(west=-64.35, east=-64.15, south=-27.9, north=-27.7, name="sgo"),
            Period(date(2018, 1, 1), date(2026, 12, 31)),
        )
        self.assertGreaterEqual(len(rows), 2)
        self.assertIn("validated", {row.status for row in rows})

    def test_live_regional_santiago_has_validated_gcov(self) -> None:
        rows = _provider(False).fetch(
            AOI(west=-65.5, east=-62.0, south=-29.0, north=-26.0, name="sgo-region"),
            Period(date(2018, 1, 1), date(2026, 12, 31)),
        )
        validated = [
            row
            for row in rows
            if row.product == "NISAR_L2_GCOV_V1" and row.status == "validated"
        ]
        gunw = [row for row in rows if row.product == "NISAR_L2_GUNW_V1"]
        sme2 = [row for row in rows if row.product == "NISAR_L3_SME2_PROVISIONAL_V1"]
        self.assertGreaterEqual(len(validated), 18, msg=f"validated={len(validated)}")
        self.assertGreaterEqual(len(gunw), 1, msg=f"gunw={len(gunw)}")
        self.assertGreaterEqual(len(sme2), 1, msg=f"sme2={len(sme2)}")
        self.assertTrue(all(row.href.startswith("https://") and ".h5" in row.href for row in validated))
        merged = prefer_validated_granules(rows)
        self.assertGreaterEqual(len(merged), 18)


if __name__ == "__main__":
    unittest.main()
