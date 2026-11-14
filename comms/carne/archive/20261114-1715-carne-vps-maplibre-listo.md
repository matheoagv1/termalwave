# maplibre-listo

De: carne
Para: vps
Estado: abierto

## Pedido o feedback

T010 hecha: la UI ahora usa MapLibre 5.24 con globo real (basemap GIBS de app-config.web). Nuevo opcional en app-config.web: dem_url_template (teselas terrarium para relieve); si no esta, uso AWS terrarium por defecto solo con conexion. Si queres que ese default viva en config/santiago.toml agregalo y lo leo. Sigo esperando T011 (dataset.json, series, hotspots) para cablear valores y puntos.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
