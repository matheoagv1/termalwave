// anto design system, react components
//
// all colors, sizes, shape, and motion reference css custom properties
// from tokens.css; no px, no hardcoded colors, no hardcoded radius
// interface text reads --font-ui (aliases to --font-mono by default,
// see the shape/elevation/motion/ui-font tokens in tokens.css) so a theme
// can swap the ui face without touching code/pre, which stay literally mono
//
import React from 'react';
import { createPortal } from 'react-dom';
import { haptic } from './haptics.js';
import { useMediaQuery } from './hooks.js';
import { readableOn } from './css.js';

// shared size tables
//
const SIZE_PAD: Record<string, string> = {
  sm: 'var(--space-1) var(--space-2)',
  md: 'var(--space-2) var(--space-3)',
  lg: 'var(--space-3) var(--space-4)',
};
const SIZE_FONT: Record<string, string> = {
  sm: 'var(--text-xs)',
  md: 'var(--text-sm)',
  lg: 'var(--text-base)',
};

// useFocusBorder
//
// returns borderColor + focus/blur handlers; avoids duplicating this logic
// in every input-like component
function useFocusBorder(error?: string | null): {
  borderColor: string;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [focused, setFocused] = React.useState(false);
  return {
    borderColor: error ? 'var(--err)' : focused ? 'var(--accent)' : 'var(--border)',
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
  };
}

// --- Style helpers ---
//
// plain style objects/functions, not components: nothing here has a dom
// structure or event handling of its own, so there is nothing a component
// wrapper would add over just spreading the object into a `style` prop
// every value is a css custom property reference, no px, no hardcoded
// colors, same invariant every component in this file follows

// named textMono for historical reasons (every component used to read
// --font-mono directly); it now reads --font-ui, the same token every
// other component in this file uses. reach for --font-mono directly
// (not this helper) when you specifically need guaranteed monospace
// regardless of theme, e.g. aligning a column of numbers
export const textMono: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
};

export const textMuted: React.CSSProperties = {
  ...textMono,
  fontSize: 'var(--text-xs)',
  color: 'var(--text3)',
};

export const textSecondary: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text2)',
};

/** visually hidden but still reachable by screen readers, for a label
 *  that needs to exist (a bare checkbox with no visible caption: "select
 *  row 3") without taking up layout space next to the control
 *  the standard clip-based technique, not `display: none` (which removes
 *  it from the accessibility tree entirely, defeating the point) */
export const srOnly: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px',
  padding: 0, margin: '-1px', overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};

export const headingPage: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-lg)',
  fontWeight: 700,
  margin: 0,
};

export const headingSection: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-sm)',
  fontWeight: 700,
  margin: '0 0 var(--space-2)',
};

export const stack = (gap: string = 'var(--space-4)'): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
});

export const row = (gap: string = 'var(--space-2)'): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap,
  flexWrap: 'wrap',
});

/** a page root container: a stack capped to a reading-friendly width,
 *  so content does not stretch edge-to-edge on a wide viewport */
export const pageRoot = (maxWidth: string = '48rem'): React.CSSProperties => ({
  ...stack('var(--space-5)'),
  maxWidth,
});

/** boxed section: a bordered container for grouping related controls
 *  padding defaults to the themeable `--panel-padding` (the density
 *  axis); pass an explicit value to override just this call site */
export const panel = (padding: string = 'var(--panel-padding)'): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  border: 'var(--border-width) solid var(--border2)',
  borderRadius: 'var(--radius-card)',
  padding,
});

// --- Constraint-based layout helpers ---
//
// the design doc carries the full rationale. short version: these lean
// on flexbox/grid intrinsic-sizing math (min/max-content, flex-grow/
// shrink, auto-fit) instead of viewport media queries or a JS
// ResizeObserver loop. two reasons, not one: it is the mechanism every
// non-web toolkit this kit targets (Qt, GTK, terminal, see the file
// header above) already has a direct equivalent for, and it reacts to the
// actual container space rather than the viewport, so it stays correct
// nested inside a sidebar, a modal, or a narrow panel, cases where a
// media-query breakpoint silently gives the wrong answer

/**
 * marks a flex child as allowed to shrink below its own content size
 * the flexbox default `min-width: auto` on a flex item means it refuses
 * to shrink past its intrinsic content width, the classic bug where one
 * long unbroken string (a filename, a table cell) blows out an entire
 * row instead of that cell shrinking to make room for its siblings.
 * `flexItem()` on the child that should give way fixes it structurally,
 * once, instead of every consumer rediscovering `min-width: 0` on their
 * own. pass `grow`/`shrink`/`basis` to also set the share of the row
 * this child takes; omit them to keep flex at 0 1 auto
 */
export const flexItem = (opts?: {
  grow?: number; shrink?: number; basis?: string; min?: string;
}): React.CSSProperties => ({
  flexGrow: opts?.grow ?? 0,
  flexShrink: opts?.shrink ?? 1,
  flexBasis: opts?.basis ?? 'auto',
  minWidth: opts?.min ?? 0,
});

/**
 * a responsive grid with zero breakpoints: columns add or drop themselves
 * based on available width, not a `--sm`/`--md`/`--lg` step table. each
 * tile never shrinks below `minItemWidth` and grows to fill leftover
 * space evenly, the `min(100%, ...)` guard keeps a single tile from
 * overflowing a container narrower than `minItemWidth` itself (a phone
 * viewport, a narrow sidebar panel), rather than needing a separate
 * mobile-only rule
 */
