"""Load offline fixture payloads for adapters."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any


def fixture_path(fixtures_dir: Path, name: str, suffix: str) -> Path:
    return fixtures_dir / name / f"sample.{suffix}"


def load_json_fixture(fixtures_dir: Path, name: str) -> Any:
    path = fixture_path(fixtures_dir, name, "json")
    if not path.is_file():
        raise FileNotFoundError(f"Missing fixture: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_csv_fixture(fixtures_dir: Path, name: str) -> list[dict[str, str]]:
    path = fixture_path(fixtures_dir, name, "csv")
    if not path.is_file():
        raise FileNotFoundError(f"Missing fixture: {path}")
    text = path.read_text(encoding="utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def parse_csv_text(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))
