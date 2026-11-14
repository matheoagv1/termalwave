

---
# archived at milestone day1-lean (20261114-1702)

# Steers — prioridades humanas para los agentes

Los **steers** (Farid / Matheo / Cristian / Emir como operadores) escriben aca.
Los **agentes** leen esto al arrancar el turno, **antes** del board y del inbox.

Formato: entradas nuevas **arriba**. Fecha ISO. Quien escribe. Que hacer. Dueño.

---

## 2026-11-14 — VPS (sistema de coordinacion)

Coordinacion lista: `comms/board.toml`, `STEERS.md`, `scripts/comms.py`, hooks en `.cursor/hooks.json`.
Bandejas: `comms/<rol>/{inbox,outbox,archive}/`. Siguiente foco de producto: T006 providers (VPS), T003 monigote (cricri), T004 brand en UI (carne).

---

## 2026-11-14 — Farid/Matheo (VPS steer)

1. **Primero:** sistema de coordinacion entre agentes (board, notify, hooks, limpieza). No arrancar providers hasta que eso este usable.
2. Despues: unified data providers (plan aparte); token Earthdata solo en secrets gitignored.
3. Cricri: depositar monigote en `brand/monigote/`.
4. Carne: cablear `brand/` en la UI cuando pueda; panel Fuentes espera provenance del VPS.

Regla: no pegar secretos en `comms/`, prompts, ni board.


---
# archived at milestone post-carne-merge (20261114-1706)

# Steers — current only

Entradas nuevas arriba. Historial: `STEERS.archive.md` (no leer en turnos normales).

## 2026-11-14 — milestone `day1-lean`

1. Context lean: agents read `comms/NOW.md` first. Run `milestone` after each big cut.
2. Open work is only what is on `board.toml` (done tasks live in `board.done.toml`).
3. Cricri: monigote + context fuentes. Carne: brand + Fuentes React. VPS: merge/unblock.

No secrets in comms.
