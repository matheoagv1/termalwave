"""Throwaway repo root for tests that run writers, so committed outputs stay put."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# read-only inputs the writers look up relative to repo_root
_LINKED = ("config", "web/src/context", "tests/fixtures")
# copied, not linked: offline runs may refresh snapshots in the cache
_COPIED = ("data/fixtures", "data/cache")
_EMPTY = ("web/public", "web/dist", "data/processed")


def sandbox_root(test: unittest.TestCase) -> Path:
    root = Path(tempfile.mkdtemp(prefix="tw-test-"))
    test.addCleanup(shutil.rmtree, root, ignore_errors=True)
    for rel in _LINKED:
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(REPO / rel, target_is_directory=True)
    for rel in _COPIED:
        shutil.copytree(REPO / rel, root / rel)
    for rel in _EMPTY:
        (root / rel).mkdir(parents=True, exist_ok=True)
    return root
