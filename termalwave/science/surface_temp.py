"""F14 Landsat Collection 2 surface temperature from ST_B10."""

from __future__ import annotations

import numpy as np


def landsat_c2_st_kelvin(dn: np.ndarray | float) -> np.ndarray | float:
    """T_s [K] = 0.00341802 · DN + 149.0; DN = 0 → NaN."""
    if np.isscalar(dn):
        d = float(dn)
        if d == 0.0 or not np.isfinite(d):
            return float("nan")
        return 0.00341802 * d + 149.0
    arr = np.asarray(dn, dtype=np.float64)
    out = 0.00341802 * arr + 149.0
    out = np.where((arr == 0) | ~np.isfinite(arr), np.nan, out)
    return out


def kelvin_to_celsius(t_k: np.ndarray | float) -> np.ndarray | float:
    if np.isscalar(t_k):
        v = float(t_k)
        return v - 273.15 if np.isfinite(v) else float("nan")
    arr = np.asarray(t_k, dtype=np.float64)
    return arr - 273.15


def surface_temp_anomaly_c(t_c: float, climatology_mean_c: float) -> float:
    """ΔT = T_s − μ."""
    if not np.isfinite(t_c) or not np.isfinite(climatology_mean_c):
        return float("nan")
    return t_c - climatology_mean_c