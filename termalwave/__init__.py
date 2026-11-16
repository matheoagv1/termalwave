"""TermalWave: NISAR thermal/radar overlay pipeline with portable vendored deps."""

from termalwave._bootstrap import active_tag, ensure_vendored

__version__ = "0.1.0"

__all__ = ["__version__", "active_tag", "ensure_vendored"]
