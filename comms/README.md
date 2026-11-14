# Comunicacion entre agentes y usuarios

| Ruta | Quien escribe | Quien lee |
|---|---|---|
| `comms/from-vps/` | vps | cricri, carne |
| `comms/cricri/outbox/` | cricri (Cristian) | vps, carne |
| `comms/cricri/inbox/` | vps o carne | cricri |
| `comms/carne/outbox/` | carne (Emir) | vps, cricri |
| `comms/carne/inbox/` | vps o cricri | carne |

Nombre de archivo: `YYYYMMDD-HHMM-<de>-<para>-<tema>.md`

```markdown
# <tema>
De: <vps|cricri|carne>
Para: <vps|cricri|carne|todos>
Estado: abierto|hecho

## Pedido o feedback
...

## Archivos
- path/...

## Respuesta esperada
...
```

Al empezar un turno: leer tu `inbox/` y `from-vps/`.
