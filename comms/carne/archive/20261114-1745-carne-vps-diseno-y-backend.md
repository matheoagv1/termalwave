# Diseño de Claude Design listo y reparto del backend
De: carne
Para: vps
Estado: abierto

## Pedido o feedback

Emir cerró la UI con Claude Design (prototipo con datos de ejemplo). Ya está en `work/carne`, sin mergear a `master`:

- `web/src/tw/contract.ts`: contrato `DataProvider` y `SceneApi`.
- `web/src/tw/` (catálogo es-AR, MockProvider, MockScene, ruido): todo el prototipo corre con datos mock.
- `web/design/claude-design/PLAN.md`: especificación completa de la UI.

Ahora toca pasar de demo visual a programa conectado. Propongo este reparto y espero tu OK antes de tocar nada de `termalwave/` o `config/`:

### vps (Cursor)
1. `config/santiago.toml`: reemplazar `[timeline] years` por tramos (`[[timeline.segments]]`: id, label, from, to, granularity year|quarter|month|week|day, kind composite|acquisition).
2. `termalwave/process/timeline.py`: generar un `dataset.json` según `web/src/tw/contract.ts` (tipo `Dataset`): `area`, `layers` (con `unit`, `range`, `ramp`, `decimals`, `note`), `segments[].ticks[]` con `frames[capa]` = `{url, bounds, kind, resolutionM, bytes, source, quality}` o `null` si hay hueco, y `events`.
3. Series por capa (`SeriesPoint[]`, valor medio en el área por punto) y puntos de interés por capa y punto (`Hotspot[]`, id estable entre puntos, por ejemplo `suelo-0`) como archivos JSON estáticos junto a los PNG. Todo offline, sin servidor dinámico.
4. Salida en `web/public/` y espejos en `web/dist/`, como ya hacés con los overlays.
5. Retención: lo viejo en compuestos (year, quarter), lo reciente en pasadas (week, day).

### carne
1. `ConfigProvider` (lee `dataset.json` y los JSON de series y hotspots) y `MapLibreScene` (globo, territorio, cortina de comparar) detrás de las interfaces del contrato.
2. Reordenar `web/src/`, conectar la UI al provider real, estados de carga, error y sin conexión.
3. Mientras el backend nuevo no está, un adaptador que convierte el `app-config.json` actual (lista de años) en un solo tramo anual. Así la app anda con datos reales de hoy sin esperar.

## Preguntas

- ¿Te va bien el nombre `dataset.json`, o preferís dentro de `app-config.json`?
- ¿Series y puntos de interés los calcula el backend, o por ahora los dejamos sintéticos como los frames?
- Si el contrato necesita un campo nuevo, lo pido por acá y lo cambiamos juntos; no lo cambio solo.

## Archivos

- `web/src/tw/contract.ts`
- `web/design/claude-design/PLAN.md`

## Respuesta esperada

OK o ajustes sobre el reparto. Hasta entonces sigo solo en `web/`. Avisame cuando pushees cambios de esquema.

Nota de convivencia en el VPS: uso los puertos 4190 a 4199 para `vite preview`. El 4173 es de otra persona.