export const grid = (minItemWidth: string = '16rem', gap: string = 'var(--space-4)'): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidth}), 1fr))`,
  gap,
});

/**
 * the classic "sidebar" reflow: a fixed-ish aside beside a main region
 * that takes the rest of the row, wrapping to stacked (aside on top,
 * main below) once the container gets too narrow for both, with no media
 * query and no JS measuring anything. the trick is a "quantity query"
 * done in pure flex math: `main` is told to prefer a share of the row
 * equal to at least `stackBelow` (a percentage), and flex-wrap is left
 * free to satisfy that by dropping to a new line the moment the width of
 * `aside` plus that minimum no longer fit side by side. same
 * technique the carbon UI shell needs for the general two-region case.
 * a rail that collapses to a bottom bar still needs different dom per
 * breakpoint, so that specific shape stays a documented gap, while this
 * closes the reflow part.
 *
 * returns three style objects for the three elements the pattern needs
 * (container, aside, main) rather than one, still no dom/JSX of its
 * own, the caller places `<aside style={aside}>`/`<main style={main}>`
 * inside `<div style={container}>` however their markup wants it
 */
export const sidebarLayout = (opts?: {
  asideWidth?: string; gap?: string; stackBelow?: string;
}): { container: React.CSSProperties; aside: React.CSSProperties; main: React.CSSProperties } => ({
  container: { display: 'flex', flexWrap: 'wrap', gap: opts?.gap ?? 'var(--space-4)' },
  aside: { flexBasis: opts?.asideWidth ?? '16rem', flexGrow: 1 },
  main: { flexBasis: 0, flexGrow: 999, minWidth: opts?.stackBelow ?? '50%' },
});

export const tableBase: React.CSSProperties = {
  ...textMono,
  width: '100%',
  borderCollapse: 'collapse',
};

export const tableHeadCell: React.CSSProperties = {
  padding: 'var(--space-2)',
  borderBottom: 'var(--border-width) solid var(--border)',
  color: 'var(--text2)',
  fontWeight: 700,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

/** the <tr> wrapping a table <th> row (tableHeadCell styles the cells) */
export const tableHeadRow: React.CSSProperties = {
  background: 'var(--bg2)',
};

export const tableRow: React.CSSProperties = {
  borderBottom: 'var(--border-width) solid var(--border2)',
};

export const tableCell: React.CSSProperties = {
  padding: 'var(--space-2)',
  verticalAlign: 'top',
};

export const tableCellActions: React.CSSProperties = {
  ...tableCell,
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

// --- Icon ---

interface IconProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
}

const ICON_SIZE: Record<string, string> = {
  xs: 'var(--text-xs)', sm: 'var(--text-sm)', md: 'var(--text-md)',
  lg: 'var(--text-lg)', xl: 'var(--text-xl)',
};

// an icon set swaps what a name draws. the default draws the name through the
// picon ligature font, a set maps names to single glyphs in another font. a name
// the set does not know falls back to picon, so a partial set never shows a blank
let iconGlyphs: Record<string, string> | null = null;
let iconFamily: string | null = null;
const iconListeners = new Set<() => void>();

/** swap the glyph source for every Icon. null restores picon */
export function setIconSet(glyphs: Record<string, string> | null, fontFamily?: string): void {
  iconGlyphs = glyphs;
  iconFamily = glyphs ? fontFamily ?? null : null;
  iconListeners.forEach(fn => fn());
}

const subscribeIcons = (fn: () => void): (() => void) => {
  iconListeners.add(fn);
  return () => { iconListeners.delete(fn); };
};
const iconVersion = (): Record<string, string> | null => iconGlyphs;

export const Icon: React.FC<IconProps> = ({ name, size = 'sm', style, ...aria }) => {
  const glyphs = React.useSyncExternalStore(subscribeIcons, iconVersion, iconVersion);
  const glyph = glyphs?.[name];
  return (
    <span
      style={{ fontFamily: glyph && iconFamily ? iconFamily : 'var(--font-icon)', fontSize: ICON_SIZE[size], lineHeight: 1,
        display: 'inline-block', fontStyle: 'normal', fontWeight: 'normal', ...style }}
      aria-hidden={aria['aria-hidden'] ?? true}
      aria-label={aria['aria-label']}
    >
      {glyph ?? name}
    </span>
  );
};

// the expand/collapse marks, shared by every disclosure in the kit. one
// component so the glyph, the colour and the size cannot drift between the
// accordion, the split button, the sortable table header and the file tree
const Chevron: React.FC<{ dir: 'up' | 'down' | 'right'; style?: React.CSSProperties }> = ({ dir, style }) => (
  <Icon name={dir} size="xs" aria-hidden="true" style={{ color: 'var(--text3)', flexShrink: 0, ...style }} />
);

// one keyboard model for every roving-tabindex list in the kit. arrows
// move, home/end jump, wrap decides whether the ends cycle. lists that
// pick on arrow (switchers, chip rows, palette pickers) go through
// useRoving below; lists whose arrows only move focus (tabs, menus,
// tab strips) call this directly.
function rovingKey(e: React.KeyboardEvent, idx: number, n: number, go: (next: number) => void, wrap = false): void {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    go(wrap ? (idx + 1) % n : Math.min(n - 1, idx + 1));
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    go(wrap ? (idx - 1 + n) % n : Math.max(0, idx - 1));
  } else if (e.key === 'Home') {
    e.preventDefault();
    go(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    go(n - 1);
  }
}

// the automatic-selection roving model: move commits the pick, then focus
// follows it and the option scrolls into view. one hook instead of one
// hand-rolled move/onKeyDown/refs trio per option list.
export function useRoving<T extends HTMLElement>(count: number, onPick: (next: number) => void, wrap = false): {
  refs: React.MutableRefObject<Array<T | null>>;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
  move: (next: number) => void;
} {
  const refs = React.useRef<Array<T | null>>([]);
  const pick = React.useRef(onPick);
  pick.current = onPick;
  const move = React.useCallback((next: number): void => {
    pick.current(next);
    const el = refs.current[next];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);
  const onKeyDown = React.useCallback((e: React.KeyboardEvent, index: number): void => {
    rovingKey(e, index, count, move, wrap);
  }, [count, move, wrap]);
  return { refs, onKeyDown, move };
}

// one dismiss model for every floating surface (tooltip excluded: hover
// owns it). escape closes, pointer-down outside the anchor/panel pair
// closes. replaces the per-component copies.
function useDismiss(open: boolean, onClose: () => void, refs: Array<React.RefObject<HTMLElement | null>>): void {
  const seen = React.useRef(refs);
  seen.current = refs;
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (seen.current.some(r => r.current?.contains(t))) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, onClose]);
}

// --- Spinner ---

export const Spinner: React.FC = () => {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 9), 100);
    return () => clearInterval(id);
  }, []);
  return <Icon name={`hourglass${frame}`} size="sm" aria-label="loading" aria-hidden={false} />;
};

// --- Btn ---

type BtnVariant = 'primary' | 'default' | 'danger' | 'ghost' | (string & {});
type BtnSize    = 'sm' | 'md' | 'lg';

interface BtnProps {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  /** vibrate briefly on press (touch devices only, no-op elsewhere), default true */
  haptic?: boolean;
  /** self-wrap in a Tooltip carrying this text, so a button can describe
   *  itself (an icon-only action, a terse label) without every call site
   *  wrapping a tooltip around the button by hand, omit for no tooltip */
  tip?: string;
  tipPosition?: TipPosition;
  /** a hook for app-level classes (test ids, app animations). the button
   *  still draws every visual from tokens, this only attaches a class */
  className?: string;
  'aria-label'?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  /** set by Menu on its trigger so a screen reader announces the popup.
   *  without it the caret looks like a plain button that happens to open
   *  something */
  'aria-haspopup'?: 'menu' | 'listbox' | 'tree' | 'dialog' | 'grid';
  style?: React.CSSProperties;
}

const BTN_BASE: React.CSSProperties = {
  fontFamily:   'var(--font-ui)',
  border:       'var(--border-width) solid',
  borderRadius: 'var(--radius-btn)',
  boxShadow:    'var(--elevation-1)',
  display:      'inline-flex',
  alignItems:   'center',
  justifyContent: 'center',
  gap:          'var(--space-2)',
  lineHeight:   'var(--leading-tight)',
  userSelect:   'none',
  transition: 'background var(--transition-base), color var(--transition-base), border-color var(--transition-base)',
};

// an icon-only button has a shorter content box than a text one (the icon
// draws at line-height 1, text at the button own 1.25), so without a floor
// the two end up a few px apart in the same toolbar. the floor is exactly
// what a single line of text already measures with its padding and border,
// so text buttons are unchanged and icon ones grow to meet them. each term
// reads a token, so a text-scale zoom moves the floor with the text
const BTN_MIN_HEIGHT: Record<string, string> = {
  sm: 'calc(var(--text-xs) * var(--leading-tight) + var(--space-1) * 2 + var(--border-width) * 2)',
  md: 'calc(var(--text-sm) * var(--leading-tight) + var(--space-2) * 2 + var(--border-width) * 2)',
  lg: 'calc(var(--text-base) * var(--leading-tight) + var(--space-3) * 2 + var(--border-width) * 2)',
};

// exported so consumers can add variants at app startup, e.g.
// `BTN_VAR.warn = {...}; BTN_HOVER.warn = {...};` no fork needed
export const BTN_VAR: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--accent)',  color: 'var(--on-accent)', borderColor: 'var(--accent)'  },
  default: { background: 'transparent',    color: 'var(--text)',   borderColor: 'var(--border)'  },
  danger:  { background: 'transparent',    color: 'var(--err)',    borderColor: 'var(--err)'     },
  ghost:   { background: 'transparent',    color: 'var(--text3)', borderColor: 'var(--border2)' },
};

export const BTN_HOVER: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--accent2)', borderColor: 'var(--accent2)' },
  default: { background: 'var(--hover)',   borderColor: 'var(--border)'  },
  danger:  { background: 'var(--hover)',   borderColor: 'var(--err)'     },
  ghost:   { background: 'var(--hover)',   borderColor: 'var(--border2)' },
};

export const Btn: React.FC<BtnProps> = ({
  children, variant = 'default', size = 'md',
  disabled, loading, onClick, type = 'button', haptic: hapticOn = true,
  tip, tipPosition = 'top', className, style, ...aria
}) => {
  const [hovered, setHovered] = React.useState(false);
  const isDisabled = disabled || loading;
  const base = BTN_VAR[variant] ?? BTN_VAR.default;
  const varStyle = hovered && !isDisabled
    ? { ...base, ...(BTN_HOVER[variant] ?? BTN_HOVER.default) }
    : base;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>): void {
    if (hapticOn) haptic(variant === 'danger' ? 'error' : 'tap');
    onClick?.(e);
  }

  const button = (
    <button
      type={type}
      className={className}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : handleClick}
      aria-label={aria['aria-label']}
      aria-controls={aria['aria-controls']}
      aria-expanded={aria['aria-expanded']}
      aria-haspopup={aria['aria-haspopup']}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...BTN_BASE, ...varStyle,
        fontSize: SIZE_FONT[size],
        padding:  SIZE_PAD[size],
        minHeight: BTN_MIN_HEIGHT[size],
        cursor:   isDisabled ? 'not-allowed' : 'pointer',
        opacity:  isDisabled ? 0.4 : 1,
        ...style,
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );

  // a tip self-wraps the button in a tooltip. tooltip chains the anchor
  // own handlers rather than replacing them (see tooltip below), so the
  // button keeps its hover color shift while the tooltip rides along
  return tip ? <Tooltip content={tip} position={tipPosition}>{button}</Tooltip> : button;
};

// --- IconBtn ---

interface IconBtnProps {
  icon: string;
  /** accessible name and tooltip. icon-only buttons carry no text. */
  label: string;
  onClick?: () => void;
  /** selected state: accent fill, same treatment as the sidebar. */
  active?: boolean;
  /** disclosure state. when given, aria-pressed is omitted in favour of
   *  aria-expanded/aria-controls, so toggles and disclosures stay distinct. */
  expanded?: boolean;
  controls?: string;
  disabled?: boolean;
  /** vibrate briefly on press, default true. */
  haptic?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// the icon-only square every toolbar, map control and list row reaches
// for. a Btn variant=ghost with an Icon child spells the same thing in
// four props; this is that shape with the a11y wiring (label, title,
// pressed vs expanded) in one place instead of repeated per call site.
export const IconBtn: React.FC<IconBtnProps> = ({
  icon, label, onClick, active, expanded, controls, disabled, haptic: hapticOn = true,
  className, style,
}) => (
  <button
    type="button"
    className={className}
    aria-label={label}
    title={label}
    aria-pressed={expanded === undefined ? active : undefined}
    aria-expanded={expanded}
    aria-controls={controls}
    disabled={disabled}
    onClick={() => { if (hapticOn) haptic('tap'); onClick?.(); }}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 'var(--space-10)', height: 'var(--space-10)',
      background: active ? 'var(--accent)' : 'transparent',
      border: 'var(--border-width) solid transparent',
      borderColor: active ? 'var(--accent)' : undefined,
      borderRadius: 'var(--radius-btn)',
      color: active ? 'var(--on-accent)' : 'var(--text3)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0,
      transition: 'background var(--transition-fast), color var(--transition-fast)',
      ...style,
    }}
  >
    <Icon name={icon} size="sm" />
  </button>
);

// --- Input ---

interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onFocus?: () => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  error?: string | null;
  size?: BtnSize;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** aria-combobox passthrough (see ComboBox below). every field here is
   *  optional and inert for a plain text input, so this does not change
   *  the Input behavior for the common case, only what a consumer
   *  building a combobox-shaped thing on top of it can attach */
  role?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-autocomplete'?: 'list' | 'none' | 'inline' | 'both';
  'aria-activedescendant'?: string;
  autoFocus?: boolean;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  value, defaultValue, onChange, onKeyDown, onFocus,
  placeholder, type = 'text', disabled, error, size = 'md',
  style, id, autoFocus, ...aria
}) => {
  const { borderColor, onFocus: onFocusBorder, onBlur } = useFocusBorder(error);
  const errId      = React.useId();
  const describedBy = [aria['aria-describedby'], error ? errId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <input
        id={id}
        type={type}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        role={aria.role}
        aria-label={aria['aria-label']}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-expanded={aria['aria-expanded']}
        aria-controls={aria['aria-controls']}
        aria-autocomplete={aria['aria-autocomplete']}
        aria-activedescendant={aria['aria-activedescendant']}
        onChange={onChange ? e => onChange(e.target.value, e) : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => { onFocusBorder(); onFocus?.(); }}
        onBlur={onBlur}
        style={{
          fontFamily:  'var(--font-ui)',
          fontSize:    SIZE_FONT[size],
          padding:     SIZE_PAD[size],
          background:  'var(--bg2)',
          color:       'var(--text)',
          border:      'var(--border-width) solid',
          borderColor,
          borderRadius: 'var(--radius-input)',
          boxShadow:   'var(--elevation-inset)',
          outline:     'none',
          width:       '100%',
          transition:  'border-color var(--transition-base)',
          ...style,
        }}
      />
      {error && (
        <span id={errId} role="alert"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--err)', fontFamily: 'var(--font-ui)' }}>
          {error}
        </span>
      )}
    </div>
  );
};

// --- Textarea ---

interface TextareaProps {
  value?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  error?: string | null;
  'aria-label'?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  value, onChange, placeholder, disabled, rows = 4, error, ...aria
}) => {
  const { borderColor, onFocus, onBlur } = useFocusBorder(error);

  return (
    <textarea
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      aria-label={aria['aria-label']}
      aria-invalid={error ? true : undefined}
      onChange={onChange ? e => onChange(e.target.value, e) : undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        fontFamily:  'var(--font-ui)',
        fontSize:    'var(--text-sm)',
        padding:     'var(--space-2)',
        background:  'var(--bg2)',
        color:       'var(--text)',
        border:      'var(--border-width) solid',
        borderColor,
        borderRadius: 'var(--radius-input)',
        boxShadow:   'var(--elevation-inset)',
        outline:     'none',
        width:       '100%',
        resize:      'vertical',
        lineHeight:  'var(--leading-code)',
        transition:  'border-color var(--transition-base)',
      }}
    />
  );
};

// --- Select ---

interface SelectOption { value: string; label: string }

interface SelectProps {
  value?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<SelectOption | string>;
  disabled?: boolean;
  size?: BtnSize;
  'aria-label'?: string;
  style?: React.CSSProperties;
}

export const Select: React.FC<SelectProps> = ({
  value, onChange, options, disabled, size = 'md', style, ...aria
}) => {
  const { borderColor, onFocus, onBlur } = useFocusBorder();
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={aria['aria-label']}
      onChange={onChange ? e => onChange(e.target.value, e) : undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        fontFamily:  'var(--font-ui)',
        fontSize:    SIZE_FONT[size],
        padding:     SIZE_PAD[size],
        background:  'var(--bg2)',
        color:       'var(--text)',
        border:      'var(--border-width) solid',
        borderColor,
        borderRadius: 'var(--radius-input)',
        boxShadow:   'var(--elevation-inset)',
        outline:     'none',
        width:       '100%',
        appearance:  'none',
        transition:  'border-color var(--transition-base)',
        ...style,
      }}
    >
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

// --- Checkbox / Radio ---

// ToggleBase: shared label + hidden input structure for both Checkbox and Radio
//
const ToggleBase: React.FC<{
  inputType: 'checkbox' | 'radio';
  iconName: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
}> = ({ inputType, iconName, checked, onChange, label, disabled, name, value }) => (
  <label style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
    color: disabled ? 'var(--text3)' : 'var(--text)',
    userSelect: 'none', opacity: disabled ? 0.5 : 1,
  }}>
    <input
      type={inputType}
      checked={checked}
      disabled={disabled}
      name={name}
      value={value}
      onChange={onChange ? e => { haptic('toggle'); onChange(e.target.checked); } : undefined}
      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
    />
    <Icon name={iconName} size="sm" aria-hidden={true} />
    {label}
  </label>
);

interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, label, disabled }) => (
  <ToggleBase inputType="checkbox" iconName={checked ? 'checked' : 'ballot'}
    checked={checked} onChange={onChange} label={label} disabled={disabled} />
);

interface RadioProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
}

export const Radio: React.FC<RadioProps> = ({ checked, onChange, label, disabled, name, value }) => (
  <ToggleBase inputType="radio" iconName={checked ? 'true' : 'false'}
    checked={checked} onChange={onChange} label={label} disabled={disabled} name={name} value={value} />
);

// --- Badge ---

type BadgeVariant = 'muted' | 'accent' | 'ok' | 'warn' | 'err' | (string & {});

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

// exported so consumers can add a key (e.g. BADGE_STYLE.info = {...}) to extend without forking
export const BADGE_STYLE: Record<string, React.CSSProperties> = {
  muted:  { color: 'var(--text3)',  borderColor: 'var(--border2)' },
  accent: { color: 'var(--accent)', borderColor: 'var(--accent)'  },
  ok:     { color: 'var(--ok)',     borderColor: 'var(--ok)'      },
  warn:   { color: 'var(--warn)',   borderColor: 'var(--warn)'    },
  err:    { color: 'var(--err)',    borderColor: 'var(--err)'     },
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'muted' }) => (
  <span style={{
    fontFamily:   'var(--font-ui)', fontSize: 'var(--text-xs)',
    padding:      'var(--space-1) var(--space-2)',
    border:       'var(--border-width) solid',
    borderRadius: 'var(--radius-tag)',
    display:      'inline-block', lineHeight: 'var(--leading-tight)',
    ...(BADGE_STYLE[variant] ?? BADGE_STYLE.muted),
  }}>
    {children}
  </span>
);

// --- Tag ---
//
// badge is an outline-only label; tag is its solid-fill,
// categorical sibling. carbon draws the same distinction (badge =
// count/status, tag = category), and a dismissible chip needs a fill to
// read as "removable" rather than "informational"

type TagVariant = 'gray' | 'accent' | 'ok' | 'warn' | 'err' | (string & {});

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  /** adds a remove button, omit for a plain non-dismissible tag */
  onDismiss?: () => void;
  'aria-label'?: string;
}

// exported so consumers can add categories at app startup, same pattern
// as BADGE_STYLE, e.g. `TAG_STYLE.flow = { background: 'var(--accent2)', color: 'var(--on-accent)' };`
export const TAG_STYLE: Record<string, React.CSSProperties> = {
  gray:   { background: 'var(--bg3)',    color: 'var(--text2)' },
  accent: { background: 'var(--accent)', color: 'var(--on-accent)' },
  ok:     { background: 'var(--ok)',     color: 'var(--on-accent)' },
  warn:   { background: 'var(--warn)',   color: 'var(--on-accent)' },
  err:    { background: 'var(--err)',    color: 'var(--on-accent)' },
};

export const Tag: React.FC<TagProps> = ({ children, variant = 'gray', onDismiss, ...aria }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-tight)',
    padding: onDismiss ? 'var(--space-1) var(--space-1) var(--space-1) var(--space-2)' : 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-tag)',
    ...(TAG_STYLE[variant] ?? TAG_STYLE.gray),
  }}>
    {children}
    {onDismiss && (
      <button type="button" onClick={onDismiss} aria-label={aria['aria-label'] ?? 'remove'}
        style={{ fontFamily: 'var(--font-icon)', fontSize: 'var(--text-xs)', background: 'none',
          border: 'none', color: 'inherit', cursor: 'pointer', padding: 'var(--space-1)',
          display: 'inline-flex', lineHeight: 1 }}>
        times
      </button>
    )}
  </span>
);

// --- ColorChip ---

interface ColorChipProps {
  label: React.ReactNode;
  /** arbitrary fill, e.g. an api-driven color. foreground is derived by
   *  luminance, never hardcoded, since a palette can hold light and dark
   *  fills side by side. */
  color: string;
}

// badge and tag carry fixed variants; this is the dynamic-fill sibling
// for categorical colors that arrive at runtime rather than from the
// theme. same tag radius, same xs type, fill and readable text only.
export const ColorChip: React.FC<ColorChipProps> = ({ label, color }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 'var(--space-8)', padding: '0 var(--space-1)', height: 'var(--space-6)',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 700,
    borderRadius: 'var(--radius-sm)', flexShrink: 0,
    background: color, color: readableOn(color),
  }}>
    {label}
  </span>
);

// --- ToggleSwitch ---
//
// a physical on/off switch (carbon calls it a toggle), distinct from
// checkbox: checkbox = a value in a form, switch = an immediate setting
// change
// the track justify-content flips instantly on state change instead of
// animating the knob position, because the motion rule allows
// background/color/border-color/opacity to transition but not position, so
// the color change on track plus knob is the state signal, the same pattern
// checkbox uses (icon swap, not motion) rather than a skeuomorphic slide

interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, disabled, size = 'md', ...aria }) => {
  const w = size === 'sm' ? '2rem' : '2.5rem';
  const h = size === 'sm' ? '1.125rem' : '1.375rem';
  const knob = size === 'sm' ? '0.75rem' : '0.9375rem';
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
      color: disabled ? 'var(--text3)' : 'var(--text)', userSelect: 'none', opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox" role="switch" checked={checked} disabled={disabled}
        aria-label={aria['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
        onChange={onChange ? e => { haptic('toggle'); onChange(e.target.checked); } : undefined}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span aria-hidden="true" style={{
        width: w, height: h, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start', padding: '0.125rem',
        background: checked ? 'var(--accent)' : 'var(--bg3)',
        border: `var(--border-width) solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-pill)',
        transition: 'background var(--transition-base), border-color var(--transition-base)',
      }}>
        <span style={{
          width: knob, height: knob, borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--on-accent)' : 'var(--text3)',
          transition: 'background var(--transition-base)',
        }} />
      </span>
      {label}
    </label>
  );
};

// --- ProgressBar ---
//
// linear progress (carbon progress indicator, the bar variant; the
// step/stage variant is a documented gap)
// indeterminate mode pulses opacity rather than sweeping a transform across
// the track, staying inside the same motion invariant spinner and skeleton
// respect

