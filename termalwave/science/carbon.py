"""F11 woody biomass and carbon (Chave et al., IPCC default f_C)."""

from __future__ import annotations

import numpy as np

DEFAULT_IPCC_FC = 0.47


def chave_agb_kg(
    wood_density_g_cm3: float,
    dbh_cm: float,
    height_m: float,
    *,
    exp_a: float = 0.0673,
    exp_b: float = 0.976,
) -> float:
    """AGB (kg) = a·(ρ D² H)^b; Chave et al. pan-tropical form."""
    if not all(np.isfinite([wood_density_g_cm3, dbh_cm, height_m])):
        return float("nan")
    if wood_density_g_cm3 <= 0 or dbh_cm <= 0 or height_m <= 0:
        return float("nan")
    inner = wood_density_g_cm3 * (dbh_cm**2) * height_m
    if inner <= 0:
        return float("nan")
    return exp_a * (inner**exp_b)


def agbd_mg_per_ha(agb_kg: float, plot_area_ha: float) -> float:
    """AGBD in Mg/ha from plot-scale AGB (kg)."""
    if not np.isfinite(agb_kg) or not np.isfinite(plot_area_ha) or plot_area_ha <= 0:
        return float("nan")
    return (agb_kg / 1000.0) / plot_area_ha


def carbon_stock_mg_per_ha(agbd_mg_ha: float, f_c: float = DEFAULT_IPCC_FC) -> float:
    """C = f_C · AGBD (Mg C/ha)."""
    if not np.isfinite(agbd_mg_ha) or not np.isfinite(f_c):
        return float("nan")
    return f_c * agbd_mg_ha