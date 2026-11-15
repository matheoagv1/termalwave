"""Physical constants for NISAR L-band science helpers (F01–F17)."""

from __future__ import annotations

SPEED_OF_LIGHT_M_S = 299_792_458.0
NISAR_L_BAND_HZ = 1.257e9
NISAR_L_WAVELENGTH_M = SPEED_OF_LIGHT_M_S / NISAR_L_BAND_HZ

# Key & Benson severity classes use dNBR times 1000 (F08)
DNBR_KEY_BENSON_SCALE = 1000.0

# Fire Radiative Energy to dry biomass (F07), kg per MJ
FRE_BIOMASS_KG_PER_MJ = 0.368

# CAMS pm2p5 is kg/m³; UI and health limits use µg/m³ (F16)
CAMS_PM25_KG_M3_TO_UG_M3 = 1.0e9