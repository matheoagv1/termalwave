import React from "react";
import { s } from "../app/css";

type Tip = { text: string; x: number; top: number; below: boolean; k: number };

const HOLD_MS = 3000;
const TOUCH_HOLD_MS = 450;

// Tooltips propios: globo pixel art + barra que se llena en 3 segundos.
// Si el usuario sigue leyendo al llegar, se pide al mago una explicacion larga.
export function TipLayer({ onLong }: { onLong: (tip: string) => void }): React.ReactElement | null {
  const [tip, setTip] = React.useState<Tip | null>(null);
  const cur = React.useRef<{ el: HTMLElement; timer: number } | null>(null);
  const seq = React.useRef(0);
  const touchT = React.useRef(0);
  const cb = React.useRef(onLong);
  cb.current = onLong;

  React.useEffect(() => {
    const find = (t: EventTarget | null): HTMLElement | null =>
      t instanceof Element ? (t.closest("[title],[data-tw-tip]") as HTMLElement | null) : null;

    const hide = (): void => {
      const c = cur.current;
      if (c) window.clearTimeout(c.timer);
      cur.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement): void => {
      if (cur.current?.el === el) return;
      hide();
      const text = el.getAttribute("title") || el.getAttribute("data-tw-tip") || "";
      if (!text) return;
      if (el.hasAttribute("title")) {
        el.setAttribute("data-tw-tip", text);
        el.removeAttribute("title");
        if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", text);
      }
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      setTip({ text, x: r.left + r.width / 2, top: below ? r.bottom + 8 : r.top - 8, below, k: ++seq.current });
      const timer = window.setTimeout(() => {
        cur.current = null;
        setTip(null);
        cb.current(text);
      }, HOLD_MS);
      cur.current = { el, timer };
    };

    const over = (e: PointerEvent): void => {
      if (e.pointerType === "touch") return;
      const el = find(e.target);
      if (el) show(el);
    };
    const out = (e: PointerEvent): void => {
      const c = cur.current;
      if (!c) return;
      const to = e.relatedTarget;
      if (to instanceof Node && c.el.contains(to)) return;
      hide();
    };
    const focusIn = (e: FocusEvent): void => {
      const el = find(e.target);
      if (el && el.matches(":focus-visible")) show(el);
    };
    const down = (e: PointerEvent): void => {
      if (e.pointerType !== "touch") return;
      const el = find(e.target);
      if (!el) return;
      window.clearTimeout(touchT.current);
      touchT.current = window.setTimeout(() => show(el), TOUCH_HOLD_MS);
    };
    const up = (): void => {
      window.clearTimeout(touchT.current);
      if (cur.current) hide();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("keydown", key);
      hide();
    };
  }, []);

  if (!tip) return null;
  const w = typeof window === "undefined" ? 800 : window.innerWidth;
  const half = Math.min(150, (w - 16) / 2);
  const left = Math.max(8 + half, Math.min(w - 8 - half, tip.x));
  return (
    <div
      role="tooltip"
      style={s(
        `position:fixed;left:${left}px;top:${tip.top}px;transform:translate(-50%,${tip.below ? "0" : "-100%"});width:max-content;max-width:${half * 2}px;z-index:60;pointer-events:none;box-sizing:border-box;border:14px solid transparent;border-image:url(./ui/bubble.png) 44 fill / 14px stretch;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4));color:#0b1230`,
      )}
    >
      <div style={s("font:12px/1.35 var(--sans);color:#0b1230;text-wrap:pretty;margin:-4px 0 6px")}>{tip.text}</div>
      <div style={s("height:8px;border:2px solid #14257a;background:#fff4cf;box-sizing:border-box;overflow:hidden;margin:0 0 -4px")}>
        <div key={tip.k} className="tw-tipbar" style={s(`height:100%;background:#f5c400;animation:tw-tipfill ${HOLD_MS}ms steps(12,end) forwards`)} />
      </div>
    </div>
  );
}