interface ProgressBarProps {
  /** 0 to 100, omit for an indeterminate bar (unknown duration) */
  value?: number;
  label?: React.ReactNode;
  showValue?: boolean;
  /** fill color, default 'var(--accent)' */
  color?: string;
  'aria-label'?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, showValue = false, color = 'var(--accent)', ...aria }) => {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%' }}>
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
          <span>{label}</span>
          {showValue && !indeterminate && <span>{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={aria['aria-label']}
        aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
        aria-valuemin={0} aria-valuemax={100}
        style={{ height: 'var(--space-2)', background: 'var(--bg3)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}
      >
        <div
          className={indeterminate ? 'anto-progress-indeterminate' : undefined}
          style={{
            height: '100%', background: color, borderRadius: 'var(--radius-pill)',
            // no width transition: the motion rule allows background/color/
            // border-color/opacity to animate, never width or height, no
            // exceptions, so the bar jumps to each new value instead
            width: indeterminate ? '100%' : `${clamped}%`,
          }}
        />
      </div>
    </div>
  );
};

// --- Skeleton ---
//
// a loading placeholder block, pulsing opacity (see tokens.css) rather
// than shimmering a moving gradient, for the same reason the progress bar
// indeterminate state pulses instead of sweeping

interface SkeletonProps {
  width?: string;
  height?: string;
  /** round it fully, for a placeholder standing in for a status dot, an
   *  icon or an avatar, rather than the usual --radius-sm block */
  circle?: boolean;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '1rem', circle, style }) => (
  <span
    aria-hidden="true"
    className="anto-skeleton"
    style={{
      display: 'block', width, height,
      borderRadius: circle ? 'var(--radius-pill)' : 'var(--radius-sm)',
      background: 'var(--bg3)',
      ...style,
    }}
  />
);

// --- StatusDot ---

type StatusValue = 'online' | 'idle' | 'dnd' | 'offline' | (string & {});

interface StatusDotProps { status: StatusValue; label?: string }

export const STATUS_COLOR: Record<string, string> = {
  online: 'var(--ok)', idle: 'var(--warn)', dnd: 'var(--err)', offline: 'var(--text3)',
};

export const StatusDot: React.FC<StatusDotProps> = ({ status, label }) => (
  <span
    aria-label={label}
    aria-hidden={label ? undefined : true}
    style={{ width: 'var(--space-2)', height: 'var(--space-2)',
      // pinned to --radius-dot, not the general --radius cascade: a
      // theme rounding everything else does not accidentally round this
      // too (the rule keeps status indicators square) unless it sets
      // --radius-dot on purpose
      borderRadius: 'var(--radius-dot)',
      background: STATUS_COLOR[status] ?? STATUS_COLOR.offline, display: 'inline-block', flexShrink: 0 }}
  />
);

// --- Tabs ---

interface TabItem { id: string; label: string }

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange?: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => {
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number): void {
    rovingKey(e, idx, tabs.length, next => {
      document.querySelector<HTMLElement>(`[data-tab-idx="${next}"]`)?.focus();
    }, true);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange?.(tabs[idx].id); }
  }

  return (
    <div role="tablist" style={{ display: 'flex', borderBottom: 'var(--border-width) solid var(--border)' }}>
      {tabs.map((tab, idx) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            data-tab-idx={idx}
            type="button"
            onClick={() => { haptic('tap'); onChange?.(tab.id); }}
            onKeyDown={e => onKeyDown(e, idx)}
            style={{
              fontFamily:   'var(--font-ui)',
              fontSize:     'var(--text-sm)',
              padding:      'var(--space-2) var(--space-3)',
              background:   'transparent',
              color:        isActive ? 'var(--accent)' : 'var(--text3)',
              border:       'none',
              borderBottom: `0.125rem solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              cursor:       'pointer',
              marginBottom: '-0.0625rem',
              userSelect:   'none',
              transition:   'color var(--transition-base), border-color var(--transition-base)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

// --- Sidebar ---

interface SidebarItem {
  id: string;
  icon: string;
  label: string;
  /** items with differing, non-undefined groups get a divider between
   *  them; undefined groups (or a single group) render as one
   *  unbroken rail, same as before this existed */
  group?: string;
  /** a small marker on the icon corner: something on that item
   *  needs a look. a css color value (e.g. 'var(--warn)'), matched to
   *  the severity of whatever triggered it. this component only
   *  renders whatever color it is given, the caller decides. falsy:
   *  no marker */
  marker?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  active: string;
  onSelect?: (id: string) => void;
  /** builds the aria-label for an item with an active marker,
   *  given its own label. the default appends " (needs attention)", pass
   *  your own to localize it */
  markerAriaLabel?: (label: string) => string;
}

const defaultMarkerAriaLabel = (label: string): string => `${label} (needs attention)`;

// one divider and one corner marker for both rails. sidebar draws them
// icon-only, navrail labeled; the shape and the group rule stay identical.
function railSeparator(key: string, vertical: boolean, margin: string): React.ReactElement {
  return vertical
    ? <div key={key} role="separator" aria-orientation="vertical"
        style={{ width: 'var(--border-width)', background: 'var(--border)', alignSelf: 'stretch', margin, flexShrink: 0 }} />
    : <div key={key} role="separator" aria-orientation="horizontal"
        style={{ height: 'var(--border-width)', background: 'var(--border)', width: '100%', margin, flexShrink: 0 }} />;
}

function markerDot(color: string, active: boolean): React.ReactElement {
  return (
    <span aria-hidden="true" style={{
      position: 'absolute', top: 'var(--space-1)', right: 'var(--space-1)',
      width: '0.5rem', height: '0.5rem', background: color,
      borderRadius: 'var(--radius-dot)', // same reasoning as StatusDot
      border: `var(--border-width) solid ${active ? 'var(--accent)' : 'var(--bg2)'}`,
    }} />
  );
}

// SidebarButton: own hover state per item, since a single boolean on
// Sidebar itself cannot tell which item is hovered. the sidebar hover rule
// wants inactive-only hover with an explicit guard, active always wins
const SidebarButton: React.FC<{
  item: SidebarItem;
  isActive: boolean;
  onSelect?: (id: string) => void;
  markerAriaLabel: (label: string) => string;
}> = ({ item, isActive, onSelect, markerAriaLabel }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={item.marker ? markerAriaLabel(item.label) : item.label}
      aria-current={isActive ? 'page' : undefined}
      title={item.label}
      onClick={() => onSelect?.(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%', height: 'var(--space-10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer',
        borderRadius: 'var(--radius-btn)',
        background: isActive ? 'var(--accent)' : hovered ? 'var(--hover)' : 'transparent',
        color:      isActive ? 'var(--on-accent)' : 'var(--text3)',
        fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)', lineHeight: 1,
        transition: 'background var(--transition-base), color var(--transition-base)',
      }}
    >
      {item.icon}
      {item.marker && markerDot(item.marker, isActive)}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ items, active, onSelect, markerAriaLabel = defaultMarkerAriaLabel }) => (
  <nav style={{
    width: 'var(--space-10)', background: 'var(--bg2)',
    borderRight: 'var(--border-width) solid var(--border)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: 'var(--space-1)', flexShrink: 0,
  }}>
    {items.flatMap((item, i) => {
      const isActive = item.id === active;
      const previous = items[i - 1];
      const nodes: React.ReactNode[] = [];

      if (i > 0 && item.group !== previous.group) {
        nodes.push(railSeparator(`${item.id}-divider`, false, 'var(--space-1) 0'));
      }

      nodes.push(
        <SidebarButton key={item.id} item={item} isActive={isActive} onSelect={onSelect} markerAriaLabel={markerAriaLabel} />,
      );

      return nodes;
    })}
  </nav>
);

// --- NavRail ---

export interface NavRailItem extends SidebarItem {
  /** short visible caption under the icon. defaults to the label. */
  caption?: string;
  /** human-readable name for the tooltip and the screen reader.
   *  defaults to the label. */
  title?: string;
}

interface NavRailProps {
  items: NavRailItem[];
  active: string;
  onSelect?: (id: string) => void;
  markerAriaLabel?: (label: string) => string;
  /** accessible name for the nav landmark. */
  'aria-label'?: string;
}

// the labeled sibling of the icon-only sidebar. same contract (tokens,
// 50/100ms linear motion, haptic on select, accent active treatment,
// group dividers, corner markers), plus a visible caption and a phone
// reflow: under 40rem the rail becomes a bottom bar via the media hook
// rather than a css query, since the kit styles inline. reach for this
// whenever the destinations need names, not just icons.
export const NavRail: React.FC<NavRailProps> = ({
  items, active, onSelect, markerAriaLabel = defaultMarkerAriaLabel, ...aria
}) => {
  const narrow = useMediaQuery('(max-width: 40rem)');
  const select = (id: string): void => { haptic('tap'); onSelect?.(id); };

  return (
    <nav aria-label={aria['aria-label'] ?? 'navigation'} style={narrow ? {
      display: 'flex', flexDirection: 'row', background: 'var(--bg2)',
      borderTop: 'var(--border-width) solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0,
    } : {
      width: '3.5rem', background: 'var(--bg2)',
      borderRight: 'var(--border-width) solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {items.flatMap((item, i) => {
        const isActive = item.id === active;
        const previous = items[i - 1];
        const nodes: React.ReactNode[] = [];
        if (i > 0 && item.group !== previous.group) {
          nodes.push(railSeparator(
            `${item.id}-divider`,
            narrow,
            narrow ? 'var(--space-2) 0' : 'var(--space-1) var(--space-2)',
          ));
        }
        nodes.push(
          <button
            key={item.id}
            type="button"
            aria-label={item.marker ? markerAriaLabel(item.title ?? item.label) : (item.title ?? item.label)}
            aria-current={isActive ? 'page' : undefined}
            title={item.title ?? item.label}
            onClick={() => select(item.id)}
            style={{
              position: 'relative',
              flex: narrow ? 1 : undefined,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-1)', padding: 'var(--space-2) 0',
              minHeight: 'var(--space-10)',
              background: isActive ? 'var(--accent)' : 'transparent',
              border: 'none', borderRadius: narrow ? 0 : 'var(--radius-btn)',
              color: isActive ? 'var(--on-accent)' : 'var(--text3)',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            <Icon name={item.icon} size="lg" />
            <span aria-hidden="true" style={{
              fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.04em',
              lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {item.caption ?? item.label}
            </span>
            {item.marker && markerDot(item.marker, isActive)}
          </button>,
        );
        return nodes;
      })}
    </nav>
  );
};

// --- Breadcrumb ---

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps { items: BreadcrumbItem[] }

// own hover state per link, same pattern as Btn/SidebarButton, not a
// direct dom style mutation, so it stays consistent with how every other
// interactive element in this kit tracks hover
const BreadcrumbLink: React.FC<{ item: BreadcrumbItem }> = ({ item }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <a
      href={item.href ?? '#'}
      onClick={item.onClick ? (e => { e.preventDefault(); item.onClick!(); }) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: hovered ? 'var(--text)' : 'var(--text3)', textDecoration: 'none',
        transition: 'color var(--transition-base)',
      }}
    >
      {item.label}
    </a>
  );
};

// a nav trail. the last item (or any item with neither href nor onClick)
// renders as plain current-page text, everything before it is a link
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => (
  <nav aria-label="breadcrumb" style={{
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-1)',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text3)',
  }}>
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      const isLink = !isLast && (item.href || item.onClick);
      return (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {isLink
            ? <BreadcrumbLink item={item} />
            : <span aria-current={isLast ? 'page' : undefined} style={{ color: isLast ? 'var(--text)' : 'var(--text3)' }}>
                {item.label}
              </span>}
        </React.Fragment>
      );
    })}
  </nav>
);

// --- Collapse ---
//
// a disclosure body that grows open and shrinks closed instead of popping.
// it animates grid-template-rows between 0fr and 1fr: the one size-like
// transition that reaches the content natural height without measuring it
// in javascript. the motion rule (background, color, border-color, opacity
// only) is relaxed here on purpose and only here, because a disclosure that
// teleports is the one place readers lose their place. durations read the
// motion tokens, so prefers-reduced-motion still zeroes them for free.

interface CollapseProps {
  open: boolean;
  children: React.ReactNode;
  /** milliseconds. default 200. 0 renders open and closed with no animation. */
  duration?: number;
  style?: React.CSSProperties;
}

export const Collapse: React.FC<CollapseProps> = ({ open, children, duration = 200, style }) => {
  const [shown, setShown] = React.useState(open);
  const [anim, setAnim] = React.useState<React.CSSProperties | null>(null);
  const first = React.useRef(true);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // the first render must not animate, the body simply matches open
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    const css = duration
      ? { animationDuration: `${duration}ms`, animationTimingFunction: 'var(--ease)', animationFillMode: 'both' } as React.CSSProperties
      : null;
    if (open) {
      setShown(true);
      setAnim(css ? { ...css, animationName: 'anto-collapse-in' } : null);
      timer.current = setTimeout(() => setAnim(null), duration);
    } else {
      setAnim(css ? { ...css, animationName: 'anto-collapse-out' } : null);
      timer.current = setTimeout(() => { setShown(false); setAnim(null); }, duration);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, duration]);

  return (
    <div style={{ display: 'grid', gridTemplateRows: shown ? '1fr' : '0fr', ...(anim ?? {}), ...style }}>
      {shown && <div style={{ minHeight: 0, overflow: 'hidden' }}>{children}</div>}
    </div>
  );
};

// --- Accordion ---

interface AccordionItem { id: string; title: React.ReactNode; content: React.ReactNode }

interface AccordionProps {
  items: AccordionItem[];
  /** controlled: the currently-open ids, omit for uncontrolled (the
   *  component tracks its own open set internally) */
  open?: string[];
  onToggle?: (id: string) => void;
  /** allow more than one section open at once, default true */
  multiple?: boolean;
}

// the body animates open and shut through Collapse so a reader keeps their
// place. the region stays mounted while open or animating, which keeps the
// header aria-controls pointing at a live node
export const Accordion: React.FC<AccordionProps> = ({ items, open: controlledOpen, onToggle, multiple = true }) => {
  const [internalOpen, setInternalOpen] = React.useState<string[]>([]);
  const openIds = controlledOpen ?? internalOpen;

  function toggle(id: string): void {
    haptic('tap');
    if (onToggle) { onToggle(id); return; }
    setInternalOpen(prev => {
      const isOpen = prev.includes(id);
      if (isOpen) return prev.filter(x => x !== id);
      return multiple ? [...prev, id] : [id];
    });
  }

  return (
    <div style={{ border: 'var(--border-width) solid var(--border2)', borderRadius: 'var(--radius-card)' }}>
      {items.map((item, i) => {
        const isOpen = openIds.includes(item.id);
        return (
          <div key={item.id} style={{ borderTop: i > 0 ? 'var(--border-width) solid var(--border2)' : undefined }}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              id={`accordion-header-${item.id}`}
              onClick={() => toggle(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'transparent', border: 'none',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>{item.title}</span>
              <Chevron dir={isOpen ? 'down' : 'right'} />
            </button>
            <Collapse open={isOpen}>
              <div
                id={`accordion-panel-${item.id}`}
                role="region"
                aria-labelledby={`accordion-header-${item.id}`}
                style={{ padding: '0 var(--space-3) var(--space-3)', fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-sm)', color: 'var(--text2)' }}
              >
                {item.content}
              </div>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};

// --- StatusBar ---

interface StatusBarProps { left?: React.ReactNode; right?: React.ReactNode }

export const StatusBar: React.FC<StatusBarProps> = ({ left, right }) => (
  <div role="status" aria-live="polite" style={{
    height: 'var(--space-5)', background: 'var(--accent)', color: 'var(--on-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)',
    flexShrink: 0, userSelect: 'none',
  }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>{left}</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>{right}</span>
  </div>
);

// --- Alert ---

interface AlertProps {
  children: React.ReactNode;
  /** border/accent color, typically a severity token
   *  ('var(--warn)'/'var(--err)'/'var(--ok)'), default 'var(--warn)' */
  color?: string;
  /** right-aligned, e.g. a Btn that opens a dialog with more detail */
  action?: React.ReactNode;
  /** optional bold heading above children. filling this (and/or
   *  onDismiss) turns the same bordered-row primitive into the
   *  "inline notification" shape, no separate component, more slots
   *  used. leave both unset for the original plain banner */
  title?: React.ReactNode;
  /** adds a close control. omit for a banner that persists until its
   *  underlying condition clears (the original, still-default behavior,
   *  since Toast already owns the transient/auto-dismiss case) */
  onDismiss?: () => void;
}

// a bordered, colored banner row for "something here needs a look".
// content and action are both slots, this only owns the shared shape
// (border color + row layout) so every consumer alert looks the same
export const Alert: React.FC<AlertProps> = ({ children, color = 'var(--warn)', action, title, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: title ? 'flex-start' : 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
    border: `var(--border-width) solid ${color}`, borderRadius: 'var(--radius-sm)',
    padding: 'var(--space-2) var(--space-3)',
  }}>
    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {title && <strong style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text)' }}>{title}</strong>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>{children}</div>
    </div>
    {action}
    {onDismiss && (
      <button type="button" aria-label="dismiss" onClick={onDismiss}
        style={{ fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)', color: 'var(--text3)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
        times
      </button>
    )}
  </div>
);

// --- Tile ---
//
// carbon calls this a tile: a container that can be static, clickable, or
// a selectable toggle, distinct from the `panel` style helper, which is
// purely static. reuses the Btn/SidebarButton own-hover-state pattern and
// renders a <button> when interactive, a <div> otherwise, so a static tile
// never receives spurious button semantics

interface TileProps {
  children: React.ReactNode;
  /** toggled/selected look (accent border, raised surface), only
   *  meaningful when `onClick` is set, since a purely static tile has no
   *  selection state to show */
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const Tile: React.FC<TileProps> = ({ children, selected, onClick, disabled, style, ...aria }) => {
  const [hovered, setHovered] = React.useState(false);
  const interactive = !!onClick;

  const shared: React.CSSProperties = {
    display: 'block', textAlign: 'left', width: '100%',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text)',
    padding: 'var(--space-3)', borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--elevation-1)',
    border: `var(--border-width) solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
    background: selected ? 'var(--bg2)' : (hovered && interactive ? 'var(--hover)' : 'var(--bg)'),
    transition: 'background var(--transition-base), border-color var(--transition-base)',
    ...style,
  };

  if (!interactive) {
    return <div aria-label={aria['aria-label']} style={shared}>{children}</div>;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected !== undefined ? selected : undefined}
      aria-label={aria['aria-label']}
      onClick={() => { haptic('tap'); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...shared, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  );
};

// --- Modal ---

interface ModalProps {
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  open?: boolean;
  /** box width, default 24rem, always capped at 90vw. ignored when
   *  size is set, which picks the width from the preset table */
  width?: string;
  /** named width so screen-centered flows (settings, managers) share one
   *  size instead of each call site guessing its own rem value */
  size?: 'sm' | 'md' | 'lg' | 'page';
}

// small centered confirmations stay sm, plain forms read md, tables and
// multi-column layouts lg, and screen-centered manager flows (a settings
// page, a project picker) take page: most of the viewport in both axes
const MODAL_SIZE: Record<string, { width: string; height?: string }> = {
  sm:   { width: '24rem' },
  md:   { width: '32rem' },
  lg:   { width: '48rem' },
  page: { width: 'min(64rem, 96vw)', height: 'min(88vh, 60rem)' },
};

// focus trap: constrains Tab/Shift+Tab to focusable descendants of ref
//
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean): void {
  React.useEffect(() => {
    if (!active || !ref.current) return;
    const el  = ref.current;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function handler(e: KeyboardEvent): void {
      const els = Array.from(el.querySelectorAll<HTMLElement>(sel));
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0], last = els[els.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first)  { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }

    el.addEventListener('keydown', handler);
    // a child that asked for focus (an autofocused field) keeps it: the
    // trap only places focus when it landed outside, as on plain opens
    if (!el.contains(document.activeElement)) {
      (el.querySelectorAll<HTMLElement>(sel)[0])?.focus();
    }
    return () => el.removeEventListener('keydown', handler);
  }, [active]);
}

export const Modal: React.FC<ModalProps> = ({ title, children, footer, onClose, open = true, width, size }) => {
  const boxRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef, open);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const preset = size ? MODAL_SIZE[size] : undefined;
  const boxWidth = preset?.width ?? width ?? '24rem';

  return (
    <div role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: size === 'page' ? 'var(--space-4)' : undefined,
        zIndex: 'var(--z-modal)' as any,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div ref={boxRef} style={{
        background: 'var(--modal-bg)',
        border:     'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-modal)',
        boxShadow:  'var(--elevation-2)',
        // clips the header/footer own square corners to the box radius when a
        // theme rounds it. the inner body keeps its own overflow-y:auto
        // (for scrolling long content), that is a different element
        overflow:   'hidden',
        width: boxWidth, maxWidth: '96vw', maxHeight: '88vh', height: preset?.height,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: 'var(--border-width) solid var(--border)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)',
          flexShrink: 0,
        }}>
          <span>{title}</span>
          <button type="button" aria-label="close" onClick={onClose}
            style={{ fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)',
              color: 'var(--text3)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0 }}>
            times
          </button>
        </div>
        {/* flex:1 1 auto + minHeight:0 is what lets this scroll instead
            of the flex child refusing to shrink below its content size
            (the default flex-item behavior) and blowing past the box own
            maxHeight */}
        <div style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)', color: 'var(--text2)',
          flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
        }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: 'var(--space-2) var(--space-3)',
            borderTop: 'var(--border-width) solid var(--border)',
            display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Pager ---

interface PagerProps {
  /** 1-based */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  /** labels the `<nav>` landmark, default "pager" */
  'aria-label'?: string;
}

// prev/next plus a direct page-number jump, for a list too long to
// render or scroll through in one screen (hundreds of rows). renders
// nothing when pageCount <= 1, there is nothing to page through
export const Pager: React.FC<PagerProps> = ({ page, pageCount, onPage, ...aria }) => {
  if (pageCount <= 1) return null;

  function go(n: number): void {
    const clamped = Math.min(Math.max(1, Math.round(n)), pageCount);
    if (clamped !== page) onPage(clamped);
  }

  return (
    <nav aria-label={aria['aria-label'] ?? 'pager'} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
      fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text2)',
    }}>
      <Btn variant="ghost" size="sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="previous page">
        <Icon name="left" size="sm" />
      </Btn>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <Input
          type="number"
          value={String(page)}
          onChange={v => { const n = Number(v); if (Number.isFinite(n)) go(n); }}
          size="sm"
          aria-label="page number"
          style={{ width: '3.5rem', textAlign: 'center' }}
        />
        <span>/ {pageCount}</span>
      </span>
      <Btn variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label="next page">
        <Icon name="right" size="sm" />
      </Btn>
    </nav>
  );
};

interface UsePagerResult {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}

// clamped, not reset via effect: the underlying list can shrink (a
// filter, a delete) while a dialog stays open, and the page number
// should just settle on the new last page instead of needing a
// render to catch up. pairs with Pager, whose props are this return
// value own field names
export function usePager(total: number, pageSize: number): UsePagerResult {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.min(page, pageCount), pageCount, setPage };
}

