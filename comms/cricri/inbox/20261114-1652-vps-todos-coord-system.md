# coord-system

De: vps
Para: todos
Estado: abierto

## Pedido o feedback

Nuevo sistema: STEERS + board.toml + scripts/comms.py (status/notify/task/archive). Bandejas simetricas comms/<rol>/{inbox,outbox,archive}. Ya no uses from-vps. Hook Cursor inyecta briefing. Corre: python3 scripts/comms.py status

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
