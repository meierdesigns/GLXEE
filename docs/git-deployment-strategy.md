# 🚀 Git Deployment Strategy - Feature-Focused Waves

## 📋 Overview
This document outlines a structured approach to uploading the GLXEE project to Git with feature-focused commits that maintain clean history and logical progression.

## 🎯 Deployment Waves

### **Wave 1: Core Foundation** 
*Commit: "feat: Core game engine and basic systems"*

**Files to include:**
- `index.html` (basic structure)
- `styles.css` (core styles)
- `js/core/` (all core systems)
- `js/game/` (basic game logic)
- `assets/` (basic assets)
- `README.md` (initial documentation)

**Exclude:**
- Color system files
- Enhanced UI components
- Performance optimizers

---

### **Wave 2: Visual Systems**
*Commit: "feat: Advanced graphics and rendering systems"*

**Files to include:**
- `js/graphics/` (all graphics systems)
- `js/ui/` (basic UI components)
- `assets/ships/` (ship models)
- `assets/weapons/` (weapon systems)
- `assets/obstacles/` (obstacle types)

**Exclude:**
- Color palette system
- Enhanced UI features

---

### **Wave 3: Game Content**
*Commit: "feat: Complete game content and levels"*

**Files to include:**
- `js/levels/` (all level definitions)
- `assets/levels/` (level assets)
- `assets/backgrounds/` (background systems)
- `assets/abilities/` (ability systems)
- `planet-svgs.js`

---

### **Wave 4: Audio Systems**
*Commit: "feat: Audio and sound management"*

**Files to include:**
- `assets/sounds/` (all sound files)
- `js/game/sounds.js`
- Audio configuration files

---

### **Wave 5: Color System Foundation**
*Commit: "feat: Basic color management system"*

**Files to include:**
- `css/optimized-variables.css`
- `js/graphics/color-manager.js`
- Basic color CSS files

---

### **Wave 6: Advanced Color System**
*Commit: "feat: Advanced color palette system"*

**Files to include:**
- `js/graphics/color-palette-system.js`
- `js/ui/enhanced-palette-ui.js`
- `js/graphics/performance-optimizer.js`
- Updated `styles.css` with new variables

---

### **Wave 7: UI Enhancements**
*Commit: "feat: Enhanced UI and user experience"*

**Files to include:**
- Updated `js/ui/start-screen.js`
- `js/ui/volume-controls.js`
- `js/ui/level-info-manager.js`
- Enhanced UI components

---

### **Wave 8: Documentation & Polish**
*Commit: "docs: Complete documentation and final polish"*

**Files to include:**
- Updated `README.md`
- `TECHNICAL.md`
- `rules/` (game rules and technical docs)
- Final cleanup and optimization

---

### **Wave 9: Galaxies, Factions & Planets**
*Commit: "feat: Galaxies, Factions lore, and planet systems"*

**Files to include:**
- `js/core/planet-config.js` (galaxies, faction meta/lore, procedural explore)
- `js/graphics/planet-svgs.js` (faction icon styles)
- `js/graphics/icon-sprites.js` (Factions emblems)
- `js/ui/faction-viewer.js`
- `js/ui/planet-viewer.js`, `js/ui/galaxy-map.js`, `js/ui/level-info-manager.js`

**Feature description:**
Five galaxies with ruling Factions; long-form lore and traits; faction-themed procedural planets; discoverable Faction Viewer archive; faction-colored planet SVGs.

---

### **Wave 10: Arsenal — Weapons, Ships, Abilities, Economy**
*Commit: "feat: Arsenal expansion — weapons, ships, abilities, economy"*

**Files to include:**
- `js/core/weapon-config.js`, `ship-config.js`, `ability-config.js`, `economy-config.js`
- Content viewers: weapon / ship / ability / defense / enemy

**Feature description:**
Faction-tagged weapon doctrine (Terran + Kronax claw/spike); Kronax playable hulls; charge/drive/shield ability growth; scrap/ore/crystal/voltex economy + station upgrade costs; discovery-linked viewers.

---

### **Wave 11: Home Station & Progression**
*Commit: "feat: Home Station hub — shop, craft, hangar, travel"*

**Files to include:**
- `js/ui/home-station.js`
- `js/core/profile-manager.js`
- `assets/ui/hs-bg-*.png`, `assets/ui/menu-hangar-bg.png`

