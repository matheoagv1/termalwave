import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import type { RailL, RailR } from "../app/types";
import type { View } from "../app/view";
import { Icon } from "./icons";

type P = { v: View; a: App };

const GLASS = "background:var(--tw-glass-bg,var(--panel));border:1px solid var(--tw-glass-border,var(--line));backdrop-filter:blur(12px)";

const LEFT: Array<{ id: Exclude<RailL, "">; icon: keyof typeof Icon }> = [
  { id: "data", icon: "railData" },
  { id: "models", icon: "railModels" },
  { id: "inference", icon: "railInference" },
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
          const label = t.rail[item.id];
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
        <div style={s(`pointer-events:auto;width:min(280px,calc(100vw - 88px));max-height:100%;overflow:auto;${GLASS}`)}>
          <RailHead title={t.rail[v.railL]} onClose={() => a.set({ railL: "" })} closeLabel={t.card.close} />
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
          {(v.railL === "data" || v.railL === "models" || v.railL === "inference") && <LayerList v={v} a={a} />}
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
    { id: "data", label: t.rail.data, icon: "railData", on: v.railL === "data", go: () => a.set({ railL: v.railL === "data" ? "" : "data", railR: "" }) },
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
    <div style={s(`position:absolute;left:0;right:0;bottom:52px;max-height:46%;overflow:auto;pointer-events:auto;z-index:23;${GLASS}`)}>
      <RailHead title={t.rail[v.railL]} onClose={() => a.set({ railL: "" })} closeLabel={t.card.close} />
      {v.showBasemap && <BasemapList v={v} />}
      {v.showAnnotate && <p style={s("margin:0;padding:12px;color:var(--fg2)")}>{t.state.annotate}</p>}
      {v.showVisual && <p style={s("margin:0;padding:12px;color:var(--fg2)")}>{t.state.visual}</p>}
      {(v.railL === "data" || v.railL === "models" || v.railL === "inference") && <LayerList v={v} a={a} />}
    </div>
  );
}

function RailHead({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }): React.ReactElement {
  return (
    <div style={s("display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line)")}>
      <span style={s("flex:1;font:12px var(--sans);color:var(--fg)")}>{title}</span>
      <button type="button" className="tw-hov" aria-label={closeLabel} onClick={onClose} style={s("width:28px;height:28px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
        <Icon.close size={16} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

function BasemapList({ v }: { v: View }): React.ReactElement {
  const { t, lay } = v;
  return (
    <div role="radiogroup" aria-label={t.layers.basemap} style={s("display:flex;flex-direction:column;gap:4px;padding:10px")}>
      <div style={s("display:flex;align-items:center;gap:6px;color:var(--fg2);font:11px var(--sans)")}>
        <Icon.map size={14} strokeWidth={2.25} aria-hidden />
        {t.layers.basemap}
      </div>
      {v.basemapItems.map((bm) => (
        <button
          key={bm.id}
          type="button"
          role="radio"
          aria-checked={bm.on}
          className="tw-hov"
          onClick={bm.go}
          style={s(`height:${lay.hit};padding:0 10px;text-align:left;border:1px solid ${bm.on ? "var(--acc)" : "var(--line2)"};background:${bm.on ? "var(--sel)" : "transparent"};cursor:pointer;font:12px var(--sans);color:var(--fg)`)}
        >
          {bm.label}
        </button>
      ))}
    </div>
  );
}

function LayerList({ v, a }: P): React.ReactElement {
  const { t, lay } = v;
  return (
    <div>
      {v.railRows.map((row) => {
        if (row.kind === "global") {
          return (
            <button
              key={row.key}
              type="button"
              className="tw-hov"
              role="switch"
              aria-checked={row.on}
              title={row.note}
              onClick={row.go}
              style={s(`display:flex;gap:10px;align-items:flex-start;width:100%;min-height:${lay.hit};padding:8px 12px;border:0;border-top:1px solid var(--line);background:${row.on ? "var(--sel)" : "transparent"};text-align:left;cursor:pointer`)}
            >
              <span aria-hidden="true" style={s(`flex:none;margin-top:3px;width:14px;height:14px;border:1px solid ${row.on ? "var(--tw-radar)" : "var(--line2)"};background:${row.on ? "var(--tw-radar)" : "transparent"}`)} />
              <span style={s("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                <span style={s("font:13px/1.25 var(--sans)")}>{row.label}</span>
                {row.on && row.info ? (
                  <span role={row.warn ? "alert" : "status"} style={s(`font:11px/1.35 var(--sans);color:${row.warn ? "var(--tw-h-ejemplo)" : "var(--fg2)"};white-space:normal`)}>{row.info}</span>
                ) : null}
              </span>
            </button>
          );
        }
        if (row.kind !== "layer") return null;
        const l = row.item;
        return (
          <button
            key={l.id}
            type="button"
            className="tw-hov"
            role="radio"
            aria-checked={l.on}
            title={l.note || l.label}
            onClick={l.go}
            style={s(`display:flex;gap:10px;align-items:flex-start;width:100%;min-height:${lay.hit};padding:8px 12px;border:0;border-top:1px solid var(--line);background:${l.bg};text-align:left;cursor:pointer`)}
          >
            <span style={s(`flex:none;margin-top:3px;width:14px;height:14px;background:${l.grad};border:1px solid var(--line2)`)} />
            <span style={s("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
              <span style={s("font:13px/1.25 var(--sans);display:flex;align-items:center;gap:6px")}>
                <span style={s("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.label}</span>
                <HonestyBadge label={l.honestyLabel} kind={l.honesty} />
              </span>
              {l.stateText ? <span style={s("font:11px var(--sans);color:var(--fg2)")}>{l.stateText}</span> : null}
              {l.info ? <span style={s(`font:11px/1.35 var(--sans);color:${l.warn ? "var(--tw-h-ejemplo)" : "var(--fg2)"};white-space:normal`)}>{l.info}</span> : null}
            </span>
            {l.core ? <span title={t.layers.coreTitle} style={s("flex:none;font:9px var(--mono);color:var(--fg3)")}>{t.layers.core}</span> : null}
          </button>
        );
      })}
      {v.railL === "data" && v.overlayItems.length > 0 && (
        <div style={s("border-top:1px solid var(--line);padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px")}>
          {v.overlayItems.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={o.core}
              aria-pressed={o.on}
              title={o.core ? t.layers.coreTitle : o.on ? t.layers.overlayOn : t.layers.overlayOff}
              onClick={o.go}
              style={s(`min-height:30px;padding:0 10px;border:1px solid ${o.on ? "var(--tw-radar)" : "var(--line2)"};background:${o.on ? "var(--sel)" : "transparent"};font:12px var(--sans);cursor:${o.core ? "default" : "pointer"}`)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {a.state.ready && v.railRows.length === 0 && v.railL === "inference" ? (
        <p style={s("margin:0;padding:12px;color:var(--fg2);font:13px var(--sans)")}>{t.state.nodata}</p>
      ) : null}
    </div>
  );
}

export function HonestyBadge({ label, kind }: { label: string; kind: string }): React.ReactElement {
  const color = kind === "example" ? "var(--tw-h-ejemplo)"
    : kind === "inferred" ? "var(--tw-h-inferido)"
    : kind === "model" ? "var(--tw-h-modelo)"
    : kind === "derived" ? "var(--tw-h-derivado)"
    : "var(--tw-h-medido)";
  return <span style={s(`flex:none;font:9px var(--mono);letter-spacing:.04em;color:${color};border:1px solid ${color};padding:0 4px`)}>{label}</span>;
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
