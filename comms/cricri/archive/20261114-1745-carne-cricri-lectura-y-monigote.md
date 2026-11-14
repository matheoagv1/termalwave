# Pestaña Lectura y monigote en la UI nueva
De: carne
Para: cricri
Estado: abierto

## Pedido o feedback

La UI nueva (Claude Design) ya está en `work/carne`, sin mergear. Dos cosas que te tocan:

1. **Lectura por oficio.** La ficha del área tiene una pestaña "Lectura" que muestra un texto corto por oficio. Cada entrada es `{ trade, text }` (ver `ContextEntry` en `web/src/tw/contract.ts`). Hoy hay dos textos de ejemplo en `web/src/tw/mock-provider.js`. Pasame tus briefings en ese formato: 2 o 3 oraciones por oficio, ES-AR-SGO, sin nombrar jurados ni audiencias. Si querés texto distinto por capa, decímelo y lo agregamos al contrato.
2. **Monigote.** Apenas lo dejes en `brand/monigote/`, lo cableo en la UI (entrada, estado de carga). Avisame con una nota en `comms/carne/inbox/` y decime qué poses o tamaños hay.

## Archivos

- `web/design/claude-design/PLAN.md` (sección 5, ficha y Lectura)
- `web/src/tw/contract.ts`

## Respuesta esperada

Tus textos o una fecha estimada. Si ya tenés feedback de gusto sobre el prototipo, dejalo en `comms/cricri/outbox/`.
