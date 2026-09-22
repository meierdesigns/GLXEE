# GLXEE — Project Layout

```
.
├── index.html          # Entry
├── styles.css          # Main styles
├── package.json
├── README.md
│
├── js/                 # Runtime game code
│   ├── abilities/      # Ability definitions + manager
│   ├── core/           # State, config, loop, input
│   ├── game/           # Player, enemies, bullets, collisions
│   ├── graphics/       # Rendering, sprites, palettes, planet SVGs
│   ├── levels/         # Level classes (Mars…Pluto)
│   └── ui/             # Menus, editors, hangar, HUD
│
├── assets/             # Media + ship models
│   ├── ships/          # Models (*.js) + sprites/
│   ├── weapons/sprites/
│   ├── obstacles/sprites/
│   ├── modules/sprites/
│   ├── icons/sprites/
│   ├── levels/sprites/
│   ├── _generated/     # ComfyUI output (gitignored)
│   └── sprite-loader.js
│
├── css/
│   ├── optimized-variables.css   # Active theme vars
│   ├── themes/                   # Unused color presets
│   └── scss/                     # Source SCSS
│
├── tools/
│   ├── asset-gen/      # Local asset generation
│   ├── comfyui/        # ComfyUI workflows
│   ├── debug/          # Color/theme debug scripts
│   ├── archive/        # Unused legacy asset configs
│   ├── auto-open.js
│   └── start-server.bat
│
├── docs/               # TECHNICAL.md, deployment notes
├── rules/              # Game design rules
├── packages/           # Cursed IDE packages
└── .cursed/            # Cursed runtime config
```
