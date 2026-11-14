// src/components.tsx
import React2 from "react";
import { createPortal } from "react-dom";

// src/haptics.ts
var enabled = true;
function setHapticsEnabled(value) {
  enabled = value;
}
function hapticsEnabled() {
  return enabled;
}
var PATTERNS = {
  tap: 10,
  toggle: 8,
  confirm: [10, 40, 10],
  error: [15, 60, 15, 60, 15]
};
function registerHapticPattern(name, pattern) {
  PATTERNS[name] = pattern;
}
function haptic(pattern = "tap") {
  if (!enabled) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const resolved = typeof pattern === "string" ? PATTERNS[pattern] ?? PATTERNS.tap : pattern;
  try {
    navigator.vibrate(resolved);
  } catch {
  }
}

// src/hooks.ts
import * as React from "react";
function useStore(store) {
  return React.useSyncExternalStore(store.subscribe, store.get, store.get);
}
function useInterval(fn, ms) {
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
function useNow(intervalMs = 3e4) {
  const [now, setNow] = React.useState(() => Date.now());
  useInterval(() => setNow(Date.now()), intervalMs);
  return now;
}
function useAsync(load, deps) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    let live = true;
    setLoading(true);
    loadRef.current().then((res) => {
      if (live) {
        setData(res);
        setError(false);
      }
    }).catch(() => {
      if (live) setError(true);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [...deps, nonce]);
  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
function useClickOutside(ref, onOutside) {
  const cb = React.useRef(onOutside);
  cb.current = onOutside;
  React.useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (!target || !(target instanceof Node)) return;
      if (!ref.current?.contains(target)) cb.current();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref]);
}
function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(() => queryMatches(query));
  React.useEffect(() => {
    const mql = getQueryList(query);
    if (!mql) return;
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
function queryMatches(query) {
  return getQueryList(query)?.matches ?? false;
}
function getQueryList(query) {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia(query);
  }
  const g = globalThis;
  if (typeof g.matchMedia === "function") return g.matchMedia(query);
  return null;
}
function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

// src/css.ts
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function toHex(color) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = "#000000";
  ctx.fillStyle = color;
  const resolved = ctx.fillStyle;
  return typeof resolved === "string" && resolved.startsWith("#") ? resolved : "#000000";
}
function parseHex(hex) {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}
function readableOn(hex) {
  const rgb = parseHex(hex ?? "");
  if (!rgb) return "#fff";
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#000" : "#fff";
}
function resolveColor(value, fallback) {
  if (value) {
    if (!value.startsWith("var(")) return value;
    const resolved = cssVar(value.slice(4).replace(")", "").trim());
    if (resolved) return resolved;
  }
  return fallback;
}

