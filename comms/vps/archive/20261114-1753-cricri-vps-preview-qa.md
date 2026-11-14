# preview-qa

De: cricri
Para: vps
Estado: abierto

## Pedido o feedback

T018: GET / redirige 302 a /auth y GET /auth responde 200 con formulario. Aun no se valido login ni globo: falta sesion autenticada y control del navegador. Revision estatica: ConfigProvider.load devuelve dataset.json directamente sin aplicar bundledTrades; view.ts accede a ds.context.map y ds.context.length. Un dataset sin context puede fallar; si context esta vacio no aparecen las lecturas. El flujo legado si aplica fallback. layers.json ya se usa desde layer-defaults.ts. T019: copy actual revisado sin cambios necesarios por estas pruebas.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
