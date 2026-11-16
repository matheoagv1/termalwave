import React from "react";
import type { App } from "../app/App";
import { s } from "../app/css";
import type { View } from "../app/view";
import { Icon } from "./icons";
import { IntroOverlay } from "./IntroOverlay";
import { InspectBody, LeftRail, MobileBar, MobileSheet, RightRail } from "./rails";
import { MonigoteBuddy } from "./MonigoteBuddy";
import { TipLayer } from "./TipLayer";
import { Timeline } from "./Timeline";
import { hudCopy } from "./hud/copy";
import { AboutMore } from "./about/AboutMore";
import { ProvenanceCard } from "./layers/Provenance";
import "./hud/hud.css";

type P = { v: View; a: App; tlRef: React.RefObject<HTMLDivElement> };

const wordmarks = import.meta.glob("../context/brand/Wordmark.tsx", { eager: true }) as Record<
  string,
  { Wordmark?: React.ComponentType<{ compact?: boolean }> }
>;
const Wordmark = Object.values(wordmarks)
  .map((mod) => mod.Wordmark)
  .find((Cmp): Cmp is React.ComponentType<{ compact?: boolean }> => !!Cmp);

const PANEL = "background:var(--panel);border:1px solid var(--line);backdrop-filter:blur(8px)";
const PRIMARY = "border:1px solid var(--acc);background:var(--acc);color:var(--acc-ink);cursor:pointer;font-weight:600";
const SECONDARY = "border:1px solid var(--line2);background:transparent;cursor:pointer";

