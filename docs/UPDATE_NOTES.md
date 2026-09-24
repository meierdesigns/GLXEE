```
╔══════════════════════════════════════════════════════════════╗
║  GLXEE · TRANSMISSION LOG · UPDATE NOTES                     ║
║  channel: UGDF ARCHIVE · band: VOLTEX · format: RETRO        ║
╚══════════════════════════════════════════════════════════════╝
```

# Update Notes — Wave 9–24 (Station → Combat Events → Asset Pipeline)

**Build:** post-`v1.0` feature waves · **Branch:** `featurewaves`  
**Theme:** Game-Boy shell · Courier UI · pixel emblems · parallax station decks · combat-event doctrine

---

## Wave 9 — Galaxies, Factions & Planets

- Five home galaxies with faction ownership: **Milky Way** (Terran), **Andromeda** (Kronax), **Void Reach** (Voidborn), **Scrap Belt** (Pirate), **Synth Grid** (Machine).
- Full **Factions** meta: labels, traits, short/long lore, emblem icons, procedural planet themes (colors, patterns, name pools, enemy/obstacle doctrine).
- **Faction Viewer** archive: discover Factions through travel/combat, browse emblems + contact logs.
- Faction-colored planet SVGs (banded / cragged / ringed / pocked / faceted).
- Procedural explore/arrival planets for foreign galaxies.
- Galaxy map + planet viewer hooks for faction presence and difficulty lanes.

## Wave 10 — Arsenal (Weapons · Ships · Abilities · Economy)

- Expanded weapon registry with faction tags (Terran beams, Kronax claw/spike ordnance, shared lasers).
- Ship roster: Scrap Fighter → Terran line + **Kronax Raider / Claw**.
- Ability catalog growth (charge shot, drive, Kronax carapace / spike / reflex shells, shield sync).
- Economy: scrap / ore / crystal / voltex, blueprint drops, station upgrade tree costs.
- Content viewers (weapons, ships, abilities, defenses, enemies) wired to discovery + explore focus.

## Wave 11 — Home Station & Progression

- Home Station tabs: **Station · Upgrade · Hangar · Shop · Craft · Travel · Explorations**.
- Upgrade trees: station core / vault / hangar bays / modules; ship & module sub-trees.
- Shop categories: ships, blueprints, parts, portals — filter/sort by class, cost, tier.
- Hangar live preview + test arena handoff.
- Profile wallet, cargo teleport, blueprint unlock/craft loop.
- Per-tab station background art (`hs-bg-*`) + hangar menu plate.

## Wave 12 — Menu Shell, Profiles & Parallax

- Start screen rebuild: hangar-style hub, exploration clusters, Factions entry.
- Profile selection with themed background; discovery defaults (Terran, starter scrap hull, energy core).
- Mouse-follow **bg parallax** host (WoodChunk-light): overscan, glow, reduce-motion safe.
- Menu nav / menu state persistence across station tabs and viewers.
- Core/settings glue for control + appearance handoff.

## Wave 13 — Visual Shell

- Large `styles.css` pass: station decks, content viewers, parallax hosts, boot veil, pixel UI chrome.
- Background tokens for station / upgrade / hangar / shop / craft / travel / explorations / in-game.

## Wave 14 — Archive Docs

- README rewritten in GLXEE transmission style with lore for Factions, weapons, planets, station, galaxies.
- This update log + deployment wave strategy extended through Wave 14.

---

## Wave 15 — Combat Events & Event Archive

- **Combat-event archetypes** (`js/core/combat-event-config.js`): repair drones, shield battery, gunner wing, jammer, tether, and related summon roles with announce copy + counter hints.
- Runtime champion escorts: formation slots, role-forced escorts, timed side-spawns, jammer cooldown / tether speed debuffs.
- Announce banners during combat; discovery of event IDs into the active profile.
- **Event Viewer** archive: Explorations → ARCHIVE → EVENTS (dev mode shows full catalog).
- Enemy config + collision hooks for event roles; viewers/onboarding glue for discovery focus.

## Wave 16 — Faction Ship Silhouettes

- **FactionShipStyles** (`js/graphics/faction-ship-styles.js`): five factions × five classes (scout → capital) on a fixed lo-fi grid; identity by silhouette topology, shared gray palette (no color-coding hulls).
- Ship asset loader + sprite loader paths for `enemy-{faction}-{enemyClass}` PNGs.
- Graphics manager / enemy viewer / faction viewer consume silhouette style for previews and combat hulls.

## Wave 17 — Combat HUD & In-Game Shell

