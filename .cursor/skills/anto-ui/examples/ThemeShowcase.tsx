// Theme showcase for @xplshn/anto-ui — every exported component in one
// page, with a live theme switcher (5 built-ins + Kona + Skeuo), a
// palette override decoupled from that switcher, a font picker, and a
// text-size control. Same "copy into a Vite/Next app" pattern as
// App.tsx — this isn't a standalone build target.
//
// The page's own shell dogfoods SPEC.md §11's layout primitives: the
// two-column nav/content split is sidebarLayout(), the button/tag/
// progress cards are grid(), and the "layout primitives" section shows
// flexItem() live. Nothing here is decorative — it's the same reflow a
// consuming app gets from importing these helpers.

import React from 'react';
import {
  THEMES, useTheme, setTextScale, setFontUi, setPalette,
  Btn, Input, Select, ComboBox, Checkbox, Radio, Tag, ToggleSwitch, ProgressBar,
  Skeleton, Badge, StatusDot, Divider, Alert, Tile, Breadcrumb, Accordion,
  Tooltip, Toggletip, Menu, Spinner, Tabs, Modal, NumberInput, Slider, FormField,
  Link, List, CopyButton, CodeSnippet, InlineLoading, ContentSwitcher,
  ProgressIndicator, Search, DataTable, FileUploader, TreeView,
  headingPage, headingSection, textMuted, textSecondary,
  stack, row, panel, grid, flexItem, sidebarLayout,
} from '@xplshn/anto-ui';
import type { DataTableColumn, FileUploaderFile, TreeNode } from '@xplshn/anto-ui';
import '@xplshn/anto-ui/tokens.css';
import { applyKonaTheme, KONA_COLORS } from './themes/kona.js';
import { applySkeuoTheme, SKEUO_COLORS } from './themes/skeuo.js';

applyKonaTheme();
applySkeuoTheme();

const ALL_THEMES = [...THEMES, 'kona', 'skeuo'] as const;

// A step table, not a raw number range: keeps setTextScale's input to
// values that were actually eyeballed for readability, same reasoning
// as tokens.css using a fixed --space-* scale instead of arbitrary px.
const TEXT_SCALE_STEPS = ['0.875', '1', '1.125', '1.25', '1.5'];
const DEFAULT_SCALE_IDX = 1; // '1'

// setFontUi takes a full font-family stack, same shape a theme's own
// typography.fontUi would use (system fallbacks included).
const FONT_OPTIONS = [
  { value: '', label: 'theme default' },
  { value: "system-ui, -apple-system, 'Segoe UI', sans-serif", label: 'sans (system)' },
  { value: "Georgia, 'Times New Roman', serif", label: 'serif' },
  { value: "'JetBrains Mono', 'Iosevka', ui-monospace, monospace", label: 'monospace' },
];

// setPalette (SPEC §6.2.1): the 5 built-ins by name, plus Kona's and
// Skeuo's own palettes exported as data — decoupled from either theme's
// radius/elevation/motion/typography, on purpose. Picking "skeuo colors"
// while "kona" is the active theme, for instance, proves the decoupling
// rather than just asserting it.
const PALETTE_OPTIONS = [
  { value: '', label: 'theme default' },
  ...THEMES.map(t => ({ value: t, label: t })),
  { value: 'kona', label: 'kona colors' },
  { value: 'skeuo', label: 'skeuo colors' },
];

const SECTIONS = [
  { id: 'buttons',  label: 'buttons' },
  { id: 'tags',     label: 'tags, badges, status' },
  { id: 'progress', label: 'progress & loading' },
  { id: 'forms',    label: 'form controls' },
  { id: 'overlays', label: 'tooltips & overlays' },
  { id: 'nav',      label: 'navigation' },
  { id: 'carbon',   label: 'carbon gaps closed' },
  { id: 'data',     label: 'data & files' },
  { id: 'layout',   label: 'layout primitives' },
] as const;

interface DemoRow { id: string; name: string; role: string; count: number }
const DEMO_ROWS: DemoRow[] = [
  { id: 'r1', name: 'alpha', role: 'admin', count: 12 },
  { id: 'r2', name: 'bravo', role: 'editor', count: 4 },
  { id: 'r3', name: 'charlie', role: 'viewer', count: 31 },
];
const DEMO_COLUMNS: DataTableColumn<DemoRow>[] = [
  { key: 'name', label: 'name', sortable: true },
  { key: 'role', label: 'role', sortable: true },
  { key: 'count', label: 'count', sortable: true, numeric: true },
];
const DEMO_TREE: TreeNode[] = [
  { id: 't1', label: 'src', children: [
    { id: 't1a', label: 'components.tsx' },
    { id: 't1b', label: 'theme.ts' },
  ] },
  { id: 't2', label: 'examples', children: [
    { id: 't2a', label: 'ThemeShowcase.tsx' },
  ] },
];

