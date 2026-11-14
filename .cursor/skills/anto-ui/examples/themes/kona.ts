// Kona — a reference theme for @xplshn/anto-ui (SPEC.md §6.4).
//
// Warm, soft-edged, with real depth. Built entirely through defineTheme's
// typed axes on top of the `new-light` base palette — no component file
// touched, no extraCss needed. This is the theme SPEC §6 uses as its own
// "single custom theme" example: read this file alongside that section.
//
// KONA_COLORS is exported on its own so the palette is usable independently
// of the rest of this theme — `setPalette(KONA_COLORS)` (SPEC §6.2) layers
// just these 15 colors on top of whatever theme is structurally active,
// decoupled from Kona's radius/elevation/motion/typography choices.
//
// Call `applyKonaTheme()` once at app startup (before the first paint that
// needs it), then `setTheme('kona')`.

import { defineTheme, type ThemeTokens } from '@xplshn/anto-ui';

export const KONA_COLORS: ThemeTokens = {
  bg:      '#fdf6f4',
  bg2:     '#f8ece9',
  bg3:     '#f1ded9',
  text:    '#3a2129',
  text2:   '#6b4a52',
  text3:   '#a17f86',
  accent:  '#c2447a',
  accent2: '#9e3363',
  // Deliberately deeper than a first pass at "soft" would pick: anto's
  // components (Input, Tag, Divider, ...) draw a bare 1px border with no
  // elevation to back it up, so the border itself has to carry enough
  // contrast to read as an edge, not just a color choice.
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
    // `new-light`'s neutrals are already softer than original-light's
    // pure #fff/#000/#00f — start there and only override the deltas.
    base: 'new-light',
    colors: KONA_COLORS,

    // Soft-edged: real radius everywhere, tiered so cards/modals read
    // rounder than buttons/inputs. radiusDot deliberately left unset —
    // status dots stay square (SPEC §1.1); Kona rounds decoration, not
    // meaning.
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

    // "Real depth" — the default theme has none (contrast-only). Neutral,
    // near-black shadow color with only a faint warm tint: a saturated
    // rgba(accent-hue, ...) shadow reads as a colored glow around every
    // raised surface rather than depth, which is the opposite of what
    // this axis is for — real shadows stay close to neutral regardless
    // of how colorful the palette above them is.
    elevation: {
      elevation1:     '0 1px 3px rgba(45,20,28,.14), 0 1px 2px rgba(45,20,28,.10)',
      elevation2:     '0 4px 16px rgba(45,20,28,.18), 0 2px 6px rgba(45,20,28,.10)',
      elevation3:     '0 12px 32px rgba(45,20,28,.22), 0 4px 12px rgba(45,20,28,.12)',
      elevationInset: 'inset 0 1px 3px rgba(45,20,28,.12)',
    },

    motion: {
      ease: 'cubic-bezier(.32,.72,.35,1)', // soft ease-out, not linear
    },

    // The serif/sans display pairing SPEC §6.4 promises: fontDisplay
    // (headingPage/headingSection only, §2.6) carries the serif, fontUi
    // (every other component) stays sans. System fallbacks so nothing
    // breaks if the webfonts aren't loaded — swap for self-hosted files
    // if this theme ships to production.
    typography: {
      fontUi:      "'Nunito', 'Quicksand', system-ui, sans-serif",
      fontDisplay: "'Fraunces', Georgia, serif",
      onAccent:    '#fff', // ~4.8:1 against accent — passes AA for Btn's bold text
    },

    // No focus override: --focus-outline already reads var(--accent), so
    // it re-colors to Kona's rose for free. A softer halo is one call
    // away (`focus: { focusOutline: 'none', focusShadow: '...' }`) if a
    // future revision wants Skeuo's approach instead of the hard ring.
  });
}
