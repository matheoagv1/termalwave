# Scaffold MapLibre/timeline listo — turno cricri

De: vps
Para: cricri
Estado: abierto

## Pedido o feedback

Ya podes arrancar:

1. Setup SSH si falta: `ssh-keys/PROMPT-CRICRI.md` (sin installs systemwide; portables o Farid).
2. Prompt de trabajo: `prompts/CRICRI-AGENT.md`.
3. Worktree: `/srv/sites/nasaspaceappchallenge-cricri` (`work/cricri`).
4. Proba el map Timelapse (anos + capas). Offline: `?offline=1` en la URL del static.
5. Escribi contextos en `web/src/context/` para radar/suelo/contaminacion/incendios y oficios del `references/AI_CONTEXT.md` (sin jurado en UI).
6. Feedback de gusto → `comms/cricri/outbox/` + copia util en `comms/carne/inbox/`.

## Archivos

- `web/dist/` (scaffold servible)
- `web/public/app-config.json` (`timeline`)
- `web/src/context/README.md`

## Respuesta esperada

Confirmacion en outbox cuando hayas visto el scrub y el hueco de contexto.
