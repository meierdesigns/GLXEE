#!/usr/bin/env bash
# Start ComfyUI for GLXEE asset generation (local-dev only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$(dirname "$0")/local.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
COMFY_ROOT="${COMFY_ROOT:-/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI}"
COMFY_HOST="${COMFY_HOST:-127.0.0.1}"
COMFY_PORT="${COMFY_PORT:-6767}"
COMFY_PYTHON="${COMFY_PYTHON:-$COMFY_ROOT/venv/bin/python}"
PID_FILE="$(dirname "$0")/comfyui.pid"
LOG_FILE="$(dirname "$0")/comfyui.log"
OUT_DIR="$ROOT/assets/_generated"

if [[ -f "$PID_FILE" ]]; then
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "ComfyUI already running (pid $old)"
    exit 0
  fi
fi

if [[ ! -f "$COMFY_ROOT/main.py" ]]; then
  echo "ComfyUI main.py missing at $COMFY_ROOT" >&2
  exit 1
fi
if [[ ! -x "$COMFY_PYTHON" && ! -f "$COMFY_PYTHON" ]]; then
  COMFY_PYTHON=python3
fi

mkdir -p "$OUT_DIR"
cd "$COMFY_ROOT"
nohup "$COMFY_PYTHON" main.py \
  --listen "$COMFY_HOST" \
  --port "$COMFY_PORT" \
  --output-directory "$OUT_DIR" \
  >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "ComfyUI starting (pid $(cat "$PID_FILE"))"
echo "  UI:     http://$COMFY_HOST:$COMFY_PORT"
echo "  Output: $OUT_DIR"
echo "  Log:    $LOG_FILE"
