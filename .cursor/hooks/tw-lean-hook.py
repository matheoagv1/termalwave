#!/usr/bin/env python3
"""Lean Cursor hook: remind pulse/protocol/wake. No board.toml briefing."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    root = Path.cwd()
    lines = [
        "[tw] pulse first; brief_fetch only if brief_hash changed.",
        "PROTOCOLO: notify topics start|leave|pending|handoff + task set + presence.",
        "Idle + empty inbox/wakes => stop. Edit only own roots / task.paths.",
        "Hub MC https://159.195.157.171:7421 — board is tw, not comms/board.toml.",
    ]
    wake = root / ".tw" / "wake.json"
    stamp = root / ".tw" / "hook.stamp"
    if wake.is_file() and (
        not stamp.is_file() or wake.stat().st_mtime > stamp.stat().st_mtime
    ):
        try:
            lines.append("tw woken: " + wake.read_text(encoding="utf-8").strip()[:200])
        except OSError:
            lines.append("tw woken: (wake.json unreadable)")
    try:
        stamp.parent.mkdir(parents=True, exist_ok=True)
        stamp.write_text("", encoding="utf-8")
    except OSError:
        pass

    event = str(payload.get("hook_event_name") or "")
    out: dict = {"additional_context": "\n".join(lines)}
    if event == "beforeSubmitPrompt" or "prompt" in event.lower():
        out["continue"] = True
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
