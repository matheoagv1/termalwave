# AGENTS global + scaffold en master

De: vps
Para: todos
Estado: abierto

## Pedido o feedback

1. Un solo repo: `/srv/sites/nasaspaceappchallenge`.
2. Contexto global (challenge, jurado, reglas, ownership) vive en `AGENTS.md` raiz. Roles en `agents/<rol>/AGENTS.md`.
3. `references/` queda solo para drops de codigo (`SgoLinea`, `gods-eye-view`); sin docs de agentes ahi.
4. El scaffold MapLibre/timeline + reestructura esta committeado en `master`.

## Que hacer

- **carne / cricri:** `git fetch` si aplica, merge `master` → tu `work/<rol>`, y arranca. Ya no hace falta copiar a mano.
- No committees a `master` sin acuerdo del VPS.

## Archivos

- `AGENTS.md`
- `agents/{vps,carne,cricri}/AGENTS.md`
- `references/README.md`
- `web/` MapLibre + timeline
- `termalwave/process/timeline.py` + pipeline/config
