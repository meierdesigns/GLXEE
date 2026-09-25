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
│   ├── asset-gen-ui.css          # Asset generator overlay
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

## Script size and split files

Scripts in `js/` and `assets/` stay at 300 lines or fewer. A large class
`Foo` in `js/ui/foo.js` is split like this:

- `js/ui/foo/core.js` declares `class Foo` with its constructor and first methods.
- Every other file in `js/ui/foo/` adds methods with `extendClass(Foo, { ... })`
  (`js/core/extend-class.js`). Each file is named after its first method.
- `js/ui/foo.js` stays the entry point: it creates the instance and sets the
  `window.*` globals.

`index.html` loads `foo/core.js`, then the other `foo/*.js` files, then `foo.js`.
Put new methods in the file whose methods are most closely related, and start
a new file in the folder (with a matching `<script>` tag before `foo.js`) when
one gets close to 300 lines. `assets/ships/ship-asset-loader.js` is an ES module,
so it imports its parts instead of relying on script order.

Data objects follow the same idea: `icon-sprites/*.js`, `module-sprites/*.js`
and `economy-config/station-upgrades-*.js` hold data sections, and
`bg-mouse-parallax/*.js` share state through `window.VFBgMouseParallaxParts`.
