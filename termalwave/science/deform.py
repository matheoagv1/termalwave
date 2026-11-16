"""F17 NISAR GUNW line-of-sight deformation sign convention."""

from __future__ import annotations

import numpy as np

from termalwave.science.constants import NISAR_L_WAVELENGTH_M


def gunw_delta_range_m(delta_phi_rad: float, *, wavelength_m: float = NISAR_L_WAVELENGTH_M) -> float:
    """Positive ΔR = increasing satellite–ground range (retreat), native GUNW (F17)."""
    if not np.isfinite(delta_phi_rad):
        return float("nan")
    return float(wavelength_m * delta_phi_rad / (4.0 * np.pi))


def gunw_los_displacement_m(delta_phi_rad: float, *, wavelength_m: float = NISAR_L_WAVELENGTH_M) -> float:
    """Positive d_LOS = motion toward the satellite (opposite sign to ΔR)."""
    dr = gunw_delta_range_m(delta_phi_rad, wavelength_m=wavelength_m)
    if not np.isfinite(dr):
        return float("nan")
    return -dr


def vertical_from_los_m(d_los_m: float, incidence_rad: float) -> float:
    """d_v ≈ d_LOS / cos(θ_inc); only when horizontal motion is negligible (F17)."""
    if not np.isfinite(d_los_m) or not np.isfinite(incidence_rad):
        return float("nan")
    cos_i = float(np.cos(incidence_rad))
    if cos_i <= 0:
        return float("nan")
    return float(d_los_m / cos_i)