#!/usr/bin/env python3
"""Quiet board pulse for a role. Prints only on change (or --verbose).

Default: every 5 minutes; exit after 4 idle ticks with no tasks/inbox.
Uses shared harness: python3 scripts/comms.py pulse
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


def pulse(role: str) -> str:
    p = subprocess.run(
        [sys.executable, "scripts/comms.py", "pulse", "--role", role],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return (p.stdout or "").strip() or f"{role}: harness_error"


def is_idle(line: str) -> bool:
    # standby counts as idle only with empty inbox (inbox must wake the poller)
    if "inbox" in line:
        return False
    return (
        " idle " in f" {line} "
        or " standby " in f" {line} "
        or line.endswith("idle — wait; do not explore")
        or "— wait; do not explore" in line
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", required=True, choices=("carne", "cricri", "vps"))
    ap.add_argument("--interval", type=int, default=INTERVAL_SEC)
    ap.add_argument("--idle-stop", type=int, default=IDLE_STOP)
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    idle = 0
    tick = 0
    last = ""
    while True:
        tick += 1
        line = pulse(args.role)
        changed = line != last
        last = line
        if args.verbose or changed:
            print(f"[poll #{tick}] {line}", flush=True)

        if is_idle(line):
            idle += 1
            if idle >= args.idle_stop:
                if args.verbose or changed:
                    print(f"[poll] stop after {idle} idle", flush=True)
                return 0
        else:
            idle = 0

        if args.once:
            return 0
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