export function Hud({ v, a, tlRef }: P): React.ReactElement {
  const { t, lay } = v;
  return (
    <div style={s("position:absolute;inset:0;pointer-events:none;z-index:20")}>
      {!v.immersive && <TopBar v={v} a={a} />}
      {v.orbitLegend && (
        <div style={s(`position:absolute;left:${lay.pad};bottom:${v.frameBottom};display:flex;align-items:center;gap:8px;pointer-events:none;z-index:18;font:11px var(--sans);color:var(--fg2)`)}>
          <span style={s("width:22px;height:0;border-top:1px solid var(--tw-radar)")} />
          {t.orbits.legend}
        </div>
      )}
      {v.legendStrip && (v.leg.caption || v.leg.min) && (
        <div
          style={s(
            `position:absolute;left:${lay.pad};bottom:calc(${v.frameBottom} + 22px);z-index:18;display:flex;flex-direction:column;gap:3px;width:min(260px,48vw);padding:6px 8px;pointer-events:none;background:var(--panel);border:1px solid var(--line);color:var(--fg)`,
          )}
        >
          <span style={s("font:11px var(--mono)")}>
            {v.leg.example ? v.leg.caption : `${v.leg.label} · ${v.leg.min} · ${v.leg.max}`}
          </span>
          <span style={s(`height:8px;background:${v.leg.grad}`)} />
        </div>
      )}
      {!v.isM && v.railsOn && <LeftRail v={v} a={a} />}
      {!v.isM && v.railsOn && <RightRail v={v} a={a} />}
      {v.isM && v.railsOn && <MobileBar v={v} a={a} />}
      {v.isM && v.railsOn && <MobileSheet v={v} a={a} />}

      {v.immersive && v.hudToggleOn && (
        <button
          className="tw-hov"
          onClick={a.toggleImmersive}
          title={`${v.hudToggleLabel} (H)`}
          style={s(`position:absolute;right:${lay.pad};top:${lay.pad};height:${lay.hit};padding:0 12px;pointer-events:auto;${PANEL};cursor:pointer;font:12px var(--sans)`)}
        >
          {v.hudToggleLabel}
        </button>
      )}

      {v.showEntry && v.noDs && (
        <section
          aria-busy="true"
          aria-live="polite"
          aria-label={t.status.loading}
          style={s(
            `position:absolute;left:${lay.entL};right:${lay.entR};bottom:${lay.entB};width:${lay.entW};pointer-events:auto;${PANEL};padding:16px 18px;display:flex;align-items:center;gap:14px`,
          )}
        >
          <div style={s("min-width:0;display:flex;flex-direction:column;gap:8px;flex:1")}>
            <div style={s("font:14px/1.35 var(--sans);color:var(--fg)")}>{t.status.loading}</div>
            <div className="tw-pulse" style={s("height:6px;width:72%;background:var(--line2)")} />
          </div>
        </section>
      )}

      {v.introOpen && (
        <IntroOverlay sound={v.soundOn} reduced={a.rm()} onDone={a.finishIntro} app={a} />
      )}

      {v.moniOn && (
        <MonigoteBuddy
          tip={v.moniTip}
          name={v.userName}
          open={v.moniOpen}
          sound={v.soundOn}
          reduced={a.rm()}
          onToggle={a.toggleMoni}
          onClose={a.closeMoni}
          onSoundToggle={a.toggleSound}
          onSetup={a.openSetup}
          soundLabel={v.soundOn ? v.t.moni.soundOn : v.t.moni.soundOff}
          closeLabel={v.t.moni.close}
          buddyLabel={v.t.moni.buddy}
          bottom={v.moniB}
        />
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
          className="tw-layers-dock"
          role="radiogroup"
          aria-label={t.layers.title}
          style={s(
            `position:absolute;left:12px;top:64px;width:${v.dockOpen ? "232px" : "auto"};min-width:${v.dockOpen ? "0" : "120px"};max-height:${v.dockMaxH};overflow-y:auto;pointer-events:auto;${PANEL}`,
          )}
        >
          <button
            className="tw-hov"
            onClick={() => a.set({ dockOpen: !a.state.dockOpen })}
            aria-expanded={v.dockOpen}
            title={v.dockToggleLabel}
            aria-label={v.dockToggleLabel}
            style={s("display:flex;width:100%;align-items:center;padding:0 12px;height:36px;border:0;background:transparent;cursor:pointer;font:12px var(--sans);color:var(--fg);text-align:left")}
          >
            <span className="tw-pixel" style={s("flex:1;font-size:8px;line-height:1.5;color:var(--acc-fg)")}>
              {t.layers.title}
            </span>
            <span aria-hidden="true">{v.dockOpen ? "–" : "+"}</span>
          </button>
          {v.dockOpen && (
            <div style={s("border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px")}>
              <p className="tw-pixel" style={s("margin:0;font-size:8px;line-height:1.6;color:var(--fg2);text-wrap:pretty")}>{t.layers.lead}</p>
              {v.basemapItems.length > 0 && (
                <div role="radiogroup" aria-label={t.layers.basemap} style={s("display:flex;flex-direction:column;gap:4px;margin-top:4px")}>
                  <div className="tw-pixel" style={s("font-size:7px;line-height:1.6;color:var(--fg2)")}>{t.layers.basemap}</div>
                  {v.basemapItems.map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      role="radio"
                      aria-checked={bm.on}
                      className="tw-hov"
                      onClick={bm.go}
                      style={s(`height:${lay.hit};padding:0 10px;text-align:left;${SECONDARY};font:12px var(--sans);color:var(--fg);background:${bm.on ? "var(--sel)" : "transparent"};border-color:${bm.on ? "var(--acc)" : "var(--line2)"}`)}
                    >
                      {bm.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {v.dockOpen && v.panelRows.map((row) => {
            if (row.kind === "head") {
              return (
                <div key={row.key} role="presentation" style={s("padding:6px 12px 4px;border-top:1px solid var(--line);font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--fg2)")}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === "global") {
              return (
                <button
                  key={row.key}
                  type="button"
                  className="tw-hov"
                  role="switch"
                  aria-checked={row.on}
                  data-layer-id={row.id}
                  title={row.note}
                  onClick={row.go}
                  style={s(`display:flex;gap:10px;align-items:flex-start;width:100%;min-height:${lay.hit};padding:8px 12px;border:0;border-top:1px solid var(--line);background:${row.on ? "var(--sel)" : "transparent"};text-align:left;cursor:pointer`)}
                >
                  <span aria-hidden="true" style={s(`flex:none;margin-top:2px;width:14px;height:14px;border:1px solid ${row.on ? "var(--acc-fg)" : "var(--line2)"};background:${row.on ? "var(--acc-fg)" : "transparent"}`)} />
                  <span style={s("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                    <span style={s("font:13px/1.25 var(--sans);color:var(--fg)")}>{row.label}</span>
                    {row.on && row.info ? (
                      <span role={row.warn ? "alert" : "status"} style={s(`font:11px/1.35 var(--sans);color:${row.warn ? "var(--warn, #e0a050)" : "var(--fg2)"};white-space:normal;text-wrap:pretty`)}>{row.info}</span>
                    ) : null}
                  </span>
                </button>
              );
            }
            const l = row.item;
            return (
            <React.Fragment key={l.id}>
            <button
              className="tw-hov"
              role="radio"
              aria-checked={l.on}
              data-layer-id={l.id}
              data-help-hook={`layer-${l.id}`}
              title={l.note || l.label}
              onClick={l.go}
              style={s(
                `display:flex;gap:10px;align-items:center;width:100%;min-height:${lay.hit};padding:8px 12px;border:0;border-top:1px solid var(--line);background:${l.bg};text-align:left;cursor:pointer`,
              )}
            >
              <span style={s(`flex:none;width:14px;height:14px;background:${l.grad};border:1px solid var(--line2)`)} />
              <span style={s("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                <span style={s("font:13px/1.25 var(--sans);color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px")}>
                  {l.label}
                  {l.catBadge ? (
                    <span style={s("font:9px var(--mono);letter-spacing:.04em;color:var(--fg3);font-weight:400")}>{l.catBadge}</span>
                  ) : null}
                </span>
                {l.info ? (
                  <span role={l.warn ? "alert" : "status"} style={s(`font:11px/1.35 var(--sans);color:${l.warn ? "var(--warn, #e0a050)" : "var(--fg2)"};white-space:normal;text-wrap:pretty`)}>{l.info}</span>
                ) : null}
              </span>
              {l.gap && (
                <span
                  title={t.layers.gapHere}
                  style={s(
                    "flex:none;width:10px;height:10px;background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 4px);box-shadow:inset 0 0 0 1px var(--line2)",
                  )}
                />
              )}
              {l.core && (
                <span title={t.layers.coreTitle} style={s("flex:none;font:9px var(--mono);letter-spacing:.06em;border:1px solid var(--line2);padding:1px 4px;color:var(--fg2)")}>{t.layers.core}</span>
              )}
              <span style={s("flex:none;font:11px var(--mono);color:var(--fg2)")}>{l.unit}</span>
            </button>
            </React.Fragment>
            );
          })}
          {v.dockOpen && v.overlayItems.length > 0 && (
            <div role="group" aria-label={t.layers.overlay} style={s("border-top:1px solid var(--line);padding:8px 12px;display:flex;flex-direction:column;gap:6px")}>
              <span style={s("font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--fg2)")}>{t.layers.overlay}</span>
              <div style={s("display:flex;flex-wrap:wrap;gap:6px")}>
                {v.overlayItems.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="tw-hov"
                    aria-pressed={o.on}
                    disabled={o.core}
                    title={o.core ? t.layers.coreTitle : o.on ? t.layers.overlayOn : t.layers.overlayOff}
                    onClick={o.go}
                    style={s(`min-height:30px;padding:0 10px;border:1px solid ${o.on ? "var(--acc-fg)" : "var(--line2)"};background:${o.on ? "var(--sel)" : "transparent"};color:var(--fg);font:12px var(--sans);cursor:${o.core ? "default" : "pointer"}`)}
                  >
                    {o.id === "radar" ? "Radar NISAR" : o.label}{o.core ? " · núcleo" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          style={s("position:absolute;left:8px;right:8px;top:52px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;pointer-events:auto")}
        >
          {v.layerItems.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={l.on}
              onClick={l.go}
              style={s(
                `min-width:0;display:flex;gap:8px;align-items:center;height:44px;padding:0 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid var(--line);background:${l.chipBg};backdrop-filter:blur(8px);cursor:pointer`,
              )}
            >
              <span style={s(`width:12px;height:12px;background:${l.grad};border:1px solid var(--line2)`)} />
              {l.label}
            </button>
          ))}
        </div>
      )}

      {v.camOn && <CameraControls v={v} a={a} />}

      {v.exploreOn && <ExploreTools v={v} a={a} />}

      <div
        style={s(
          v.isM
            ? "position:absolute;left:8px;right:60px;top:54px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left"
            : `position:absolute;left:50%;transform:translateX(-50%);top:${lay.labelT};width:max-content;max-width:min(760px,calc(100% - 760px));min-width:min(420px,calc(100% - 24px));display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center`,
        )}
      >
        <StatusStrip v={v} a={a} />
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
              style={s(`width:${lay.hit};height:${lay.hit};margin:-8px -8px 0 0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center`)}
            >
              <Icon.close size={16} strokeWidth={2.25} aria-hidden />
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
          <ProvenanceCard id={a.state.scene.layer} lang={a.state.lang} />
          {v.dc.spotSerOn && (
            <div style={s("margin-top:4px")}>
              <div style={s("font:10px var(--mono);color:var(--fg3);margin-bottom:2px")}>{t.explore.series}</div>
              <svg width={v.dc.spotW} height={40} style={s("display:block;overflow:visible")}>
                <path d={v.dc.spotLineD} style={s("fill:none;stroke:var(--fg2);stroke-width:1.5")} />
                <circle cx={v.dc.spotAx} cy={v.dc.spotAy} r={3.5} style={s("fill:var(--acc)")} />
              </svg>
            </div>
          )}
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

      <TipLayer onLong={a.showHelpText} />

      {v.help && <About v={v} a={a} />}
    </div>
  );
}

function TopBar({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay } = v;
  const c = hudCopy(a.state.lang);
  return (
    <div
      className="tw-top"
      style={s(
        `position:absolute;left:${lay.pad};right:${lay.pad};top:${lay.pad};height:40px;display:flex;gap:8px;align-items:center;padding:0 6px 0 8px;pointer-events:auto;z-index:21`,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {!(v.isM && v.searchField) && (
        <span style={s("flex:none;display:flex;align-items:center;color:var(--acc-fg)")}>
          {Wordmark ? <Wordmark compact /> : <span className="tw-pixel" style={s("font-size:8px")}>{t.wordmark}</span>}
        </span>
      )}
      {!v.isM && <span className="tw-top-tag">{c.tagline}</span>}
      {v.searchField && (
        <div style={s("flex:1 1 0;min-width:0;max-width:440px;margin:0 auto;position:relative")}>
          <span aria-hidden="true" style={s("position:absolute;left:8px;top:0;height:100%;display:flex;align-items:center;color:var(--fg3);pointer-events:none")}>
            <Icon.search size={14} strokeWidth={2.25} />
          </span>
          <input
            type="search"
            value={v.q}
            onChange={(e) => a.onQ(e.target.value)}
            onKeyDown={(e) => a.onQKey(e.key)}
            placeholder={t.top.search}
            aria-label={t.top.search}
            autoComplete="off"
            autoFocus={v.isM}
            style={s(
              `width:100%;height:${v.isM ? "36px" : "28px"};padding:0 10px 0 28px;border:1px solid var(--line2);background:var(--panel-solid);color:var(--fg);font:13px var(--sans);border-radius:0;touch-action:manipulation`,
            )}
          />
          {v.showResults && (
            <div role="listbox" aria-label={t.top.search} style={s("position:absolute;left:0;right:0;top:calc(100% + 6px);max-height:50vh;overflow-y:auto;background:var(--panel-solid);border:1px solid var(--line2)")}>
              {v.results.map((r) => (
                <button
                  key={r.label}
                  className="tw-hov"
                  role="option"
                  aria-selected={false}
                  onClick={r.go}
                  style={s(`display:block;width:100%;text-align:left;padding:0 12px;height:${lay.hit};border:0;background:transparent;cursor:pointer;font:13px var(--sans);overflow:hidden;text-overflow:ellipsis`)}
                >
                  {r.label}
                </button>
              ))}
              {v.noResults && <div style={s("padding:10px 12px;font:12px var(--sans);color:var(--fg2);text-wrap:pretty")}>{v.noResultsText}</div>}
            </div>
          )}
        </div>
      )}
      {v.searchClose && (
        <button
          type="button"
          className="tw-hov tw-top-btn"
          onClick={() => a.set({ searchOpen: false, q: "", results: [] })}
          aria-label={t.top.searchClose}
          title={t.top.searchClose}
          style={s("flex:none")}
        >
          <Icon.close size={16} strokeWidth={2.25} aria-hidden />
        </button>
      )}
      {v.brandOn && (
        <div style={s("margin-left:auto;display:flex;align-items:center;gap:6px;flex:none")}>
          {v.searchBtn && (
            <button
              type="button"
              className="tw-hov tw-top-btn"
              onClick={() => a.set({ searchOpen: true, q: "", results: [] })}
              aria-label={t.top.searchOpen}
              title={t.top.searchOpen}
            >
              <Icon.search size={16} strokeWidth={2.25} aria-hidden />
            </button>
          )}
          <LangSwitch v={v} a={a} />
          {v.hudToggleOn && !v.isM && (
            <button
              type="button"
              className="tw-hov tw-top-btn"
              onClick={a.toggleImmersive}
              aria-label={v.hudToggleLabel}
              title={`${v.hudToggleLabel} (H)`}
            >
              <Icon.eyeOff size={14} strokeWidth={2.25} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="tw-hov tw-top-btn"
            onClick={() => a.set({ help: !a.state.help })}
            aria-haspopup="dialog"
            aria-expanded={v.help}
            aria-label={c.about}
            title={`${c.about} (?)`}
          >
            {v.isM ? "?" : c.about}
          </button>
        </div>
      )}
    </div>
  );
}

// What is on screen, in one row: view, date, kind of data, and whether the sources answered.
function StatusStrip({ v, a }: { v: View; a: App }): React.ReactElement | null {
  const { t } = v;
  const c = hudCopy(a.state.lang);
  const okN = v.sources.filter((g) => g.statusColor !== "var(--warn)").length;
  const srcColor = okN === v.sources.length ? "var(--ok)" : "var(--warn)";
  if (!v.mapLabel && !v.chipLabel) return null;
  return (
    <div className="tw-strip" role="status" aria-live="polite">
      {v.mapLabel && (
        <span>
          <span className="tw-strip-k">{c.view}</span>
          {v.mapLabel}
        </span>
      )}
      {v.momentName && v.railsOn && !(v.tlOn && v.tlReady) && (
        <span>
          <span className="tw-strip-k">{c.date}</span>
          {v.momentName}
        </span>
      )}
      {v.chipLabel && v.railsOn && (
        <span title={v.chipTitle || v.chipLabel}>
          <span className="tw-strip-k">{c.data}</span>
          <span aria-hidden="true" style={s(`width:8px;height:8px;flex:none;background:${v.chipTitle ? "var(--tw-h-ejemplo)" : "var(--tw-h-medido)"}`)} />
          {v.chipLabel}
        </span>
      )}
      {v.railsOn && v.sources.length > 0 && (
        <button type="button" className="tw-hov" onClick={() => a.set({ railR: "sources" })} title={c.openSources} aria-label={`${c.sourcesShort}: ${c.sourcesOk(okN, v.sources.length)}. ${c.openSources}`}>
          <span className="tw-strip-k">{c.sourcesShort}</span>
          <span aria-hidden="true" style={s(`width:8px;height:8px;flex:none;background:${srcColor}`)} />
          {c.sourcesOk(okN, v.sources.length)}
        </button>
      )}
      {v.statusText === t.status.offline && (
        <span title={v.statusDetail} style={s("color:var(--warn)")}>
          <span aria-hidden="true" style={s("width:8px;height:8px;flex:none;background:var(--warn)")} />
          {v.statusText}
        </span>
      )}
      {v.noTerrain && v.railsOn && (
        <span title={t.status.terrainOffDetail} style={s("color:var(--warn)")}>
          {t.status.terrainOff}
        </span>
      )}
    </div>
  );
}

function About({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay } = v;
  const c = hudCopy(a.state.lang);
  const tone: Record<string, string> = { measured: "var(--tw-h-medido)", derived: "var(--tw-h-derivado)", example: "var(--tw-h-ejemplo)" };
  return (
    <div
      onClick={() => a.set({ help: false })}
      style={s("position:absolute;inset:0;z-index:40;pointer-events:auto;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center")}
    >
      <div role="dialog" aria-modal="true" aria-label={c.aboutTitle} className="tw-about" onClick={(e) => e.stopPropagation()}>
        <div style={s("display:flex;align-items:center;gap:8px")}>
          <h2 style={s("margin:0;flex:1;font:500 16px var(--sans)")}>{c.aboutTitle}</h2>
          <button autoFocus type="button" className="tw-hov" onClick={() => a.set({ help: false })} style={s(`height:${lay.hit};padding:0 12px;${SECONDARY}`)}>
            {t.help.close}
          </button>
        </div>
        <p>{c.what}</p>
        <p style={s("color:var(--fg2)")}>{c.why}</p>
        <section>
          <h3>{c.honestyTitle}</h3>
          <dl>
            {c.honesty.map(([id, name, text]) => (
              <React.Fragment key={id}>
                <dt style={s("display:flex;align-items:center;gap:6px;color:var(--fg)")}>
                  <span aria-hidden="true" style={s(`width:8px;height:8px;background:${tone[id ?? ""] ?? "var(--fg3)"}`)} />
                  {name}
                </dt>
                <dd style={s("color:var(--fg2)")}>{text}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
        <section>
          <h3>{c.sourcesTitle}</h3>
          <dl>
            {c.sources.map(([k, d]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{d}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p style={s("margin-top:8px;font-size:12px;color:var(--fg2)")}>{c.sourcesNote}</p>
        </section>
        {!v.isM && (
          <section>
            <h3>{c.keysTitle}</h3>
            <dl>
              {v.helpKeys.map((k) => (
                <React.Fragment key={k.k}>
                  <dt style={s("font:11px var(--mono);color:var(--acc-fg)")}>{k.k}</dt>
                  <dd>{k.d}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        )}
        <AboutMore lang={a.state.lang} />
        <p style={s("padding-top:10px;border-top:1px solid var(--line);font:11px var(--mono);color:var(--fg2)")}>{c.entry}</p>
      </div>
    </div>
  );
}

function ExploreTools({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay, ser } = v;
  const seg = (on: boolean): string =>
  `height:${lay.hit};padding:0 10px;border:1px solid var(--line2);background:${on ? "var(--sel)" : "transparent"};cursor:pointer;font:11px var(--mono);color:${on ? "var(--acc-fg)" : "var(--fg2)"}`;
  return (
    <div
      role="toolbar"
      aria-label={t.explore.group}
      style={s(
        `position:absolute;left:${lay.exploreL};bottom:${lay.exploreB};max-width:calc(100% - ${lay.pad} - ${lay.pad});pointer-events:auto;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;${PANEL}`,
      )}
    >
      <div role="group" aria-label={t.explore.group} style={s("display:flex;gap:2px")}>
        <button
          className="tw-hov"
          type="button"
          aria-pressed={v.viewCampo}
          title={t.explore.campoHint}
          onClick={() => a.setViewScale("campo")}
          style={s(seg(v.viewCampo))}
        >
          {t.explore.campo}
        </button>
        <button
          className="tw-hov"
          type="button"
          aria-pressed={v.viewUrbano}
          title={t.explore.urbanoHint}
          onClick={() => a.setViewScale("urbano")}
          style={s(seg(v.viewUrbano))}
        >
          {t.explore.urbano}
        </button>
      </div>
      <button
        className="tw-hov"
        type="button"
        aria-pressed={v.compareOn}
        title={v.compareOn ? t.explore.compareOn : t.explore.compare}
        onClick={a.toggleCompare}
        style={s(`height:${lay.hit};padding:0 10px;border:1px solid ${v.compareOn ? "var(--acc-fg)" : "var(--line2)"};background:${v.compareOn ? "var(--sel)" : "transparent"};cursor:pointer;font:11px var(--mono)`)}
      >
        {v.compareOn ? t.timeline.compareOff : t.timeline.compare}
      </button>
      <button
        className="tw-hov"
        type="button"
        disabled={!v.exploreHasHotspots}
        title={t.explore.hotspots(v.hotspotCount)}
        aria-label={t.explore.nextHotspot}
        onClick={a.cycleHotspot}
        style={s(`height:${lay.hit};padding:0 10px;border:1px solid var(--line2);background:transparent;cursor:pointer;font:11px var(--mono);color:var(--fg2)`)}
      >
        {t.explore.hotspots(v.hotspotCount)}
      </button>
      {v.exploreHasSer && (
        <div
          title={t.explore.series}
          style={s("display:flex;align-items:center;gap:8px;padding:0 4px;border-left:1px solid var(--line)")}
        >
          <svg width={Math.min(ser.w, 112)} height={40} viewBox={`0 0 ${ser.w} 56`} style={s("display:block")}>
            <path d={ser.lineD} style={s("fill:none;stroke:var(--fg2);stroke-width:1.5")} />
            <circle cx={ser.ax} cy={ser.ay} r={ser.ar} style={s("fill:var(--acc)")} />
          </svg>
          {v.explorePeekOn && (
            <div style={s("display:flex;flex-direction:column;gap:0;font:10px var(--mono);color:var(--fg2);max-width:12ch")}>
              <span style={s("color:var(--fg)")}>{v.exploreValue}</span>
              {v.exploreDelta && <span>{v.exploreDelta}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CameraControls({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t, lay } = v;
  const btn = `height:${lay.hit};border:0;box-shadow:${lay.sepSh};background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font:600 15px var(--mono)`;
  const tilted = v.tiltValue > 5;
  const sc = a.scene;
  // same set and order as the reference dock: zoom, tilt, north, whole Earth, locate
  return (
    <div
      role="group"
      aria-label={t.camera.group}
      style={s(
        `position:absolute;left:${lay.camL};right:${lay.camR};top:${lay.camT};bottom:${lay.camB};width:${lay.camW};transform:${lay.camTf};pointer-events:auto;display:flex;flex-direction:${lay.camDir};${PANEL}`,
      )}
    >
      <button className="tw-hov" onClick={() => sc?.zoomBy?.(1)} aria-label={t.camera.zoomIn} title={`${t.camera.zoomIn} (+)`} style={s(btn)}>
        <Icon.zoomIn size={16} strokeWidth={2.25} aria-hidden />
      </button>
      <button className="tw-hov" onClick={() => sc?.zoomBy?.(-1)} aria-label={t.camera.zoomOut} title={`${t.camera.zoomOut} (-)`} style={s(btn)}>
        <Icon.zoomOut size={16} strokeWidth={2.25} aria-hidden />
      </button>
      <button
        className="tw-hov"
        onClick={() => sc?.toggleTilt?.()}
        disabled={v.tiltOff}
        aria-pressed={tilted}
        aria-label={tilted ? t.camera.tiltFlat : t.camera.tiltToggle}
        title={v.tiltOff ? t.camera.tiltOff : tilted ? t.camera.tiltFlat : t.camera.tiltToggle}
        style={s(btn)}
      >
        <span aria-hidden="true">3D</span>
      </button>
      <button
        className="tw-hov"
        onClick={() => sc?.resetNorth?.()}
        aria-label={t.camera.northUp}
        title={t.camera.northUp}
        style={s(`height:${lay.hit};border:0;box-shadow:${lay.sepSh};background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center`)}
      >
        <span
          style={s(
            `display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:13px solid var(--acc-fg);transform:rotate(${v.northDeg}deg)`,
          )}
        />
      </button>
      <button className="tw-hov" onClick={a.toOrbit} aria-label={t.camera.reset} title={`${t.camera.reset} (O)`} style={s(btn)}>
        <Icon.earth size={16} strokeWidth={2.25} aria-hidden />
      </button>
      <button className="tw-hov" onClick={a.locateMe} aria-label={t.camera.locate} title={t.camera.locate} style={s(btn)}>
        <Icon.inspect size={16} strokeWidth={2.25} aria-hidden />
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
            <span style={s("font:600 13px var(--mono)")}>
              {v.valueText || (v.areaValueHint ? "—" : "")}
            </span>
            <span style={s(`width:48px;height:8px;background:${leg.grad}`)} />
          </button>
        )}
        {v.mOpenOrDesk && (
          <>
            <div role="tablist" style={s("display:flex;align-items:stretch;flex:none")}>
              {v.railsOn ? (
                <span style={s("flex:1;display:flex;align-items:center;padding:0 12px;font:12px var(--sans)")}>{v.railTitle}</span>
              ) : v.cardOpen ? (
                <>
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
                </>
              ) : null}
              <button
                className="tw-hov"
                onClick={() => (v.railsOn ? a.set({ railR: "" }) : v.isM ? a.set({ sheet: !a.state.sheet }) : a.set({ ficha: !a.state.ficha }))}
                aria-expanded={v.cardOpen}
                aria-label={v.railsOn ? t.card.close : v.cardToggleText}
                title={v.railsOn ? t.card.close : v.cardToggleText}
                style={s(`margin-left:auto;width:${lay.hit};height:${lay.hit};border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center`)}
              >
                {v.railsOn ? <Icon.close size={16} strokeWidth={2.25} aria-hidden /> : v.cardToggleGlyph}
              </button>
            </div>
            {v.cardOpen && !v.legendOn && <Facts v={v} a={a} />}
            {v.cardOpen && !v.legendOn && (
              <div
                role="tabpanel"
                style={s("overflow-x:hidden;overflow-y:auto;padding:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px;min-height:0")}
              >
                {v.isInspect && <InspectBody v={v} />}
                {v.isTabArea && (
                  <>
                    <div>
                      <div style={s("font:11px var(--mono);color:var(--fg2)")}>{v.boundsText}</div>
                      {v.areaSurface ? <div style={s("font:11px var(--mono);color:var(--fg2)")}>{v.areaSurface}</div> : null}
                    </div>
                    {v.passRows.length > 0 && (
                      <div style={s("display:flex;flex-direction:column;gap:4px;font:11px var(--mono);color:var(--fg2)")}>
                        {v.passRows.map((p) => <div key={p.id}>{p.line}</div>)}
                      </div>
                    )}
                    {v.passesPending ? <div style={s("font:12px var(--sans);color:var(--fg2)")}>{t.nisar.pending}</div> : null}
                    <div>
                      {v.noSeries ? (
                        <div style={s("font:12px var(--sans);color:var(--fg2);margin-top:4px;text-wrap:pretty")}>{t.card.noSeries}</div>
                      ) : v.areaValueHint ? (
                        <div style={s("font:12px var(--sans);color:var(--fg2);margin-top:4px;text-wrap:pretty")}>{v.areaValueHint}</div>
                      ) : (
                        <>
                          <div style={s("font:11px var(--mono);color:var(--fg3);margin-top:4px")}>{v.areaValueLabel}</div>
                          <div style={s("font:600 20px/1.3 var(--mono)")}>{v.valueText}</div>
                          {v.areaShowDelta && v.deltaText && (
                            <div style={s("font:12px var(--sans);color:var(--fg2)")}>{v.deltaText}</div>
                          )}
                        </>
                      )}
                    </div>
                    {!v.noSeries && (
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
                    )}
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
                    {v.sourcesAviso ? (
                      <div style={s("font:12px var(--sans);color:var(--warn);text-wrap:pretty")}>{v.sourcesAviso}</div>
                    ) : null}
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
                          {g.selectedNotes.map((item) => <div key={item.key} style={s("font:12px var(--sans);color:var(--fg2);text-wrap:pretty")}>{item.name}: {item.description}</div>)}
                        </div>
                        <div style={s("font:11px var(--mono);color:var(--fg3)")}>
                          {g.count}
                          {g.fromCache ? ` · ${t.sources.fromCache}` : ""}
                        </div>
                        <div style={s("display:flex;flex-direction:column;gap:2px;font:11px var(--mono)")}>
                          <span style={s("color:var(--fg3)")}>{t.sources.tried}</span>
                          {g.tried.map((x) => (
                            <div key={x.key} style={s("display:flex;flex-direction:column;gap:2px")}>
                              <span style={s(`display:flex;gap:6px;color:${x.ok ? "var(--fg2)" : "var(--warn)"}`)}>
                                <span style={s("flex:1;min-width:0")}>{x.name}</span>
                                <span>{x.note}</span>
                              </span>
                              {x.hint ? (
                                <span style={s("font:11px var(--sans);color:var(--fg3);text-wrap:pretty")}>{x.hint}</span>
                              ) : null}
                            </div>
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
                          key={tr.id}
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
          <div style={s("display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:var(--fg2)")}>
            <span style={s("font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--fg3)")}>
              {t.legend.title}
            </span>
            <span style={s(`font:11px var(--mono);${leg.example ? "white-space:normal;text-align:right" : "white-space:nowrap"}`)}>
              {leg.example ? leg.caption : `${leg.label} · ${leg.unit}`}
            </span>
          </div>
          <div style={s(`height:10px;background:${leg.grad}`)} />
          {!leg.example && (
            <div style={s("display:flex;justify-content:space-between;font:11px var(--mono)")}>
              <span>{leg.min}</span>
              <span>{leg.max}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Same four facts on every inspector tab: what, where, when, and how far to trust it.
function Facts({ v, a }: { v: View; a: App }): React.ReactElement | null {
  const c = hudCopy(a.state.lang);
  const on = v.layerItems.find((l) => l.on);
  const honesty = v.leg.example ? v.t.honesty.example : on?.honestyLabel ?? "";
  if (!v.layerName && !v.areaName) return null;
  return (
    <dl className="tw-facts">
      {v.layerName && (<><dt>{c.facts.what}</dt><dd>{v.layerName}</dd></>)}
      {v.areaName && (<><dt>{c.facts.where}</dt><dd>{v.areaName}</dd></>)}
      {v.momentName && (<><dt>{c.facts.when}</dt><dd>{v.momentName}</dd></>)}
      {honesty && (
        <><dt>{c.facts.honesty}</dt><dd style={s(`font:11px var(--mono);color:${v.leg.example ? "var(--tw-h-ejemplo)" : "var(--fg)"}`)}>{honesty}</dd></>
      )}
    </dl>
  );
}

function LangSwitch({ v, a }: { v: View; a: App }): React.ReactElement {
  const { t } = v;
  const lang = a.state.lang;
  return (
    <div role="group" aria-label={t.lang.label} style={s("display:flex;align-items:center")}>
      <button type="button" className="tw-hov tw-top-btn" lang="en" aria-pressed={lang === "en"} onClick={() => a.setLang("en")}>
        {t.lang.en}
      </button>
      <button type="button" className="tw-hov tw-top-btn" lang="es" aria-pressed={lang === "es"} onClick={() => a.setLang("es")} style={s("margin-left:-1px")}>
        {t.lang.es}
      </button>
    </div>
  );
}
