import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import type { View } from "../app/view";
import { timelineCopy, type TimelineCopy } from "./timeline/copy";
import "./timeline/timeline.css";

type P = { v: View; a: App; tlRef: React.RefObject<HTMLDivElement> };
type Tick = View["tl"]["segs"][number]["ticks"][number];

// Past this many frames a tick is one pixel wide, so a dense run still reads as ticks.
const THIN_AT = 90;

const at = (i: number, n: number): number => (n < 2 ? 0.5 : i / (n - 1));

function honestyText(c: TimelineCopy, tk: Tick, layer: string): string {
  if (tk.gap) return c.noData(layer);
  if (tk.example) return c.example;
  const h = { measured: c.measured, derived: c.derived, model: c.model, inferred: c.inferred }[tk.honesty];
  return [h, tk.before ? c.beforeNisar : ""].filter(Boolean).join(" · ");
}

// One bar, as in a world-time scrubber: play and step, the date, a track with
// a tick per frame that snaps to the nearest one on click or drag, and a way
// back to the latest date.
export function Timeline({ v, a, tlRef }: P): React.ReactElement {
  const { t, tl } = v;
  const c = timelineCopy(a.state.lang);
  const rail = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);
  const [drag, setDrag] = React.useState(false);
  const last = React.useRef(-1);

  const ticks: Tick[] = tl.segs.flatMap((sg) => sg.ticks);
  const n = ticks.length;
  const cur = Math.max(0, Math.min(n - 1, tl.idx));
  const curTk = ticks[cur];
  const bIdx = v.compareOn ? ticks.findIndex((tk) => tk.hot && !tk.cur) : -1;
  const latest = n > 0 && cur === n - 1;

  // Where one segment ends and the next starts: a divider halfway between.
  const divs: number[] = [];
  let acc = 0;
  tl.segs.slice(0, -1).forEach((sg) => {
    acc += sg.ticks.length;
    if (acc > 0 && acc < n) divs.push((at(acc - 1, n) + at(acc, n)) / 2);
  });
  const pre = ticks.map((tk, i) => (tk.before ? i : -1)).filter((i) => i >= 0);

  const idxAt = (x: number): number => {
    const el = rail.current;
    if (!el || n < 1) return -1;
    const r = el.getBoundingClientRect();
    const f = r.width > 0 ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0;
    return Math.round(f * (n - 1));
  };
  const go = (i: number): void => {
    const tk = ticks[i];
    if (!tk || i === last.current) return;
    last.current = i;
    tk.go();
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button > 0) return;
    e.currentTarget.focus({ preventScroll: true });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the page no longer knows drags only within the track.
    }
    last.current = cur;
    setDrag(true);
    go(idxAt(e.clientX));
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const i = idxAt(e.clientX);
    setHover(i < 0 ? null : i);
    if (drag) go(i);
  };
  const onUp = (): void => setDrag(false);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const k = e.key;
    let fn: (() => void) | null = null;
    if (k === "ArrowLeft" || k === "ArrowDown") fn = () => a.step(-1);
    else if (k === "ArrowRight" || k === "ArrowUp") fn = () => a.step(1);
    else if (k === "Home") fn = () => ticks[0]?.go();
    else if (k === "End") fn = () => ticks[n - 1]?.go();
    else if (k === " ") fn = a.togglePlay;
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const tip = hover != null ? ticks[hover] : drag ? curTk : undefined;
  const tipAt = hover != null ? at(hover, n) : at(cur, n);
  const tipRest = tip ? tip.title.split(" · ").slice(1).join(" · ") : "";
  const curHon = curTk ? honestyText(c, curTk, v.layerName) : "";

  return (
    <div
      ref={tlRef}
      className="tw-tlb"
      role="region"
      aria-label={t.timeline.region}
      style={s(`bottom:${v.lay.tlB};--tlb-pad:${v.lay.pad}`)}
    >
      {v.tlLoading && <div className="tw-tlb-load">{t.timeline.loading}</div>}
      {v.tlReady && (
        <>
          <div className="tw-tlb-ctl">
            <button
              type="button"
              className={v.playing ? "tw-hov is-on" : "tw-hov"}
              onClick={a.togglePlay}
              disabled={tl.noPlay}
              aria-label={tl.playLabel}
              title={`${tl.playLabel} (${t.timeline.space})`}
            >
              {v.playing ? (
                <>
                  <span style={s("width:3px;height:12px;background:currentColor")} />
                  <span style={s("width:3px;height:12px;background:currentColor")} />
                </>
              ) : (
                <span style={s("width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:10px solid currentColor;margin-left:2px")} />
              )}
            </button>
            <button type="button" className="tw-hov" onClick={() => a.step(-1)} disabled={cur <= 0} aria-label={t.timeline.prev} title={t.timeline.prev} style={s("font:600 16px var(--mono)")}>
              ‹
            </button>
            <button type="button" className="tw-hov" onClick={() => a.step(1)} disabled={latest} aria-label={t.timeline.next} title={t.timeline.next} style={s("font:600 16px var(--mono)")}>
              ›
            </button>
          </div>
          <div className="tw-tlb-read" aria-live="polite" title={tl.meta}>
            <span className="tw-tlb-date">{v.compareOn ? `${tl.tB ? t.timeline.b : t.timeline.a} · ${tl.name}` : tl.name}</span>
            {curHon && (
              <span className="tw-tlb-hon" style={s(curTk?.example ? "color:var(--tw-h-ejemplo)" : curTk?.before ? "color:var(--tw-radar)" : "")}>
                {curHon}
              </span>
            )}
          </div>
          <div
            className={drag ? "tw-tlb-track is-drag" : "tw-tlb-track"}
            role="slider"
            tabIndex={0}
            aria-label={t.timeline.region}
            aria-valuemin={0}
            aria-valuemax={tl.max}
            aria-valuenow={cur}
            aria-valuetext={curHon ? `${tl.name}, ${curHon}` : tl.name}
            aria-keyshortcuts="ArrowLeft ArrowRight Home End Space"
            title={tip ? undefined : c.trackHint}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
          >
            <div ref={rail} className="tw-tlb-rail">
              {pre.length > 0 && (
                <span
                  className="tw-tlb-pre"
                  style={s(`left:calc(${at(pre[0], n) * 100}% - 4px);width:calc(${(at(pre[pre.length - 1], n) - at(pre[0], n)) * 100}% + 8px)`)}
                />
              )}
              <span className="tw-tlb-fill" style={s(`width:${at(cur, n) * 100}%`)} />
              {divs.map((d) => (
                <span key={d} className="tw-tlb-div" style={s(`left:${d * 100}%`)} />
              ))}
              {ticks.map((tk, i) => (
                <span
                  key={tk.key}
                  className={[
                    "tw-tlb-tick",
                    n > THIN_AT ? "is-thin" : "",
                    tk.example ? "is-example" : tk.before ? "is-before" : "",
                    tk.gap ? "is-gap" : "",
                    i === hover ? "is-hover" : "",
                  ].join(" ")}
                  style={s(`left:${at(i, n) * 100}%`)}
                />
              ))}
              {bIdx >= 0 && <span className="tw-tlb-knob is-b" style={s(`left:${at(bIdx, n) * 100}%`)} />}
              {n > 0 && <span className="tw-tlb-knob" style={s(`left:${at(cur, n) * 100}%`)} />}
            </div>
            {tip && (
              <span className="tw-tlb-tip" aria-hidden="true" style={s(`--at:${tipAt}`)}>
                <b>{tip.name}</b>
                {honestyText(c, tip, v.layerName) && (
                  <span style={s(tip.example ? "color:var(--tw-h-ejemplo)" : tip.before ? "color:var(--tw-radar)" : "")}>{honestyText(c, tip, v.layerName)}</span>
                )}
                {tipRest && <span>{tipRest}</span>}
              </span>
            )}
          </div>
          {v.showKey && (v.beforeNisar || tl.hasExample) && (
            <div className="tw-tlb-legend" aria-hidden="true">
              {tl.hasExample && (
                <span>
                  <span style={s("width:0;height:12px;border-left:2px dashed var(--tw-h-ejemplo)")} />
                  {c.legendExample}
                </span>
              )}
              {v.beforeNisar && (
                <span>
                  <span style={s("width:10px;height:8px;border-top:1px solid var(--tw-radar);background:rgba(94,235,255,.12)")} />
                  {c.legendBefore}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            className={latest ? "tw-hov is-on" : "tw-hov"}
            onClick={() => ticks[n - 1]?.go()}
            disabled={latest}
            aria-label={latest ? c.atLatest : c.latestTitle}
            title={latest ? c.atLatest : c.latestTitle}
          >
            {c.latest}
          </button>
          {v.compareOn && (
            <div role="radiogroup" aria-label={t.timeline.target} style={s("display:flex;flex:none")}>
              <button
                type="button"
                role="radio"
                aria-checked={tl.tA}
                className="tw-hov"
                onClick={() => a.set({ cmpTarget: "A" })}
                title={tl.nameA}
                style={s(`border-color:${tl.tALine};background:${tl.tA ? "var(--sel)" : "transparent"};color:var(--acc-fg);font:600 12px var(--mono)`)}
              >
                {t.timeline.a}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={tl.tB}
                className="tw-hov"
                onClick={() => a.set({ cmpTarget: "B" })}
                title={tl.nameB}
                style={s(`border-color:${tl.tBLine};border-left:0;background:${tl.tB ? "var(--sel)" : "transparent"};color:var(--accB);font:600 12px var(--mono)`)}
              >
                {t.timeline.b}
              </button>
            </div>
          )}
          <button
            type="button"
            className="tw-hov"
            onClick={a.toggleCompare}
            aria-pressed={v.compareOn}
            title={v.compareHint}
            style={s(v.compareOn ? "" : "border-style:dashed")}
          >
            <span aria-hidden="true" style={s("display:flex;align-items:center;gap:2px")}>
              <span style={s("width:6px;height:10px;background:var(--accB)")} />
              <span style={s("width:1px;height:12px;background:var(--fg3)")} />
              <span style={s("width:6px;height:10px;background:var(--acc)")} />
            </span>
            {!v.isM && v.cmpText}
          </button>
        </>
      )}
    </div>
  );
}