interface SelectionRange {
  /** this item position in `allIds`, for shift-click range selection */
  index: number;
  /** the full ordered id list the range spans across */
  allIds: string[];
  shiftKey: boolean;
}

interface UseSelectionResult {
  selected: Set<string>;
  /** toggle one id. pass `range` to support shift-click ("file
   *  manager" style): extends from the last-toggled index to this
   *  one, setting the whole span to whichever state this click just
   *  put `id` into. omit `range` for a plain single toggle */
  toggle: (id: string, range?: SelectionRange) => void;
  select: (ids: string[]) => void;
  clear: () => void;
  /** drops one id, if present, for "acted on this one, forget it"
   *  after resolving a single row instead of the whole selection */
  remove: (id: string) => void;
}

// checkbox-list selection state: toggle one (optionally as part of a
// shift-click range), replace the whole set, clear it, or drop one id
export function useSelection(): UseSelectionResult {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = React.useState<number | null>(null);

  function toggle(id: string, range?: SelectionRange): void {
    setSelected(prev => {
      const next = new Set(prev);
      if (range?.shiftKey && lastIndex !== null) {
        const from = Math.min(lastIndex, range.index);
        const to = Math.max(lastIndex, range.index);
        const turnOn = !prev.has(id);
        for (let i = from; i <= to; i++) {
          if (turnOn) next.add(range.allIds[i]); else next.delete(range.allIds[i]);
        }
        return next;
      }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setLastIndex(range?.index ?? null);
  }

  function select(ids: string[]): void {
    setSelected(new Set(ids));
    setLastIndex(null);
  }

  function clear(): void {
    setSelected(new Set());
    setLastIndex(null);
  }

  function remove(id: string): void {
    setSelected(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return { selected, toggle, select, clear, remove };
}

// --- Tooltip / Toggletip ---
//
// tooltip: hover/focus, non-interactive, brief text only, dismissed by
// moving away, same model carbon own tooltip uses. toggletip: click
// triggered, persists until dismissed (Escape or an outside click), and
// can hold interactive content (a link, a Btn). carbon actual name for
// this shape, and what closes this kit former popover gap: a
// click-triggered surface with focus-manageable content, which plain
// tooltip structurally cannot be (content vanishes the instant
// focus/hover leaves, so nothing inside it could ever be reached). both
// share one caret-rendering helper and one position table so they read as
// siblings, not two unrelated implementations

// --- overlay ---
//
// the one primitive behind the kit popups. a tooltip or a menu painted inside
// its anchor is at the mercy of every ancestor: the tab rail scrolls, the tree
// and the dialogs clip, and any element with overflow hidden takes the popup
// with it. portalling to the body and positioning from the anchor rect removes
// the whole class of bug, and measuring the box once it is drawn lets the
// placement be nudged back inside the screen and flipped to the other side of
// the anchor when the edge is too close

const VIEWPORT_PAD = 8;

// the gap is a token, so it is resolved through the live stylesheet rather than
// restated in px. one probe per token, cached for the session
const gapCache: Record<string, number> = {};
function pxOf(token: string): number {
  const hit = gapCache[token];
  if (hit !== undefined) return hit;
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;width:${token}`;
  document.body.appendChild(probe);
  const n = probe.getBoundingClientRect().width;
  probe.remove();
  gapCache[token] = n;
  return n;
}

type TipPosition = 'top' | 'bottom' | 'left' | 'right';
// center is a tooltip, start and end hang a menu off the anchor edge the way a
// native dropdown does
type OverlayAlign = 'center' | 'start' | 'end';

interface PlacementInfo {
  position: TipPosition;
  /** where a caret has to point along the box edge facing the anchor, in px from the box start */
  caretAt: string;
}

interface Placement extends PlacementInfo {
  top: number;
  left: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// everything is placed with top and left from the viewport origin. a box that
// anchors with right or bottom has to know the viewport size, and innerWidth
// includes the scrollbar the fixed box is not positioned against
function place(
  anchor: DOMRect, box: { width: number; height: number },
  position: TipPosition, align: OverlayAlign, gap: number,
): Placement {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = box.width, h = box.height;
  const avail = { top: anchor.top, bottom: vh - anchor.bottom, left: anchor.left, right: vw - anchor.right };
  // only flip when the preferred side really has no room and the opposite side
  // has strictly more, so a box that fits in a crowded corner stays put
  if (position === 'top'    && avail.top < h + gap    && avail.bottom > avail.top)   return place(anchor, box, 'bottom', align, gap);
  if (position === 'bottom' && avail.bottom < h + gap && avail.top > avail.bottom)   return place(anchor, box, 'top', align, gap);
  if (position === 'left'   && avail.left < w + gap   && avail.right > avail.left)   return place(anchor, box, 'right', align, gap);
  if (position === 'right'  && avail.right < w + gap  && avail.left > avail.right)   return place(anchor, box, 'left', align, gap);

  const horizontal = position === 'top' || position === 'bottom';
  const size = horizontal ? w : h;
  const a0 = horizontal ? anchor.left : anchor.top;
  const aSize = horizontal ? anchor.width : anchor.height;
  const limit = horizontal ? vw : vh;
  // the start of the box along the edge it shares with the anchor
  const ideal = align === 'start' ? a0 : align === 'end' ? a0 + aSize - size : a0 + aSize / 2 - size / 2;
  const along = clamp(ideal, VIEWPORT_PAD, limit - size - VIEWPORT_PAD);
  // the caret follows the anchor centre, not the box centre, so a box pushed
  // back from a screen edge still points at what it belongs to. kept inside the
  // box so it never sits on a rounded corner
  const caretAt = `${clamp(a0 + aSize / 2 - along, 12, size - 12)}px`;

  if (horizontal) {
    return {
      position, caretAt, left: along,
      top: position === 'top' ? anchor.top - gap - h : anchor.bottom + gap,
    };
  }
  return {
    position, caretAt, top: along,
    left: position === 'left' ? anchor.left - gap - w : anchor.right + gap,
  };
}

// the trigger a wrapper holds. an inline-block wrapper is taller than its button
// by the line box, so measuring it leaves a gap that is not in the design
const triggerOf = (wrap: HTMLElement | null): HTMLElement | null => (wrap?.firstElementChild as HTMLElement | null) ?? wrap;

interface OverlayProps {
  open: boolean;
  /** the element the box hangs off. its rect is re-read on scroll and resize */
  anchor: HTMLElement | null;
  position: TipPosition;
  align?: OverlayAlign;
  /** id of the portalled box, so aria-describedby on the anchor resolves */
  id?: string;
  /** token name for the gap between anchor and box, resolved through pxOf */
  gap?: string;
  /** a function child receives the final side and caret offset, which can differ from the ones asked for */
  children: React.ReactNode | ((p: PlacementInfo) => React.ReactNode);
}

export const Overlay: React.FC<OverlayProps> = ({
  open, anchor, position, align = 'center', id, gap = 'var(--space-2)', children,
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = React.useState<Placement | null>(null);
  const live = open && anchor;

  // the size can only be known once the box is in the dom, so the first render
  // is invisible and this effect places it before the browser paints. it runs
  // again for scroll, resize and when the content changes size
  React.useLayoutEffect(() => {
    if (!live) { setPlaced(null); return; }
    const measure = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const next = place(anchor.getBoundingClientRect(), { width: r.width, height: r.height }, position, align, pxOf(gap));
      setPlaced((p) => (p && p.top === next.top && p.left === next.left && p.position === next.position && p.caretAt === next.caretAt ? p : next));
    };
    measure();
    addEventListener('scroll', measure, true);
    addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => { removeEventListener('scroll', measure, true); removeEventListener('resize', measure); ro.disconnect(); };
  }, [live, anchor, position, align, gap]);

  if (!live) return null;

  return createPortal(
    // opacity and not visibility for the unplaced frame: a hidden element cannot
    // take focus, and a menu focuses its first item the moment it opens.
    // max-content keeps the width independent of where the box lands, or a box
    // near the right edge would wrap, change size and be placed again
    <span id={id} ref={ref} style={{
      position: 'fixed', top: 0, left: 0, width: 'max-content', maxWidth: `calc(100vw - ${2 * VIEWPORT_PAD}px)`,
      // above every panel and canvas in the app: a popup that loses the paint
      // order is one the user cannot click
      zIndex: 'var(--z-popover)' as any,
      transform: placed ? `translate(${placed.left}px, ${placed.top}px)` : undefined,
      opacity: placed ? 1 : 0,
      boxSizing: 'border-box',
    }}>{typeof children === 'function' ? (placed ? children(placed) : children({ position, caretAt: '50%' })) : children}</span>,
    document.body,
  );
};

type TooltipAnchorProps = {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  [key: string]: unknown;
};

// margin bumped from the original --space-1 to --space-2, the caret
// below needs room between box and anchor to sit in without overlapping
// either
// a small square, same background and border as the box it belongs to,
// rotated 45deg and half-tucked behind the box edge so only the outward
// corner shows, the standard way to draw a bordered pointer without a
// separate image asset. being a child, it always paints over its parent
// own background regardless of dom order, so the hidden half needs no
// z-index trick: a fill matching the box is enough for that half to read
// as invisible
const CARET_SIZE = '0.5rem';
const CARET_EDGE = `calc(${CARET_SIZE} / -2 - var(--border-width))`;
const CARET_CENTER = `calc(${CARET_SIZE} / -2)`;

// the edge facing the anchor is fixed by the side, the offset along it comes
// from the placement so a clamped box still points at its anchor
function caretStyle(position: TipPosition, at: string): React.CSSProperties {
  switch (position) {
    case 'top':    return { bottom: CARET_EDGE, left: at, marginLeft: CARET_CENTER };
    case 'bottom': return { top: CARET_EDGE, left: at, marginLeft: CARET_CENTER };
    case 'left':   return { right: CARET_EDGE, top: at, marginTop: CARET_CENTER };
    case 'right':  return { left: CARET_EDGE, top: at, marginTop: CARET_CENTER };
  }
}

function Caret({ p, background }: { p: PlacementInfo; background: string }): React.ReactElement {
  return (
    <span aria-hidden="true" style={{
      position: 'absolute', width: CARET_SIZE, height: CARET_SIZE,
      background, border: 'var(--border-width) solid var(--border)',
      transform: 'rotate(45deg)',
      ...caretStyle(p.position, p.caretAt),
    }} />
  );
}

interface TooltipProps {
  content: string;
  children: React.ReactElement<TooltipAnchorProps>;
  position?: TipPosition;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [visible, setVisible] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const id = React.useId();
  // chain the anchor own handlers instead of clobbering them: an anchor
  // that already tracks hover or focus (the Btn color shift) has to keep
  // that behavior while the tooltip rides along, or wrapping it silently
  // drops its interactivity
  const anchor = children.props as unknown as {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    disabled?: boolean;
  };
  // the element that received the event is the anchor. measuring a wrapper
  // instead gives a wrong box whenever the child is block or flex level
  const show = (el: HTMLElement) => { setAnchorEl(el); setVisible(true); };
  const tip = (p: PlacementInfo) => (
    <span role="tooltip" style={{
      display: 'block', position: 'relative',
      background: 'var(--bg3)', color: 'var(--text)',
      border: 'var(--border-width) solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--elevation-1)',
      padding: 'var(--space-1) var(--space-2)',
      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)',
      whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>
      {content}
      <Caret p={p} background="var(--bg3)" />
    </span>
  );

  // a disabled button fires no mouse events of its own, so a tooltip hung
  // directly on it would never show, exactly when it is most needed (the
  // tip is what explains why the control is disabled). the wrapper owns
  // the hover handlers and the box measurement instead, the button inside
  // stays disabled and keeps its own size, so layout does not move
  if (anchor.disabled) {
    return (
      <span style={{ display: 'inline-flex' }}>
        <span
          aria-describedby={id}
          onMouseEnter={(e) => { anchor.onMouseEnter?.(e as unknown as React.MouseEvent); show(e.currentTarget as HTMLElement); }}
          onMouseLeave={(e) => { anchor.onMouseLeave?.(e as unknown as React.MouseEvent); setVisible(false); }}
          style={{ display: 'inline-flex' }}
        >
          {children}
        </span>
        <Overlay open={visible} anchor={anchorEl} position={position} id={id}>
          {tip}
        </Overlay>
      </span>
    );
  }

  return (
    // display contents: the wrapper only exists to hold the portal in the tree
    // and takes no part in layout
    <span style={{ display: 'contents' }}>
      {React.cloneElement(children, {
        'aria-describedby': id,
        onMouseEnter: (e: React.MouseEvent) => { anchor.onMouseEnter?.(e); show(e.currentTarget as HTMLElement); },
        onMouseLeave: (e: React.MouseEvent) => { anchor.onMouseLeave?.(e); setVisible(false); },
        onFocus:      (e: React.FocusEvent)  => { anchor.onFocus?.(e); show(e.currentTarget as HTMLElement); },
        onBlur:       (e: React.FocusEvent)  => { anchor.onBlur?.(e); setVisible(false); },
      })}
      <Overlay open={visible} anchor={anchorEl} position={position} id={id}>
        {tip}
      </Overlay>
    </span>
  );
};

interface ToggletipProps {
  /** the trigger, cloned with an onClick and aria-expanded/aria-controls,
   *  same pattern as the Tooltip children. typically a Btn or Icon */
  children: React.ReactElement<TooltipAnchorProps>;
  content: React.ReactNode;
  position?: TipPosition;
  'aria-label'?: string;
}

export const Toggletip: React.FC<ToggletipProps> = ({ children, content, position = 'bottom', ...aria }) => {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const ref = React.useRef<HTMLSpanElement>(null);
  // portalled out of the anchor, so the outside-click check has to know about
  // it for the same reason as Menu
  const boxRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [ref, boxRef]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {React.cloneElement(children, {
        'aria-label': aria['aria-label'] ?? children.props['aria-label'],
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: () => setOpen(o => !o),
      })}
      {open && (
        <Overlay open={open} anchor={triggerOf(ref.current)} position={position} id={id}>
          {(p) => (
          <div ref={boxRef} role="dialog" style={{
            position: 'relative',
            background: 'var(--modal-bg)', color: 'var(--text)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--elevation-2)',
            padding: 'var(--space-3)', minWidth: '12rem', maxWidth: '18rem',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
          }}>
            {content}
            <Caret p={p} background="var(--modal-bg)" />
          </div>
          )}
        </Overlay>
      )}
    </span>
  );
};

// --- Menu ---
//
// carbon dropdown/overflow menu, grounded in how their real OverflowMenu
// and Menu/MenuItem behave (deepwiki: carbon-design-system/carbon, "button,
// tooltip, and overflow components": floating positioned, wrapfocus based
// arrow-key cycling with no dead end at either edge, flipped alignment for
// edge-of-screen cases). this kit version reuses the Toggletip exact
// trigger/dismiss shell (same anchor clone, same outside-click/Escape
// handling) and adds the one thing a menu needs that a toggletip free-form
// content does not: roving arrow-key navigation between items.
//
// placement is the shared Overlay one, so a menu flips away from a screen edge
// and clamps inside it exactly like a tooltip does

export interface MenuItemDef {
  id: string;
  label: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const MenuItemButton: React.FC<{
  item: MenuItemDef;
  index: number;
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  onActivate: (item: MenuItemDef) => void;
  onHoverIndex: (index: number) => void;
}> = ({ item, index, itemRefs, onActivate, onHoverIndex }) => {
  // own hover state per item, same pattern as Btn/SidebarButton/
  // BreadcrumbLink, not a direct dom mutation, so every interactive
  // element in this kit tracks hover the same way
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      ref={el => { itemRefs.current[index] = el; }}
      type="button" role="menuitem" disabled={item.disabled} tabIndex={-1}
      onClick={() => onActivate(item)}
      onMouseEnter={() => { setHovered(true); onHoverIndex(index); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        background: hovered && !item.disabled ? 'var(--hover)' : 'none',
        padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit', fontSize: 'inherit',
        color: item.disabled ? 'var(--text3)' : item.danger ? 'var(--err)' : 'var(--text)',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        opacity: item.disabled ? 0.5 : 1,
        transition: 'background var(--transition-base)',
      }}
    >
      {item.label}
    </button>
  );
};

interface MenuProps {
  /** the trigger, cloned with onClick (toggles) and aria-expanded/
   *  aria-haspopup/aria-controls, same anchor pattern as Toggletip */
  children: React.ReactElement<TooltipAnchorProps>;
  items: MenuItemDef[];
  position?: TipPosition;
  'aria-label'?: string;
}

export const Menu: React.FC<MenuProps> = ({ children, items, position = 'bottom', ...aria }) => {
  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const id = React.useId();
  const ref = React.useRef<HTMLSpanElement>(null);
  // the box is portalled out of the anchor, so the outside-click check has to
  // know about it: a click on an item is outside the anchor by dom, and would
  // otherwise dismiss the menu before the click could land on the item
  const boxRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    // focus lands on the first item the same frame the menu opens,
    // arrow keys work immediately, no extra Tab needed
    itemRefs.current[0]?.focus({ preventScroll: true });
  }, [open ]);

  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [ref, boxRef]);

  function focusIndex(next: number): void {
    setActiveIdx(next);
    itemRefs.current[next]?.focus({ preventScroll: true });
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    rovingKey(e, activeIdx, items.length, focusIndex, true);
  }

  function activate(item: MenuItemDef): void {
    if (item.disabled) return;
    haptic(item.danger ? 'error' : 'tap'); // same haptic rule Btn uses
    item.onClick?.();
    setOpen(false);
  }

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {React.cloneElement(children, {
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: () => setOpen(o => !o),
      })}
      {open && (
        <Overlay open={open} anchor={triggerOf(ref.current)} position={position} align="start" gap="var(--space-1)" id={id}>
          <div
            ref={boxRef}
            role="menu" aria-label={aria['aria-label']} onKeyDown={onKeyDown}
            style={{
              display: 'flex', flexDirection: 'column',
              background: 'var(--modal-bg)', border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-sm)', boxShadow: 'var(--elevation-2)',
              padding: 'var(--space-1)', minWidth: '10rem',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
            }}
          >
            {items.map((item, idx) => (
              <MenuItemButton
                key={item.id} item={item} index={idx} itemRefs={itemRefs}
                onActivate={activate} onHoverIndex={setActiveIdx}
              />
            ))}
          </div>
        </Overlay>
      )}
    </span>
  );
};

// --- SplitButton ---
//
// a primary action with a side menu of alternative actions: the shape every
// "run" style control reaches for when one default plus a few choices beats
// one button plus a dialog. built from Btn and Menu rather than a parallel
// implementation, so the shared border, hover and focus behavior come from
// the same places they do everywhere else. the two segments read as one
// control: the primary carries the left corners, the trigger the right ones,
// and the seam is a single border. the caret half carries `height: 100%`
// so it fills the menu wrapper span (the actual flex item, stretched to
// the row height) instead of keeping its own content height and ending a
// few px short of the primary half

interface SplitButtonProps {
  children: React.ReactNode;
  /** accessible name for the primary half. required whenever children carry no
   *  text of their own, since a tooltip only describes, it never names */
  'aria-label'?: string;
  onClick?: () => void;
  items: MenuItemDef[];
  size?: BtnSize;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  /** accessible name for the menu trigger, which shows only a caret. */
  menuLabel?: string;
  position?: TipPosition;
  tip?: string;
  tipPosition?: TipPosition;
  className?: string;
}

export const SplitButton: React.FC<SplitButtonProps> = ({
  children, onClick, items, size = 'md', variant = 'primary',
  disabled, loading, menuLabel = 'more', position = 'bottom',
  tip, tipPosition = 'top', className, ...aria
}) => (
  <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
    <Btn
      tip={tip} tipPosition={tipPosition} variant={variant} size={size}
      aria-label={aria['aria-label']}
      className={className} onClick={onClick} disabled={disabled} loading={loading}
      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
    >
      {children}
    </Btn>
    <Menu items={items} position={position} aria-label={menuLabel}>
      <Btn
        variant={variant} size={size} disabled={disabled} aria-label={menuLabel}
        style={{
          borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
          paddingLeft: 'var(--space-2)', paddingRight: 'var(--space-2)',
          // the menu wraps the trigger in a span for its outside-click
          // bookkeeping, and that span is what stretches to the row height.
          // without this the caret half keeps its own content height and
          // ends a few px short of the primary half it is seamed to
          height: '100%',
        }}
      >
        {/* the same mark the accordion and the tree use, so every disclosure in the
            kit points the same way */}
        <Chevron dir="down" />
      </Btn>
    </Menu>
  </div>
);

// --- TabStrip ---
//
// the shared tab rail an editor and a terminal panel both use, so the two
// read as the same control instead of two hand-built near-matches. it
// carries the pieces every real tab strip needs and none that are optional
// to hide: a leading icon, a trailing badge (a dirty dot), a close control,
// middle-click close, and an inline rename on double click or F2. controlled
// throughout: the caller owns the order and which id is active.

export interface TabStripItem {
  id: string;
  label: React.ReactNode;
  icon?: string;
  badge?: React.ReactNode;
  closable?: boolean;
  title?: string;
  /** accessible name for the close control, e.g. "close main.go". */
  closeLabel?: string;
}

interface TabStripProps {
  tabs: TabStripItem[];
  active: string;
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onAuxClick?: (id: string) => void;
  'aria-label'?: string;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs, active, onSelect, onClose, onRename, onAuxClick, ...aria
}) => {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const refs = React.useRef<Record<string, HTMLDivElement | null>>({});

  function focusId(id: string): void { refs.current[id]?.focus(); }

  function beginRename(id: string): void {
    const tab = tabs.find((t) => t.id === id);
    if (!tab || !onRename) return;
    setDraft(typeof tab.label === 'string' ? tab.label : '');
    setEditing(id);
  }

  function commitRename(): void {
    if (editing && draft.trim()) onRename?.(editing, draft.trim());
    setEditing(null);
  }

  function onKeyDown(e: React.KeyboardEvent, tab: TabStripItem): void {
    const idx = tabs.findIndex((t) => t.id === tab.id);
    const n = tabs.length;
    if (e.key === 'ArrowRight') { e.preventDefault(); focusId(tabs[(idx + 1) % n].id); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); focusId(tabs[(idx - 1 + n) % n].id); }
    else if (e.key === 'Home') { e.preventDefault(); focusId(tabs[0].id); }
    else if (e.key === 'End') { e.preventDefault(); focusId(tabs[n - 1].id); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(tab.id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (onClose) { e.preventDefault(); onClose(tab.id); } }
    else if (e.key === 'F2') { e.preventDefault(); beginRename(tab.id); }
  }

  return (
    <div role="tablist" aria-label={aria['aria-label']} style={{ display: 'flex' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const isEditing = editing === tab.id;
        return (
          <div
            key={tab.id}
            ref={el => { refs.current[tab.id] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            title={isEditing ? undefined : tab.title}
            onClick={() => onSelect?.(tab.id)}
            onAuxClick={(e) => { if (e.button === 1) onAuxClick?.(tab.id); }}
            onDoubleClick={() => beginRename(tab.id)}
            onKeyDown={(e) => onKeyDown(e, tab)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRight: 'var(--border-width) solid var(--border2)',
              whiteSpace: 'nowrap', userSelect: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
              color: isActive ? 'var(--text)' : 'var(--text3)',
              background: isActive ? 'var(--bg)' : 'transparent',
              boxShadow: isActive ? 'inset 0 0.125rem 0 var(--accent)' : undefined,
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {tab.icon && <Icon name={tab.icon} size="sm" aria-hidden="true" />}
            {isEditing ? (
              <input
                value={draft}
                autoFocus
                aria-label={tab.title}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                  e.stopPropagation();
                }}
                onBlur={commitRename}
                style={{
                  fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
                  color: 'var(--text)', background: 'var(--bg2)',
                  border: 'var(--border-width) solid var(--accent)',
                  borderRadius: 'var(--radius-input)', padding: '0 var(--space-1)',
                  width: '8rem', outline: 'none',
                }}
              />
            ) : (
              <span>{tab.label}</span>
            )}
            {tab.badge}
            {tab.closable && (
              // a span role=button rather than a real button: a native button
              // nested inside role=tab is invalid semantics, and the editor tab
              // already uses this pattern for its close control
              <span
                role="button"
                tabIndex={0}
                aria-label={tab.closeLabel ?? 'close'}
                onClick={(e) => { e.stopPropagation(); onClose?.(tab.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClose?.(tab.id); } }}
                style={{
                  display: 'inline-flex', alignItems: 'center', lineHeight: 1, fontFamily: 'var(--font-icon)',
                  fontSize: 'var(--text-xs)', color: 'var(--text3)', padding: '0 var(--space-1)',
                }}
              >
                times
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- Link ---
//
// carbon styled anchor. underline is always on, not hover-only, which is
// more discoverable and sidesteps needing hover-state machinery for
// something this small. `disabled` makes it inert without removing it
// from the layout, the usual disabled treatment elsewhere in this kit:
// dim, not gone

interface LinkProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const Link: React.FC<LinkProps> = ({ href, onClick, children, disabled, style }) => (
  <a
    href={disabled ? undefined : href}
    onClick={disabled ? undefined : (onClick ? (e => { if (!href) e.preventDefault(); onClick(); }) : undefined)}
    aria-disabled={disabled || undefined}
    style={{
      fontFamily: 'var(--font-ui)',
      color: disabled ? 'var(--text3)' : 'var(--accent)',
      textDecoration: 'underline', textUnderlineOffset: '0.125rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'color var(--transition-base)',
      ...style,
    }}
  >
    {children}
  </a>
);

// --- List ---
//
// a thin style wrapper around <ul>/<ol>. native list semantics already
// give the right aria/screen-reader behavior for free, so this only
// standardizes spacing/font/color instead of reinventing roles. children
// are plain <li>, there is no ListItem component because there is nothing
// per-item to standardize beyond what the browser already does

interface ListProps {
  children: React.ReactNode;
  ordered?: boolean;
  style?: React.CSSProperties;
}

export const List: React.FC<ListProps> = ({ children, ordered, style }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{
      fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text)',
      margin: 0, paddingLeft: 'var(--space-5)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
      ...style,
    }}>
      {children}
    </Tag>
  );
};

// --- CopyButton / CodeSnippet ---
//
// carbon splits these three ways (copy the clipboard action, copybutton
// the icon-button wrapper, codesnippet the code display that uses
// copybutton internally). this kit collapses copy into copybutton since
// nothing else in this codebase needs the bare clipboard action on its
// own, but keeps copybutton separately exported since a consumer might
// want a copy affordance next to something that is not a code block (an
// API key, a share link).
//
// icon-swap on success (clipboard -> checked) mirrors the Checkbox own
// checked/unchecked glyph swap, same idiom, not a new one

interface CopyButtonProps {
  text: string;
  'aria-label'?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, ...aria }) => {
  const [copied, setCopied] = React.useState(false);

  async function onClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API can throw in an insecure context or without permission,
      // so the button simply does not confirm; there is no secondary copy
      // path worth building for that edge case
      return;
    }
    haptic('tap');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button" onClick={onClick}
      aria-label={aria['aria-label'] ?? (copied ? 'copied' : 'copy')}
      style={{
        fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)', lineHeight: 1,
        background: 'none', border: 'var(--border-width) solid var(--border2)',
        borderRadius: 'var(--radius-sm)', padding: 'var(--space-1)',
        display: 'inline-flex', flexShrink: 0,
        color: copied ? 'var(--ok)' : 'var(--text2)', cursor: 'pointer',
        transition: 'color var(--transition-base), border-color var(--transition-base)',
      }}
    >
      {copied ? 'checked' : 'clipboard'}
    </button>
  );
};

interface CodeSnippetProps {
  children: string;
  /** a short inline chip (a variable name, a command) vs a block with
   *  its own CopyButton (a full snippet) */
  inline?: boolean;
  'aria-label'?: string;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({ children, inline, ...aria }) => {
  // guaranteed monospace regardless of theme, reads --font-mono directly
  // rather than the textMono helper (which despite its name reads
  // --font-ui, see that helper own comment). a code display that
  // silently followed a theme ui font would defeat the point of it
  const codeFont: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' };
  if (inline) {
    return (
      <code style={{
        ...codeFont,
        background: 'var(--bg2)', border: 'var(--border-width) solid var(--border2)',
        borderRadius: 'var(--radius-sm)', padding: '0.125rem var(--space-1)',
      }}>
        {children}
      </code>
    );
  }
  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg2)', border: 'var(--border-width) solid var(--border2)',
      borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)',
    }}>
      {/* the global code/pre rule (tokens.css) boxes every code and pre on
          its own, so a pre>code snippet would draw a box inside a box. the
          inner elements neutralize that rule here: the outer div is the only
          box, and padding-right leaves room for the copy button */}
      <pre style={{ ...codeFont, margin: 0, padding: 0, paddingRight: 'var(--space-8)',
        background: 'none', border: 0, overflowX: 'auto', whiteSpace: 'pre' }}>
        <code style={{ fontFamily: 'inherit', fontSize: 'inherit',
          background: 'none', border: 0, padding: 0 }}>{children}</code>
      </pre>
      <div style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}>
        <CopyButton text={children} aria-label={aria['aria-label']} />
      </div>
    </div>
  );
};

// --- InlineLoading ---
//
// carbon loading to success/fail state-transition wrapper around a
// spinner, distinct from the bare Spinner primitive, which never
// resolves to anything. role=status/aria-live=polite so the transition
// itself is announced, not just readable if a screen-reader user happens
// to focus it

type InlineLoadingStatus = 'loading' | 'success' | 'error';

interface InlineLoadingProps {
  status: InlineLoadingStatus;
  children?: React.ReactNode;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({ status, children }) => (
  <div role="status" aria-live="polite" style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text2)',
  }}>
    {status === 'loading' && <Spinner />}
    {status === 'success' && <Icon name="checked" size="sm" style={{ color: 'var(--ok)' }} />}
    {status === 'error' && <Icon name="times" size="sm" style={{ color: 'var(--err)' }} />}
    {children}
  </div>
);

// --- ContentSwitcher ---
//
// carbon segmented-button switcher, the gap note own framing: Tabs
// covers "which panel", this covers "pick exactly one of N options"
// without implying a panel exists at all (a view-mode toggle, a unit
// switch). that is a radiogroup, not a tablist, so role=radiogroup and
// role=radio here instead of role=tablist and role=tab is the deliberate
// choice, not an oversight. arrow keys move focus and select immediately
// (native radio-group behavior), Home/End jump to the ends, wrapping at
// both, the same shape as the Tabs own ArrowRight/Left/Home/End table
// just on radio semantics instead of tab semantics

interface ContentSwitcherOption {
  id: string;
  label: string;
}

interface ContentSwitcherProps {
  options: ContentSwitcherOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
}

export const ContentSwitcher: React.FC<ContentSwitcherProps> = ({ options, value, onChange, ...aria }) => {
  const { refs: itemRefs, onKeyDown, move } = useRoving<HTMLButtonElement>(options.length, next => {
    haptic('tap'); // same commit-time rule Tabs uses for its own selection change
    onChange(options[next].id);
  }, true);

  return (
    <div role="radiogroup" aria-label={aria['aria-label']} style={{
      display: 'inline-flex', border: 'var(--border-width) solid var(--border)',
      borderRadius: 'var(--radius-input)', overflow: 'hidden',
    }}>
      {options.map((opt, idx) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id} ref={el => { itemRefs.current[idx] = el; }}
            type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
            onClick={() => move(idx)}
            onKeyDown={e => onKeyDown(e, idx)}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
              padding: 'var(--space-2) var(--space-3)', border: 'none',
              borderRight: idx < options.length - 1 ? 'var(--border-width) solid var(--border)' : 'none',
              background: selected ? 'var(--accent)' : 'transparent',
              color: selected ? 'var(--on-accent)' : 'var(--text)',
              cursor: 'pointer',
              transition: 'background var(--transition-base), color var(--transition-base)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// --- ChipRow ---

export interface ChipRowOption {
  id: string;
  label: React.ReactNode;
}

interface ChipRowProps {
  options: ChipRowOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
}

// the scrollable sibling of the segmented switcher. same radiogroup
// semantics and the same roving keyboard model, but the options wrap in
// an overflow-x row of chips instead of a clipped segment strip, so a
// line with many branches keeps every choice reachable with a swipe.
// reach for this over ContentSwitcher whenever the option count is
// unbounded (branches, filters); keep the switcher for two or three
// fixed modes.
export const ChipRow: React.FC<ChipRowProps> = ({ options, value, onChange, ...aria }) => {
  const { refs, onKeyDown, move } = useRoving<HTMLButtonElement>(options.length, next => {
    haptic('tap');
    onChange(options[next].id);
  }, false);

  return (
    <div role="radiogroup" aria-label={aria['aria-label']} style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
      {options.map((opt, idx) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id} ref={el => { refs.current[idx] = el; }}
            type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
            onClick={() => move(idx)}
            onKeyDown={e => onKeyDown(e, idx)}
            style={{
              flexShrink: 0, minHeight: 'var(--space-10)',
              padding: 'var(--space-1) var(--space-3)',
              background: selected ? 'var(--accent)' : 'var(--bg2)',
              border: 'var(--border-width) solid',
              borderColor: selected ? 'var(--accent)' : 'var(--border)',
              borderRadius: 'var(--radius-btn)',
              color: selected ? 'var(--on-accent)' : 'var(--text2)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// --- PalettePicker ---

export interface PaletteOption {
  id: string;
  label: string;
  hint: string;
  /** miniature of the palette: surface, raised surface, accent. */
  swatch: [string, string, string] | null;
}

interface PalettePickerProps {
  palettes: PaletteOption[];
  value: string;
  onChange: (id: string) => void;
  /** accessible name for the radiogroup. */
  'aria-label'?: string;
  note?: React.ReactNode;
}

// a radiogroup of palettes with a visual swatch per option. a two-
// position switcher cannot express five palettes and cannot show what
// one looks like; each option here carries the three colors that define
// it, so the choice is made by looking rather than by reading. the
// caller owns the palette data (kit THEMES, app themes, or both) and the
// persistence; this only owns the radio semantics and the swatch shape.
export const PalettePicker: React.FC<PalettePickerProps> = ({ palettes, value, onChange, note, ...aria }) => {
  const order = palettes.map(p => p.id);
  const { refs, onKeyDown, move } = useRoving<HTMLButtonElement>(order.length, next => {
    haptic('tap');
    onChange(order[next]);
  }, false);

  return (
    <div role="radiogroup" aria-label={aria['aria-label']}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {palettes.map((opt, idx) => {
          const selected = opt.id === value;
          return (
            <button
              key={opt.id}
              ref={el => { refs.current[idx] = el; }}
              type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
              onClick={() => move(idx)}
              onKeyDown={e => onKeyDown(e, idx)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                background: selected ? 'var(--accent)' : 'var(--bg2)',
                border: 'var(--border-width) solid',
                borderColor: selected ? 'var(--accent)' : 'var(--border)',
                borderRadius: 'var(--radius-btn)',
                color: selected ? 'var(--on-accent)' : 'var(--text)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              <span aria-hidden="true" style={{ display: 'flex', gap: 0 }}>
                {opt.swatch ? opt.swatch.map((c, i) => (
                  <span key={i} style={{ width: '1rem', height: '1rem', background: c }} />
                )) : null}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)' }}>{opt.label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', opacity: 0.8 }}>{opt.hint}</span>
            </button>
          );
        })}
      </div>
      {note && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>{note}</span>}
    </div>
  );
};

// --- ProgressIndicator ---
//
// carbon step-sequence progress, distinct from ProgressBar which tracks
// a single continuous fraction. status per step is computed from
// `currentIndex`/`invalidIndex` rather than passed in per step, so there
// is one source of truth instead of the caller having to keep N statuses
// in sync with a single current position. color alone carries
// complete/current/invalid (StatusDot does the same rather than needing
// filled-vs-outline glyph variants)

interface ProgressStepDef {
  id: string;
  label: string;
}

type ProgressStepStatus = 'complete' | 'current' | 'incomplete' | 'invalid';

interface ProgressIndicatorProps {
  steps: ProgressStepDef[];
  currentIndex: number;
  invalidIndex?: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ steps, currentIndex, invalidIndex }) => (
  <ol style={{ display: 'flex', alignItems: 'flex-start', width: '100%', margin: 0, padding: 0, listStyle: 'none' }}>
    {steps.map((step, idx) => {
      const status: ProgressStepStatus =
        idx === invalidIndex ? 'invalid' :
        idx < currentIndex ? 'complete' :
        idx === currentIndex ? 'current' : 'incomplete';
      const color =
        status === 'complete' ? 'var(--ok)' :
        status === 'invalid' ? 'var(--err)' :
        status === 'current' ? 'var(--accent)' : 'var(--border)';
      return (
        <li
          key={step.id}
          aria-current={status === 'current' ? 'step' : undefined}
          style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : undefined }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
            <span aria-hidden="true" style={{
              width: 'var(--space-4)', height: 'var(--space-4)', borderRadius: 'var(--radius-pill)',
              border: `var(--border-width) solid ${color}`,
              background: status === 'complete' || status === 'current' ? color : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontFamily: 'var(--font-icon)', fontSize: 'var(--text-xs)', color: 'var(--on-accent)',
            }}>
              {status === 'complete' ? 'checked' : status === 'invalid' ? 'times' : ''}
            </span>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
              color: status === 'incomplete' ? 'var(--text3)' : 'var(--text)',
            }}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div aria-hidden="true" style={{
              flex: 1, height: 'var(--border-width)', margin: '0 var(--space-2)', marginBottom: '1.25rem',
              background: idx < currentIndex ? 'var(--ok)' : 'var(--border)',
            }} />
          )}
        </li>
      );
    })}
  </ol>
);

// --- Search ---
//
// Input with a search icon, a clear button that only appears once there
// is something to clear, and an optional debounce. the debounce only
// delays the onChange callback, not the visible text, since local state
// updates every keystroke either way, so the field never feels laggy even
// when the caller is debouncing an expensive search

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
}

export const Search: React.FC<SearchProps> = ({ value, onChange, placeholder, debounceMs = 0, size = 'md', ...aria }) => {
  const [local, setLocal] = React.useState(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => { setLocal(value); }, [value]);

  function handleChange(v: string): void {
    setLocal(v);
    if (debounceMs > 0) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(v), debounceMs);
    } else {
      onChange(v);
    }
  }

  function clear(): void {
    if (timer.current) clearTimeout(timer.current);
    setLocal('');
    onChange('');
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: 'var(--space-2)', pointerEvents: 'none',
        fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)', color: 'var(--text3)',
      }}>
        magnifier
      </span>
      <Input
        type="search" value={local} onChange={handleChange}
        placeholder={placeholder ?? 'search'} size={size}
        aria-label={aria['aria-label'] ?? 'search'}
        style={{ paddingLeft: 'var(--space-6)', paddingRight: local ? 'var(--space-6)' : undefined }}
      />
      {local && (
        <button
          type="button" onClick={clear} aria-label="clear search"
          style={{
            position: 'absolute', right: 'var(--space-2)', padding: 0, lineHeight: 1,
            fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)',
            background: 'none', border: 'none', color: 'var(--text3)',
            display: 'inline-flex', cursor: 'pointer',
          }}
        >
          times
        </button>
      )}
    </div>
  );
};

// --- ComboBox ---
//
// carbon real ComboBox/Dropdown keyboard model, checked directly (the
// v10 dropdown usage doc plus the angular implementation combobox
// source, both consulted rather than assumed): the field itself holds
// focus the entire time, arrow keys move a highlighted option, typing
// filters, Enter commits, Escape closes. one component covers both shapes
// carbon splits into ComboBox/Dropdown via a `multiple` prop, matching
// that same source own multi branching rather than building two
// components that would drift from each other. multi-select chosen items
// render as removable Tag pills above the field, the same widely-used
// shape the angular source own pills terminology names directly.
//
// uses aria-activedescendant (the wai-aria combobox pattern) instead of
// moving real dom focus into the list: the input never loses focus while
// browsing options, aria-activedescendant just tells assistive tech which
// option is active. list items commit via `onMouseDown` plus
// `preventDefault()` specifically so a click never blurs the input first,
// so no ref/imperative focus() call is needed to restore it afterward

export interface ComboBoxOption {
  value: string;
  label: string;
}

interface ComboBoxProps {
  options: ComboBoxOption[];
  multiple?: boolean;
  /** single-select: the selected value, or null. multi-select: the array
   *  of selected values */
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export const ComboBox: React.FC<ComboBoxProps> = ({ options, multiple, value, onChange, placeholder, ...aria }) => {
  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : (value ? [value as string] : []);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(o =>
      (!multiple || !selectedValues.includes(o.value)) &&
      (q === '' || o.label.toLowerCase().includes(q))
    );
  }, [options, query, multiple, selectedValues]);

  React.useEffect(() => { setHighlight(0); }, [filtered.length, open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function commit(opt: ComboBoxOption): void {
    haptic('tap');
    setQuery('');
    if (multiple) {
      onChange([...selectedValues, opt.value]);
    } else {
      onChange(opt.value);
      setOpen(false);
    }
  }

  function removePill(v: string): void {
    onChange(selectedValues.filter(x => x !== v));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) { e.preventDefault(); commit(filtered[highlight]); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    } else if (e.key === 'Backspace' && query === '' && multiple && selectedValues.length > 0) {
      onChange(selectedValues.slice(0, -1));
    }
  }

  const singleLabel = !multiple && value ? (options.find(o => o.value === value)?.label ?? '') : '';
  const activeId = open && filtered[highlight] ? `${listId}-${highlight}` : undefined;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {multiple && selectedValues.length > 0 && (
        <div style={{ ...row('var(--space-1)'), marginBottom: 'var(--space-1)' }}>
          {selectedValues.map(v => {
            const opt = options.find(o => o.value === v);
            return <Tag key={v} variant="gray" onDismiss={() => removePill(v)}>{opt?.label ?? v}</Tag>;
          })}
        </div>
      )}
      <Input
        value={open || query || multiple ? query : singleLabel}
        onChange={v => { setQuery(v); setOpen(true); if (!multiple && value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={aria['aria-label']}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
      />
      {open && filtered.length > 0 && (
        <ul id={listId} role="listbox" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 'var(--space-1)',
          background: 'var(--modal-bg)', border: 'var(--border-width) solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--elevation-2)',
          maxHeight: '12rem', overflowY: 'auto', padding: 'var(--space-1)', margin: 0, listStyle: 'none',
          zIndex: 'var(--z-tooltip)' as any,
        }}>
          {filtered.map((opt, idx) => (
            <li
              key={opt.value} id={`${listId}-${idx}`} role="option" aria-selected={idx === highlight}
              onMouseDown={e => { e.preventDefault(); commit(opt); }}
              onMouseEnter={() => setHighlight(idx)}
              style={{
                padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                background: idx === highlight ? 'var(--hover)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- DataTable ---
//
// carbon real DataTable, checked directly (their github README plus docs
// site, not assumed): tri-state sort per column (unsorted -> ascending
// -> descending -> back to unsorted, clicking a different column resets
// it to ascending), row selection via checkboxes with a batch-action bar
// replacing the toolbar once anything is selected, filtering through a
// search field. one real carbon choice adopted deliberately: no zebra
// striping, row dividers instead, which was already this kit own instinct
// (borders as the definition mechanism, not alternating fills), so nothing
// to reconcile there.
//
// selection is fully controlled, decoupled from any hook, the same
// convention Pager already uses: the `useSelection` hook in this file
// produces exactly the `selected`/`onToggleRow`/`onSelectAll`/
// `onClearSelection` shape this component expects, but nothing here
// reaches into that hook directly. sort state is internal-only (no
// controlled variant), a deliberate scope cut and not an oversight:
// exposing it added real prop surface for a case nothing in this batch
// needed yet

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** right-aligns the column, the carbon rule for numeric or variable
   *  values (prices, percentages); left stays the default for everything
   *  else including headers */
  numeric?: boolean;
  render?: (row: T) => React.ReactNode;
}

type SortDirection = 'asc' | 'desc';

interface DataTableProps<T extends { id: string }> {
  columns: DataTableColumn<T>[];
  rows: T[];
  selected?: Set<string>;
  onToggleRow?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  /** rendered in the batch-action bar, next to the built-in cancel
   *  button, once `selected` is non-empty */
  batchActions?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  'aria-label'?: string;
}

export function DataTable<T extends { id: string }>({
  columns, rows, selected, onToggleRow, onSelectAll, onClearSelection,
  batchActions, searchable, searchPlaceholder, ...aria
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc');
  const [query, setQuery] = React.useState('');

  const selectable = !!onToggleRow;

  function toggleSort(key: string): void {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') { setSortDir('desc'); }
    else { setSortKey(null); }
  }

  const filtered = React.useMemo(() => {
    if (!searchable || !query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => columns.some(col => String((r as Record<string, unknown>)[col.key] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchable, columns]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const allIds = sorted.map(r => r.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every(id => selected?.has(id));
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div style={stack('var(--space-2)')}>
      {selectable && selected && selected.size > 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
          background: 'var(--accent)', color: 'var(--on-accent)',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)' }}>
            {selected.size} selected
          </span>
          <div style={row('var(--space-2)')}>
            {batchActions}
            <Btn size="sm" variant="ghost" onClick={onClearSelection} style={{ color: 'var(--on-accent)' }}>
              cancel
            </Btn>
          </div>
        </div>
      ) : searchable ? (
        <Search value={query} onChange={setQuery} placeholder={searchPlaceholder} />
      ) : null}

      <table
        aria-label={aria['aria-label']}
        style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)' }}
      >
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '2.5rem', padding: 'var(--space-2)', borderBottom: 'var(--border-width) solid var(--border)' }}>
                <Checkbox
                  checked={!!allSelected}
                  onChange={() => (allSelected ? onClearSelection?.() : onSelectAll?.(allIds))}
                  label={<span style={srOnly}>select all rows</span>}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                aria-sort={
                  sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending')
                    : col.sortable ? 'none' : undefined
                }
                style={{
                  textAlign: col.numeric ? 'right' : 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  borderBottom: 'var(--border-width) solid var(--border)',
                  color: 'var(--text2)', fontWeight: 700,
                  cursor: col.sortable ? 'pointer' : undefined,
                  userSelect: col.sortable ? 'none' : undefined,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  {col.label}
                  {col.sortable && (
                    <Chevron dir={sortKey === col.key ? (sortDir === 'asc' ? 'up' : 'down') : 'right'}
                      style={{ opacity: sortKey === col.key ? 1 : 0.35 }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => {
            const isSelected = selected?.has(r.id) ?? false;
            return (
              <tr key={r.id} style={{
                background: isSelected ? 'var(--hover)' : undefined,
                borderBottom: 'var(--border-width) solid var(--border2)',
              }}>
                {selectable && (
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleRow?.(r.id)}
                      label={<span style={srOnly}>select row {idx + 1}</span>}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key} style={{ padding: 'var(--space-2) var(--space-3)', textAlign: col.numeric ? 'right' : 'left' }}>
                    {col.render ? col.render(r) : String((r as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={colSpan} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text3)' }}>
                no results
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- FileUploader ---
//
// carbon real interaction model, checked against their official usage
// and accessibility docs (not assumed): the drop target is built as a
// genuine button so it is keyboard-operable on its own, not just a drop
// target that happens to also accept clicks. Tab moves from the drop
// button straight to each uploaded file own "x" delete button, with no
// separate focus stop for the file row itself, matching the documented
// carbon tab order exactly. uploaded files render as a real `<ul>`/`<li>`
// list (an a11y issue in their own tracker flagged exactly this when it
// was missing, adopted here from the start rather than fixed later)

export interface FileUploaderFile {
  id: string;
  name: string;
  status: 'uploading' | 'complete' | 'error';
  errorMessage?: string;
}

const FILE_STATUS_MAP: Record<FileUploaderFile['status'], InlineLoadingStatus> = {
  uploading: 'loading', complete: 'success', error: 'error',
};

interface FileUploaderProps {
  files: FileUploaderFile[];
  onAdd: (fileList: FileList) => void;
  onRemove: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  'aria-label'?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  files, onAdd, onRemove, accept, multiple = true,
  label = 'drag and drop files here, or click to browse', ...aria
}) => {
  const [dragOver, setDragOver] = React.useState(false);
  const inputId = React.useId();

  function handleFiles(list: FileList | null): void {
    if (list && list.length > 0) onAdd(list);
  }

  return (
    <div style={stack('var(--space-3)')}>
      <input
        type="file" id={inputId} accept={accept} multiple={multiple}
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
        style={srOnly}
      />
      <label
        htmlFor={inputId} tabIndex={0} role="button"
        aria-label={aria['aria-label'] ?? label}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById(inputId)?.click();
          }
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-6)', textAlign: 'center', cursor: 'pointer',
          border: `var(--border-width) dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-card)',
          background: dragOver ? 'var(--hover)' : 'var(--bg2)',
          color: 'var(--text2)', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
          transition: 'background var(--transition-base), border-color var(--transition-base)',
        }}
      >
        {label}
      </label>

      {files.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {files.map(f => (
            <li key={f.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              border: 'var(--border-width) solid var(--border2)', borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {f.name}
              </span>
              <div style={row('var(--space-2)')}>
                <InlineLoading status={FILE_STATUS_MAP[f.status]}>
                  {f.status === 'error' ? (f.errorMessage ?? 'upload failed') : undefined}
                </InlineLoading>
                <button
                  type="button" onClick={() => onRemove(f.id)} aria-label={`remove ${f.name}`}
                  style={{
                    fontFamily: 'var(--font-icon)', fontSize: 'var(--text-sm)', lineHeight: 1,
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', padding: 0, display: 'inline-flex', flexShrink: 0,
                  }}
                >
                  times
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- TreeView ---
//
// the wai-aria treeview keyboard pattern (not carbon specific, carbon own
// current component list does not ship a first-party tree view, so there
// is nothing of theirs to check against here; this follows the standard
// authoring-practices pattern instead). fully controlled
// (`expanded`/`onToggleExpand`, `selected`/`onSelect`), the same choice
// DataTable makes for its own state, for the same reason: a caller
// managing a filesystem-shaped tree already has its own source of truth
// for what is open, this does not need a second one internally.
//
// roving tabindex across the visible (expanded-respecting) node list,
// not the full tree, because a collapsed subtree nodes are genuinely
// untabbable, not just hidden

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  /** picon name overriding the default folder/file mark, e.g. a language
   *  icon the caller resolved. folders keep the open/closed pair unless
   *  this is set */
  icon?: string;
  /** trailing status letter, e.g. a version control mark. muted, hidden
   *  from assistive tech so the label stays the accessible name */
  badge?: string;
}

interface FlatTreeNode { node: TreeNode; depth: number; parentId: string | null }

function flattenVisibleTree(nodes: TreeNode[], expanded: Set<string>, depth = 0, parentId: string | null = null): FlatTreeNode[] {
  const out: FlatTreeNode[] = [];
  for (const node of nodes) {
    out.push({ node, depth, parentId });
    if (node.children && node.children.length > 0 && expanded.has(node.id)) {
      out.push(...flattenVisibleTree(node.children, expanded, depth + 1, node.id));
    }
  }
  return out;
}

interface TreeViewProps {
  nodes: TreeNode[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected?: string;
  onSelect?: (id: string) => void;
  'aria-label'?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ nodes, expanded, onToggleExpand, selected, onSelect, ...aria }) => {
  const flat = React.useMemo(() => flattenVisibleTree(nodes, expanded), [nodes, expanded]);
  const [activeId, setActiveId] = React.useState<string>(flat[0]?.node.id ?? '');
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (flat.length > 0 && !flat.some(f => f.node.id === activeId)) {
      setActiveId(flat[0].node.id);
    }
  }, [flat, activeId]);

  function focusId(id: string): void {
    setActiveId(id);
    itemRefs.current[id]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, flatIdx: number): void {
    const current = flat[flatIdx];
    if (!current) return;
    const hasChildren = !!(current.node.children && current.node.children.length > 0);
    const isExpanded = expanded.has(current.node.id);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatIdx < flat.length - 1) focusId(flat[flatIdx + 1].node.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatIdx > 0) focusId(flat[flatIdx - 1].node.id);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (hasChildren && !isExpanded) onToggleExpand(current.node.id);
      else if (hasChildren && isExpanded && flatIdx < flat.length - 1) focusId(flat[flatIdx + 1].node.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (hasChildren && isExpanded) onToggleExpand(current.node.id);
      else if (current.parentId) focusId(current.parentId);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (flat[0]) focusId(flat[0].node.id);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (flat.length > 0) focusId(flat[flat.length - 1].node.id);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      haptic('tap');
      onSelect?.(current.node.id);
    }
  }

  return (
    <div role="tree" aria-label={aria['aria-label']} style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)' }}>
      {flat.map((f, idx) => {
        const hasChildren = !!(f.node.children && f.node.children.length > 0);
        const isExpanded = expanded.has(f.node.id);
        const isSelected = selected === f.node.id;
        const isActive = activeId === f.node.id;
        return (
          <div
            key={f.node.id} ref={el => { itemRefs.current[f.node.id] = el; }}
            role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={isSelected} aria-level={f.depth + 1}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={e => onKeyDown(e, idx)}
            onClick={() => { setActiveId(f.node.id); haptic('tap'); onSelect?.(f.node.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-2)',
              paddingLeft: `calc(${f.depth} * var(--space-4) + var(--space-2))`,
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: isSelected ? 'var(--accent)' : 'transparent',
              color: isSelected ? 'var(--on-accent)' : 'var(--text)',
            }}
          >
            {hasChildren ? (
              <span
                aria-hidden="true"
                onClick={e => { e.stopPropagation(); onToggleExpand(f.node.id); }}
                style={{ width: '1rem', flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}
              >
                {/* selected rows sit on accent, so the mark inherits the
                    row color there instead of keeping the muted idle color,
                    which has no contrast on that fill */}
                <Chevron dir={isExpanded ? 'down' : 'right'} style={isSelected ? { color: 'inherit' } : undefined} />
              </span>
            ) : (
              <span aria-hidden="true" style={{ width: '1rem', flexShrink: 0 }} />
            )}
            <Icon name={f.node.icon ?? (hasChildren ? (isExpanded ? 'folder2' : 'folder') : 'file')} size="sm" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.node.label}</span>
            {f.node.badge && (
              <span aria-hidden="true" title={f.node.badge} style={{
                marginLeft: 'auto', flexShrink: 0, paddingLeft: 'var(--space-2)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: isSelected ? 'inherit' : 'var(--text3)',
              }}>
                {f.node.badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- Toast ---

type ToastVariant = 'info' | 'ok' | 'warn' | 'err' | (string & {});

interface ToastItem { id: string; message: string; variant: ToastVariant }
interface ToastContextValue { push(message: string, variant?: ToastVariant, ms?: number): void }

const ToastCtx = React.createContext<ToastContextValue>({ push: () => {} });

export function useToast(): ToastContextValue { return React.useContext(ToastCtx); }

export const TOAST_COLOR: Record<string, string> = {
  info: 'var(--accent)', ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  function push(message: string, variant: ToastVariant = 'info', ms = 3500): void {
    const id = Math.random().toString(36).slice(2);
    if (variant === 'err') haptic('error');
    else if (variant === 'ok') haptic('confirm');
    setToasts(p => [...p, { id, message, variant }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), ms);
  }

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" aria-atomic="false" style={{
        position: 'fixed', bottom: 'var(--space-4)', right: 'var(--space-4)',
        zIndex: 'var(--z-toast)' as any,
        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = TOAST_COLOR[t.variant] ?? TOAST_COLOR.info;
          return (
            <div key={t.id} role="status"
              onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
              style={{
                background: 'var(--bg2)', color: 'var(--text)',
                border: 'var(--border-width) solid', borderColor: c,
                borderLeft: `0.25rem solid ${c}`,
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--elevation-2)',
                padding: 'var(--space-2) var(--space-3)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
                pointerEvents: 'auto', maxWidth: '20rem', cursor: 'pointer',
              }}>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
};

// --- Divider ---

interface DividerProps { orientation?: 'horizontal' | 'vertical'; label?: string }

export const Divider: React.FC<DividerProps> = ({ orientation = 'horizontal', label }) => {
  if (orientation === 'vertical') return (
    <div role="separator" aria-orientation="vertical"
      style={{ width: 'var(--border-width)', background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }} />
  );
  if (label) return (
    <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <div style={{ flex: 1, height: 'var(--border-width)', background: 'var(--border)' }} />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>{label}</span>
      <div style={{ flex: 1, height: 'var(--border-width)', background: 'var(--border)' }} />
    </div>
  );
  return (
    <div role="separator" aria-orientation="horizontal"
      style={{ height: 'var(--border-width)', background: 'var(--border)', width: '100%' }} />
  );
};

// --- Slider ---
//
// native <input type="range"> underneath (free keyboard support, free
// a11y) styled via the `.anto-slider` class in tokens.css, since
// thumb/track pseudo elements are not reachable from inline styles.
// haptic fires on commit (pointer release or arrow key), not on every drag
// tick, so it stays a single confirmation buzz rather than a motor
// buzzing under the thumb

interface SliderProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: React.ReactNode;
  /** show the numeric value next to the label, default true */
  showValue?: boolean;
  haptic?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value, onChange, min = 0, max = 100, step = 1, disabled,
  label, showValue = true, haptic: hapticOn = true, style, ...aria
}) => {
  const id = React.useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%' }}>
      {(label || showValue) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text3)',
        }}>
          <span>{label}</span>
          {showValue && <span>{value}</span>}
        </div>
      )}
      <input
        id={id}
        type="range"
        className="anto-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={aria['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
        onChange={onChange ? e => onChange(Number(e.target.value)) : undefined}
        onPointerUp={hapticOn ? () => haptic('toggle') : undefined}
        onKeyUp={hapticOn ? e => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') haptic('toggle');
        } : undefined}
        style={style}
      />
    </div>
  );
};

// --- Splitter ---
//
// a controlled resize handle between two panes. it owns the pointer
// gesture and reports the new size in rem (parsed against the root font
// size, the same rem discipline every other size token uses); the caller
// owns the pane size in state and clamps it. keyboard-operable per the
// a11y baseline: arrows nudge by one step, so a pane is resizable without
// a pointer. vertical is a vertical handle between left and right panes
// and grows to the right; horizontal is a horizontal handle between
// stacked panes and grows as it is dragged up

interface SplitterProps {
  orientation?: 'vertical' | 'horizontal';
  /** current pane size in rem */
  value: number;
  min?: number;
  max?: number;
  /** keyboard nudge in rem, default 1 */
  step?: number;
  onResize: (value: number) => void;
  /** fires true on drag start and false on drag end, so a caller can
   *  freeze its own transitions while the size is moving */
  onDragChange?: (dragging: boolean) => void;
  'aria-label'?: string;
}

export const Splitter: React.FC<SplitterProps> = ({
  orientation = 'vertical', value, min = 6, max, step = 1,
  onResize, onDragChange, ...aria
}) => {
  const [dragging, setDragging] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  function setFrom(next: number): void {
    let v = next;
    if (v < min) v = min;
    if (max !== undefined && v > max) v = max;
    onResize(v);
  }

  function onPointerDown(down: React.PointerEvent<HTMLDivElement>): void {
    down.currentTarget.setPointerCapture(down.pointerId);
    setDragging(true);
    onDragChange?.(true);
    const startAxis = orientation === 'vertical' ? down.clientX : down.clientY;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const onMove = (e: PointerEvent) => {
      const raw = orientation === 'vertical' ? e.clientX - startAxis : startAxis - e.clientY;
      setFrom(value + raw / remPx);
    };
    const onUp = () => {
      setDragging(false);
      onDragChange?.(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    // vertical grows on ArrowRight, horizontal grows on ArrowUp, matching
    // the drag direction each orientation already uses
    const grow = orientation === 'vertical' ? e.key === 'ArrowRight' : e.key === 'ArrowUp';
    const shrink = orientation === 'vertical' ? e.key === 'ArrowLeft' : e.key === 'ArrowDown';
    if (grow) { e.preventDefault(); setFrom(value + step); }
    else if (shrink) { e.preventDefault(); setFrom(value - step); }
  }

  const vertical = orientation === 'vertical';
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={aria['aria-label'] ?? 'resize'}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 'none',
        alignSelf: 'stretch',
        background: dragging || hovered ? 'var(--accent)' : 'var(--border2)',
        cursor: vertical ? 'col-resize' : 'row-resize',
        transition: 'background-color var(--transition-fast)',
        userSelect: 'none',
        touchAction: 'none',
        outlineOffset: '-0.125rem',
        ...(vertical ? { width: 'var(--space-2)' } : { height: 'var(--space-2)' }),
      }}
    />
  );
};

// --- NumberInput ---
//
// a stepper: Input numeric mode plus +/- buttons, composed from Btn and
// Input rather than a parallel implementation (same reasoning as
// ActionModal/FormField, built from existing exports, not raw dom).
// the three segments share one visual border by zeroing the two inner
// corners of each end and keeping only the group own outer corners on
// --radius-input, so a themed radius rounds the whole control once
// instead of three separate boxes

interface NumberInputProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  size?: BtnSize;
  'aria-label'?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, min, max, step = 1, disabled, size = 'md', ...aria
}) => {
  function clamp(n: number): number {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }
  function set(n: number): void {
    if (!onChange) return;
    const clamped = clamp(n);
    if (clamped !== value) onChange(clamped);
  }
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
      <Btn
        variant="default" size={size} disabled={disabled || atMin}
        aria-label="decrease" onClick={() => set(value - step)}
        style={{
          borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none',
          borderTopLeftRadius: 'var(--radius-input)', borderBottomLeftRadius: 'var(--radius-input)',
        }}
      >
        {/* the font has no minus glyph, and plus1 is symmetric under a half
            turn, so the two ends of the stepper are one glyph, not two marks */}
        <Icon name="plus1" size="xs" aria-hidden="true" style={{ transform: 'rotate(180deg)' }} />
      </Btn>
      <Input
        type="number" value={String(value)} disabled={disabled} size={size}
        aria-label={aria['aria-label'] ?? 'value'}
        onChange={v => { const n = Number(v); if (Number.isFinite(n)) set(n); }}
        style={{ width: '3.5rem', textAlign: 'center', borderRadius: 0 }}
      />
      <Btn
        variant="default" size={size} disabled={disabled || atMax}
        aria-label="increase" onClick={() => set(value + step)}
        style={{
          borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none',
          borderTopRightRadius: 'var(--radius-input)', borderBottomRightRadius: 'var(--radius-input)',
        }}
      >
        +
      </Btn>
    </div>
  );
};

