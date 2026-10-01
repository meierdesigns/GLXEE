<div align="center">

<img src="assets/ui/readme-banner.svg" alt="GLXEE — UGDF Archive · Intergalactic Combat Simulator" width="960" />

# GLXEE

**A browser-based Game Boy–shell space shooter about factions, loadouts, and the next jump.**

[![Runtime: browser](https://img.shields.io/badge/runtime-browser-111111?style=flat-square&labelColor=000000&color=b0b0b0)](#boot)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square&labelColor=000000&color=888888)](#credits)
[![Creator: meierdesigns](https://img.shields.io/badge/creator-meierdesigns-111111?style=flat-square&labelColor=000000&color=3A6EA5)](#credits)
[![Factions: 5](https://img.shields.io/badge/factions-5-111111?style=flat-square&labelColor=000000&color=C44B2F)](#factions-and-galaxies)
[![Play on itch.io](https://img.shields.io/badge/play-itch.io-111111?style=flat-square&labelColor=000000&color=FA5C5C)](https://meierdesigns.itch.io/glxee)

</div>

**Play free in the browser:** [meierdesigns.itch.io/glxee](https://meierdesigns.itch.io/glxee)

GLXEE is a no-build browser shooter. Choose a faction, assemble a ship from
area-sized modules, clear planets, earn contracts, trade with allies, and travel
through five faction-themed galaxies. Its identity is carried by pixel shapes,
not just color: every faction has its own silhouette, doctrine, and visual
language.

```text
╭────────────────────────────── VOLTEX CHANNEL ──────────────────────────────╮
│  PILOT STATUS   READY                                                       │
│  THEATER         MILKY WAY · MARS                                           │
│  LOADOUT         NOSE  M   CORE  S   AFT  M   WINGS  S/S                    │
│  OBJECTIVE       CLEAR THE STAGE · CLAIM THE LOOT                           │
│  NEXT JUMP       HOME STATION → TRAVEL → UNKNOWN SECTOR                     │
│  PLAY            https://meierdesigns.itch.io/glxee                         │
╰─────────────────────────────────────────────────────────────────────────────╯
```

<div align="center">

<img src="assets/ui/readme-shot-combat.png" alt="GLXEE combat on Mars — live game screenshot" width="960" />

<br/>

`COMBAT  ·  MARS STAGE  ·  FACTION BARS  ·  LOADOUT RAIL`

<br/>

<img src="assets/ui/readme-shot-factions.png" alt="GLXEE Factions relations screen — live screenshot" width="960" />

<br/>

`FACTIONS  ·  RELATIONS  ·  TRADE  ·  CONTRACTS`

</div>

> **Design rule:** the README follows the game loop. Boot and controls come
> first, systems are described once in their owning section, and development
> history stays at the end.

## Contents

- [Boot](#boot)
- [Controls](#controls)
- [The game loop](#the-game-loop)
- [Factions and galaxies](#factions-and-galaxies)
- [Home Station and hangar](#home-station-and-hangar)
- [Combat](#combat)
- [Screenshots](#screenshots)
- [Features](#features)
- [Architecture](#architecture)
- [Development waves](#development-waves)
- [Documentation](#documentation)
- [Lore](#lore)
- [Credits](#credits)

<img src="assets/ui/readme-h-boot.svg" alt="CH.01 BOOT" width="960" />

## Boot

Requirements: **Python 3**. There is no build step and no dependency install.

```bash
npm start
# http://localhost:3000
```

Equivalent command:

```bash
python3 -m http.server 3000
```

Optional local tools:

```bash
npm run assets          # ComfyUI + asset-gen bridge
npm run comfy           # ComfyUI workflows
npm run asset-gen       # asset-gen bridge on :8787
npm run icons:preview   # render icon previews
```

`npm start` is a static file server. It must be run from the repository root.

<img src="assets/ui/readme-h-controls.svg" alt="CH.02 CONTROLS" width="960" />

## Controls

| Input | Action |
|:------|:-------|
| Arrow keys / WASD | Move |
| Space | Fire; hold to charge |
| Shift | Charge Drive boost |
| Q / E | Cycle weapons |
| Escape | Pause; switch menu groups in the station |
| Ctrl + 1–8 | Select color palette |
| `#` or Settings → Assets | Open Asset Generator |
| Settings → Faction | Open Faction Command |

Menu navigation is keyboard-first: arrow keys move focus, Enter confirms, and
Escape closes the active overlay. Text fields keep their normal caret controls.

## The game loop

```text
Choose profile
    ↓
Home Station: upgrade · shop · craft · hangar · missions · factions
    ↓
Accept a planet, faction, or bounty contract
    ↓
Travel / launch → clear stages → collect loot and mission rewards
    ↓
Upgrade hull areas and slots · trade · change the loadout · jump again
```

A mission is either a **LIBERATE** run on an uncleared planet or a lower-paying
**PATROL** on a cleared one. One mission can be active at a time. Faction
contracts can target reachable galaxies and may teleport the pilot before launch.

<img src="assets/ui/readme-h-factions.svg" alt="CH.03 FACTIONS" width="960" />

## Factions and galaxies

Five factions define the main theaters. Their silhouette rules, procedural planet
styles, enemy pools, and strategic goals are shared by combat and exploration.

| Faction | Galaxy | Silhouette language | Doctrine |
|:--------|:-------|:--------------------|:---------|
| **Terran** | Milky Way | Modular plates | Engineers, escorts, safe lanes |
| **Kronax** | Andromeda | Claws and spikes | Ambush, speed, war packs |
| **Voidborn** | Void Reach | Broken rings | Fold-space, silent fleets |
| **Pirate** | Scrap Belt | Asymmetric scrap | Salvage, black docks, mutiny |
| **Machine** | Synth Grid | Circuit grids | Logic, forge nodes, replication |

Foreign galaxies begin with generated arrival sectors. Faction themes seed
planet names, obstacle doctrine, enemy compositions, icons, and background
patterns. Reputation ranges from -100 to +100; allegiance, pacts, and contracts
change whether a faction trades and which prices it offers.

<div align="center">

<img src="assets/ui/readme-shot-emblems.png" alt="Hi-res faction emblems in the Relations screen" width="960" />

<br/>

`TERRAN` · `KRONAX` · `VOIDBORN` · `PIRATE` · `MACHINE`

<br/>

<img src="assets/ui/readme-strip-emblems.png" alt="Hand-shaded 32×32 faction emblems at @4x" width="960" />

<br/>

<img src="assets/ui/readme-strip-planets.png" alt="Live procedural planets — Mars Jupiter Saturn Neptune Pluto" width="960" />

<br/>

`MARS` · `JUPITER` · `SATURN` · `NEPTUNE` · `PLUTO`

</div>

Large UI surfaces (crest, relations cards, profile modal) draw **hand-shaded
32×32 emblems** through the `@2x` / `@4x` icon path instead of a blocky upscale
of the 16×16 silhouettes. Resource chips use the same hi-res treatment. The
Pirate seal is an angular void-skull over crossed boarding cleavers — harsh on
both the 16px HUD badge and the enlarged `@4x` crest.

### Faction relations and contracts

The Home Station Factions area has focused views:

- **Relations:** reputation meter, allegiance, pacts, controlled planets, and lore.
- **Fleets:** live formation preview with zoom controls (− / + / reset and wheel).
- **Trade:** faction specialties, demanded resources, buy/sell quotes, and relation discounts.
- **Contracts:** faction jobs and bounty hunts in reachable galaxies.

Contracts pay credits and materials when the target planet stage is cleared and
raise reputation with the issuing faction.

### Galactic control

Each galaxy has a faction ruler, a hidden base, and a faction-specific expansion
pattern. Flights and cleared battles advance the control simulation:

- factions found outposts, war camps, sanctums, hideouts, or relays;
- holdings add defenders and faction-specific parts to their trading stations;
- stations can be raided, and destroying every station exposes the base;
- destroying the base changes a held galaxy to contested control;
- a new profile begins with a seeded home-galaxy invasion that can be repelled
  for an opening reward.

**Shared world ownership:** clearing a planet claims it for the pilot's faction
in a global `galaxy.owners` map (latest clear wins). Holding more than half of
a galaxy's planets makes that faction the ruler for every pilot; rivals keep
the galaxy **CONTESTED**. Built-in control presets bump with `GALAXY_CONTROL_REV`
so saved galaxies pick up new ally/rival rules.

**Ally defense:** when an allied faction's home galaxy is invaded by a common
enemy, the pilot can fly there to repel it for bonus credits, scrap, and
reputation with the ally.

**Custom galaxies:** the main-menu **GALAXIES** viewer browses every shared
galaxy (ruler emblems, map, planets). Pilots can generate a named start galaxy
at creation (planet count, difficulty tier, suns, rivals) or open NEW GALAXY
from the viewer; unused generated galaxies can be deleted.

Planet cards on the explore map show atmosphere haze from the live SVG palette.
Border **checkpoints** between sectors use faction silhouette art (modular,
spikes, rings, scrap, circuits). Route beams carry **bidirectional data-packet
traffic**; foreground barriers sit in front of lower routes for depth. A **ship
locator** recenters the map on the pilot. Selecting a border, planet, or station
updates the confirm row:

| Selection | Actions |
|:----------|:--------|
| Locked border / planet | Disabled lock button |
| Open planet | **FLY TO** the theater |
| Friendly / trade station | **DOCK** |
| Hostile station | **RAID** (+ fly-away) |
| Exposed faction base | **ASSAULT BASE** |
| Checkpoint border | Jump to the planet whose clear opens it |

<img src="assets/ui/readme-h-station.svg" alt="CH.06 HOME STATION" width="960" />

## Home Station and hangar

The station is the progression hub:

| Area | Purpose |
|:-----|:--------|
| Station | Overview, cargo, and current status |
| Upgrade | Hull-area and slot-size upgrades |
| Hangar | Ship editor, loadout, parts workspace, and test arena |
| Shop | Ships, blueprints, modules, and style unlocks |
| Craft | Unlock hulls and equipment from blueprints |
| Explorations | Ships, planets, enemies, factions, and events |
| Missions | Liberate / patrol board and mission rewards |
| Factions | Relations, trade quotes, contracts, and fleet previews |

**PLAY** is no longer a station sub-tab. A dedicated header launch button (and a
matching control in the main menu) drops straight onto the galaxy map. Area tabs
carry corner deco icons so HOME STATION, HANGAR, FACTIONS, and EXPLORATIONS read
as distinct hubs at a glance. Travel remains a modal over PLAY and is never
restored after a reload.

### Browser shell and GUI scale

Home Station renders inside a dedicated `.vf-browser-shell` frame so the
station content fills the live viewport without double-scaling. The shell uses
a proportional `--gui-zoom` baseline (default **75%**) so tabs, labels, and the
PLAY launch control stay readable while still matching the compact Game Boy
presentation. A frame **GUI** slider (50–125%) writes the same `--gui-zoom`
through `uiAppearanceManager` and reschedules viewport fit.

- Native browser zoom stays available; GLXEE's shell zoom is separate.
- Wide and Cursor-hosted viewports keep the same proportional content scale.
- Header actions stay docked: crest, resources, LOGOUT, and PLAY in one strip.
- Mobile-narrow layouts allow PLAY to wrap full-width under the header.

### Hull areas and slots

Every ship has four areas: **NOSE**, **CORE**, **AFT**, and **WINGS**.

- Area upgrades add slots and frame bonuses.
- Individual slots upgrade from **S → M → L**.
- Split wing mounts use mirrored half-size sockets.
- Weapon sockets can be dragged between nose, core, and wings when space allows.
- Area toggles can hide nose, aft, or wing sections and safely remap modules.
- The hangar Parts view shows inventory, fit status, slot size, and drag targets.
- Frame-edge resize keeps the grabbed handle under the pointer at every scale.

The loadout is persistent per profile and per ship. It includes weapon mounts,
module offsets, slot upgrades, anatomy settings, cosmetic skins, wing variants,
connection settings, and disabled areas.

<div align="center">

<img src="assets/ui/readme-h-ships.svg" alt="CH.07 SHIPS" width="960" />

<img src="assets/ui/readme-strip-ships.png" alt="Live faction assault hulls from the combat renderer" width="960" />

<br/>

<img src="assets/ui/readme-strip-ship-classes.png" alt="Live Terran class ladder — scout assault heavy elite capital" width="960" />

</div>

<img src="assets/ui/readme-h-weapons.svg" alt="CH.08 WEAPONS" width="960" />

<div align="center">

<img src="assets/ui/readme-strip-weapons.png" alt="Live weapon icons from iconRenderer" width="960" />

<br/>

`LASER` · `SPREAD` · `RAPID` · `PLASMA` · `MISSILE` · `ION`

</div>

<img src="assets/ui/readme-h-events.svg" alt="CH.10 COMBAT EVENTS" width="960" />

## Combat

Combat is a vertical shooter with a readable pixel hierarchy:

- Five factions × five hostile classes: scout, assault, heavy, elite, capital.
- Faction silhouettes use topology and plating so shape communicates doctrine.
- Champions can announce escorts: repair drones, shield batteries, gunners,
  jammers, and tethers.
- **Scrolling terrain** walls carve flight lanes (canyons, narrows, teeth, reefs)
  tinted by the planet and the holding faction.
- Rocks take **weapon-scaled damage**, splash, and shed collidable chunks; debris
  is visual-only chip FX in the rock's own colours.
- **Planet tiers** (Easy → Nightmare) scale enemy health, speed, damage, and spawn
  cadence so early theaters forgive and late ones punish.
- **Stage count** varies by planet difficulty (roughly 2–5 stages + boss); later
  stages raise terrain danger and harsh flight zones.
- Victory and defeat screens show an **outcome stepper** for the planet just
  fought (cleared / current WON·LOST / locked).
- **Boss stages** after the regular clear: multiphase patterns, escort calls, and
  a dedicated HP bar — bosses ignore the normal lane shooter loop.
- **Supply crates** drop random timed power-ups: **POWER SHOT**, **RAPID FIRE**,
  or **BARRIER** (half damage taken), each with HUD notice and icon glow.
- Enemy waves use **seeded liveries** so ships of one faction still look distinct;
  renegade contract targets get outlaw markings (hazard slash, crossed badge).
- Faction contracts can spawn **renegade captains** or **outlaw gangs** with their
  own callsigns and paint.
- Ambush encounters can roll a raider boss, a pirate pack, or a light swarm.
- Weapons, abilities, shields, charge, drive, pickups, and explosion FX form the
  moment-to-moment combat layer.
- Victory loot pays resources, credits, blueprint progress, and active mission
  rewards; the scoop phase ends early once the field is clear.

The combat renderer uses a shared ship voxel lattice, faction hull builders,
Scale2x refinement on high-density displays, pixel snapping, and authored full
sprites where segmented rendering would distort a faction silhouette. Enemies
steer around predictive obstacle sweeps and terrain walls so lanes stay readable.

## Screenshots

Live captures from the current build (station shell, factions, travel, combat).

<div align="center">

| Home Station | Galaxy travel |
|:---:|:---:|
| <img src="assets/ui/readme-shot-station.png" alt="Home Station storage" width="460" /> | <img src="assets/ui/readme-shot-galaxy.png" alt="Galaxy travel map" width="460" /> |
| Upgrade tree | Combat focus |
| <img src="assets/ui/readme-shot-upgrade.png" alt="Station upgrade tree" width="460" /> | <img src="assets/ui/readme-shot-combat-focus.png" alt="Mars combat focus crop" width="460" /> |
| Factions (hi-res emblems) | Emblem strip |
| <img src="assets/ui/readme-shot-factions.png" alt="Factions relations with hi-res emblems" width="460" /> | <img src="assets/ui/readme-strip-emblems.png" alt="Hand-shaded faction emblems @4x" width="460" /> |

<br/>

<img src="assets/ui/readme-shot-emblems.png" alt="Relations row — live hi-res emblems" width="960" />

<br/>

<img src="assets/ui/readme-strip-ships.png" alt="Live faction hull lineup" width="960" />

<br/>

<img src="assets/ui/readme-strip-planets.png" alt="Live procedural planet lineup" width="960" />

<br/>

**Play:** [meierdesigns.itch.io/glxee](https://meierdesigns.itch.io/glxee)

</div>

## Features

- Five faction identities with emblems, lore, relations, pacts, contracts, and trade.
- Five galaxies with procedural foreign-galaxy arrival sectors.
- Home Station progression: shop, craft, upgrade, hangar, travel, missions, and archives.
- Persistent profile progression with resources, credits, discoveries, missions, and loadouts.
- Four upgradeable hull areas plus individual S/M/L slot upgrades.
- Weapon slots can be purchased per ship, mounted in the nose, core, or wings,
  and protected from overlapping through bounded drag placement.
- Drag-and-drop hangar Parts workspace and movable weapon sockets.
- Mirrored wing placement, faction weapon mounts, visual module integration, and cosmetic skins.
- Faction-specific weapon mount art and full-sprite fallback rendering for
  procedural ships.
- Resizable station sidebars with remembered widths and responsive hangar panels.
- Home Station browser shell with proportional GUI zoom (default 75%, slider 50–125%) and a dedicated PLAY launch into the map.
- Area-tab corner deco icons and keyboard focus that opens PLAY or the first area hub.
- Galaxy explore: atmosphere planet cards, faction border checkpoints, fly / dock / raid / assault actions.
- Bidirectional route traffic, ship locator, and zoom-aware map detail on the explore map.
- Shared world planet ownership, custom generated galaxies, and a main-menu GALAXIES viewer.
- Ally-galaxy invasions to defend, renegade/gang contracts, and seeded enemy liveries.
- Variable stage counts with an outcome stepper; crates grant power shot, rapid fire, or barrier.
- Fullscreen toggle, game-over wreck backdrop, and embedded-browser reload keys (F5 / Ctrl+R).
- Angular Pirate emblem at 16px and `@4x`; faction fleet preview zoom in the station.
- Profile score and ability-stat readouts for faster loadout decisions.
- Faction fleet previews in the station and high-definition navigation icons.
- Animated planet spin frames and extra faction-specific planet treatments.
- Guided start intro and embedded menu layouts that keep the station loop intact.
- Procedural planet SVGs, parallax station decks, palette editors, and global look persistence.
- Combat events, champion escorts, patterned obstacles, pickups, loot, and Web Audio SFX.
- Scrolling planet terrain, destructible rocks, boss stages, and timed supply crates.
- Hand-shaded hi-res faction emblems and resource icons for large UI draws.
- Zoom-safe pointer hit testing across Chromium and embedded Electron viewports.
- Optional YouTube soundtrack / beat-sync layer.
- Optional ComfyUI and asset-generation bridge.
- Cursed IDE packages under `packages/`.

### Current build focus

```text
STATION ── GUI scale slider ── fleet zoom ── hangar edge drag ── PLAY launch
   │
TRAVEL  ── ship locator ── packet traffic ── border depth ── fly/dock/raid
   │
ICONS   ── pirate void-skull ── @4x crests ── faction viewer accents
```

Recent polish refreshes the Pirate seal, adds a persistent GUI scale slider,
puts a ship locator and bidirectional traffic on the galaxy map, and lets the
faction fleet preview zoom.

<img src="assets/ui/readme-h-layout.svg" alt="CH.12 ARCHITECTURE" width="960" />

## Architecture

GLXEE deliberately remains a script-loaded browser project. Large systems are
split into focused folders while their public entry points remain stable.

```text
index.html                 dependency-ordered entry point
styles.css                 pixel UI, station, hangar, HUD, and faction chrome
css/                       optimized variables and asset-generator styles

js/core/                   state, configs, input, economy, profiles, loop
js/game/                   player, enemies, bullets, collisions, obstacles, audio
js/graphics/               sprites, palettes, silhouettes, effects, renderers
js/ui/                     station, hangar, editors, viewers, maps, menus
js/abilities/              ability definitions and player abilities
assets/                    sprites, ship models, modules, levels, metadata

docs/                      architecture, technical notes, updates, devlogs
rules/                     game rules and tactical design notes
tools/                     ComfyUI, asset-gen, and icon-preview tooling
packages/                  Cursed IDE packages
```

### Module convention

A large system such as `js/ui/home-station.js` keeps its entry point and stores
focused methods in `js/ui/home-station/`:

```text
js/ui/home-station/core.js
js/ui/home-station/render-hangar-tab.js
js/ui/home-station/hangar-parts-grid.js
js/ui/home-station/area-upgrades.js
js/ui/home-station.js
```

`core.js` establishes the class. The focused files extend it with
`extendClass(...)`. `index.html` loads the parts in dependency order, followed
by the entry file. ES modules such as the ship asset loader import their own
parts.

Keep new methods near related methods and split a file before it becomes hard
to review. Runtime data follows the same pattern in config, sprite, and
profile-manager folders.

<img src="assets/ui/readme-h-docs.svg" alt="CH.13 DEVELOPMENT WAVES" width="960" />

## Development waves

Changes are committed by feature so each slice has a readable history and can
be reviewed or reverted independently.

| Wave | Feature | Scope |
|:-----|:--------|:------|
| 39A–39E | Runtime modularization | Core, combat, graphics, UI, shell, and docs split into focused modules |
| 40A–40C | Anatomy and station controls | Voxel hulls, hangar editing, dialogs, themes, and navigation |
| 41A–41D | Rendering, travel, combat, commerce | Scale2x ships, galaxy travel, combat progression, trading posts, cosmetics |
| 42A–42C | Area and armament systems | Hull areas, Parts workspace, slot mounting, faction weapons, hangar polish |
| 43A | Loadout integration | Slot sizes, weapon mounts, ability integration, faction hull builders |
| 43B | Missions and relations | Mission board, faction reputation, contracts, bounty hunts, trade terms |
| 43C | Station mission UI | Missions, faction relations, faction trade, contract tabs, hangar slot bar |
| 44A | Galactic control | Faction holdings, expanding stations, base raids, invasions, contested galaxies |
| 44B | Combat presentation | Weapon slot purchases, bounded mounts, full-sprite weapons, collision-safe placement |
| 44C | Station UX | Resizable sidebars, hangar layout polish, profile flow, palette and menu refinements |
| 45A | Combat staging | Enemy lanes, victory handoff, loot timing, pickup and collision polish |
| 45B | Galaxy routing | Arrival sectors, route preview, galaxy state, and parallax handoff refinements |
| 45C | Hangar presentation | Power budget, slot fit states, parts presentation, and test-arena polish |
| 47A | Pilot readouts | Profile scoring, ability stats, combat progression, and loadout feedback |
| 47B | Planet theaters | Galaxy navigation, animated planet frames, and faction visual treatments |
| 47C | Station presentation | Fleet previews, HD navigation icons, start intro, and hangar shell polish |
| 48C | GLXEE scale baseline | Proportional 75% shell zoom for the normal browser view and compact HUD presentation |
| 48D | Browser zoom compatibility | Keep native browser zoom controls while the GLXEE shell uses its compact 75% baseline |
| 48E | Station header fit | Keep PLAY compact and dock LOGOUT beside the resource strip above the navigation tabs |
| 48F | Station content scale | Match the visible Home Station layout to the browser's 75% presentation at normal browser zoom |
| 48G | Wide viewport response | Keep the full responsive shell without changing the proportional GUI baseline |
| 48H | Cursor viewport fit | Use the full Cursor browser area at its measured responsive width |
| 48I | Compact viewport baseline | Preserve the proportional 75% station content scale across wide Cursor viewports |
| 48J | Browser shell frame | Wrap Home Station content in `.vf-browser-shell` so the station fills the live viewport cleanly |
| 48K | Station readability | Uniform GUI zoom geometry, fixed PLAY launch width, larger tab labels, and mobile wrap |
| 49A | README visual refresh | Live sprite strips for fleet, planets, and weapons plus updated terminal banner chrome |
| 49B | Live README screenshots | Capture station, factions, galaxy travel, and Mars combat into the GitHub archive |
| 50 | Live README strips | Replace old planet/weapon/ship gallery sprites with combat-renderer and SVG exports |
| 51A | Hi-res emblems | Hand-shaded 32×32 faction emblems and resource icons on the `@2x`/`@4x` path |
| 51B | Zoom-safe pointers | Patch CSS-zoom rect drift so hit tests match visual pixels across engines |
| 51C | Scrolling terrain | Destructible rocks, debris, planet-tinted walls, and flight-lane patterns |
| 51D | Bosses and planet tiers | Difficulty curve, multiphase bosses, ambush flavours, enemy steering |
| 51E | Supply crates | Timed power-shot crates, boosted bullet glow, and faster victory scoop |
| 51F | Galaxy explore polish | Faction station borders, stage progress, and explore-map refinements |
| 51G | Station and HUD polish | Weapon keys, shield vitals, hangar tips, and combat info panel readability |
| 51H | README wave archive | Hi-res emblem screenshots and expanded combat/docs for waves 51A–51G |
| 51I | Live screenshot refresh | Recapture station, upgrade, galaxy, factions, and Mars combat with terrain |
| 52A | PLAY launch | Dedicated header/menu PLAY control; remove PLAY from station sub-tabs |
| 52B | Border checkpoints | Faction silhouette borders, fly/dock/raid/assault confirms, planet atmo haze |
| 52C | Station and map chrome | Area-tab corner deco, faction station fills, selection frames, PLAY styling |
| 52D | README travel archive | Document PLAY launch, border actions, and explore-map chrome for waves 52A–52C |
| 53A | Shared world ownership | Global planet owners, galaxy generation, warp tiers, control presets |
| 53B | Invasions and liveries | Ally defense invasions, renegade/gang contracts, seeded enemy paint |
| 53C | Multi power-ups | Crate drops for power shot, rapid fire, and barrier with HUD cues |
| 53D | Stage progression | Variable stage counts, stage-scaled terrain, victory/defeat outcome stepper |
| 53E | GALAXIES viewer | Main-menu galaxy browser and custom start-galaxy creation modal |
| 53F | Explore map sync | Ownership/invasion cues, battle marks, and travel confirm polish |
| 53G | Shell chrome | Fullscreen toggle, game-over wreck, reload keys, and UI styling |
| 53H | README world archive | Document shared world, power-ups, stages, and GALAXIES for waves 53A–53G |
| 54A | Pirate emblem | Angular void-skull boarding seal at 16px and hi-res `@4x` |
| 54B | GUI scale slider | Persistent 50–125% shell zoom via frame slider and uiAppearance |
| 54C | Map traffic and locator | Bidirectional route packets, ship locator, zoom detail, barrier depth |
| 54D | Faction fleet zoom | Fleet preview zoom controls and accented faction-viewer emblems |
| 54E | Hangar edge drag | Pointer-locked frame resize at every existing scale |
| 54F | Map and station chrome | GUI slider, ship locator, traffic, fleet zoom, and viewer accents |
| 54G | README map polish | Document pirate seal, GUI slider, locator, and fleet zoom for 54A–54F |

The wave commit convention is:

```text
feat: <feature> wave <id>
docs: document <feature> wave <id>
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — project layout and module conventions.
- [Technical notes](docs/TECHNICAL.md) — implementation details.
- [Update notes](docs/UPDATE_NOTES.md) — historical gameplay waves.
- [Devlog 1](docs/ITCH_DEVLOG_01.md) — faction silhouettes and combat identity.
- [Devlog 2](docs/ITCH_DEVLOG_02.md) — modular runtime refactor.
- [Devlog 3](docs/ITCH_DEVLOG_03.md) — living galaxies, hangar engineering, and the new GLXEE README style.
- [Git deployment strategy](docs/git-deployment-strategy.md) — feature-wave workflow.
- [Game rules](rules/game-rules.md) — design rules and tactical constraints.
- [Assets](assets/README.md) — asset database and generation notes.
- [ComfyUI / asset-gen](tools/comfyui/README.md) — optional asset tooling.

## Lore

In 2187, the discovery of Voltex Crystals turned every jump lane into
contested ground. The Terran Concord protects the Milky Way, Kronax packs raid
Andromeda, Voidborn fleets fold through cold rings, Pirate freebooters weld
ships in the Scrap Belt, and the Machine Collective expands through the Synth
Grid.

Every faction wants the same glowing dust. Pilots claim planets, sign pacts,
run contracts, and learn that every silhouette on the scanner is a doctrine —
not merely a hull.

For the full contact archive, see the faction entries in the original update
notes and the [GLXEE devlogs](docs/).

## Credits

**GLXEE** — created by Lance Meier / [meierdesigns](https://github.com/meierdesigns)

- Play: [meierdesigns.itch.io/glxee](https://meierdesigns.itch.io/glxee)
- License: MIT
- Runtime: browser
- Repository: [github.com/meierdesigns/GLXEE](https://github.com/meierdesigns/GLXEE)
