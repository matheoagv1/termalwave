import React from "react";
import type { App } from "../app/App";
import { useLang } from "../app/i18n";
import type { SearchResult } from "../tw/contract";
import { readIntroPrefs, writeIntroPrefs } from "./intro-prefs";
import { setupCopy } from "./setup/copy";
import { MISSIONS, PLACES, type Mission, type SetupPlace, type SetupResult } from "./setup/missions";
import "./setup/setup.css";
import { Sfx } from "./sfx";

// layers drawn on the whole globe; the rest only exist where the dataset has frames
const GLOBAL_IDS = ["clouds", "firms", "wind"];
const FOCUSABLE = "button:not(:disabled),input:not(:disabled),[href]";

type P = {
  sound: boolean;
  reduced: boolean;
  onDone: (name: string, trade: string, setup?: SetupResult) => void;
  // optional so the overlay still mounts if the host passes nothing: search and the area name need it
  app?: App;
};

export function IntroOverlay({ sound, onDone, app }: P): React.ReactElement {
  const { lang, setLang, copy } = useLang();
  const c = setupCopy(lang);
  const [mission, setMission] = React.useState<Mission | null>(null);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[] | null>(null);
  const cardRef = React.useRef<HTMLElement>(null);
  const headRef = React.useRef<HTMLHeadingElement>(null);
  const ds = app?.state.ds ?? null;
  const step = mission ? 2 : 1;

  const ping = (): void => {
    if (sound) Sfx.step();
  };

  // Skipping keeps whatever was chosen before and changes nothing on the globe.
  const skip = React.useCallback((): void => {
    const p = readIntroPrefs();
    writeIntroPrefs({ done: true });
    onDone(p.name, p.trade);
  }, [onDone]);

  const finish = (m: Mission, place?: SetupPlace): void => {
    const p = readIntroPrefs();
    const trade = m.topic || p.trade;
    const known = ds ? [...GLOBAL_IDS, ...ds.layers.map((l) => l.id)] : null;
    const extras = m.id === "explore" ? undefined : m.extras.filter((id) => !known || known.includes(id));
    writeIntroPrefs({ done: true, trade });
    if (sound) Sfx.ok();
    onDone(p.name, trade, { extras, place });
  };

  const pick = (m: Mission): void => {
    ping();
    if (m.id === "explore") finish(m);
    else setMission(m);
  };

  // each step starts at its heading so a screen reader hears the new question
  React.useEffect(() => {
    headRef.current?.focus();
  }, [step]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        skip();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const els = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      const cur = document.activeElement as HTMLElement | null;
      const inside = !!cur && card.contains(cur);
      if (e.shiftKey && (!inside || cur === first || cur === headRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || cur === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [skip]);

  React.useEffect(() => {
    const text = q.trim();
    if (!text) {
      setResults(null);
      return;
    }
    let live = true;
    const id = window.setTimeout(async () => {
      const r = app?.provider ? await app.provider.search(text).catch(() => []) : [];
      if (live) setResults(r);
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [q, app]);

  const tag = (m: Mission): React.ReactNode => {
    // a mock dataset means the radar frames themselves are example data
    const h = m.id === "cambio" && ds?.isMock ? "example" : m.honesty;
    return h ? <span className={`tw-setup-tag tw-setup-tag-${h}`}>{c.tags[h]}</span> : null;
  };


  return (
    <div className="tw-setup" role="dialog" aria-modal="true" aria-labelledby="tw-setup-h" aria-describedby="tw-setup-lead">
      <div className="tw-setup-scrim" />
      <section ref={cardRef} className="tw-setup-card">
        <header className="tw-setup-head">
          <div>
            <span className="tw-setup-kicker">{c.kicker}</span>
            <span className="tw-setup-step">{c.step(step, 2)}</span>
          </div>
          <div className="tw-setup-lang" role="group" aria-label={copy.lang.label}>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>{copy.lang.en}</button>
            <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>{copy.lang.es}</button>
          </div>
        </header>
        <h2 id="tw-setup-h" ref={headRef} tabIndex={-1}>{mission ? c.h2 : c.h1}</h2>
        <p id="tw-setup-lead" className="tw-setup-lead">
          {mission ? c.lead2(c.missions[mission.id].title) : c.lead}
        </p>

        {!mission && (
          <div className="tw-setup-body">
            <div className="tw-setup-label" id="tw-setup-topics">{c.pickTopic}</div>
            <div className="tw-setup-list" role="group" aria-labelledby="tw-setup-topics">
              {MISSIONS.map((m) => {
                const mc = c.missions[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`tw-setup-tile${m.id === "explore" ? " tw-setup-tile-plain" : ""}`}
                    onClick={() => pick(m)}
                  >
                    <span className="tw-setup-glyph" aria-hidden="true">{m.glyph}</span>
                    <span className="tw-setup-tile-text">
                      <span className="tw-setup-tile-title">{mc.title}{tag(m)}</span>
                      <span className="tw-setup-tile-sub">{mc.sub}</span>
                      {mc.on && <span className="tw-setup-tile-on">{c.turnsOn}: {mc.on}</span>}
                    </span>
                    <span className="tw-setup-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
            <p className="tw-setup-note">{c.radarAlways} {c.nisar2025}</p>
          </div>
        )}

        {mission && (
          <div className="tw-setup-body">
            <div className="tw-setup-label">{c.demoArea}</div>
            <div className="tw-setup-list">
              <button type="button" className="tw-setup-tile" onClick={() => finish(mission, "area")}>
                <span className="tw-setup-glyph" aria-hidden="true">◎</span>
                <span className="tw-setup-tile-text">
                  <span className="tw-setup-tile-title">
                    {ds?.area.name ?? c.demoArea}
                    <span className="tw-setup-tag tw-setup-tag-measured">{c.radarTag}</span>
                    {ds?.isMock && <span className="tw-setup-tag tw-setup-tag-example">{c.tags.example}</span>}
                  </span>
                  <span className="tw-setup-tile-sub">{ds?.isMock ? c.demoSubMock : c.demoSub}</span>
                </span>
                <span className="tw-setup-arrow" aria-hidden="true">→</span>
              </button>
            </div>

            <div className="tw-setup-label" id="tw-setup-places">{c.examples}</div>
            <div className="tw-setup-list" role="group" aria-labelledby="tw-setup-places">
              {PLACES.map((p) => {
                const pc = c.places[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="tw-setup-tile"
                    onClick={() => finish(mission, { kind: "coords", label: pc.label, lonlat: p.lonlat })}
                  >
                    <span className="tw-setup-glyph" aria-hidden="true">·</span>
                    <span className="tw-setup-tile-text">
                      <span className="tw-setup-tile-title">{pc.label}</span>
                      <span className="tw-setup-tile-sub">{pc.sub}</span>
                    </span>
                    <span className="tw-setup-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
            <p className="tw-setup-note">{c.examplesNote}</p>

            <label className="tw-setup-label" htmlFor="tw-setup-q" style={{ display: "block" }}>{c.search}</label>
            <input
              id="tw-setup-q"
              className="tw-setup-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                const first = results?.[0];
                if (e.key === "Enter" && first) finish(mission, first);
              }}
              placeholder={c.searchPh}
              autoComplete="off"
            />
            <div className="tw-setup-list" style={{ marginTop: 6 }}>
              {(results ?? []).slice(0, 4).map((r, i) => (
                <button key={`${r.label}-${i}`} type="button" className="tw-setup-tile" onClick={() => finish(mission, r)}>
                  <span className="tw-setup-glyph" aria-hidden="true">·</span>
                  <span className="tw-setup-tile-text">
                    <span className="tw-setup-tile-title">{r.label}</span>
                  </span>
                  <span className="tw-setup-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
            <p className="tw-setup-note" role="status">
              {results && results.length === 0 ? (ds ? c.searchNone : c.searchWait) : ""}
            </p>

            <div className="tw-setup-next">
              <strong>{c.next}</strong>
              <ul>
                <li>{c.nextTimeline}</li>
                <li>{c.nextLayers}</li>
              </ul>
            </div>
            <p className="tw-setup-note">{c.nisar2025}</p>
          </div>
        )}

        <div className="tw-setup-foot">
          {mission ? (
            <button type="button" className="tw-setup-btn" onClick={() => { ping(); setMission(null); }}>
              ← {c.back}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="tw-setup-btn" onClick={skip}>
            {c.skip}
            <span className="tw-setup-key" aria-hidden="true">{c.skipKey}</span>
          </button>
        </div>
        <p className="tw-setup-status">{c.tip}</p>
      </section>
    </div>
  );
}
