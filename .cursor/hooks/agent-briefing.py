#!/usr/bin/env python3.11
"""Cursor hook: inject TermalWave STEERS + board + inbox briefing."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def repo_root_from_hook() -> Path:
    # .cursor/hooks/agent-briefing.py → repo root
    return Path(__file__).resolve().parents[2]


def detect_role(workspace_roots: list[str]) -> str:
    roots = workspace_roots or [str(Path.cwd())]
    joined = " ".join(roots)
    if "nasaspaceappchallenge-cricri" in joined:
        return "cricri"
    if "nasaspaceappchallenge-carne" in joined:
        return "carne"
    return "vps"


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    root = repo_root_from_hook()
    role = detect_role(list(payload.get("workspace_roots") or []))
    script = root / "scripts" / "comms.py"
    briefing = ""
    if script.is_file():
        try:
            proc = subprocess.run(
                [sys.executable, str(script), "briefing", "--role", role],
                check=False,
                capture_output=True,
                text=True,
                cwd=str(root),
                timeout=8,
            )
            briefing = (proc.stdout or "").strip()
        except (OSError, subprocess.TimeoutExpired):
            briefing = f"[TermalWave coord] role={role}; failed to run scripts/comms.py briefing"

    if not briefing:
        briefing = (
            f"[TermalWave coord] role={role}. "
            "Read comms/STEERS.md, comms/board.toml, and your inbox."
        )

    event = payload.get("hook_event_name") or ""
    out: dict = {
        "additional_context": briefing,
        "env": {"TW_AGENT_ROLE": role, "TW_REPO_ROOT": str(root)},
    }
    # beforeSubmitPrompt supports continue; sessionStart ignores unknown fields safely.
    if event == "beforeSubmitPrompt" or "prompt" in event.lower():
        out["continue"] = True
    # stop: do not auto-followup; keep quiet unless we want a nudge via agent_message (unsupported on stop)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
