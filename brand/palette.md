# Termal Wave — palette and usage

Brand for the Termal Wave web app (NASA Space Apps 2026, challenge *Dancing with the SARs*).
Pixel-art globe centered on South America, with a heat/radar mark on northern Argentina
(Santiago del Estero / Moreno fire area). Dark UI, maps, React + TypeScript + Vite.

Official tagline (use this wording, including the accent on “ó”):
**Entorno de detección de impacto ambiental global**

English variant (files suffixed `-en`):
**Global environmental impact detection environment**

The master icon is an **80×80** pixel sprite (globe + wizard hat). Every larger PNG is a nearest-neighbor
upscale of that grid. 16, 32 and 64 are drawn on their own grids so the hat stays readable. Do not resample with bilinear/bicubic in CSS — use
`image-rendering: pixelated`.

## Colors

| Token | Hex | Use |
|---|---|---|
| `--tw-bg` | `#070B12` | App background, map chrome |
| `--tw-bg-elevated` | `#0E1522` | Panels, cards, header |
| `--tw-bg-hover` | `#162034` | Hover / selected panel |
| `--tw-ink` | `#000000` | Pixel outlines |
| `--tw-text` | `#F4F1E8` | Primary text |
| `--tw-muted` | `#8B93A7` | Secondary text, captions |
| `--tw-ocean-deep` | `#082460` | Globe ocean shadow, deep water |
| `--tw-ocean` | `#1048C4` | Globe ocean mid |
| `--tw-ocean-bright` | `#2474EC` | Globe ocean light |
| `--tw-ocean-highlight` | `#5CB0FF` | Specular / selected water |
| `--tw-land` | `#E4BC1C` | Other land mid |
| `--tw-land-bright` | `#FFE44A` | Land highlight, wordmark yellow |
| `--tw-argentina` | `#F0A014` | Argentina fill mid (warmer gold) |
| `--tw-argentina-bright` | `#FFD020` | Argentina highlight |
| `--tw-heat` | `#FF3A12` | Burn / heat core |
| `--tw-heat-mid` | `#FF7A1A` | Marker / fire mid |
| `--tw-heat-glow` | `#FFB43A` | Heat glow, alerts |
| `--tw-radar` | `#5EEBFF` | Radar orbit, scan footprint, links |
| `--tw-radar-deep` | `#28A8D4` | Radar shadow, visited links |

## CSS variables

```css
:root {
  --tw-bg: #070B12;
  --tw-bg-elevated: #0E1522;
  --tw-bg-hover: #162034;
  --tw-ink: #000000;
  --tw-text: #F4F1E8;
  --tw-muted: #8B93A7;
  --tw-ocean-deep: #082460;
  --tw-ocean: #1048C4;
  --tw-ocean-bright: #2474EC;
  --tw-ocean-highlight: #5CB0FF;
  --tw-land: #E4BC1C;
  --tw-land-bright: #FFE44A;
  --tw-argentina: #F0A014;
  --tw-argentina-bright: #FFD020;
  --tw-heat: #FF3A12;
  --tw-heat-mid: #FF7A1A;
  --tw-heat-glow: #FFB43A;
  --tw-radar: #5EEBFF;
  --tw-radar-deep: #28A8D4;
  --font-pixel: "Press Start 2P", ui-monospace, monospace;
  --font-ui: "IBM Plex Sans", "Outfit", system-ui, sans-serif;
}

.pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

## Type

- **Display / wordmark / HUD labels:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P), SIL Open Font License 1.1.
  The TTF and `OFL.txt` are vendored in `fonts/`. Load with a local `@font-face` — no CDN required.
  Use font sizes that are multiples of 8 (8, 16, 24, 32) so the glyphs stay on the pixel grid.
- **UI body / maps / forms:** a clean grotesque already in the app (IBM Plex Sans, Outfit, or system-ui). Do not set long paragraphs in Press Start 2P; it is a display face.

```css
@font-face {
  font-family: "Press Start 2P";
  src: url("/fonts/PressStart2P-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
```

## File guide

| File | Use |
|---|---|
| `icon/master-80.png` | Source sprite (80×80). Edit this, then re-scale. |
| `icon/master-64.png` | Independent 64×64 drawing of the same mark. |
| `icon/icon-{16,32,64,80,160,192,240,256,320,400,512,800,1024}.png` | Transparent app icons |
| `icon/favicon.ico` | Multi-size 16/32/48 favicon |
| `icon/apple-touch-icon.png` | 180×180 opaque (iOS home screen) |
| `pwa/icon-192.png`, `pwa/icon-512.png` | Transparent PWA icons |
| `pwa/maskable-512.png` | Opaque, globe padded into the 80% safe zone |
| `wordmark/termal-wave-dark.png` | Lockup for dark backgrounds (transparent) |
| `wordmark/termal-wave-light.png` | Lockup for light backgrounds (transparent) |
| `wordmark/termal-wave-stacked-dark.png` | Stacked TERMAL / WAVE, dark |
| `social/og-1200x630.png` | Open Graph / social share (Spanish tagline) |
| `social/og-1200x630-en.png` | Open Graph, English tagline |
| `social/github-1280x640.png` | GitHub repo social preview (Spanish tagline) |
| `social/github-1280x640-en.png` | GitHub banner, English tagline |
| `preview/brand-sheet.png` | One-page kit overview |

Vite / `index.html` sketch:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:image" content="/og-1200x630.png">
<meta property="og:title" content="Termal Wave">
```

## Usage notes

- The warmer gold shape on the globe **is Argentina**. The orange-yellow plus marks **northern Argentina** (Santiago del Estero area). The cyan arc is a radar / SAR orbit cue. The royal-blue floppy hat (yellow stars and a crescent moon, tip curling left) sits on the north cap and must not cover South America.
- Do not add the NASA ident, meatball, worm, or the word “NASA” to these graphics (hackathon rule for this artwork).
- Do not redraw the globe with smooth filters, drop shadows, or extra continents that fight the 64-grid.
- On a dark map UI, use `--tw-radar` for scan footprints and `--tw-heat` / `--tw-heat-glow` for burn-scar / alert marks. Keep large fills in `--tw-bg` / `--tw-bg-elevated`; yellow is an accent, not a background.
- Wordmark spelling is exactly **TERMAL WAVE** (not “Thermal”).
- Official credits, font license, geographic source, and AI-usage declaration: see `CREDITS.md`.

## AI_USAGE

AI-assisted concept studies were used while exploring the mark. The shipping icon, wordmark, and banners are original pixel-art constructed on a fixed grid from Natural Earth country polygons and this palette. Declare that AI assistance in the project presentation and in `CREDITS.md`. Do not put an “AI-generated” watermark on the graphics themselves.
