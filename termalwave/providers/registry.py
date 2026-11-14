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


def providers_for_kind(
    kind: str,
    apis: dict[str, Any],
    *,
    credentials: dict[str, str],
    offline: bool,
    fixtures_dir: Path,
) -> list[Any]:
    section = apis.get(kind) or {}
    order = list(section.get("order") or [])
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
