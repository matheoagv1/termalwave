// anto design system: css and color helpers
//
// small browser-side readers for the token surface: a resolved token value
// for inputs and canvases that need the computed value, hex flattening for
// color inputs, luminance text for dynamic fills, and var() resolution with
// a fallback for values that cross into canvas or webgl.

/** read the resolved value of a css custom property from <html>. returns
 *  the trimmed string, or '' when the property is unset. use it to feed a
 *  token value into a control that needs the computed value (a color
 *  input, a canvas) rather than the var() reference */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * convert any css color string (hex, rgb(), a var() that already resolved
 * to a color, a named color) into '#rrggbb'. returns '#000000' when the
 * value cannot be resolved or is not an opaque color. uses a throwaway
 * canvas because the browser normalizes the fillStyle through its own
 * color parser, which is the only reliable way to flatten a var() or
 * color-mix() into a hex an <input type="color"> can display
 */
export function toHex(color: string): string {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const resolved = ctx.fillStyle;
  // the browser normalizes hex through its own parser; anything it returns
  // as a non-hex color (rgb(), a color-mix()) has no hex form to hand a
  // color input, so fall back to opaque black rather than an invalid value.
  return typeof resolved === 'string' && resolved.startsWith('#') ? resolved : '#000000';
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// foreground for an arbitrary fill: black or white by relative luminance.
// dynamic fills (api-driven colors, canvases) cannot use a fixed token,
// a yellow fill and a dark blue fill need opposite text.
export function readableOn(hex: string): string {
  const rgb = parseHex(hex ?? '');
  if (!rgb) return '#fff';
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000' : '#fff';
}

// resolves var(--token) against the active theme, passes literals through,
// falls back when unresolvable. canvas and webgl reject var() outright,
// so any token crossing into them goes through here first.
export function resolveColor(value: string | undefined | null, fallback: string): string {
  if (value) {
    if (!value.startsWith('var(')) return value;
    const resolved = cssVar(value.slice(4).replace(')', '').trim());
    if (resolved) return resolved;
  }
  return fallback;
}
