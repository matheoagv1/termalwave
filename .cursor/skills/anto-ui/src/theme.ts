// anto design system: themes
//
// the 5 built-in palettes already live in tokens.css as
// [data-theme="..."] blocks (see the color token reference in SPEC.md),
// this file is the runtime layer on top: switching themes, reading the
// current one reactively, and registering new palettes with colors and the
// structural axes (shape, elevation, motion, typography) tokens.css added
// alongside them, without touching tokens.css or forking a component
//
// two ways in, same underlying mechanism:
//   registerTheme(name, colorTokens): colors only, unchanged since v0.1
//   defineTheme(name, { colors, shape, elevation, motion, typography })
//     is the full surface. registerTheme is defineTheme({ colors }) under
//     the hood, so there is exactly one code path, not two to keep in sync

import * as React from 'react';

export const THEMES = [
  'original-light',
  'new-light',
  'original-dark',
  'dark', // alias: new-dark
  'red-dark',
] as const;

export type ThemeName = (typeof THEMES)[number] | (string & {});

const DEFAULT_THEME: ThemeName = 'original-light';
const STORAGE_KEY = 'anto-theme';

/** set the active theme by writing `data-theme` on `<html>` */
export function setTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(STORAGE_KEY, name); } catch { /* storage may be unavailable */ }
}

/** read the active theme (falls back to the persisted or default one) */
export function getTheme(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.documentElement.dataset.theme
    ?? (() => { try { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME; } catch { return DEFAULT_THEME; } })();
}

/**
 * React hook: current theme name + setter, re-rendering on changes made
 * through this hook (does not observe external `data-theme` mutations, so
 * route all theme changes through `setTheme`/this hook for consistency)
 */
