"""F02 meteorological drought: Thom gamma (SPI), ET₀ helpers, SPEI scaffold."""

from __future__ import annotations

import math
from statistics import NormalDist

import numpy as np

# Ra [MJ m⁻² d⁻¹] → mm/d equivalent factor (FAO-56)
_RA_MJ_TO_MM_DAY = 0.408


def thom_gamma_mle(positive_mm: np.ndarray) -> tuple[float, float]:
    """Thom (1958) α, β (scale in mm) for SPI on strictly positive accumulations."""
    x = np.asarray(positive_mm, dtype=np.float64)
    x = x[np.isfinite(x) & (x > 0)]
    n = x.size
    if n < 2:
        return float("nan"), float("nan")
    xbar = float(np.mean(x))
    log_mean = float(np.mean(np.log(x)))
    a = math.log(xbar) - log_mean
    if a <= 0:
        return float("nan"), float("nan")
    alpha = (1.0 / (4.0 * a)) * (1.0 + math.sqrt(1.0 + (4.0 * a) / 3.0))
    beta = xbar / alpha
    return alpha, beta


def _regularized_gamma_p(a: float, x: float) -> float:
    """Lower regularized incomplete gamma P(a, x); series / continued fraction."""
    if x < 0 or a <= 0:
        return float("nan")
    if x == 0.0:
        return 0.0
    if x < a + 1.0:
        ap, summ, del_ = a, 1.0 / a, 1.0 / a
        for _ in range(200):
            ap += 1.0
            del_ *= x / ap
            summ += del_
            if abs(del_) < abs(summ) * 1e-12:
                break
        return summ * math.exp(-x + a * math.log(x) - math.lgamma(a))
    b, c, d = x + 1.0 - a, 1.0 / 1e-30, x + 1.0 - a
    h = 1.0
    for i in range(200):
        an = float(i + 1)
        b += 2.0
        d = an * (a - an) * x + b * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = b + an * x / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        delta = d * c
        h = delta if i == 0 else 1.0 - delta * h
        if abs(delta - 1.0) < 1e-12:
            break
    return 1.0 - h * math.exp(-x + a * math.log(x) - math.lgamma(a))


def gamma_cdf(x: float, alpha: float, beta: float) -> float:
    """Gamma CDF with scale β (mean αβ)."""
    if not np.isfinite(x) or x <= 0 or not np.isfinite(alpha) or not np.isfinite(beta):
        return float("nan")
    if alpha <= 0 or beta <= 0:
        return float("nan")
    return _regularized_gamma_p(alpha, x / beta)


def spi_from_gamma(
    accumulation_mm: float,
    *,
    alpha: float,
    beta: float,
    q_zero: float = 0.0,
) -> float:
    """SPI = Φ⁻¹[H(x)] with H(x) = q + (1−q)G(x); q is empirical zero fraction."""
    if not np.isfinite(accumulation_mm):
        return float("nan")
    q = float(np.clip(q_zero, 0.0, 0.999))
    if accumulation_mm <= 0:
        h = q
    else:
        h = q + (1.0 - q) * gamma_cdf(accumulation_mm, alpha, beta)
    h = float(np.clip(h, 1e-8, 1.0 - 1e-8))
    return NormalDist().inv_cdf(h)


def saturation_vapor_pressure_kpa(t_c: float) -> float:
    """Magnus-type e°(T) as in FAO-56 (kPa)."""
    t = float(t_c)
    return 0.6108 * math.exp((17.27 * t) / (t + 237.3))


def psychrometric_slope_kpa_per_c(t_c: float) -> float:
    """Δ slope of saturation curve (kPa/°C)."""
    t = float(t_c)
    eo = saturation_vapor_pressure_kpa(t)
    return (4098.0 * eo) / ((t + 237.3) ** 2)


def atmospheric_pressure_kpa(elevation_m: float) -> float:
    """Standard atmosphere at elevation z (m)."""
    return 101.3 * ((293.0 - 0.0065 * elevation_m) / 293.0) ** 5.26


def psychrometric_constant_kpa_per_c(atm_kpa: float) -> float:
    return 0.665e-3 * atm_kpa


def wind_speed_at_2m(u_z: float, z_m: float) -> float:
    """FAO-56 log profile to 2 m."""
    if z_m <= 0.01 or u_z < 0:
        return float("nan")
    return u_z * 4.87 / math.log(67.8 * z_m - 5.42)


def et0_hargreaves_samani(
    t_mean_c: float,
    t_max_c: float,
    t_min_c: float,
    ra_mj_m2_day: float,
) -> float:
    """Hargreaves–Samani ET₀ (mm/day); usable with Tmax/Tmin/Tmean + extraterrestrial radiation."""
    if not all(np.isfinite([t_mean_c, t_max_c, t_min_c, ra_mj_m2_day])):
        return float("nan")
    dt = t_max_c - t_min_c
    if dt < 0:
        return float("nan")
    ra_mm = ra_mj_m2_day * _RA_MJ_TO_MM_DAY
    return 0.0023 * (t_mean_c + 17.8) * math.sqrt(dt) * ra_mm


def et0_penman_monteith(
    t_mean_c: float,
    u2_m_s: float,
    es_kpa: float,
    ea_kpa: float,
    rn_mj_m2_day: float,
    *,
    elevation_m: float = 0.0,
    g_mj_m2_day: float = 0.0,
) -> float:
    """FAO-56 Penman–Monteith daily ET₀ (mm/day); needs R_n, wind, vapor pressure."""
    if not all(np.isfinite([t_mean_c, u2_m_s, es_kpa, ea_kpa, rn_mj_m2_day])):
        return float("nan")
    delta = psychrometric_slope_kpa_per_c(t_mean_c)
    gamma = psychrometric_constant_kpa_per_c(atmospheric_pressure_kpa(elevation_m))
    num = 0.408 * delta * (rn_mj_m2_day - g_mj_m2_day) + gamma * (900.0 / (t_mean_c + 273.0)) * u2_m_s * (es_kpa - ea_kpa)
    den = delta + gamma * (1.0 + 0.34 * u2_m_s)
    if den <= 0:
        return float("nan")
    return num / den


def monthly_climatic_water_balance_mm(precip_mm: float, et0_sum_mm: float) -> float:
    """D = P − ET₀ for one month (both in mm/month); SPEI input."""
    if not np.isfinite(precip_mm) or not np.isfinite(et0_sum_mm):
        return float("nan")
    return precip_mm - et0_sum_mm


def spei_from_logistic_cdf(
    d_mm: float,
    *,
    alpha: float,
    beta: float,
    loc_xi: float,
) -> float:
    """SPEI scaffold: Φ⁻¹[F_D(d)] with log-logistic F (scale α, shape β, location ξ)."""
    if not np.isfinite(d_mm) or not np.isfinite(alpha) or not np.isfinite(beta) or not np.isfinite(loc_xi):
        return float("nan")
    if alpha <= 0 or beta <= 0:
        return float("nan")
    z = d_mm - loc_xi
    if z <= -alpha:
        return NormalDist().inv_cdf(1e-8)
    fd = 1.0 / (1.0 + (alpha / z) ** beta)
    fd = float(np.clip(fd, 1e-8, 1.0 - 1e-8))
    return NormalDist().inv_cdf(fd)