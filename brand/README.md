# brand/ — branding global del repo

Fuente unica de marca para TermalWave. Todos los agentes y el frontend consumen desde aca (no dupliques assets en `web/src/` salvo copia de build).

Kit pixel-art: icono, wordmark, favicon, PWA, social, tipografia Press Start 2P, paleta.

- Tagline ES: **Entorno de detección de impacto ambiental global**
- Tagline EN: **Global environmental impact detection environment**
- Overview: `preview/brand-sheet.png`
- Colores / CSS / que archivo va a Vite: `palette.md`
- Creditos / AI usage: `CREDITS.md`

## Layout

| Ruta | Contenido |
|---|---|
| `icon/` | Favicon, masters, tamaños pixel |
| `wordmark/` | Lockups TERMAL WAVE |
| `pwa/` | Icons PWA / maskable |
| `social/` | OG + banners GitHub |
| `fonts/` | Press Start 2P + OFL |
| `preview/` | Hojas de control visual |
| `concept/` | Estudios IA tempranos (no ship) |
| `monigote/` | **Mascota / monigote del equipo** (cricri deposita aca) |

## Ship rapido

| Need | File |
|---|---|
| Favicon | `icon/favicon.ico` |
| App / tab | `icon/icon-32.png`, `icon/icon-80.png` |
| Apple | `icon/apple-touch-icon.png` |
| PWA | `pwa/icon-192.png`, `pwa/icon-512.png`, `pwa/maskable-512.png` |
| Header dark | `wordmark/termal-wave-dark.png` |
| Header light | `wordmark/termal-wave-light.png` |
| OG ES / EN | `social/og-1200x630.png`, `social/og-1200x630-en.png` |

Master sprite: `icon/master-80.png`. En CSS: `image-rendering: pixelated`.

Ownership: VPS mantiene el kit; **cricri** agrega el monigote en `monigote/`; **carne** cablea el uso en `web/`.