// src/components.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var SIZE_PAD = {
  sm: "var(--space-1) var(--space-2)",
  md: "var(--space-2) var(--space-3)",
  lg: "var(--space-3) var(--space-4)"
};
var SIZE_FONT = {
  sm: "var(--text-xs)",
  md: "var(--text-sm)",
  lg: "var(--text-base)"
};
function useFocusBorder(error) {
  const [focused, setFocused] = React2.useState(false);
  return {
    borderColor: error ? "var(--err)" : focused ? "var(--accent)" : "var(--border)",
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false)
  };
}
var textMono = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)"
};
var textMuted = {
  ...textMono,
  fontSize: "var(--text-xs)",
  color: "var(--text3)"
};
var textSecondary = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  color: "var(--text2)"
};
var srOnly = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};
var headingPage = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-lg)",
  fontWeight: 700,
  margin: 0
};
var headingSection = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  margin: "0 0 var(--space-2)"
};
var stack = (gap = "var(--space-4)") => ({
  display: "flex",
  flexDirection: "column",
  gap
});
var row = (gap = "var(--space-2)") => ({
  display: "flex",
  alignItems: "center",
  gap,
  flexWrap: "wrap"
});
var pageRoot = (maxWidth = "48rem") => ({
  ...stack("var(--space-5)"),
  maxWidth
});
var panel = (padding = "var(--panel-padding)") => ({
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  border: "var(--border-width) solid var(--border2)",
  borderRadius: "var(--radius-card)",
  padding
});
var flexItem = (opts) => ({
  flexGrow: opts?.grow ?? 0,
  flexShrink: opts?.shrink ?? 1,
  flexBasis: opts?.basis ?? "auto",
  minWidth: opts?.min ?? 0
});
var grid = (minItemWidth = "16rem", gap = "var(--space-4)") => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidth}), 1fr))`,
  gap
});
var sidebarLayout = (opts) => ({
  container: { display: "flex", flexWrap: "wrap", gap: opts?.gap ?? "var(--space-4)" },
  aside: { flexBasis: opts?.asideWidth ?? "16rem", flexGrow: 1 },
  main: { flexBasis: 0, flexGrow: 999, minWidth: opts?.stackBelow ?? "50%" }
});
var tableBase = {
  ...textMono,
  width: "100%",
  borderCollapse: "collapse"
};
var tableHeadCell = {
  padding: "var(--space-2)",
  borderBottom: "var(--border-width) solid var(--border)",
  color: "var(--text2)",
  fontWeight: 700,
  textAlign: "left",
  whiteSpace: "nowrap"
};
var tableHeadRow = {
  background: "var(--bg2)"
};
var tableRow = {
  borderBottom: "var(--border-width) solid var(--border2)"
};
var tableCell = {
  padding: "var(--space-2)",
  verticalAlign: "top"
};
var tableCellActions = {
  ...tableCell,
  textAlign: "right",
  whiteSpace: "nowrap"
};
var ICON_SIZE = {
  xs: "var(--text-xs)",
  sm: "var(--text-sm)",
  md: "var(--text-md)",
  lg: "var(--text-lg)",
  xl: "var(--text-xl)"
};
var iconGlyphs = null;
var iconFamily = null;
var iconListeners = /* @__PURE__ */ new Set();
function setIconSet(glyphs, fontFamily) {
  iconGlyphs = glyphs;
  iconFamily = glyphs ? fontFamily ?? null : null;
  iconListeners.forEach((fn) => fn());
}
var subscribeIcons = (fn) => {
  iconListeners.add(fn);
  return () => {
    iconListeners.delete(fn);
  };
};
var iconVersion = () => iconGlyphs;
var Icon = ({ name, size = "sm", style, ...aria }) => {
  const glyphs = React2.useSyncExternalStore(subscribeIcons, iconVersion, iconVersion);
  const glyph = glyphs?.[name];
  return /* @__PURE__ */ jsx(
    "span",
    {
      style: {
        fontFamily: glyph && iconFamily ? iconFamily : "var(--font-icon)",
        fontSize: ICON_SIZE[size],
        lineHeight: 1,
        display: "inline-block",
        fontStyle: "normal",
        fontWeight: "normal",
        ...style
      },
      "aria-hidden": aria["aria-hidden"] ?? true,
      "aria-label": aria["aria-label"],
      children: glyph ?? name
    }
  );
};
var Chevron = ({ dir, style }) => /* @__PURE__ */ jsx(Icon, { name: dir, size: "xs", "aria-hidden": "true", style: { color: "var(--text3)", flexShrink: 0, ...style } });
function rovingKey(e, idx, n, go, wrap = false) {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    go(wrap ? (idx + 1) % n : Math.min(n - 1, idx + 1));
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    go(wrap ? (idx - 1 + n) % n : Math.max(0, idx - 1));
  } else if (e.key === "Home") {
    e.preventDefault();
    go(0);
  } else if (e.key === "End") {
    e.preventDefault();
    go(n - 1);
  }
}
function useRoving(count, onPick, wrap = false) {
  const refs = React2.useRef([]);
  const pick = React2.useRef(onPick);
  pick.current = onPick;
  const move = React2.useCallback((next) => {
    pick.current(next);
    const el = refs.current[next];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);
  const onKeyDown = React2.useCallback((e, index) => {
    rovingKey(e, index, count, move, wrap);
  }, [count, move, wrap]);
  return { refs, onKeyDown, move };
}
function useDismiss(open, onClose, refs) {
  const seen = React2.useRef(refs);
  seen.current = refs;
  React2.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e) => {
      const t = e.target;
      if (seen.current.some((r) => r.current?.contains(t))) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);
}
var Spinner = () => {
  const [frame, setFrame] = React2.useState(0);
  React2.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 9), 100);
    return () => clearInterval(id);
  }, []);
  return /* @__PURE__ */ jsx(Icon, { name: `hourglass${frame}`, size: "sm", "aria-label": "loading", "aria-hidden": false });
};
var BTN_BASE = {
  fontFamily: "var(--font-ui)",
  border: "var(--border-width) solid",
  borderRadius: "var(--radius-btn)",
  boxShadow: "var(--elevation-1)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  lineHeight: "var(--leading-tight)",
  userSelect: "none",
  transition: "background var(--transition-base), color var(--transition-base), border-color var(--transition-base)"
};
var BTN_MIN_HEIGHT = {
  sm: "calc(var(--text-xs) * var(--leading-tight) + var(--space-1) * 2 + var(--border-width) * 2)",
  md: "calc(var(--text-sm) * var(--leading-tight) + var(--space-2) * 2 + var(--border-width) * 2)",
  lg: "calc(var(--text-base) * var(--leading-tight) + var(--space-3) * 2 + var(--border-width) * 2)"
};
var BTN_VAR = {
  primary: { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" },
  default: { background: "transparent", color: "var(--text)", borderColor: "var(--border)" },
  danger: { background: "transparent", color: "var(--err)", borderColor: "var(--err)" },
  ghost: { background: "transparent", color: "var(--text3)", borderColor: "var(--border2)" }
};
var BTN_HOVER = {
  primary: { background: "var(--accent2)", borderColor: "var(--accent2)" },
  default: { background: "var(--hover)", borderColor: "var(--border)" },
  danger: { background: "var(--hover)", borderColor: "var(--err)" },
  ghost: { background: "var(--hover)", borderColor: "var(--border2)" }
};
var Btn = ({
  children,
  variant = "default",
  size = "md",
  disabled,
  loading,
  onClick,
  type = "button",
  haptic: hapticOn = true,
  tip,
  tipPosition = "top",
  className,
  style,
  ...aria
}) => {
  const [hovered, setHovered] = React2.useState(false);
  const isDisabled = disabled || loading;
  const base = BTN_VAR[variant] ?? BTN_VAR.default;
  const varStyle = hovered && !isDisabled ? { ...base, ...BTN_HOVER[variant] ?? BTN_HOVER.default } : base;
  function handleClick(e) {
    if (hapticOn) haptic(variant === "danger" ? "error" : "tap");
    onClick?.(e);
  }
  const button = /* @__PURE__ */ jsxs(
    "button",
    {
      type,
      className,
      disabled: isDisabled,
      onClick: isDisabled ? void 0 : handleClick,
      "aria-label": aria["aria-label"],
      "aria-controls": aria["aria-controls"],
      "aria-expanded": aria["aria-expanded"],
      "aria-haspopup": aria["aria-haspopup"],
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        ...BTN_BASE,
        ...varStyle,
        fontSize: SIZE_FONT[size],
        padding: SIZE_PAD[size],
        minHeight: BTN_MIN_HEIGHT[size],
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.4 : 1,
        ...style
      },
      children: [
        loading && /* @__PURE__ */ jsx(Spinner, {}),
        children
      ]
    }
  );
  return tip ? /* @__PURE__ */ jsx(Tooltip, { content: tip, position: tipPosition, children: button }) : button;
};
var IconBtn = ({
  icon,
  label,
  onClick,
  active,
  expanded,
  controls,
  disabled,
  haptic: hapticOn = true,
  className,
  style
}) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    className,
    "aria-label": label,
    title: label,
    "aria-pressed": expanded === void 0 ? active : void 0,
    "aria-expanded": expanded,
    "aria-controls": controls,
    disabled,
    onClick: () => {
      if (hapticOn) haptic("tap");
      onClick?.();
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "var(--space-10)",
      height: "var(--space-10)",
      background: active ? "var(--accent)" : "transparent",
      border: "var(--border-width) solid transparent",
      borderColor: active ? "var(--accent)" : void 0,
      borderRadius: "var(--radius-btn)",
      color: active ? "var(--on-accent)" : "var(--text3)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0,
      transition: "background var(--transition-fast), color var(--transition-fast)",
      ...style
    },
    children: /* @__PURE__ */ jsx(Icon, { name: icon, size: "sm" })
  }
);
var Input = ({
  value,
  defaultValue,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  type = "text",
  disabled,
  error,
  size = "md",
  style,
  id,
  autoFocus,
  ...aria
}) => {
  const { borderColor, onFocus: onFocusBorder, onBlur } = useFocusBorder(error);
  const errId = React2.useId();
  const describedBy = [aria["aria-describedby"], error ? errId : ""].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "var(--space-1)" }, children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        id,
        type,
        value,
        defaultValue,
        placeholder,
        disabled,
        autoFocus,
        role: aria.role,
        "aria-label": aria["aria-label"],
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : void 0,
        "aria-expanded": aria["aria-expanded"],
        "aria-controls": aria["aria-controls"],
        "aria-autocomplete": aria["aria-autocomplete"],
        "aria-activedescendant": aria["aria-activedescendant"],
        onChange: onChange ? (e) => onChange(e.target.value, e) : void 0,
        onKeyDown,
        onFocus: () => {
          onFocusBorder();
          onFocus?.();
        },
        onBlur,
        style: {
          fontFamily: "var(--font-ui)",
          fontSize: SIZE_FONT[size],
          padding: SIZE_PAD[size],
          background: "var(--bg2)",
          color: "var(--text)",
          border: "var(--border-width) solid",
          borderColor,
          borderRadius: "var(--radius-input)",
          boxShadow: "var(--elevation-inset)",
          outline: "none",
          width: "100%",
          transition: "border-color var(--transition-base)",
          ...style
        }
      }
    ),
    error && /* @__PURE__ */ jsx(
      "span",
      {
        id: errId,
        role: "alert",
        style: { fontSize: "var(--text-xs)", color: "var(--err)", fontFamily: "var(--font-ui)" },
        children: error
      }
    )
  ] });
};
var Textarea = ({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 4,
  error,
  ...aria
}) => {
  const { borderColor, onFocus, onBlur } = useFocusBorder(error);
  return /* @__PURE__ */ jsx(
    "textarea",
    {
      value,
      placeholder,
      disabled,
      rows,
      "aria-label": aria["aria-label"],
      "aria-invalid": error ? true : void 0,
      onChange: onChange ? (e) => onChange(e.target.value, e) : void 0,
      onFocus,
      onBlur,
      style: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-sm)",
        padding: "var(--space-2)",
        background: "var(--bg2)",
        color: "var(--text)",
        border: "var(--border-width) solid",
        borderColor,
        borderRadius: "var(--radius-input)",
        boxShadow: "var(--elevation-inset)",
        outline: "none",
        width: "100%",
        resize: "vertical",
        lineHeight: "var(--leading-code)",
        transition: "border-color var(--transition-base)"
      }
    }
  );
};
var Select = ({
  value,
  onChange,
  options,
  disabled,
  size = "md",
  style,
  ...aria
}) => {
  const { borderColor, onFocus, onBlur } = useFocusBorder();
  const opts = options.map((o) => typeof o === "string" ? { value: o, label: o } : o);
  return /* @__PURE__ */ jsx(
    "select",
    {
      value,
      disabled,
      "aria-label": aria["aria-label"],
      onChange: onChange ? (e) => onChange(e.target.value, e) : void 0,
      onFocus,
      onBlur,
      style: {
        fontFamily: "var(--font-ui)",
        fontSize: SIZE_FONT[size],
        padding: SIZE_PAD[size],
        background: "var(--bg2)",
        color: "var(--text)",
        border: "var(--border-width) solid",
        borderColor,
        borderRadius: "var(--radius-input)",
        boxShadow: "var(--elevation-inset)",
        outline: "none",
        width: "100%",
        appearance: "none",
        transition: "border-color var(--transition-base)",
        ...style
      },
      children: opts.map((o) => /* @__PURE__ */ jsx("option", { value: o.value, children: o.label }, o.value))
    }
  );
};
var ToggleBase = ({ inputType, iconName, checked, onChange, label, disabled, name, value }) => /* @__PURE__ */ jsxs("label", { style: {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-2)",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  color: disabled ? "var(--text3)" : "var(--text)",
  userSelect: "none",
  opacity: disabled ? 0.5 : 1
}, children: [
  /* @__PURE__ */ jsx(
    "input",
    {
      type: inputType,
      checked,
      disabled,
      name,
      value,
      onChange: onChange ? (e) => {
        haptic("toggle");
        onChange(e.target.checked);
      } : void 0,
      style: { position: "absolute", opacity: 0, width: 0, height: 0 }
    }
  ),
  /* @__PURE__ */ jsx(Icon, { name: iconName, size: "sm", "aria-hidden": true }),
  label
] });
var Checkbox = ({ checked, onChange, label, disabled }) => /* @__PURE__ */ jsx(
  ToggleBase,
  {
    inputType: "checkbox",
    iconName: checked ? "checked" : "ballot",
    checked,
    onChange,
    label,
    disabled
  }
);
var Radio = ({ checked, onChange, label, disabled, name, value }) => /* @__PURE__ */ jsx(
  ToggleBase,
  {
    inputType: "radio",
    iconName: checked ? "true" : "false",
    checked,
    onChange,
    label,
    disabled,
    name,
    value
  }
);
var BADGE_STYLE = {
  muted: { color: "var(--text3)", borderColor: "var(--border2)" },
  accent: { color: "var(--accent)", borderColor: "var(--accent)" },
  ok: { color: "var(--ok)", borderColor: "var(--ok)" },
  warn: { color: "var(--warn)", borderColor: "var(--warn)" },
  err: { color: "var(--err)", borderColor: "var(--err)" }
};
var Badge = ({ children, variant = "muted" }) => /* @__PURE__ */ jsx("span", { style: {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-xs)",
  padding: "var(--space-1) var(--space-2)",
  border: "var(--border-width) solid",
  borderRadius: "var(--radius-tag)",
  display: "inline-block",
  lineHeight: "var(--leading-tight)",
  ...BADGE_STYLE[variant] ?? BADGE_STYLE.muted
}, children });
var TAG_STYLE = {
  gray: { background: "var(--bg3)", color: "var(--text2)" },
  accent: { background: "var(--accent)", color: "var(--on-accent)" },
  ok: { background: "var(--ok)", color: "var(--on-accent)" },
  warn: { background: "var(--warn)", color: "var(--on-accent)" },
  err: { background: "var(--err)", color: "var(--on-accent)" }
};
var Tag = ({ children, variant = "gray", onDismiss, ...aria }) => /* @__PURE__ */ jsxs("span", { style: {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-1)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-xs)",
  lineHeight: "var(--leading-tight)",
  padding: onDismiss ? "var(--space-1) var(--space-1) var(--space-1) var(--space-2)" : "var(--space-1) var(--space-2)",
  borderRadius: "var(--radius-tag)",
  ...TAG_STYLE[variant] ?? TAG_STYLE.gray
}, children: [
  children,
  onDismiss && /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: onDismiss,
      "aria-label": aria["aria-label"] ?? "remove",
      style: {
        fontFamily: "var(--font-icon)",
        fontSize: "var(--text-xs)",
        background: "none",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        padding: "var(--space-1)",
        display: "inline-flex",
        lineHeight: 1
      },
      children: "times"
    }
  )
] });
var ColorChip = ({ label, color }) => /* @__PURE__ */ jsx("span", { style: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "var(--space-8)",
  padding: "0 var(--space-1)",
  height: "var(--space-6)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  borderRadius: "var(--radius-sm)",
  flexShrink: 0,
  background: color,
  color: readableOn(color)
}, children: label });
var ToggleSwitch = ({ checked, onChange, label, disabled, size = "md", ...aria }) => {
  const w = size === "sm" ? "2rem" : "2.5rem";
  const h = size === "sm" ? "1.125rem" : "1.375rem";
  const knob = size === "sm" ? "0.75rem" : "0.9375rem";
  return /* @__PURE__ */ jsxs("label", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-sm)",
    color: disabled ? "var(--text3)" : "var(--text)",
    userSelect: "none",
    opacity: disabled ? 0.5 : 1
  }, children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "checkbox",
        role: "switch",
        checked,
        disabled,
        "aria-label": aria["aria-label"] ?? (typeof label === "string" ? label : void 0),
        onChange: onChange ? (e) => {
          haptic("toggle");
          onChange(e.target.checked);
        } : void 0,
        style: { position: "absolute", opacity: 0, width: 0, height: 0 }
      }
    ),
    /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
      width: w,
      height: h,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: checked ? "flex-end" : "flex-start",
      padding: "0.125rem",
      background: checked ? "var(--accent)" : "var(--bg3)",
      border: `var(--border-width) solid ${checked ? "var(--accent)" : "var(--border)"}`,
      borderRadius: "var(--radius-pill)",
      transition: "background var(--transition-base), border-color var(--transition-base)"
    }, children: /* @__PURE__ */ jsx("span", { style: {
      width: knob,
      height: knob,
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--on-accent)" : "var(--text3)",
      transition: "background var(--transition-base)"
    } }) }),
    label
  ] });
};
var ProgressBar = ({ value, label, showValue = false, color = "var(--accent)", ...aria }) => {
  const indeterminate = value === void 0;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }, children: [
    (label || showValue) && /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-xs)",
      color: "var(--text3)"
    }, children: [
      /* @__PURE__ */ jsx("span", { children: label }),
      showValue && !indeterminate && /* @__PURE__ */ jsxs("span", { children: [
        Math.round(clamped),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "progressbar",
        "aria-label": aria["aria-label"],
        "aria-valuenow": indeterminate ? void 0 : Math.round(clamped),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        style: { height: "var(--space-2)", background: "var(--bg3)", borderRadius: "var(--radius-pill)", overflow: "hidden" },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: indeterminate ? "anto-progress-indeterminate" : void 0,
            style: {
              height: "100%",
              background: color,
              borderRadius: "var(--radius-pill)",
              // no width transition: the motion rule allows background/color/
              // border-color/opacity to animate, never width or height, no
              // exceptions, so the bar jumps to each new value instead
              width: indeterminate ? "100%" : `${clamped}%`
            }
          }
        )
      }
    )
  ] });
};
var Skeleton = ({ width = "100%", height = "1rem", circle, style }) => /* @__PURE__ */ jsx(
  "span",
  {
    "aria-hidden": "true",
    className: "anto-skeleton",
    style: {
      display: "block",
      width,
      height,
      borderRadius: circle ? "var(--radius-pill)" : "var(--radius-sm)",
      background: "var(--bg3)",
      ...style
    }
  }
);
var STATUS_COLOR = {
  online: "var(--ok)",
  idle: "var(--warn)",
  dnd: "var(--err)",
  offline: "var(--text3)"
};
var StatusDot = ({ status, label }) => /* @__PURE__ */ jsx(
  "span",
  {
    "aria-label": label,
    "aria-hidden": label ? void 0 : true,
    style: {
      width: "var(--space-2)",
      height: "var(--space-2)",
      // pinned to --radius-dot, not the general --radius cascade: a
      // theme rounding everything else does not accidentally round this
      // too (the rule keeps status indicators square) unless it sets
      // --radius-dot on purpose
      borderRadius: "var(--radius-dot)",
      background: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
      display: "inline-block",
      flexShrink: 0
    }
  }
);
var Tabs = ({ tabs, active, onChange }) => {
  function onKeyDown(e, idx) {
    rovingKey(e, idx, tabs.length, (next) => {
      document.querySelector(`[data-tab-idx="${next}"]`)?.focus();
    }, true);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange?.(tabs[idx].id);
    }
  }
  return /* @__PURE__ */ jsx("div", { role: "tablist", style: { display: "flex", borderBottom: "var(--border-width) solid var(--border)" }, children: tabs.map((tab, idx) => {
    const isActive = tab.id === active;
    return /* @__PURE__ */ jsx(
      "button",
      {
        role: "tab",
        id: `tab-${tab.id}`,
        "aria-selected": isActive,
        "aria-controls": `panel-${tab.id}`,
        tabIndex: isActive ? 0 : -1,
        "data-tab-idx": idx,
        type: "button",
        onClick: () => {
          haptic("tap");
          onChange?.(tab.id);
        },
        onKeyDown: (e) => onKeyDown(e, idx),
        style: {
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-2) var(--space-3)",
          background: "transparent",
          color: isActive ? "var(--accent)" : "var(--text3)",
          border: "none",
          borderBottom: `0.125rem solid ${isActive ? "var(--accent)" : "transparent"}`,
          cursor: "pointer",
          marginBottom: "-0.0625rem",
          userSelect: "none",
          transition: "color var(--transition-base), border-color var(--transition-base)"
        },
        children: tab.label
      },
      tab.id
    );
  }) });
};
var defaultMarkerAriaLabel = (label) => `${label} (needs attention)`;
function railSeparator(key, vertical, margin) {
  return vertical ? /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      "aria-orientation": "vertical",
      style: { width: "var(--border-width)", background: "var(--border)", alignSelf: "stretch", margin, flexShrink: 0 }
    },
    key
  ) : /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      "aria-orientation": "horizontal",
      style: { height: "var(--border-width)", background: "var(--border)", width: "100%", margin, flexShrink: 0 }
    },
    key
  );
}
function markerDot(color, active) {
  return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
    position: "absolute",
    top: "var(--space-1)",
    right: "var(--space-1)",
    width: "0.5rem",
    height: "0.5rem",
    background: color,
    borderRadius: "var(--radius-dot)",
    // same reasoning as StatusDot
    border: `var(--border-width) solid ${active ? "var(--accent)" : "var(--bg2)"}`
  } });
}
var SidebarButton = ({ item, isActive, onSelect, markerAriaLabel }) => {
  const [hovered, setHovered] = React2.useState(false);
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      "aria-label": item.marker ? markerAriaLabel(item.label) : item.label,
      "aria-current": isActive ? "page" : void 0,
      title: item.label,
      onClick: () => onSelect?.(item.id),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        position: "relative",
        width: "100%",
        height: "var(--space-10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        borderRadius: "var(--radius-btn)",
        background: isActive ? "var(--accent)" : hovered ? "var(--hover)" : "transparent",
        color: isActive ? "var(--on-accent)" : "var(--text3)",
        fontFamily: "var(--font-icon)",
        fontSize: "var(--text-sm)",
        lineHeight: 1,
        transition: "background var(--transition-base), color var(--transition-base)"
      },
      children: [
        item.icon,
        item.marker && markerDot(item.marker, isActive)
      ]
    }
  );
};
var Sidebar = ({ items, active, onSelect, markerAriaLabel = defaultMarkerAriaLabel }) => /* @__PURE__ */ jsx("nav", { style: {
  width: "var(--space-10)",
  background: "var(--bg2)",
  borderRight: "var(--border-width) solid var(--border)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: "var(--space-1)",
  flexShrink: 0
}, children: items.flatMap((item, i) => {
  const isActive = item.id === active;
  const previous = items[i - 1];
  const nodes = [];
  if (i > 0 && item.group !== previous.group) {
    nodes.push(railSeparator(`${item.id}-divider`, false, "var(--space-1) 0"));
  }
  nodes.push(
    /* @__PURE__ */ jsx(SidebarButton, { item, isActive, onSelect, markerAriaLabel }, item.id)
  );
  return nodes;
}) });
var NavRail = ({
  items,
  active,
  onSelect,
  markerAriaLabel = defaultMarkerAriaLabel,
  ...aria
}) => {
  const narrow = useMediaQuery("(max-width: 40rem)");
  const select = (id) => {
    haptic("tap");
    onSelect?.(id);
  };
  return /* @__PURE__ */ jsx("nav", { "aria-label": aria["aria-label"] ?? "navigation", style: narrow ? {
    display: "flex",
    flexDirection: "row",
    background: "var(--bg2)",
    borderTop: "var(--border-width) solid var(--border)",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    flexShrink: 0
  } : {
    width: "3.5rem",
    background: "var(--bg2)",
    borderRight: "var(--border-width) solid var(--border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0
  }, children: items.flatMap((item, i) => {
    const isActive = item.id === active;
    const previous = items[i - 1];
    const nodes = [];
    if (i > 0 && item.group !== previous.group) {
      nodes.push(railSeparator(
        `${item.id}-divider`,
        narrow,
        narrow ? "var(--space-2) 0" : "var(--space-1) var(--space-2)"
      ));
    }
    nodes.push(
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          "aria-label": item.marker ? markerAriaLabel(item.title ?? item.label) : item.title ?? item.label,
          "aria-current": isActive ? "page" : void 0,
          title: item.title ?? item.label,
          onClick: () => select(item.id),
          style: {
            position: "relative",
            flex: narrow ? 1 : void 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-1)",
            padding: "var(--space-2) 0",
            minHeight: "var(--space-10)",
            background: isActive ? "var(--accent)" : "transparent",
            border: "none",
            borderRadius: narrow ? 0 : "var(--radius-btn)",
            color: isActive ? "var(--on-accent)" : "var(--text3)",
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            transition: "background var(--transition-fast), color var(--transition-fast)"
          },
          children: [
            /* @__PURE__ */ jsx(Icon, { name: item.icon, size: "lg" }),
            /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
              fontSize: "0.55rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1,
              whiteSpace: "nowrap"
            }, children: item.caption ?? item.label }),
            item.marker && markerDot(item.marker, isActive)
          ]
        },
        item.id
      )
    );
    return nodes;
  }) });
};
var BreadcrumbLink = ({ item }) => {
  const [hovered, setHovered] = React2.useState(false);
  return /* @__PURE__ */ jsx(
    "a",
    {
      href: item.href ?? "#",
      onClick: item.onClick ? ((e) => {
        e.preventDefault();
        item.onClick();
      }) : void 0,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        color: hovered ? "var(--text)" : "var(--text3)",
        textDecoration: "none",
        transition: "color var(--transition-base)"
      },
      children: item.label
    }
  );
};
var Breadcrumb = ({ items }) => /* @__PURE__ */ jsx("nav", { "aria-label": "breadcrumb", style: {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "var(--space-1)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-xs)",
  color: "var(--text3)"
}, children: items.map((item, i) => {
  const isLast = i === items.length - 1;
  const isLink = !isLast && (item.href || item.onClick);
  return /* @__PURE__ */ jsxs(React2.Fragment, { children: [
    i > 0 && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "/" }),
    isLink ? /* @__PURE__ */ jsx(BreadcrumbLink, { item }) : /* @__PURE__ */ jsx("span", { "aria-current": isLast ? "page" : void 0, style: { color: isLast ? "var(--text)" : "var(--text3)" }, children: item.label })
  ] }, i);
}) });
var Collapse = ({ open, children, duration = 200, style }) => {
  const [shown, setShown] = React2.useState(open);
  const [anim, setAnim] = React2.useState(null);
  const first = React2.useRef(true);
  const timer = React2.useRef(null);
  React2.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const css = duration ? { animationDuration: `${duration}ms`, animationTimingFunction: "var(--ease)", animationFillMode: "both" } : null;
    if (open) {
      setShown(true);
      setAnim(css ? { ...css, animationName: "anto-collapse-in" } : null);
      timer.current = setTimeout(() => setAnim(null), duration);
    } else {
      setAnim(css ? { ...css, animationName: "anto-collapse-out" } : null);
      timer.current = setTimeout(() => {
        setShown(false);
        setAnim(null);
      }, duration);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, duration]);
  return /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateRows: shown ? "1fr" : "0fr", ...anim ?? {}, ...style }, children: shown && /* @__PURE__ */ jsx("div", { style: { minHeight: 0, overflow: "hidden" }, children }) });
};
var Accordion = ({ items, open: controlledOpen, onToggle, multiple = true }) => {
  const [internalOpen, setInternalOpen] = React2.useState([]);
  const openIds = controlledOpen ?? internalOpen;
  function toggle(id) {
    haptic("tap");
    if (onToggle) {
      onToggle(id);
      return;
    }
    setInternalOpen((prev) => {
      const isOpen = prev.includes(id);
      if (isOpen) return prev.filter((x) => x !== id);
      return multiple ? [...prev, id] : [id];
    });
  }
  return /* @__PURE__ */ jsx("div", { style: { border: "var(--border-width) solid var(--border2)", borderRadius: "var(--radius-card)" }, children: items.map((item, i) => {
    const isOpen = openIds.includes(item.id);
    return /* @__PURE__ */ jsxs("div", { style: { borderTop: i > 0 ? "var(--border-width) solid var(--border2)" : void 0 }, children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          "aria-expanded": isOpen,
          "aria-controls": `accordion-panel-${item.id}`,
          id: `accordion-header-${item.id}`,
          onClick: () => toggle(item.id),
          style: {
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            padding: "var(--space-3)",
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-sm)",
            color: "var(--text)",
            cursor: "pointer",
            textAlign: "left"
          },
          children: [
            /* @__PURE__ */ jsx("span", { children: item.title }),
            /* @__PURE__ */ jsx(Chevron, { dir: isOpen ? "down" : "right" })
          ]
        }
      ),
      /* @__PURE__ */ jsx(Collapse, { open: isOpen, children: /* @__PURE__ */ jsx(
        "div",
        {
          id: `accordion-panel-${item.id}`,
          role: "region",
          "aria-labelledby": `accordion-header-${item.id}`,
          style: {
            padding: "0 var(--space-3) var(--space-3)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-sm)",
            color: "var(--text2)"
          },
          children: item.content
        }
      ) })
    ] }, item.id);
  }) });
};
var StatusBar = ({ left, right }) => /* @__PURE__ */ jsxs("div", { role: "status", "aria-live": "polite", style: {
  height: "var(--space-5)",
  background: "var(--accent)",
  color: "var(--on-accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 var(--space-2)",
  fontSize: "var(--text-xs)",
  fontFamily: "var(--font-ui)",
  flexShrink: 0,
  userSelect: "none"
}, children: [
  /* @__PURE__ */ jsx("span", { style: { display: "flex", alignItems: "center", gap: "var(--space-3)" }, children: left }),
  /* @__PURE__ */ jsx("span", { style: { display: "flex", alignItems: "center", gap: "var(--space-3)" }, children: right })
] });
var Alert = ({ children, color = "var(--warn)", action, title, onDismiss }) => /* @__PURE__ */ jsxs("div", { style: {
  display: "flex",
  alignItems: title ? "flex-start" : "center",
  gap: "var(--space-2)",
  flexWrap: "wrap",
  border: `var(--border-width) solid ${color}`,
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)"
}, children: [
  /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }, children: [
    title && /* @__PURE__ */ jsx("strong", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)", color: "var(--text)" }, children: title }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }, children })
  ] }),
  action,
  onDismiss && /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      "aria-label": "dismiss",
      onClick: onDismiss,
      style: {
        fontFamily: "var(--font-icon)",
        fontSize: "var(--text-sm)",
        color: "var(--text3)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0
      },
      children: "times"
    }
  )
] });
var Tile = ({ children, selected, onClick, disabled, style, ...aria }) => {
  const [hovered, setHovered] = React2.useState(false);
  const interactive = !!onClick;
  const shared = {
    display: "block",
    textAlign: "left",
    width: "100%",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-sm)",
    color: "var(--text)",
    padding: "var(--space-3)",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--elevation-1)",
    border: `var(--border-width) solid ${selected ? "var(--accent)" : "var(--border2)"}`,
    background: selected ? "var(--bg2)" : hovered && interactive ? "var(--hover)" : "var(--bg)",
    transition: "background var(--transition-base), border-color var(--transition-base)",
    ...style
  };
  if (!interactive) {
    return /* @__PURE__ */ jsx("div", { "aria-label": aria["aria-label"], style: shared, children });
  }
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      disabled,
      "aria-pressed": selected !== void 0 ? selected : void 0,
      "aria-label": aria["aria-label"],
      onClick: () => {
        haptic("tap");
        onClick();
      },
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: { ...shared, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 },
      children
    }
  );
};
var MODAL_SIZE = {
  sm: { width: "24rem" },
  md: { width: "32rem" },
  lg: { width: "48rem" },
  page: { width: "min(64rem, 96vw)", height: "min(88vh, 60rem)" }
};
function useFocusTrap(ref, active) {
  React2.useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function handler(e) {
      const els = Array.from(el.querySelectorAll(sel));
      if (!els.length) {
        e.preventDefault();
        return;
      }
      const first = els[0], last = els[els.length - 1];
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    el.addEventListener("keydown", handler);
    if (!el.contains(document.activeElement)) {
      el.querySelectorAll(sel)[0]?.focus();
    }
    return () => el.removeEventListener("keydown", handler);
  }, [active]);
}
var Modal = ({ title, children, footer, onClose, open = true, width, size }) => {
  const boxRef = React2.useRef(null);
  useFocusTrap(boxRef, open);
  React2.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  const preset = size ? MODAL_SIZE[size] : void 0;
  const boxWidth = preset?.width ?? width ?? "24rem";
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: size === "page" ? "var(--space-4)" : void 0,
        zIndex: "var(--z-modal)"
      },
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose?.();
      },
      children: /* @__PURE__ */ jsxs("div", { ref: boxRef, style: {
        background: "var(--modal-bg)",
        border: "var(--border-width) solid var(--border)",
        borderRadius: "var(--radius-modal)",
        boxShadow: "var(--elevation-2)",
        // clips the header/footer own square corners to the box radius when a
        // theme rounds it. the inner body keeps its own overflow-y:auto
        // (for scrolling long content), that is a different element
        overflow: "hidden",
        width: boxWidth,
        maxWidth: "96vw",
        maxHeight: "88vh",
        height: preset?.height,
        display: "flex",
        flexDirection: "column"
      }, children: [
        /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-2) var(--space-3)",
          borderBottom: "var(--border-width) solid var(--border)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--text)",
          flexShrink: 0
        }, children: [
          /* @__PURE__ */ jsx("span", { children: title }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              "aria-label": "close",
              onClick: onClose,
              style: {
                fontFamily: "var(--font-icon)",
                fontSize: "var(--text-sm)",
                color: "var(--text3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0
              },
              children: "times"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { style: {
          padding: "var(--space-3)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          color: "var(--text2)",
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto"
        }, children }),
        footer && /* @__PURE__ */ jsx("div", { style: {
          padding: "var(--space-2) var(--space-3)",
          borderTop: "var(--border-width) solid var(--border)",
          display: "flex",
          gap: "var(--space-2)",
          justifyContent: "flex-end",
          flexShrink: 0
        }, children: footer })
      ] })
    }
  );
};
var Pager = ({ page, pageCount, onPage, ...aria }) => {
  if (pageCount <= 1) return null;
  function go(n) {
    const clamped = Math.min(Math.max(1, Math.round(n)), pageCount);
    if (clamped !== page) onPage(clamped);
  }
  return /* @__PURE__ */ jsxs("nav", { "aria-label": aria["aria-label"] ?? "pager", style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-sm)",
    color: "var(--text2)"
  }, children: [
    /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", disabled: page <= 1, onClick: () => go(page - 1), "aria-label": "previous page", children: /* @__PURE__ */ jsx(Icon, { name: "left", size: "sm" }) }),
    /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }, children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          value: String(page),
          onChange: (v) => {
            const n = Number(v);
            if (Number.isFinite(n)) go(n);
          },
          size: "sm",
          "aria-label": "page number",
          style: { width: "3.5rem", textAlign: "center" }
        }
      ),
      /* @__PURE__ */ jsxs("span", { children: [
        "/ ",
        pageCount
      ] })
    ] }),
    /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", disabled: page >= pageCount, onClick: () => go(page + 1), "aria-label": "next page", children: /* @__PURE__ */ jsx(Icon, { name: "right", size: "sm" }) })
  ] });
};
function usePager(total, pageSize) {
  const [page, setPage] = React2.useState(1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { page: Math.min(page, pageCount), pageCount, setPage };
}
function useSelection() {
  const [selected, setSelected] = React2.useState(/* @__PURE__ */ new Set());
  const [lastIndex, setLastIndex] = React2.useState(null);
  function toggle(id, range) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range?.shiftKey && lastIndex !== null) {
        const from = Math.min(lastIndex, range.index);
        const to = Math.max(lastIndex, range.index);
        const turnOn = !prev.has(id);
        for (let i = from; i <= to; i++) {
          if (turnOn) next.add(range.allIds[i]);
          else next.delete(range.allIds[i]);
        }
        return next;
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastIndex(range?.index ?? null);
  }
  function select(ids) {
    setSelected(new Set(ids));
    setLastIndex(null);
  }
  function clear() {
    setSelected(/* @__PURE__ */ new Set());
    setLastIndex(null);
  }
  function remove(id) {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  return { selected, toggle, select, clear, remove };
}
var VIEWPORT_PAD = 8;
var gapCache = {};
function pxOf(token) {
  const hit = gapCache[token];
  if (hit !== void 0) return hit;
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;width:${token}`;
  document.body.appendChild(probe);
  const n = probe.getBoundingClientRect().width;
  probe.remove();
  gapCache[token] = n;
  return n;
}
var clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
function place(anchor, box, position, align, gap) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = box.width, h = box.height;
  const avail = { top: anchor.top, bottom: vh - anchor.bottom, left: anchor.left, right: vw - anchor.right };
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
  const caretAt = `${clamp(a0 + aSize / 2 - along, 12, size - 12)}px`;
  if (horizontal) {
    return {
      position,
      caretAt,
      left: along,
      top: position === "top" ? anchor.top - gap - h : anchor.bottom + gap
    };
  }
  return {
    position,
    caretAt,
    top: along,
    left: position === "left" ? anchor.left - gap - w : anchor.right + gap
  };
}
var triggerOf = (wrap) => wrap?.firstElementChild ?? wrap;
var Overlay = ({
  open,
  anchor,
  position,
  align = "center",
  id,
  gap = "var(--space-2)",
  children
}) => {
  const ref = React2.useRef(null);
  const [placed, setPlaced] = React2.useState(null);
  const live = open && anchor;
  React2.useLayoutEffect(() => {
    if (!live) {
      setPlaced(null);
      return;
    }
    const measure = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const next = place(anchor.getBoundingClientRect(), { width: r.width, height: r.height }, position, align, pxOf(gap));
      setPlaced((p) => p && p.top === next.top && p.left === next.left && p.position === next.position && p.caretAt === next.caretAt ? p : next);
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
    // opacity and not visibility for the unplaced frame: a hidden element cannot
    // take focus, and a menu focuses its first item the moment it opens.
    // max-content keeps the width independent of where the box lands, or a box
    // near the right edge would wrap, change size and be placed again
    /* @__PURE__ */ jsx("span", { id, ref, style: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "max-content",
      maxWidth: `calc(100vw - ${2 * VIEWPORT_PAD}px)`,
      // above every panel and canvas in the app: a popup that loses the paint
      // order is one the user cannot click
      zIndex: "var(--z-popover)",
      transform: placed ? `translate(${placed.left}px, ${placed.top}px)` : void 0,
      opacity: placed ? 1 : 0,
      boxSizing: "border-box"
    }, children: typeof children === "function" ? placed ? children(placed) : children({ position, caretAt: "50%" }) : children }),
    document.body
  );
};
var CARET_SIZE = "0.5rem";
var CARET_EDGE = `calc(${CARET_SIZE} / -2 - var(--border-width))`;
var CARET_CENTER = `calc(${CARET_SIZE} / -2)`;
function caretStyle(position, at) {
  switch (position) {
    case "top":
      return { bottom: CARET_EDGE, left: at, marginLeft: CARET_CENTER };
    case "bottom":
      return { top: CARET_EDGE, left: at, marginLeft: CARET_CENTER };
    case "left":
      return { right: CARET_EDGE, top: at, marginTop: CARET_CENTER };
    case "right":
      return { left: CARET_EDGE, top: at, marginTop: CARET_CENTER };
  }
}
function Caret({ p, background }) {
  return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
    position: "absolute",
    width: CARET_SIZE,
    height: CARET_SIZE,
    background,
    border: "var(--border-width) solid var(--border)",
    transform: "rotate(45deg)",
    ...caretStyle(p.position, p.caretAt)
  } });
}
var Tooltip = ({ content, children, position = "top" }) => {
  const [visible, setVisible] = React2.useState(false);
  const [anchorEl, setAnchorEl] = React2.useState(null);
  const id = React2.useId();
  const anchor = children.props;
  const show = (el) => {
    setAnchorEl(el);
    setVisible(true);
  };
  const tip = (p) => /* @__PURE__ */ jsxs("span", { role: "tooltip", style: {
    display: "block",
    position: "relative",
    background: "var(--bg3)",
    color: "var(--text)",
    border: "var(--border-width) solid var(--border)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--elevation-1)",
    padding: "var(--space-1) var(--space-2)",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-ui)",
    whiteSpace: "nowrap",
    pointerEvents: "none"
  }, children: [
    content,
    /* @__PURE__ */ jsx(Caret, { p, background: "var(--bg3)" })
  ] });
  if (anchor.disabled) {
    return /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex" }, children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          "aria-describedby": id,
          onMouseEnter: (e) => {
            anchor.onMouseEnter?.(e);
            show(e.currentTarget);
          },
          onMouseLeave: (e) => {
            anchor.onMouseLeave?.(e);
            setVisible(false);
          },
          style: { display: "inline-flex" },
          children
        }
      ),
      /* @__PURE__ */ jsx(Overlay, { open: visible, anchor: anchorEl, position, id, children: tip })
    ] });
  }
  return (
    // display contents: the wrapper only exists to hold the portal in the tree
    // and takes no part in layout
    /* @__PURE__ */ jsxs("span", { style: { display: "contents" }, children: [
      React2.cloneElement(children, {
        "aria-describedby": id,
        onMouseEnter: (e) => {
          anchor.onMouseEnter?.(e);
          show(e.currentTarget);
        },
        onMouseLeave: (e) => {
          anchor.onMouseLeave?.(e);
          setVisible(false);
        },
        onFocus: (e) => {
          anchor.onFocus?.(e);
          show(e.currentTarget);
        },
        onBlur: (e) => {
          anchor.onBlur?.(e);
          setVisible(false);
        }
      }),
      /* @__PURE__ */ jsx(Overlay, { open: visible, anchor: anchorEl, position, id, children: tip })
    ] })
  );
};
var Toggletip = ({ children, content, position = "bottom", ...aria }) => {
  const [open, setOpen] = React2.useState(false);
  const id = React2.useId();
  const ref = React2.useRef(null);
  const boxRef = React2.useRef(null);
  const close = React2.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [ref, boxRef]);
  return /* @__PURE__ */ jsxs("span", { ref, style: { position: "relative", display: "inline-block" }, children: [
    React2.cloneElement(children, {
      "aria-label": aria["aria-label"] ?? children.props["aria-label"],
      "aria-expanded": open,
      "aria-controls": open ? id : void 0,
      onClick: () => setOpen((o) => !o)
    }),
    open && /* @__PURE__ */ jsx(Overlay, { open, anchor: triggerOf(ref.current), position, id, children: (p) => /* @__PURE__ */ jsxs("div", { ref: boxRef, role: "dialog", style: {
      position: "relative",
      background: "var(--modal-bg)",
      color: "var(--text)",
      border: "var(--border-width) solid var(--border)",
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--elevation-2)",
      padding: "var(--space-3)",
      minWidth: "12rem",
      maxWidth: "18rem",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-sm)"
    }, children: [
      content,
      /* @__PURE__ */ jsx(Caret, { p, background: "var(--modal-bg)" })
    ] }) })
  ] });
};
var MenuItemButton = ({ item, index, itemRefs, onActivate, onHoverIndex }) => {
  const [hovered, setHovered] = React2.useState(false);
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref: (el) => {
        itemRefs.current[index] = el;
      },
      type: "button",
      role: "menuitem",
      disabled: item.disabled,
      tabIndex: -1,
      onClick: () => onActivate(item),
      onMouseEnter: () => {
        setHovered(true);
        onHoverIndex(index);
      },
      onMouseLeave: () => setHovered(false),
      style: {
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: hovered && !item.disabled ? "var(--hover)" : "none",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: item.disabled ? "var(--text3)" : item.danger ? "var(--err)" : "var(--text)",
        cursor: item.disabled ? "not-allowed" : "pointer",
        opacity: item.disabled ? 0.5 : 1,
        transition: "background var(--transition-base)"
      },
      children: item.label
    }
  );
};
var Menu = ({ children, items, position = "bottom", ...aria }) => {
  const [open, setOpen] = React2.useState(false);
  const [activeIdx, setActiveIdx] = React2.useState(0);
  const id = React2.useId();
  const ref = React2.useRef(null);
  const boxRef = React2.useRef(null);
  const itemRefs = React2.useRef([]);
  React2.useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    itemRefs.current[0]?.focus({ preventScroll: true });
  }, [open]);
  const close = React2.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [ref, boxRef]);
  function focusIndex(next) {
    setActiveIdx(next);
    itemRefs.current[next]?.focus({ preventScroll: true });
  }
  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    rovingKey(e, activeIdx, items.length, focusIndex, true);
  }
  function activate(item) {
    if (item.disabled) return;
    haptic(item.danger ? "error" : "tap");
    item.onClick?.();
    setOpen(false);
  }
  return /* @__PURE__ */ jsxs("span", { ref, style: { position: "relative", display: "inline-block" }, children: [
    React2.cloneElement(children, {
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-controls": open ? id : void 0,
      onClick: () => setOpen((o) => !o)
    }),
    open && /* @__PURE__ */ jsx(Overlay, { open, anchor: triggerOf(ref.current), position, align: "start", gap: "var(--space-1)", id, children: /* @__PURE__ */ jsx(
      "div",
      {
        ref: boxRef,
        role: "menu",
        "aria-label": aria["aria-label"],
        onKeyDown,
        style: {
          display: "flex",
          flexDirection: "column",
          background: "var(--modal-bg)",
          border: "var(--border-width) solid var(--border)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "var(--elevation-2)",
          padding: "var(--space-1)",
          minWidth: "10rem",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)"
        },
        children: items.map((item, idx) => /* @__PURE__ */ jsx(
          MenuItemButton,
          {
            item,
            index: idx,
            itemRefs,
            onActivate: activate,
            onHoverIndex: setActiveIdx
          },
          item.id
        ))
      }
    ) })
  ] });
};
var SplitButton = ({
  children,
  onClick,
  items,
  size = "md",
  variant = "primary",
  disabled,
  loading,
  menuLabel = "more",
  position = "bottom",
  tip,
  tipPosition = "top",
  className,
  ...aria
}) => /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "stretch" }, children: [
  /* @__PURE__ */ jsx(
    Btn,
    {
      tip,
      tipPosition,
      variant,
      size,
      "aria-label": aria["aria-label"],
      className,
      onClick,
      disabled,
      loading,
      style: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none" },
      children
    }
  ),
  /* @__PURE__ */ jsx(Menu, { items, position, "aria-label": menuLabel, children: /* @__PURE__ */ jsx(
    Btn,
    {
      variant,
      size,
      disabled,
      "aria-label": menuLabel,
      style: {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        // the menu wraps the trigger in a span for its outside-click
        // bookkeeping, and that span is what stretches to the row height.
        // without this the caret half keeps its own content height and
        // ends a few px short of the primary half it is seamed to
        height: "100%"
      },
      children: /* @__PURE__ */ jsx(Chevron, { dir: "down" })
    }
  ) })
] });
var TabStrip = ({
  tabs,
  active,
  onSelect,
  onClose,
  onRename,
  onAuxClick,
  ...aria
}) => {
  const [editing, setEditing] = React2.useState(null);
  const [draft, setDraft] = React2.useState("");
  const refs = React2.useRef({});
  function focusId(id) {
    refs.current[id]?.focus();
  }
  function beginRename(id) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab || !onRename) return;
    setDraft(typeof tab.label === "string" ? tab.label : "");
    setEditing(id);
  }
  function commitRename() {
    if (editing && draft.trim()) onRename?.(editing, draft.trim());
    setEditing(null);
  }
  function onKeyDown(e, tab) {
    const idx = tabs.findIndex((t) => t.id === tab.id);
    const n = tabs.length;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusId(tabs[(idx + 1) % n].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusId(tabs[(idx - 1 + n) % n].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusId(tabs[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      focusId(tabs[n - 1].id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(tab.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (onClose) {
        e.preventDefault();
        onClose(tab.id);
      }
    } else if (e.key === "F2") {
      e.preventDefault();
      beginRename(tab.id);
    }
  }
  return /* @__PURE__ */ jsx("div", { role: "tablist", "aria-label": aria["aria-label"], style: { display: "flex" }, children: tabs.map((tab) => {
    const isActive = tab.id === active;
    const isEditing = editing === tab.id;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          refs.current[tab.id] = el;
        },
        role: "tab",
        "aria-selected": isActive,
        tabIndex: isActive ? 0 : -1,
        title: isEditing ? void 0 : tab.title,
        onClick: () => onSelect?.(tab.id),
        onAuxClick: (e) => {
          if (e.button === 1) onAuxClick?.(tab.id);
        },
        onDoubleClick: () => beginRename(tab.id),
        onKeyDown: (e) => onKeyDown(e, tab),
        style: {
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderRight: "var(--border-width) solid var(--border2)",
          whiteSpace: "nowrap",
          userSelect: "none",
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          color: isActive ? "var(--text)" : "var(--text3)",
          background: isActive ? "var(--bg)" : "transparent",
          boxShadow: isActive ? "inset 0 0.125rem 0 var(--accent)" : void 0,
          transition: "background var(--transition-fast), color var(--transition-fast)"
        },
        children: [
          tab.icon && /* @__PURE__ */ jsx(Icon, { name: tab.icon, size: "sm", "aria-hidden": "true" }),
          isEditing ? /* @__PURE__ */ jsx(
            "input",
            {
              value: draft,
              autoFocus: true,
              "aria-label": tab.title,
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(null);
                }
                e.stopPropagation();
              },
              onBlur: commitRename,
              style: {
                fontFamily: "var(--font-ui)",
                fontSize: "var(--text-sm)",
                color: "var(--text)",
                background: "var(--bg2)",
                border: "var(--border-width) solid var(--accent)",
                borderRadius: "var(--radius-input)",
                padding: "0 var(--space-1)",
                width: "8rem",
                outline: "none"
              }
            }
          ) : /* @__PURE__ */ jsx("span", { children: tab.label }),
          tab.badge,
          tab.closable && // a span role=button rather than a real button: a native button
          // nested inside role=tab is invalid semantics, and the editor tab
          // already uses this pattern for its close control
          /* @__PURE__ */ jsx(
            "span",
            {
              role: "button",
              tabIndex: 0,
              "aria-label": tab.closeLabel ?? "close",
              onClick: (e) => {
                e.stopPropagation();
                onClose?.(tab.id);
              },
              onKeyDown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose?.(tab.id);
                }
              },
              style: {
                display: "inline-flex",
                alignItems: "center",
                lineHeight: 1,
                fontFamily: "var(--font-icon)",
                fontSize: "var(--text-xs)",
                color: "var(--text3)",
                padding: "0 var(--space-1)"
              },
              children: "times"
            }
          )
        ]
      },
      tab.id
    );
  }) });
};
var Link = ({ href, onClick, children, disabled, style }) => /* @__PURE__ */ jsx(
  "a",
  {
    href: disabled ? void 0 : href,
    onClick: disabled ? void 0 : onClick ? ((e) => {
      if (!href) e.preventDefault();
      onClick();
    }) : void 0,
    "aria-disabled": disabled || void 0,
    style: {
      fontFamily: "var(--font-ui)",
      color: disabled ? "var(--text3)" : "var(--accent)",
      textDecoration: "underline",
      textUnderlineOffset: "0.125rem",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "color var(--transition-base)",
      ...style
    },
    children
  }
);
var List = ({ children, ordered, style }) => {
  const Tag2 = ordered ? "ol" : "ul";
  return /* @__PURE__ */ jsx(Tag2, { style: {
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-sm)",
    color: "var(--text)",
    margin: 0,
    paddingLeft: "var(--space-5)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    ...style
  }, children });
};
var CopyButton = ({ text, ...aria }) => {
  const [copied, setCopied] = React2.useState(false);
  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    haptic("tap");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2e3);
  }
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick,
      "aria-label": aria["aria-label"] ?? (copied ? "copied" : "copy"),
      style: {
        fontFamily: "var(--font-icon)",
        fontSize: "var(--text-sm)",
        lineHeight: 1,
        background: "none",
        border: "var(--border-width) solid var(--border2)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1)",
        display: "inline-flex",
        flexShrink: 0,
        color: copied ? "var(--ok)" : "var(--text2)",
        cursor: "pointer",
        transition: "color var(--transition-base), border-color var(--transition-base)"
      },
      children: copied ? "checked" : "clipboard"
    }
  );
};
var CodeSnippet = ({ children, inline, ...aria }) => {
  const codeFont = { fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" };
  if (inline) {
    return /* @__PURE__ */ jsx("code", { style: {
      ...codeFont,
      background: "var(--bg2)",
      border: "var(--border-width) solid var(--border2)",
      borderRadius: "var(--radius-sm)",
      padding: "0.125rem var(--space-1)"
    }, children });
  }
  return /* @__PURE__ */ jsxs("div", { style: {
    position: "relative",
    background: "var(--bg2)",
    border: "var(--border-width) solid var(--border2)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-3)"
  }, children: [
    /* @__PURE__ */ jsx("pre", { style: {
      ...codeFont,
      margin: 0,
      padding: 0,
      paddingRight: "var(--space-8)",
      background: "none",
      border: 0,
      overflowX: "auto",
      whiteSpace: "pre"
    }, children: /* @__PURE__ */ jsx("code", { style: {
      fontFamily: "inherit",
      fontSize: "inherit",
      background: "none",
      border: 0,
      padding: 0
    }, children }) }),
    /* @__PURE__ */ jsx("div", { style: { position: "absolute", top: "var(--space-2)", right: "var(--space-2)" }, children: /* @__PURE__ */ jsx(CopyButton, { text: children, "aria-label": aria["aria-label"] }) })
  ] });
};
var InlineLoading = ({ status, children }) => /* @__PURE__ */ jsxs("div", { role: "status", "aria-live": "polite", style: {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  color: "var(--text2)"
}, children: [
  status === "loading" && /* @__PURE__ */ jsx(Spinner, {}),
  status === "success" && /* @__PURE__ */ jsx(Icon, { name: "checked", size: "sm", style: { color: "var(--ok)" } }),
  status === "error" && /* @__PURE__ */ jsx(Icon, { name: "times", size: "sm", style: { color: "var(--err)" } }),
  children
] });
var ContentSwitcher = ({ options, value, onChange, ...aria }) => {
  const { refs: itemRefs, onKeyDown, move } = useRoving(options.length, (next) => {
    haptic("tap");
    onChange(options[next].id);
  }, true);
  return /* @__PURE__ */ jsx("div", { role: "radiogroup", "aria-label": aria["aria-label"], style: {
    display: "inline-flex",
    border: "var(--border-width) solid var(--border)",
    borderRadius: "var(--radius-input)",
    overflow: "hidden"
  }, children: options.map((opt, idx) => {
    const selected = opt.id === value;
    return /* @__PURE__ */ jsx(
      "button",
      {
        ref: (el) => {
          itemRefs.current[idx] = el;
        },
        type: "button",
        role: "radio",
        "aria-checked": selected,
        tabIndex: selected ? 0 : -1,
        onClick: () => move(idx),
        onKeyDown: (e) => onKeyDown(e, idx),
        style: {
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-2) var(--space-3)",
          border: "none",
          borderRight: idx < options.length - 1 ? "var(--border-width) solid var(--border)" : "none",
          background: selected ? "var(--accent)" : "transparent",
          color: selected ? "var(--on-accent)" : "var(--text)",
          cursor: "pointer",
          transition: "background var(--transition-base), color var(--transition-base)"
        },
        children: opt.label
      },
      opt.id
    );
  }) });
};
var ChipRow = ({ options, value, onChange, ...aria }) => {
  const { refs, onKeyDown, move } = useRoving(options.length, (next) => {
    haptic("tap");
    onChange(options[next].id);
  }, false);
  return /* @__PURE__ */ jsx("div", { role: "radiogroup", "aria-label": aria["aria-label"], style: { display: "flex", gap: "var(--space-2)", overflowX: "auto", paddingBottom: "var(--space-1)" }, children: options.map((opt, idx) => {
    const selected = opt.id === value;
    return /* @__PURE__ */ jsx(
      "button",
      {
        ref: (el) => {
          refs.current[idx] = el;
        },
        type: "button",
        role: "radio",
        "aria-checked": selected,
        tabIndex: selected ? 0 : -1,
        onClick: () => move(idx),
        onKeyDown: (e) => onKeyDown(e, idx),
        style: {
          flexShrink: 0,
          minHeight: "var(--space-10)",
          padding: "var(--space-1) var(--space-3)",
          background: selected ? "var(--accent)" : "var(--bg2)",
          border: "var(--border-width) solid",
          borderColor: selected ? "var(--accent)" : "var(--border)",
          borderRadius: "var(--radius-btn)",
          color: selected ? "var(--on-accent)" : "var(--text2)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          transition: "background var(--transition-fast), color var(--transition-fast)"
        },
        children: opt.label
      },
      opt.id
    );
  }) });
};
var PalettePicker = ({ palettes, value, onChange, note, ...aria }) => {
  const order = palettes.map((p) => p.id);
  const { refs, onKeyDown, move } = useRoving(order.length, (next) => {
    haptic("tap");
    onChange(order[next]);
  }, false);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: "radiogroup",
      "aria-label": aria["aria-label"],
      style: { display: "flex", flexDirection: "column", gap: "var(--space-2)" },
      children: [
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }, children: palettes.map((opt, idx) => {
          const selected = opt.id === value;
          return /* @__PURE__ */ jsxs(
            "button",
            {
              ref: (el) => {
                refs.current[idx] = el;
              },
              type: "button",
              role: "radio",
              "aria-checked": selected,
              tabIndex: selected ? 0 : -1,
              onClick: () => move(idx),
              onKeyDown: (e) => onKeyDown(e, idx),
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-1)",
                padding: "var(--space-2) var(--space-3)",
                background: selected ? "var(--accent)" : "var(--bg2)",
                border: "var(--border-width) solid",
                borderColor: selected ? "var(--accent)" : "var(--border)",
                borderRadius: "var(--radius-btn)",
                color: selected ? "var(--on-accent)" : "var(--text)",
                cursor: "pointer",
                transition: "background var(--transition-fast), color var(--transition-fast)"
              },
              children: [
                /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: { display: "flex", gap: 0 }, children: opt.swatch ? opt.swatch.map((c, i) => /* @__PURE__ */ jsx("span", { style: { width: "1rem", height: "1rem", background: c } }, i)) : null }),
                /* @__PURE__ */ jsx("span", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)" }, children: opt.label }),
                /* @__PURE__ */ jsx("span", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-xs)", opacity: 0.8 }, children: opt.hint })
              ]
            },
            opt.id
          );
        }) }),
        note && /* @__PURE__ */ jsx("span", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-xs)", color: "var(--text3)" }, children: note })
      ]
    }
  );
};
var ProgressIndicator = ({ steps, currentIndex, invalidIndex }) => /* @__PURE__ */ jsx("ol", { style: { display: "flex", alignItems: "flex-start", width: "100%", margin: 0, padding: 0, listStyle: "none" }, children: steps.map((step, idx) => {
  const status = idx === invalidIndex ? "invalid" : idx < currentIndex ? "complete" : idx === currentIndex ? "current" : "incomplete";
  const color = status === "complete" ? "var(--ok)" : status === "invalid" ? "var(--err)" : status === "current" ? "var(--accent)" : "var(--border)";
  return /* @__PURE__ */ jsxs(
    "li",
    {
      "aria-current": status === "current" ? "step" : void 0,
      style: { display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : void 0 },
      children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }, children: [
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
            width: "var(--space-4)",
            height: "var(--space-4)",
            borderRadius: "var(--radius-pill)",
            border: `var(--border-width) solid ${color}`,
            background: status === "complete" || status === "current" ? color : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontFamily: "var(--font-icon)",
            fontSize: "var(--text-xs)",
            color: "var(--on-accent)"
          }, children: status === "complete" ? "checked" : status === "invalid" ? "times" : "" }),
          /* @__PURE__ */ jsx("span", { style: {
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-xs)",
            whiteSpace: "nowrap",
            color: status === "incomplete" ? "var(--text3)" : "var(--text)"
          }, children: step.label })
        ] }),
        idx < steps.length - 1 && /* @__PURE__ */ jsx("div", { "aria-hidden": "true", style: {
          flex: 1,
          height: "var(--border-width)",
          margin: "0 var(--space-2)",
          marginBottom: "1.25rem",
          background: idx < currentIndex ? "var(--ok)" : "var(--border)"
        } })
      ]
    },
    step.id
  );
}) });
var Search = ({ value, onChange, placeholder, debounceMs = 0, size = "md", ...aria }) => {
  const [local, setLocal] = React2.useState(value);
  const timer = React2.useRef(null);
  React2.useEffect(() => {
    setLocal(value);
  }, [value]);
  function handleChange(v) {
    setLocal(v);
    if (debounceMs > 0) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(v), debounceMs);
    } else {
      onChange(v);
    }
  }
  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setLocal("");
    onChange("");
  }
  return /* @__PURE__ */ jsxs("div", { style: { position: "relative", display: "flex", alignItems: "center" }, children: [
    /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: {
      position: "absolute",
      left: "var(--space-2)",
      pointerEvents: "none",
      fontFamily: "var(--font-icon)",
      fontSize: "var(--text-sm)",
      color: "var(--text3)"
    }, children: "magnifier" }),
    /* @__PURE__ */ jsx(
      Input,
      {
        type: "search",
        value: local,
        onChange: handleChange,
        placeholder: placeholder ?? "search",
        size,
        "aria-label": aria["aria-label"] ?? "search",
        style: { paddingLeft: "var(--space-6)", paddingRight: local ? "var(--space-6)" : void 0 }
      }
    ),
    local && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: clear,
        "aria-label": "clear search",
        style: {
          position: "absolute",
          right: "var(--space-2)",
          padding: 0,
          lineHeight: 1,
          fontFamily: "var(--font-icon)",
          fontSize: "var(--text-sm)",
          background: "none",
          border: "none",
          color: "var(--text3)",
          display: "inline-flex",
          cursor: "pointer"
        },
        children: "times"
      }
    )
  ] });
};
var ComboBox = ({ options, multiple, value, onChange, placeholder, ...aria }) => {
  const selectedValues = multiple ? Array.isArray(value) ? value : [] : value ? [value] : [];
  const [query, setQuery] = React2.useState("");
  const [open, setOpen] = React2.useState(false);
  const [highlight, setHighlight] = React2.useState(0);
  const ref = React2.useRef(null);
  const listId = React2.useId();
  const filtered = React2.useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => (!multiple || !selectedValues.includes(o.value)) && (q === "" || o.label.toLowerCase().includes(q))
    );
  }, [options, query, multiple, selectedValues]);
  React2.useEffect(() => {
    setHighlight(0);
  }, [filtered.length, open]);
  React2.useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);
  function commit(opt) {
    haptic("tap");
    setQuery("");
    if (multiple) {
      onChange([...selectedValues, opt.value]);
    } else {
      onChange(opt.value);
      setOpen(false);
    }
  }
  function removePill(v) {
    onChange(selectedValues.filter((x) => x !== v));
  }
  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        commit(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Backspace" && query === "" && multiple && selectedValues.length > 0) {
      onChange(selectedValues.slice(0, -1));
    }
  }
  const singleLabel = !multiple && value ? options.find((o) => o.value === value)?.label ?? "" : "";
  const activeId = open && filtered[highlight] ? `${listId}-${highlight}` : void 0;
  return /* @__PURE__ */ jsxs("div", { ref, style: { position: "relative" }, children: [
    multiple && selectedValues.length > 0 && /* @__PURE__ */ jsx("div", { style: { ...row("var(--space-1)"), marginBottom: "var(--space-1)" }, children: selectedValues.map((v) => {
      const opt = options.find((o) => o.value === v);
      return /* @__PURE__ */ jsx(Tag, { variant: "gray", onDismiss: () => removePill(v), children: opt?.label ?? v }, v);
    }) }),
    /* @__PURE__ */ jsx(
      Input,
      {
        value: open || query || multiple ? query : singleLabel,
        onChange: (v) => {
          setQuery(v);
          setOpen(true);
          if (!multiple && value) onChange(null);
        },
        onFocus: () => setOpen(true),
        onKeyDown,
        placeholder,
        "aria-label": aria["aria-label"],
        role: "combobox",
        "aria-expanded": open,
        "aria-controls": listId,
        "aria-autocomplete": "list",
        "aria-activedescendant": activeId
      }
    ),
    open && filtered.length > 0 && /* @__PURE__ */ jsx("ul", { id: listId, role: "listbox", style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: "var(--space-1)",
      background: "var(--modal-bg)",
      border: "var(--border-width) solid var(--border)",
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--elevation-2)",
      maxHeight: "12rem",
      overflowY: "auto",
      padding: "var(--space-1)",
      margin: 0,
      listStyle: "none",
      zIndex: "var(--z-tooltip)"
    }, children: filtered.map((opt, idx) => /* @__PURE__ */ jsx(
      "li",
      {
        id: `${listId}-${idx}`,
        role: "option",
        "aria-selected": idx === highlight,
        onMouseDown: (e) => {
          e.preventDefault();
          commit(opt);
        },
        onMouseEnter: () => setHighlight(idx),
        style: {
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          background: idx === highlight ? "var(--hover)" : "transparent",
          color: "var(--text)"
        },
        children: opt.label
      },
      opt.value
    )) })
  ] });
};
function DataTable({
  columns,
  rows,
  selected,
  onToggleRow,
  onSelectAll,
  onClearSelection,
  batchActions,
  searchable,
  searchPlaceholder,
  ...aria
}) {
  const [sortKey, setSortKey] = React2.useState(null);
  const [sortDir, setSortDir] = React2.useState("asc");
  const [query, setQuery] = React2.useState("");
  const selectable = !!onToggleRow;
  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }
  const filtered = React2.useMemo(() => {
    if (!searchable || !query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => columns.some((col) => String(r[col.key] ?? "").toLowerCase().includes(q)));
  }, [rows, query, searchable, columns]);
  const sorted = React2.useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);
  const allIds = sorted.map((r) => r.id);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected?.has(id));
  const colSpan = columns.length + (selectable ? 1 : 0);
  return /* @__PURE__ */ jsxs("div", { style: stack("var(--space-2)"), children: [
    selectable && selected && selected.size > 0 ? /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-2) var(--space-3)",
      borderRadius: "var(--radius-sm)",
      background: "var(--accent)",
      color: "var(--on-accent)"
    }, children: [
      /* @__PURE__ */ jsxs("span", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)" }, children: [
        selected.size,
        " selected"
      ] }),
      /* @__PURE__ */ jsxs("div", { style: row("var(--space-2)"), children: [
        batchActions,
        /* @__PURE__ */ jsx(Btn, { size: "sm", variant: "ghost", onClick: onClearSelection, style: { color: "var(--on-accent)" }, children: "cancel" })
      ] })
    ] }) : searchable ? /* @__PURE__ */ jsx(Search, { value: query, onChange: setQuery, placeholder: searchPlaceholder }) : null,
    /* @__PURE__ */ jsxs(
      "table",
      {
        "aria-label": aria["aria-label"],
        style: { width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)" },
        children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            selectable && /* @__PURE__ */ jsx("th", { style: { width: "2.5rem", padding: "var(--space-2)", borderBottom: "var(--border-width) solid var(--border)" }, children: /* @__PURE__ */ jsx(
              Checkbox,
              {
                checked: !!allSelected,
                onChange: () => allSelected ? onClearSelection?.() : onSelectAll?.(allIds),
                label: /* @__PURE__ */ jsx("span", { style: srOnly, children: "select all rows" })
              }
            ) }),
            columns.map((col) => /* @__PURE__ */ jsx(
              "th",
              {
                onClick: col.sortable ? () => toggleSort(col.key) : void 0,
                "aria-sort": sortKey === col.key ? sortDir === "asc" ? "ascending" : "descending" : col.sortable ? "none" : void 0,
                style: {
                  textAlign: col.numeric ? "right" : "left",
                  padding: "var(--space-2) var(--space-3)",
                  borderBottom: "var(--border-width) solid var(--border)",
                  color: "var(--text2)",
                  fontWeight: 700,
                  cursor: col.sortable ? "pointer" : void 0,
                  userSelect: col.sortable ? "none" : void 0
                },
                children: /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }, children: [
                  col.label,
                  col.sortable && /* @__PURE__ */ jsx(
                    Chevron,
                    {
                      dir: sortKey === col.key ? sortDir === "asc" ? "up" : "down" : "right",
                      style: { opacity: sortKey === col.key ? 1 : 0.35 }
                    }
                  )
                ] })
              },
              col.key
            ))
          ] }) }),
          /* @__PURE__ */ jsxs("tbody", { children: [
            sorted.map((r, idx) => {
              const isSelected = selected?.has(r.id) ?? false;
              return /* @__PURE__ */ jsxs("tr", { style: {
                background: isSelected ? "var(--hover)" : void 0,
                borderBottom: "var(--border-width) solid var(--border2)"
              }, children: [
                selectable && /* @__PURE__ */ jsx("td", { style: { padding: "var(--space-2)" }, children: /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    checked: isSelected,
                    onChange: () => onToggleRow?.(r.id),
                    label: /* @__PURE__ */ jsxs("span", { style: srOnly, children: [
                      "select row ",
                      idx + 1
                    ] })
                  }
                ) }),
                columns.map((col) => /* @__PURE__ */ jsx("td", { style: { padding: "var(--space-2) var(--space-3)", textAlign: col.numeric ? "right" : "left" }, children: col.render ? col.render(r) : String(r[col.key] ?? "") }, col.key))
              ] }, r.id);
            }),
            sorted.length === 0 && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan, style: { padding: "var(--space-4)", textAlign: "center", color: "var(--text3)" }, children: "no results" }) })
          ] })
        ]
      }
    )
  ] });
}
var FILE_STATUS_MAP = {
  uploading: "loading",
  complete: "success",
  error: "error"
};
var FileUploader = ({
  files,
  onAdd,
  onRemove,
  accept,
  multiple = true,
  label = "drag and drop files here, or click to browse",
  ...aria
}) => {
  const [dragOver, setDragOver] = React2.useState(false);
  const inputId = React2.useId();
  function handleFiles(list) {
    if (list && list.length > 0) onAdd(list);
  }
  return /* @__PURE__ */ jsxs("div", { style: stack("var(--space-3)"), children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "file",
        id: inputId,
        accept,
        multiple,
        onChange: (e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        },
        style: srOnly
      }
    ),
    /* @__PURE__ */ jsx(
      "label",
      {
        htmlFor: inputId,
        tabIndex: 0,
        role: "button",
        "aria-label": aria["aria-label"] ?? label,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            document.getElementById(inputId)?.click();
          }
        },
        onDragOver: (e) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        },
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: "pointer",
          border: `var(--border-width) dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-card)",
          background: dragOver ? "var(--hover)" : "var(--bg2)",
          color: "var(--text2)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-sm)",
          transition: "background var(--transition-base), border-color var(--transition-base)"
        },
        children: label
      }
    ),
    files.length > 0 && /* @__PURE__ */ jsx("ul", { style: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }, children: files.map((f) => /* @__PURE__ */ jsxs("li", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-2)",
      padding: "var(--space-2) var(--space-3)",
      border: "var(--border-width) solid var(--border2)",
      borderRadius: "var(--radius-sm)"
    }, children: [
      /* @__PURE__ */ jsx("span", { style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, children: f.name }),
      /* @__PURE__ */ jsxs("div", { style: row("var(--space-2)"), children: [
        /* @__PURE__ */ jsx(InlineLoading, { status: FILE_STATUS_MAP[f.status], children: f.status === "error" ? f.errorMessage ?? "upload failed" : void 0 }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onRemove(f.id),
            "aria-label": `remove ${f.name}`,
            style: {
              fontFamily: "var(--font-icon)",
              fontSize: "var(--text-sm)",
              lineHeight: 1,
              background: "none",
              border: "none",
              color: "var(--text3)",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              flexShrink: 0
            },
            children: "times"
          }
        )
      ] })
    ] }, f.id)) })
  ] });
};
function flattenVisibleTree(nodes, expanded, depth = 0, parentId = null) {
  const out = [];
  for (const node of nodes) {
    out.push({ node, depth, parentId });
    if (node.children && node.children.length > 0 && expanded.has(node.id)) {
      out.push(...flattenVisibleTree(node.children, expanded, depth + 1, node.id));
    }
  }
  return out;
}
var TreeView = ({ nodes, expanded, onToggleExpand, selected, onSelect, ...aria }) => {
  const flat = React2.useMemo(() => flattenVisibleTree(nodes, expanded), [nodes, expanded]);
  const [activeId, setActiveId] = React2.useState(flat[0]?.node.id ?? "");
  const itemRefs = React2.useRef({});
  React2.useEffect(() => {
    if (flat.length > 0 && !flat.some((f) => f.node.id === activeId)) {
      setActiveId(flat[0].node.id);
    }
  }, [flat, activeId]);
  function focusId(id) {
    setActiveId(id);
    itemRefs.current[id]?.focus();
  }
  function onKeyDown(e, flatIdx) {
    const current = flat[flatIdx];
    if (!current) return;
    const hasChildren = !!(current.node.children && current.node.children.length > 0);
    const isExpanded = expanded.has(current.node.id);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatIdx < flat.length - 1) focusId(flat[flatIdx + 1].node.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatIdx > 0) focusId(flat[flatIdx - 1].node.id);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (hasChildren && !isExpanded) onToggleExpand(current.node.id);
      else if (hasChildren && isExpanded && flatIdx < flat.length - 1) focusId(flat[flatIdx + 1].node.id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (hasChildren && isExpanded) onToggleExpand(current.node.id);
      else if (current.parentId) focusId(current.parentId);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (flat[0]) focusId(flat[0].node.id);
    } else if (e.key === "End") {
      e.preventDefault();
      if (flat.length > 0) focusId(flat[flat.length - 1].node.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      haptic("tap");
      onSelect?.(current.node.id);
    }
  }
  return /* @__PURE__ */ jsx("div", { role: "tree", "aria-label": aria["aria-label"], style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)" }, children: flat.map((f, idx) => {
    const hasChildren = !!(f.node.children && f.node.children.length > 0);
    const isExpanded = expanded.has(f.node.id);
    const isSelected = selected === f.node.id;
    const isActive = activeId === f.node.id;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: (el) => {
          itemRefs.current[f.node.id] = el;
        },
        role: "treeitem",
        "aria-expanded": hasChildren ? isExpanded : void 0,
        "aria-selected": isSelected,
        "aria-level": f.depth + 1,
        tabIndex: isActive ? 0 : -1,
        onKeyDown: (e) => onKeyDown(e, idx),
        onClick: () => {
          setActiveId(f.node.id);
          haptic("tap");
          onSelect?.(f.node.id);
        },
        style: {
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          padding: "var(--space-1) var(--space-2)",
          paddingLeft: `calc(${f.depth} * var(--space-4) + var(--space-2))`,
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: isSelected ? "var(--accent)" : "transparent",
          color: isSelected ? "var(--on-accent)" : "var(--text)"
        },
        children: [
          hasChildren ? /* @__PURE__ */ jsx(
            "span",
            {
              "aria-hidden": "true",
              onClick: (e) => {
                e.stopPropagation();
                onToggleExpand(f.node.id);
              },
              style: { width: "1rem", flexShrink: 0, display: "inline-flex", justifyContent: "center" },
              children: /* @__PURE__ */ jsx(Chevron, { dir: isExpanded ? "down" : "right", style: isSelected ? { color: "inherit" } : void 0 })
            }
          ) : /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: { width: "1rem", flexShrink: 0 } }),
          /* @__PURE__ */ jsx(Icon, { name: f.node.icon ?? (hasChildren ? isExpanded ? "folder2" : "folder" : "file"), size: "sm" }),
          /* @__PURE__ */ jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: f.node.label }),
          f.node.badge && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", title: f.node.badge, style: {
            marginLeft: "auto",
            flexShrink: 0,
            paddingLeft: "var(--space-2)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: isSelected ? "inherit" : "var(--text3)"
          }, children: f.node.badge })
        ]
      },
      f.node.id
    );
  }) });
};
var ToastCtx = React2.createContext({ push: () => {
} });
function useToast() {
  return React2.useContext(ToastCtx);
}
var TOAST_COLOR = {
  info: "var(--accent)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)"
};
var ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React2.useState([]);
  function push(message, variant = "info", ms = 3500) {
    const id = Math.random().toString(36).slice(2);
    if (variant === "err") haptic("error");
    else if (variant === "ok") haptic("confirm");
    setToasts((p) => [...p, { id, message, variant }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), ms);
  }
  return /* @__PURE__ */ jsxs(ToastCtx.Provider, { value: { push }, children: [
    children,
    /* @__PURE__ */ jsx("div", { "aria-live": "polite", "aria-atomic": "false", style: {
      position: "fixed",
      bottom: "var(--space-4)",
      right: "var(--space-4)",
      zIndex: "var(--z-toast)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      pointerEvents: "none"
    }, children: toasts.map((t) => {
      const c = TOAST_COLOR[t.variant] ?? TOAST_COLOR.info;
      return /* @__PURE__ */ jsx(
        "div",
        {
          role: "status",
          onClick: () => setToasts((p) => p.filter((x) => x.id !== t.id)),
          style: {
            background: "var(--bg2)",
            color: "var(--text)",
            border: "var(--border-width) solid",
            borderColor: c,
            borderLeft: `0.25rem solid ${c}`,
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--elevation-2)",
            padding: "var(--space-2) var(--space-3)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-sm)",
            pointerEvents: "auto",
            maxWidth: "20rem",
            cursor: "pointer"
          },
          children: t.message
        },
        t.id
      );
    }) })
  ] });
};
var Divider = ({ orientation = "horizontal", label }) => {
  if (orientation === "vertical") return /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      "aria-orientation": "vertical",
      style: { width: "var(--border-width)", background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }
    }
  );
  if (label) return /* @__PURE__ */ jsxs("div", { role: "separator", style: { display: "flex", alignItems: "center", gap: "var(--space-2)" }, children: [
    /* @__PURE__ */ jsx("div", { style: { flex: 1, height: "var(--border-width)", background: "var(--border)" } }),
    /* @__PURE__ */ jsx("span", { style: { fontFamily: "var(--font-ui)", fontSize: "var(--text-xs)", color: "var(--text3)" }, children: label }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, height: "var(--border-width)", background: "var(--border)" } })
  ] });
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      "aria-orientation": "horizontal",
      style: { height: "var(--border-width)", background: "var(--border)", width: "100%" }
    }
  );
};
var Slider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  label,
  showValue = true,
  haptic: hapticOn = true,
  style,
  ...aria
}) => {
  const id = React2.useId();
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }, children: [
    (label || showValue) && /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--font-ui)",
      fontSize: "var(--text-xs)",
      color: "var(--text3)"
    }, children: [
      /* @__PURE__ */ jsx("span", { children: label }),
      showValue && /* @__PURE__ */ jsx("span", { children: value })
    ] }),
    /* @__PURE__ */ jsx(
      "input",
      {
        id,
        type: "range",
        className: "anto-slider",
        value,
        min,
        max,
        step,
        disabled,
        "aria-label": aria["aria-label"] ?? (typeof label === "string" ? label : void 0),
        onChange: onChange ? (e) => onChange(Number(e.target.value)) : void 0,
        onPointerUp: hapticOn ? () => haptic("toggle") : void 0,
        onKeyUp: hapticOn ? (e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") haptic("toggle");
        } : void 0,
        style
      }
    )
  ] });
};
var Splitter = ({
  orientation = "vertical",
  value,
  min = 6,
  max,
  step = 1,
  onResize,
  onDragChange,
  ...aria
}) => {
  const [dragging, setDragging] = React2.useState(false);
  const [hovered, setHovered] = React2.useState(false);
  function setFrom(next) {
    let v = next;
    if (v < min) v = min;
    if (max !== void 0 && v > max) v = max;
    onResize(v);
  }
  function onPointerDown(down) {
    down.currentTarget.setPointerCapture(down.pointerId);
    setDragging(true);
    onDragChange?.(true);
    const startAxis = orientation === "vertical" ? down.clientX : down.clientY;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const onMove = (e) => {
      const raw = orientation === "vertical" ? e.clientX - startAxis : startAxis - e.clientY;
      setFrom(value + raw / remPx);
    };
    const onUp = () => {
      setDragging(false);
      onDragChange?.(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function onKeyDown(e) {
    const grow = orientation === "vertical" ? e.key === "ArrowRight" : e.key === "ArrowUp";
    const shrink = orientation === "vertical" ? e.key === "ArrowLeft" : e.key === "ArrowDown";
    if (grow) {
      e.preventDefault();
      setFrom(value + step);
    } else if (shrink) {
      e.preventDefault();
      setFrom(value - step);
    }
  }
  const vertical = orientation === "vertical";
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      tabIndex: 0,
      "aria-orientation": orientation,
      "aria-label": aria["aria-label"] ?? "resize",
      "aria-valuenow": Math.round(value * 100) / 100,
      "aria-valuemin": min,
      "aria-valuemax": max,
      onPointerDown,
      onKeyDown,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        flex: "none",
        alignSelf: "stretch",
        background: dragging || hovered ? "var(--accent)" : "var(--border2)",
        cursor: vertical ? "col-resize" : "row-resize",
        transition: "background-color var(--transition-fast)",
        userSelect: "none",
        touchAction: "none",
        outlineOffset: "-0.125rem",
        ...vertical ? { width: "var(--space-2)" } : { height: "var(--space-2)" }
      }
    }
  );
};
var NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  size = "md",
  ...aria
}) => {
  function clamp2(n) {
    let v = n;
    if (min !== void 0) v = Math.max(min, v);
    if (max !== void 0) v = Math.min(max, v);
    return v;
  }
  function set(n) {
    if (!onChange) return;
    const clamped = clamp2(n);
    if (clamped !== value) onChange(clamped);
  }
  const atMin = min !== void 0 && value <= min;
  const atMax = max !== void 0 && value >= max;
  return /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "stretch" }, children: [
    /* @__PURE__ */ jsx(
      Btn,
      {
        variant: "default",
        size,
        disabled: disabled || atMin,
        "aria-label": "decrease",
        onClick: () => set(value - step),
        style: {
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          borderRight: "none",
          borderTopLeftRadius: "var(--radius-input)",
          borderBottomLeftRadius: "var(--radius-input)"
        },
        children: /* @__PURE__ */ jsx(Icon, { name: "plus1", size: "xs", "aria-hidden": "true", style: { transform: "rotate(180deg)" } })
      }
    ),
    /* @__PURE__ */ jsx(
      Input,
      {
        type: "number",
        value: String(value),
        disabled,
        size,
        "aria-label": aria["aria-label"] ?? "value",
        onChange: (v) => {
          const n = Number(v);
          if (Number.isFinite(n)) set(n);
        },
        style: { width: "3.5rem", textAlign: "center", borderRadius: 0 }
      }
    ),
    /* @__PURE__ */ jsx(
      Btn,
      {
        variant: "default",
        size,
        disabled: disabled || atMax,
        "aria-label": "increase",
        onClick: () => set(value + step),
        style: {
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: "none",
          borderTopRightRadius: "var(--radius-input)",
          borderBottomRightRadius: "var(--radius-input)"
        },
        children: "+"
      }
    )
  ] });
};
var PageHeader = ({ title, description, meta, actions, descriptionMaxWidth, onBack, backLabel = "back" }) => /* @__PURE__ */ jsxs("div", { style: stack("var(--space-1)"), children: [
  /* @__PURE__ */ jsxs("div", { style: row("var(--space-3)"), children: [
    onBack && /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", onClick: onBack, "aria-label": backLabel, children: /* @__PURE__ */ jsx(Icon, { name: "left", size: "sm" }) }),
    /* @__PURE__ */ jsx("h1", { style: headingPage, children: title }),
    meta && /* @__PURE__ */ jsx("span", { style: textMuted, children: meta }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1 } }),
    actions && /* @__PURE__ */ jsx("div", { style: row(), children: actions })
  ] }),
  description && /* @__PURE__ */ jsx("p", { style: { ...textMuted, margin: 0, maxWidth: descriptionMaxWidth, lineHeight: "var(--leading-normal)" }, children: description })
] });
var EmptyState = ({ icon, title, help, action }) => /* @__PURE__ */ jsxs("div", { style: {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-2)",
  textAlign: "center",
  padding: "var(--space-10) var(--space-4)",
  border: "var(--border-width) dashed var(--border2)",
  borderRadius: "var(--radius-card)",
  color: "var(--text3)"
}, children: [
  /* @__PURE__ */ jsx(Icon, { name: icon, size: "lg" }),
  /* @__PURE__ */ jsx("strong", { style: { ...textMono, color: "var(--text2)" }, children: title }),
  /* @__PURE__ */ jsx("p", { style: { ...textMuted, margin: 0, maxWidth: "30rem", lineHeight: "var(--leading-normal)" }, children: help }),
  action && /* @__PURE__ */ jsx("div", { style: { marginTop: "var(--space-2)" }, children: action })
] });
var FormField = ({ label, htmlFor, hint, help, children }) => /* @__PURE__ */ jsxs("div", { style: stack("var(--space-1)"), children: [
  /* @__PURE__ */ jsxs("span", { style: { display: "flex", alignItems: "center", gap: "var(--space-2)" }, children: [
    /* @__PURE__ */ jsx("label", { htmlFor, style: { ...textMuted, flexShrink: 0 }, children: label }),
    help && /* @__PURE__ */ jsx(Toggletip, { content: help, position: "right", "aria-label": "what is this?", children: /* @__PURE__ */ jsx("span", { role: "button", tabIndex: 0, style: { display: "inline-flex", color: "var(--text3)", cursor: "pointer", lineHeight: 1 }, children: /* @__PURE__ */ jsx(Icon, { name: "info", size: "sm", "aria-hidden": "true" }) }) })
  ] }),
  children,
  hint && /* @__PURE__ */ jsx("span", { style: { ...textMuted }, children: hint })
] });
var SectionHeader = ({ title, help, actions }) => /* @__PURE__ */ jsxs("div", { style: {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  margin: "var(--space-4) 0 var(--space-1)",
  fontWeight: 700,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  color: "var(--text)"
}, children: [
  /* @__PURE__ */ jsx("span", { children: title }),
  help && /* @__PURE__ */ jsx(Toggletip, { content: help, position: "right", "aria-label": "what is this?", children: /* @__PURE__ */ jsx("span", { role: "button", tabIndex: 0, style: { display: "inline-flex", color: "var(--text3)", cursor: "pointer", lineHeight: 1 }, children: /* @__PURE__ */ jsx(Icon, { name: "info", size: "sm", "aria-hidden": "true" }) }) }),
  actions && /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("span", { style: { flex: 1 } }),
    actions
  ] })
] });
var ActionModal = ({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "confirm",
  cancelLabel = "cancel",
  danger,
  disabled,
  loading,
  closeOnConfirm = false
}) => /* @__PURE__ */ jsx(
  Modal,
  {
    title,
    onClose: onCancel,
    footer: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Btn, { variant: "ghost", onClick: onCancel, children: cancelLabel }),
      /* @__PURE__ */ jsx(
        Btn,
        {
          variant: danger ? "danger" : "primary",
          disabled,
          loading,
          onClick: () => {
            onConfirm();
            if (closeOnConfirm) onCancel();
          },
          children: confirmLabel
        }
      )
    ] }),
    children
  }
);
function reviewDialogAllItems(props) {
  return props.groups ? props.groups.flatMap((g) => g.items) : props.items;
}
function ReviewDialog(props) {
  const {
    renderItem,
    renderGroupWarning,
    selected,
    onToggle,
    onSelectAll,
    onClear,
    allSelected,
    onEditItem,
    editLabel = "edit",
    onAction,
    actionLabel,
    actionVariant = "primary",
    confirm,
    badge,
    bannerColor = "var(--warn)",
    bannerMessage,
    reviewLabel = "review",
    title,
    selectAllLabel,
    intro,
    closeLabel = "close",
    pageSize = 25,
    canResolve
  } = props;
  const groups = props.groups;
  const [open, setOpen] = React2.useState(false);
  const [pendingConfirm, setPendingConfirm] = React2.useState(null);
  const all = reviewDialogAllItems(props);
  const { page, pageCount, setPage } = usePager(groups ? groups.length : all.length, pageSize);
  if (all.length === 0) return null;
  const visibleGroups = groups?.slice((page - 1) * pageSize, page * pageSize);
  const visibleItems = !groups ? all.slice((page - 1) * pageSize, page * pageSize) : void 0;
  function closeAndEdit(item) {
    setOpen(false);
    onEditItem?.(item);
  }
  function runAction() {
    const chosen = all.filter((i) => selected.has(i.id));
    if (chosen.length === 0) return;
    if (confirm) {
      setPendingConfirm(chosen);
      return;
    }
    onAction(chosen);
  }
  const emptiedGroups = pendingConfirm && groups ? groups.filter((g) => g.items.every((i) => pendingConfirm.some((p) => p.id === i.id))).length : 0;
  function renderRow(item) {
    return /* @__PURE__ */ jsxs("div", { style: row(), children: [
      /* @__PURE__ */ jsx(Checkbox, { checked: selected.has(item.id), onChange: () => onToggle(item.id), label: "" }),
      /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: renderItem(item) }),
      onEditItem && /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", onClick: () => closeAndEdit(item), children: editLabel })
    ] }, item.id);
  }
  const listCard = {
    border: "var(--border-width) solid var(--border2)",
    borderRadius: "var(--radius-card)",
    padding: "var(--space-2)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)"
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Alert, { color: bannerColor, action: canResolve && /* @__PURE__ */ jsx(Btn, { variant: "default", size: "sm", onClick: () => setOpen(true), children: reviewLabel }), children: [
      badge,
      /* @__PURE__ */ jsx("span", { style: textMuted, children: bannerMessage })
    ] }),
    open && canResolve && /* @__PURE__ */ jsx(Modal, { title, onClose: () => setOpen(false), footer: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Btn, { variant: "ghost", onClick: () => setOpen(false), children: closeLabel }),
      /* @__PURE__ */ jsx(Btn, { variant: actionVariant, onClick: runAction, disabled: selected.size === 0, children: actionLabel(selected.size) })
    ] }), children: /* @__PURE__ */ jsxs("div", { style: stack("var(--space-3)"), children: [
      intro && /* @__PURE__ */ jsx("p", { style: { ...textMuted, margin: 0 }, children: intro }),
      /* @__PURE__ */ jsx(Checkbox, { checked: allSelected, onChange: () => allSelected ? onClear() : onSelectAll(), label: selectAllLabel }),
      groups ? visibleGroups.map((group) => {
        const warning = group.items.every((i) => selected.has(i.id)) ? renderGroupWarning?.(group) : null;
        return /* @__PURE__ */ jsxs("div", { style: listCard, children: [
          warning,
          group.items.map(renderRow)
        ] }, group.key);
      }) : /* @__PURE__ */ jsx("div", { style: listCard, children: visibleItems.map(renderRow) }),
      /* @__PURE__ */ jsx(Pager, { page, pageCount, onPage: setPage, "aria-label": "pages" })
    ] }) }),
    pendingConfirm && confirm && /* @__PURE__ */ jsx(
      ActionModal,
      {
        title: confirm.title,
        confirmLabel: confirm.confirmLabel,
        danger: confirm.danger,
        onCancel: () => setPendingConfirm(null),
        onConfirm: () => {
          onAction(pendingConfirm);
          setPendingConfirm(null);
          setOpen(false);
        },
        children: confirm.message(pendingConfirm.length, emptiedGroups)
      }
    )
  ] });
}
function paletteScore(label, query) {
  const l = label.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const pos = [];
  let from = 0;
  for (const ch of q) {
    const i = l.indexOf(ch, from);
    if (i === -1) return -1;
    pos.push(i);
    from = i + 1;
  }
  const tier = l.startsWith(q) ? 3 : pos.some((p, i) => p === 0 || i > 0 && /[\/_\-. ]/.test(l[p - 1])) ? 2 : 1;
  return tier * 1e6 - (pos[pos.length - 1] - pos[0]) * 1e3 - l.length;
}
var CommandPalette = ({
  open,
  items,
  onRun,
  onClose,
  placeholder,
  emptyLabel = "no matches",
  ...aria
}) => {
  const [query, setQuery] = React2.useState("");
  const [active, setActive] = React2.useState(0);
  const boxRef = React2.useRef(null);
  const listRef = React2.useRef(null);
  const prevFocus = React2.useRef(null);
  useFocusTrap(boxRef, open);
  const shown = React2.useMemo(() => {
    if (!query.trim()) return items;
    return items.map((item) => ({ item, score: paletteScore(item.label, query) })).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label)).map((x) => x.item);
  }, [items, query]);
  React2.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    prevFocus.current = document.activeElement;
    return () => {
      prevFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);
  React2.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, shown.length - 1)));
  }, [shown.length]);
  React2.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);
  React2.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  const listId = "palette-list";
  function onKeyDown(e) {
    const n = shown.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => n ? (a + 1) % n : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => n ? (a - 1 + n) % n : 0);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, n - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = shown[active];
      if (it) {
        haptic("tap");
        onRun(it.id);
      }
    }
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": aria["aria-label"] ?? "command palette",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      style: {
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)"
      },
      children: /* @__PURE__ */ jsxs("div", { ref: boxRef, style: {
        position: "absolute",
        top: "var(--space-16)",
        left: 0,
        right: 0,
        margin: "0 auto",
        width: "min(36rem, 92vw)",
        maxHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--modal-bg)",
        border: "var(--border-width) solid var(--border)",
        borderRadius: "var(--radius-modal)",
        boxShadow: "var(--elevation-2)",
        overflow: "hidden"
      }, children: [
        /* @__PURE__ */ jsx("div", { style: { padding: "var(--space-2) var(--space-3)", borderBottom: "var(--border-width) solid var(--border)", flexShrink: 0 }, children: /* @__PURE__ */ jsx(
          Input,
          {
            value: query,
            onChange: setQuery,
            placeholder: placeholder ?? "type to filter",
            autoFocus: true,
            role: "combobox",
            "aria-expanded": true,
            "aria-controls": listId,
            "aria-activedescendant": shown[active] ? `palette-item-${shown[active].id}` : void 0,
            "aria-label": aria["aria-label"] ?? "command palette",
            onKeyDown
          }
        ) }),
        /* @__PURE__ */ jsxs(
          "ul",
          {
            ref: listRef,
            id: listId,
            role: "listbox",
            "aria-label": aria["aria-label"] ?? "results",
            style: { margin: 0, padding: "var(--space-1)", listStyle: "none", overflowY: "auto" },
            children: [
              shown.map((item, idx) => {
                const isActive = idx === active;
                return /* @__PURE__ */ jsxs(
                  "li",
                  {
                    id: `palette-item-${item.id}`,
                    role: "option",
                    "aria-selected": isActive,
                    "data-active": isActive,
                    onMouseEnter: () => setActive(idx),
                    onClick: () => {
                      haptic("tap");
                      onRun(item.id);
                    },
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--text-sm)",
                      cursor: "pointer",
                      background: isActive ? "var(--hover)" : "transparent",
                      color: "var(--text)"
                    },
                    children: [
                      item.icon && /* @__PURE__ */ jsx(Icon, { name: item.icon, size: "sm", "aria-hidden": "true" }),
                      /* @__PURE__ */ jsx("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.label }),
                      item.hint && /* @__PURE__ */ jsx("span", { style: { color: "var(--text3)", fontSize: "var(--text-xs)", flexShrink: 0 }, children: item.hint })
                    ]
                  },
                  item.id
                );
              }),
              shown.length === 0 && /* @__PURE__ */ jsx("li", { "aria-disabled": "true", style: {
                padding: "var(--space-3)",
                textAlign: "center",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--text-sm)",
                color: "var(--text3)"
              }, children: emptyLabel })
            ]
          }
        )
      ] })
    }
  );
};

// src/theme.ts
import * as React3 from "react";
var THEMES = [
  "original-light",
  "new-light",
  "original-dark",
  "dark",
  // alias: new-dark
  "red-dark"
];
var DEFAULT_THEME = "original-light";
var STORAGE_KEY = "anto-theme";
function setTheme(name) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = name;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
  }
}
function getTheme() {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.dataset.theme ?? (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  })();
}
function useTheme() {
  const [theme, setThemeState] = React3.useState(getTheme);
  const set = React3.useCallback((name) => {
    setTheme(name);
    setThemeState(name);
  }, []);
  React3.useEffect(() => {
    setTheme(theme);
  }, []);
  return [theme, set];
}
var COLOR_KEY = {
  bg: "--bg",
  bg2: "--bg2",
  bg3: "--bg3",
  text: "--text",
  text2: "--text2",
  text3: "--text3",
  accent: "--accent",
  accent2: "--accent2",
  border: "--border",
  border2: "--border2",
  ok: "--ok",
  warn: "--warn",
  err: "--err",
  hover: "--hover",
  modalBg: "--modal-bg"
};
var SHAPE_KEY = {
  radius: "--radius",
  radiusSm: "--radius-sm",
  radiusLg: "--radius-lg",
  radiusPill: "--radius-pill",
  radiusBtn: "--radius-btn",
  radiusInput: "--radius-input",
  radiusCard: "--radius-card",
  radiusModal: "--radius-modal",
  radiusTag: "--radius-tag",
  radiusDot: "--radius-dot",
  panelPadding: "--panel-padding"
};
var ELEVATION_KEY = {
  elevation1: "--elevation-1",
  elevation2: "--elevation-2",
  elevation3: "--elevation-3",
  elevationInset: "--elevation-inset"
};
var MOTION_KEY = {
  ease: "--ease",
  transitionFast: "--transition-fast",
  transitionBase: "--transition-base"
};
var TYPOGRAPHY_KEY = {
  fontUi: "--font-ui",
  fontDisplay: "--font-display",
  onAccent: "--on-accent",
  textScale: "--text-scale"
};
var FOCUS_KEY = {
  focusOutline: "--focus-outline",
  focusShadow: "--focus-shadow"
};
var BASE_PALETTES = {
  "original-light": {
    bg: "#fff",
    bg2: "#f5f5f5",
    bg3: "#e8e8e8",
    text: "#000",
    text2: "#444",
    text3: "#888",
    accent: "#00f",
    accent2: "#0000cc",
    border: "#000",
    border2: "#ccc",
    ok: "#060",
    warn: "#c90",
    err: "#c00",
    hover: "#fcfcfc",
    modalBg: "#fff"
  },
  "new-light": {
    bg: "#f8f8fb",
    bg2: "#eeeef4",
    bg3: "#e0e0ea",
    text: "#111118",
    text2: "#44444e",
    text3: "#888899",
    accent: "#4a54d4",
    accent2: "#3340b8",
    border: "#c0c0cc",
    border2: "#d4d4de",
    ok: "#1a8a44",
    warn: "#b07800",
    err: "#c01a1a",
    hover: "#e4e4ec",
    modalBg: "#f8f8fb"
  },
  "original-dark": {
    bg: "#0d0d0f",
    bg2: "#151517",
    bg3: "#1e1e22",
    text: "#ececf0",
    text2: "#9090a0",
    text3: "#50505a",
    accent: "#4466ff",
    accent2: "#2244cc",
    border: "#333340",
    border2: "#22222a",
    ok: "#33bb66",
    warn: "#ddaa22",
    err: "#ee4444",
    hover: "#1c1c22",
    modalBg: "#151517"
  },
  dark: {
    bg: "#111114",
    bg2: "#18181c",
    bg3: "#222228",
    text: "#e8e8ee",
    text2: "#9999aa",
    text3: "#55555f",
    accent: "#7c85f5",
    accent2: "#5a62d0",
    border: "#333340",
    border2: "#25252e",
    ok: "#4cd67a",
    warn: "#f5c842",
    err: "#f55050",
    hover: "#1e1e24",
    modalBg: "#18181c"
  },
  "red-dark": {
    bg: "#0a0000",
    bg2: "#1a0505",
    bg3: "#2a0808",
    text: "#f5d4d2",
    text2: "#d9a8a5",
    text3: "#b88683",
    accent: "#ff6b63",
    accent2: "#d94d45",
    border: "#d94d45",
    border2: "#52201c",
    ok: "#ff6b63",
    warn: "#ffdd55",
    err: "#ff3b33",
    hover: "#2a0808",
    modalBg: "#1a0505"
  }
};
var injected = null;
function ensureSheet() {
  if (!injected) {
    injected = document.createElement("style");
    injected.setAttribute("data-anto-custom-themes", "");
    document.head.appendChild(injected);
  }
  return injected;
}
function declsFor(keyMap, values) {
  if (!values) return [];
  return Object.entries(values).filter(([, v]) => v !== void 0).map(([k, v]) => `  ${keyMap[k]}: ${v};`);
}
function defineTheme(name, theme) {
  if (typeof document === "undefined") return;
  const sheet = ensureSheet();
  const resolvedColors = theme.base ? { ...BASE_PALETTES[theme.base], ...theme.colors } : theme.colors ?? {};
  const decls = [
    ...declsFor(COLOR_KEY, resolvedColors),
    ...declsFor(SHAPE_KEY, theme.shape),
    ...declsFor(ELEVATION_KEY, theme.elevation),
    ...declsFor(MOTION_KEY, theme.motion),
    ...declsFor(TYPOGRAPHY_KEY, theme.typography),
    ...declsFor(FOCUS_KEY, theme.focus)
  ].join("\n");
  sheet.textContent += `
