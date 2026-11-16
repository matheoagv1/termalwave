"""F09 land cover / disturbance: Olofsson area, temporal CV on γ⁰."""

from __future__ import annotations

import math

import numpy as np


def olofsson_stratified_proportion(
    wh: np.ndarray,
    n_hk: np.ndarray,
    n_h_dot: np.ndarray,
) -> float:
    """Σ_h W_h (n_hk / n_h·) for class k (F09)."""
    w = np.asarray(wh, dtype=np.float64)
    num = np.asarray(n_hk, dtype=np.float64)
    den = np.asarray(n_h_dot, dtype=np.float64)
    if w.shape != num.shape or w.shape != den.shape:
        return float("nan")
    with np.errstate(divide="ignore", invalid="ignore"):
        frac = num / den
    bad = ~np.isfinite(frac) | (den <= 0)
    frac = np.where(bad, 0.0, frac)
    return float(np.sum(w * frac))


def olofsson_proportion_se(
    wh: np.ndarray,
    n_hk: np.ndarray,
    n_h_dot: np.ndarray,
) -> float:
    """Standard error of Olofsson stratified proportion."""
    w = np.asarray(wh, dtype=np.float64)
    n_hk = np.asarray(n_hk, dtype=np.float64)
    n_h = np.asarray(n_h_dot, dtype=np.float64)
    if w.shape != n_hk.shape or w.shape != n_h.shape:
        return float("nan")
    p_h = np.where(n_h > 0, n_hk / n_h, np.nan)
    var_term = (p_h * (1.0 - p_h)) / np.maximum(n_h - 1.0, 1.0)
    with np.errstate(invalid="ignore"):
        se2 = float(np.nansum((w**2) * var_term))
    return math.sqrt(se2) if se2 >= 0 else float("nan")


def olofsson_estimated_area(total_area: float, p_hat: float) -> float:
    """Â_k = A_tot · p̂_k."""
    if not np.isfinite(total_area) or not np.isfinite(p_hat):
        return float("nan")
    return total_area * p_hat


def softmax_row(logits: np.ndarray) -> np.ndarray:
    """Stable softmax for one feature vector (F09 multinomial logit)."""
    x = np.asarray(logits, dtype=np.float64)
    if x.size == 0:
        return x
    x = x - np.max(x)
    ex = np.exp(x)
    s = ex.sum()
    if s <= 0 or not np.isfinite(s):
        return np.full_like(x, np.nan)
    return ex / s


def temporal_cv_linear_power(series: np.ndarray) -> float:
    """CV = s(γ⁰) / mean(γ⁰) on a temporal sample in linear power (F09)."""
    s = np.asarray(series, dtype=np.float64)
    s = s[np.isfinite(s) & (s > 0)]
    if s.size < 2:
        return float("nan")
    mu = float(np.mean(s))
    if mu <= 0:
        return float("nan")
    return float(np.std(s, ddof=1) / mu)