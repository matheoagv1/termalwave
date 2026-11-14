"""Build provider instances from config/apis.toml only (no hardcoded order)."""

from __future__ import annotations

import importlib
import tomllib
from pathlib import Path
from typing import Any, Callable


def load_apis_config(repo_root: Path, path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or (repo_root / "config" / "apis.toml")
    if not cfg_path.is_absolute():
        cfg_path = (repo_root / cfg_path).resolve()
    with cfg_path.open("rb") as fh:
        return tomllib.load(fh)


def _import_factory(module_path: str) -> Callable[..., Any]:
    module = importlib.import_module(module_path)
    factory = getattr(module, "build", None)
    if factory is None:
        raise AttributeError(f"{module_path} missing build()")
    return factory


def order_for_kind(apis: dict[str, Any], kind: str, *, order_key: str | None = None) -> list[str]:
    """Resolve provider order from config. Geocode uses search/reverse lists."""
    section = apis.get(kind) or {}
    if order_key:
        return list(section.get(order_key) or [])
    order = list(section.get("order") or [])
    if order:
        return order
    if kind == "geocode":
        seen: list[str] = []
        for key in ("search", "reverse"):
            for name in section.get(key) or []:
                if name not in seen:
                    seen.append(str(name))
        return seen
    return []


def providers_for_kind(
    kind: str,
    apis: dict[str, Any],
    *,
    credentials: dict[str, str],
    offline: bool,
    fixtures_dir: Path,
    order_key: str | None = None,
) -> list[Any]:
    section = apis.get(kind) or {}
    order = order_for_kind(apis, kind, order_key=order_key)
    catalog = apis.get("providers") or {}
    built: list[Any] = []
    for name in order:
        meta = catalog.get(name)
        if not meta:
            continue
        if meta.get("kind") != kind:
            continue
        factory = _import_factory(str(meta["module"]))
        built.append(
            factory(
                name=name,
                meta=meta,
                kind_cfg=section,
                credentials=credentials,
                offline=offline,
                fixtures_dir=fixtures_dir,
                endpoints=section.get("endpoints") or {},
            )
        )
    return built


def basemap_defs(apis: dict[str, Any]) -> list[dict[str, Any]]:
    """Frontend basemap entries from [basemaps] — no secrets, config only."""
    section = apis.get("basemaps") or {}
    entries = section.get("entries") or {}
    out: list[dict[str, Any]] = []
    for key in section.get("list") or []:
        entry = entries.get(key)
        if not entry:
            continue
        out.append(dict(entry))
    return out
