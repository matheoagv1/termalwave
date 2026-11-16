"""Emit dataset.json + series/hotspots sidecars for the web contract."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _bounds(aoi: dict[str, Any]) -> dict[str, float]:
    return {
        "west": float(aoi["west"]),
        "east": float(aoi["east"]),
        "south": float(aoi["south"]),
        "north": float(aoi["north"]),
    }


def _center(bounds: dict[str, float]) -> list[float]:
    return [
        (bounds["west"] + bounds["east"]) / 2.0,
        (bounds["south"] + bounds["north"]) / 2.0,
    ]


# NISAR science data starts in 2025. Earlier radar frames cannot be measurements.
NISAR_SCIENCE_YEAR = 2025
BEFORE_NISAR_EN = "Before NISAR (launched 2025)"
BEFORE_NISAR_ES = "Antes de NISAR (lanzado en 2025)"
_KEPT_HONESTY = {"measured", "derived", "model", "inferred"}


def _year_of(tick: dict[str, Any]) -> int:
    label = str(tick.get("label") or "")
    if label.isdigit():
        return int(label)
    start = str(tick.get("start") or "")
    if len(start) >= 4 and start[:4].isdigit():
        return int(start[:4])
    return 0


def _annotate_frame(layer_id: str, year: int, frame: dict[str, Any], synthetic: bool) -> dict[str, Any]:
    out = dict(frame)
    # a pre-launch year cannot be a NISAR measurement, even if a sidecar says otherwise
    if layer_id == "radar" and year < NISAR_SCIENCE_YEAR:
        out["honesty"] = "example"
        out["note_en"] = BEFORE_NISAR_EN
        out["note_es"] = BEFORE_NISAR_ES
        return out
    preset = str(out.get("honesty") or "")
    if preset in _KEPT_HONESTY and (not synthetic or out.get("granule")):
        return out
    if synthetic or not out.get("granule"):
        out["honesty"] = "example"
        return out
    out.setdefault("honesty", "measured" if layer_id == "radar" else "inferred")
    return out


def _roll_honesty(kinds: set[str]) -> str:
    present = {k for k in kinds if k}
    if not present or present == {"example"}:
        return "example"
    rest = present - {"example"}
    if len(rest) == 1:
        return next(iter(rest))
    if "measured" in rest:
        return "measured"
    return next(iter(rest))


def apply_honesty(dataset: dict[str, Any], *, synthetic: bool | None = None) -> dict[str, Any]:
    """Honesty on each layer and each frame. isMock is not the only flag."""
    if synthetic is None:
        synthetic = bool(dataset.get("timelineSynthetic", True))
    frames_by_layer: dict[str, list[dict[str, Any]]] = {}
    for seg in dataset.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        for tick in seg.get("ticks") or []:
            if not isinstance(tick, dict):
                continue
            year = _year_of(tick)
            frames = tick.get("frames") or {}
            if not isinstance(frames, dict):
                continue
            for lid, frame in list(frames.items()):
                if not isinstance(frame, dict):
                    continue
                annotated = _annotate_frame(str(lid), year, frame, synthetic)
                frames[lid] = annotated
                frames_by_layer.setdefault(str(lid), []).append(annotated)
    for layer in dataset.get("layers") or []:
        if not isinstance(layer, dict):
            continue
        lid = str(layer.get("id") or "")
        kinds = {str(f.get("honesty") or "") for f in frames_by_layer.get(lid, [])}
        layer["honesty"] = _roll_honesty(kinds)
        if lid == "radar" and any(f.get("note_en") == BEFORE_NISAR_EN for f in frames_by_layer.get(lid, [])):
            layer["note_en"] = BEFORE_NISAR_EN
            layer["note_es"] = BEFORE_NISAR_ES
    dataset["isMock"] = False
    dataset["timelineSynthetic"] = synthetic
    return dataset


def series_for_layer(dataset: dict[str, Any], layer_id: str) -> list[dict[str, Any]]:
    """One point per tick. A number only when the frame carries a real mean."""
    rows: list[dict[str, Any]] = []
    for seg in dataset.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        for tick in seg.get("ticks") or []:
            if not isinstance(tick, dict):
                continue
            frame = (tick.get("frames") or {}).get(layer_id)
            value = None
            if isinstance(frame, dict):
                raw = frame.get("mean_db")
                if raw is None:
                    raw = frame.get("mean")
                if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                    value = float(raw)
            rows.append({"tickId": tick["id"], "date": tick["start"], "value": value})
    return rows


def _sources(provenance: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not provenance:
        return []
    layers = provenance.get("layers") or {}
    out: list[dict[str, Any]] = []
    for kind, g in layers.items():
        if not isinstance(g, dict):
            continue
        out.append(
            {
                "kind": kind,
                "strategy": g.get("strategy") or "",
                "status": g.get("status") or "unavailable",
                "selected": list(g.get("selected_sources") or []),
                "tried": [
                    {
                        "provider": t.get("provider"),
                        "ok": bool(t.get("ok")),
                        "count": t.get("count"),
                    }
                    for t in (g.get("tried") or [])
                    if isinstance(t, dict)
                ],
                "fromCache": bool(g.get("from_cache")),
                "count": int(g.get("count") or 0),
            }
        )
    return out


def build_dataset(
    cfg: dict[str, Any],
    timeline: dict[str, Any],
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    aoi = cfg.get("aoi") or {}
    bounds = _bounds(aoi)
    years = [int(y) for y in timeline.get("years") or []]
    layer_defs = [
        {"id": str(L["id"]), "label": str(L["label"]), "unit": "", "range": [0, 1], "ramp": [], "note": ""}
        for L in (timeline.get("layers") or [])
    ]
    frames_root = timeline.get("frames") or {}
    ticks: list[dict[str, Any]] = []
    for year in years:
        frames: dict[str, Any] = {}
        for L in layer_defs:
            lid = L["id"]
            f = (frames_root.get(lid) or {}).get(str(year))
            if f and f.get("png"):
                frames[lid] = {
                    "url": f["png"],
                    "bounds": f.get("bounds") or bounds,
                    "kind": "composite",
                }
            else:
                frames[lid] = None
        ticks.append(
            {
                "id": f"y-{year}",
                "start": f"{year}-01-01",
                "end": f"{year}-12-31",
                "label": str(year),
                "frames": frames,
            }
        )
    first = years[0] if years else 2000
    last = years[-1] if years else first
    synthetic = bool(timeline.get("synthetic", True))
    tax = cfg.get("layers_taxonomy") or {}
    by_id = {str(r["id"]): r for r in (tax.get("layers") or []) if r.get("id")}
    enriched: list[dict[str, Any]] = []
    for L in layer_defs:
        row = dict(L)
        meta = by_id.get(row["id"]) or {}
        if meta.get("category"):
            row["category"] = str(meta["category"])
        if "core" in meta:
            row["core"] = bool(meta["core"])
        elif row["id"] == "radar":
            row["core"] = True
            row.setdefault("category", "data")
        if meta.get("label"):
            row["label"] = str(meta["label"])
        enriched.append(row)
    layer_defs = enriched
    presets = {
        str(p["trade"]): [x for x in p.get("enable") or [] if x != "radar"]
        for p in (tax.get("presets") or [])
        if p.get("trade")
    }
    # pipeline fixture HDF5 to PNG is not MockProvider; honesty is per layer and frame
    dataset = {
        "area": {
            "name": str(aoi.get("name") or "Area de estudio"),
            "bounds": bounds,
            "center": _center(bounds),
        },
        "layers": layer_defs,
        "presets": presets,
        "layers_taxonomy": {
            "policy": tax.get("policy") or {},
            "layers": tax.get("layers") or [],
            "presets": tax.get("presets") or [],
        },
        "segments": [
            {
                "id": "anual",
                "label": "Anos",
                "from": f"{first}-01-01",
                "to": f"{last}-12-31",
                "granularity": "year",
                "kind": "composite",
                "ticks": ticks,
            }
        ],
        "events": [],
        "context": [],
        "sources": _sources(provenance),
        "sourcesAt": (provenance or {}).get("generated_at"),
        "timelineSynthetic": synthetic,
        "isMock": False,
    }
    return apply_honesty(dataset, synthetic=synthetic)


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def export_hotspots_and_series(
    repo_root: Path,
    dataset: dict[str, Any],
    ingest_dir: Path,
) -> None:
    """Map fires ingest into web hotspots. Series copy mean_db when a frame has one."""
    public = repo_root / "web" / "public"
    dist = repo_root / "web" / "dist"
    fires_path = ingest_dir / "fires.json"
    fire_recs: list[dict[str, Any]] = []
    if fires_path.is_file():
        raw = json.loads(fires_path.read_text(encoding="utf-8"))
        fire_recs = list(raw.get("records") or [])

    ticks = []
    for seg in dataset.get("segments") or []:
        ticks.extend(seg.get("ticks") or [])

    for layer in dataset.get("layers") or []:
        lid = str(layer["id"])
        series = series_for_layer(dataset, lid)
        for base in (public, dist):
            _write_json(base / "series" / f"{lid}.json", series)

        for t in ticks:
            spots: list[dict[str, Any]] = []
            if lid == "incendios" and fire_recs:
                year = int(str(t["id"]).removeprefix("y-") or "0")
                for i, rec in enumerate(fire_recs):
                    observed = str(rec.get("observed_at") or "")
                    if observed.startswith(str(year)) or year == 0:
                        spots.append(
                            {
                                "id": f"incendios-{i}",
                                "layer": "incendios",
                                "tickId": t["id"],
                                "lonlat": [float(rec["lon"]), float(rec["lat"])],
                                "title": "Foco termico",
                                "value": str(rec.get("brightness") or "—"),
                                "delta": rec.get("confidence"),
                            }
                        )
            for base in (public, dist):
                _write_json(base / "hotspots" / lid / f"{t['id']}.json", spots)


def write_dataset_bundle(
    cfg: dict[str, Any],
    repo_root: Path,
    timeline: dict[str, Any],
    provenance: dict[str, Any] | None = None,
) -> list[Path]:
    # never publish a contract shell that the UI cannot render
    if not (timeline.get("layers") or cfg.get("layers")):
        raise ValueError("dataset export refused: timeline/config has no layers")
    dataset = build_dataset(cfg, timeline, provenance)
    if not dataset.get("layers"):
        raise ValueError("dataset export refused: layers empty after build")
    written: list[Path] = []
    for rel in ("web/public/dataset.json", "web/dist/dataset.json"):
        out = repo_root / rel
        _write_json(out, dataset)
        written.append(out)
    ingest_dir = Path(cfg["paths"]["processed_dir"]) / "ingest"
    if not ingest_dir.is_absolute():
        ingest_dir = (repo_root / ingest_dir).resolve()
    export_hotspots_and_series(repo_root, dataset, ingest_dir)
    return written
