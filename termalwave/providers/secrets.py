"""Load credentials from env and gitignored secrets.local.toml."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path
from typing import Any


def load_credentials(repo_root: Path, apis: dict[str, Any]) -> dict[str, str]:
    creds: dict[str, str] = {}
    secrets_rel = apis.get("paths", {}).get("secrets_local", "config/secrets.local.toml")
    secrets_path = Path(secrets_rel)
    if not secrets_path.is_absolute():
        secrets_path = (repo_root / secrets_path).resolve()
    if secrets_path.is_file():
        with secrets_path.open("rb") as fh:
            data = tomllib.load(fh)
        for key, value in (data.get("credentials") or {}).items():
            if value is None:
                continue
            text = str(value).strip()
            if text:
                creds[str(key)] = text

    # Env overrides / fills empty secrets. Catalog: docs/APIS.md
    for env_name in (
        "EARTHDATA_TOKEN",
        "FIRMS_MAP_KEY",
        "METEOMATICS_USER",
        "METEOMATICS_PASSWORD",
        "PLANETARY_COMPUTER_TOKEN",
        "AISSTREAM_API_KEY",
        "OPENSKY_CLIENT_ID",
        "OPENSKY_CLIENT_SECRET",
        "TOMTOM_API_KEY",
        "GOOGLE_MAPS_API_KEY",
        "GOOGLE_MAPS_SERVER_API_KEY",
        "CESIUM_ION_TOKEN",
    ):
        val = os.environ.get(env_name, "").strip()
        if val:
            creds[env_name] = val
    return creds


def require_credential(creds: dict[str, str], name: str) -> str | None:
    if not name:
        return ""
    value = creds.get(name, "").strip()
    return value or None