// --- PageHeader ---

interface PageHeaderProps {
  title: string;
  /** one line (or two short ones) under the title: what this screen
   *  is for, or what state it is in. omit when the title already says
   *  everything */
  description?: React.ReactNode;
  /** count or status badge: whatever belongs beside the title rather
   *  than under it */
  meta?: React.ReactNode;
  /** buttons, right-aligned */
  actions?: React.ReactNode;
  /** caps the description width so it does not stretch edge-to-edge on a
   *  wide page, unset means no cap */
  descriptionMaxWidth?: string;
  /** back navigation. renders a ghost button with a left glyph before
   *  the title, so detail screens do not rebuild the header by hand. */
  onBack?: () => void;
  /** accessible name for the back button. */
  backLabel?: string;
}

// every page-level screen starts with one of these: same type scale,
// same spacing, same place for buttons, so moving between screens does
// not move the furniture
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, meta, actions, descriptionMaxWidth, onBack, backLabel = 'back' }) => (
  <div style={stack('var(--space-1)')}>
    <div style={row('var(--space-3)')}>
      {onBack && (
        <Btn variant="ghost" size="sm" onClick={onBack} aria-label={backLabel}>
          <Icon name="left" size="sm" />
        </Btn>
      )}
      <h1 style={headingPage}>{title}</h1>
      {meta && <span style={textMuted}>{meta}</span>}
      <div style={{ flex: 1 }} />
      {actions && <div style={row()}>{actions}</div>}
    </div>
    {description && (
      <p style={{ ...textMuted, margin: 0, maxWidth: descriptionMaxWidth, lineHeight: 'var(--leading-normal)' }}>
        {description}
      </p>
    )}
  </div>
);

