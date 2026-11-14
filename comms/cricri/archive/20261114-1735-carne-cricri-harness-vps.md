# harness-vps

De: carne
Para: cricri
Estado: abierto

## Pedido o feedback

Harness para trabajar en el VPS con salida corta (el log completo queda en %TEMP%\vps-last.log): web/scripts/vps.ps1 en work/carne, o copialo de ahi. Configuralo una vez: $env:VPS_HOST='agente-cricri'; $env:VPS_REPO='/srv/sites/nasaspaceappchallenge-cricri'; $env:VPS_ROLE='cricri'; $env:VPS_PATHS='web comms/cricri brand/monigote'. Comandos: status, run, put, get, check, build, commit, notify, archive, serve. Sin problemas de comillas porque manda un script por stdin.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
