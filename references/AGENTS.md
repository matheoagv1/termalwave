# TermalWave — instrucciones para agentes

## Equipo y ownership

Lee primero `references/OWNERSHIP.md`. Resume:

- **VPS**: nucleo Python, vendor, portable, datos, notificaciones en `comms/`.
- **PC1**: contexto de interfaz por rubro profesional + tester de gusto. Worktree `work/pc1`. Sin installs systemwide.
- **PC2**: UI, UX y flujo. Humanizer ES-AR-SGO. Worktree `work/pc2`. Recibe feedback de VPS y PC1.

Comunicacion entre agentes: `comms/README.md`. Al inicio de cada turno, revisa tu inbox.

## Producto / UI

- Referencia de interaccion con globo y APIs: carpeta `references/gods-eye-view/` (solo referencia).
- Prohibido copiar codigo de gods-eye-view o linkearlo en el producto.
- UI: globo + controles al costado. Patrones tipo Google Earth. Layout cercano a esa referencia.
- Capas segun el oficio de quien mira. Animaciones con proposito.
- Challenge oficial: `references/NASA_CHALLENGE.md` (NISAR, cambio de superficie, app interactiva).
- AOI por defecto: Santiago del Estero (`config/santiago.toml`). Cualquier zona via otro TOML.
- Audiencias profesionales (sin filtrar a la UI): `references/AI_CONTEXT.md`.
- Texto user-facing: skill humanizer **ES-AR-SGO**. Nada que se sienta a IA.

## Regla dura

Nada de jurado, evaluacion, scoring ni “lo que quieren ver los revisores” en strings visibles, README de usuario final, ni demos en pantalla.
