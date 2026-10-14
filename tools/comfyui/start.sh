#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/env.sh"

COMFY_ROOT="${COMFY_ROOT:-/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI}"
COMFY_PORT="${COMFY_PORT:-8188}"
COMFY_HOST="${COMFY_HOST:-127.0.0.1}"
OUTPUT_DIR="${COMFY_OUTPUT:-$REPO_ROOT/assets/_generated}"
PID_FILE="${COMFY_PID_FILE:-$SCRIPT_DIR/comfyui.pid}"
LOG_FILE="${COMFY_LOG:-$SCRIPT_DIR/comfyui.log}"
WORKFLOW_SRC="$SCRIPT_DIR/workflows/vf-pixel-sprite.json"
WORKFLOW_DST="$COMFY_ROOT/user/default/workflows/vf-pixel-sprite.json"
FLUX_WORKFLOW_SRC="$SCRIPT_DIR/workflows/vf-flux-sprite.json"
FLUX_WORKFLOW_DST="$COMFY_ROOT/user/default/workflows/vf-flux-sprite.json"

if [[ ! -d "$COMFY_ROOT" ]]; then
  echo "error: ComfyUI root not found: $COMFY_ROOT" >&2
  echo "available roots:" >&2
  for _cand in \
    /mnt/quicky2/stability-matrix/Data/Packages/ComfyUI \
    /mnt/quicky2/ComfyUI
  do
    [[ -d "$_cand" && -f "$_cand/main.py" ]] && echo "  $_cand" >&2
  done
  exit 1
fi

PY="$COMFY_ROOT/venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "error: venv python missing: $PY" >&2
  exit 1
fi

if [[ ! -f "$COMFY_ROOT/main.py" ]]; then
  echo "error: main.py missing in $COMFY_ROOT" >&2
  exit 1
fi

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$COMFY_PORT" 2>/dev/null | grep -q LISTEN
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$COMFY_PORT" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "ComfyUI already running (pid $old_pid) → http://$COMFY_HOST:$COMFY_PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if port_in_use; then
  echo "ComfyUI already listening on :$COMFY_PORT → http://$COMFY_HOST:$COMFY_PORT"
  exit 0
fi

mkdir -p \
  "$OUTPUT_DIR/ships" \
  "$OUTPUT_DIR/weapons" \
  "$OUTPUT_DIR/abilities" \
  "$OUTPUT_DIR/planets" \
  "$OUTPUT_DIR/obstacles" \
  "$OUTPUT_DIR/modules" \
  "$OUTPUT_DIR/icons" \
  "$COMFY_ROOT/user/default/workflows"

if [[ -f "$WORKFLOW_SRC" ]]; then
  cp -f "$WORKFLOW_SRC" "$WORKFLOW_DST"
fi
if [[ -f "$FLUX_WORKFLOW_SRC" ]]; then
  cp -f "$FLUX_WORKFLOW_SRC" "$FLUX_WORKFLOW_DST"
fi

cd "$COMFY_ROOT"
nohup "$PY" main.py \
  --listen "$COMFY_HOST" \
  --port "$COMFY_PORT" \
  --output-directory "$OUTPUT_DIR" \
  >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

echo "ComfyUI starting (pid $(cat "$PID_FILE"))"
echo "  UI:     http://$COMFY_HOST:$COMFY_PORT"
echo "  Output: $OUTPUT_DIR"
echo "  Log:    $LOG_FILE"
