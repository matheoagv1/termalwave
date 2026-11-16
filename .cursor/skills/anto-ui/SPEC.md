# Anto design system: implementation spec

Reference for porting the kit and for using it without reading source.
The React kit is authoritative where behavior is ambiguous.

---

## 1. Invariants

Two tiers. Structural rules hold in every theme with no exceptions.
Aesthetic rules hold in the default theme and are tokens precisely so a
theme can override them wholesale. A per-component exception to an
aesthetic rule is still a defect.

### 1.1 Geometry

- Radius `0` by default. No component hardcodes a radius outside `--radius`
  and its aliases. `--radius-dot` never aliases `--radius`: status dots stay
  square unless a theme sets it on purpose.
- Borders are `--border-width` (`0.0625rem`). Never thicker, never absent
  where the spec calls for one.
- No shadows by default (`--elevation-*` are `none`). No gradients except a
  functional banner fade. No textures in components.

### 1.2 Motion

- 50ms (`--transition-fast`) or 100ms (`--transition-base`). Easing is the
  single `--ease` token, linear by default.
- Only `background`, `color`, `border-color`, `opacity` may animate. Never
  `transform`, never a positional property. `Collapse` is the one exception:
  it animates a grid row track. Hover is a color or shadow shift only, never
  a lift or scale.
- `prefers-reduced-motion` zeroes every duration. No opt-out.

### 1.3 Type

- Chrome reads `--font-ui` (aliases `--font-mono` by default). `code` and
  `pre` read `--font-mono` directly and ignore theme font swaps.
- `headingPage` and `headingSection` read `--font-display` (aliases
  `--font-ui` by default), the one display/body split in the kit.
- Icons are picon ligatures (text content is the icon name), never SVG or emoji.
- Weights 400 and 700. All sizes in rem, never px or em.

### 1.4 Color

- Every color is a custom property. No hardcoded hex, including text on an
  accent fill (`--on-accent`, default `#fff`). Components never read the
  theme; they read tokens.

### 1.5 Content

- Lowercase terse copy (`save`, not `Please click Save`). No ALL CAPS except
  labels using `text-transform: uppercase`. No emoji. Functional unicode
  (`·`, `→`, `×`, `…`) is fine.

### 1.6 Spacing

- 8px grid. Multiples of 4px only, always through spacing tokens.

---

## 2. Token reference

### 2.1 Color tokens (all themes)

Five themes, applied via `data-theme`. Default (no attribute):
`original-light`.

| Token | original-light | new-light | original-dark | dark/new-dark | red-dark |
|---|---|---|---|---|---|
| `--bg` | `#fff` | `#f8f8fb` | `#0d0d0f` | `#111114` | `#0a0000` |
| `--bg2` | `#f5f5f5` | `#eeeef4` | `#151517` | `#18181c` | `#1a0505` |
| `--bg3` | `#e8e8e8` | `#e0e0ea` | `#1e1e22` | `#222228` | `#2a0808` |
| `--text` | `#000` | `#111118` | `#ececf0` | `#e8e8ee` | `#f5d4d2` |
| `--text2` | `#444` | `#44444e` | `#9090a0` | `#9999aa` | `#d9a8a5` |
| `--text3` | `#888` | `#888899` | `#50505a` | `#55555f` | `#b88683` |
| `--accent` | `#00f` | `#4a54d4` | `#4466ff` | `#7c85f5` | `#ff6b63` |
| `--accent2` | `#0000cc` | `#3340b8` | `#2244cc` | `#5a62d0` | `#d94d45` |
| `--border` | `#000` | `#c0c0cc` | `#333340` | `#333340` | `#d94d45` |
| `--border2` | `#ccc` | `#d4d4de` | `#22222a` | `#25252e` | `#52201c` |
| `--ok` | `#060` | `#1a8a44` | `#33bb66` | `#4cd67a` | `#ff6b63` |
| `--warn` | `#c90` | `#b07800` | `#ddaa22` | `#f5c842` | `#ffdd55` |
| `--err` | `#c00` | `#c01a1a` | `#ee4444` | `#f55050` | `#ff3b33` |
| `--hover` | `#fcfcfc` | `#e4e4ec` | `#1c1c22` | `#1e1e24` | `#2a0808` |
| `--modal-bg` | `#fff` | `#f8f8fb` | `#151517` | `#18181c` | `#1a0505` |

