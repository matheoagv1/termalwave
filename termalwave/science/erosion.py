"""F12 RUSLE soil loss and SOC stock stubs."""

from __future__ import annotations

import numpy as np


def rusle_soil_loss_t_ha_yr(
    r_factor: float,
    k_factor: float,
    ls_factor: float,
    c_factor: float,
    p_factor: float,
) -> float:
    """A = R · K · L · S · C · P (t ha⁻¹ yr⁻¹); LS often folded into one factor."""
    if not all(np.isfinite([r_factor, k_factor, ls_factor, c_factor, p_factor])):
        return float("nan")
    if any(v < 0 for v in (r_factor, k_factor, ls_factor, c_factor, p_factor)):
        return float("nan")
    return r_factor * k_factor * ls_factor * c_factor * p_factor


def rainfall_erosivity_interval_mj_mm_ha(
    rainfall_mm: float,
    i30_mm_h: float,
    *,
    coef: float = 0.29,
    intensity_exp: float = -0.05,
) -> float:
    """Single-storm (E·I30) contribution toward R (RUSLE); sub-hourly i required."""
    if not np.isfinite(rainfall_mm) or not np.isfinite(i30_mm_h):
        return float("nan")
    if rainfall_mm <= 0 or i30_mm_h <= 0:
        return 0.0
    er = coef * (1.0 - 0.72 * np.exp(intensity_exp * i30_mm_h))
    return float(er * i30_mm_h * rainfall_mm)


def soc_stock_mg_c_per_ha(
    carbon_g_per_kg: float,
    bulk_density_mg_m3: float,
    depth_m: float,
    gravel_fraction: float,
) -> float:
    """SOC = 10 · c · ρ_b · d · (1 − f_g) with c in g/kg (Mg C/ha)."""
    if not all(np.isfinite([carbon_g_per_kg, bulk_density_mg_m3, depth_m, gravel_fraction])):
        return float("nan")
    if depth_m <= 0 or bulk_density_mg_m3 <= 0:
        return float("nan")
    fg = float(np.clip(gravel_fraction, 0.0, 1.0))
    return 10.0 * carbon_g_per_kg * bulk_density_mg_m3 * depth_m * (1.0 - fg)