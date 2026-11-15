"""Unit tests for audited F01–F15 / F16–F17 helpers in termalwave.science."""

from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from termalwave._bootstrap import ensure_vendored  # noqa: E402

ensure_vendored(verify=True)

import numpy as np  # noqa: E402

from termalwave.science.air import cams_pm25_ug_m3  # noqa: E402
from termalwave.science.carbon import carbon_stock_mg_per_ha, chave_agb_kg  # noqa: E402
from termalwave.science.cover import softmax_row, temporal_cv_linear_power  # noqa: E402
from termalwave.science.deform import gunw_delta_range_m, gunw_los_displacement_m  # noqa: E402
from termalwave.science.drought import et0_hargreaves_samani, spi_from_gamma, thom_gamma_mle  # noqa: E402
from termalwave.science.erosion import rusle_soil_loss_t_ha_yr  # noqa: E402
from termalwave.science.fire import fre_to_dry_biomass_burned_kg, integrate_fre  # noqa: E402
from termalwave.science.indices import (  # noqa: E402
    dnbr,
    dnbr_scaled_for_key_benson,
    mndwi,
    ndmi,
)
from termalwave.science.phenology import gdd_daily_simple  # noqa: E402
from termalwave.science.radar import delta_b_db, mean_power_linear  # noqa: E402
from termalwave.science.salinity import duan_smearing_ece  # noqa: E402
from termalwave.science.soil import relative_wetness_wt, topp_permittivity, wetness_ratio_unclipped  # noqa: E402
from termalwave.science.surface_temp import landsat_c2_st_kelvin  # noqa: E402
from termalwave.science.turbidity import dogliotti_switching_turbidity, nechad_turbidity_fnu  # noqa: E402
from termalwave.science.vegetation import rvi_dual  # noqa: E402
from termalwave.science.water_balance import fao_p_depletion_fraction, ks_water_stress  # noqa: E402