**Feature description:**
Full station deck (Station / Upgrade / Hangar / Shop / Craft / Travel / Explorations); upgrade trees; hangar preview; wallet/cargo/blueprint loop; per-tab background plates.

---

### **Wave 12: Menu Shell, Profiles & Parallax**
*Commit: "feat: Menu shell, profiles, and background parallax"*

**Files to include:**
- `js/ui/start-screen.js`, `profile-selection.js`, `bg-mouse-parallax.js`
- `js/core/menu-nav.js`, `menu-state.js`, `core.js`, `game-control-system.js`, `settings-manager.js`
- `js/graphics/ui-appearance.js`, `index.html`, `assets/ui/profiles-bg.png`

**Feature description:**
Hangar-style start hub; profile discovery defaults; mouse-follow parallax hosts with reduce-motion safety; menu state persistence across station and archives.

---

### **Wave 13: Visual Shell**
*Commit: "feat: Visual shell — station decks and parallax chrome"*

**Files to include:**
- `styles.css`

**Feature description:**
Station deck backgrounds, content-viewer chrome, parallax overscan/boot veil, pixel UI polish aligned to Game-Boy shell.

---

### **Wave 14: Archive Docs & Update Notes**
*Commit: "docs: README lore archive and Wave 9–14 update notes"*

**Files to include:**
- `README.md` (Factions / weapons / planets / station lore)
- `docs/UPDATE_NOTES.md`
- `docs/git-deployment-strategy.md`

**Feature description:**
Transmission-styled README with full lore tables; update notes for Waves 9–14; deployment strategy extended.

---

### **Wave 15: Combat Events & Event Archive**
*Commit: "feat: Combat events — escorts, announces, Event Viewer"*

**Files to include:**
- `js/core/combat-event-config.js` (new)
- `js/ui/event-viewer.js` (new)
- `js/game/enemies.js`, `js/game/collisions.js`
- `js/core/enemy-config.js`, `js/core/menu-state.js`, `js/core/profile-manager.js`
- `js/ui/ability-viewer.js`, `defense-viewer.js`, `ship-viewer.js`, `weapon-viewer.js`, `onboarding.js`
- `index.html` (script tags + combat HUD shell)

**Feature description:**
Champion combat-event doctrine (repair / shield battery / gunners / jammer / tether); announce banners; profile discovery; Explorations → EVENTS archive.

---

### **Wave 16: Faction Ship Silhouettes**
*Commit: "feat: Faction ship silhouettes — topology identity grid"*

**Files to include:**
- `js/graphics/faction-ship-styles.js` (new)
- `assets/ships/ship-asset-loader.js`, `assets/sprite-loader.js`
- `js/graphics/graphics-manager.js`
- `js/ui/enemy-viewer.js`, `js/ui/faction-viewer.js`

**Feature description:**
Five factions × five classes on a fixed lo-fi gray grid; silhouette-only identity; loader paths for `enemy-{faction}-{enemyClass}`.

---

### **Wave 17: Combat HUD & In-Game Shell**
*Commit: "feat: Combat HUD — dual clusters and champion bars"*

**Files to include:**
- `styles.css`, `js/core/ui-manager.js`, `js/ui/render.js`
- `js/core/viewport-fit.js`, `js/core/game-control-system.js`, `js/core/core.js`
- `js/game/player.js`, `js/game/bullets.js`

**Feature description:**
Left info/weapon/vitals cluster; right enemy faction health bars; champion vertical bar; announce chrome; stage glue.

---

### **Wave 18: Planet & Galaxy Arrival Content**
*Commit: "feat: Planet/galaxy arrival content and combat-event seeds"*

**Files to include:**
- `js/core/planet-config.js`, `js/core/level-manager.js`
- `js/graphics/planet-svgs.js`
- `js/ui/planet-viewer.js`, `js/ui/galaxy-map.js`, `js/ui/level-info-manager.js`

**Feature description:**
Normalized combat-event payloads on enemies; richer arrival/seed helpers; planet SVG + map/viewer/level-info polish.

---

### **Wave 19: Ship Loadout Visual Modules**
*Commit: "feat: Ship loadout visual modules — mounts and roles"*

**Files to include:**
- `js/core/ship-loadout.js`
- `js/graphics/module-sprites.js`

**Feature description:**
Aft drives, flank armor, midline shield stack, weapon edge mounts; module visual roles for accents/glow.

---

