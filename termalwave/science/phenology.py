"""F10 growing-degree-day and phenology stubs."""

from __future__ import annotations

import numpy as np


def gdd_daily_simple(t_max_c: float, t_min_c: float, t_base_c: float) -> float:
    """Simple average GDD: max(0, (Tmax+Tmin)/2 − T_b)."""
    if not all(np.isfinite([t_max_c, t_min_c, t_base_c])):
        return float("nan")
    return max(0.0, 0.5 * (t_max_c + t_min_c) - t_base_c)


def gdd_accumulated(t_max: np.ndarray, t_min: np.ndarray, t_base_c: float) -> float:
    """Sum of daily simple GDD."""
    tmax = np.asarray(t_max, dtype=np.float64)
    tmin = np.asarray(t_min, dtype=np.float64)
    if tmax.shape != tmin.shape:
        return float("nan")
    daily = [gdd_daily_simple(float(a), float(b), t_base_c) for a, b in zip(tmax, tmin, strict=True)]
    if any(not np.isfinite(v) for v in daily):
        return float("nan")
    return float(np.sum(daily))


def vegetation_index_times_mean(ndvi_daily: np.ndarray, dt_days: np.ndarray) -> float:
    """I_v = Σ NDVI·Δt (index·day) when aligned arrays are provided."""
    v = np.asarray(ndvi_daily, dtype=np.float64)
    d = np.asarray(dt_days, dtype=np.float64)
    if v.shape != d.shape or v.size == 0:
        return float("nan")
    if np.any(~np.isfinite(v)) or np.any(~np.isfinite(d)) or np.any(d < 0):
        return float("nan")
    return float(np.sum(v * d))