[data-theme="${name}"] {
${decls}
}
`;
  if (theme.extraCss) {
    sheet.textContent += `
${theme.extraCss.replace(/&/g, `[data-theme="${name}"]`)}
`;
  }
}
function registerTheme(name, tokens) {
  defineTheme(name, { colors: tokens });
}
function setAccent(color) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (color === null) {
    root.removeProperty("--theme-accent");
    root.removeProperty("--accent");
  } else {
    root.setProperty("--theme-accent", color);
    root.setProperty("--accent", color);
  }
}
function setRadius(value) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty("--radius");
  else root.setProperty("--radius", value);
}
function setTextScale(value) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty("--text-scale");
  else root.setProperty("--text-scale", value);
}
function setFontUi(value) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty("--font-ui");
  else root.setProperty("--font-ui", value);
}
function setFontDisplay(value) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (value === null) root.removeProperty("--font-display");
  else root.setProperty("--font-display", value);
}
function warnUnresolvedPalette(name) {
  if (typeof console !== "undefined") {
    console.warn(
      `setPalette('${name}'): not one of the 5 built-in names (${THEMES.join(", ")}), so nothing was applied. A custom theme's colors live in an injected stylesheet, not a name-resolvable table. Pass its ThemeTokens object directly instead (e.g. setPalette(KONA_COLORS), not setPalette('kona')).`
    );
  }
  return {};
}
function setPalette(source) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (source === null) {
    for (const cssVar2 of Object.values(COLOR_KEY)) root.removeProperty(cssVar2);
    root.removeProperty("--theme-accent");
    return;
  }
  const tokens = typeof source === "string" ? BASE_PALETTES[source] ?? warnUnresolvedPalette(source) : source;
  for (const [key, value] of Object.entries(tokens)) {
    if (value === void 0) continue;
    root.setProperty(COLOR_KEY[key], value);
  }
}

