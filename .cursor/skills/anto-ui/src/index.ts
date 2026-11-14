// anto design system: public api
//
// import './tokens.css' once at your app root (before any component
// renders) to load colors, type, shape/elevation/motion defaults, and the
// picon font. everything else is tree-shakeable named exports

export {
  // style helpers, plain style objects and functions rather than components
  textMono, textMuted, textSecondary, headingPage, headingSection, srOnly,
  stack, row, pageRoot, panel,
  flexItem, grid, sidebarLayout,
  tableBase, tableHeadCell, tableHeadRow, tableRow, tableCell, tableCellActions,
  // primitives and controls
  Icon, setIconSet, Spinner,
  Btn, IconBtn, Input, Textarea, Select, ComboBox, Checkbox, Radio, Slider, NumberInput,
  ToggleSwitch, Search, Splitter,
  Badge, Tag, ColorChip, StatusDot, Divider, Alert, Tile, ProgressBar, ProgressIndicator, Skeleton,
  Tabs, ContentSwitcher, ChipRow, Sidebar, NavRail, StatusBar, Breadcrumb, Accordion, Link, List,
  Modal, Pager, Tooltip, Toggletip, Menu, ActionModal,
  PageHeader, EmptyState, FormField, ReviewDialog,
  SectionHeader, PalettePicker, useRoving,
  CopyButton, CodeSnippet, InlineLoading,
  DataTable, FileUploader, TreeView,
  SplitButton, TabStrip, Collapse, CommandPalette, paletteScore,
  ToastProvider, useToast, usePager, useSelection,
  // exported so custom variants and statuses can be registered without a
  // fork of the component file, e.g. BTN_VAR.warn = {...}; BTN_HOVER.warn = {...};
  BTN_VAR, BTN_HOVER, BADGE_STYLE, TAG_STYLE, STATUS_COLOR, TOAST_COLOR,
} from './components.js';
export type {
  ComboBoxOption, DataTableColumn, FileUploaderFile, TreeNode, TabStripItem, MenuItemDef, CommandPaletteItem,
  ChipRowOption, PaletteOption, NavRailItem,
} from './components.js';

export {
  haptic, setHapticsEnabled, hapticsEnabled, registerHapticPattern,
} from './haptics.js';
export type { HapticPattern } from './haptics.js';

export {
  useMediaQuery, usePrefersReducedMotion,
  useStore, useAsync, useNow, useInterval, useClickOutside,
} from './hooks.js';
export type { ReadableStore, AsyncState } from './hooks.js';

export {
  cssVar, toHex, readableOn, resolveColor,
} from './css.js';

export {
  KONA_COLORS, applyKonaTheme,
  SKEUO_COLORS, applySkeuoTheme,
} from './themes.js';

export {
  THEMES, setTheme, getTheme, useTheme,
  registerTheme, defineTheme, setAccent, setRadius, setTextScale,
  setFontUi, setFontDisplay, setPalette,
} from './theme.js';
export type {
  ThemeName, ThemeTokens, ThemeShape, ThemeElevation,
  ThemeMotion, ThemeTypography, ThemeFocus, FullTheme,
} from './theme.js';

export {
  buildManifest, injectManifest,
  registerServiceWorker,
  usePWAInstall,
  useOnline,
} from './pwa.js';
export type { ManifestOptions, SWRegisterOptions, PWAInstallState } from './pwa.js';