- Left cluster: planet info + weapon strip + player vitals (ship / energy / shield icon canvases).
- Right cluster: dynamic enemy health bars with faction tags; champion uses a vertical bar.
- Combat-event announce chrome in CSS; stage wrapper keeps the playfield glued to HUD clusters.
- UI manager enemy HUD layout, render/viewport-fit polish, game-control + core handoff.

## Wave 18 — Planet & Galaxy Arrival Content

- Planet config: normalized combat-event payloads on enemies; richer galaxy arrival content / seed helpers.
- Planet SVG pass: faction icon styles, procedural look expansion.
- Galaxy map, planet viewer, level-info manager, level-manager hooks for explore theaters.

## Wave 19 — Ship Loadout Visual Modules

- Loadout layout: thruster/drive aft pods, armor on flanks, shield stack on midline, weapon edge mounts.
- Module visual roles for renderer accents / glow; module-sprites redraw aligned to mount doctrine.

## Wave 20 — Menu Hub, Embedded Settings & Parallax Handoffs

- Start-screen hub: overlay vs embedded menus, Station return after leave/quit, embedded Profiles / Assets / Credits / Settings tabs.
- Asset Generator entry from settings; shift-arrow tab cycle.
- Parallax: crossfade handoffs, last-painted BG memory, self-mutation observer guard (no black gaps between decks).
- Home Station progression polish; profile selection; icon sprites + IconRenderer; `tools/render-icon-sprites.py` + menu icon previews.

## Wave 21 — Global Look & Theme Pipeline

- Color palette system: shared brightness recipe + `get/setGlobalLook` persistence.
- Theme context, theme editor slim-down, particle + performance optimizer alignment.
- Settings / cheat / ability config touch-ups for look handoff.

## Wave 22 — Procedural Audio Engine

- Web-Audio SFX/music rewrite: beep / sweep / noise / dual-tone builders, scheduled playback, volume lanes.
- Weapon / enemy / hit / kill / explosion / reflect / hurt events; planet ambient start/stop.
- Master / SFX / music volume + enable gates; context resume helper.

## Wave 23 — Asset Generator Pipeline

- In-game Asset Gen UI overhaul: grayscale preview matrix, faction-ship key parse, hover zoom, render settings panel, multi-select generate.
- Asset-gen client/registry expansion; Python bridge upgrades; `tools/asset-gen/start-all.sh` (ComfyUI + bridge).
- ComfyUI prompt library expansion; `npm run assets` / `icons:preview` scripts; Settings → Assets button.

## Wave 24 — Archive Docs (Wave 15–24)

- README boot/features/archive updated for combat events, faction silhouettes, combat HUD, audio, asset pipeline.
- This update log + `docs/git-deployment-strategy.md` extended through Wave 24.
- ComfyUI / assets README sync for `npm run assets` and icon preview tooling.

---

## Wave 35 — Ship Anatomy & Voxel Rendering

- Edge-based wing crops prevent fuselage pixels from leaking into left/right component previews.
- Ship hull parts render on a shared square voxel raster with configurable scale and wing rotation.
- Wing connectors support strut, plate, double, and hinge styles with adjustable attachment position and width.
- Persistent ship loadouts now store segment UVs, anatomy settings, and symmetric wing shape variants.

## Wave 36 — Hangar Component Customization

- Hangar component trees stay synchronized with equipped modules, slot skins, and ship selection.
- Area guides, wing hit targets, slot pins, draggable module cards, and anatomy reset controls complete the bay editor.
- Cosmetic module skins persist both by mounted module and by hangar slot.

## Wave 37 — Hangar Editing & Profile Handoff

- Ship editor exposes live wing crop controls for asset authoring.
- Hangar, onboarding, profile selection, and start-screen transitions preserve the selected ship and loadout.
- Menu appearance and navigation handoffs keep the hangar editor inside the station flow.

## Wave 38 — Archive Docs

- README feature inventory now documents editable ship anatomy, symmetric wing styling, and draggable hangar cards.
- Git deployment strategy records the feature-focused commit commands for Waves 35–37.

---

## Pilot checklist

```
[ ] npm start → localhost:3000
[ ] Profile create → Home Station tabs switch with parallax BG (crossfade, no black gap)
[ ] Discover / browse FACTIONS + EVENTS archives
[ ] Travel / explore foreign galaxy → faction + event unlock
[ ] Champion combat → event announce + escort roles (repair / jammer / tether)
[ ] Enemy HUD right cluster · player vitals left cluster
[ ] Shop / craft / hangar preview · loadout module mounts
[ ] Settings → Assets / # generator (optional: npm run assets)
[ ] Mars→Pluto combat + ambient + resource loot
```

```
── END TRANSMISSION · GLXEE ARCHIVE ──────────────────────────
```