### **Wave 20: Menu Hub, Embedded Settings & Parallax**
*Commit: "feat: Menu hub — embedded settings and parallax handoffs"*

**Files to include:**
- `js/ui/start-screen.js`, `js/ui/bg-mouse-parallax.js`, `js/ui/profile-selection.js`, `js/ui/home-station.js`
- `js/graphics/icon-sprites.js`, `js/graphics/icon-renderer.js`
- `tools/render-icon-sprites.py`, `tools/icon-previews/`

**Feature description:**
Overlay vs embedded hub menus; Assets/Credits/Settings tabs; parallax crossfade memory; icon sprite preview tooling.

---

### **Wave 21: Global Look & Theme Pipeline**
*Commit: "feat: Global look — shared brightness recipe and themes"*

**Files to include:**
- `js/graphics/color-palette-system.js`, `js/graphics/theme-context.js`
- `js/ui/theme-editor.js`
- `js/graphics/particle-system.js`, `js/graphics/performance-optimizer.js`
- `js/core/settings-manager.js`, `js/core/cheat-system.js`, `js/core/ability-config.js`

**Feature description:**
Persisted global look (brightness recipe); theme context/editor; particle/perf + settings handoff.

---

### **Wave 22: Procedural Audio Engine**
*Commit: "feat: Procedural audio — Web Audio SFX and planet ambients"*

**Files to include:**
- `js/game/sounds.js`

**Feature description:**
Beep/sweep/noise/dual-tone engine; combat event SFX; planet ambient lanes; master/SFX/music volume gates.

---

### **Wave 23: Asset Generator Pipeline**
*Commit: "feat: Asset generator pipeline — UI, bridge, Comfy start-all"*

**Files to include:**
- `js/ui/asset-gen-ui.js`, `js/graphics/asset-gen-client.js`, `js/graphics/asset-gen-registry.js`
- `tools/asset-gen/bridge.py`, `tools/asset-gen/start-all.sh`
- `tools/comfyui/prompts.md`, `tools/comfyui/README.md`
- `package.json`, `assets/README.md`

**Feature description:**
Grayscale preview matrix, faction-ship keys, render settings, multi-generate; bridge + `npm run assets` / icon preview scripts.

---

### **Wave 24: Archive Docs (Wave 15–24)**
*Commit: "docs: README and Wave 15–24 featurewave archive"*

**Files to include:**
- `README.md`
- `docs/UPDATE_NOTES.md`
- `docs/git-deployment-strategy.md`

**Feature description:**
Transmission README + update notes + deployment strategy covering combat events through asset pipeline.

---

### **Wave 35: Ship Anatomy & Voxel Rendering**
*Commit: "feat: Ship anatomy controls and voxel hull rendering wave 35"*

**Files to include:**
- `assets/ships/ship-asset-loader.js`
- `js/core/ship-config.js`, `js/core/ship-loadout.js`
- `js/graphics/graphics-manager.js`
- `js/ui/ship-editor.js`

**Feature description:**
Edge-based wing crops, square voxel rasterization, adjustable wing rotation and connectors, and persistent per-ship anatomy settings.

---

### **Wave 36: Hangar Component Customization**
*Commit: "feat: Hangar component customization wave 36"*

**Files to include:**
- `js/ui/component-tree.js`
- `js/ui/home-station.js`
- `styles.css`
- `index.html`

**Feature description:**
Synchronized component trees, cosmetic slot skins, area guides, slot pins, draggable hangar cards, wing hit targets, and anatomy reset controls.

---

### **Wave 37: Hangar Editing & Profile Handoff**
*Commit: "feat: Hangar editing and profile handoff wave 37"*

**Files to include:**
- `js/core/game-control-system.js`
- `js/graphics/ui-appearance.js`
- `js/ui/onboarding.js`, `js/ui/profile-selection.js`, `js/ui/start-screen.js`

**Feature description:**
Ship and loadout preservation across onboarding, profile selection, start-screen navigation, station entry, and menu appearance handoffs.

---

### **Wave 38: Archive Docs**
*Commit: "docs: document ship anatomy and hangar customization waves 35–37"*

**Files to include:**
- `README.md`
- `docs/UPDATE_NOTES.md`
- `docs/git-deployment-strategy.md`

**Feature description:**
Document the new ship anatomy editor, voxel rendering controls, persistent cosmetic loadouts, and feature-wave commit boundaries.

