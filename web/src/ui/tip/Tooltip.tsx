import React from "react";
import { createPortal } from "react-dom";
import "./tip.css";

// The HUD tooltip: `Overlay` places a box next to an anchor, `TipBox` draws it,
// `Tooltip` wraps one control. The look is in tip.css. No arrow: the edge that
// faces the control is tinted instead.

const VIEWPORT_PAD = 8;

export type TipPosition = "top" | "bottom" | "left" | "right";
type OverlayAlign = "center" | "start" | "end";

interface PlacementInfo {
  position: TipPosition;
  /** where the caret points along the box edge facing the anchor, in px from the box start */
  caretAt: string;
}

interface Placement extends PlacementInfo {
  top: number;
  left: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// everything is placed with top and left from the viewport origin. clientWidth
// and not innerWidth: the fixed box is not positioned against the scrollbar
function place(anchor: DOMRect, box: { width: number; height: number }, position: TipPosition, align: OverlayAlign, gap: number): Placement {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = box.width;
  const h = box.height;
  const avail = { top: anchor.top, bottom: vh - anchor.bottom, left: anchor.left, right: vw - anchor.right };
  // only flip when the preferred side has no room and the opposite side has
  // strictly more, so a box that fits in a crowded corner stays put
  if (position === "top" && avail.top < h + gap && avail.bottom > avail.top) return place(anchor, box, "bottom", align, gap);
  if (position === "bottom" && avail.bottom < h + gap && avail.top > avail.bottom) return place(anchor, box, "top", align, gap);
  if (position === "left" && avail.left < w + gap && avail.right > avail.left) return place(anchor, box, "right", align, gap);
  if (position === "right" && avail.right < w + gap && avail.left > avail.right) return place(anchor, box, "left", align, gap);

  const horizontal = position === "top" || position === "bottom";
  const size = horizontal ? w : h;
  const a0 = horizontal ? anchor.left : anchor.top;
  const aSize = horizontal ? anchor.width : anchor.height;
  const limit = horizontal ? vw : vh;
  const ideal = align === "start" ? a0 : align === "end" ? a0 + aSize - size : a0 + aSize / 2 - size / 2;
  const along = clamp(ideal, VIEWPORT_PAD, limit - size - VIEWPORT_PAD);
  // the caret follows the anchor centre, not the box centre, so a box pushed
  // back from a screen edge still points at what it belongs to
  const caretAt = `${clamp(a0 + aSize / 2 - along, 12, size - 12)}px`;

  if (horizontal) {
    return { position, caretAt, left: along, top: position === "top" ? anchor.top - gap - h : anchor.bottom + gap };
  }
  return { position, caretAt, top: along, left: position === "left" ? anchor.left - gap - w : anchor.right + gap };
}

interface OverlayProps {
  open: boolean;
  /** the element the box hangs off. its rect is re-read on scroll and resize */
  anchor: HTMLElement | null;
  position: TipPosition;
  align?: OverlayAlign;
  /** id of the portalled box, so aria-describedby on the anchor resolves */
  id?: string;
  /** px between anchor and box */
  gap?: number;
  /** portal host. the theme tokens sit on a div, not on the body */
  container?: HTMLElement | null;
  children: React.ReactNode | ((p: PlacementInfo) => React.ReactNode);
}

export const Overlay: React.FC<OverlayProps> = ({ open, anchor, position, align = "center", id, gap = 8, container, children }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = React.useState<Placement | null>(null);
  const live = open && anchor;

  // the size is only known once the box is in the dom, so the first render is
  // invisible and this effect places it before the browser paints
  React.useLayoutEffect(() => {
    if (!live) {
      setPlaced(null);
      return;
    }
    const measure = (): void => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const next = place(anchor.getBoundingClientRect(), { width: r.width, height: r.height }, position, align, gap);
      setPlaced((p) => (p && p.top === next.top && p.left === next.left && p.position === next.position && p.caretAt === next.caretAt ? p : next));
    };
    measure();
    addEventListener("scroll", measure, true);
    addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => {
      removeEventListener("scroll", measure, true);
      removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [live, anchor, position, align, gap]);

  if (!live) return null;

  return createPortal(
    // max-content keeps the width independent of where the box lands, or a box
    // near the right edge would wrap, change size and be placed again
    <span
      id={id}
      ref={ref}
      className="tw-tip-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "max-content",
        maxWidth: `calc(100vw - ${2 * VIEWPORT_PAD}px)`,
        // above rails (24), the old tip layer (60) and dialogs
        zIndex: 300,
        transform: placed ? `translate(${Math.round(placed.left)}px, ${Math.round(placed.top)}px)` : undefined,
        opacity: placed ? 1 : 0,
        boxSizing: "border-box",
      }}
    >
      {typeof children === "function" ? (placed ? children(placed) : children({ position, caretAt: "50%" })) : children}
    </span>,
    container ?? document.body,
  );
};

