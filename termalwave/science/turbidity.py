"""F15 optical turbidity (Nechad / Dogliotti switching); NDVI mask only."""

from __future__ import annotations

import numpy as np

from termalwave.science.indices import ndvi


def nechad_turbidity_fnu(rho_w: float, a_t: float, c_t: float) -> float:
    """T = A_T · ρ_w / (1 − ρ_w/C_T); ρ_w = π R_rs."""
    if not np.isfinite(rho_w) or not np.isfinite(a_t) or not np.isfinite(c_t):
        return float("nan")
    if c_t <= 0 or rho_w <= 0:
        return float("nan")
    denom = 1.0 - rho_w / c_t
    if denom <= 0:
        return float("nan")
    return a_t * rho_w / denom


def dogliotti_switching_turbidity(
    rho_red: float,
    rho_nir: float,
    *,
    a_red: float,
    c_red: float,
    a_nir: float,
    c_nir: float,
    red_clear_threshold: float = 0.05,
    red_turbid_threshold: float = 0.07,
) -> float:
    """Dogliotti et al. (2015) band switch between red and NIR turbidity."""
    if not all(np.isfinite([rho_red, rho_nir])):
        return float("nan")
    t_red = nechad_turbidity_fnu(rho_red, a_red, c_red)
    t_nir = nechad_turbidity_fnu(rho_nir, a_nir, c_nir)
    if rho_red < red_clear_threshold:
        return t_red
    if rho_red > red_turbid_threshold:
        return t_nir
    w = (rho_red - red_clear_threshold) / (red_turbid_threshold - red_clear_threshold)
    w = float(np.clip(w, 0.0, 1.0))
    if not np.isfinite(t_red) or not np.isfinite(t_nir):
        return float("nan")
    return (1.0 - w) * t_red + w * t_nir


def floating_vegetation_exclusion_mask(nir: np.ndarray, red: np.ndarray, threshold: float) -> np.ndarray:
    """Exclude water pixels where NDVI > T_veg (macrófitas/orilla); not a turbidity index."""
    v = ndvi(nir, red)
    return np.isfinite(v) & (v > threshold)