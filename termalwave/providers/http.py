"""Minimal stdlib HTTP helpers for providers."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class ProviderHttpError(RuntimeError):
    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def http_get(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 45.0,
) -> bytes:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise ProviderHttpError(f"HTTP {exc.code} for {url}", status=exc.code) from exc
    except urllib.error.URLError as exc:
        raise ProviderHttpError(f"URL error for {url}: {exc.reason}") from exc


def http_get_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 45.0,
) -> Any:
    raw = http_get(url, headers=headers, timeout=timeout)
    return json.loads(raw.decode("utf-8"))


def http_get_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 45.0,
) -> str:
    return http_get(url, headers=headers, timeout=timeout).decode("utf-8")


def build_url(base: str, query: dict[str, Any]) -> str:
    filtered = {k: v for k, v in query.items() if v is not None}
    return f"{base}?{urllib.parse.urlencode(filtered, doseq=True)}"
