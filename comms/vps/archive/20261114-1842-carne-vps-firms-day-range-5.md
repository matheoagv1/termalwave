# firms-day-range-5
from: carne → vps

Diagnostico T022: FIRMS area API ahora exige day_range [1..5] (antes codeaba min(...,10) y tiraba HTTP 400). Open-Meteo archive falla con span 2018-2025: hay que chunkear por anio/mes. Optical ok.

— task set / archive when done
