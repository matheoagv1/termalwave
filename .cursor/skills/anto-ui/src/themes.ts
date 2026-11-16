// anto design system: reference themes
//
// two full themes (kona, skeuo) that ship with the kit as importable data
// and apply functions, not as built-in palettes. they are demonstrations
// of the defineTheme override surface: how much a single defineTheme call
// can change without touching a component. import them, call the apply
// function once at startup, then setTheme(name) exactly like a built-in.
//
// each theme exports its palette on its own (KONA_COLORS, SKEUO_COLORS) so
// setPalette can layer just the colors on top of the shape, elevation,
// motion and typography of some other theme. keeping the colors separate from the
// structural axes is what lets the appearance screen mix a look and a scheme.

import { defineTheme, type ThemeTokens } from './theme.js';

// kona: warm, soft-edged, with real depth. layered on top of the new-light
// base so only the deltas are written. the border tokens are deliberately
// deeper than a soft palette would pick, because anto components draw a
// bare one-pixel border with no elevation behind it, so the border itself
// has to carry enough contrast to read as an edge rather than a tint.
export const KONA_COLORS: ThemeTokens = {
  bg:      '#fdf6f4',
  bg2:     '#f8ece9',
  bg3:     '#f1ded9',
  text:    '#3a2129',
  text2:   '#6b4a52',
  text3:   '#a17f86',
  accent:  '#c2447a',
  accent2: '#9e3363',
  border:  '#d4a3ad',
  border2: '#e0bcc2',
  ok:      '#3f7a4f',
  warn:    '#a8701f',
  err:     '#a83a30',
  hover:   '#f4e3e0',
  modalBg: '#fffaf9',
};

export function applyKonaTheme(): void {
  defineTheme('kona', {
    base: 'new-light',
    colors: KONA_COLORS,
    // tiered radius: cards and modals read rounder than buttons and inputs.
    // radiusDot is left unset so status dots stay square, since that square
    // shape carries meaning rather than decoration.
    shape: {
      radius:      '0.75rem',
      radiusSm:    '0.5rem',
      radiusLg:    '1.25rem',
      radiusPill:  '999px',
      radiusBtn:   '0.625rem',
      radiusInput: '0.625rem',
      radiusCard:  '1.25rem',
      radiusModal: '1.5rem',
    },
    // near-neutral shadow color with only a faint warm tint: a saturated
    // accent-hue shadow reads as a colored glow rather than depth, which
    // is the opposite of what elevation is for.
    elevation: {
      elevation1:     '0 1px 3px rgba(45,20,28,.14), 0 1px 2px rgba(45,20,28,.10)',
      elevation2:     '0 4px 16px rgba(45,20,28,.18), 0 2px 6px rgba(45,20,28,.10)',
      elevation3:     '0 12px 32px rgba(45,20,28,.22), 0 4px 12px rgba(45,20,28,.12)',
      elevationInset: 'inset 0 1px 3px rgba(45,20,28,.12)',
    },
    motion: { ease: 'cubic-bezier(.32,.72,.35,1)' },
    // serif headings over a sans body, the display/body split with system
    // fallbacks so nothing breaks if the webfonts are not present.
    typography: {
      fontUi:      "'Nunito', 'Quicksand', system-ui, sans-serif",
      fontDisplay: "'Fraunces', Georgia, serif",
      onAccent:    '#fff',
    },
    // no focus override: --focus-outline already reads the accent, so it
    // re-colors to the rose of kona for free.
  });
}

// skeuo: a from-scratch skeuomorphic palette (mediterranean blue, olive,
// limestone) modeled on a sibling design system, proof the override
// surface can reach a structurally different language, not just a recolor.
// both border tokens are a step darker than the own values of the source system,
// because anto components rely on the border to define an edge where that
// system relies on a shadow behind every surface.
export const SKEUO_COLORS: ThemeTokens = {
  bg:      '#f6f3ec',
  bg2:     '#ede7db',
  bg3:     '#e4dfd4',
  text:    '#0e2036',
  text2:   '#2b3b52',
  text3:   '#b9b2a2',
  accent:  '#0b3d91',
  accent2: '#123e6b',
  border:  '#a89873',
  border2: '#c4b89a',
  ok:      '#4c6b3e',
  warn:    '#8a6a1e',
  err:     '#9a3324',
  hover:   '#efebe2',
  modalBg: '#ffffff',
};

export function applySkeuoTheme(): void {
  defineTheme('skeuo', {
    colors: SKEUO_COLORS,
    // one small radius retiers every component token, since each aliases
    // --radius. radiusDot stays unset for the same reason as kona.
    shape: { radius: '0.125rem' },
    elevation: {
      elevation1:     '0 2px 10px rgba(43,30,18,.10)',
      elevation2:     '0 3px 6px rgba(43,30,18,.10), 0 16px 34px rgba(43,30,18,.12)',
      elevation3:     '0 1px 2px rgba(43,30,18,.06), 0 10px 24px rgba(43,30,18,.08)',
      elevationInset: 'inset 0 1px 4px rgba(43,30,18,.16), inset 0 0 0 1px rgba(43,30,18,.02)',
    },
    motion: { ease: 'cubic-bezier(.4,0,.2,1)' },
    typography: {
      fontUi:      "'Inter', -apple-system, 'Segoe UI', sans-serif",
      fontDisplay: "'Cormorant Garamond', ui-serif, 'Times New Roman', serif",
      onAccent:    '#ffffff',
    },
    // a shadow halo in place of the hard outline, so the focus ring sits
    // flush against the softer surfaces this theme draws.
    focus: {
      focusOutline: 'none',
      focusShadow:  '0 0 0 0.1875rem rgba(30,111,136,.32)',
    },
    // the one legitimate extraCss use: a page-level grain texture, not a
    // component token. a body background-image is not something any widget
    // styles, so the escape hatch is the right home for it.
    extraCss: `
      & body {
        background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTIwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44NScgbnVtT2N0YXZlcz0nMicgc3RpdGNoVGlsZXM9J3N0aXRjaCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbHRlcj0ndXJsKCUyM24pJyBvcGFjaXR5PScwLjA1Jy8+PC9zdmc+");
        background-repeat: repeat;
      }
    `,
  });
}
