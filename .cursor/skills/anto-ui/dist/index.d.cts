import * as React from 'react';
import React__default from 'react';

declare const textMono: React__default.CSSProperties;
declare const textMuted: React__default.CSSProperties;
declare const textSecondary: React__default.CSSProperties;
/** visually hidden but still reachable by screen readers, for a label
 *  that needs to exist (a bare checkbox with no visible caption: "select
 *  row 3") without taking up layout space next to the control
 *  the standard clip-based technique, not `display: none` (which removes
 *  it from the accessibility tree entirely, defeating the point) */
declare const srOnly: React__default.CSSProperties;
declare const headingPage: React__default.CSSProperties;
declare const headingSection: React__default.CSSProperties;
declare const stack: (gap?: string) => React__default.CSSProperties;
declare const row: (gap?: string) => React__default.CSSProperties;
/** a page root container: a stack capped to a reading-friendly width,
 *  so content does not stretch edge-to-edge on a wide viewport */
declare const pageRoot: (maxWidth?: string) => React__default.CSSProperties;
/** boxed section: a bordered container for grouping related controls
 *  padding defaults to the themeable `--panel-padding` (the density
 *  axis); pass an explicit value to override just this call site */
declare const panel: (padding?: string) => React__default.CSSProperties;
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
declare const flexItem: (opts?: {
    grow?: number;
    shrink?: number;
    basis?: string;
    min?: string;
}) => React__default.CSSProperties;
/**
 * a responsive grid with zero breakpoints: columns add or drop themselves
 * based on available width, not a `--sm`/`--md`/`--lg` step table. each
 * tile never shrinks below `minItemWidth` and grows to fill leftover
 * space evenly, the `min(100%, ...)` guard keeps a single tile from
 * overflowing a container narrower than `minItemWidth` itself (a phone
 * viewport, a narrow sidebar panel), rather than needing a separate
 * mobile-only rule
 */
