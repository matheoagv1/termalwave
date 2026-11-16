"""Load config/runtime.json (stdlib only — used by bootstrap before vendored imports)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
RUNTIME_PATH = REPO_ROOT / "config" / "runtime.json"


@lru_cache(maxsize=1)
def load_runtime() -> dict[str, Any]:
    if not RUNTIME_PATH.is_file():
        raise SystemExit(
            f"TermalWave bootstrap error: missing runtime config {RUNTIME_PATH}"
        )
    return json.loads(RUNTIME_PATH.read_text(encoding="utf-8"))


def required_python() -> tuple[int, int]:
    py = load_runtime()["python"]
    return int(py["major"]), int(py["minor"])


def supported_tags() -> tuple[str, ...]:
    return tuple(str(p["tag"]) for p in load_runtime()["platforms"])


def platform_entries() -> list[dict[str, Any]]:
    return list(load_runtime()["platforms"])


def runtime_paths() -> dict[str, Path]:
    raw = load_runtime()["paths"]
    return {key: REPO_ROOT / value for key, value in raw.items()}


def default_site_config() -> Path:
    return runtime_paths()["default_config"]
