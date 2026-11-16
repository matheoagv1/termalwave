#!/usr/bin/env bash
# Prove TermalWave runs using only vendored libraries (no site-packages / user site).
# Required Python minor comes from config/runtime.json.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REQ="$(python3 - <<'PY'
import json
from pathlib import Path
py = json.loads(Path("config/runtime.json").read_text(encoding="utf-8"))["python"]
print(f"{py['major']}.{py['minor']}")
PY
)"
REQ_MAJOR="${REQ%%.*}"
REQ_MINOR="${REQ#*.}"

if command -v "python${REQ}" >/dev/null 2>&1; then
  PYTHON="python${REQ}"
elif command -v "python${REQ_MAJOR}.${REQ_MINOR}" >/dev/null 2>&1; then
  PYTHON="python${REQ_MAJOR}.${REQ_MINOR}"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
else
  echo "Python ${REQ} is required" >&2
  exit 1
fi

VER="$("$PYTHON" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"
if [[ "$VER" != "$REQ" ]]; then
  echo "Python ${REQ}.x required (found $VER via $PYTHON)" >&2
  exit 1
fi

DEFAULT_CONFIG="$("$PYTHON" -c 'import json; from pathlib import Path; print(json.loads(Path("config/runtime.json").read_text())["paths"]["default_config"])')"

export PYTHONNOUSERSITE=1
export PYTHONPATH=""

echo "==> Unit + smoke tests with PYTHONNOUSERSITE=1 and empty PYTHONPATH"
"$PYTHON" -m unittest discover -s tests -v

echo "==> CLI smoke"
"$PYTHON" -m termalwave info
"$PYTHON" -m termalwave run --config "$DEFAULT_CONFIG" --offline --verify-vendor

echo "Portable check passed."
