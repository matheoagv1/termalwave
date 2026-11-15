"""F13 salinity log-linear model retransformation (Duan smearing)."""

from __future__ import annotations

import math

import numpy as np


def duan_smearing_ece(ec_ref: float, eta_hat: float, residual_hat: np.ndarray) -> float:
    """ECe = EC_ref · exp(η̂) · (1/n) Σ exp(ε̂_i) (Duan 1983)."""
    if not np.isfinite(ec_ref) or ec_ref <= 0 or not np.isfinite(eta_hat):
        return float("nan")
    res = np.asarray(residual_hat, dtype=np.float64)
    if res.size == 0 or np.any(~np.isfinite(res)):
        return float("nan")
    smear = float(np.mean(np.exp(res)))
    return ec_ref * math.exp(eta_hat) * smear


def lognormal_bias_corrected_ece(ec_ref: float, eta_hat: float, sigma2: float) -> float:
    """Normal-error shortcut: EC_ref · exp(η̂ + σ²/2)."""
    if not np.isfinite(ec_ref) or ec_ref <= 0 or not np.isfinite(eta_hat) or not np.isfinite(sigma2):
        return float("nan")
    return ec_ref * math.exp(eta_hat + 0.5 * sigma2)