export function useTheme(): [ThemeName, (name: ThemeName) => void] {
  const [theme, setThemeState] = React.useState<ThemeName>(getTheme);
  const set = React.useCallback((name: ThemeName) => {
    setTheme(name);
    setThemeState(name);
  }, []);
  React.useEffect(() => { setTheme(theme); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [theme, set];
}

// --- color tokens (unchanged shape from v0.1) ---

export type ThemeTokens = Partial<{
  bg: string; bg2: string; bg3: string;
  text: string; text2: string; text3: string;
  accent: string; accent2: string;
  border: string; border2: string;
  ok: string; warn: string; err: string;
  hover: string; modalBg: string;
}>;

// --- structural axes (new) ---
//
// every field here is optional and additive: omit it and the theme
// inherits whatever :root already has (its own default, or another theme
// value if that was set globally instead). see the shape, elevation,
// motion-curve and ui-font tokens block in tokens.css for the full default
// set and the reasoning behind --radius-dot staying unaliased

export type ThemeShape = Partial<{
  radius: string; radiusSm: string; radiusLg: string; radiusPill: string;
  radiusBtn: string; radiusInput: string; radiusCard: string; radiusModal: string;
  radiusTag: string;
  /** square by design (the status dot rule): set this only if the theme
   *  really means to make status dots round, not as a side effect of
   *  `radius` */
  radiusDot: string;
  /** panel() default padding (components.tsx), a density axis independent
   *  of radius/elevation and also overridable per call site, this only
   *  changes what a bare panel() call falls back to */
  panelPadding: string;
}>;

export type ThemeElevation = Partial<{
  elevation1: string; elevation2: string; elevation3: string;
  /** the "sunken surface" shadow for form fields and slider tracks, kept
   *  separate from elevation1-3 (raised) because recessed and raised are
   *  never the same shadow recipe */
  elevationInset: string;
}>;

export type ThemeMotion = Partial<{
  /** the easing half of every transition token, swap this alone to change
   *  every component motion curve without retyping duration */
  ease: string;
  transitionFast: string;
  transitionBase: string;
}>;

export type ThemeTypography = Partial<{
  /** interface chrome font, code/pre stay on --font-mono regardless, see
   *  tokens.css and the textMono comment in components.tsx */
  fontUi: string;
  /** headingPage/headingSection only, aliases fontUi by default, set this
   *  alone for a display/body pairing (kona serif headings over its sans
   *  body) without changing every other component font */
  fontDisplay: string;
  /** text color drawn on top of a solid --accent fill (primary button,
   *  active sidebar item, StatusBar) */
  onAccent: string;
  /** unitless multiplier every --text-* token composes (tokens.css), the
   *  value 1.125 means 12.5% bigger than default and not a fixed size, see
   *  setTextScale for the live-control version of this same axis, and it
   *  deliberately does not touch spacing/radius/icon size: a font-size
   *  control, not a full-interface zoom */
  textScale: string;
}>;

export type ThemeFocus = Partial<{
  focusOutline: string;
  /** off by default (the hard outline is the only ring), set this for a
   *  soft shadow-halo focus style instead of, or in addition to, the
   *  outline, see the --focus-shadow comment in tokens.css */
  focusShadow: string;
}>;

export interface FullTheme {
  /** start from one of the 5 built-in palette color values, then layer
   *  `colors` on top, writing only the deltas instead of all 15 color
   *  tokens from scratch. custom (registerTheme) base themes are not
   *  resolvable this way since their values live in an injected
   *  stylesheet rather than this lookup table, so base only accepts the 5
   *  built-ins */
  base?: (typeof THEMES)[number];
  colors?: ThemeTokens;
  shape?: ThemeShape;
  elevation?: ThemeElevation;
  motion?: ThemeMotion;
  typography?: ThemeTypography;
  focus?: ThemeFocus;
  /**
   * escape hatch for the rare thing that is not a component token at all,
   * the creta body grain texture is the motivating example. raw css,
   * scoped under `[data-theme="name"]` automatically (write bare
   * declarations, not a full ruleset) plus any selector you prefix with
   * `&` for `body`/pseudo-element rules that must live outside the
   * root own declaration block, and reach for the typed fields above
   * first, this bypasses the token-only discipline every component
   * follows, so it is meant for genuine one-offs, not a second way to
   * set colors
   */
  extraCss?: string;
}

const COLOR_KEY: Record<keyof ThemeTokens, string> = {
  bg: '--bg', bg2: '--bg2', bg3: '--bg3',
  text: '--text', text2: '--text2', text3: '--text3',
  accent: '--accent', accent2: '--accent2',
  border: '--border', border2: '--border2',
  ok: '--ok', warn: '--warn', err: '--err',
  hover: '--hover', modalBg: '--modal-bg',
};

const SHAPE_KEY: Record<keyof ThemeShape, string> = {
  radius: '--radius', radiusSm: '--radius-sm', radiusLg: '--radius-lg', radiusPill: '--radius-pill',
  radiusBtn: '--radius-btn', radiusInput: '--radius-input', radiusCard: '--radius-card',
  radiusModal: '--radius-modal', radiusTag: '--radius-tag', radiusDot: '--radius-dot',
  panelPadding: '--panel-padding',
};

const ELEVATION_KEY: Record<keyof ThemeElevation, string> = {
  elevation1: '--elevation-1', elevation2: '--elevation-2', elevation3: '--elevation-3',
  elevationInset: '--elevation-inset',
};

const MOTION_KEY: Record<keyof ThemeMotion, string> = {
  ease: '--ease', transitionFast: '--transition-fast', transitionBase: '--transition-base',
};

const TYPOGRAPHY_KEY: Record<keyof ThemeTypography, string> = {
  fontUi: '--font-ui', fontDisplay: '--font-display', onAccent: '--on-accent',
  textScale: '--text-scale',
};

const FOCUS_KEY: Record<keyof ThemeFocus, string> = {
  focusOutline: '--focus-outline', focusShadow: '--focus-shadow',
};

// the 5 built-in palette literal color values, kept in sync with
// tokens.css by hand (there are only 15 tokens x 5 palettes, a build
// step to derive this from the css was more machinery than the table is
// worth), `base` reads from here so a new theme can inherit a full
// palette without a cascade trick that only one [data-theme] value could
// ever satisfy at a time
const BASE_PALETTES: Record<(typeof THEMES)[number], Required<ThemeTokens>> = {
  'original-light': {
    bg: '#fff', bg2: '#f5f5f5', bg3: '#e8e8e8', text: '#000', text2: '#444', text3: '#888',
    accent: '#00f', accent2: '#0000cc', border: '#000', border2: '#ccc',
    ok: '#060', warn: '#c90', err: '#c00', hover: '#fcfcfc', modalBg: '#fff',
  },
  'new-light': {
    bg: '#f8f8fb', bg2: '#eeeef4', bg3: '#e0e0ea', text: '#111118', text2: '#44444e', text3: '#888899',
    accent: '#4a54d4', accent2: '#3340b8', border: '#c0c0cc', border2: '#d4d4de',
    ok: '#1a8a44', warn: '#b07800', err: '#c01a1a', hover: '#e4e4ec', modalBg: '#f8f8fb',
  },
  'original-dark': {
    bg: '#0d0d0f', bg2: '#151517', bg3: '#1e1e22', text: '#ececf0', text2: '#9090a0', text3: '#50505a',
    accent: '#4466ff', accent2: '#2244cc', border: '#333340', border2: '#22222a',
    ok: '#33bb66', warn: '#ddaa22', err: '#ee4444', hover: '#1c1c22', modalBg: '#151517',
  },
  dark: {
    bg: '#111114', bg2: '#18181c', bg3: '#222228', text: '#e8e8ee', text2: '#9999aa', text3: '#55555f',
    accent: '#7c85f5', accent2: '#5a62d0', border: '#333340', border2: '#25252e',
    ok: '#4cd67a', warn: '#f5c842', err: '#f55050', hover: '#1e1e24', modalBg: '#18181c',
  },
  'red-dark': {
    bg: '#0a0000', bg2: '#1a0505', bg3: '#2a0808', text: '#f5d4d2', text2: '#d9a8a5', text3: '#b88683',
    accent: '#ff6b63', accent2: '#d94d45', border: '#d94d45', border2: '#52201c',
    ok: '#ff6b63', warn: '#ffdd55', err: '#ff3b33', hover: '#2a0808', modalBg: '#1a0505',
  },
};

let injected: HTMLStyleElement | null = null;

function ensureSheet(): HTMLStyleElement {
  if (!injected) {
    injected = document.createElement('style');
    injected.setAttribute('data-anto-custom-themes', '');
    document.head.appendChild(injected);
  }
  return injected;
}

function declsFor<K extends string>(keyMap: Record<K, string>, values: Partial<Record<K, string>> | undefined): string[] {
  if (!values) return [];
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `  ${keyMap[k as K]}: ${v};`);
}

/**
 * register (or fully define) a theme at runtime, no edit to tokens.css
 * needed, it injects a `[data-theme="name"]` rule, the same mechanism the
 * 5 built-ins use, so every component picks it up for free. call once at
 * app startup, then setTheme(name) to activate it
 *
 * covers every axis a theme can touch: colors (optionally inherited from
 * a built-in palette via `base`), shape (radius family), elevation
 * (shadow family), motion (easing/duration), typography (ui font +
 * on-accent text color), focus-ring style and, as a last resort,
 * `extraCss` for anything genuinely outside the token surface
 */
export function defineTheme(name: string, theme: FullTheme): void {
  if (typeof document === 'undefined') return;
  const sheet = ensureSheet();

  const resolvedColors: ThemeTokens = theme.base
    ? { ...BASE_PALETTES[theme.base], ...theme.colors }
    : (theme.colors ?? {});

  const decls = [
    ...declsFor(COLOR_KEY, resolvedColors),
    ...declsFor(SHAPE_KEY, theme.shape),
    ...declsFor(ELEVATION_KEY, theme.elevation),
    ...declsFor(MOTION_KEY, theme.motion),
    ...declsFor(TYPOGRAPHY_KEY, theme.typography),
    ...declsFor(FOCUS_KEY, theme.focus),
  ].join('\n');

  sheet.textContent += `\n[data-theme="${name}"] {\n${decls}\n}\n`;
  if (theme.extraCss) {
    sheet.textContent += `\n${theme.extraCss.replace(/&/g, `[data-theme="${name}"]`)}\n`;
  }
}

/**
 * register a 6th+ color palette at runtime, the color-only subset of
 * defineTheme, kept as its own export because most reskins only ever
 * touch color, equivalent to defineTheme(name, { colors: tokens })
 */
export function registerTheme(name: string, tokens: ThemeTokens): void {
  defineTheme(name, { colors: tokens });
}

/**
 * override just the accent color of the active theme, e.g. to match a
 * brand color without defining a whole palette. it sets an inline style on
 * `<html>`, so it beats the stylesheet regardless of which theme is
 * active. pass null to clear the override and fall back to the accent of
 * the active theme
 */
export function setAccent(color: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (color === null) {
    root.removeProperty('--theme-accent');
    root.removeProperty('--accent');
  } else {
    root.setProperty('--theme-accent', color);
    root.setProperty('--accent', color);
  }
}

/**
 * override just the global radius of the active theme, the same
 * single-axis tweak without a whole theme pattern as setAccent, for the
 * other override people reach for most (e.g. a live rounded corners
 * toggle in a settings screen), pass null to clear it
 * component-specific radius tokens (--radius-btn etc.) still cascade from
 * --radius unless a theme pinned them individually
 */
export function setRadius(value: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty('--radius');
  else root.setProperty('--radius', value);
}

/**
 * override just the text-size multiplier of the active theme, the third
 * single-axis tweak setter, same pattern as setAccent/setRadius, for the
 * axis a live A- / A+ control reaches for. every --text-* token composes
 * --text-scale (tokens.css), so this scales every component font size at
 * once, it does not touch spacing, radius, border or icon size: a
 * font-size control, not a full-interface zoom, pass a unitless
 * multiplier (1.125), or null to clear back to the value of the active
 * theme (default 1)
 */
export function setTextScale(value: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty('--text-scale');
  else root.setProperty('--text-scale', value);
}

/**
 * override the interface-chrome font of the active theme, affects every
 * component except headingPage/headingSection (those read --font-display,
 * setFontDisplay below) and code/pre (always --font-mono, never
 * themeable, see the textMono comment in components.tsx). pass a full
 * font-family stack (system fallbacks included, same as any --font-ui
 * value in a theme definition), or null to clear
 */
export function setFontUi(value: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty('--font-ui');
  else root.setProperty('--font-ui', value);
}

/**
 * override just headingPage/headingSection font, the other half of the
 * display/body split (see setFontUi). independent on purpose: picking a
 * display face should not force every button/input/label onto it too
 */
export function setFontDisplay(value: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty('--font-display');
  else root.setProperty('--font-display', value);
}

/**
 * apply a color palette independently of the active theme structural axes
 * (shape/elevation/motion/typography/focus), the decoupling asked for from
 * the start (see the opening of the theming section in SPEC.md: "themes
 * able to change more things... without redoing the entire library")
 * setAccent already did this for one color, setPalette does it for the
 * full 15-token set in one call, so e.g. the skeuo shadows/radius/serif
 * can stay active while the original-dark colors (or any custom palette)
 * sit on top
 *
 * accepts three shapes:
 * - one of the 5 built-in theme names, reads its literal values from the
 *   same BASE_PALETTES table base: uses (the existing name limit applies
 *   here too: only the 5 built-ins are resolvable by name, since the
 *   colors of a registerTheme theme live in an injected stylesheet, not
 *   this lookup table)
 * - a ThemeTokens object, any custom palette applied directly. the two
 *   reference themes (kona, skeuo) export their own colors as a named
 *   constant (KONA_COLORS, SKEUO_COLORS) specifically so they can be
 *   passed here, decoupled from the rest of that theme file
 * - null, clears the override, back to the colors of the active theme
 *
 * like setAccent/setRadius, this writes inline styles on `<html>`, so it
 * beats the stylesheet regardless of which theme is active underneath
 */
function warnUnresolvedPalette(name: string): ThemeTokens {
  if (typeof console !== 'undefined') {
    console.warn(
      `setPalette('${name}'): not one of the 5 built-in names (${THEMES.join(', ')}), ` +
      `so nothing was applied. A custom theme's colors live in an injected stylesheet, ` +
      `not a name-resolvable table. Pass its ThemeTokens object directly instead ` +
      `(e.g. setPalette(KONA_COLORS), not setPalette('kona')).`
    );
  }
  return {};
}

export function setPalette(source: ThemeName | ThemeTokens | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (source === null) {
    for (const cssVar of Object.values(COLOR_KEY)) root.removeProperty(cssVar);
    root.removeProperty('--theme-accent');
    return;
  }
  const tokens: ThemeTokens = typeof source === 'string'
    ? (BASE_PALETTES[source as (typeof THEMES)[number]] ?? warnUnresolvedPalette(source))
    : source;
  for (const [key, value] of Object.entries(tokens)) {
    if (value === undefined) continue;
    root.setProperty(COLOR_KEY[key as keyof ThemeTokens], value as string);
  }
}
