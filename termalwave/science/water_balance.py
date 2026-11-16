"""F05 FAO-56 root-zone soil water balance helpers (K_s, RAW, TAW)."""

from __future__ import annotations

import numpy as np

_P_FAO_MIN = 0.1
_P_FAO_MAX = 0.8


def total_available_water_mm(theta_fc: float, theta_wp: float, root_depth_m: float) -> float:
    """TAW = 1000(θ_FC − θ_WP) Z_r (mm)."""
    if not all(np.isfinite([theta_fc, theta_wp, root_depth_m])):
        return float("nan")
    if root_depth_m <= 0 or theta_fc <= theta_wp:
        return float("nan")
    return 1000.0 * (theta_fc - theta_wp) * root_depth_m


def raw_mm(p_fao: float, taw_mm: float) -> float:
    """Readily available water RAW = p·TAW."""
    if not np.isfinite(p_fao) or not np.isfinite(taw_mm) or taw_mm <= 0:
        return float("nan")
    return p_fao * taw_mm


def fao_p_depletion_fraction(p_table: float, et_c_mm_day: float) -> float:
    """p_FAO = p_tabla + 0.04·(5 − ET_c), clipped to [0.1, 0.8] (FAO-56 ch. 8)."""
    if not np.isfinite(p_table) or not np.isfinite(et_c_mm_day):
        return float("nan")
    p = p_table + 0.04 * (5.0 - et_c_mm_day)
    return float(np.clip(p, _P_FAO_MIN, _P_FAO_MAX))


def ks_water_stress(
    dr_mm: float,
    taw_mm: float,
    raw_mm: float,
    p_fao: float,
) -> float:
    """Soil water depletion coefficient K_s (three tranches; 0 when D_r > TAW)."""
    if not all(np.isfinite([dr_mm, taw_mm, raw_mm, p_fao])) or taw_mm <= 0:
        return float("nan")
    if dr_mm <= raw_mm:
        return 1.0
    if dr_mm > taw_mm:
        return 0.0
    denom = (1.0 - p_fao) * taw_mm
    if denom <= 0:
        return float("nan")
    return (taw_mm - dr_mm) / denom


def clip_root_zone_depletion(dr_mm: float, taw_mm: float) -> float:
    """FAO-56 eq. 86: 0 ≤ D_r ≤ TAW."""
    if not np.isfinite(dr_mm) or not np.isfinite(taw_mm) or taw_mm < 0:
        return float("nan")
    return float(np.clip(dr_mm, 0.0, taw_mm))


def crop_evapotranspiration_mm_day(k_s: float, k_cb: float, k_e: float, et0_mm_day: float) -> float:
    """ET_c = (K_s K_cb + K_e) ET₀."""
    if not all(np.isfinite([k_s, k_cb, k_e, et0_mm_day])):
        return float("nan")
    return (k_s * k_cb + k_e) * et0_mm_day


def root_zone_balance_step(
    dr_prev_mm: float,
    *,
    precip_mm: float,
    runoff_mm: float,
    irrigation_mm: float,
    capillary_rise_mm: float,
    et_c_mm: float,
    deep_percolation_mm: float,
    taw_mm: float,
) -> float:
    """D_{r,t} = D_{r,t−1} − (P−RO) − I − CR + ET_c + DP; then clip to TAW."""
    if not np.isfinite(dr_prev_mm):
        return float("nan")
    dr = dr_prev_mm - (precip_mm - runoff_mm) - irrigation_mm - capillary_rise_mm + et_c_mm + deep_percolation_mm
    return clip_root_zone_depletion(dr, taw_mm)