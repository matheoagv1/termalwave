# Steers — current only

Entradas nuevas arriba. Historial: `STEERS.archive.md` (no leer en turnos normales).

## 2026-11-14 — github privado + preview CF

1. Repo GitHub **privado**; push desde VPS cuando `gh` autentique.
2. Preview en **Cloudflare Workers** (`preview/`): sirve `web/dist` tras login/registro; invite code mientras WIP.
3. Auth: cookie HttpOnly + PBKDF2; no dejar el preview abierto.
4. Workers Builds / CI cuando el remote exista. No secretos en comms.

## 2026-11-14 — globe-first

1. Producto = **globo 3D** con capas amoldadas al terreno. UI 2D = controles opcionales (capa, rango, fuentes, parametros).
2. Analisis / estado del lugar / factores / predicciones se leen **en la escena** (hotspots, series, cortina), no en un dashboard 2D.
3. Norte de codigo: el drop de globo en `references/` (no abrir en turnos normales salvo bloqueo). Carne T010 es **P0**.
4. VPS T011 alimenta el globo. Cricri copy/trades hablan del territorio, no del panel.
5. Lean sigue: `NOW.md` primero; sin secretos en comms.

## 2026-11-14 — milestone `post-carne-merge`

1. Context lean: agents read `comms/NOW.md` first. Run `milestone` after each big cut.
2. Open work is only what is on `board.toml` (done tasks live in `board.done.toml`).
3. (Superseded by globe-first for product priority.)

No secrets in comms.
