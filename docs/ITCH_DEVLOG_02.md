# Devlog #2 — Breaking the ship into smaller ships

**GLXEE** · meierdesigns · architecture pass

---

GLXEE started as a small browser shooter.

Then the small browser shooter grew factions, galaxies, a Home Station, hangar
editing, procedural worlds, combat events, audio, asset tools, and enough
customization to make a single source file feel like its own boss fight.

This update is about making the project easier to keep building.

## One feature, one folder

The runtime still boots from the same `index.html`, and the game still runs
directly in the browser. The difference is inside the codebase:

```
js/
  core/       state, configs, input, progression
  game/       player, enemies, bullets, collisions, audio
  graphics/   sprites, palettes, ship styles, rendering
  ui/         station, hangar, editors, viewers, menus
```

Large systems now have a `core.js` plus focused modules. A ship loadout can
change without opening the entire hangar system. A new enemy behavior can live
beside the enemy runtime instead of being buried inside one giant file.

The public entry points stay in place, so the browser shell does not need a
bundler or a build step.

## The wave system

The refactor shipped in feature-focused waves:

- **39A — Core runtime:** state, configuration, input, loadouts, and game control
- **39B — Combat runtime:** players, bullets, enemies, obstacles, collisions, and audio
- **39C — Graphics and assets:** sprite loaders, ship rendering, palettes, and faction styles
- **39D — UI modules:** Home Station, hangar, editors, viewers, menus, and overlays
- **39E — Shell and docs:** script wiring, styles, architecture notes, and this guide

Each wave is a small checkpoint. That makes the history readable and gives each
feature area a safer place to evolve.

## Why do this now?

GLXEE is a game about assembling parts: hulls, weapons, abilities, modules,
factions, and stations. The code should work the same way.

Smaller modules make it easier to:

- add a new faction without disturbing unrelated viewers
- tune hangar anatomy without rewriting ship combat
- trace a browser bug from its entry point to one focused file
- review and revert a feature wave independently
- keep the no-build, browser-first workflow intact

This is not a visual reset. It is the scaffolding for the next visual and
gameplay passes.

## What is next

The next useful work is back in the game: polish the station loop, make faction
objectives more visible, and keep pushing the hangar from editor tool toward
player-facing customization.

The ship is still flying. It is just easier to repair now.

— Lance Meier / meierdesigns  
**GLXEE**