### 2.2 Spacing tokens

```
--space-1:   0.25rem    --space-2:   0.5rem     --space-3:   0.75rem
--space-4:   1rem       --space-5:   1.25rem    --space-6:   1.5rem
--space-8:   2rem       --space-10:  2.5rem     --space-12:  3rem
--space-16:  4rem
```

### 2.3 Typography tokens

```
--font-mono: ui-monospace stack     --font-icon: picon
--text-xs: 0.625rem  --text-sm: 0.75rem   --text-base: 0.875rem
--text-md: 1rem      --text-lg: 1.25rem   --text-xl: 1.5rem  --text-2xl: 2rem
--weight-normal: 400  --weight-bold: 700
--leading-tight: 1.25  --leading-normal: 1.5  --leading-code: 1.6
```

### 2.4 Other tokens

```
--border-width: 0.0625rem
--focus-outline: 0.125rem solid var(--accent)
--z-tooltip: 50  --z-modal: 100  --z-toast: 200  --z-popover: 300
--transition-fast: 50ms var(--ease)  --transition-base: 100ms var(--ease)
```

`--z-popover` sits above `--z-modal`: a control inside a dialog opens its
popup from within it.

### 2.5 Picon icon sizes

`xs` 0.625rem, `sm` 0.75rem, `md` 1rem, `lg` 1.25rem, `xl` 1.5rem.
Common names: `folder`, `file`, `code`, `cog`, `magnifier`, `add`,
`trash`, `edit`, `times` (close), `ballot`/`checked` (checkbox),
`false`/`true` (radio), `hourglass0`–`hourglass8` (spinner frames).

### 2.6 Shape, elevation, motion, font tokens

Not per-theme. They live once at `:root`; a theme overrides what it cares
about via `defineTheme`.

```
--radius: 0, aliased by --radius-sm/lg/pill/btn/input/card/modal/tag.
  --radius-dot: 0, never aliased (see section 1.1).
--panel-padding: var(--space-4), the density axis, independent of radius.
--elevation-1/2/3/inset: none. 1: Btn/Tile/Tooltip. 2: Modal/Toast.
  3: reserved. inset: sunken inputs and sliders.
--font-ui: var(--font-mono).  --font-display: var(--font-ui).
--ease: linear.  --text-scale: 1, multiplies every --text-* token.
--on-accent: #fff.  --focus-shadow: none (additive halo, off by default).
```

---

## 3. Focus model

- Ring only for keyboard navigation: `:focus-visible` gets
  `var(--focus-outline)`; `:focus:not(:focus-visible)` gets none. Inline
  `outline: none` on a button kills the ring, so interactive components
  must not set it. Text inputs keep it: their focus signal is the accent
  border, not the ring.
- Everything interactive works by keyboard. Tab order follows the visual order.

---

## 4. Component specifications

Shared mechanics live in three small helpers: `rovingKey` (one keyboard
model for every roving-tabindex list; lists whose arrows only move focus
call it directly), `useRoving` (the automatic-selection version, exported
for consumers: commit on arrow, focus follows, option scrolls into view),
and `useDismiss` (Escape plus pointer-down outside the anchor/panel pair
closes a floating surface).

### 4.1 Btn

Variants `primary`, `default`, `danger`, `ghost` (tables `BTN_VAR` and
`BTN_HOVER`, extendable at runtime). Sizes `sm`, `md`, `lg`. States:
`disabled` and `loading` (opacity 0.4, no click; loading prepends a
Spinner). `tip` self-wraps the button in a Tooltip. Icon-only buttons
must pass `aria-label`. Prefer `IconBtn` below for the icon-only square.

### 4.2 IconBtn

The icon-only square every toolbar and list row reaches for: `Btn`
`ghost` plus an `Icon` child, spelled in four props per call site without
it. `label` is the accessible name and tooltip. `active` gives the accent
fill. `expanded`/`controls` mark a disclosure; when given, `aria-pressed`
is omitted so toggles and disclosures stay distinct.

### 4.3 Input

Border `--border`, accent on focus, `--err` with `aria-invalid` and a
`role="alert"` error line linked by `aria-describedby` when `error` is
set. Controlled (`value`/`onChange`) and uncontrolled modes. Block level
(`width: 100%`): wrap in `flexItem` when sharing a row. Combobox
passthrough props (`role`, `aria-expanded/controls/autocomplete/
activedescendant`) stay inert for a plain field.

