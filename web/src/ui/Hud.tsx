import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import type { View } from "../app/view";
import { Timeline } from "./Timeline";

type P = { v: View; a: App; tlRef: React.RefObject<HTMLDivElement> };

const PANEL = "background:var(--panel);border:1px solid var(--line);backdrop-filter:blur(10px)";
const PRIMARY = "border:1px solid var(--acc);background:var(--acc);color:var(--acc-ink);cursor:pointer;font-weight:600";
const SECONDARY = "border:1px solid var(--line2);background:transparent;cursor:pointer";

export function Hud({ v, a, tlRef }: P): React.ReactElement {
  const { t, lay } = v;
  return (
    <div style={s("position:absolute;inset:0;pointer-events:none")}>
      <TopBar v={v} a={a} />

      {v.showEntry && (
        <section
          aria-label={t.entry.kicker}
          style={s(
            `position:absolute;left:${lay.entL};right:${lay.entR};top:${lay.entT};bottom:${lay.entB};width:${lay.entW};transform:${lay.entTf};pointer-events:auto;${PANEL};padding:20px;display:flex;flex-direction:column;gap:12px`,
          )}
        >
          <div style={s("font:11px var(--mono);color:var(--fg2)")}>{t.entry.kicker}</div>
          {v.hasDs && <h1 style={s("margin:0;font:500 32px/1.1 var(--sans)")}>{v.areaName}</h1>}
          {v.noDs && <div className="tw-pulse" style={s("height:35px;width:70%;background:var(--line)")} />}
          <p style={s("margin:0;color:var(--fg2);max-width:46ch;text-wrap:pretty")}>{t.entry.lead}</p>
          {v.hasDs && (
            <div style={s("display:flex;flex-direction:column;gap:2px;font:11px var(--mono);color:var(--fg2)")}>
              {v.entryLines.map((ln: string) => (
                <div key={ln}>{ln}</div>
              ))}
            </div>
          )}
          {v.noDs && <div style={s("font:11px var(--mono);color:var(--fg3)")}>{t.status.loading}</div>}
          <div style={s("display:flex;gap:8px;flex-wrap:wrap;margin-top:4px")}>
            <button onClick={a.enter} disabled={v.noDs} style={s(`height:${lay.hit};padding:0 16px;${PRIMARY}`)}>
              {t.entry.enter}
            </button>
            <button
              className="tw-hov"
              onClick={() => a.set({ explore: true })}
              style={s(`height:${lay.hit};padding:0 16px;${SECONDARY}`)}
            >
              {t.entry.explore}
            </button>
          </div>
        </section>
      )}

      {v.showExplore && (
        <section
          style={s(
            `position:absolute;left:${lay.entL};right:${lay.entR};top:${lay.entT};bottom:${lay.entB};width:${lay.entW};transform:${lay.entTf};pointer-events:auto;${PANEL};padding:14px;display:flex;flex-direction:column;gap:10px`,
          )}
        >
          <button onClick={a.enter} disabled={v.noDs} style={s(`height:${lay.hit};padding:0 16px;${PRIMARY}`)}>
            {t.entry.backToArea}
          </button>
          <div style={s("font:11px var(--mono);color:var(--fg2)")}>{t.entry.dragHint}</div>
        </section>
      )}

      {v.showErr && (
        <section
          role="alert"
          style={s(
            "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100% - 16px));pointer-events:auto;background:var(--panel-solid);border:1px solid var(--warn);padding:20px;display:flex;flex-direction:column;gap:12px",
          )}
        >
          <h2 style={s("margin:0;font:500 18px/1.25 var(--sans)")}>{t.error.title}</h2>
          <p style={s("margin:0;color:var(--fg2)")}>{t.error.detail}</p>
          <div style={s("font:11px var(--mono);color:var(--fg3)")}>
            {t.error.code}: {v.errCode}
          </div>
          <div style={s("display:flex;gap:8px;flex-wrap:wrap")}>
            <button onClick={a.retry} style={s(`height:${lay.hit};padding:0 16px;${PRIMARY}`)}>
              {t.error.retry}
            </button>
            <button
              className="tw-hov"
              onClick={() => a.set({ explore: true })}
              style={s(`height:${lay.hit};padding:0 16px;${SECONDARY}`)}
            >
              {t.error.explore}
            </button>
          </div>
        </section>
      )}

      {v.dockOn && (
        <div
          role="radiogroup"
          aria-label={t.layers.title}
          style={s(`position:absolute;left:12px;top:64px;width:220px;pointer-events:auto;${PANEL}`)}
        >
          <div style={s("padding:8px 12px;font:11px var(--mono);color:var(--fg2)")}>{t.layers.title}</div>
          {v.layerItems.map((l) => (
            <button
              key={l.id}
              className="tw-hov"
              role="radio"
              aria-checked={l.on}
              onClick={l.go}
              style={s(
                `display:flex;gap:10px;align-items:center;width:100%;height:${lay.hit};padding:0 12px;border:0;border-top:1px solid var(--line);background:${l.bg};text-align:left;cursor:pointer`,
              )}
            >
              <span style={s(`flex:none;width:14px;height:14px;background:${l.grad};border:1px solid var(--line2)`)} />
              <span style={s("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.label}</span>
              {l.gap && (
                <span
                  title={t.layers.gapHere}
                  style={s(
                    "flex:none;width:10px;height:10px;background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 4px);box-shadow:inset 0 0 0 1px var(--line2)",
                  )}
                />
              )}
              <span style={s("flex:none;font:11px var(--mono);color:var(--fg3)")}>{l.unit}</span>
            </button>
          ))}
          {v.noDs && (
            <div style={s("border-top:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:12px")}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="tw-pulse" style={s("height:14px;background:var(--line)")} />
              ))}
            </div>
          )}
        </div>
      )}

      {v.chipsOn && (
        <div
          role="radiogroup"
          aria-label={t.layers.title}
          style={s("position:absolute;left:8px;right:8px;top:52px;display:flex;gap:6px;overflow-x:auto;pointer-events:auto")}
        >
          {v.layerItems.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={l.on}
              onClick={l.go}
              style={s(
                `flex:none;display:flex;gap:8px;align-items:center;height:44px;padding:0 12px;border:1px solid var(--line);background:${l.chipBg};backdrop-filter:blur(10px);cursor:pointer`,
              )}
            >
              <span style={s(`width:12px;height:12px;background:${l.grad};border:1px solid var(--line2)`)} />
              {l.label}
            </button>
          ))}
        </div>
      )}

      {v.camOn && <CameraControls v={v} a={a} />}

      <div
        style={s(
          `position:absolute;left:50%;transform:translateX(-50%);top:${lay.labelT};width:max-content;max-width:calc(100% - 24px);display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center`,
        )}
      >
        <div
          role="status"
          aria-live="polite"
          style={s(`display:${v.labelDisplay};padding:4px 12px;font:13px var(--mono);${PANEL}`)}
        >
          {v.mapLabel}
        </div>
        {v.compareOn && (
          <div style={s(`padding:3px 10px;font:11px var(--mono);${PANEL}`)}>{v.compareBanner}</div>
        )}
        {v.mixed && (
          <div
            style={s(
              "max-width:460px;padding:6px 10px;font:12px var(--sans);background:var(--panel-solid);border:1px solid var(--warn);color:var(--fg);text-wrap:pretty",
            )}
          >
            {t.compare.mixed}
          </div>
        )}
        {v.gapOn && (
          <div style={s("padding:6px 10px;font:12px var(--sans);background:var(--panel-solid);border:1px solid var(--line2)")}>
            {v.gapText} <span style={s("color:var(--fg2)")}>{t.map.gapHint}</span>
          </div>
        )}
        {v.offlineNote && <div style={s("font:11px var(--sans);color:var(--fg2)")}>{t.status.offlineDetail}</div>}
      </div>

      {v.cardOn && <InfoCard v={v} a={a} />}

      {v.dc.on && (
        <div
          role="dialog"
          aria-label={v.dc.title}
          style={s(
            `position:absolute;left:${v.dc.left};right:${v.dc.right};top:${v.dc.top};bottom:${v.dc.bottom};width:${v.dc.w};pointer-events:auto;background:var(--panel-solid);border:1px solid var(--acc-fg);padding:12px;display:flex;flex-direction:column;gap:6px`,
          )}
        >
          <div style={s("display:flex;gap:8px;align-items:flex-start")}>
            <div style={s("flex:1;font:600 13px var(--sans)")}>{v.dc.title}</div>
            <button
              className="tw-hov"
              onClick={a.closePick}
              aria-label={t.detail.close}
              title={t.detail.close}
              style={s(`width:${lay.hit};height:${lay.hit};margin:-8px -8px 0 0;border:0;background:transparent;cursor:pointer;font-size:16px`)}
            >
              ×
            </button>
          </div>
          <div style={s("font:600 20px var(--mono)")}>{v.dc.value}</div>
          {v.dc.hasDelta && (
            <div style={s("font:12px var(--mono);color:var(--fg2)")}>
              {t.detail.delta}: {v.dc.delta}
            </div>
          )}
          <div style={s("font:11px var(--mono);color:var(--fg2)")}>
            {t.detail.layer}: {v.dc.layer}
          </div>
          <div style={s("font:11px var(--mono);color:var(--fg2)")}>
            {t.detail.at}: {v.dc.moment}
          </div>
        </div>
      )}

      {v.toast && (
        <div
          role="status"
          aria-live="polite"
          style={s(
            `position:absolute;left:50%;transform:translateX(-50%);bottom:${lay.toastB};max-width:calc(100% - 24px);padding:6px 12px;font:12px var(--mono);background:var(--panel-solid);border:1px solid var(--line2)`,
          )}
        >
          {v.toast}
        </div>
      )}

      {v.tlOn && <Timeline v={v} a={a} tlRef={tlRef} />}

      {v.help && (
        <div
          onClick={() => a.set({ help: false })}
          style={s("position:absolute;inset:0;pointer-events:auto;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center")}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.help.title}
            onClick={(e) => e.stopPropagation()}
            style={s("width:min(420px,calc(100% - 24px));background:var(--panel-solid);border:1px solid var(--line2);padding:16px;display:flex;flex-direction:column;gap:12px")}
          >
            <div style={s("display:flex;align-items:center")}>
              <h2 style={s("margin:0;flex:1;font:500 15px var(--sans)")}>{t.help.title}</h2>
              <button onClick={() => a.set({ help: false })} style={s(`height:${lay.hit};padding:0 12px;${SECONDARY}`)}>
                {t.help.close}
              </button>
            </div>
            <div style={s("display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font:12px var(--sans)")}>
              {v.helpKeys.map((k) => (
                <React.Fragment key={k.k}>
                  <span style={s("font:11px var(--mono);color:var(--acc-fg)")}>{k.k}</span>
                  <span>{k.d}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay } = v;
  return (
    <div style={s(`position:absolute;left:${lay.pad};right:${lay.pad};top:${lay.pad};display:flex;gap:8px;align-items:flex-start`)}>
      {v.brandOn && (
        <div style={s(`pointer-events:auto;height:40px;display:flex;align-items:center;gap:10px;padding:0 12px;${PANEL};flex:none;white-space:nowrap`)}>
          <img
            src={v.theme === "dark" ? "./brand/termal-wave-dark.png" : "./brand/termal-wave-light.png"}
            alt={t.brand}
            height={20}
            style={s("image-rendering:pixelated;flex:none;display:block")}
          />
          {v.showName && <span style={s("color:var(--fg2)")}>{v.areaName}</span>}
          {v.mock && (
            <span title={t.mock.detail} style={s("font:11px var(--mono);padding:1px 6px;border:1px solid var(--warn);color:var(--warn)")}>
              {t.mock.tag}
            </span>
          )}
        </div>
      )}
      {v.searchField && (
        <div style={s("pointer-events:auto;flex:1 1 0;min-width:0;max-width:440px;margin:0 auto;position:relative")}>
          <input
            value={v.q}
            onChange={(e) => a.onQ(e.target.value)}
            onKeyDown={(e) => a.onQKey(e.key)}
            placeholder={t.top.search}
            aria-label={t.top.search}
            autoComplete="off"
            style={s(`width:100%;height:40px;padding:0 12px;border:1px solid var(--line);${"background:var(--panel);backdrop-filter:blur(10px)"};color:var(--fg);font:13px var(--sans);border-radius:0`)}
          />
          {v.showResults && (
            <div role="listbox" style={s("position:absolute;left:0;right:0;top:44px;background:var(--panel-solid);border:1px solid var(--line2)")}>
              {v.results.map((r) => (
                <button
                  key={r.label}
                  className="tw-hov"
                  role="option"
                  aria-selected={false}
                  onClick={r.go}
                  style={s(`display:block;width:100%;text-align:left;padding:0 12px;height:${lay.hit};border:0;background:transparent;cursor:pointer;font:13px var(--sans)`)}
                >
                  {r.label}
                </button>
              ))}
              {v.noResults && <div style={s("padding:10px 12px;color:var(--fg2)")}>{v.noResultsText}</div>}
            </div>
          )}
        </div>
      )}
      {v.searchBtn && (
        <button
          onClick={() => a.set({ searchOpen: true, q: "", results: [] })}
          aria-label={t.top.searchOpen}
          style={s(`pointer-events:auto;width:40px;height:40px;margin-left:auto;display:flex;align-items:center;justify-content:center;${PANEL};cursor:pointer`)}
        >
          <span style={s("width:12px;height:12px;border:2px solid currentColor;border-radius:50%")} />
        </button>
      )}
      {v.searchClose && (
        <button
          onClick={() => a.set({ searchOpen: false, q: "", results: [] })}
          aria-label={t.top.searchClose}
          style={s(`pointer-events:auto;width:40px;height:40px;${PANEL};cursor:pointer;flex:none`)}
        >
          ×
        </button>
      )}
      {v.brandOn && (
        <div style={s(`pointer-events:auto;margin-left:auto;height:40px;display:flex;align-items:center;gap:10px;padding:0 10px;${PANEL};flex:none`)}>
          <span title={v.statusDetail} style={s("display:flex;gap:6px;align-items:center;font:11px var(--mono)")}>
            <span style={s(`width:8px;height:8px;background:${v.statusColor}`)} />
            {v.showStatusText && <span>{v.statusText}</span>}
          </span>
          {v.noTerrain && (
            <span title={t.status.terrainOffDetail} style={s("font:11px var(--mono);color:var(--warn)")}>
              {t.status.terrainOff}
            </span>
          )}
          <button
            className="tw-hov"
            onClick={() => a.set({ help: !a.state.help })}
            aria-label={t.top.help}
            title={t.top.help}
            style={s("width:28px;height:28px;border:1px solid var(--line2);background:transparent;cursor:pointer;font:600 13px var(--mono)")}
          >
            ?
          </button>
        </div>
      )}
    </div>
  );
}

function CameraControls({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay } = v;
  const btn = `height:${lay.hit};border:0;box-shadow:${lay.sepSh};background:transparent;cursor:pointer;font:600 15px var(--mono)`;
  return (
    <div
      role="group"
      aria-label={t.camera.group}
      style={s(
        `position:absolute;left:${lay.camL};right:${lay.camR};top:${lay.camT};bottom:${lay.camB};width:${lay.camW};transform:${lay.camTf};pointer-events:auto;display:flex;flex-direction:${lay.camDir};${PANEL}`,
      )}
    >
      <button
        className="tw-hov"
        onClick={() => a.scene?.set({ northUp: !v.northUp })}
        aria-pressed={v.northOn}
        aria-label={v.northLabel}
        title={v.northLabel}
        style={s(`height:${lay.hit};border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center`)}
      >
        <span
          style={s(
            `display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:13px solid var(--acc-fg);transform:rotate(${v.northDeg}deg)`,
          )}
        />
      </button>
      <button
        className="tw-hov"
        onClick={() => a.scene?.set({ tilt: Math.min(60, v.tiltValue + 10) })}
        disabled={v.tiltOff}
        aria-label={t.camera.tiltUp}
        title={t.camera.tiltUp}
        style={s(btn)}
      >
        +
      </button>
      <div
        title={v.tiltTitle}
        style={s(`min-width:34px;min-height:22px;box-shadow:${lay.sepSh};display:flex;align-items:center;justify-content:center;font:11px var(--mono);color:var(--fg2)`)}
      >
        {v.tiltText}
      </div>
      <button
        className="tw-hov"
        onClick={() => a.scene?.set({ tilt: Math.max(0, v.tiltValue - 10) })}
        disabled={v.tiltOff}
        aria-label={t.camera.tiltDown}
        title={t.camera.tiltDown}
        style={s(btn)}
      >
        −
      </button>
      <button
        className="tw-hov"
        onClick={a.toOrbit}
        aria-label={t.camera.reset}
        title={`${t.camera.reset} (O)`}
        style={s(`height:${lay.hit};border:0;box-shadow:${lay.sepSh};background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center`)}
      >
        <span style={s("width:16px;height:16px;border:2px solid var(--fg);border-radius:50%;position:relative")}>
          <span style={s("position:absolute;left:5px;top:-2px;bottom:-2px;width:2px;background:var(--fg)")} />
        </span>
      </button>
    </div>
  );
}

function InfoCard({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay, leg, ser } = v;
  return (
    <div
      style={s(
        `position:absolute;left:${lay.cL};right:${lay.cR};top:${lay.cT};bottom:${lay.cB};width:${lay.cW};height:${lay.cH};display:flex;flex-direction:column;justify-content:${lay.cJ};gap:8px;pointer-events:${lay.cPE};background:${lay.shBg};border:${lay.shBd}`,
      )}
    >
      <div
        style={s(
          `pointer-events:auto;min-height:0;display:flex;flex-direction:column;background:${lay.inBg};border:${lay.inBd};backdrop-filter:${lay.inBl}`,
        )}
      >
        {v.mClosed && (
          <button
            onClick={() => a.set({ sheet: !a.state.sheet })}
            aria-expanded="false"
            style={s("height:44px;width:100%;display:flex;align-items:center;gap:10px;padding:0 12px;border:0;background:transparent;cursor:pointer;text-align:left")}
          >
            <span style={s("flex:1")}>{t.card.sheet}</span>
            <span style={s("font:600 13px var(--mono)")}>{v.valueText}</span>
            <span style={s(`width:48px;height:8px;background:${leg.grad}`)} />
          </button>
        )}
        {v.mOpenOrDesk && (
          <>
            <div role="tablist" style={s("display:flex;align-items:stretch;flex:none")}>
              <button
                role="tab"
                aria-selected={v.isTabArea}
                onClick={() => a.set({ tab: "area" })}
                style={s(`height:${lay.hit};padding:0 14px;border:0;border-bottom:2px solid ${v.tabAreaLine};background:transparent;cursor:pointer`)}
              >
                {t.card.tabArea}
              </button>
              <button
                role="tab"
                aria-selected={v.isTabRead}
                onClick={() => a.set({ tab: "read" })}
                style={s(`height:${lay.hit};padding:0 14px;border:0;border-bottom:2px solid ${v.tabReadLine};background:transparent;cursor:pointer`)}
              >
                {t.card.tabReading}
              </button>
              <button
                role="tab"
                aria-selected={v.isTabSources}
                onClick={() => a.set({ tab: "sources" })}
                style={s(`height:${lay.hit};padding:0 14px;border:0;border-bottom:2px solid ${v.tabSourcesLine};background:transparent;cursor:pointer`)}
              >
                {t.card.tabSources}
              </button>
              <button
                className="tw-hov"
                onClick={() => (v.isM ? a.set({ sheet: !a.state.sheet }) : a.set({ ficha: !a.state.ficha }))}
                aria-expanded={v.cardOpen}
                aria-label={v.cardToggleText}
                title={v.cardToggleText}
                style={s(`margin-left:auto;width:${lay.hit};height:${lay.hit};border:0;background:transparent;cursor:pointer;font:600 14px var(--mono)`)}
              >
                {v.cardToggleGlyph}
              </button>
            </div>
            {v.cardOpen && (
              <div
                role="tabpanel"
                style={s("overflow-x:hidden;overflow-y:auto;padding:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px;min-height:0")}
              >
                {v.isTabArea && (
                  <>
                    <div>
                      <div style={s("font:500 15px var(--sans)")}>{v.areaName}</div>
                      <div style={s("font:11px var(--mono);color:var(--fg2)")}>{v.boundsText}</div>
                    </div>
                    <div>
                      <div style={s("font:11px var(--mono);color:var(--fg2)")}>
                        {v.layerName} · {v.momentName}
                      </div>
                      <div style={s("font:600 20px/1.3 var(--mono)")}>{v.valueText}</div>
                      <div style={s("font:12px var(--sans);color:var(--fg2)")}>{v.deltaText}</div>
                    </div>
                    <div>
                      <div style={s("font:11px var(--mono);color:var(--fg2);margin-bottom:4px")}>{t.card.series}</div>
                      <svg width={ser.w} height={56} style={s("display:block;overflow:visible")}>
                        <path d={ser.divD} style={s("fill:none;stroke:var(--line2);stroke-width:1;stroke-dasharray:2 3")} />
                        <path d={ser.gapD} style={s("fill:none;stroke:var(--warn);stroke-width:2")} />
                        <path d={ser.lineD} style={s("fill:none;stroke:var(--fg2);stroke-width:1.5")} />
                        <circle cx={ser.bx} cy={ser.by} r={ser.br} style={s("fill:var(--accB)")} />
                        <circle cx={ser.ax} cy={ser.ay} r={ser.ar} style={s("fill:var(--acc);stroke:var(--bg);stroke-width:1.5")} />
                      </svg>
                      <div style={s("display:flex;justify-content:space-between;font:10px var(--mono);color:var(--fg3)")}>
                        <span>{ser.y0}</span>
                        <span>{ser.y1}</span>
                      </div>
                    </div>
                    <dl style={s("margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font:12px var(--sans)")}>
                      {v.imgRows.map((r) => (
                        <React.Fragment key={r.k}>
                          <dt style={s("color:var(--fg2)")}>{r.k}</dt>
                          <dd style={s("margin:0;font-family:var(--mono);font-size:11px")}>{r.v}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </>
                )}
                {v.isTabSources && (
                  <>
                    <div style={s("color:var(--fg2)")}>{t.sources.lead}</div>
                    {v.sourcesAt && <div style={s("font:11px var(--mono);color:var(--fg3)")}>{v.sourcesAt}</div>}
                    {v.noSources && <div style={s("color:var(--fg2)")}>{t.sources.empty}</div>}
                    {v.sources.map((g) => (
                      <div key={g.key} style={s("display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:1px solid var(--line)")}>
                        <div style={s("display:flex;align-items:center;gap:8px")}>
                          <span style={s("flex:1;font:500 13px var(--sans)")}>{g.label}</span>
                          <span style={s(`display:flex;gap:5px;align-items:center;font:11px var(--mono);color:${g.statusColor}`)}>
                            <span style={s(`width:7px;height:7px;background:${g.statusColor}`)} />
                            {g.statusText}
                          </span>
                        </div>
                        <div style={s("font:12px var(--sans);color:var(--fg2);text-wrap:pretty")}>{g.strategy}</div>
                        <div style={s("font:11px var(--mono);color:var(--fg2)")}>
                          {t.sources.selected}: {g.selected.length ? g.selected.join(", ") : t.sources.none}
                        </div>
                        <div style={s("font:11px var(--mono);color:var(--fg3)")}>
                          {g.count}
                          {g.fromCache ? ` · ${t.sources.fromCache}` : ""}
                        </div>
                        <div style={s("display:flex;flex-direction:column;gap:2px;font:11px var(--mono)")}>
                          <span style={s("color:var(--fg3)")}>{t.sources.tried}</span>
                          {g.tried.map((x) => (
                            <span key={x.key} style={s(`display:flex;gap:6px;color:${x.ok ? "var(--fg2)" : "var(--warn)"}`)}>
                              <span style={s("flex:1;min-width:0")}>{x.name}</span>
                              <span>{x.note}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {v.isTabRead && (
                  <>
                    <div style={s("color:var(--fg2)")}>{t.card.readingLead}</div>
                    <div style={s("display:flex;gap:6px;flex-wrap:wrap")}>
                      {v.trades.map((tr) => (
                        <button
                          key={tr.trade}
                          aria-pressed={tr.on}
                          onClick={tr.go}
                          style={s(`white-space:normal;min-height:${lay.hit};padding:4px 10px;border:1px solid ${tr.line};background:${tr.bg};cursor:pointer;text-align:left`)}
                        >
                          {tr.trade}
                        </button>
                      ))}
                    </div>
                    <p style={s("margin:0;text-wrap:pretty")}>{v.tradeText}</p>
                    {v.sample && <div style={s("font:11px var(--mono);color:var(--warn)")}>{t.card.readingSample}</div>}
                    {v.noTrades && <div style={s("color:var(--fg2)")}>{t.card.readingEmpty}</div>}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {v.legendOn && (
        <div
          style={s(
            `pointer-events:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:${lay.inBg};border:${lay.inBd};backdrop-filter:${lay.inBl};flex:none`,
          )}
        >
          <div style={s("display:flex;justify-content:space-between;font:11px var(--mono);color:var(--fg2)")}>
            <span>{t.legend.title}</span>
            <span style={s("white-space:nowrap")}>
              {leg.label} · {leg.unit}
            </span>
          </div>
          <div style={s(`height:10px;background:${leg.grad}`)} />
          <div style={s("display:flex;justify-content:space-between;font:11px var(--mono)")}>
            <span>{leg.min}</span>
            <span>{leg.max}</span>
          </div>
          <div style={s("font:11px var(--sans);color:var(--fg2);text-wrap:pretty")}>{leg.note}</div>
        </div>
      )}
    </div>
  );
}
