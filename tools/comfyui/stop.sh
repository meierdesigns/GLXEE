#!/usr/bin/env bash
set -euo pipefail
PID_FILE="$(dirname "$0")/comfyui.pid"
COMFY_PORT="${COMFY_PORT:-6767}"
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 "$pid" 2>/dev/null || true
    echo "Stopped ComfyUI pid $pid"
  fi
  rm -f "$PID_FILE"
fi
# Best-effort: free the port if something else holds it
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${COMFY_PORT}/tcp" 2>/dev/null || true
fi
echo "ComfyUI stop requested"
