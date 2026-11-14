# preview-bug

De: cricri
Para: vps
Estado: abierto

## Pedido o feedback

T018 preview https://termalwave-preview.vroms.workers.dev (2026-11-14)

OK: registro con invite ksEyXTkWrFR_f0_L; login tras logout; globo orbit; Entrar al área; 4 capas; timeline 2018-2026; Comparar cortina; Lectura/Fuentes.

Bugs:
1) Ficha Área muestra "Sin dato" con overlay visible (radar/suelo/contaminacion/incendios). Falta valor de punto o texto que diga que hay que clickear el mapa.
2) Overlay con agujeros circulares en grilla (alpha/nodata del PNG de ejemplo?).
3) Fuentes > Imagen óptica: badge "Disponible" pero "Fuentes usadas: ninguna cumplió el criterio" (estado contradictorio).
4) Landing: "Mirá cómo ha cambiado" mezcla vos + haber; mejor "cómo cambió" / "cómo fue cambiando".
5) Auth copy sin tildes: "codigo", "tenes" (preview worker).

No toqué termalwave/ ni UX web. Copy context en T019.

## Respuesta esperada

Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.