### 4.4 Textarea, Select

Same focus and error behavior as Input. Select uses `appearance: none`
and the native popup. Both block level.

### 4.5 Checkbox, Radio

Hidden native input plus a picon glyph (`ballot`/`checked`,
`false`/`true`). Disabled is opacity 0.5 on the label.

### 4.6 Badge, Tag, ColorChip

Badge is outline-only (count/status). Tag is its solid-fill categorical
sibling, dismissible via `onDismiss`. `ColorChip` is the dynamic-fill
sibling: Badge and Tag variants are fixed, this one takes any runtime
color and derives its text with `readableOn`, so api-driven fills stay
readable. Same tag radius and xs type.

### 4.7 StatusDot

Square block, `var(--space-2)`. `online`/`idle`/`dnd`/`offline` map to
`--ok`/`--warn`/`--err`/`--text3` (table `STATUS_COLOR`). Label it when it
is the only status signal, hide it when decorative.

### 4.8 Divider

`horizontal` or `vertical` separator, or a labeled horizontal rule.
`role="separator"` with `aria-orientation`.

### 4.9 Icon, setIconSet

`span` in `var(--font-icon)` whose text content is the glyph name.
`setIconSet` swaps the glyph table (plus optional family) at runtime for
ports that do not ship picon.

### 4.10 Spinner, Skeleton, InlineLoading, ProgressBar, ProgressIndicator

Spinner cycles `hourglass0`–`hourglass8` at 10fps and inherits its color.
Skeleton is a decorative block (`aria-hidden`); the fetch itself announces
loading. InlineLoading resolves loading to success or error
(`role="status"`). ProgressBar tracks one fraction (indeterminate pulses
opacity, no sweep). ProgressIndicator tracks discrete steps derived from
`currentIndex`/`invalidIndex`; current step takes `aria-current="step"`.

### 4.11 Tabs, TabStrip

Tablist with roving tabindex and wrap-around arrows; Enter/Space
activates. Active tab is accent with an accent underline sitting flush on
the list border. TabStrip is the editor-shaped rail: leading icon,
trailing badge, close control, middle-click close, inline rename on
double click or F2.

### 4.12 ContentSwitcher, ChipRow

One contract, two layouts. Both are radiogroups with the automatic
roving model from `useRoving` (arrows commit the pick, focus follows,
the option scrolls into view; Home/End jump). ContentSwitcher is the
segmented control for two or three fixed modes (bordered strip,
clipped). ChipRow is the scrollable row of chips for unbounded counts
(branches, filters), `overflow-x: auto` so every option stays reachable.
Wrap-around differs: the switcher cycles, the row stops at the ends.
Manual-focus lists (tabs, menus) call `rovingKey` directly instead.

### 4.13 Sidebar, NavRail

Sidebar is the icon-only rail (`--space-10` wide, accent active,
`aria-current="page"`, group dividers, optional `marker` corner marker).
NavRail is its labeled sibling: same contract plus a visible caption and
a phone reflow to a bottom bar, done through the media hook (the kit
styles inline, so no css query can do it) under 40rem. Reach for NavRail
when destinations need names, Sidebar when icons suffice.

### 4.14 StatusBar

Bottom bar, accent fill, `role="status"`. Left and right slots.

### 4.15 Modal, ActionModal

Backdrop centers a `--modal-bg` box (`width`, named `size`, `max-height`
88vh, body scrolls). Escape and backdrop click close. Focus is trapped
and placed on open, listeners released on close. `open={false}` renders
nothing. ActionModal is the confirm shape on top: ghost cancel plus
primary or danger confirm, `closeOnConfirm` false by default so async
saves decide when they are done.

### 4.16 Tooltip, Toggletip, Menu, Overlay

Overlay is the one placement primitive under all three: portal to
`document.body`, fixed position, transform placement, flip only toward
roomier sides, clamped inside the viewport, first frame at opacity 0 so
a menu can focus its first item before paint. Tooltip is hover and focus,
text only, vanishes on leave. Toggletip is click-triggered dialog content
that persists until dismissed. Menu adds roving wrap-around arrows over
the same trigger and dismiss shell. None does edge-collision beyond flip
and clamp; pick a `position` that fits. Shared caret and position table,
one family.

### 4.17 SplitButton, Splitter, Collapse

