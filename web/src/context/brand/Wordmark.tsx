import React from "react";

type P = { compact?: boolean };

export function Wordmark({ compact = false }: P): React.ReactElement {
  const px = compact ? 16 : 32;
  const size = compact ? 8 : 16;
  return (
    <span
      aria-label="Termal Wave"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 6 : 8,
        fontFamily: '"Press Start 2P", ui-monospace, monospace',
        fontSize: size,
        lineHeight: 1,
        color: "var(--acc-fg)",
      }}
    >
      <img
        src="./brand/icon-32.png"
        alt=""
        width={px}
        height={px}
        decoding="async"
        style={{ imageRendering: "pixelated", width: px, height: px }}
      />
      TERMAL WAVE
    </span>
  );
}
