# @xplshn/anto-ui

React components for the Anto design system: suckless, terminal-flavored,
zero border-radius, monospace everywhere. Plus PWA and haptics helpers so
a full installable app is a handful of function calls, not a separate stack.

If you're an AI agent, read `SKILL.md` first — it's written for you.

## Install

```bash
npm install @xplshn/anto-ui react react-dom
```

## Use

```tsx
import { Btn, Input, Modal, useToast, ToastProvider } from '@xplshn/anto-ui';
import '@xplshn/anto-ui/tokens.css';

function App() {
  return (
    <ToastProvider>
      <Btn variant="primary" onClick={() => {}}>save</Btn>
    </ToastProvider>
  );
}
```

Load `tokens.css` once, at the app root, before anything else renders. It
carries the CSS variables every component reads (colors, spacing, type,
the picon icon font) and the five built-in themes: `original-light`
(default), `new-light`, `original-dark`, `dark`, `red-dark`.

```ts
import { setTheme, useTheme, registerTheme, defineTheme, setAccent, setRadius } from '@xplshn/anto-ui';

setTheme('dark');
registerTheme('brand-dark', { bg: '#0a0a12', text: '#eee', accent: '#e94f37' });
setAccent('#e94f37'); // or just reskin the accent on the current theme
setRadius('0.5rem');  // or just round everything, keep the rest
```

`registerTheme` only ever touched color. `defineTheme` is the full
surface — color plus the structural axes (shape, elevation, motion curve,
UI font, on-accent text, focus-ring style) that used to require forking a
component to change:

```ts
defineTheme('kona', {
  base: 'original-dark',          // inherit a built-in palette's colors...
  colors: { accent: '#d94f7c' },  // ...then override just the deltas
  shape: { radius: '0.75rem', radiusPill: '999rem' },
  elevation: { elevation1: '0 1px 3px rgba(0,0,0,.3)', elevation2: '0 8px 24px rgba(0,0,0,.4)' },
  motion: { ease: 'cubic-bezier(.3,.7,.4,1)' },
  typography: { fontUi: "'Nunito', system-ui, sans-serif" },
});
setTheme('kona');
```

`registerTheme(name, tokens)` is just `defineTheme(name, { colors: tokens })`
— same function underneath. Two example themes ship in `examples/themes/`
(Kona: feminine/soft/deep; Skeuo: a from-scratch skeuomorphic palette) as
demonstrations of the override surface, not built-ins.

Beyond `setAccent`/`setRadius`, three more single-axis setters exist for
the things people reach for on their own: `setTextScale('1.125')` scales
every font-size token without touching spacing/radius; `setFontUi(...)`/
`setFontDisplay(...)` swap the interface font and the heading font
independently; and `setPalette(...)` applies a *full* 15-color palette —
one of the 5 built-in names, or any `ThemeTokens` object — decoupled from
whichever theme's structural axes (radius/shadow/motion/font) are active,
so e.g. Skeuo's shadows and serif headings can stay on screen while a
different palette's colors sit on top. Every reference theme in
`examples/themes/` exports its own palette as data (`KONA_COLORS`,
`SKEUO_COLORS`) specifically so it's passable to `setPalette` on its own.
Full reference: SPEC.md §6.

## Extend without forking

Every variant table (`BTN_VAR`, `BTN_HOVER`, `BADGE_STYLE`,
`STATUS_COLOR`, `TOAST_COLOR`) is exported. Add a key at app startup and
the new variant works everywhere that component is used:

```ts
import { BTN_VAR, BTN_HOVER } from '@xplshn/anto-ui';
BTN_VAR.subtle   = { background: 'var(--bg3)', color: 'var(--text2)', borderColor: 'var(--border2)' };
BTN_HOVER.subtle = { background: 'var(--hover)', borderColor: 'var(--border)' };
// <Btn variant="subtle">
```

Global motion speed is two CSS tokens (`--transition-fast`,
`--transition-base`) — override them at `:root` to change every
component's animation timing at once, rather than a per-component prop.


## PWA in three calls

```ts
import { injectManifest, registerServiceWorker, usePWAInstall } from '@xplshn/anto-ui';

injectManifest({ name: 'My App', themeColor: '#4466ff' });
registerServiceWorker({ url: '/sw.js' }); // copy src/sw-template.js to public/sw.js first
```

```tsx
const { installable, promptInstall } = usePWAInstall();
{installable && <Btn onClick={promptInstall}>install app</Btn>}
```

## Haptics

Every interactive component (`Btn`, `Checkbox`, `Radio`, `Tabs`, `Toast`)
fires a short `navigator.vibrate` pulse on supported touch devices. It's a
no-op everywhere else. Turn it off globally with `setHapticsEnabled(false)`,
or per-button with `<Btn haptic={false}>`.

## What this is not

Not a CSS framework, not a design tool. It's ~65 components and helpers
covering the surface most apps need. If you need something outside that
surface, read `SPEC.md` (in the source repo) and build it to match — the
tokens and patterns are meant to be extended, not worked around.

## Build from source

```bash
npm install
npm run build   # emits dist/{index.js,index.cjs,index.d.ts}
```
