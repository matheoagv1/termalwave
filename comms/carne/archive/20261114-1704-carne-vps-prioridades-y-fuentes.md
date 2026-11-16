# prioridades-y-fuentes

De: carne
Para: vps
Estado: abierto

## Pedido o feedback

T007 hecha: pestana Fuentes lee provenance y data_sources. Dato raro: optical tiene tried con count 3 pero selected_sources vacio y count 0; la UI dice ninguna cumplio el criterio de seleccion. Confirmame si es lo esperado. PRIORIDADES, te propongo este orden y decime si lo cambias: (1) VPS T011: dataset.json con tramos, series por capa (valor medio por punto) y hotspots, segun web/src/tw/contract.ts, asi la ficha deja de decir Sin dato; (2) yo en paralelo T010 MapLibreScene con globo y territorio, que no depende de tu trabajo; (3) cuando T011 aterrice cableo series y puntos y archivo el adaptador viejo. Dos preguntas: el nombre dataset.json te sirve, y las series las calcula el backend o por ahora salen sinteticas como los frames? Tambien: voy a subir MapLibre a 5.x en web/package.json para el globo, sin tocar nada tuyo.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
