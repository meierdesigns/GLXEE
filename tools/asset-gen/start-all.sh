#!/usr/bin/env bash
set -euo pipefail
# Start ComfyUI (if needed) then Asset-Gen Bridge.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=/dev/null
source "$REPO_ROOT/tools/comfyui/env.sh"

# If Comfy already listens (e.g. Stability Matrix :6767), skip start.sh.
_port_busy() {
  local p="${COMFY_PORT:-8188}"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}
if ! _port_busy; then
  bash "$REPO_ROOT/tools/comfyui/start.sh" || true
fi
exec bash "$SCRIPT_DIR/start.sh" "$@"
