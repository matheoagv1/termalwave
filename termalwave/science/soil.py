"""F04 soil moisture helpers: WCM in linear domain and relative W_t."""

from __future__ import annotations

import numpy as np


def wcm_observed_linear(
    v1: float,
    v2: float,
    incidence_rad: float,
    *,
    a: float,
    b: float,
    sigma_soil_linear: float,
) -> float:
    """Water cloud model σ⁰_obs in linear power (vegetation + soil terms)."""
    cos_i = float(np.cos(incidence_rad))
    if cos_i <= 0:
        return float("nan")
    tau2 = float(np.exp(-2.0 * b * v2 / cos_i))
    veg = a * v1 * cos_i * (1.0 - tau2)
    soil = tau2 * sigma_soil_linear
    return veg + soil


def sigma_soil_db_from_moisture(theta: float, c_db: float, d_db_per_theta: float) -> float:
    """Empirical σ⁰_soil in dB; invert with WCM only after converting back to linear."""
    return c_db + d_db_per_theta * theta


def relative_wetness_wt(
    b_t_db: float,
    b_dry_db: float,
    b_wet_db: float,
    *,
    theta_min: float | None = None,
    theta_max: float | None = None,
) -> tuple[float, float | None]:
    """Wagner-style relative index clipped to [0, 1] (F04); optional θ via endpoints."""
    span = b_wet_db - b_dry_db
    if not np.isfinite(span) or span <= 0:
        return float("nan"), None
    w = (b_t_db - b_dry_db) / span
    w = float(np.clip(w, 0.0, 1.0))
    theta_hat: float | None = None
    if theta_min is not None and theta_max is not None:
        theta_hat = theta_min + w * (theta_max - theta_min)
    return w, theta_hat


def alpha_moisture_ratio(sigma_t2: float, sigma_t1: float) -> float:
    """Temporal ratio σ⁰(t2)/σ⁰(t1) for alpha approximation (F04); linear power."""
    if not np.isfinite(sigma_t2) or not np.isfinite(sigma_t1) or sigma_t1 <= 0:
        return float("nan")
    return sigma_t2 / sigma_t1


def topp_permittivity(theta: float) -> float:
    """Topp et al. (1980) ε(θ); θ in m³/m³ (not a radar index)."""
    t = float(theta)
    return 3.03 + 9.3 * t + 146.0 * t**2 - 76.7 * t**3