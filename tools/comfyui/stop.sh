#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/env.sh"
COMFY_PORT="${COMFY_PORT:-8188}"
PID_FILE="${COMFY_PID_FILE:-$SCRIPT_DIR/comfyui.pid}"

stopped=0

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.4
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "Stopped ComfyUI (pid $pid)"
    stopped=1
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -tiTCP:"$COMFY_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    echo "Freed port $COMFY_PORT"
    stopped=1
  fi
elif command -v ss >/dev/null 2>&1; then
  if ss -ltn "sport = :$COMFY_PORT" 2>/dev/null | grep -q LISTEN; then
    echo "Port $COMFY_PORT still in use; kill the process manually if needed." >&2
  fi
fi

if [[ "$stopped" -eq 0 ]]; then
  echo "ComfyUI was not running"
fi
