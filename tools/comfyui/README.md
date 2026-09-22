# ComfyUI — GLXEE Pixel Assets

## Start / Stop

```bash
npm run comfy
npm run comfy:stop
npm run asset-gen   # Bridge for in-game Asset Generator (:8787)
npm run assets      # ComfyUI (if needed) + Asset-Gen Bridge
```

Or:

```bash
bash tools/comfyui/start.sh
bash tools/comfyui/stop.sh
bash tools/asset-gen/start-all.sh
python3 tools/asset-gen/bridge.py
```

- **UI:** http://127.0.0.1:8188
- **Asset-Gen Bridge:** http://127.0.0.1:8787
- **Output:** `assets/_generated/` (`ships/`, `weapons/`, `abilities/`, `planets/`, `obstacles/`, `modules/`, `icons/`)
- **Log:** `tools/comfyui/comfyui.log`

Env overrides: `COMFY_ROOT`, `COMFY_PORT`, `COMFY_HOST`, `COMFY_OUTPUT`, `ASSET_GEN_PORT`

Default root: `/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI`

## Workflows

Copied on start:

| Workflow | Sidebar name | Model |
|----------|--------------|--------|
| `workflows/vf-flux-sprite.json` | **VF Flux Sprite** | Flux2 Klein 4B fp8 (primary) |
| `workflows/vf-pixel-sprite.json` | VF Pixel Sprite | Illustrious (legacy) |

API template for the bridge: `workflows/vf-flux-sprite-api.json`

Prompts: [`prompts.md`](prompts.md)

## In-game generator

1. Run `npm run assets` (or `comfy` + `asset-gen`)
2. Open the game → Settings → **Assets ›** (or press **#**) → pick type + element → Generate → Accept
3. Accept writes an RGBA PNG to `assets/<category>/sprites/` and hot-reloads
4. Faction ship keys follow `enemy-{faction}-{enemyClass}` (see `js/graphics/faction-ship-styles.js`)

## Icon sprite previews

```bash
npm run icons:preview
npm run icons:preview:menu
```

Renders `js/graphics/icon-sprites.js` grids → `tools/icon-previews/` (same gray ramp as IconRenderer).

## Manual import

1. Generate an image under `assets/_generated/<category>/`
2. Rename the PNG (see `assets/sprite-loader.js` / `assets/README.md`)
3. Copy into `assets/ships/sprites/`, `assets/weapons/sprites/`, `assets/levels/sprites/`, `assets/icons/sprites/`, `assets/modules/sprites/`, or `assets/obstacles/sprites/`
4. Register new names in `sprite-loader.js` if not already listed
