#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=/dev/null
source "$REPO_ROOT/tools/comfyui/env.sh"
COMFY_PY="${COMFY_PYTHON:-${COMFY_ROOT:+$COMFY_ROOT/venv/bin/python}}"
COMFY_PY="${COMFY_PY:-/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python}"
if [[ -x "$COMFY_PY" ]]; then
  exec "$COMFY_PY" "$SCRIPT_DIR/bridge.py" "$@"
fi
exec python3 "$SCRIPT_DIR/bridge.py" "$@"
