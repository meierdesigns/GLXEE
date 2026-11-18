# ComfyUI / asset-gen (GLXEE)

Local Flux tooling for sprites, portraits, and **bezel** rims.

## Boot

```bash
npm run assets      # ComfyUI (:6767) + bridge (:8787)
npm run comfy       # ComfyUI only
npm run asset-gen   # bridge only
```

Settings → START COMFYUI also toggles the stack via the game dev-server.

## Modes (`POST http://127.0.0.1:8787/api/generate`)

| mode | Workflow | Output |
|------|----------|--------|
| `sprite` (default) | `workflows/vf-flux-sprite-api.json` | grayscale PNG sprite |
| `portrait` | `workflows/vf-flux-portrait-api.json` | color bust PNG |
| `bezel` | `workflows/vf-flux-bezel-api.json` | GRID 192 / SLICE 32 hollow rim PNG + indexed `cells`; Accept to `assets/ui/*-bezel-art.svg` |

### Bezel body fields

- `faction`: terran \| kronax \| pirate \| machine \| voidborn  
- `part`: full \| corner \| edge \| topstrip  
- `palette`: `{ hull, lit, dark, accent }`  
- `size`: 192 (default)

Bezel Editor (DevMode → FX → TOOLS → BEZEL EDITOR → FLUX) and Asset Generator type **BEZELS** both call this mode.

## Models

Flux2 Klein stack (see workflow JSON): UNET `flux-2-klein-4b-fp8`, CLIP `qwen_3_4b`, VAE `flux2-vae`. Paths come from Stability Matrix / `local.env`.
