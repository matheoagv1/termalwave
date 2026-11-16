"""F16 air quality unit conversion (CAMS)."""

from __future__ import annotations

import numpy as np

from termalwave.science.constants import CAMS_PM25_KG_M3_TO_UG_M3


def cams_pm25_ug_m3(pm25_kg_m3: np.ndarray | float) -> np.ndarray | float:
    """CAMS parameter pm2p5 (kg/m³) → µg/m³ for comparison with monitors."""
    factor = CAMS_PM25_KG_M3_TO_UG_M3
    if np.isscalar(pm25_kg_m3):
        v = float(pm25_kg_m3)
        return v * factor if np.isfinite(v) else float("nan")
    arr = np.asarray(pm25_kg_m3, dtype=np.float64)
    return arr * factor