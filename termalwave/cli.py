"""Command-line interface for TermalWave."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Bootstrap before any third-party imports used by subcommands.
from termalwave._bootstrap import (
    REQUIRED_PYTHON,
    SUPPORTED_TAGS,
    ensure_vendored,
)
from termalwave.runtime_config import REPO_ROOT, default_site_config


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="termalwave",
        description="Process NISAR HDF5 granules into georeferenced PNG overlays.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Run the processing pipeline")
    run.add_argument(
        "--config",
        type=Path,
        default=default_site_config(),
        help=f"Path to TOML config (default: {default_site_config().relative_to(REPO_ROOT)})",
    )
    run.add_argument(
        "--offline",
        action="store_true",
        help="Skip downloads; use local inputs and fixtures only",
    )
    run.add_argument(
        "--verify-vendor",
        action="store_true",
        help="Verify vendor SHA256 hashes from vendor/manifest.json",
    )

    sub.add_parser("info", help="Show platform / vendor bootstrap info")
    return parser


def cmd_info() -> int:
    from termalwave._bootstrap import active_tag, vendor_dir_for_tag

    tag = active_tag() or "unknown"
    vendor = vendor_dir_for_tag(tag)
    major, minor = REQUIRED_PYTHON
    print(f"Python: {sys.version.split()[0]} (required {major}.{minor}.x)")
    print(f"Active vendor tag: {tag}")
    print(f"Vendor path: {vendor}")
    print(f"Supported tags: {', '.join(SUPPORTED_TAGS)}")
    print(f"Default config: {default_site_config()}")
    return 0


def cmd_run(config: Path, offline: bool, verify_vendor: bool) -> int:
    ensure_vendored(verify=verify_vendor)
    from termalwave.process.pipeline import run_pipeline

    result = run_pipeline(config_path=config, offline=offline, repo_root=REPO_ROOT)
    print(f"Wrote overlay: {result['png']}")
    print(f"Wrote sidecar: {result['sidecar']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "info":
        return cmd_info()
    if args.command == "run":
        return cmd_run(args.config, args.offline, args.verify_vendor)

    parser.error(f"Unknown command: {args.command}")
    return 2
