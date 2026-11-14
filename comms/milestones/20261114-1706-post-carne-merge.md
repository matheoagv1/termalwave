# Milestone snapshot post-carne-merge

## board.toml
```toml
# Shared task board. Agents + steers update via: python3 scripts/comms.py task …
# status: open | in_progress | blocked | done | cancelled

[[task]]
id = "T003"
owner = "cricri"
status = "open"
title = "Deposit monigote PNG in brand/monigote/"
notes = "See brand/monigote/README.md and inbox monigote-brand"
updated = "2026-11-14"

[[task]]
id = "T004"
owner = "carne"
status = "done"
title = "Wire brand/ assets into web chrome (favicon, wordmark, palette)"
notes = "Wordmark, favicon y paleta cableados desde brand/ via web/scripts/sync-brand.mjs. Falta el monigote (T003)."
updated = "2026-11-14"

[[task]]
id = "T007"
owner = "carne"
status = "done"
title = "Data sources panel reading provenance from app-config"
notes = "Pestana Fuentes en la ficha (provenance y data_sources de app-config). Verificada en preview."
updated = "2026-11-14"

[[task]]
id = "T008"
owner = "cricri"
status = "open"
title = "Context copy for data sources / layers (no jury in UI)"
notes = "Can draft context in parallel with carne panel polish"
updated = "2026-11-14"

[[task]]
id = "T009"
owner = "carne"
status = "done"
title = "Port Claude Design UI to React, conectada a ConfigProvider (datos reales de app-config)"
notes = "UI React portada. Verificada en preview con datos reales y con #mock=1. Commits c72fb6b y siguientes."
updated = "2026-11-14"

[[task]]
id = "T010"
owner = "carne"
status = "open"
title = "MapLibreScene (globo + territorio + cortina) detras de SceneApi"
notes = "Reemplaza la escena DOM interina. Requiere MapLibre 5.x para globo. Pausado: Emir termino tanda; retoma despues."
updated = "2026-11-14"

[[task]]
id = "T011"
owner = "vps"
status = "open"
title = "dataset.json con tramos (segments), series y hotspots segun web/src/tw/contract.ts"
notes = "Ver outbox carne 20261114-1745. Mientras tanto la UI adapta app-config.json a un tramo anual."
updated = "2026-11-14"

[[task]]
id = "T012"
owner = "cricri"
status = "open"
title = "Lectura por oficio en web/src/context/trades.json"
notes = "Formato [{trade,text}], ES-AR-SGO. La UI ya lo lee."
updated = "2026-11-14"

```

## STEERS.md
```markdown
# Steers — current only

Entradas nuevas arriba. Historial: `STEERS.archive.md` (no leer en turnos normales).

## 2026-11-14 — milestone `day1-lean`

1. Context lean: agents read `comms/NOW.md` first. Run `milestone` after each big cut.
2. Open work is only what is on `board.toml` (done tasks live in `board.done.toml`).
3. Cricri: monigote + context fuentes. Carne: brand + Fuentes React. VPS: merge/unblock.

No secrets in comms.

```
