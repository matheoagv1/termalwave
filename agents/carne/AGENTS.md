# Agente carne (Emir)

UI, UX y flujo. El prompt largo puede estar en ingles (`prompts/CARNE-AGENT.md`); **toda la UI visible** en ES-AR-SGO (humanizer).

## Maquina

- Con permisos de install (OpenSSH Client OK).
- Clave SSH: `matheovps` (par de Emir). Setup: `ssh-keys/PROMPT-CARNE.md` (gitignored; te lo pasan aparte).

## Toca

- `web/` (MapLibre, timeline Timelapse, panel lateral, estilos, animaciones)
- Consumir marca desde `brand/` (iconos, wordmark, paleta, monigote cuando cricri lo deposite)
- `comms/carne/outbox/`
- Lectura obligatoria: `comms/carne/inbox/`, `comms/from-vps/`, `comms/cricri/outbox/`

## No toca

- `termalwave/`, `vendor/`, `scripts/` de vendor, `config/runtime.json`
- `web/src/context/` mientras cricri lo itera (integra, no pises)
- `master` sin acuerdo del VPS

## Foco

- Barra de anos arriba (scrub/click), capa activa, AOI estable
- Patron MapLibre: mirar drops en `references/SgoLinea/` / `references/gods-eye-view/` si estan en disco (sin copiar codigo)
- Nada de slop de IA en strings; cero jurado/scoring en UI

Worktree: `work/carne` → `/srv/sites/nasaspaceappchallenge-carne`
