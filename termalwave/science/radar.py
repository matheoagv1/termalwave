"""F01 radar radiometry: linear power, dB, areal means, change (ΔB)."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np


def sample_to_power(raw: np.ndarray, dataset_name: str, power_names: Sequence[str]) -> np.ndarray:
    """Linear radar power from HDF5 sample (complex → |z|²; GCOV diagonals already power)."""
    data = np.asarray(raw)
    if np.iscomplexobj(data):
        return np.abs(data).astype(np.float64) ** 2
    data = data.astype(np.float64)
    leaf = dataset_name.rsplit("/", 1)[-1].lower()
    if leaf in {n.lower() for n in power_names}:
        return data
    return data**2


def power_to_db(power: np.ndarray) -> np.ndarray:
    """10·log10(linear power); non-finite and non-positive samples → NaN."""
    out = np.full(power.shape, np.nan, dtype=np.float64)
    valid = np.isfinite(power) & (power > 0)
    out[valid] = 10.0 * np.log10(power[valid])
    return out


def db_to_power(db: np.ndarray) -> np.ndarray:
    """Inverse of power_to_db; NaN in → NaN out."""
    out = np.full(db.shape, np.nan, dtype=np.float64)
    valid = np.isfinite(db)
    out[valid] = 10.0 ** (db[valid] / 10.0)
    return out


def mean_power_linear(
    gamma: np.ndarray,
    *,
    weights: np.ndarray | None = None,
    mask: np.ndarray | None = None,
) -> float:
    """Areal mean of γ⁰ in linear power (G1/F01), ignoring invalid samples."""
    g = np.asarray(gamma, dtype=np.float64)
    valid = np.isfinite(g) & (g > 0)
    if mask is not None:
        valid &= np.asarray(mask, dtype=bool)
    if not np.any(valid):
        return float("nan")
    if weights is None:
        return float(np.mean(g[valid]))
    w = np.asarray(weights, dtype=np.float64)
    w = np.where(valid, w, 0.0)
    total = w.sum()
    if total <= 0:
        return float("nan")
    return float(np.sum(g[valid] * w[valid]) / total)


def delta_b_db(gamma_after: float, gamma_before: float) -> float:
    """ΔB in dB from linear γ⁰ means (not difference of means in dB)."""
    if (
        not np.isfinite(gamma_after)
        or not np.isfinite(gamma_before)
        or gamma_after <= 0
        or gamma_before <= 0
    ):
        return float("nan")
    return float(10.0 * np.log10(gamma_after / gamma_before))


def common_valid_mask(*arrays: np.ndarray) -> np.ndarray:
    """Intersection mask for multi-date means (F01): finite and >0 in every array."""
    if not arrays:
        raise ValueError("common_valid_mask needs at least one array")
    out = np.ones(np.asarray(arrays[0]).shape, dtype=bool)
    for a in arrays:
        g = np.asarray(a, dtype=np.float64)
        if g.shape != out.shape:
            raise ValueError("common_valid_mask: shape mismatch")
        out &= np.isfinite(g) & (g > 0)
    return out


def gamma_to_sigma(gamma: np.ndarray, rtc_factor: np.ndarray) -> np.ndarray:
    """σ⁰ = γ⁰ · rtcGammaToSigmaFactor per pixel (F04); shapes must broadcast."""
    g = np.asarray(gamma, dtype=np.float64)
    f = np.asarray(rtc_factor, dtype=np.float64)
    out = g * f
    bad = ~np.isfinite(g) | ~np.isfinite(f) | (g <= 0) | (f <= 0)
    out = np.where(bad, np.nan, out)
    return out


def cross_pol_ratio_linear(gamma_hh: np.ndarray, gamma_hv: np.ndarray) -> np.ndarray:
    """γ⁰_HV / γ⁰_HH in linear domain (F03/F06)."""
    hh = np.asarray(gamma_hh, dtype=np.float64)
    hv = np.asarray(gamma_hv, dtype=np.float64)
    out = hv / hh
    bad = ~np.isfinite(hh) | ~np.isfinite(hv) | (hh <= 0)
    return np.where(bad, np.nan, out)