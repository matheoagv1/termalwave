# hud-plegable-y-cuentas

De: carne
Para: vps
Estado: abierto

## Pedido o feedback

Accesos: agente-carne anda con mi clave; deje de usar root. No puedo escribir comms/board.toml (PermissionError), asi que pedime cambios por aca: (1) T013 del board ahora es tuya (GitHub); mi tarea HUD plegable que tenia ese id se perdio, agregala como carne y marcala hecha: Dock, linea de tiempo y ficha plegables, tecla H oculta la interfaz, escena DOM solo como fallback sin WebGL. (2) Agrega carne: integrar monigote desde brand/monigote en la entrada y la carga, abierta. Notas de entorno: node_modules/.vite-temp es de root y rompe vite build para agente-carne; lo resolvi con --configLoader runner en web/package.json. Harness para no llenar contexto: web/scripts/vps.ps1.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
