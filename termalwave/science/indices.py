"""Optical normalized indices (F03, F06, F08); radiance → reflectance first."""

from __future__ import annotations

import numpy as np

MNDWI_PURPOSE = "open_water_optical"
SOIL_MOISTURE_PURPOSE = "soil_volumetric_or_Wt"


def normalized_difference(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """(A − B) / (A + B); NaN where denominator is zero."""
    a = np.asarray(nir, dtype=np.float64)
    b = np.asarray(red, dtype=np.float64)
    denom = a + b
    with np.errstate(divide="ignore", invalid="ignore"):
        out = (a - b) / denom
    out = np.where(np.isfinite(denom) & (denom != 0), out, np.nan)
    return out


def ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """F03 vegetation greenness."""
    return normalized_difference(nir, red)


def ndmi(nir: np.ndarray, swir1: np.ndarray) -> np.ndarray:
    """F03 canopy water stress proxy (not soil moisture)."""
    return normalized_difference(nir, swir1)


def mndwi(green: np.ndarray, swir1: np.ndarray) -> np.ndarray:
    """F06 open-surface water (Xu 2006). Not soil moisture and not a radar metric."""
    return normalized_difference(green, swir1)


def sentinel2_reflectance(
    dn: np.ndarray,
    *,
    offset: float = -1000.0,
    quantification: float = 10_000.0,
) -> np.ndarray:
    """Sentinel-2 L2A BOA reflectance (baseline ≥ 04.00). DN=0 → NaN."""
    d = np.asarray(dn, dtype=np.float64)
    out = (d + offset) / quantification
    out = np.where(d == 0, np.nan, out)
    return out


def landsat_c2_sr_reflectance(dn: np.ndarray) -> np.ndarray:
    """Landsat Collection 2 L2 surface reflectance."""
    return 2.75e-5 * np.asarray(dn, dtype=np.float64) - 0.2


def nbr(nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
    """Normalized burn ratio (F08)."""
    return normalized_difference(nir, swir2)


def dnbr(nir_pre: np.ndarray, swir2_pre: np.ndarray, nir_post: np.ndarray, swir2_post: np.ndarray) -> np.ndarray:
    """Post-fire minus pre-fire NBR (dimensionless, typically small magnitude)."""
    return nbr(nir_post, swir2_post) - nbr(nir_pre, swir2_pre)


def dnbr_scaled_for_key_benson(dnbr_val: np.ndarray | float) -> np.ndarray | float:
    """Key/Benson severity tables use dNBR × 1000 (F08)."""
    scale = 1000.0
    if np.isscalar(dnbr_val):
        return float(dnbr_val) * scale
    return np.asarray(dnbr_val, dtype=np.float64) * scale