// src/themes.ts
var KONA_COLORS = {
  bg: "#fdf6f4",
  bg2: "#f8ece9",
  bg3: "#f1ded9",
  text: "#3a2129",
  text2: "#6b4a52",
  text3: "#a17f86",
  accent: "#c2447a",
  accent2: "#9e3363",
  border: "#d4a3ad",
  border2: "#e0bcc2",
  ok: "#3f7a4f",
  warn: "#a8701f",
  err: "#a83a30",
  hover: "#f4e3e0",
  modalBg: "#fffaf9"
};
function applyKonaTheme() {
  defineTheme("kona", {
    base: "new-light",
    colors: KONA_COLORS,
    // tiered radius: cards and modals read rounder than buttons and inputs.
    // radiusDot is left unset so status dots stay square, since that square
    // shape carries meaning rather than decoration.
    shape: {
      radius: "0.75rem",
      radiusSm: "0.5rem",
      radiusLg: "1.25rem",
      radiusPill: "999px",
      radiusBtn: "0.625rem",
      radiusInput: "0.625rem",
      radiusCard: "1.25rem",
      radiusModal: "1.5rem"
    },
    // near-neutral shadow color with only a faint warm tint: a saturated
    // accent-hue shadow reads as a colored glow rather than depth, which
    // is the opposite of what elevation is for.
    elevation: {
      elevation1: "0 1px 3px rgba(45,20,28,.14), 0 1px 2px rgba(45,20,28,.10)",
      elevation2: "0 4px 16px rgba(45,20,28,.18), 0 2px 6px rgba(45,20,28,.10)",
      elevation3: "0 12px 32px rgba(45,20,28,.22), 0 4px 12px rgba(45,20,28,.12)",
      elevationInset: "inset 0 1px 3px rgba(45,20,28,.12)"
    },
    motion: { ease: "cubic-bezier(.32,.72,.35,1)" },
    // serif headings over a sans body, the display/body split with system
    // fallbacks so nothing breaks if the webfonts are not present.
    typography: {
      fontUi: "'Nunito', 'Quicksand', system-ui, sans-serif",
      fontDisplay: "'Fraunces', Georgia, serif",
      onAccent: "#fff"
    }
    // no focus override: --focus-outline already reads the accent, so it
    // re-colors to the rose of kona for free.
  });
}
var SKEUO_COLORS = {
  bg: "#f6f3ec",
  bg2: "#ede7db",
  bg3: "#e4dfd4",
  text: "#0e2036",
  text2: "#2b3b52",
  text3: "#b9b2a2",
  accent: "#0b3d91",
  accent2: "#123e6b",
  border: "#a89873",
  border2: "#c4b89a",
  ok: "#4c6b3e",
  warn: "#8a6a1e",
  err: "#9a3324",
  hover: "#efebe2",
  modalBg: "#ffffff"
};
function applySkeuoTheme() {
  defineTheme("skeuo", {
    colors: SKEUO_COLORS,
    // one small radius retiers every component token, since each aliases
    // --radius. radiusDot stays unset for the same reason as kona.
    shape: { radius: "0.125rem" },
    elevation: {
      elevation1: "0 2px 10px rgba(43,30,18,.10)",
      elevation2: "0 3px 6px rgba(43,30,18,.10), 0 16px 34px rgba(43,30,18,.12)",
      elevation3: "0 1px 2px rgba(43,30,18,.06), 0 10px 24px rgba(43,30,18,.08)",
      elevationInset: "inset 0 1px 4px rgba(43,30,18,.16), inset 0 0 0 1px rgba(43,30,18,.02)"
    },
    motion: { ease: "cubic-bezier(.4,0,.2,1)" },
    typography: {
      fontUi: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      fontDisplay: "'Cormorant Garamond', ui-serif, 'Times New Roman', serif",
      onAccent: "#ffffff"
    },
    // a shadow halo in place of the hard outline, so the focus ring sits
    // flush against the softer surfaces this theme draws.
    focus: {
      focusOutline: "none",
      focusShadow: "0 0 0 0.1875rem rgba(30,111,136,.32)"
    },
    // the one legitimate extraCss use: a page-level grain texture, not a
    // component token. a body background-image is not something any widget
    // styles, so the escape hatch is the right home for it.
    extraCss: `
      & body {
        background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTIwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44NScgbnVtT2N0YXZlcz0nMicgc3RpdGNoVGlsZXM9J3N0aXRjaCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbHRlcj0ndXJsKCUyM24pJyBvcGFjaXR5PScwLjA1Jy8+PC9zdmc+");
        background-repeat: repeat;
      }
    `
  });
}