---

## 🔧 Git Commands for Each Wave

### **Wave 1: Core Foundation**
```bash
git add index.html styles.css js/core/ js/game/ assets/ README.md
git commit -m "feat: Core game engine and basic systems

- Implement core game loop and state management
- Add basic player and enemy systems
- Create fundamental collision detection
- Set up basic UI structure
- Add initial documentation"
```

### **Wave 2: Visual Systems**
```bash
git add js/graphics/ js/ui/ assets/ships/ assets/weapons/ assets/obstacles/
git commit -m "feat: Advanced graphics and rendering systems

- Implement sprite rendering and animation
- Add ship models and weapon systems
- Create obstacle generation and rendering
- Build UI rendering components
- Add particle effects system"
```

### **Wave 3: Game Content**
```bash
git add js/levels/ assets/levels/ assets/backgrounds/ assets/abilities/ planet-svgs.js
git commit -m "feat: Complete game content and levels

- Add 5 planetary level environments
- Implement level-specific obstacles and enemies
- Create ability system with multiple ship types
- Add background parallax systems
- Include planet SVG assets"
```

### **Wave 4: Audio Systems**
```bash
git add assets/sounds/ js/game/sounds.js
git commit -m "feat: Audio and sound management

- Implement comprehensive sound system
- Add weapon and impact sound effects
- Create background music management
- Add volume controls and audio settings
- Include sound configuration system"
```

### **Wave 5: Color System Foundation**
```bash
git add css/optimized-variables.css js/graphics/color-manager.js
git commit -m "feat: Basic color management system

- Create optimized CSS variable system
- Implement basic color manager
- Add grayscale default theme
- Set up color variable architecture
- Optimize CSS performance"
```

### **Wave 6: Advanced Color System**
```bash
git add js/graphics/color-palette-system.js js/ui/enhanced-palette-ui.js js/graphics/performance-optimizer.js
git commit -m "feat: Advanced color palette system

- Add 8 dynamic color palettes
- Implement palette switching system
- Create enhanced UI with shortcuts
- Add performance optimization layer
- Include palette history and favorites"
```

### **Wave 7: UI Enhancements**
```bash
git add js/ui/start-screen.js js/ui/volume-controls.js js/ui/level-info-manager.js
git commit -m "feat: Enhanced UI and user experience

- Update start screen with palette selection
- Add volume controls and settings
- Implement level info management
- Enhance user interaction systems
- Improve overall UX"
```

### **Wave 8: Documentation & Polish**
```bash
git add README.md TECHNICAL.md rules/ css/ scss/
git commit -m "docs: Complete documentation and final polish

- Update comprehensive README
- Add technical documentation
- Include game rules and manual
- Add SCSS source files
- Final cleanup and optimization"
```

### **Wave 9: Galaxies, Factions & Planets**
```bash
git add js/core/planet-config.js js/graphics/planet-svgs.js js/graphics/icon-sprites.js \
  js/ui/faction-viewer.js js/ui/planet-viewer.js js/ui/galaxy-map.js js/ui/level-info-manager.js
git commit -m "feat: Galaxies, Factions lore, and planet systems

- Add five galaxies with ruling Factions and long-form lore
- Procedural explore/arrival planets from faction themes
- Faction Viewer archive with pixel emblems
- Faction-styled planet SVG icons"
```

### **Wave 10: Arsenal**
```bash
git add js/core/weapon-config.js js/core/ship-config.js js/core/ability-config.js \
  js/core/economy-config.js js/ui/weapon-viewer.js js/ui/ship-viewer.js \
  js/ui/ability-viewer.js js/ui/defense-viewer.js js/ui/enemy-viewer.js
git commit -m "feat: Arsenal expansion — weapons, ships, abilities, economy

- Faction-tagged weapon doctrine including Kronax claw/spike
- Kronax Raider and Claw playable hulls
- Charge/drive/shield ability growth and economy resources
- Discovery-linked content viewers"
```

### **Wave 11: Home Station**
```bash
git add js/ui/home-station.js js/core/profile-manager.js assets/ui/
git commit -m "feat: Home Station hub — shop, craft, hangar, travel

- Full station decks with upgrade trees and hangar preview
- Shop/craft/blueprint/portal progression loop
- Profile wallet, cargo, and discovery defaults
- Per-tab station background art"
```

