"""F03 radar vegetation indices; dual RVI is not bounded to [0, 1]."""

from __future__ import annotations

import numpy as np


def rvi_quadpol(sigma_hh: np.ndarray, sigma_vv: np.ndarray, sigma_hv: np.ndarray) -> np.ndarray:
    """Kim & van Zyl quad-polar RVI; inputs are linear σ⁰."""
    hh = np.asarray(sigma_hh, dtype=np.float64)
    vv = np.asarray(sigma_vv, dtype=np.float64)
    hv = np.asarray(sigma_hv, dtype=np.float64)
    denom = hh + vv + 2.0 * hv
    with np.errstate(divide="ignore", invalid="ignore"):
        out = 8.0 * hv / denom
    bad = ~np.isfinite(denom) | (denom <= 0)
    return np.where(bad, np.nan, out)


def rvi_dual(gamma_hh: np.ndarray, gamma_hv: np.ndarray) -> np.ndarray:
    """Dual-pol HH/HV variant (σ⁰_VV ≈ σ⁰_HH). Range is (0, 4), not [0, 1]."""
    hh = np.asarray(gamma_hh, dtype=np.float64)
    hv = np.asarray(gamma_hv, dtype=np.float64)
    denom = hh + hv
    with np.errstate(divide="ignore", invalid="ignore"):
        out = 4.0 * hv / denom
    bad = ~np.isfinite(denom) | (denom <= 0)
    return np.where(bad, np.nan, out)