// src/pwa.ts
import * as React4 from "react";
function buildManifest(opts) {
  return {
    name: opts.name,
    short_name: opts.shortName ?? opts.name,
    description: opts.description ?? "",
    start_url: opts.startUrl ?? ".",
    display: opts.display ?? "standalone",
    background_color: opts.backgroundColor ?? "#111114",
    theme_color: opts.themeColor ?? "#4466ff",
    icons: opts.icons ?? []
  };
}
function injectManifest(opts) {
  if (typeof document === "undefined") return;
  const json = JSON.stringify(buildManifest(opts));
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = url;
}
function registerServiceWorker(opts = {}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const url = opts.url ?? "/sw.js";
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(url).then((reg) => {
      opts.onSuccess?.(reg);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            opts.onUpdate?.(reg);
          }
        });
      });
    }).catch(() => {
    });
  });
}
function usePWAInstall() {
  const deferred = React4.useRef(null);
  const [installable, setInstallable] = React4.useState(false);
  const [installed, setInstalled] = React4.useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches === true
  );
  React4.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (e) => {
      e.preventDefault();
      deferred.current = e;
      setInstallable(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallable(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const promptInstall = React4.useCallback(async () => {
    if (!deferred.current) return "unavailable";
    await deferred.current.prompt();
    const { outcome } = await deferred.current.userChoice;
    deferred.current = null;
    setInstallable(false);
    return outcome;
  }, []);
  return { installable, installed, promptInstall };
}
function useOnline() {
  const [online, setOnline] = React4.useState(
    () => typeof navigator === "undefined" ? true : navigator.onLine
  );
  React4.useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}
export {
  Accordion,
  ActionModal,
  Alert,
  BADGE_STYLE,
  BTN_HOVER,
  BTN_VAR,
  Badge,
  Breadcrumb,
  Btn,
  Checkbox,
  ChipRow,
  CodeSnippet,
  Collapse,
  ColorChip,
  ComboBox,
  CommandPalette,
  ContentSwitcher,
  CopyButton,
  DataTable,
  Divider,
  EmptyState,
  FileUploader,
  FormField,
  Icon,
  IconBtn,
  InlineLoading,
  Input,
  KONA_COLORS,
  Link,
  List,
  Menu,
  Modal,
  NavRail,
  NumberInput,
  PageHeader,
  Pager,
  PalettePicker,
  ProgressBar,
  ProgressIndicator,
  Radio,
  ReviewDialog,
  SKEUO_COLORS,
  STATUS_COLOR,
  Search,
  SectionHeader,
  Select,
  Sidebar,
  Skeleton,
  Slider,
  Spinner,
  SplitButton,
  Splitter,
  StatusBar,
  StatusDot,
  TAG_STYLE,
  THEMES,
  TOAST_COLOR,
  TabStrip,
  Tabs,
  Tag,
  Textarea,
  Tile,
  ToastProvider,
  ToggleSwitch,
  Toggletip,
  Tooltip,
  TreeView,
  applyKonaTheme,
  applySkeuoTheme,
  buildManifest,
  cssVar,
  defineTheme,
  flexItem,
  getTheme,
  grid,
  haptic,
  hapticsEnabled,
  headingPage,
  headingSection,
  injectManifest,
  pageRoot,
  paletteScore,
  panel,
  readableOn,
  registerHapticPattern,
  registerServiceWorker,
  registerTheme,
  resolveColor,
  row,
  setAccent,
  setFontDisplay,
  setFontUi,
  setHapticsEnabled,
  setIconSet,
  setPalette,
  setRadius,
  setTextScale,
  setTheme,
  sidebarLayout,
  srOnly,
  stack,
  tableBase,
  tableCell,
  tableCellActions,
  tableHeadCell,
  tableHeadRow,
  tableRow,
  textMono,
  textMuted,
  textSecondary,
  toHex,
  useAsync,
  useClickOutside,
  useInterval,
  useMediaQuery,
  useNow,
  useOnline,
  usePWAInstall,
  usePager,
  usePrefersReducedMotion,
  useRoving,
  useSelection,
  useStore,
  useTheme,
  useToast
};
