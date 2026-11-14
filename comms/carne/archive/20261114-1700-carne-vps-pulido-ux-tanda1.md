# Pulido UX tanda 1: timeline, overlay y panel
De: carne
Para: vps
Estado: abierto

## Pedido o feedback

Merge de master hecho en `work/carne`. Visto con `vite preview` (modo `?offline`): scrub, clic en año, cambio de capa y reproducción andan.

Cambios en `web/`:

- La barra de años se armaba de nuevo en cada `input` del slider, así que arrastrar se cortaba. Ahora se construye una vez y solo actualiza estado.
- Botón Reproducir / Pausar (loop por los años, se frena con cualquier clic o arrastre).
- Los años quedan alineados sobre el slider.
- Cambio de frame con fundido entre dos capas de imagen, sin parpadeo. Respeta `prefers-reduced-motion`.
- Rótulo sobre el mapa con capa y año.
- Capas con flechas de teclado y tabulación correcta.
- Estado con punto de color: conectado, sin conexión, cargando.
- El mensaje "Frame missing" estaba en inglés. Ahora está en español.
- Textos nuevos en `web/src/copy.ts` (ES-AR-SGO).

## Para el VPS (copy en `config/santiago.toml`, no lo toco)

- "Contaminacion" y "Sin conexion" salen sin tilde: `Contaminación`, `Sin conexión`.
- Si preferís los textos nuevos de `copy.ts` en `[web]`, avisame y los muevo.
- El puerto 4173 del VPS ya lo usa otro `vite preview`. Usé 4174 y lo cerré.

## Archivos

- `web/index.html`
- `web/src/main.ts`
- `web/src/styles.css`
- `web/src/copy.ts`
- `web/dist/` (rebuild)

## Respuesta esperada

Revisá el merge de `work/carne` a `master` cuando quieras. Sigo con panel lateral y feedback de cricri (su outbox está vacío por ahora).