/** The tooltip box. `hint` is a second, dimmer line; `keys` a shortcut keycap. */
export function TipBox({ p, content, hint, keys }: { p: PlacementInfo; content: string; hint?: string; keys?: string }): React.ReactElement {
  return (
    <span role="tooltip" className="tw-tip" data-side={p.position}>
      {content}
      {keys && <span className="tw-tip-key">{keys}</span>}
      {hint && <span className="tw-tip-hint">{hint}</span>}
    </span>
  );
}

type TooltipAnchorProps = {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  [key: string]: unknown;
};

export interface TooltipProps {
  content: string;
  children: React.ReactElement<TooltipAnchorProps>;
  position?: TipPosition;
  /** optional second line */
  hint?: string;
}

const themeHost = (el: HTMLElement | null): HTMLElement | null => (el?.closest("[data-tw-theme]") as HTMLElement | null) ?? null;

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top", hint }) => {
  const [visible, setVisible] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const id = React.useId();
  // chain the anchor's own handlers instead of clobbering them
  const anchor = children.props as unknown as {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    disabled?: boolean;
  };
  const show = (el: HTMLElement): void => {
    setAnchorEl(el);
    setVisible(true);
  };
  const tip = (p: PlacementInfo): React.ReactNode => <TipBox p={p} content={content} hint={hint} />;
  const overlay = (
    <Overlay open={visible} anchor={anchorEl} position={position} id={id} container={themeHost(anchorEl)}>
      {tip}
    </Overlay>
  );

  // a disabled button fires no mouse events, so the wrapper owns the hover
  // handlers: the tip is what explains why the control is disabled
  if (anchor.disabled) {
    return (
      <span style={{ display: "inline-flex" }}>
        <span
          aria-describedby={id}
          onMouseEnter={(e) => {
            anchor.onMouseEnter?.(e);
            show(e.currentTarget);
          }}
          onMouseLeave={(e) => {
            anchor.onMouseLeave?.(e);
            setVisible(false);
          }}
          style={{ display: "inline-flex" }}
        >
          {children}
        </span>
        {overlay}
      </span>
    );
  }

  return (
    // display contents: the wrapper only holds the portal in the tree
    <span style={{ display: "contents" }}>
      {React.cloneElement(children, {
        "aria-describedby": id,
        onMouseEnter: (e: React.MouseEvent) => {
          anchor.onMouseEnter?.(e);
          show(e.currentTarget as HTMLElement);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          anchor.onMouseLeave?.(e);
          setVisible(false);
        },
        onFocus: (e: React.FocusEvent) => {
          anchor.onFocus?.(e);
          show(e.currentTarget as HTMLElement);
        },
        onBlur: (e: React.FocusEvent) => {
          anchor.onBlur?.(e);
          setVisible(false);
        },
      })}
      {overlay}
    </span>
  );
};