// --- EmptyState ---

interface EmptyStateProps {
  icon: string;
  title: string;
  /** what to do about it. an empty state that only says "nothing
   *  here" is a dead end, so every one of these should point at the
   *  next step */
  help: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, help, action }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
    textAlign: 'center', padding: 'var(--space-10) var(--space-4)',
    border: 'var(--border-width) dashed var(--border2)', borderRadius: 'var(--radius-card)',
    color: 'var(--text3)',
  }}>
    <Icon name={icon} size="lg" />
    <strong style={{ ...textMono, color: 'var(--text2)' }}>{title}</strong>
    <p style={{ ...textMuted, margin: 0, maxWidth: '30rem', lineHeight: 'var(--leading-normal)' }}>{help}</p>
    {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
  </div>
);

// --- FormField ---

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** muted one-liner under the control, what to type, not what it is */
  hint?: React.ReactNode;
  /** info icon beside the label with this text in a toggletip, when the
   *  label alone does not say enough and a full hint line is too much */
  help?: React.ReactNode;
  children: React.ReactNode;
}

// a labeled wrapper around any control (Input/Select/Textarea/...).
// the kit ships the controls but not this, since not every consumer
// wants a label in the same place relative to its control
export const FormField: React.FC<FormFieldProps> = ({ label, htmlFor, hint, help, children }) => (
  <div style={stack('var(--space-1)')}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <label htmlFor={htmlFor} style={{ ...textMuted, flexShrink: 0 }}>{label}</label>
      {help && (
        <Toggletip content={help} position="right" aria-label="what is this?">
          <span role="button" tabIndex={0} style={{ display: 'inline-flex', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>
            <Icon name="info" size="sm" aria-hidden="true" />
          </span>
        </Toggletip>
      )}
    </span>
    {children}
    {hint && <span style={{ ...textMuted }}>{hint}</span>}
  </div>
);

// --- SectionHeader ---
//
// the titled group separator settings-style screens repeat: a bold title
// with an optional help toggletip and right-aligned actions, the shape
// every preferences section reaches for instead of a bare heading

interface SectionHeaderProps {
  title: React.ReactNode;
  /** info icon beside the title with this text in a toggletip */
  help?: React.ReactNode;
  /** right-aligned, e.g. a reset button for just this section */
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, help, actions }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    margin: 'var(--space-4) 0 var(--space-1)', fontWeight: 700,
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text)',
  }}>
    <span>{title}</span>
    {help && (
      <Toggletip content={help} position="right" aria-label="what is this?">
        <span role="button" tabIndex={0} style={{ display: 'inline-flex', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1 }}>
          <Icon name="info" size="sm" aria-hidden="true" />
        </span>
      </Toggletip>
    )}
    {actions && (<><span style={{ flex: 1 }} />{actions}</>)}
  </div>
);

