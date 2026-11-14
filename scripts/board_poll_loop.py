#!/usr/bin/env python3
"""Poll open board tasks for a role every 5 minutes.

Stop after N consecutive idle intervals (no open/in_progress tasks for the
role, and no new inbox files). Default: 4 idle ticks -> exit.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERVAL_SEC = 5 * 60
IDLE_STOP = 4


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return (p.stdout or "") + (p.stderr or "")


def open_tasks(role: str) -> list[str]:
    out = run([sys.executable, "scripts/comms.py", "status", "--role", role])
    lines = []
    for line in out.splitlines():
        if f"@{role}" in line or (line.startswith("T") and f"[{role}]" in line):
            lines.append(line.strip())
        # status format: T011 [open] ... under "board (yours)"
        if line.strip().startswith("T") and "[" in line and "]" in line:
            # only count when inside "yours" section — heuristic: collected after marker
            pass
    yours = False
    found: list[str] = []
    for line in out.splitlines():
        if "board (yours)" in line:
            yours = True
            continue
        if yours and line.startswith("---"):
            break
        if yours and line.strip().startswith("T"):
            found.append(line.strip())
        if yours and "(none)" in line:
            break
    return found


def new_inbox(role: str, seen: set[str]) -> list[str]:
    inbox = ROOT / "comms" / role / "inbox"
    if not inbox.is_dir():
        return []
    files = sorted(p.name for p in inbox.glob("*.md") if p.name != ".gitkeep")
    fresh = [f for f in files if f not in seen]
    seen.update(files)
    return fresh


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", required=True, choices=("carne", "cricri", "vps"))
    ap.add_argument("--interval", type=int, default=INTERVAL_SEC)
    ap.add_argument("--idle-stop", type=int, default=IDLE_STOP)
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    seen: set[str] = set()
    new_inbox(args.role, seen)  # seed
    idle = 0
    tick = 0
    while True:
        tick += 1
        tasks = open_tasks(args.role)
        inbox = new_inbox(args.role, seen)
        busy = bool(tasks) or bool(inbox)
        print(
            f"[poll {args.role} #{tick}] tasks={len(tasks)} inbox_new={len(inbox)} idle={idle}",
            flush=True,
        )
        for t in tasks:
            print(f"  task: {t}", flush=True)
        for f in inbox:
            print(f"  inbox: {f}", flush=True)

        if busy:
            idle = 0
            print(
                f"[poll {args.role}] work pending — do it, then this loop sleeps",
                flush=True,
            )
        else:
            idle += 1
            print(f"[poll {args.role}] idle tick {idle}/{args.idle_stop}", flush=True)
            if idle >= args.idle_stop:
                print(f"[poll {args.role}] stop: {args.idle_stop} idle intervals", flush=True)
                return 0

        if args.once:
            return 0
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