class ScienceFormulaTests(unittest.TestCase):
    def test_delta_b_from_linear_means_not_db_difference(self) -> None:
        before = np.array([0.01, 0.04])
        after = np.array([0.02, 0.01])
        g1 = mean_power_linear(before)
        g2 = mean_power_linear(after)
        expected = delta_b_db(g2, g1)
        mean_db_before = float(np.mean(10.0 * np.log10(before)))
        mean_db_after = float(np.mean(10.0 * np.log10(after)))
        self.assertNotAlmostEqual(mean_db_after - mean_db_before, expected, places=3)

    def test_weighted_mean_ignores_invalid(self) -> None:
        gamma = np.array([1.0, 2.0, np.nan, 0.0])
        self.assertAlmostEqual(mean_power_linear(gamma), 1.5)

    def test_rvi_dual_exceeds_one_when_hv_dominates(self) -> None:
        hh = np.array([0.1])
        hv = np.array([0.5])
        val = float(rvi_dual(hh, hv)[0])
        self.assertGreater(val, 1.0)
        self.assertAlmostEqual(val, 4.0 * 0.5 / 0.6)

    def test_mndwi_is_water_not_soil_proxy(self) -> None:
        # open water: green > swir in reflectance space (F06), unlike canopy NDMI
        green = np.array([0.12])
        swir = np.array([0.04])
        self.assertGreater(float(mndwi(green, swir)[0]), 0.0)
        self.assertLess(float(ndmi(np.array([0.4]), np.array([0.45]))[0]), 0.0)

    def test_dnbr_key_benson_scale(self) -> None:
        d = dnbr(np.array([0.5]), np.array([0.1]), np.array([0.3]), np.array([0.35]))
        scaled = dnbr_scaled_for_key_benson(d)
        self.assertAlmostEqual(float(scaled[0]), float(d[0]) * 1000.0)

    def test_wt_clipped_and_theta_map(self) -> None:
        w, theta = relative_wetness_wt(-14.0, -20.0, -8.0, theta_min=0.05, theta_max=0.35)
        self.assertAlmostEqual(w, 0.5)
        self.assertAlmostEqual(theta or 0.0, 0.2)

    def test_cams_units(self) -> None:
        self.assertAlmostEqual(cams_pm25_ug_m3(3.5e-9), 3.5)

    def test_gunw_sign_convention(self) -> None:
        phi = 1.0
        dr = gunw_delta_range_m(phi)
        d_los = gunw_los_displacement_m(phi)
        self.assertGreater(dr, 0.0)
        self.assertLess(d_los, 0.0)
        self.assertAlmostEqual(dr, -d_los)

    def test_fre_trapezoid_and_biomass(self) -> None:
        fre = integrate_fre([10.0, 20.0, 30.0], [0.0, 60.0, 60.0])
        self.assertAlmostEqual(fre, (15.0 + 25.0) * 60.0)
        bio = fre_to_dry_biomass_burned_kg(100.0)
        self.assertAlmostEqual(bio, 36.8)

    def test_topp_grows_with_theta(self) -> None:
        self.assertLess(topp_permittivity(0.1), topp_permittivity(0.3))

    def test_wetness_unclipped_can_exceed_one(self) -> None:
        w = wetness_ratio_unclipped(-5.0, -20.0, -8.0)
        self.assertGreater(w, 1.0)

    def test_thom_and_spi_finite(self) -> None:
        data = np.array([10.0, 20.0, 15.0, 12.0, 18.0])
        alpha, beta = thom_gamma_mle(data)
        self.assertTrue(alpha > 0 and beta > 0)
        spi = spi_from_gamma(14.0, alpha=alpha, beta=beta, q_zero=0.0)
        self.assertTrue(np.isfinite(spi))

    def test_hargreaves_positive(self) -> None:
        et0 = et0_hargreaves_samani(22.0, 30.0, 14.0, 25.0)
        self.assertGreater(et0, 0.0)

    def test_fao_ks_tranches(self) -> None:
        taw, raw, p = 100.0, 50.0, 0.5
        self.assertAlmostEqual(ks_water_stress(30.0, taw, raw, p), 1.0)
        mid = ks_water_stress(75.0, taw, raw, p)
        self.assertAlmostEqual(mid, 0.5)
        self.assertAlmostEqual(ks_water_stress(110.0, taw, raw, p), 0.0)

    def test_p_fao_clipped(self) -> None:
        self.assertAlmostEqual(fao_p_depletion_fraction(0.5, 8.0), 0.38)
        self.assertAlmostEqual(fao_p_depletion_fraction(0.1, 0.0), 0.3)

    def test_cover_cv_and_softmax(self) -> None:
        cv = temporal_cv_linear_power(np.array([0.01, 0.012, 0.009, 0.011]))
        self.assertGreater(cv, 0.0)
        s = softmax_row(np.array([1.0, 2.0, 0.0]))
        self.assertAlmostEqual(float(np.sum(s)), 1.0)

    def test_chave_and_carbon(self) -> None:
        agb = chave_agb_kg(0.6, 40.0, 8.0)
        self.assertGreater(agb, 0.0)
        self.assertAlmostEqual(carbon_stock_mg_per_ha(50.0), 23.5)

    def test_rusle_product(self) -> None:
        self.assertAlmostEqual(rusle_soil_loss_t_ha_yr(100.0, 0.03, 1.0, 0.2, 0.8), 0.48)

    def test_duan_smearing_identity_residuals(self) -> None:
        ece = duan_smearing_ece(2.0, 0.1, np.array([0.0, 0.0]))
        self.assertAlmostEqual(ece, 2.0 * math.exp(0.1))

    def test_landsat_st_dn_zero_nan(self) -> None:
        self.assertTrue(np.isnan(landsat_c2_st_kelvin(0.0)))
        self.assertGreater(landsat_c2_st_kelvin(10000.0), 170.0)

    def test_turbidity_switch(self) -> None:
        t_clear = nechad_turbidity_fnu(0.03, 228.1, 0.1641)
        self.assertGreater(t_clear, 0.0)
        t = dogliotti_switching_turbidity(0.04, 0.02, a_red=228.1, c_red=0.1641, a_nir=3078.9, c_nir=0.2112)
        self.assertGreater(t, 0.0)

    def test_gdd_nonnegative(self) -> None:
        self.assertAlmostEqual(gdd_daily_simple(20.0, 10.0, 10.0), 5.0)
        self.assertAlmostEqual(gdd_daily_simple(8.0, 5.0, 10.0), 0.0)


if __name__ == "__main__":
    unittest.main()