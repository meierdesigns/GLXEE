#!/usr/bin/env bash
# Load machine-local ComfyUI defaults. Safe on other machines (no-op if missing).
# shellcheck disable=SC1091
_COMFY_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_COMFY_LOCAL_ENV="${_COMFY_ENV_DIR}/local.env"

if [[ -f "$_COMFY_LOCAL_ENV" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$_COMFY_LOCAL_ENV"
  set +a
fi

# Quicky-only fallback when local.env absent but drive is mounted (this machine).
if [[ -z "${COMFY_ROOT:-}" && -d /mnt/quicky2/stability-matrix/Data/Packages/ComfyUI ]]; then
  COMFY_ROOT="/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI"
fi
if [[ -z "${COMFY_ROOT:-}" && -d /mnt/quicky2/ComfyUI ]]; then
  COMFY_ROOT="/mnt/quicky2/ComfyUI"
fi
if [[ -z "${COMFY_PORT:-}" && -d /mnt/quicky2 ]]; then
  # Prefer already-running Quicky Comfy (Stability Matrix often uses 6767).
  if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :6767" 2>/dev/null | grep -q LISTEN; then
    COMFY_PORT=6767
  else
    COMFY_PORT=8188
  fi
fi

export COMFY_ROOT="${COMFY_ROOT:-}"
export COMFY_PORT="${COMFY_PORT:-8188}"
export COMFY_HOST="${COMFY_HOST:-127.0.0.1}"
if [[ -n "${COMFY_PYTHON:-}" ]]; then
  export COMFY_PYTHON
fi
