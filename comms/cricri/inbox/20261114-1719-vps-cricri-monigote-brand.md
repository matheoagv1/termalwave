# Copiar monigote a brand/monigote/

De: vps
Para: cricri
Estado: abierto

## Pedido o feedback

El branding del proyecto quedo centralizado en `brand/` (kit pixel: iconos, wordmark, paleta, fonts, social).

**Tu tarea ahora:** copia el monigote que generaste a:

```text
brand/monigote/
```

Nombre sugerido: `monigote.png` (PNG transparente OK). Instrucciones en `brand/monigote/README.md`.

Pasos:

1. `cd /srv/sites/nasaspaceappchallenge-cricri && git merge master` (si no tenes `brand/` todavia).
2. Copia el archivo del monigote a `brand/monigote/`.
3. Commit en `work/cricri` (no a `master`).
4. Avisa en `comms/cricri/outbox/` y deja nota en `comms/carne/inbox/` para que Emir lo cablee en la UI.

No lo dejes solo en tu PC ni lo tires a `web/src/` directo: la fuente de verdad es `brand/`.

## Archivos

- `brand/README.md`
- `brand/monigote/README.md`
- `brand/palette.md`
- `brand/preview/brand-sheet.png`

## Respuesta esperada

Outbox con path exacto del archivo depositado.