### **Wave 12: Menu & Parallax**
```bash
git add js/ui/start-screen.js js/ui/profile-selection.js js/ui/bg-mouse-parallax.js \
  js/core/menu-nav.js js/core/menu-state.js js/core/core.js \
  js/core/game-control-system.js js/core/settings-manager.js \
  js/graphics/ui-appearance.js index.html
git commit -m "feat: Menu shell, profiles, and background parallax

- Hangar-style start hub and profile selection
- Mouse-follow parallax hosts with reduce-motion safety
- Menu state persistence across station and archives"
```

### **Wave 13: Visual Shell**
```bash
git add styles.css
git commit -m "feat: Visual shell — station decks and parallax chrome

- Station deck backgrounds and content-viewer chrome
- Parallax overscan boot veil and pixel UI polish"
```

### **Wave 14: Archive Docs**
```bash
git add README.md docs/UPDATE_NOTES.md docs/git-deployment-strategy.md
git commit -m "docs: README lore archive and Wave 9–14 update notes

- Transmission-styled README with Factions, weapons, planets, station
- Update notes and extended deployment wave strategy"
```

### **Wave 15: Combat Events**
```bash
git add js/core/combat-event-config.js js/ui/event-viewer.js \
  js/game/enemies.js js/game/collisions.js \
  js/core/enemy-config.js js/core/menu-state.js js/core/profile-manager.js \
  js/ui/ability-viewer.js js/ui/defense-viewer.js js/ui/ship-viewer.js \
  js/ui/weapon-viewer.js js/ui/onboarding.js index.html
git commit -m "feat: Combat events — escorts, announces, Event Viewer

- Champion combat-event doctrine with escort formation and debuffs
- Announce banners and profile discovery for event roles
- Explorations Event Viewer archive"
```

### **Wave 16: Faction Ship Silhouettes**
```bash
git add js/graphics/faction-ship-styles.js assets/ships/ship-asset-loader.js \
  assets/sprite-loader.js js/graphics/graphics-manager.js \
  js/ui/enemy-viewer.js js/ui/faction-viewer.js
git commit -m "feat: Faction ship silhouettes — topology identity grid

- Five factions × five classes on a fixed lo-fi gray grid
- Silhouette-only identity; enemy-{faction}-{enemyClass} loader paths"
```

### **Wave 17: Combat HUD**
```bash
git add styles.css js/core/ui-manager.js js/ui/render.js \
  js/core/viewport-fit.js js/core/game-control-system.js js/core/core.js \
  js/game/player.js js/game/bullets.js
git commit -m "feat: Combat HUD — dual clusters and champion bars

- Left info/weapon/vitals cluster and right enemy faction bars
- Champion vertical health bar and combat-event announce chrome"
```

### **Wave 18: Planet & Galaxy Arrival**
```bash
git add js/core/planet-config.js js/core/level-manager.js \
  js/graphics/planet-svgs.js js/ui/planet-viewer.js \
  js/ui/galaxy-map.js js/ui/level-info-manager.js
git commit -m "feat: Planet/galaxy arrival content and combat-event seeds

- Normalized combat-event payloads and richer arrival helpers
- Planet SVG, map, viewer, and level-info polish"
```

### **Wave 19: Ship Loadout Modules**
```bash
git add js/core/ship-loadout.js js/graphics/module-sprites.js
git commit -m "feat: Ship loadout visual modules — mounts and roles

- Aft drives, flank armor, midline shields, weapon edge mounts
- Module visual roles for renderer accents"
```

### **Wave 20: Menu Hub & Parallax**
```bash
git add js/ui/start-screen.js js/ui/bg-mouse-parallax.js \
  js/ui/profile-selection.js js/ui/home-station.js \
  js/graphics/icon-sprites.js js/graphics/icon-renderer.js \
  tools/render-icon-sprites.py tools/icon-previews/
git commit -m "feat: Menu hub — embedded settings and parallax handoffs

- Overlay vs embedded hub menus with Assets/Credits/Settings
- Parallax crossfade memory and icon sprite preview tooling"
```

### **Wave 21: Global Look**
```bash
git add js/graphics/color-palette-system.js js/graphics/theme-context.js \
  js/ui/theme-editor.js js/graphics/particle-system.js \
  js/graphics/performance-optimizer.js js/core/settings-manager.js \
  js/core/cheat-system.js js/core/ability-config.js
git commit -m "feat: Global look — shared brightness recipe and themes

- Persisted global look with shared brightness recipe
- Theme context/editor and settings handoff"
```