declare const grid: (minItemWidth?: string, gap?: string) => React__default.CSSProperties;
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
declare const sidebarLayout: (opts?: {
    asideWidth?: string;
    gap?: string;
    stackBelow?: string;
}) => {
    container: React__default.CSSProperties;
    aside: React__default.CSSProperties;
    main: React__default.CSSProperties;
};
declare const tableBase: React__default.CSSProperties;
declare const tableHeadCell: React__default.CSSProperties;
/** the <tr> wrapping a table <th> row (tableHeadCell styles the cells) */
declare const tableHeadRow: React__default.CSSProperties;
declare const tableRow: React__default.CSSProperties;
declare const tableCell: React__default.CSSProperties;
declare const tableCellActions: React__default.CSSProperties;
interface IconProps {
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    style?: React__default.CSSProperties;
    'aria-hidden'?: boolean | 'true' | 'false';
    'aria-label'?: string;
}
/** swap the glyph source for every Icon. null restores picon */
declare function setIconSet(glyphs: Record<string, string> | null, fontFamily?: string): void;
declare const Icon: React__default.FC<IconProps>;
declare function useRoving<T extends HTMLElement>(count: number, onPick: (next: number) => void, wrap?: boolean): {
    refs: React__default.MutableRefObject<Array<T | null>>;
    onKeyDown: (e: React__default.KeyboardEvent, index: number) => void;
    move: (next: number) => void;
};
declare const Spinner: React__default.FC;
type BtnVariant = 'primary' | 'default' | 'danger' | 'ghost' | (string & {});
type BtnSize = 'sm' | 'md' | 'lg';
interface BtnProps {
    children: React__default.ReactNode;
    variant?: BtnVariant;
    size?: BtnSize;
    disabled?: boolean;
    loading?: boolean;
    onClick?: React__default.MouseEventHandler<HTMLButtonElement>;
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
    style?: React__default.CSSProperties;
}
declare const BTN_VAR: Record<string, React__default.CSSProperties>;
declare const BTN_HOVER: Record<string, React__default.CSSProperties>;
declare const Btn: React__default.FC<BtnProps>;
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
    style?: React__default.CSSProperties;
}
declare const IconBtn: React__default.FC<IconBtnProps>;
interface InputProps {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string, e: React__default.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: React__default.KeyboardEventHandler<HTMLInputElement>;
    onFocus?: () => void;
    placeholder?: string;
    type?: React__default.HTMLInputTypeAttribute;
    disabled?: boolean;
    error?: string | null;
    size?: BtnSize;
    style?: React__default.CSSProperties;
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
declare const Input: React__default.FC<InputProps>;
interface TextareaProps {
    value?: string;
    onChange?: (value: string, e: React__default.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    error?: string | null;
    'aria-label'?: string;
}
declare const Textarea: React__default.FC<TextareaProps>;
interface SelectOption {
    value: string;
    label: string;
}
interface SelectProps {
    value?: string;
    onChange?: (value: string, e: React__default.ChangeEvent<HTMLSelectElement>) => void;
    options: Array<SelectOption | string>;
    disabled?: boolean;
    size?: BtnSize;
    'aria-label'?: string;
    style?: React__default.CSSProperties;
}
declare const Select: React__default.FC<SelectProps>;
interface CheckboxProps {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    label?: React__default.ReactNode;
    disabled?: boolean;
}
declare const Checkbox: React__default.FC<CheckboxProps>;
interface RadioProps {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    label?: React__default.ReactNode;
    disabled?: boolean;
    name?: string;
    value?: string;
}
declare const Radio: React__default.FC<RadioProps>;
type BadgeVariant = 'muted' | 'accent' | 'ok' | 'warn' | 'err' | (string & {});
interface BadgeProps {
    children: React__default.ReactNode;
    variant?: BadgeVariant;
}
declare const BADGE_STYLE: Record<string, React__default.CSSProperties>;
declare const Badge: React__default.FC<BadgeProps>;
type TagVariant = 'gray' | 'accent' | 'ok' | 'warn' | 'err' | (string & {});
interface TagProps {
    children: React__default.ReactNode;
    variant?: TagVariant;
    /** adds a remove button, omit for a plain non-dismissible tag */
    onDismiss?: () => void;
    'aria-label'?: string;
}
declare const TAG_STYLE: Record<string, React__default.CSSProperties>;
declare const Tag: React__default.FC<TagProps>;
interface ColorChipProps {
    label: React__default.ReactNode;
    /** arbitrary fill, e.g. an api-driven color. foreground is derived by
     *  luminance, never hardcoded, since a palette can hold light and dark
     *  fills side by side. */
    color: string;
}
declare const ColorChip: React__default.FC<ColorChipProps>;
interface ToggleSwitchProps {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    label?: React__default.ReactNode;
    disabled?: boolean;
    size?: 'sm' | 'md';
    'aria-label'?: string;
}
declare const ToggleSwitch: React__default.FC<ToggleSwitchProps>;
interface ProgressBarProps {
    /** 0 to 100, omit for an indeterminate bar (unknown duration) */
    value?: number;
    label?: React__default.ReactNode;
    showValue?: boolean;
    /** fill color, default 'var(--accent)' */
    color?: string;
    'aria-label'?: string;
}
declare const ProgressBar: React__default.FC<ProgressBarProps>;
interface SkeletonProps {
    width?: string;
    height?: string;
    /** round it fully, for a placeholder standing in for a status dot, an
     *  icon or an avatar, rather than the usual --radius-sm block */
    circle?: boolean;
    style?: React__default.CSSProperties;
}
declare const Skeleton: React__default.FC<SkeletonProps>;
type StatusValue = 'online' | 'idle' | 'dnd' | 'offline' | (string & {});
interface StatusDotProps {
    status: StatusValue;
    label?: string;
}
declare const STATUS_COLOR: Record<string, string>;
declare const StatusDot: React__default.FC<StatusDotProps>;
interface TabItem {
    id: string;
    label: string;
}
interface TabsProps {
    tabs: TabItem[];
    active: string;
    onChange?: (id: string) => void;
}
declare const Tabs: React__default.FC<TabsProps>;
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
declare const Sidebar: React__default.FC<SidebarProps>;
interface NavRailItem extends SidebarItem {
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
declare const NavRail: React__default.FC<NavRailProps>;
interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
}
interface BreadcrumbProps {
    items: BreadcrumbItem[];
}
declare const Breadcrumb: React__default.FC<BreadcrumbProps>;
interface CollapseProps {
    open: boolean;
    children: React__default.ReactNode;
    /** milliseconds. default 200. 0 renders open and closed with no animation. */
    duration?: number;
    style?: React__default.CSSProperties;
}
declare const Collapse: React__default.FC<CollapseProps>;
interface AccordionItem {
    id: string;
    title: React__default.ReactNode;
    content: React__default.ReactNode;
}
interface AccordionProps {
    items: AccordionItem[];
    /** controlled: the currently-open ids, omit for uncontrolled (the
     *  component tracks its own open set internally) */
    open?: string[];
    onToggle?: (id: string) => void;
    /** allow more than one section open at once, default true */
    multiple?: boolean;
}
declare const Accordion: React__default.FC<AccordionProps>;
interface StatusBarProps {
    left?: React__default.ReactNode;
    right?: React__default.ReactNode;
}
declare const StatusBar: React__default.FC<StatusBarProps>;
interface AlertProps {
    children: React__default.ReactNode;
    /** border/accent color, typically a severity token
     *  ('var(--warn)'/'var(--err)'/'var(--ok)'), default 'var(--warn)' */
    color?: string;
    /** right-aligned, e.g. a Btn that opens a dialog with more detail */
    action?: React__default.ReactNode;
    /** optional bold heading above children. filling this (and/or
     *  onDismiss) turns the same bordered-row primitive into the
     *  "inline notification" shape, no separate component, more slots
     *  used. leave both unset for the original plain banner */
    title?: React__default.ReactNode;
    /** adds a close control. omit for a banner that persists until its
     *  underlying condition clears (the original, still-default behavior,
     *  since Toast already owns the transient/auto-dismiss case) */
    onDismiss?: () => void;
}
declare const Alert: React__default.FC<AlertProps>;
interface TileProps {
    children: React__default.ReactNode;
    /** toggled/selected look (accent border, raised surface), only
     *  meaningful when `onClick` is set, since a purely static tile has no
     *  selection state to show */
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    style?: React__default.CSSProperties;
    'aria-label'?: string;
}
declare const Tile: React__default.FC<TileProps>;
interface ModalProps {
    title: React__default.ReactNode;
    children: React__default.ReactNode;
    footer?: React__default.ReactNode;
    onClose?: () => void;
    open?: boolean;
    /** box width, default 24rem, always capped at 90vw. ignored when
     *  size is set, which picks the width from the preset table */
    width?: string;
    /** named width so screen-centered flows (settings, managers) share one
     *  size instead of each call site guessing its own rem value */
    size?: 'sm' | 'md' | 'lg' | 'page';
}
declare const Modal: React__default.FC<ModalProps>;
interface PagerProps {
    /** 1-based */
    page: number;
    pageCount: number;
    onPage: (page: number) => void;
    /** labels the `<nav>` landmark, default "pager" */
    'aria-label'?: string;
}
declare const Pager: React__default.FC<PagerProps>;
interface UsePagerResult {
    page: number;
    pageCount: number;
    setPage: (page: number) => void;
}
declare function usePager(total: number, pageSize: number): UsePagerResult;
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
declare function useSelection(): UseSelectionResult;
type TipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipAnchorProps = {
    style?: React__default.CSSProperties;
    children?: React__default.ReactNode;
    [key: string]: unknown;
};
interface TooltipProps {
    content: string;
    children: React__default.ReactElement<TooltipAnchorProps>;
    position?: TipPosition;
}
declare const Tooltip: React__default.FC<TooltipProps>;
interface ToggletipProps {
    /** the trigger, cloned with an onClick and aria-expanded/aria-controls,
     *  same pattern as the Tooltip children. typically a Btn or Icon */
    children: React__default.ReactElement<TooltipAnchorProps>;
    content: React__default.ReactNode;
    position?: TipPosition;
    'aria-label'?: string;
}
declare const Toggletip: React__default.FC<ToggletipProps>;
interface MenuItemDef {
    id: string;
    label: React__default.ReactNode;
    onClick?: () => void;
    danger?: boolean;
    disabled?: boolean;
}
interface MenuProps {
    /** the trigger, cloned with onClick (toggles) and aria-expanded/
     *  aria-haspopup/aria-controls, same anchor pattern as Toggletip */
    children: React__default.ReactElement<TooltipAnchorProps>;
    items: MenuItemDef[];
    position?: TipPosition;
    'aria-label'?: string;
}
declare const Menu: React__default.FC<MenuProps>;
interface SplitButtonProps {
    children: React__default.ReactNode;
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
declare const SplitButton: React__default.FC<SplitButtonProps>;
interface TabStripItem {
    id: string;
    label: React__default.ReactNode;
    icon?: string;
    badge?: React__default.ReactNode;
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
declare const TabStrip: React__default.FC<TabStripProps>;
interface LinkProps {
    href?: string;
    onClick?: () => void;
    children: React__default.ReactNode;
    disabled?: boolean;
    style?: React__default.CSSProperties;
}
declare const Link: React__default.FC<LinkProps>;
interface ListProps {
    children: React__default.ReactNode;
    ordered?: boolean;
    style?: React__default.CSSProperties;
}
declare const List: React__default.FC<ListProps>;
interface CopyButtonProps {
    text: string;
    'aria-label'?: string;
}
declare const CopyButton: React__default.FC<CopyButtonProps>;
interface CodeSnippetProps {
    children: string;
    /** a short inline chip (a variable name, a command) vs a block with
     *  its own CopyButton (a full snippet) */
    inline?: boolean;
    'aria-label'?: string;
}
declare const CodeSnippet: React__default.FC<CodeSnippetProps>;
type InlineLoadingStatus = 'loading' | 'success' | 'error';
interface InlineLoadingProps {
    status: InlineLoadingStatus;
    children?: React__default.ReactNode;
}
declare const InlineLoading: React__default.FC<InlineLoadingProps>;
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
declare const ContentSwitcher: React__default.FC<ContentSwitcherProps>;
interface ChipRowOption {
    id: string;
    label: React__default.ReactNode;
}
interface ChipRowProps {
    options: ChipRowOption[];
    value: string;
    onChange: (id: string) => void;
    'aria-label'?: string;
}
declare const ChipRow: React__default.FC<ChipRowProps>;
interface PaletteOption {
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
    note?: React__default.ReactNode;
}
declare const PalettePicker: React__default.FC<PalettePickerProps>;
interface ProgressStepDef {
    id: string;
    label: string;
}
interface ProgressIndicatorProps {
    steps: ProgressStepDef[];
    currentIndex: number;
    invalidIndex?: number;
}
declare const ProgressIndicator: React__default.FC<ProgressIndicatorProps>;
interface SearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    size?: 'sm' | 'md' | 'lg';
    'aria-label'?: string;
}
declare const Search: React__default.FC<SearchProps>;
interface ComboBoxOption {
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
declare const ComboBox: React__default.FC<ComboBoxProps>;
interface DataTableColumn<T> {
    key: string;
    label: string;
    sortable?: boolean;
    /** right-aligns the column, the carbon rule for numeric or variable
     *  values (prices, percentages); left stays the default for everything
     *  else including headers */
    numeric?: boolean;
    render?: (row: T) => React__default.ReactNode;
}
interface DataTableProps<T extends {
    id: string;
}> {
    columns: DataTableColumn<T>[];
    rows: T[];
    selected?: Set<string>;
    onToggleRow?: (id: string) => void;
    onSelectAll?: (ids: string[]) => void;
    onClearSelection?: () => void;
    /** rendered in the batch-action bar, next to the built-in cancel
     *  button, once `selected` is non-empty */
    batchActions?: React__default.ReactNode;
    searchable?: boolean;
    searchPlaceholder?: string;
    'aria-label'?: string;
}
declare function DataTable<T extends {
    id: string;
}>({ columns, rows, selected, onToggleRow, onSelectAll, onClearSelection, batchActions, searchable, searchPlaceholder, ...aria }: DataTableProps<T>): React__default.ReactElement;
interface FileUploaderFile {
    id: string;
    name: string;
    status: 'uploading' | 'complete' | 'error';
    errorMessage?: string;
}
interface FileUploaderProps {
    files: FileUploaderFile[];
    onAdd: (fileList: FileList) => void;
    onRemove: (id: string) => void;
    accept?: string;
    multiple?: boolean;
    label?: string;
    'aria-label'?: string;
}
declare const FileUploader: React__default.FC<FileUploaderProps>;
interface TreeNode {
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
interface TreeViewProps {
    nodes: TreeNode[];
    expanded: Set<string>;
    onToggleExpand: (id: string) => void;
    selected?: string;
    onSelect?: (id: string) => void;
    'aria-label'?: string;
}
declare const TreeView: React__default.FC<TreeViewProps>;
type ToastVariant = 'info' | 'ok' | 'warn' | 'err' | (string & {});
interface ToastContextValue {
    push(message: string, variant?: ToastVariant, ms?: number): void;
}
declare function useToast(): ToastContextValue;
declare const TOAST_COLOR: Record<string, string>;
declare const ToastProvider: React__default.FC<{
    children: React__default.ReactNode;
}>;
interface DividerProps {
    orientation?: 'horizontal' | 'vertical';
    label?: string;
}
declare const Divider: React__default.FC<DividerProps>;
interface SliderProps {
    value: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    label?: React__default.ReactNode;
    /** show the numeric value next to the label, default true */
    showValue?: boolean;
    haptic?: boolean;
    style?: React__default.CSSProperties;
    'aria-label'?: string;
}
declare const Slider: React__default.FC<SliderProps>;
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
declare const Splitter: React__default.FC<SplitterProps>;
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
declare const NumberInput: React__default.FC<NumberInputProps>;
interface PageHeaderProps {
    title: string;
    /** one line (or two short ones) under the title: what this screen
     *  is for, or what state it is in. omit when the title already says
     *  everything */
    description?: React__default.ReactNode;
    /** count or status badge: whatever belongs beside the title rather
     *  than under it */
    meta?: React__default.ReactNode;
    /** buttons, right-aligned */
    actions?: React__default.ReactNode;
    /** caps the description width so it does not stretch edge-to-edge on a
     *  wide page, unset means no cap */
    descriptionMaxWidth?: string;
    /** back navigation. renders a ghost button with a left glyph before
     *  the title, so detail screens do not rebuild the header by hand. */
    onBack?: () => void;
    /** accessible name for the back button. */
    backLabel?: string;
}
declare const PageHeader: React__default.FC<PageHeaderProps>;
interface EmptyStateProps {
    icon: string;
    title: string;
    /** what to do about it. an empty state that only says "nothing
     *  here" is a dead end, so every one of these should point at the
     *  next step */
    help: React__default.ReactNode;
    action?: React__default.ReactNode;
}
declare const EmptyState: React__default.FC<EmptyStateProps>;
interface FormFieldProps {
    label: string;
    htmlFor?: string;
    /** muted one-liner under the control, what to type, not what it is */
    hint?: React__default.ReactNode;
    /** info icon beside the label with this text in a toggletip, when the
     *  label alone does not say enough and a full hint line is too much */
    help?: React__default.ReactNode;
    children: React__default.ReactNode;
}
declare const FormField: React__default.FC<FormFieldProps>;
interface SectionHeaderProps {
    title: React__default.ReactNode;
    /** info icon beside the title with this text in a toggletip */
    help?: React__default.ReactNode;
    /** right-aligned, e.g. a reset button for just this section */
    actions?: React__default.ReactNode;
}
declare const SectionHeader: React__default.FC<SectionHeaderProps>;
interface ActionModalProps {
    title: React__default.ReactNode;
    children: React__default.ReactNode;
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
declare const ActionModal: React__default.FC<ActionModalProps>;
interface ReviewDialogGroup<T> {
    key: string;
    items: T[];
}
type ReviewDialogSource<T> = {
    items: T[];
    groups?: undefined;
} | {
    items?: undefined;
    groups: ReviewDialogGroup<T>[];
};
interface ReviewDialogConfirmStep {
    title: React__default.ReactNode;
    confirmLabel: string;
    danger?: boolean;
    /** count: how many items are about to be acted on. emptiedGroups:
     *  how many groups (grouped mode only) would end up with none of
     *  their items left, always 0 in flat mode */
    message: (count: number, emptiedGroups: number) => React__default.ReactNode;
}
type ReviewDialogProps<T extends {
    id: string;
}> = ReviewDialogSource<T> & {
    renderItem: (item: T) => React__default.ReactNode;
    /** grouped mode only: shown inside a group card when every one of
     *  its items is currently selected. return null/undefined to say
     *  nothing for that group */
    renderGroupWarning?: (group: ReviewDialogGroup<T>) => React__default.ReactNode;
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
    badge: React__default.ReactNode;
    bannerColor?: string;
    bannerMessage: React__default.ReactNode;
    reviewLabel?: string;
    title: string;
    selectAllLabel: string;
    intro?: React__default.ReactNode;
    closeLabel?: string;
    pageSize?: number;
    /** gates opening the dialog. the banner still shows either way (ambient
     *  status, not a permission gate), only the review action itself is
     *  gated. pass true if there is nothing to gate */
    canResolve: boolean;
};
declare function ReviewDialog<T extends {
    id: string;
}>(props: ReviewDialogProps<T>): React__default.JSX.Element | null;
interface CommandPaletteItem {
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
declare function paletteScore(label: string, query: string): number;
declare const CommandPalette: React__default.FC<CommandPaletteProps>;

/** turn haptic feedback on/off app-wide, persists only for the session */
declare function setHapticsEnabled(value: boolean): void;
declare function hapticsEnabled(): boolean;
type HapticPattern = 'tap' | 'toggle' | 'confirm' | 'error' | (string & {});
/**
 * add or override a named pattern, e.g. registerHapticPattern("success",
 * [8, 30, 8]). keep pulses short, see the module note above
 */
declare function registerHapticPattern(name: string, pattern: number | number[]): void;
/**
 * fire a short vibration pulse, accepts a named pattern (built-in or
 * registered via registerHapticPattern) or a raw duration / pattern array
 * for one-off use, no-ops on any platform without navigator.vibrate
 * (desktop, iOS) and when disabled, never throws
 */
declare function haptic(pattern?: HapticPattern | number | number[]): void;

interface ReadableStore<T> {
    get(): T;
    subscribe(fn: () => void): () => void;
}
declare function useStore<T>(store: ReadableStore<T>): T;
declare function useInterval(fn: () => void, ms: number | null): void;
declare function useNow(intervalMs?: number): number;
interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: boolean;
    reload: () => void;
}
declare function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T>;
declare function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void): void;
declare function useMediaQuery(query: string): boolean;
declare function usePrefersReducedMotion(): boolean;

/** read the resolved value of a css custom property from <html>. returns
 *  the trimmed string, or '' when the property is unset. use it to feed a
 *  token value into a control that needs the computed value (a color
 *  input, a canvas) rather than the var() reference */
declare function cssVar(name: string): string;
/**
 * convert any css color string (hex, rgb(), a var() that already resolved
 * to a color, a named color) into '#rrggbb'. returns '#000000' when the
 * value cannot be resolved or is not an opaque color. uses a throwaway
 * canvas because the browser normalizes the fillStyle through its own
 * color parser, which is the only reliable way to flatten a var() or
 * color-mix() into a hex an <input type="color"> can display
 */
declare function toHex(color: string): string;
declare function readableOn(hex: string): string;
declare function resolveColor(value: string | undefined | null, fallback: string): string;

declare const THEMES: readonly ["original-light", "new-light", "original-dark", "dark", "red-dark"];
type ThemeName = (typeof THEMES)[number] | (string & {});
/** set the active theme by writing `data-theme` on `<html>` */
declare function setTheme(name: ThemeName): void;
/** read the active theme (falls back to the persisted or default one) */
declare function getTheme(): ThemeName;
/**
 * React hook: current theme name + setter, re-rendering on changes made
 * through this hook (does not observe external `data-theme` mutations, so
 * route all theme changes through `setTheme`/this hook for consistency)
 */
declare function useTheme(): [ThemeName, (name: ThemeName) => void];
type ThemeTokens = Partial<{
    bg: string;
    bg2: string;
    bg3: string;
    text: string;
    text2: string;
    text3: string;
    accent: string;
    accent2: string;
    border: string;
    border2: string;
    ok: string;
    warn: string;
    err: string;
    hover: string;
    modalBg: string;
}>;
type ThemeShape = Partial<{
    radius: string;
    radiusSm: string;
    radiusLg: string;
    radiusPill: string;
    radiusBtn: string;
    radiusInput: string;
    radiusCard: string;
    radiusModal: string;
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
type ThemeElevation = Partial<{
    elevation1: string;
    elevation2: string;
    elevation3: string;
    /** the "sunken surface" shadow for form fields and slider tracks, kept
     *  separate from elevation1-3 (raised) because recessed and raised are
     *  never the same shadow recipe */
    elevationInset: string;
}>;
type ThemeMotion = Partial<{
    /** the easing half of every transition token, swap this alone to change
     *  every component motion curve without retyping duration */
    ease: string;
    transitionFast: string;
    transitionBase: string;
}>;
type ThemeTypography = Partial<{
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
type ThemeFocus = Partial<{
    focusOutline: string;
    /** off by default (the hard outline is the only ring), set this for a
     *  soft shadow-halo focus style instead of, or in addition to, the
     *  outline, see the --focus-shadow comment in tokens.css */
    focusShadow: string;
}>;
interface FullTheme {
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
declare function defineTheme(name: string, theme: FullTheme): void;
/**
 * register a 6th+ color palette at runtime, the color-only subset of
 * defineTheme, kept as its own export because most reskins only ever
 * touch color, equivalent to defineTheme(name, { colors: tokens })
 */
declare function registerTheme(name: string, tokens: ThemeTokens): void;
/**
 * override just the accent color of the active theme, e.g. to match a
 * brand color without defining a whole palette. it sets an inline style on
 * `<html>`, so it beats the stylesheet regardless of which theme is
 * active. pass null to clear the override and fall back to the accent of
 * the active theme
 */
declare function setAccent(color: string | null): void;
/**
 * override just the global radius of the active theme, the same
 * single-axis tweak without a whole theme pattern as setAccent, for the
 * other override people reach for most (e.g. a live rounded corners
 * toggle in a settings screen), pass null to clear it
 * component-specific radius tokens (--radius-btn etc.) still cascade from
 * --radius unless a theme pinned them individually
 */
declare function setRadius(value: string | null): void;
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
declare function setTextScale(value: string | null): void;
/**
 * override the interface-chrome font of the active theme, affects every
 * component except headingPage/headingSection (those read --font-display,
 * setFontDisplay below) and code/pre (always --font-mono, never
 * themeable, see the textMono comment in components.tsx). pass a full
 * font-family stack (system fallbacks included, same as any --font-ui
 * value in a theme definition), or null to clear
 */
declare function setFontUi(value: string | null): void;
/**
 * override just headingPage/headingSection font, the other half of the
 * display/body split (see setFontUi). independent on purpose: picking a
 * display face should not force every button/input/label onto it too
 */
declare function setFontDisplay(value: string | null): void;
declare function setPalette(source: ThemeName | ThemeTokens | null): void;

declare const KONA_COLORS: ThemeTokens;
declare function applyKonaTheme(): void;
declare const SKEUO_COLORS: ThemeTokens;
declare function applySkeuoTheme(): void;

interface ManifestOptions {
    name: string;
    shortName?: string;
    description?: string;
    /** hex, matches --bg for the active theme, defaults to the dark background */
    backgroundColor?: string;
    /** hex, matches --accent, defaults to the accent blue */
    themeColor?: string;
    startUrl?: string;
    display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
    icons?: Array<{
        src: string;
        sizes: string;
        type?: string;
        purpose?: string;
    }>;
}
/** build a manifest.json object, serve it yourself or use injectManifest() */
declare function buildManifest(opts: ManifestOptions): Record<string, unknown>;
/**
 * inject a manifest at runtime as a blob url on the link rel="manifest" tag,
 * convenient for prototypes and single page apps that skip a static
 * manifest.json build step. for production write manifest.json to disk
 * instead, a real file is cacheable and crawlable while a blob url is
 * neither
 */
declare function injectManifest(opts: ManifestOptions): void;
interface SWRegisterOptions {
    url?: string;
    onUpdate?: (registration: ServiceWorkerRegistration) => void;
    onSuccess?: (registration: ServiceWorkerRegistration) => void;
}
/**
 * register a service worker, call once in the app entry point, pairs with
 * the cache-first worker in `sw-template.js`, copy that file to the public
 * root as `sw.js` and point `url` at it, or bring your own
 */
declare function registerServiceWorker(opts?: SWRegisterOptions): void;
interface PWAInstallState {
    /** true once the browser has signaled the app is installable */
    installable: boolean;
    /** true once the app is already running standalone, or installed */
    installed: boolean;
    /** trigger the native install prompt, no-op when not installable */
    promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}
/**
 * drive an install button, handles the beforeinstallprompt event and
 * standalone detection so callers only render a Btn conditioned on
 * installable or installed
 */
declare function usePWAInstall(): PWAInstallState;
/** track connectivity so the interface can show an offline badge or toast */
declare function useOnline(): boolean;

export { Accordion, ActionModal, Alert, type AsyncState, BADGE_STYLE, BTN_HOVER, BTN_VAR, Badge, Breadcrumb, Btn, Checkbox, ChipRow, type ChipRowOption, CodeSnippet, Collapse, ColorChip, ComboBox, type ComboBoxOption, CommandPalette, type CommandPaletteItem, ContentSwitcher, CopyButton, DataTable, type DataTableColumn, Divider, EmptyState, FileUploader, type FileUploaderFile, FormField, type FullTheme, type HapticPattern, Icon, IconBtn, InlineLoading, Input, KONA_COLORS, Link, List, type ManifestOptions, Menu, type MenuItemDef, Modal, NavRail, type NavRailItem, NumberInput, type PWAInstallState, PageHeader, Pager, type PaletteOption, PalettePicker, ProgressBar, ProgressIndicator, Radio, type ReadableStore, ReviewDialog, SKEUO_COLORS, STATUS_COLOR, type SWRegisterOptions, Search, SectionHeader, Select, Sidebar, Skeleton, Slider, Spinner, SplitButton, Splitter, StatusBar, StatusDot, TAG_STYLE, THEMES, TOAST_COLOR, TabStrip, type TabStripItem, Tabs, Tag, Textarea, type ThemeElevation, type ThemeFocus, type ThemeMotion, type ThemeName, type ThemeShape, type ThemeTokens, type ThemeTypography, Tile, ToastProvider, ToggleSwitch, Toggletip, Tooltip, type TreeNode, TreeView, applyKonaTheme, applySkeuoTheme, buildManifest, cssVar, defineTheme, flexItem, getTheme, grid, haptic, hapticsEnabled, headingPage, headingSection, injectManifest, pageRoot, paletteScore, panel, readableOn, registerHapticPattern, registerServiceWorker, registerTheme, resolveColor, row, setAccent, setFontDisplay, setFontUi, setHapticsEnabled, setIconSet, setPalette, setRadius, setTextScale, setTheme, sidebarLayout, srOnly, stack, tableBase, tableCell, tableCellActions, tableHeadCell, tableHeadRow, tableRow, textMono, textMuted, textSecondary, toHex, useAsync, useClickOutside, useInterval, useMediaQuery, useNow, useOnline, usePWAInstall, usePager, usePrefersReducedMotion, useRoving, useSelection, useStore, useTheme, useToast };