SplitButton pairs a primary Btn with a Menu trigger, seamed as one
control. Splitter is the controlled pane resize handle. Collapse animates
a grid row track, the one sanctioned positional animation, so a panel can
open without losing the reader's place. Unmounted when closed.

### 4.18 Pager, usePager

Prev/next plus a direct page input for long lists. Renders nothing for
one page. Requests clamp to `[1, pageCount]`; no callback when unchanged.

### 4.19 Alert

Bordered banner row in the given `color`. Optional `title` above the
content, `action` and dismiss after it. No live-region role: persistent
status, not a transient announcement (that is Toast).

### 4.20 Toast, haptics

Bottom-right stack, `aria-live="polite"`, `role="status"` items that fade
after a duration and dismiss on click. Every interactive component buzzes
on commit (tap under 15ms, longer bursts for confirm and error). Extend
with `registerHapticPattern`, disable globally with
`setHapticsEnabled(false)`.

### 4.21 PageHeader, SectionHeader, PalettePicker

PageHeader starts every screen: `h1`, optional `meta`, right-aligned
`actions`, optional `description`. `onBack` renders a ghost back button
with a left glyph before the title, so detail screens stop rebuilding
the header. SectionHeader is the titled group separator for settings
screens, with optional `help` toggletip and `actions`. PalettePicker is
the swatch radiogroup behind any theme UI: the caller owns the palette
data and persistence, the kit owns the radio semantics and the surface,
raised, accent miniature per option.

### 4.22 EmptyState, FormField

EmptyState is the dashed placeholder: icon, bold title, `help` that says
what to do next, optional `action`. FormField wraps any control with a
`label` for its `id`, plus a `hint` line or a `help` toggletip.

### 4.23 ReviewDialog

Checkbox-list review over an Alert banner, a Modal with select-all and
paginated rows, optional per-row edit, optional confirm step. Selection
is controlled by the caller (back it with `useSelection`). Renders
nothing with no items.

### 4.24 Breadcrumb, Accordion, Link, List, TreeView

Breadcrumb is a nav trail with `/` separators and `aria-current` on the
tail. Accordion headers toggle `role="region"` panels; sections unmount
when closed. Link underlines always and goes inert with `aria-disabled`
when disabled. List is a thin `ul`/`ol` wrapper. TreeView is a real tree
(`role="tree"`, roving tabindex, expandable nodes).

### 4.25 CopyButton, CodeSnippet

CopyButton writes to the clipboard and confirms with a glyph and color
shift for two seconds. CodeSnippet renders `inline` code or a block with
an absolutely positioned CopyButton.

### 4.26 Search, ComboBox, CommandPalette

Search is a field with an icon and a clear button past a debounce.
ComboBox is the single and multi filter over an option list with full
combobox ARIA. CommandPalette is quick-open over one flat list:
subsequence filtering, wrap arrows, Enter runs, focus returns on close.

### 4.27 Slider, NumberInput, ToggleSwitch

Slider is a square-thumb range input with an inset track. NumberInput is a
stepper composed from Input and two Btns, clamped at `min`/`max`, each end
button disabling at its own bound. ToggleSwitch is an immediate setting
change (not a form value): the track flips `justify-content` instantly
and the color change carries the state, inside the motion invariant.

### 4.28 Tile, Pager (layout), DataTable, FileUploader

Tile is a container that renders as a button only when `onClick` is given
(`aria-pressed` when `selected` is defined). DataTable is a sortable
table with `aria-sort` headers. FileUploader is a drop zone plus a file
list with per-file remove.

### 4.29 Style helpers

Plain style objects, not components: `textMono`, `textMuted`,
`textSecondary`, `headingPage`, `headingSection`, `srOnly`, `stack`,
`row`, `pageRoot`, `panel`, `flexItem` (the `min-width: 0` fix that lets a
flex child shrink past its content), `grid` (zero-breakpoint autofit
columns), `sidebarLayout` (collapsing two-region reflow in pure flex
math), and the `table*` set.

### 4.30 Hooks, css helpers, themes

`useMediaQuery` and `usePrefersReducedMotion` cover reactive queries.
`useStore` bridges any `{get, subscribe}` store into React.
`useAsync` loads per deps with `reload` and keeps stale data on error.
`useNow` re-renders on an interval; `useInterval` runs the latest
callback and pauses on null. `useClickOutside` closes floating panels.
`cssVar` reads a resolved token, `toHex` flattens any css color for color
inputs, `readableOn` picks text for a dynamic fill, `resolveColor`
resolves `var()` with a fallback for canvas and webgl. `KONA_COLORS` and
`SKEUO_COLORS` plus their apply functions are the two reference themes:
one layered recolor, one structural rebuild, proof of what the override
surface reaches.

