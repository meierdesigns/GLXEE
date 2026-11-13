#!/usr/bin/env bash
# Start ComfyUI + Asset-Gen Bridge
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$ROOT/tools/comfyui/start.sh"
bash "$ROOT/tools/asset-gen/start.sh"
echo "Ready: npm start → game · # → Asset Generator"
