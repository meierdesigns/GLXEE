#!/usr/bin/env bash
# Start Asset-Gen Bridge on :8787
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/tools/comfyui/local.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
PY="${COMFY_PYTHON:-/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python}"
if [[ ! -f "$PY" ]]; then
  PY=python3
fi
PID_FILE="$(dirname "$0")/bridge.pid"
LOG_FILE="$(dirname "$0")/bridge.out"
HOST="${ASSET_GEN_HOST:-127.0.0.1}"
PORT="${ASSET_GEN_PORT:-8787}"

if [[ -f "$PID_FILE" ]]; then
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "Bridge already running (pid $old) http://$HOST:$PORT"
    exit 0
  fi
fi

cd "$ROOT"
nohup "$PY" tools/asset-gen/bridge.py >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "Asset-Gen Bridge starting (pid $(cat "$PID_FILE")) http://$HOST:$PORT"
echo "  Log: $LOG_FILE"
