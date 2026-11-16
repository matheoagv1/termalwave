---
name: anto-ui
description: Use this skill when building a React app, website, or PWA in the Anto style, a suckless terminal-flavored zero-border-radius design system. Covers the @xplshn/anto-ui component library, its tokens, PWA setup, and haptics. Also use when asked to extend the kit with a new component, port it to another framework, or explain/enforce the Anto visual rules.
user-invocable: true
---

# Anto UI

`@xplshn/anto-ui` is the component layer of the Anto design system. Read
this file before writing UI code against it. Props are typed and
documented inline in `src/components.tsx`. Read the interface above
each component rather than guessing.

## Read order

1. This file (how to use/extend).
2. `SPEC.md` (invariants plus the per-component contract: props, states, ARIA).
3. `src/components.tsx`, `src/hooks.ts`, `src/css.ts` (the implementation).

Token values live in SPEC.md §2. Open `src/tokens.css` only when a value
doesn't match the spec.

## Golden rule

**Check the exports list before writing a component.** If what you need
is here, import it. If it's 90% here, extend with a prop rather than
forking. See "Extending" below.

## What's in the box

```
textMono, textMuted, textSecondary, headingPage, headingSection, srOnly,
stack, row, pageRoot, panel, flexItem, grid, sidebarLayout,
tableBase, tableHeadCell, tableHeadRow, tableRow, tableCell, tableCellActions
Icon, setIconSet, Spinner
Btn, IconBtn, Input, Textarea, Select, ComboBox, Checkbox, Radio, Slider,
NumberInput, ToggleSwitch, Search, Splitter
Badge, Tag, ColorChip, StatusDot, Divider, Alert, Tile
ProgressBar, ProgressIndicator, Skeleton, InlineLoading
Tabs, ContentSwitcher, ChipRow, Sidebar, NavRail, StatusBar,
Pager, Breadcrumb, Accordion, Link, List, TreeView,
Collapse, SplitButton, TabStrip
Modal, ActionModal, Tooltip, Toggletip, Menu, CommandPalette,
ToastProvider, useToast, useRoving
PageHeader, EmptyState, FormField, SectionHeader, PalettePicker, ReviewDialog
CopyButton, CodeSnippet
DataTable, FileUploader
usePager, useSelection, useMediaQuery, usePrefersReducedMotion,
useStore, useAsync, useNow, useInterval, useClickOutside
cssVar, toHex, readableOn, resolveColor
THEMES, setTheme, getTheme, useTheme, registerTheme, defineTheme,
setAccent, setRadius, setTextScale, setFontUi, setFontDisplay, setPalette
KONA_COLORS, applyKonaTheme, SKEUO_COLORS, applySkeuoTheme
BTN_VAR, BTN_HOVER, BADGE_STYLE, TAG_STYLE, STATUS_COLOR, TOAST_COLOR
haptic, setHapticsEnabled, hapticsEnabled, registerHapticPattern
buildManifest, injectManifest, registerServiceWorker, usePWAInstall, useOnline
```

Every component is a plain function, no HOCs, no context requirement
(except `useToast`, which needs `ToastProvider`). Nothing here reaches
into global state or an external store.

### Minimal app shell

```tsx
import { Sidebar, StatusBar } from '@xplshn/anto-ui';
import '@xplshn/anto-ui/tokens.css';

<div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
  <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
    <Sidebar items={[{ id: 'files', icon: 'folder', label: 'Files' }]} active="files" />
    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>{/* panel */}</div>
  </div>
  <StatusBar left={<span>ready</span>} />
</div>
```

`NavRail` is the labeled sibling of `Sidebar`: visible captions plus a
phone reflow to a bottom bar. `ChipRow` is the scrollable sibling of
`ContentSwitcher`: same radiogroup contract for unbounded option counts.
`PalettePicker` is the swatch radiogroup behind any theme settings UI.

## Style rules

Structural (every theme, no exceptions): animate only `background`,
`color`, `border-color`, `opacity`; all sizes in `rem`, all colors as
`var(--token)`; `--radius-dot` never aliases `--radius`;
`prefers-reduced-motion` zeroes durations; lowercase terse copy, no
emoji, no ALL CAPS.

Default-theme aesthetics (tokens, so a theme can override wholesale):
radius `0`, no shadow, no gradients, 50/100ms linear motion,
`--font-ui` for chrome, Picon ligatures for icons. Never hardcode a
per-component exception. That belongs in a theme, not a call site.

A structural conflict means declining the request. An aesthetic
conflict means writing a theme (`registerTheme`/`defineTheme`), not
changing one component.

## Extending

New variant of an existing component (consumer app, no fork): mutate
the exported table once at startup (`BTN_VAR.subtle = {...}`);
`TAG_STYLE`, `BADGE_STYLE`, `STATUS_COLOR`, `TOAST_COLOR` work the same.
From inside this package: add the key to the table directly.

New component: typed props interface; `var(--token)` styles only;
`haptic()` on commit-time state changes; every mouse path needs a
keyboard path (roving `rovingKey`, dismiss `useDismiss`, focus trap in
`Modal` are the in-file patterns); required ARIA; export from
`components.tsx` and `index.ts`; spec entry in SPEC.md §4. Keep it
stateless and store-agnostic like the rest.

Promote to the kit when a pattern repeats across real consumers, not
after one use. Composed pieces (`PageHeader`, `ActionModal`,
`ReviewDialog`) are built from kit primitives, the way an app would
build them.

## Themes

`original-light` (default), `new-light`, `original-dark`, `dark`
(`new-dark` alias), `red-dark`. Full table: SPEC.md §2.1.

```ts
import { setTheme, useTheme, registerTheme, setAccent } from '@xplshn/anto-ui';
setTheme('dark');
registerTheme('brand-dark', { bg: '#0a0a12', accent: '#e94f37' });
setAccent('#e94f37');
```

Prefer `registerTheme`/`defineTheme` over inline color overrides.

## Motion, PWA, haptics

Timing is `--transition-fast`/`--transition-base`; override at `:root`,
never per-component. `prefers-reduced-motion` is already handled in CSS;
`usePrefersReducedMotion` covers JS-driven animation.

PWA (`injectManifest` + `registerServiceWorker`) is for installable or
offline apps, not every site. Haptics are on by default (short taps;
`confirm`/`error` bursts); extend via
`registerHapticPattern('success', [8, 30, 8])`, disable globally with
`setHapticsEnabled(false)`.

## Anti-patterns

- `import * as Anto`. Use named imports for tree-shaking.
- Re-declaring token values instead of using tokens.
- Wrapping `Btn` to restyle it. Use props or add a shared variant.
- Rebuilding modal/dropdown/toast/select. Check the exports first.
