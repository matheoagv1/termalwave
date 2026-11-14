#!/usr/bin/env python3
"""Cursor hook: inject lean TermalWave board briefing (shared harness)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def repo_root_from_hook() -> Path:
    return Path(__file__).resolve().parents[2]


def detect_role(workspace_roots: list[str]) -> str:
    roots = workspace_roots or [str(Path.cwd())]
    joined = " ".join(roots)
    if "nasaspaceappchallenge-cricri" in joined:
        return "cricri"
    if "nasaspaceappchallenge-carne" in joined:
        return "carne"
    return "vps"


def primary_root(here: Path) -> Path:
    name = here.name
    for suffix in ("-carne", "-cricri"):
        if name.endswith(suffix):
            candidate = here.parent / name[: -len(suffix)]
            if (candidate / "scripts" / "comms.py").is_file():
                return candidate
    return here


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    root = repo_root_from_hook()
    primary = primary_root(root)
    role = detect_role(list(payload.get("workspace_roots") or []))
    # Prefer primary scripts so worktrees share harness logic even before merge.
    script = primary / "scripts" / "comms.py"
    if not script.is_file():
        script = root / "scripts" / "comms.py"

    briefing = ""
    if script.is_file():
        env = os.environ.copy()
        env["TW_AGENT_ROLE"] = role
        env["TW_PRIMARY_ROOT"] = str(primary)
        env["TW_COMMS_ROOT"] = str(primary / "comms")
        try:
            proc = subprocess.run(
                [sys.executable, str(script), "briefing", "--role", role],
                check=False,
                capture_output=True,
                text=True,
                cwd=str(root),
                timeout=8,
                env=env,
            )
            briefing = (proc.stdout or "").strip()
            if proc.returncode != 0 and not briefing:
                briefing = f"[TermalWave] role={role} harness_error"
        except (OSError, subprocess.TimeoutExpired):
            briefing = f"[TermalWave] role={role} harness_timeout"

    if not briefing:
        briefing = f"[TermalWave] role={role}. python3 scripts/comms.py pulse"

    event = payload.get("hook_event_name") or ""
    out: dict = {
        "additional_context": briefing,
        "env": {
            "TW_AGENT_ROLE": role,
            "TW_REPO_ROOT": str(root),
            "TW_PRIMARY_ROOT": str(primary),
            "TW_COMMS_ROOT": str(primary / "comms"),
        },
    }
    if event == "beforeSubmitPrompt" or "prompt" in event.lower():
        out["continue"] = True
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