---

## 5. Application shell

Column: top bar, then a row of nav plus scrollable content, then
StatusBar. `sidebarLayout` gives the collapsing two-region version of
the content row in pure flex math. Rows wrap by default through `row()`;
grids use `grid()`.

---

## 6. Theme system

`data-theme` on the root selects the palette; every component reads
tokens. `registerTheme(name, colors)` adds colors;
`defineTheme(name, {base, colors, shape, elevation, motion, typography,
focus, extraCss})` is the full surface and the only code path.
Single-axis setters (`setAccent`, `setRadius`, `setTextScale`,
`setFontUi`, `setFontDisplay`, `setPalette`) write inline styles on
`<html>` for live settings toggles. `extraCss` is the escape hatch for
what is not a token at all (a page grain texture), not a second way to
set colors.

---

## 7. Interaction behavior

Hover is inactive-only and guarded; active always wins. Press adds
nothing positional. Disabled is dimmed and inert, never removed from the
layout (`Btn` 0.4, row controls 0.5). Copy stays lowercase and terse.

---

## 8. Accessibility baseline

| Element | Required ARIA |
|---|---|
| Icon-only button | `aria-label` |
| Input with error | `aria-invalid`, `aria-describedby` to the error element |
| Error message | `role="alert"` |
| Modal | `role="dialog"`, `aria-modal` |
| Modal close | `aria-label="close"` |
| Tablist | `role="tablist"`, tabs `role="tab"` with `aria-selected`/`aria-controls`, panels `role="tabpanel"` |
| Sidebar, NavRail | `aria-label`/`title`, `aria-current="page"` on active, `role="separator"` dividers, `markerAriaLabel` for marked items |
| StatusBar | `role="status"` |
| Tooltip | `role="tooltip"`, `aria-describedby` on anchor |
| Toast | container `aria-live="polite"`, items `role="status"` |
| Divider | `role="separator"` with orientation |
| StatusDot | `aria-label` when meaningful, `aria-hidden` when decorative |
| Pager | `nav` with `aria-label` |
| FormField | `label htmlFor` to the control `id` |
| Tag remove | `aria-label`, default "remove" |
| ToggleSwitch | `role="switch"` |
| ProgressBar | `role="progressbar"`, `aria-valuenow` omitted while indeterminate |
| Skeleton | `aria-hidden` |
| Breadcrumb | `nav aria-label="breadcrumb"`, `aria-current="page"` on tail |
| Accordion | header `aria-expanded`/`aria-controls`, panel `role="region"` |
| Tile | `aria-pressed` when selectable, `aria-label` when icon-only |
| Toggletip | trigger `aria-expanded`/`aria-controls`, panel `role="dialog"` |
| Menu | trigger `aria-haspopup="menu"` plus expanded/controls, panel `role="menu"`, items `role="menuitem"` with roving tabindex |
| Link disabled | `aria-disabled` |
| CopyButton | `aria-label` reflecting state |
| InlineLoading | `role="status"` |
| ContentSwitcher, ChipRow, PalettePicker | `role="radiogroup"`, options `role="radio"` with `aria-checked` and roving tabindex |
| ProgressIndicator current | `aria-current="step"` |
| ComboBox, CommandPalette field | `role="combobox"` with expanded/controls/autocomplete/activedescendant |
| Options | `role="option"` with `aria-selected` |
| Table sort header | `aria-sort` |
| TreeView | `role="tree"` with `treeitem` nodes, `aria-level`, roving tabindex |
| ColorChip | decorative text alternative comes from the label itself |
| IconBtn | `aria-label`; `aria-expanded`/`aria-controls` when a disclosure, `aria-pressed` when a toggle |

---

## 9. Layout system

`flexItem` sets the `min-width: 0` that lets a flex child shrink past its
content instead of blowing out the row. `grid` is zero-breakpoint autofit
columns (`repeat(auto-fit, minmax(min(100%, N), 1fr))`). `sidebarLayout`
collapses an aside and main region in pure flex math, no measuring.
`row` wraps for free.
