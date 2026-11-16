import React from "react";
import type { LayerCopy } from "./layer-copy";
import type { LayerRowModel } from "./layer-model";
import { LayerDetail } from "./LayerDetail";

type P = { row: LayerRowModel; c: LayerCopy; open: boolean; onOpen: () => void };

export function HonestyBadge({ label, kind }: { label: string; kind: string }): React.ReactElement {
  return <span className={`twl-badge twl-badge--${kind}`}>{label}</span>;
}

export function ConfidenceMeter({ value, label }: { value: number; label: string }): React.ReactElement {
  const pct = Math.round(value * 100);
  return (
    <div className="twl-conf" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="twl-conf-label">{label}</span>
      <span className="twl-conf-track" aria-hidden="true">
        <span className="twl-conf-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="twl-conf-num">{pct} %</span>
    </div>
  );
}

export function LayerRow({ row, c, open, onOpen }: P): React.ReactElement {
  const detailId = `twl-detail-${row.key}`;
  const state = row.tone === "busy" ? "busy" : row.tone === "warn" ? "warn" : row.on ? "on" : "off";
  return (
    <li className={`twl-row${row.on ? " is-on" : ""}${open ? " is-open" : ""}`} data-layer-id={row.id}>
      <div className="twl-top">
        <button type="button" className="twl-name" aria-expanded={open} aria-controls={detailId} title={c.details(row.label)} onClick={onOpen}>
          <span className="twl-swatch" aria-hidden="true" style={{ background: row.swatch }} />
          <span className="twl-label">{row.label}</span>
          <span className="twl-caret" aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <div className="twl-right">
          {row.count ? <span className="twl-count">{row.count}</span> : null}
          {row.read || row.reading ? (
            <button
              type="button"
              className={`twl-chip twl-chip--read${row.reading ? " is-on" : ""}`}
              aria-pressed={row.reading}
              aria-disabled={row.reading}
              title={row.reading ? c.readingTitle : c.readTitle(row.label)}
              aria-label={row.reading ? c.readingTitle : c.readTitle(row.label)}
              onClick={row.read ?? undefined}
            >
              {row.reading ? c.reading : c.read}
            </button>
          ) : null}
          {row.statusOnly ? (
            <span className="twl-chip twl-chip--status" data-state={state}>{row.toggleText}</span>
          ) : (
            <button
              type="button"
              className="twl-chip twl-chip--toggle"
              data-state={state}
              aria-pressed={row.on}
              aria-disabled={!row.toggle || !!row.locked}
              aria-busy={row.tone === "busy"}
              title={row.toggleTitle}
              aria-label={`${row.label}: ${row.toggleTitle}`}
              onClick={row.toggle ?? undefined}
            >
              {row.toggleText}
            </button>
          )}
        </div>
      </div>
      <div className="twl-meta">
        <HonestyBadge label={row.honestyLabel} kind={row.honesty} />
        {row.status ? (
          <span className={`twl-status twl-status--${row.tone || "ok"}`} role={row.tone === "warn" ? "alert" : "status"}>{row.status}</span>
        ) : null}
      </div>
      {row.locked && !row.statusOnly && !row.reading ? <div className="twl-reason">{row.locked}</div> : null}
      {row.confidence != null ? <ConfidenceMeter value={row.confidence} label={c.confidence} /> : null}
      {open ? <LayerDetail id={detailId} row={row} c={c} /> : null}
    </li>
  );
}
