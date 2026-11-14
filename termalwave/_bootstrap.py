"""Detect platform and prepend the matching vendored site-packages path.

Must run before importing numpy, h5py, or Pillow. Uses only the standard library.
Platform tags and required Python come from config/runtime.json (zero hardcoding).
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import sys
from pathlib import Path

from termalwave.runtime_config import (
    REPO_ROOT,
    load_runtime,
    platform_entries,
    required_python,
    runtime_paths,
    supported_tags,
)

_bootstrapped = False
_active_tag: str | None = None

REQUIRED_PYTHON = required_python()
SUPPORTED_TAGS = supported_tags()


def _is_musl() -> bool:
    """Return True when running on a musl libc (e.g. Alpine Linux)."""
    runtime = load_runtime()
    try:
        import ctypes

        libc = ctypes.CDLL(None)
        if hasattr(libc, "gnu_get_libc_version"):
            return False
    except OSError:
        pass

    machine = platform.machine() or ""
    for template in runtime.get("musl_path_templates", []):
        path = template.replace("{machine}", machine)
        if os.path.exists(path):
            return True

    markers = tuple(runtime.get("musl_map_markers", []))
    if markers:
        try:
            with open("/proc/self/maps", encoding="utf-8", errors="ignore") as maps:
                for line in maps:
                    if any(marker in line for marker in markers):
                        return True
        except OSError:
            pass

    libc_name, _ = platform.libc_ver()
    return "musl" in libc_name.lower()


def detect_platform_tag() -> str:
    """Return the vendor folder tag for the current interpreter."""
    system = platform.system()
    machine = (platform.machine() or "").lower()
    musl = _is_musl() if system == "Linux" else False

    for entry in platform_entries():
        if entry["system"] != system:
            continue
        machines = [m.lower() for m in entry.get("machines", [])]
        if machine not in machines:
            continue
        libc = entry.get("libc")
        if system == "Linux":
            if libc == "musl" and not musl:
                continue
            if libc == "glibc" and musl:
                continue
        return str(entry["tag"])

    tags = ", ".join(supported_tags())
    _fail(
        f"No platform mapping for system={system!r} machine={machine!r} "
        f"musl={musl}. Supported vendor tags: {tags}."
    )
    raise AssertionError("unreachable")


def _fail(message: str) -> None:
    major, minor = required_python()
    tags = ", ".join(supported_tags())
    vendor_root = runtime_paths()["vendor_python"]
    raise SystemExit(
        f"TermalWave bootstrap error: {message}\n"
        f"Required Python: {major}.{minor}.x "
        f"(this interpreter is {sys.version.split()[0]})\n"
        f"Supported vendor tags: {tags}\n"
        f"Expected folder: {vendor_root}/<tag>/\n"
        "Rebuild vendors on the VPS with: bash scripts/vendor.sh"
    )


def vendor_dir_for_tag(tag: str | None = None) -> Path:
    tag = tag or detect_platform_tag()
    return runtime_paths()["vendor_python"] / tag


def verify_manifest(tag: str | None = None) -> None:
    """Verify SHA256 hashes recorded in vendor/manifest.json for the active tag."""
    tag = tag or detect_platform_tag()
    manifest_path = runtime_paths()["manifest"]
    if not manifest_path.is_file():
        raise SystemExit(
            f"TermalWave bootstrap error: missing {manifest_path}. "
            "Rebuild vendors with: bash scripts/vendor.sh"
        )

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    platforms = payload.get("platforms", {})
    entries = platforms.get(tag)
    if not entries:
        raise SystemExit(
            f"TermalWave bootstrap error: tag {tag!r} missing from manifest."
        )

    vendor_dir = vendor_dir_for_tag(tag)
    for entry in entries:
        rel = entry["path"]
        expected = entry["sha256"]
        target = vendor_dir / rel
        if not target.is_file():
            raise SystemExit(
                f"TermalWave bootstrap error: missing vendored file {target}"
            )
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if digest != expected:
            raise SystemExit(
                f"TermalWave bootstrap error: SHA256 mismatch for {rel}\n"
                f"  expected: {expected}\n"
                f"  actual:   {digest}"
            )


def ensure_vendored(verify: bool = False) -> Path:
    """Prepend the matching vendor directory to sys.path. Idempotent."""
    global _bootstrapped, _active_tag

    major, minor = required_python()
    if sys.version_info[:2] != (major, minor):
        _fail(f"Python {major}.{minor}.x is required.")

    load_runtime()

    tag = detect_platform_tag()
    vendor_dir = vendor_dir_for_tag(tag)
    vendor_root = runtime_paths()["vendor_python"]
    if not vendor_dir.is_dir():
        available = sorted(
            p.name for p in vendor_root.iterdir() if p.is_dir()
        ) if vendor_root.is_dir() else []
        avail_msg = ", ".join(available) if available else "(none found)"
        _fail(
            f"No vendored libraries for tag {tag!r}. "
            f"Present tags: {avail_msg}."
        )

    path_str = str(vendor_dir)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

    if verify:
        verify_manifest(tag)

    _bootstrapped = True
    _active_tag = tag
    return vendor_dir


def active_tag() -> str | None:
    return _active_tag


ensure_vendored(verify=False)

__all__ = [
    "REQUIRED_PYTHON",
    "SUPPORTED_TAGS",
    "REPO_ROOT",
    "active_tag",
    "detect_platform_tag",
    "ensure_vendored",
    "vendor_dir_for_tag",
    "verify_manifest",
]
