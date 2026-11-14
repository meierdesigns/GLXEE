#!/usr/bin/env bash
# Stop Asset-Gen Bridge on :8787
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="$(dirname "$0")/bridge.pid"
PORT="${ASSET_GEN_PORT:-8787}"

stop_pid() {
  local pid="$1"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "Bridge stopped (pid $pid)"
    return 0
  fi
  return 1
}

stopped=0
if [[ -f "$PID_FILE" ]]; then
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  if stop_pid "${old:-}"; then
    stopped=1
  fi
  rm -f "$PID_FILE"
fi

# Fallback: anything still listening on the bridge port
if command -v ss >/dev/null 2>&1; then
  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if stop_pid "$pid"; then stopped=1; fi
  done < <(ss -tlnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
fi

if [[ "$stopped" -eq 0 ]]; then
  echo "Bridge not running"
fi
