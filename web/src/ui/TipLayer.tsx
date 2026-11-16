import React from "react";
import { Overlay, TipBox } from "./tip";
import type { TipPosition } from "./tip";

type Tip = { el: HTMLElement; text: string; keys: string; pos: TipPosition; host: HTMLElement | null };

const SHOW_MS = 350;
const HOLD_MS = 3000;
const TOUCH_HOLD_MS = 450;
const TIP_ID = "tw-tip";

// "Hide interface (H)" carries its shortcut at the end. Digits stay out so a
// count such as "Hotspots (12)" is not read as a key.
const KEY_RE = /\s*\(([A-Za-z?]|Space|Espacio|Esc|Enter|Intro|(?:Shift|Ctrl|Alt)\+\S{1,6})\)\s*$/;
const POSITIONS: readonly string[] = ["top", "bottom", "left", "right"];

// Thin wrapper over the anto-ui Tooltip port: every `title` or `data-tw-tip` in
// the HUD becomes one shared tooltip, so call sites keep their plain attributes.
// If the user keeps reading for 3 seconds, the wizard gets the long explanation.
export function TipLayer({ onLong }: { onLong: (tip: string) => void }): React.ReactElement | null {
  const [tip, setTip] = React.useState<Tip | null>(null);
  const cur = React.useRef<{ el: HTMLElement; wait: number; hold: number; described: string | null } | null>(null);
  const touchT = React.useRef(0);
  const lastTouch = React.useRef(0);
  const lastShown = React.useRef(0);
  const cb = React.useRef(onLong);
  cb.current = onLong;

  React.useEffect(() => {
    const find = (t: EventTarget | null): HTMLElement | null =>
      t instanceof Element ? (t.closest("[title],[data-tw-tip]") as HTMLElement | null) : null;

    const hide = (): void => {
      const c = cur.current;
      if (!c) return;
      window.clearTimeout(c.wait);
      window.clearTimeout(c.hold);
      if (c.el.getAttribute("aria-describedby") === TIP_ID) {
        if (c.described) c.el.setAttribute("aria-describedby", c.described);
        else c.el.removeAttribute("aria-describedby");
        lastShown.current = Date.now();
      }
      cur.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement, delay: number): void => {
      if (cur.current?.el === el) return;
      hide();
      const raw = el.getAttribute("title") || el.getAttribute("data-tw-tip") || "";
      if (!raw) return;
      // the native title would draw a second tooltip on top of this one
      if (el.hasAttribute("title")) {
        el.setAttribute("data-tw-tip", raw);
        el.removeAttribute("title");
        if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", raw);
      }
      const m = KEY_RE.exec(raw);
      const text = m ? raw.slice(0, m.index) : raw;
      const keys = el.getAttribute("data-tw-tip-key") || (m ? m[1] : "");
      const want = el.getAttribute("data-tw-tip-pos") || "top";
      const pos = (POSITIONS.includes(want) ? want : "top") as TipPosition;
      const open = (): void => {
        const c = cur.current;
        if (!c || c.el !== el) return;
        if (!el.isConnected) return hide();
        c.described = el.getAttribute("aria-describedby");
        el.setAttribute("aria-describedby", TIP_ID);
        setTip({ el, text, keys, pos, host: el.closest("[data-tw-theme]") as HTMLElement | null });
        c.hold = window.setTimeout(() => {
          hide();
          cb.current(raw);
        }, HOLD_MS);
      };
      // moving from one control to the next should not wait again
      const wait = Date.now() - lastShown.current < 400 ? 0 : delay;
      cur.current = { el, wait: 0, hold: 0, described: null };
      if (wait > 0) cur.current.wait = window.setTimeout(open, wait);
      else open();
    };

    const over = (e: PointerEvent): void => {
      if (e.pointerType === "touch") return;
      const el = find(e.target);
      if (el) show(el, SHOW_MS);
    };
    const out = (e: PointerEvent): void => {
      const c = cur.current;
      if (!c) return;
      const to = e.relatedTarget;
      if (to instanceof Node && c.el.contains(to)) return;
      hide();
    };
    const move = (): void => {
      // a control that unmounts under the pointer fires no pointerout
      if (cur.current && !cur.current.el.isConnected) hide();
    };
    const focusIn = (e: FocusEvent): void => {
      // a tap focuses the control too; without this the tip would stay open
      if (Date.now() - lastTouch.current < 800) return;
      const el = find(e.target);
      if (el && el.matches(":focus-visible")) show(el, 0);
    };
    const down = (e: PointerEvent): void => {
      window.clearTimeout(touchT.current);
      if (e.pointerType !== "touch") return hide();
      lastTouch.current = Date.now();
      hide();
      const el = find(e.target);
      if (!el) return;
      touchT.current = window.setTimeout(() => show(el, 0), TOUCH_HOLD_MS);
    };
    const up = (e: PointerEvent): void => {
      window.clearTimeout(touchT.current);
      if (e.pointerType !== "touch") return;
      lastTouch.current = Date.now();
      hide();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") hide();
    };
    const gone = (): void => {
      window.clearTimeout(touchT.current);
      hide();
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", gone, { capture: true, passive: true });
    document.addEventListener("wheel", gone, { capture: true, passive: true });
    window.addEventListener("blur", gone);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("keydown", key);
      document.removeEventListener("scroll", gone, { capture: true });
      document.removeEventListener("wheel", gone, { capture: true });
      window.removeEventListener("blur", gone);
      gone();
    };
  }, []);

  return (
    <Overlay open={!!tip} anchor={tip?.el ?? null} position={tip?.pos ?? "top"} id={TIP_ID} container={tip?.host}>
      {(p) => (tip ? <TipBox p={p} content={tip.text} keys={tip.keys} /> : null)}
    </Overlay>
  );
}
