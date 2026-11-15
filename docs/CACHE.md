# TermalWave — cache de teselas

Las teselas de mapa base se piden una sola vez a GIBS o CARTO y después salen de nuestra cache. Hay dos niveles. Las teselas con fecha se archivan, así la fecha de hoy sigue disponible en la línea de tiempo cuando ya es vieja.

Config: `config/apis.toml` `[tiles]` y `[basemaps.entries.*]`. Ningún host ni TTL vive en el código.

```text
navegador ── /tiles/{fuente}/{fecha|-}/{z}/{x}/{y} ──▶ Worker (L1: caches.default, sesión requerida)
                                                          │ X-TW-Origin-Key
                                                          ▼
                       origin.termalwave.space/tiles/{política}/… ──▶ nginx (L2 + archivo en disco)
                                                                         │
                                                                         ▼
                                                                  GIBS / CARTO
```

## Política por fuente

`tile_cache_policy()` en `termalwave/providers/registry.py` la decide una vez para Python, nginx y el Worker:

| Política | Cuándo | Zona nginx | Vigencia en origen | Edge | Navegador |
|---|---|---|---|---|---|
| `archive` | la URL tiene `{date}`, o `cache_policy = "archive"` (Blue Marble) | `tw_tiles_archive` | 3650 d | 1 año, immutable | 1 año, immutable |
| `recent` | tesela con fecha a menos de `date_lag_days + recent_days` de hoy | `tw_tiles_volatile` | 6 h | 1 h | 10 min |
| `volatile` | raster sin fecha (CARTO) | `tw_tiles_volatile` | 7 d | 7 d | 1 d |
| `direct` | `do_not_store_tiles` (EOX), vector, `ion://` | no pasa por la cache | — | — | — |

`recent` existe porque GIBS completa las pasadas de los últimos días de a poco. Una tesela incompleta no se archiva: se vuelve a pedir y, cuando la fecha sale de esa ventana, entra al archivo con la versión final. Las fechas futuras o mal formadas dan 400.

EOX s2cloudless no se guarda nunca: la licencia lo prohíbe, así que el navegador la pide directo.

## Nivel 1: Worker

`preview/src/tiles.js`. Usa la sesión del gate como el resto del sitio (sin cookie: 401 para fetch, 302 para navegación). Valida fuente, fecha y que `z/x/y` estén dentro de `max_zoom`, y arma la ruta del origen con la política. Busca en `caches.default` y, si no está, pide al origen con la clave compartida. Cabecera `x-tile-cache`: `edge` o `origin-hit|miss|stale`.

Vars en `preview/wrangler.jsonc`: `TILE_ORIGIN`, `TILE_ORIGIN_HEADER` (tienen que coincidir con `[tiles] origin_host` / `key_header`). Secreto: `TILE_ORIGIN_KEY`.

## Nivel 2 y archivo: nginx en el VPS

`origin.termalwave.space` es un registro A proxied de Cloudflare (SSL Flexible, nginx escucha en :80). Sin la clave responde 403. La conf se genera, no se edita a mano:

```bash
python3.11 scripts/tiles_nginx.py --print     # revisar
python3.11 scripts/tiles_nginx.py --install   # escribe conf + clave, nginx -t, reload
```

- Sitio: `/etc/nginx/sites-available/termalwave-origin` (enlazado en `sites-enabled`).
- Clave: `/etc/nginx/snippets/termalwave-origin-key.conf` (0600, fuera del repo). Si falta `TILE_ORIGIN_KEY` en `config/secrets.local.toml [cloudflare]`, el script la genera.
- Disco: `/var/cache/nginx/termalwave/{archive,volatile}`, la clave de cache es la URI.
- `proxy_cache_lock` junta pedidos iguales; `proxy_cache_use_stale` sirve la copia vieja si el upstream falla o devuelve 429/5xx. Se ignoran `Cache-Control`, `Expires` y `Set-Cookie` del upstream. Cabecera `X-Cache-Status`.

Tras cambiar `[tiles]` o agregar un mapa base: `--install` en el VPS, `npx wrangler deploy` en `preview/` y regenerar `app-config.json`.

## Limpieza

La hace el cache manager de nginx, sin cron:

- `archive`: borra lo que nadie pidió en 3650 días (`inactive`) o lo menos usado si pasa de 50 GB (`max_size`).
- `volatile`: borra lo que nadie pidió en 30 días o lo menos usado si pasa de 10 GB.
- Vaciar a mano una zona: `rm -rf /var/cache/nginx/termalwave/volatile/*` y `systemctl reload nginx`.

La edge de Cloudflare expira sola por TTL.

## Cliente web

`app-config.json` trae, por mapa base cacheable, `cache_policy`, `proxy_template` (ruta relativa al mismo origen) y `tile_cache`. Si la app la sirve el Worker se usa `proxy_template`; si no (offline, `file://`, otro host) se usa `url_template`.

## Caché de providers (Python)

Doble capa bajo `data/cache` (o `[paths].cache_dir`):

| Capa | Ruta | Qué guarda |
|------|------|------------|
| L1 | `requests/<namespace>/<hash>.json` | Respuesta HTTP cruda de cada proveedor |
| L2 | `snapshots/<kind>/<hash>.json` | Resultado normalizado (geocode, elevación, ingest) |
| Archivo | `archive/requests|snapshots/...` | Sujetos con fecha pasada (período cerrado hace más de `settle_days`) |

- Volátil: caduca a los `request_max_age_s` (7 días por defecto).
- Archivo: no caduca; lo elige `RequestCache.fetch(..., dated_until=date)` / la política en `cache_admin.CachePolicy`.
- Escrituras atómicas (`*.tmp` + `os.replace`).
- CLI: `python3.11 -m termalwave cache stats` y `cache prune [--dry-run]` (borra volátiles vencidos, `.tmp` y corruptos; recorta por LRU si pasa `max_bytes`; nunca toca `archive/`).

