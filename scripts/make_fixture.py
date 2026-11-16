#!/usr/bin/env python3
"""Create the synthetic HDF5 fixture from the site TOML config (no hardcoded AOI)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parent.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from termalwave._bootstrap import ensure_vendored
from termalwave.process.config import load_config
from termalwave.runtime_config import REPO_ROOT, default_site_config

ensure_vendored()

import h5py
import numpy as np


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=default_site_config(),
        help="Site TOML config",
    )
    args = parser.parse_args(argv)

    cfg = load_config(args.config, REPO_ROOT)
    for section in ("aoi", "paths", "fixture", "hdf5"):
        if section not in cfg:
            raise KeyError(f"Config missing required [{section}] section")

    aoi = cfg["aoi"]
    fx = cfg["fixture"]
    out = Path(cfg["paths"]["fixture_h5"])
    out.parent.mkdir(parents=True, exist_ok=True)

    west = float(aoi["west"])
    east = float(aoi["east"])
    south = float(aoi["south"])
    north = float(aoi["north"])
    height = int(fx["height"])
    width = int(fx["width"])

    yy, xx = np.mgrid[0:height, 0:width]
    cx = width * float(fx["center_x_ratio"])
    cy = height * float(fx["center_y_ratio"])
    amp = np.exp(
        -(
            ((xx - cx) / float(fx["blob_sigma_x"])) ** 2
            + ((yy - cy) / float(fx["blob_sigma_y"])) ** 2
        )
    )
    amp += float(fx["ripple_amp"]) * np.sin(xx / float(fx["ripple_x"])) * np.cos(
        yy / float(fx["ripple_y"])
    )
    amp = (amp - amp.min()) / (amp.max() - amp.min())
    amp = amp.astype(np.float32)

    pixel_w = (east - west) / width
    pixel_h = (south - north) / height
    geotransform = np.array(
        [west, pixel_w, 0.0, north, 0.0, pixel_h], dtype=np.float64
    )

    with h5py.File(out, "w") as handle:
        for key in cfg["hdf5"]["bounds_attr_keys"]:
            handle.attrs[key] = float(aoi[key])
        handle.attrs["title"] = fx["title"]
        dataset = handle.create_dataset(
            fx["amplitude_path"],
            data=amp,
            compression=fx["compression"],
        )
        dataset.attrs[cfg["hdf5"]["geotransform_attr_keys"][0]] = geotransform
        lat = np.linspace(north, south, height, dtype=np.float64)[:, None] * np.ones(
            (1, width)
        )
        lon = np.linspace(west, east, width, dtype=np.float64)[None, :] * np.ones(
            (height, 1)
        )
        handle.create_dataset(
            fx["latitude_path"], data=lat, compression=fx["compression"]
        )
        handle.create_dataset(
            fx["longitude_path"], data=lon, compression=fx["compression"]
        )

    print(f"Wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
