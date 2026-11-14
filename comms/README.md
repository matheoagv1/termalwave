# Canal de comunicacion entre agentes

Los agentes (VPS, PC1, PC2) se hablan por archivos. No hace falta chat cruzado.

## Carpetas

| Ruta | Quien escribe | Quien lee |
|---|---|---|
| `comms/from-vps/` | Agente VPS (Cursor en el servidor) | PC1 y PC2 |
| `comms/pc1/outbox/` | Agente PC1 | VPS y PC2 |
| `comms/pc1/inbox/` | VPS o PC2 dejando notas para PC1 | PC1 |
| `comms/pc2/outbox/` | Agente PC2 | VPS y PC1 |
| `comms/pc2/inbox/` | VPS o PC1 dejando notas para PC2 | PC2 |

## Formato de mensaje

Nombre de archivo:

```text
YYYYMMDD-HHMM-<de>-<para>-<tema-corto>.md
```

Ejemplo: `20261114-1540-vps-pc2-feedback-flujo.md`

Plantilla:

```markdown
# <tema>
De: <vps|pc1|pc2>
Para: <vps|pc1|pc2|todos>
Estado: abierto|hecho

## Pedido o feedback
...

## Archivos tocados (si aplica)
- path/...

## Respuesta esperada
...
```

## Rutina del agente

Al empezar un turno:

1. Leer `references/AGENTS.md` y tu prompt de rol.
2. Revisar tu `inbox/` y `comms/from-vps/`.
3. Hacer el trabajo solo en tus directorios permitidos.
4. Si necesitas avisar a otro, escribe en su `inbox/` o en tu `outbox/` y di en el mensaje de usuario que hay un aviso nuevo.

El agente VPS puede “notificar” dejando un archivo en `comms/from-vps/` o en `comms/pcN/inbox/` y pidiendo pull/sync en el worktree de esa persona.
