import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import type { View } from "../app/view";

type P = { v: View; a: App; tlRef: React.RefObject<HTMLDivElement> };

const BTN = "border:1px solid var(--line2);background:transparent;cursor:pointer";

export function Timeline({ v, a, tlRef }: P): React.ReactElement {
  const { t, lay, tl } = v;
  const sq = `width:${lay.hit};height:${lay.hit}`;
  const compact = v.tlReady && !v.tlOpen;
  return (
    <div
      ref={tlRef}
      className={compact ? "tw-tl tw-tl--compact" : "tw-tl"}
      role="region"
      aria-label={t.timeline.region}
      style={s(
        `position:absolute;left:${lay.tlL};right:${lay.tlR};bottom:${lay.tlB};pointer-events:auto;background:var(--panel);border:1px solid var(--line);backdrop-filter:blur(8px);padding:${compact ? "6px 10px 8px" : "8px 12px 10px"};display:flex;flex-direction:column;gap:${compact ? "6px" : "8px"}`,
      )}
    >
      {v.tlLoading && (
        <>
          <div style={s("font:11px var(--mono);color:var(--fg2)")}>{t.timeline.loading}</div>
          <div style={s("display:flex;gap:6px;height:56px")}>
            {[5, 4, 12, 8].map((f) => (
              <div key={f} className="tw-pulse" style={s(`flex:${f};background:var(--line)`)} />
            ))}
          </div>
        </>
      )}
      {v.tlReady && (
        <>
          <div style={s("display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center")}>
            <div style={s("display:flex;gap:4px;flex:none")}>
              <button
                className="tw-hov"
                onClick={a.togglePlay}
                disabled={tl.noPlay}
                aria-label={tl.playLabel}
                title={`${tl.playLabel} (Espacio)`}
                style={s(`${sq};border:1px solid var(--line2);background:${tl.playBg};color:${tl.playFg};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px`)}
              >
                {v.playing ? (
                  <>
                    <span style={s("width:3px;height:12px;background:currentColor")} />
                    <span style={s("width:3px;height:12px;background:currentColor")} />
                  </>
                ) : (
                  <span style={s("width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:11px solid currentColor;margin-left:3px")} />
                )}
              </button>
              <button className="tw-hov" onClick={() => a.step(-1)} aria-label={t.timeline.prev} title={t.timeline.prev} style={s(`${sq};${BTN};font:600 16px var(--mono)`)}>
                ‹
              </button>
              <button className="tw-hov" onClick={() => a.step(1)} aria-label={t.timeline.next} title={t.timeline.next} style={s(`${sq};${BTN};font:600 16px var(--mono)`)}>
                ›
              </button>
            </div>
            <div
              aria-live="polite"
              className="tw-tl-sel"
              style={s("flex:1 1 160px;min-width:0;padding:4px 8px 4px 10px;border-left:3px solid var(--acc);background:var(--sel)")}
            >
              <div style={s("font:11px var(--sans);color:var(--fg2)")}>{v.compareOn ? "Fecha activa para comparar" : "Fecha seleccionada"}</div><div style={s("font:600 15px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{tl.name}</div>
              <div style={s("font:11px var(--mono);color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{tl.meta}</div>
            </div>
            {v.compareOn && (
              <div role="radiogroup" aria-label={t.timeline.target} style={s("display:flex;gap:4px;flex:none")}>
                <button
                  className="tw-hov"
                  role="radio"
                  aria-checked={tl.tA}
                  onClick={() => a.set({ cmpTarget: "A" })}
                  style={s(`height:${lay.hit};padding:0 10px;border:1px solid ${tl.tALine};background:${tl.tA ? "var(--sel)" : "transparent"};cursor:pointer;font:11px var(--mono);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}
                >
                  <span style={s("color:var(--acc-fg);font-weight:600")}>{t.timeline.a}</span> {tl.nameA}
                </button>
                <button
                  className="tw-hov"
                  role="radio"
                  aria-checked={tl.tB}
                  onClick={() => a.set({ cmpTarget: "B" })}
                  style={s(`height:${lay.hit};padding:0 10px;border:1px solid ${tl.tBLine};background:${tl.tB ? "var(--sel)" : "transparent"};cursor:pointer;font:11px var(--mono);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}
                >
                  <span style={s("color:var(--accB);font-weight:600")}>{t.timeline.b}</span> {tl.nameB}
                </button>
              </div>
            )}
            <div style={s("display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:0 1 auto;min-width:0")}>
              {v.showKey && v.tlOpen && (
                <span aria-hidden="true" style={s("display:flex;gap:10px;font:10px var(--mono);color:var(--fg2);margin-right:4px")}>
                  <span style={s("display:flex;gap:4px;align-items:center")}>
                    <span style={s("width:10px;height:8px;background:var(--fg3)")} />
                    {t.timeline.kindComposite}
                  </span>
                  <span style={s("display:flex;gap:4px;align-items:center")}>
                    <span style={s("width:2px;height:10px;background:var(--fg2);margin:0 4px")} />
                    {t.timeline.kindAcquisition}
                  </span>
                  <span style={s("display:flex;gap:4px;align-items:center")}>
                    <span style={s("width:10px;height:8px;background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 4px);box-shadow:inset 0 0 0 1px var(--line2)")} />
                    {t.timeline.gapLegend}
                  </span>
                </span>
              )}
              {v.isD && v.tlOpen && (
                <div role="radiogroup" style={s("display:flex")}>
                  <button
                    role="radio"
                    aria-checked={v.scopeAll}
                    onClick={() => a.set({ scope: "all" })}
                    className="tw-hov"
                    style={s(`height:${lay.hit};padding:0 10px;border:1px solid var(--line2);background:${v.scopeAllBg};cursor:pointer;font:11px var(--mono)`)}
                  >
                    {t.timeline.scopeAll}
                  </button>
                  <button
                    role="radio"
                    aria-checked={v.scopeSeg}
                    onClick={() => a.set({ scope: "seg" })}
                    className="tw-hov"
                    style={s(`height:${lay.hit};padding:0 10px;border:1px solid var(--line2);border-left:0;background:${v.scopeSegBg};cursor:pointer;font:11px var(--mono)`)}
                  >
                    {t.timeline.scopeSeg}
                  </button>
                </div>
              )}
              {v.zoomed && v.tlOpen && (
                <button className="tw-hov" onClick={() => a.set({ zoomSeg: null })} style={s(`height:${lay.hit};padding:0 10px;${BTN};font:11px var(--mono)`)}>
                  {t.timeline.full}
                </button>
              )}
              <button
                className="tw-hov"
                onClick={() => a.set({ tlOpen: !a.state.tlOpen })}
                aria-expanded={v.tlOpen}
                aria-controls="tw-tl-track"
                aria-label={v.tlToggleLabel}
                title={v.tlToggleLabel}
                style={s(`width:${lay.hit};height:${lay.hit};border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0`)}
              >
                <img src={v.tlOpen ? "./ui/minus.png" : "./ui/plus.png"} alt="" aria-hidden="true" width={28} height={28} style={s("image-rendering:pixelated")} />
              </button>
              <button
                className={v.compareOn ? "tw-hov tw-tl-cmp-on" : "tw-hov tw-tl-cmp-idle"}
                onClick={a.toggleCompare}
                aria-pressed={v.compareOn}
                title={v.compareHint}
                style={s(`height:${lay.hit};padding:0 12px;border:1px solid ${v.cmpLine};background:${v.cmpBg};cursor:pointer;font:12px var(--sans);display:flex;align-items:center;gap:6px`)}
              >
                <span aria-hidden="true" style={s("display:flex;align-items:center;gap:2px;font:10px var(--mono);opacity:0.85")}>
                  <span style={s("width:8px;height:12px;background:var(--accB);opacity:0.9")} />
                  <span style={s("width:1px;height:14px;background:var(--fg3)")} />
                  <span style={s("width:8px;height:12px;background:var(--acc);opacity:0.9")} />
                </span>
                {v.cmpText}
              </button>
            </div>
          </div>
          {compact && (
            <>
              <div style={s("display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font:10px var(--mono);color:var(--fg2)")}>
                <span style={s("color:var(--fg3)")}>{t.timeline.layersHere}</span>
                {v.selPips.map((p) => (
                  <span
                    key={p.key}
                    title={p.label + (p.on ? "" : " · sin dato")}
                    style={s(
                      `display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border:1px solid ${p.active ? "var(--acc-fg)" : "var(--line2)"};background:${p.active ? "var(--sel)" : "transparent"}`,
                    )}
                  >
                    <span
                      style={s(
                        `width:10px;height:6px;background:${p.on ? (p.partial ? `linear-gradient(90deg,${p.swatch} 50%,transparent 50%)` : p.swatch) : "repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 4px)"};box-shadow:${p.on ? "none" : "inset 0 0 0 1px var(--line2)"}`,
                      )}
                    />
                    <span style={s(`color:${p.on ? "var(--fg)" : "var(--fg3)"}`)}>{p.label}</span>
                  </span>
                ))}
              </div>
              <div style={s("display:flex;align-items:center;gap:8px;font:10px var(--mono);color:var(--fg3)")}>
                <span style={s("white-space:nowrap")}>{t.timeline.realTime}</span>
                <span>{tl.y0}</span>
                <div style={s("position:relative;flex:1;height:28px;box-sizing:border-box;border-style:solid;border-width:0 32px;border-image:url(./ui/rail.png) 0 150 0 150 fill / 0 32px 0 32px stretch")}>
                  <div style={s("position:absolute;left:0;right:0;bottom:-6px;height:4px;display:flex;gap:2px")}>
                    {tl.real.map((r) => (
                      <div key={r.id} style={s(`flex:${r.flex} 1 0;background:${r.tone}`)} />
                    ))}
                  </div>
                  <img className="tw-tl-needle" src="./ui/diamond.png" alt="" aria-hidden="true" style={s(`position:absolute;top:4px;left:${tl.aLeft};width:20px;height:20px;margin-left:-10px;image-rendering:pixelated`)} />
                  {v.compareOn && (
                    <img className="tw-tl-needle" src="./ui/diamond.png" alt="" aria-hidden="true" style={s(`position:absolute;top:4px;left:${tl.bLeft};width:20px;height:20px;margin-left:-10px;image-rendering:pixelated;filter:hue-rotate(160deg)`)} />
                  )}
                </div>
                <span>{tl.y1}</span>
              </div>
              {v.compareOn && (
                <div style={s("font:11px var(--sans);color:var(--fg2);line-height:1.35")}>{v.compareHint}</div>
              )}
            </>
          )}
          {v.compareOn && v.tlOpen && <p style={s("margin:0;font:12px var(--sans);color:var(--fg2);line-height:1.35")}>Elegí A o B y después una fecha para comparar las dos imágenes.</p>}
          {tl.single && v.tlOpen && <div style={s("font:11px var(--mono);color:var(--fg2)")}>{t.timeline.singlePoint}</div>}
          {v.compareOn && v.tlOpen && (
            <div style={s("font:11px var(--sans);color:var(--fg2);padding:2px 0;line-height:1.35")}>{v.compareHint}</div>
          )}
          {v.tlOpen && (
            <>
              <div
                id="tw-tl-track"
                data-tw-track="1"
                role="slider"
                tabIndex={0}
                aria-label={t.timeline.region}
                aria-valuemin={0}
                aria-valuemax={tl.max}
                aria-valuenow={tl.idx}
                aria-valuetext={tl.name}
                style={s(`display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:2px 0 6px;scrollbar-width:thin`)}
              >
                {tl.segs.map((seg) => (
                  <div key={seg.id} style={s(`flex:${seg.flex};min-width:${Math.max(parseInt(seg.minW, 10) || 0, seg.ticks.length * 68)}px;display:flex;flex-direction:column;gap:3px`)}>
                    <button
                      className="tw-hov"
                      onClick={seg.head}
                      title={seg.title}
                      aria-label={seg.title}
                      aria-expanded={seg.zoomed}
                      style={s(
                        `height:18px;width:100%;display:flex;align-items:center;gap:6px;padding:0 4px;border:0;border-top:2px solid ${seg.tone};background:transparent;text-align:left;cursor:pointer;overflow:hidden;white-space:nowrap`,
                      )}
                    >
                      <span style={s(`flex:none;width:8px;height:8px;border:1.5px solid ${seg.tone};background:${seg.mark}`)} />
                      <img src={`./ui/${seg.cal}.png`} alt="" aria-hidden="true" width={16} height={16} style={s("flex:none;image-rendering:pixelated")} />
                      {seg.showLabel && <span style={s("font:500 12px var(--sans);overflow:hidden;text-overflow:ellipsis")}>{seg.label}</span>}
                      {seg.showMeta && <span style={s("font:10px var(--mono);color:var(--fg3);overflow:hidden;text-overflow:ellipsis")}>{seg.meta}</span>}
                    </button>
                    <div style={s("position:relative;height:14px")}>
                      {seg.events.map((ev) => (
                        <div
                          key={ev.key}
                          title={ev.title}
                          style={s(
                            `position:absolute;left:${ev.left};top:3px;display:flex;flex-direction:${ev.dir};gap:5px;align-items:center;white-space:nowrap;transform:${ev.tf}`,
                          )}
                        >
                          <span style={s("width:7px;height:7px;background:var(--fg2);transform:rotate(45deg)")} />
                          {ev.showLabel && <span style={s("font:10px var(--mono);color:var(--fg2)")}>{ev.label}</span>}
                        </div>
                      ))}
                    </div>
                    <div style={s(`position:relative;display:flex;gap:${seg.gap};align-items:flex-start`)}>
                      {seg.ticks.map((tk) => (
                        <div key={tk.key} style={s("flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                          <button
                            tabIndex={-1}
                            className={tk.hot ? "tw-tl-tick-hot" : undefined}
                            onClick={tk.go}
                            title={tk.title}
                            aria-label={tk.title}
                            aria-current={tk.cur ? "true" : undefined}
                            style={s(`display:block;width:100%;min-width:64px;height:${Math.max(tk.h, 36)}px;padding:0 5px;border:1px solid var(--line2);cursor:pointer;background:${tk.bg};box-shadow:${tk.ring};color:var(--fg);font:600 11px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}
                          >
                            {tk.title.split(" · ")[0].replace(/^Compuesto /, "")}
                          </button>
                          {tk.pips.map((pp) => (
                            <div
                              key={pp.key}
                              title={pp.key}
                              style={s(`height:5px;background:${pp.bg};box-shadow:${pp.sh};opacity:${pp.op}`)}
                            />
                          ))}
                        </div>
                      ))}
                      {seg.empty && (
                        <div
                          style={s(
                            "position:absolute;left:0;right:0;top:0;height:26px;display:flex;align-items:center;justify-content:center;font:11px var(--mono);color:var(--fg);pointer-events:none;background:var(--panel)",
                          )}
                        >
                          {t.timeline.emptySeg}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={s("display:flex;align-items:center;gap:8px;font:10px var(--mono);color:var(--fg3)")}>
                <span style={s("white-space:nowrap")}>{t.timeline.realTime}</span>
                <span>{tl.y0}</span>
                <div style={s("position:relative;flex:1;height:34px;box-sizing:border-box;border-style:solid;border-width:0 38px;border-image:url(./ui/rail.png) 0 150 0 150 fill / 0 38px 0 38px stretch")}>
                  <div style={s("position:absolute;left:0;right:0;bottom:-6px;height:4px;display:flex;gap:2px")}>
                    {tl.real.map((r) => (
                      <div key={r.id} style={s(`flex:${r.flex} 1 0;background:${r.tone}`)} />
                    ))}
                  </div>
                  <img src="./ui/diamond.png" alt="" aria-hidden="true" style={s(`position:absolute;top:5px;left:${tl.aLeft};width:24px;height:24px;margin-left:-12px;image-rendering:pixelated`)} />
                  {v.compareOn && (
                    <img src="./ui/diamond.png" alt="" aria-hidden="true" style={s(`position:absolute;top:5px;left:${tl.bLeft};width:24px;height:24px;margin-left:-12px;image-rendering:pixelated;filter:hue-rotate(160deg)`)} />
                  )}
                </div>
                <span>{tl.y1}</span>
                {v.isD && <span style={s("font:11px var(--sans);max-width:330px;line-height:1.25")}>{t.timeline.scaleNote}</span>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}