// --- ActionModal ---

interface ActionModalProps {
  title: React.ReactNode;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** close automatically right after onConfirm fires, default false, so
   *  the caller decides when it is done (e.g. after an async save
   *  succeeds). set true for a plain confirm-and-done action */
  closeOnConfirm?: boolean;
}

// the Modal-plus-cancel/confirm-footer shape that repeats across every
// destructive confirmation and every create/edit form
export const ActionModal: React.FC<ActionModalProps> = ({
  title, children, onConfirm, onCancel, confirmLabel = 'confirm', cancelLabel = 'cancel',
  danger, disabled, loading, closeOnConfirm = false,
}) => (
  <Modal
    title={title}
    onClose={onCancel}
    footer={(
      <>
        <Btn variant="ghost" onClick={onCancel}>{cancelLabel}</Btn>
        <Btn
          variant={danger ? 'danger' : 'primary'}
          disabled={disabled}
          loading={loading}
          onClick={() => { onConfirm(); if (closeOnConfirm) onCancel(); }}
        >
          {confirmLabel}
        </Btn>
      </>
    )}
  >
    {children}
  </Modal>
);

// --- ReviewDialog ---

interface ReviewDialogGroup<T> {
  key: string;
  items: T[];
}

type ReviewDialogSource<T> =
  | { items: T[]; groups?: undefined }
  | { items?: undefined; groups: ReviewDialogGroup<T>[] };

