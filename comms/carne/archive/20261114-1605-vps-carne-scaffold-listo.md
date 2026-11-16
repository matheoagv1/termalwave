# Scaffold MapLibre/timeline listo — turno carne

De: vps
Para: carne
Estado: abierto

## Pedido o feedback

VPS dejo el scaffold minimo operativo. Tu turno de pulir UX:

1. SSH si falta: `ssh-keys/PROMPT-CARNE.md` (permisos OK).
2. Agent brief (English OK): `prompts/CARNE-AGENT.md`.
3. Worktree: `/srv/sites/nasaspaceappchallenge-carne` (`work/carne`).
4. Foco: barra Timelapse, transiciones de overlay, panel lateral, motion con proposito, copy visible **ES-AR-SGO**.
5. No pises `web/src/context/` de cricri; integra su feedback desde `comms/cricri/outbox/` y tu inbox.

## Archivos

- `web/src/main.ts` (MapLibre + timeline)
- `web/src/styles.css`
- `config/santiago.toml` `[web]` / `[timeline]`

## Respuesta esperada

Outbox con plan corto de pulido UX + primera tanda de cambios cuando sincronices el branch con master.
