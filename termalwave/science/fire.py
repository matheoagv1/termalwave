"""F07 fire radiative energy and F08 burn severity."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from termalwave.science.constants import FRE_BIOMASS_KG_PER_MJ


def integrate_fre(frp_mw: Sequence[float], delta_t_s: Sequence[float]) -> float:
    """FRE in MJ from FRP (MW) trapezoid rule; F07."""
    if len(frp_mw) != len(delta_t_s) or len(frp_mw) < 1:
        return float("nan")
    frp = np.asarray(frp_mw, dtype=np.float64)
    dt = np.asarray(delta_t_s, dtype=np.float64)
    if np.any(~np.isfinite(frp)) or np.any(~np.isfinite(dt)) or np.any(dt < 0):
        return float("nan")
    if len(frp) == 1:
        return float(frp[0] * dt[0])
    mid = 0.5 * (frp[:-1] + frp[1:])
    return float(np.sum(mid * dt[1:]))


def fre_to_dry_biomass_burned_kg(fre_mj: float) -> float:
    """Rough FRE → dry biomass; site calibration usually required (F07)."""
    if not np.isfinite(fre_mj) or fre_mj < 0:
        return float("nan")
    return float(fre_mj * FRE_BIOMASS_KG_PER_MJ)