### **Wave 22: Procedural Audio**
```bash
git add js/game/sounds.js
git commit -m "feat: Procedural audio — Web Audio SFX and planet ambients

- Beep/sweep/noise/dual-tone engine with combat and ambient lanes
- Master/SFX/music volume gates"
```

### **Wave 23: Asset Generator**
```bash
git add js/ui/asset-gen-ui.js js/graphics/asset-gen-client.js \
  js/graphics/asset-gen-registry.js tools/asset-gen/bridge.py \
  tools/asset-gen/start-all.sh tools/comfyui/prompts.md \
  tools/comfyui/README.md package.json assets/README.md
git commit -m "feat: Asset generator pipeline — UI, bridge, Comfy start-all

- Grayscale preview matrix and faction-ship generate flow
- Bridge upgrades, npm run assets, icon preview scripts"
```

### **Wave 24: Archive Docs (15–24)**
```bash
git add README.md docs/UPDATE_NOTES.md docs/git-deployment-strategy.md
git commit -m "docs: README and Wave 15–24 featurewave archive

- Transmission README covering combat events through asset pipeline
- Update notes and deployment strategy extended through Wave 24"
```

### **Wave 35: Ship Anatomy & Voxel Rendering**
```bash
git add assets/ships/ship-asset-loader.js js/core/ship-config.js \
  js/core/ship-loadout.js js/graphics/graphics-manager.js js/ui/ship-editor.js
git commit -m "feat: Ship anatomy controls and voxel hull rendering wave 35

- Add edge-based wing crops and square voxel hull rasterization
- Persist wing rotation, connector settings, and segment anatomy"
```

### **Wave 36: Hangar Component Customization**
```bash
git add js/ui/component-tree.js js/ui/home-station.js styles.css index.html
git commit -m "feat: Hangar component customization wave 36

- Synchronize component trees and persistent cosmetic slot skins
- Add area guides, slot pins, draggable cards, and anatomy reset"
```

### **Wave 37: Hangar Editing & Profile Handoff**
```bash
git add js/core/game-control-system.js js/graphics/ui-appearance.js \
  js/ui/onboarding.js js/ui/profile-selection.js js/ui/start-screen.js
git commit -m "feat: Hangar editing and profile handoff wave 37

- Preserve selected ships and loadouts through menu and station transitions
- Keep onboarding and profile handoffs aligned with hangar editing"
```

### **Wave 38: Archive Docs**
```bash
git add README.md docs/UPDATE_NOTES.md docs/git-deployment-strategy.md
git commit -m "docs: document ship anatomy and hangar customization waves 35–37

- Document voxel rendering, anatomy editing, and cosmetic loadouts
- Record feature-focused wave boundaries and commands"
```

---

## 🎯 Benefits of This Approach

### **Clean Git History**
- Each commit represents a logical feature
- Easy to understand project evolution
- Simple to revert specific features
- Clear commit messages with detailed descriptions

### **Logical Progression**
- Foundation → Content → Enhancement → Polish
- Dependencies are properly ordered
- Each wave builds on previous ones
- Natural development flow

### **Easy Maintenance**
- Features can be updated independently
- Bug fixes can target specific waves
- New features can be added as new waves
- Clear separation of concerns

### **Collaboration Friendly**
- Other developers can understand the structure
- Easy to contribute to specific areas
- Clear boundaries between systems
- Reduced merge conflicts

---

## 🚀 Post-Deployment

### **Create Release Tags**
```bash
git tag -a v1.0.0 -m "Initial release with complete color system"
git push origin v1.0.0
```

### **Set Up Branch Protection**
- Protect `main` branch
- Require pull requests for changes
- Enable status checks
- Add code review requirements

### **Create Development Branch**
```bash
git checkout -b development
git push origin development
```

### **Set Up CI/CD**
- Add GitHub Actions for testing
- Set up automated deployment
- Add performance monitoring
- Include code quality checks

---

## 📝 Notes

- Each wave should be tested before committing
- Use `git status` to verify file changes
- Consider using `git add -p` for selective staging
- Always write descriptive commit messages
- Include relevant file counts in commit messages
- Test the game after each wave to ensure functionality

---

*This strategy ensures a clean, logical, and maintainable Git history while showcasing the project's evolution in a structured manner.*
