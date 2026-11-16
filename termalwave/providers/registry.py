"""Build provider instances from config/apis.toml only (no hardcoded order)."""

from __future__ import annotations

import importlib
import tomllib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from termalwave.providers.request_cache import RequestCache


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
    cache: RequestCache,
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
                cache=cache,
            )
        )
    return built


def _gibs_date(lag_days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=max(0, int(lag_days)))).date().isoformat()


TILE_POLICIES = ("archive", "volatile", "direct")


def tile_cache_policy(entry: dict[str, Any]) -> str:
    """archive | volatile | direct for one [basemaps.entries.*] row.

    Licenses that forbid storing tiles always stay direct, whatever the override says.
    """
    tmpl = str(entry.get("url_template") or "")
    if entry.get("do_not_store_tiles") or entry.get("kind") != "raster" or not tmpl.startswith("https://"):
        return "direct"
    policy = str(entry.get("cache_policy") or ("archive" if "{date}" in tmpl else "volatile"))
    if policy not in TILE_POLICIES:
        raise ValueError(f"basemap {entry.get('id')}: unknown cache_policy {policy!r}")
    return policy


def _date_lag(entry: dict[str, Any], section: dict[str, Any]) -> int:
    return int(entry.get("date_lag_days") or section.get("date_lag_days") or 4)


def _tile_cache(entry: dict[str, Any], policy: str, lag: int, tiles: dict[str, Any]) -> dict[str, Any]:
    policies = tiles.get("policies") or {}

    def ttl(name: str) -> dict[str, Any]:
        p = policies.get(name) or {}
        return {
            "edge_ttl_s": int(p.get("edge_ttl_s") or 0),
            "browser_ttl_s": int(p.get("browser_ttl_s") or 0),
            "immutable": bool(p.get("immutable")),
        }

    out = {"policy": policy, **ttl(policy)}
    if "{date}" in str(entry.get("url_template") or ""):
        out["recent"] = {"days": lag + int(tiles.get("recent_days") or 0), **ttl("recent")}
    return out


def basemap_defs(apis: dict[str, Any]) -> list[dict[str, Any]]:
    """Frontend basemap entries from [basemaps] — no secrets, config only.

    GIBS templates keep `{date}` for the UI, and also ship `resolved_url` /
    `resolved_date` using per-entry `date_lag_days` (VIIRS lags ~14d).
    Cacheable rasters add `proxy_template` (same-origin worker route, see [tiles])
    and `tile_cache`; `url_template` stays for direct and offline use.
    """
    section = apis.get("basemaps") or {}
    entries = section.get("entries") or {}
    tiles = apis.get("tiles") or {}
    route = str(tiles.get("route") or "").rstrip("/")
    out: list[dict[str, Any]] = []
    for key in section.get("list") or []:
        entry = entries.get(key)
        if not entry:
            continue
        row = dict(entry)
        tmpl = str(row.get("url_template") or "")
        lag = _date_lag(row, section)
        if "{date}" in tmpl:
            day = _gibs_date(lag)
            row["resolved_date"] = day
            row["resolved_url"] = tmpl.replace("{date}", day)
            row["date_lag_days"] = lag
        policy = tile_cache_policy(row)
        row["cache_policy"] = policy
        if route and policy != "direct":
            date = "{date}" if "{date}" in tmpl else "-"
            row["proxy_template"] = f"{route}/{key}/{date}/{{z}}/{{x}}/{{y}}"
            row["tile_cache"] = _tile_cache(row, policy, lag, tiles)
        out.append(row)
    return out


def search_web_config(apis: dict[str, Any]) -> dict[str, Any] | None:
    """Browser search chain from [geocode.web]: proxy order, keyless fallback, urls."""
    section = apis.get("geocode") or {}
    web = section.get("web") or {}
    if not web:
        return None
    proxy = [str(n) for n in web.get("proxy") or []]
    direct = [str(n) for n in web.get("direct") or []]
    endpoints = section.get("endpoints") or {}
    return {
        "endpoint": str(web.get("endpoint") or ""),
        "proxy": proxy,
        "direct": direct,
        "limit": int(web.get("limit") or 6),
        "cache_ttl_s": int(web.get("cache_ttl_s") or 0),
        "user_agent": str(section.get("user_agent") or ""),
        "endpoints": {n: str(endpoints[n]) for n in dict.fromkeys(proxy + direct) if n in endpoints},
    }


def space_web_config(apis: dict[str, Any]) -> dict[str, Any] | None:
    """Browser config for sky, bodies, satellites and clouds from [space]."""
    section = apis.get("space")
    if not section:
        return None
    return {key: dict(value) if isinstance(value, dict) else value for key, value in section.items()}
