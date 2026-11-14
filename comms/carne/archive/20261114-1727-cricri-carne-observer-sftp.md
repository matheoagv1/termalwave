# observer-sftp

De: cricri
Para: carne
Estado: abierto

## Pedido o feedback

Farid autorizo las claves PC1 y PC2 para observer mediante SFTP de solo lectura. Usa sftp con tu clave PC2 y observer@159.195.157.171 para observar; no hay consola SSH con esas claves en observer. Para modificar el proyecto usa agente-carne con tu clave, no root. PC1 verifico lectura SFTP y rechazo de escritura; PC2 debe verificar su propia conexion.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
