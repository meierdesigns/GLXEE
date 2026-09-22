# Devlog #1 — Why every enemy silhouette is a faction fingerprint

**GLXEE** · meierdesigns · itch.io ready paste

---

Most vertical shooters teach you to read **color** and **HP bars**.

GLXEE wants you to read **shape**.

Five factions don’t just get different lore tags — they get different **topologies**. A Kronax scout isn’t a recolored Terran scout. It’s a clawed silhouette. A Voidborn capital isn’t “bigger purple.” It’s a broken-ring carrier outline that already feels wrong before the first shot lands.

That was the bet: if the Game Boy shell is the body, **faction identity has to live in the pixels**.

---

## The cool bit: a 5×5 identity grid

Every hostile is keyed as:

```
enemy-{faction}-{class}
```

Classes are fixed combat roles:

| Class | Shape idea |
|:------|:-----------|
| Scout | Needle dart · one thruster |
| Assault | Delta wing · twin engines |
| Heavy | Blunt brick · turret stubs |
| Elite | X-cross · forked nose |
| Capital | Split dual-hull · champion frame |

Then each faction **remorphs** that topology:

- **Terran** — modular plates, orthogonal blocks (safe lanes, engineering pride)
- **Kronax** — chevron spikes, claw blades (ambush first)
- **Voidborn** — hollow rings, unfinished crescents (fold-space silence)
- **Pirate** — asymmetric scrap L-blocks (welded from wrecks)
- **Machine** — circuit notches, forge-node grids (hull = node)

Same role. Different doctrine. Readable at a glance on a tiny combat plate.

On the HUD, the right cluster even tracks **enemy faction bars** — so the silhouette you just learned to fear also owns a color on your vitals rail.

---

## Why this matters in play

You’re not only clearing lanes across Mars → Pluto.

You’re learning which banner owns the theater:

- Mars likes Pirate scrap and Terran patrols
- Jupiter is Kronax storm country
- Saturn leans Machine forge dens
- Neptune goes Voidborn / Kronax ice
- Pluto is nightmare cadence — Voidborn + Pirate leftovers

Foreign galaxies start empty. Travel seeds sectors from faction themes — names, obstacles, enemy pools, icon styles — so Andromeda doesn’t feel like a palette-swap of the Milky Way. It feels like someone else’s war.

Then you come home to **Home Station**: scrap → shop/craft → hangar loadout → jump again. Allegiance, pacts, and claimed planets sit under **Faction Command**. The meta loop isn’t “unlock a skin.” It’s “pick a banner and live with the consequences.”

---

## Combat events: champions don’t fight alone

When a capital finally shows up, it can bring doctrine with it:

- Repair drones
- Shield batteries
- Gunner wings
- Jammers
- Tethers

The announce banner hits, escorts form, and suddenly the silhouette you recognized becomes a **problem with friends**. That’s the moment GLXEE stops being a tidy score-attack and starts feeling like a faction engagement.

---

## The shell

Everything sits in a **Game Boy–style browser shell** — courier terminals, parallax station decks, charge drive, weapon cycle, loot scoop after the field clears. No install, no build. Boot, fly, claim.

It’s deliberately small on screen and large in systems: factions, galaxies, loadouts, discovery archive, procedural sectors.

---

## What I’m shipping toward on itch

A short, readable space war where:

1. You can tell who you’re fighting by **outline** alone  
2. Your home station makes the next jump feel earned  
3. Champions feel like **events**, not HP sponges  

If you try a build, tell me which faction silhouette clicked first. Kronax spikes are usually the loudest — Voidborn rings are the ones that haunt.

— Lance Meier / meierdesigns  
**GLXEE**

---

### Short itch “About” blurb (optional)

> GLXEE is a browser Game Boy–shell space shooter. Fly for one of five factions, learn their silhouettes in combat, loot between jumps at Home Station, and punch portals into galaxies that don’t belong to you.
