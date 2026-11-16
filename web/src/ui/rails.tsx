import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import { copyOf, type Lang } from "../app/i18n";
import type { RailL, RailR } from "../app/types";
import type { View } from "../app/view";
import { BasemapPicker } from "./basemap/BasemapPicker";
import { Icon } from "./icons";
import { layerCopy } from "./layers/layer-copy";
import { LayerPanel } from "./layers/LayerPanel";
import { HonestyBadge } from "./layers/LayerRow";

export { HonestyBadge };

type P = { v: View; a: App };

const GLASS = "background:var(--tw-glass-bg,var(--panel));border:1px solid var(--tw-glass-border,var(--line));backdrop-filter:blur(12px)";

const LEFT: Array<{ id: Exclude<RailL, "">; icon: keyof typeof Icon }> = [
  { id: "data", icon: "railData" },
  { id: "utilities", icon: "railUtilities" },
  { id: "annotate", icon: "railAnnotate" },
  { id: "visual", icon: "railVisual" },
];

const RIGHT: Array<{ id: Exclude<RailR, "">; icon: keyof typeof Icon }> = [
  { id: "area", icon: "area" },
  { id: "insight", icon: "reading" },
  { id: "sources", icon: "sources" },
  { id: "legend", icon: "legend" },
  { id: "inspect", icon: "inspect" },
];

// one button opens the shared layer menu; the three categories stay inside that panel
const LAYER_RAIL: Partial<Record<RailL, true>> = { data: true, inference: true, models: true };

function railLabel(v: View, a: App, id: Exclude<RailL, "">): string {
  return LAYER_RAIL[id] ? layerCopy(a.state.lang).panelTitle : v.t.rail[id];
}

function glyph(name: keyof typeof Icon, size = 18): React.ReactElement {
  const Cmp = Icon[name];
  return <Cmp size={size} strokeWidth={2.25} aria-hidden />;
}

export function LeftRail({ v, a }: P): React.ReactElement {
  const { t, lay } = v;
  const fold = !!v.railL || !!v.railR;
  return (
    <div style={s(`position:absolute;left:8px;top:64px;bottom:${lay.tlB};display:flex;align-items:flex-start;gap:8px;pointer-events:none;z-index:22;max-height:${v.dockMaxH}`)}>
      <div role="toolbar" aria-label={t.layers.title} style={s(`pointer-events:auto;display:flex;flex-direction:column;gap:4px;padding:6px;${GLASS}`)}>
        {LEFT.map((item) => {
          const on = v.railL === item.id;
          const label = railLabel(v, a, item.id);
          return (
            <button
              key={item.id}
              type="button"
              className="tw-hov"
              aria-pressed={on}
              title={label}
              aria-label={label}
              onClick={() => a.set({ railL: on ? "" : item.id })}
              style={s(`display:flex;align-items:center;gap:8px;height:36px;padding:0 ${fold ? "8px" : "10px"};border:1px solid ${on ? "var(--tw-radar)" : "transparent"};background:${on ? "var(--sel)" : "transparent"};color:${on ? "var(--tw-radar)" : "var(--fg)"};cursor:pointer`)}
            >
              {glyph(item.icon)}
              {!fold && <span style={s("font:12px var(--sans)")}>{label}</span>}
            </button>
          );
        })}
      </div>
      {v.railL && (
        <div style={s(`pointer-events:auto;width:min(${LAYER_RAIL[v.railL] ? 320 : 280}px,calc(100vw - 88px));max-height:100%;overflow:auto;${GLASS}`)}>
          <RailHead title={LAYER_RAIL[v.railL] ? layerCopy(a.state.lang).panelTitle : t.rail[v.railL]} onClose={() => a.set({ railL: "" })} closeLabel={t.card.close} />
          {v.showBasemap && <BasemapList v={v} />}
          {v.showAnnotate && <p style={s("margin:0;padding:12px;font:13px/1.45 var(--sans);color:var(--fg2)")}>{t.state.annotate}</p>}
          {v.showVisual && (
            <div style={s("padding:12px;display:flex;flex-direction:column;gap:8px")}>
              <p style={s("margin:0;font:13px/1.45 var(--sans);color:var(--fg2)")}>{t.state.visual}</p>
              <button type="button" className="tw-hov" onClick={a.toggleSound} style={s("height:36px;padding:0 12px;border:1px solid var(--line2);background:transparent;cursor:pointer;font:12px var(--sans)")}>
                {v.soundOn ? t.moni.soundOn : t.moni.soundOff}
              </button>
            </div>
          )}
          {LAYER_RAIL[v.railL] && <LayerPanel v={v} a={a} />}
        </div>
      )}
    </div>
  );
}