export default function ThemeShowcase() {
  const [theme, setTheme] = useTheme();
  const [scaleIdx, setScaleIdx] = React.useState(DEFAULT_SCALE_IDX);
  const [fontChoice, setFontChoice] = React.useState('');
  const [paletteChoice, setPaletteChoice] = React.useState('');
  const [text, setText] = React.useState('');
  const [checked, setChecked] = React.useState(true);
  const [toggled, setToggled] = React.useState(false);
  const [radioPick, setRadioPick] = React.useState('a');
  const [selectedTile, setSelectedTile] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(true);
  const [openSections, setOpenSections] = React.useState<string[]>(['s1']);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('one');
  const [qty, setQty] = React.useState(3);
  const [volume, setVolume] = React.useState(40);
  const [switcherPick, setSwitcherPick] = React.useState('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loadStatus, setLoadStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [comboValue, setComboValue] = React.useState<string[]>([]);
  const [tableSelected, setTableSelected] = React.useState<Set<string>>(new Set());
  const [uploaderFiles, setUploaderFiles] = React.useState<FileUploaderFile[]>([]);
  const [treeExpanded, setTreeExpanded] = React.useState<Set<string>>(new Set(['t1']));
  const [treeSelected, setTreeSelected] = React.useState<string>();

  function changeScale(delta: number): void {
    const next = Math.min(TEXT_SCALE_STEPS.length - 1, Math.max(0, scaleIdx + delta));
    setScaleIdx(next);
    setTextScale(next === DEFAULT_SCALE_IDX ? null : TEXT_SCALE_STEPS[next]);
  }

  function onFontChange(value: string): void {
    setFontChoice(value);
    setFontUi(value === '' ? null : value);
  }

  function onPaletteChange(value: string): void {
    setPaletteChoice(value);
    if (value === '') setPalette(null);
    else if (value === 'kona') setPalette(KONA_COLORS);
    else if (value === 'skeuo') setPalette(SKEUO_COLORS);
    else setPalette(value as typeof THEMES[number]);
  }

  const { container, aside, main } = sidebarLayout({ asideWidth: '11rem', gap: 'var(--space-6)', stackBelow: '65%' });

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={panel('var(--space-3)')}>
        <div style={stack('var(--space-1)')}>
          <span style={textMuted}>theme</span>
          <div style={row('var(--space-1)')}>
            {ALL_THEMES.map(t => (
              <Btn key={t} size="sm" variant={t === theme ? 'primary' : 'default'} onClick={() => setTheme(t)}>
                {t}
              </Btn>
            ))}
          </div>
        </div>

        <div style={{ ...row('var(--space-4)'), alignItems: 'flex-end' }}>
          <div style={stack('var(--space-1)')}>
            <span style={textMuted}>palette override</span>
            <Select value={paletteChoice} onChange={onPaletteChange} options={PALETTE_OPTIONS} style={{ width: '10rem' }} />
          </div>
          <div style={stack('var(--space-1)')}>
            <span style={textMuted}>font</span>
            <Select value={fontChoice} onChange={onFontChange} options={FONT_OPTIONS} style={{ width: '11rem' }} />
          </div>
          <div style={stack('var(--space-1)')}>
            <span style={textMuted}>text size</span>
            <div style={row('var(--space-1)')}>
              <Btn size="sm" variant="ghost" aria-label="smaller text" disabled={scaleIdx === 0}
                onClick={() => changeScale(-1)}>A-</Btn>
              <Btn size="sm" variant="ghost" aria-label="larger text" disabled={scaleIdx === TEXT_SCALE_STEPS.length - 1}
                onClick={() => changeScale(1)}>A+</Btn>
            </div>
          </div>
        </div>
      </div>

      <h1 style={{ ...headingPage, margin: 'var(--space-4) 0' }}>anto-ui theme showcase</h1>

      <div style={container}>
        <nav style={aside}>
          <div style={stack('var(--space-1)')}>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} style={{ ...textSecondary, textDecoration: 'none' }}>
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div style={main}>
          <div style={stack('var(--space-6)')}>

            <div style={grid('16rem')}>
              <section id="buttons" style={panel()}>
                <h2 style={headingSection}>buttons</h2>
                <div style={row()}>
                  <Btn variant="primary">primary</Btn>
                  <Btn variant="default">default</Btn>
                  <Btn variant="ghost">ghost</Btn>
                  <Btn variant="danger">danger</Btn>
                  <Btn loading>loading</Btn>
                </div>
              </section>

              <section id="tags" style={panel()}>
                <h2 style={headingSection}>tags, badges, status</h2>
                <div style={row()}>
                  <Tag variant="gray">gray</Tag>
                  <Tag variant="accent">accent</Tag>
                  <Tag variant="ok" onDismiss={() => {}}>dismissible</Tag>
                  <Badge variant="accent">badge</Badge>
                  <StatusDot status="online" label="online" />
                  <StatusDot status="dnd" label="dnd" />
                </div>
              </section>

              <section id="progress" style={panel()}>
                <h2 style={headingSection}>progress &amp; loading</h2>
                <div style={stack('var(--space-3)')}>
                  <ProgressBar value={62} showValue label="determinate" />
                  <ProgressBar label="indeterminate" />
                  <div style={row()}>
                    <Skeleton width="8rem" />
                    <Skeleton width="2rem" circle />
                    <Spinner />
                  </div>
                </div>
              </section>
            </div>

            <section id="forms" style={panel()}>
              <h2 style={headingSection}>form controls</h2>
              <div style={stack('var(--space-3)')}>
                <Input value={text} onChange={setText} placeholder="type something" />
                <div style={{ ...row(), alignItems: 'flex-end' }}>
                  <div style={flexItem({ basis: '10rem' })}>
                    <Select
                      value="b" onChange={() => {}}
                      options={[{ value: 'a', label: 'option a' }, { value: 'b', label: 'option b' }]}
                    />
                  </div>
                  <NumberInput value={qty} onChange={setQty} min={0} max={10} aria-label="quantity" />
                  <div style={flexItem({ grow: 1, min: '10rem' })}>
                    <Slider value={volume} onChange={setVolume} min={0} max={100} label="volume" />
                  </div>
                </div>
                <div style={row()}>
                  <Checkbox checked={checked} onChange={setChecked} label="checkbox" />
                  <Radio checked={radioPick === 'a'} onChange={() => setRadioPick('a')} label="radio a" name="r" />
                  <Radio checked={radioPick === 'b'} onChange={() => setRadioPick('b')} label="radio b" name="r" />
                  <ToggleSwitch checked={toggled} onChange={setToggled} label="toggle switch" />
                </div>
                <FormField label="labeled field" htmlFor="showcase-field">
                  <Input id="showcase-field" placeholder="wrapped by FormField" />
                </FormField>
              </div>
            </section>

            <section id="overlays" style={panel()}>
              <h2 style={headingSection}>tooltips &amp; overlays</h2>
              <div style={row()}>
                <Tooltip content="a tooltip, shown on hover or focus" position="top">
                  <Btn size="sm" variant="default">hover me</Btn>
                </Tooltip>
                <Tooltip content="works from the keyboard too — tab to it" position="bottom">
                  <Btn size="sm" variant="ghost">and me</Btn>
                </Tooltip>
                <Toggletip
                  position="bottom"
                  content={(
                    <div style={stack('var(--space-2)')}>
                      <p style={{ margin: 0 }}>
                        a toggletip: click-triggered, stays open until dismissed,
                        and can hold interactive content — a tooltip can't.
                      </p>
                      <Btn size="sm" variant="ghost">a real button, inside it</Btn>
                    </div>
                  )}
                >
                  <Btn size="sm" variant="default">click me (toggletip)</Btn>
                </Toggletip>
                <Btn size="sm" onClick={() => setModalOpen(true)}>open modal</Btn>
              </div>
              {alertOpen && (
                <Alert color="var(--warn)" title="heads up" onDismiss={() => setAlertOpen(false)}>
                  an inline notification with a title and a dismiss control.
                </Alert>
              )}
              <Modal
                title="example modal" open={modalOpen} onClose={() => setModalOpen(false)}
                footer={<Btn variant="primary" onClick={() => setModalOpen(false)}>close</Btn>}
              >
                <p style={{ margin: 0 }}>modal content goes here.</p>
              </Modal>
            </section>

            <section id="nav" style={panel()}>
              <h2 style={headingSection}>navigation</h2>
              <div style={stack('var(--space-3)')}>
                <Tabs
                  tabs={[{ id: 'one', label: 'one' }, { id: 'two', label: 'two' }]}
                  active={activeTab} onChange={setActiveTab}
                />
                <Breadcrumb items={[{ label: 'home', href: '#' }, { label: 'section', href: '#' }, { label: 'here' }]} />
                <Tile selected={selectedTile} onClick={() => setSelectedTile(s => !s)}>
                  a selectable tile — click to toggle
                </Tile>
                <Accordion
                  multiple
                  open={openSections}
                  onToggle={id => setOpenSections(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id])}
                  items={[
                    { id: 's1', title: 'first section', content: <p style={{ margin: 0 }}>content for the first section.</p> },
                    { id: 's2', title: 'second section', content: <p style={{ margin: 0 }}>content for the second section.</p> },
                  ]}
                />
              </div>
            </section>

            <section id="carbon" style={panel()}>
              <h2 style={headingSection}>carbon gaps closed</h2>
              <p style={textMuted}>
                eight components closing real gaps from SPEC §10, each grounded in
                Carbon's actual implementation (checked via DeepWiki, not assumed).
              </p>
              <div style={stack('var(--space-4)')}>
                <div style={row()}>
                  <Link href="https://carbondesignsystem.com" onClick={() => {}}>a styled link</Link>
                  <Menu
                    items={[
                      { id: 'rename', label: 'rename' },
                      { id: 'duplicate', label: 'duplicate' },
                      { id: 'delete', label: 'delete', danger: true },
                    ]}
                  >
                    <Btn size="sm" variant="ghost">actions ⋮</Btn>
                  </Menu>
                  <Toggletip content="content switcher picks a mode, not a panel">
                    <Btn size="sm" variant="ghost">what's this?</Btn>
                  </Toggletip>
                </div>

                <div style={row()}>
                  <ContentSwitcher
                    aria-label="view mode"
                    value={switcherPick}
                    onChange={setSwitcherPick}
                    options={[
                      { id: 'list', label: 'list' },
                      { id: 'grid', label: 'grid' },
                      { id: 'tree', label: 'tree' },
                    ]}
                  />
                  <Search value={searchTerm} onChange={setSearchTerm} placeholder="search (debounced)" debounceMs={300} />
                </div>

                <ProgressIndicator
                  currentIndex={1}
                  steps={[
                    { id: 's1', label: 'account' },
                    { id: 's2', label: 'details' },
                    { id: 's3', label: 'review' },
                    { id: 's4', label: 'done' },
                  ]}
                />

                <div style={row('var(--space-4)')}>
                  <InlineLoading status={loadStatus}>
                    {loadStatus === 'loading' ? 'saving…' : loadStatus === 'success' ? 'saved' : 'failed'}
                  </InlineLoading>
                  <Btn size="sm" variant="ghost" onClick={() => setLoadStatus('loading')}>loading</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setLoadStatus('success')}>success</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setLoadStatus('error')}>error</Btn>
                </div>

                <List>
                  <li>a plain unordered list item</li>
                  <li>styled by List, not reinvented per app</li>
                </List>

                <CodeSnippet>{'setPalette(KONA_COLORS); // full palette, decoupled from structure'}</CodeSnippet>
              </div>
            </section>

            <section id="data" style={panel()}>
              <h2 style={headingSection}>data &amp; files</h2>
              <div style={stack('var(--space-4)')}>
                <ComboBox
                  multiple aria-label="tags" placeholder="pick tags…"
                  value={comboValue} onChange={v => setComboValue(v as string[])}
                  options={[
                    { value: 'react', label: 'react' }, { value: 'vue', label: 'vue' },
                    { value: 'svelte', label: 'svelte' }, { value: 'solid', label: 'solid' },
                  ]}
                />
                <DataTable
                  aria-label="demo table" columns={DEMO_COLUMNS} rows={DEMO_ROWS}
                  searchable searchPlaceholder="filter rows…"
                  selected={tableSelected}
                  onToggleRow={id => setTableSelected(s => {
                    const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next;
                  })}
                  onSelectAll={ids => setTableSelected(new Set(ids))}
                  onClearSelection={() => setTableSelected(new Set())}
                  batchActions={<Btn size="sm" variant="ghost" style={{ color: 'var(--on-accent)' }}>export</Btn>}
                />
                <FileUploader
                  files={uploaderFiles}
                  onAdd={list => setUploaderFiles(f => [...f, ...Array.from(list).map((file, i) => ({
                    id: `${Date.now()}-${i}`, name: file.name, status: 'complete' as const,
                  }))])}
                  onRemove={id => setUploaderFiles(f => f.filter(x => x.id !== id))}
                />
                <TreeView
                  aria-label="file tree" nodes={DEMO_TREE}
                  expanded={treeExpanded}
                  onToggleExpand={id => setTreeExpanded(s => {
                    const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next;
                  })}
                  selected={treeSelected} onSelect={setTreeSelected}
                />
              </div>
            </section>

            <section id="layout" style={panel()}>
              <h2 style={headingSection}>layout primitives</h2>
              <p style={textMuted}>
                this page's own two-column shell is sidebarLayout() (SPEC §11.4); the
                buttons/tags/progress cards above sit in a zero-breakpoint grid() (§11.3).
                Below, flexItem() (§11.2) fixing the classic flex shrink bug — resize the
                window and the filename truncates instead of pushing the button out of view:
              </p>
              <div style={{ ...row(), flexWrap: 'nowrap' }}>
                <StatusDot status="online" />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                  ...flexItem({ shrink: 1, min: '0' }),
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  a-very-long-filename-that-would-otherwise-blow-out-the-row.txt
                </span>
                <Btn size="sm">action</Btn>
              </div>
            </section>

          </div>
        </div>
      </div>

      <Divider label="end of showcase" />
    </div>
  );
}