interface ReviewDialogConfirmStep {
  title: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** count: how many items are about to be acted on. emptiedGroups:
   *  how many groups (grouped mode only) would end up with none of
   *  their items left, always 0 in flat mode */
  message: (count: number, emptiedGroups: number) => React.ReactNode;
}

type ReviewDialogProps<T extends { id: string }> = ReviewDialogSource<T> & {
  renderItem: (item: T) => React.ReactNode;
  /** grouped mode only: shown inside a group card when every one of
   *  its items is currently selected. return null/undefined to say
   *  nothing for that group */
  renderGroupWarning?: (group: ReviewDialogGroup<T>) => React.ReactNode;

  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  /** whether "select all" should read as checked, the caller decides
   *  what "all" means (see useSelection) */
  allSelected: boolean;

  /** opens this row own edit affordance instead of acting on it in
   *  bulk. omit to not offer a per-row edit action */
  onEditItem?: (item: T) => void;
  editLabel?: string;

  /** runs over the currently-selected items */
  onAction: (items: T[]) => void;
  actionLabel: (count: number) => string;
  actionVariant?: 'primary' | 'danger' | 'default';
  /** a confirm step before onAction fires. omit for a non-destructive
   *  action (e.g. restore) that should just run immediately */
  confirm?: ReviewDialogConfirmStep;

  badge: React.ReactNode;
  bannerColor?: string;
  bannerMessage: React.ReactNode;
  reviewLabel?: string;

  title: string;
  selectAllLabel: string;
  intro?: React.ReactNode;
  closeLabel?: string;
  pageSize?: number;

  /** gates opening the dialog. the banner still shows either way (ambient
   *  status, not a permission gate), only the review action itself is
   *  gated. pass true if there is nothing to gate */
  canResolve: boolean;
};

function reviewDialogAllItems<T>(props: ReviewDialogSource<T>): T[] {
  return props.groups ? props.groups.flatMap(g => g.items) : props.items;
}

// a checkbox-list review dialog: banner with a trigger button, a Modal
// with select-all + paginated rows, an optional per-row edit escape
// hatch, and an optional confirm step before the bulk action fires.
// covers both a flat list (restore-style, non-destructive) and a grouped
// one (dedup-style, with a per-group "this would empty out" warning)
// through the same shape, see ReviewDialogSource
export function ReviewDialog<T extends { id: string }>(props: ReviewDialogProps<T>) {
  const {
    renderItem, renderGroupWarning,
    selected, onToggle, onSelectAll, onClear, allSelected,
    onEditItem, editLabel = 'edit',
    onAction, actionLabel, actionVariant = 'primary', confirm,
    badge, bannerColor = 'var(--warn)', bannerMessage, reviewLabel = 'review',
    title, selectAllLabel, intro, closeLabel = 'close', pageSize = 25,
    canResolve,
  } = props;
  const groups = props.groups;

  const [open, setOpen] = React.useState(false);
  const [pendingConfirm, setPendingConfirm] = React.useState<T[] | null>(null);
  const all = reviewDialogAllItems(props);
  const { page, pageCount, setPage } = usePager(groups ? groups.length : all.length, pageSize);

  if (all.length === 0) return null;

  const visibleGroups = groups?.slice((page - 1) * pageSize, page * pageSize);
  const visibleItems = !groups ? all.slice((page - 1) * pageSize, page * pageSize) : undefined;

  function closeAndEdit(item: T): void {
    setOpen(false);
    onEditItem?.(item);
  }

  function runAction(): void {
    const chosen = all.filter(i => selected.has(i.id));
    if (chosen.length === 0) return;
    if (confirm) { setPendingConfirm(chosen); return; }
    onAction(chosen);
  }

  const emptiedGroups = pendingConfirm && groups
    ? groups.filter(g => g.items.every(i => pendingConfirm.some(p => p.id === i.id))).length
    : 0;

  function renderRow(item: T): React.ReactNode {
    return (
      <div key={item.id} style={row()}>
        <Checkbox checked={selected.has(item.id)} onChange={() => onToggle(item.id)} label="" />
        <div style={{ flex: 1 }}>{renderItem(item)}</div>
        {onEditItem && <Btn variant="ghost" size="sm" onClick={() => closeAndEdit(item)}>{editLabel}</Btn>}
      </div>
    );
  }

  // tighter than `panel`: a dense list of checkbox rows, not a general
  // content section
  const listCard: React.CSSProperties = {
    border: 'var(--border-width) solid var(--border2)', borderRadius: 'var(--radius-card)',
    padding: 'var(--space-2)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
  };

  return (
    <>
      <Alert color={bannerColor} action={canResolve && (
        <Btn variant="default" size="sm" onClick={() => setOpen(true)}>{reviewLabel}</Btn>
      )}>
        {badge}
        <span style={textMuted}>{bannerMessage}</span>
      </Alert>

      {open && canResolve && (
        <Modal title={title} onClose={() => setOpen(false)} footer={(
          <>
            <Btn variant="ghost" onClick={() => setOpen(false)}>{closeLabel}</Btn>
            <Btn variant={actionVariant} onClick={runAction} disabled={selected.size === 0}>
              {actionLabel(selected.size)}
            </Btn>
          </>
        )}>
          <div style={stack('var(--space-3)')}>
            {intro && <p style={{ ...textMuted, margin: 0 }}>{intro}</p>}
            <Checkbox checked={allSelected} onChange={() => (allSelected ? onClear() : onSelectAll())} label={selectAllLabel} />
            {groups
              ? visibleGroups!.map(group => {
                  const warning = group.items.every(i => selected.has(i.id)) ? renderGroupWarning?.(group) : null;
                  return (
                    <div key={group.key} style={listCard}>
                      {warning}
                      {group.items.map(renderRow)}
                    </div>
                  );
                })
              : <div style={listCard}>{visibleItems!.map(renderRow)}</div>}
            <Pager page={page} pageCount={pageCount} onPage={setPage} aria-label="pages" />
          </div>
        </Modal>
      )}

      {pendingConfirm && confirm && (
        <ActionModal
          title={confirm.title}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => { onAction(pendingConfirm); setPendingConfirm(null); setOpen(false); }}
        >
          {confirm.message(pendingConfirm.length, emptiedGroups)}
        </ActionModal>
      )}
    </>
  );
}

// --- CommandPalette ---
//
// a vscode-style quick open: filter-as-you-type over one flat item list,
// run on enter or click. the caller owns what the items mean (files,
// commands, views, projects); this only owns filtering, highlight and
// keyboard. top-anchored on a transparent catcher, not a centered modal:
// dismissing it is moving on, not answering a question

export interface CommandPaletteItem {
  id: string;
  label: string;
  /** right-aligned secondary text: a path, a shortcut, a tip */
  hint?: string;
  /** picon name drawn before the label */
  icon?: string;
}

interface CommandPaletteProps {
  open: boolean;
  items: CommandPaletteItem[];
  onRun: (id: string) => void;
  onClose: () => void;
  placeholder?: string;
  /** shown when the filter matches nothing, default "no matches" */
  emptyLabel?: string;
  'aria-label'?: string;
}

// subsequence score, higher reads first: an exact prefix beats a word
// start, which beats scattered letters; ties break to the tighter span,
// then the shorter label. small on purpose, deterministic, no knobs.
// exported so the app test suite can pin the ordering
export function paletteScore(label: string, query: string): number {
  const l = label.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const pos: number[] = [];
  let from = 0;
  for (const ch of q) {
    const i = l.indexOf(ch, from);
    if (i === -1) return -1;
    pos.push(i);
    from = i + 1;
  }
  const tier = l.startsWith(q) ? 3
    : pos.some((p, i) => p === 0 || (i > 0 && /[\/_\-. ]/.test(l[p - 1]))) ? 2
    : 1;
  return tier * 1e6 - (pos[pos.length - 1] - pos[0]) * 1e3 - l.length;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open, items, onRun, onClose, placeholder, emptyLabel = 'no matches', ...aria
}) => {
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);
  useFocusTrap(boxRef, open);

  const shown = React.useMemo(() => {
    if (!query.trim()) return items;
    return items
      .map((item) => ({ item, score: paletteScore(item.label, query) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map((x) => x.item);
  }, [items, query]);

  // a fresh open starts unfiltered at the top and lends focus out, closing
  // hands it back so keyboard flow resumes where it left off
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    prevFocus.current = document.activeElement as HTMLElement | null;
    return () => { prevFocus.current?.focus?.({ preventScroll: true }); };
  }, [open ]);

  // the active row follows the filter and stays visible
  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, shown.length - 1)));
  }, [shown.length]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  const listId = 'palette-list';

  function onKeyDown(e: React.KeyboardEvent): void {
    const n = shown.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (n ? (a + 1) % n : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (n ? (a - 1 + n) % n : 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, n - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = shown[active]; if (it) { haptic('tap'); onRun(it.id); } }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={aria['aria-label'] ?? 'command palette'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as any,
      }}
    >
      <div ref={boxRef} style={{
        position: 'absolute', top: 'var(--space-16)', left: 0, right: 0, margin: '0 auto',
        width: 'min(36rem, 92vw)', maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        background: 'var(--modal-bg)', border: 'var(--border-width) solid var(--border)',
        borderRadius: 'var(--radius-modal)', boxShadow: 'var(--elevation-2)', overflow: 'hidden',
      }}>
        <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: 'var(--border-width) solid var(--border)', flexShrink: 0 }}>
          <Input
            value={query}
            onChange={setQuery}
            placeholder={placeholder ?? 'type to filter'}
            autoFocus
            role="combobox"
            aria-expanded={true}
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `palette-item-${shown[active].id}` : undefined}
            aria-label={aria['aria-label'] ?? 'command palette'}
            onKeyDown={onKeyDown}
          />
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-label={aria['aria-label'] ?? 'results'}
          style={{ margin: 0, padding: 'var(--space-1)', listStyle: 'none', overflowY: 'auto' }}>
          {shown.map((item, idx) => {
            const isActive = idx === active;
            return (
              <li
                key={item.id}
                id={`palette-item-${item.id}`}
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                onMouseEnter={() => setActive(idx)}
                onClick={() => { haptic('tap'); onRun(item.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                  background: isActive ? 'var(--hover)' : 'transparent', color: 'var(--text)',
                }}
              >
                {item.icon && <Icon name={item.icon} size="sm" aria-hidden="true" />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.hint && <span style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>{item.hint}</span>}
              </li>
            );
          })}
          {shown.length === 0 && (
            <li aria-disabled="true" style={{
              padding: 'var(--space-3)', textAlign: 'center',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--text3)',
            }}>
              {emptyLabel}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
