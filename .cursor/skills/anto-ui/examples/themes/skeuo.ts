// Skeuo — a reference theme for @xplshn/anto-ui (SPEC.md §6.4), modeled on
// the sibling `@xplshn/creta-ui` design system (Mediterranean blue/olive/
// limestone, layered warm shadows, serif headings). Every color, radius,
// shadow, easing, font, and focus-ring value below is copied from creta's
// actual tokens.css, not guessed — this is the "how close can the override
// surface get to a structurally different sibling system" proof.
//
// SKEUO_COLORS is exported on its own for the same reason KONA_COLORS is
// (examples/themes/kona.ts) — `setPalette(SKEUO_COLORS)` (SPEC §6.2)
// applies just this palette on top of any theme's structural axes.
//
// What came free through anto-ui's token surface (no component touched):
//   - the whole color palette (aegean/olive/limestone → colors)
//   - near-zero radius (creta's --radius-sm is 2px, not literally 0 — this
//     theme reproduces that exactly, it isn't the suckless default's 0)
//   - creta's five shadow recipes → elevation1-3 + elevationInset
//   - creta's cubic-bezier easing → motion.ease
//   - creta's serif/sans font pairing → typography (fontDisplay/fontUi)
//   - creta's shadow-halo focus ring → focus (outline replaced by shadow)
//   - creta's body grain texture → extraCss (the one legitimate use of the
//     escape hatch: a page-level background-image isn't a component token)
//
// What did NOT come free — both are anto's structural motion invariant
// (SPEC §1.2, no exceptions for any theme), not something a theme can
// reach around:
//   - creta's `button:active { transform: translateY(1px) }` press-down.
//     anto's Btn has no positional/transform animation path at all; this
//     theme does not attempt a substitute.
//   - creta's Switch slides its knob via an animated `left` offset. anto's
//     ToggleSwitch (§4.24) is already built to stay off positional
//     properties — it repositions the knob instantly via `justify-content`,
//     no transition on that property. Under this theme the knob still
//     *looks* like creta's (same near-zero radius, same recessed track via
//     elevationInset) — it just doesn't slide.
// One more gap, not inherited from creta but worth flagging here: anto's
// Btn reads elevation1 as a static boxShadow with no hover variant coded
// (components.tsx's BTN_BASE never swaps it), where creta's real button
// shadow intensifies on hover. This theme's elevation1 is therefore
// static in a way creta's isn't — a component-level gap, not a token one.
//
// One deliberate deviation from creta's literal values, found only after
// seeing this theme rendered against real anto components: creta's
// --border-default/--color-stone-200 are low-contrast by design, because
// creta backs almost every bordered surface with one of its five shadow
// recipes too — the shadow carries definition, the border is a quiet
// second layer. anto's component set doesn't share that assumption: Input,
// Tag, Divider, and others draw a bare 1px border with no elevation behind
// it, so a border that's barely visible against bg here just reads as
// missing, not restrained. Both border tokens below are pulled from
// creta's own palette but darkened a step from creta's literal choice for
// that reason — an anto-specific tuning, not a creta value.
//
// Call `applySkeuoTheme()` once at app startup, then `setTheme('skeuo')`.

import { defineTheme, type ThemeTokens } from '@xplshn/anto-ui';

export const SKEUO_COLORS: ThemeTokens = {
  bg:      '#f6f3ec', // creta --surface-canvas (limestone-50)
  bg2:     '#ede7db', // creta --surface-sunken (limestone-100)
  bg3:     '#e4dfd4', // creta --color-stone-200
  text:    '#0e2036', // creta --text-primary (ink-900)
  text2:   '#2b3b52', // creta --text-secondary (ink-700)
  text3:   '#b9b2a2', // creta --text-muted (stone-400)
  accent:  '#0b3d91', // creta --accent-primary (aegean-900)
  accent2: '#123e6b', // creta --accent-primary-hover (aegean-700)
  border:  '#a89873', // darkened from creta --border-default — see header comment
  border2: '#c4b89a', // darkened from creta --color-stone-200 — see header comment
  ok:      '#4c6b3e', // creta --state-success
  warn:    '#8a6a1e', // creta --state-warning
  err:     '#9a3324', // creta --state-danger
  hover:   '#efebe2', // creta --color-stone-100
  modalBg: '#ffffff', // creta --surface-card (chalk-0)
};

export function applySkeuoTheme(): void {
  defineTheme('skeuo', {
    // No `base` — this is a from-scratch palette, not a built-in + deltas.
    colors: SKEUO_COLORS,

    // creta's radius-sm (2px), applied uniformly. Every component token
    // (radiusBtn, radiusCard, radiusPill, ...) aliases --radius by
    // default (tokens.css), so one value here retiers all of them at
    // once — matching how creta actually uses radius-sm almost
    // everywhere itself. radiusDot stays unset: square status dots are
    // a meaning, not a decoration (SPEC §1.1), and creta has no status
    // dots to compare against anyway.
    shape: {
      radius: '0.125rem',
    },

    // creta's five real shadow recipes. elevation1/2/3 map to creta's
    // float/raised/card tiers (not literally its own 1/2/3 — creta
    // doesn't number its shadows the same way anto does); elevationInset
    // maps directly to creta's --shadow-inset.
    elevation: {
      elevation1:     '0 2px 10px rgba(43,30,18,.10)',                                  // creta --shadow-float
      elevation2:     '0 3px 6px rgba(43,30,18,.10), 0 16px 34px rgba(43,30,18,.12)',   // creta --shadow-raised
      elevation3:     '0 1px 2px rgba(43,30,18,.06), 0 10px 24px rgba(43,30,18,.08)',   // creta --shadow-card
      elevationInset: 'inset 0 1px 4px rgba(43,30,18,.16), inset 0 0 0 1px rgba(43,30,18,.02)', // creta --shadow-inset
    },

    motion: {
      ease: 'cubic-bezier(.4,0,.2,1)', // creta --ease-standard
    },

    typography: {
      fontUi:      "'Inter', -apple-system, 'Segoe UI', sans-serif",       // creta --font-sans-ui
      fontDisplay: "'Cormorant Garamond', ui-serif, 'Times New Roman', serif", // creta --font-serif-display
      onAccent:    '#ffffff', // creta --text-inverse
    },

    // creta's shadow-halo focus ring, in place of anto's hard outline.
    focus: {
      focusOutline: 'none',
      focusShadow:  '0 0 0 0.1875rem rgba(30,111,136,.32)', // creta --focus-ring-shadow (athens-500)
    },

    // The one legitimate extraCss use: a page-level texture, not a
    // component token. Identical data URI to creta's --texture-grain
    // (fractal-noise SVG filter, 5% opacity) — copied verbatim since
    // it's the same visual asset, not re-derived.
    extraCss: `
      & body {
        background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTIwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44NScgbnVtT2N0YXZlcz0nMicgc3RpdGNoVGlsZXM9J3N0aXRjaCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbHRlcj0ndXJsKCUyM24pJyBvcGFjaXR5PScwLjA1Jy8+PC9zdmc+");
        background-repeat: repeat;
      }
    `,
  });
}