export function RightRail({ v, a }: P): React.ReactElement {
  const { t } = v;
  const fold = !!v.railL || !!v.railR;
  return (
    <div role="toolbar" aria-label={t.card.tabArea} style={s(`position:absolute;right:8px;top:64px;display:flex;flex-direction:column;gap:4px;padding:6px;pointer-events:auto;z-index:22;${GLASS}`)}>
      {RIGHT.map((item) => {
        const on = v.railR === item.id;
        const label = t.rail[item.id];
        return (
          <button
            key={item.id}
            type="button"
            className="tw-hov"
            aria-pressed={on}
            title={label}
            aria-label={label}
            onClick={() => a.set({ railR: on ? "" : item.id })}
            style={s(`display:flex;align-items:center;gap:8px;height:36px;padding:0 ${fold ? "8px" : "10px"};border:1px solid ${on ? "var(--tw-radar)" : "transparent"};background:${on ? "var(--sel)" : "transparent"};color:${on ? "var(--tw-radar)" : "var(--fg)"};cursor:pointer`)}
          >
            {glyph(item.icon)}
            {!fold && <span style={s("font:12px var(--sans)")}>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function MobileBar({ v, a }: P): React.ReactElement {
  const { t } = v;
  const items: Array<{ id: string; label: string; icon: keyof typeof Icon; go: () => void; on: boolean }> = [
    { id: "data", label: layerCopy(a.state.lang).panelTitle, icon: "railData", on: v.railL === "data", go: () => a.set({ railL: v.railL === "data" ? "" : "data", railR: "" }) },
    { id: "area", label: t.rail.area, icon: "area", on: v.railR === "area", go: () => a.set({ railR: v.railR === "area" ? "" : "area", railL: "" }) },
    { id: "insight", label: t.rail.insight, icon: "reading", on: v.railR === "insight", go: () => a.set({ railR: v.railR === "insight" ? "" : "insight", railL: "" }) },
    { id: "legend", label: t.rail.legend, icon: "legend", on: v.railR === "legend", go: () => a.set({ railR: v.railR === "legend" ? "" : "legend", railL: "" }) },
    { id: "more", label: t.rail.utilities, icon: "railUtilities", on: v.railL === "utilities", go: () => a.set({ railL: v.railL === "utilities" ? "" : "utilities", railR: "" }) },
  ];
  return (
    <div role="tablist" aria-label={t.layers.title} style={s(`position:absolute;left:0;right:0;bottom:0;height:52px;display:flex;pointer-events:auto;z-index:24;${GLASS}`)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.on}
          onClick={item.go}
          style={s(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:${item.on ? "var(--sel)" : "transparent"};color:${item.on ? "var(--tw-radar)" : "var(--fg2)"};cursor:pointer`)}
        >
          {glyph(item.icon, 16)}
          <span style={s("font:9px var(--sans)")}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function MobileSheet({ v, a }: P): React.ReactElement | null {
  if (!v.railL) return null;
  const { t } = v;
  return (
    <div style={s(`position:absolute;left:0;right:0;bottom:52px;max-height:56%;overflow:auto;pointer-events:auto;z-index:23;${GLASS}`)}>
      <RailHead title={LAYER_RAIL[v.railL] ? layerCopy(a.state.lang).panelTitle : t.rail[v.railL]} onClose={() => a.set({ railL: "" })} closeLabel={t.card.close} />
      {v.showBasemap && <BasemapList v={v} />}
      {v.showAnnotate && <p style={s("margin:0;padding:12px;color:var(--fg2)")}>{t.state.annotate}</p>}
      {v.showVisual && <p style={s("margin:0;padding:12px;color:var(--fg2)")}>{t.state.visual}</p>}
      {LAYER_RAIL[v.railL] && <LayerPanel v={v} a={a} />}
    </div>
  );
}

function RailHead({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }): React.ReactElement {
  return (
    <div style={s("display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line)")}>
      <span style={s("flex:1;font:12px var(--sans);color:var(--fg)")}>{title}</span>
      <button type="button" className="tw-hov" aria-label={closeLabel} title={closeLabel} onClick={onClose} style={s("width:40px;height:40px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
        <Icon.close size={16} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

function BasemapList({ v }: { v: View }): React.ReactElement | null {
  const lang: Lang = v.t === copyOf("es") ? "es" : "en";
  return <BasemapPicker items={v.basemapItems} lang={lang} title={v.t.layers.basemap} />;
}

export function InspectBody({ v }: { v: View }): React.ReactElement {
  const { t } = v;
  return (
    <div style={s("display:flex;flex-direction:column;gap:8px")}>
      <div style={s("font:12px var(--mono);color:var(--fg)")}>{v.inspectCenter}</div>
      <p style={s("margin:0;font:12px/1.4 var(--sans);color:var(--fg2)")}>{t.state.inspectLead}</p>
      {v.inspectRows.map((row) => (
        <div key={row.id} style={s("display:flex;gap:8px;align-items:baseline;border-top:1px solid var(--line);padding-top:6px")}>
          <span style={s("flex:1;font:13px var(--sans)")}>{row.label}</span>
          <span style={s("font:12px var(--mono);color:var(--fg2)")}>{row.value}</span>
          <HonestyBadge label={row.honestyLabel} kind={row.honesty} />
        </div>
      ))}
    </div>
  );
}
