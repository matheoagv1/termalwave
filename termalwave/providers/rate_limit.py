"""process-wide rate limiter for free providers (stdlib only)."""

from __future__ import annotations

import threading
import time
from typing import Any


_LOCK = threading.Lock()
_LAST: dict[str, float] = {}


def parse_rate_limit(spec: str | None) -> float:
    """return minimum seconds between calls. empty -> 0."""
    if not spec:
        return 0.0
    text = str(spec).strip().lower().replace(" ", "")
    if not text:
        return 0.0
    if "/" not in text:
        return float(text)
    count_s, unit = text.split("/", 1)
    count = max(float(count_s), 1.0)
    if unit in ("s", "sec", "second", "seconds"):
        period = 1.0
    elif unit in ("m", "min", "minute", "minutes"):
        period = 60.0
    elif unit in ("h", "hr", "hour", "hours"):
        period = 3600.0
    elif unit in ("d", "day", "days"):
        period = 86400.0
    else:
        period = 1.0
    return period / count


def wait(key: str, min_interval_s: float) -> None:
    if min_interval_s <= 0:
        return
    with _LOCK:
        now = time.monotonic()
        last = _LAST.get(key, 0.0)
        delay = min_interval_s - (now - last)
        if delay > 0:
            time.sleep(delay)
            now = time.monotonic()
        _LAST[key] = now


def wait_from_meta(name: str, meta: dict[str, Any], kind_cfg: dict[str, Any] | None = None) -> None:
    spec = meta.get("rate_limit")
    if not spec and kind_cfg:
        spec = kind_cfg.get("rate_limit")
    wait(name, parse_rate_limit(str(spec) if spec is not None else ""))
