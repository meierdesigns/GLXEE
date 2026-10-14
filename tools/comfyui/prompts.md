# GLXEE Pixel Prompts (Flux2 Klein)

Style prefix (always prepend; bridge also force-converts output to grayscale):

```
pixel art, 16-bit game sprite, pure grayscale only, monochrome gray shades, NO color, NO hue, NO chroma, Game Boy gray palette, flat shading, crisp pixels, solid magenta background #FF00FF, centered, single object, no text, no UI, luminance mask for later in-engine tint
```

Negative (Legacy Illustrious; Flux2 Distilled nutzt ZeroOut):

```
photo, realistic, blurry, anti-aliasing, smooth gradients, 3d render, watermark, text, logo, multiple objects, busy background, noise, depth of field, color, chromatic, rainbow, neon glow hue
```

Save prefix (`SaveImage` / bridge `filenamePrefix`):
- Ships → `ships/vf_ship`
- Weapons / shots → `weapons/vf_shot`
- Abilities → `abilities/vf_ability`
- Planets → `planets/vf_planet`
- Obstacles → `obstacles/vf_obstacle`
- Mounts → `modules/vf_mount`
- Icons → `icons/vf_icon`

---

## Ships (top-down)

Player Starfighter:
```
top-down player starfighter, pointed nose, twin wings, cockpit window, compact fighter silhouette
```

Player Heavy:
```
top-down heavy fighter, thick armor plates, wide wings, dual thrusters, bulky silhouette
```

Enemy Scout:
```
top-down enemy scout ship, small triangular hull, single thruster, hostile look
```

Enemy Cruiser:
```
top-down enemy cruiser, large armored hull, side turrets, heavy thrusters
```

---

## Mounts (on-hull components, 8×8 feel)

Laser turret:
```
tiny top-down laser turret hardpoint, short barrel pointing up, gray metal mount, ship component module
```

Shield projector:
```
tiny side-mounted energy shield projector plate, hexagonal emitter, ship defense module
```

Ability pod:
```
tiny underside equipment pod, connector pins on top, compact system module
```

---

## Shots / weapons

Laser bolt:
```
vertical energy laser bolt, thin bright beam, simple glow core, weapon projectile sprite
```

Spread shot:
```
spread-shot energy pellet, small round projectile, bright core, soft outer ring
```

---

## Abilities / Icons

Energy Shield:
```
ability icon, circular energy shield bubble, hexagonal pattern, game UI icon, 32x32 feel
```

Evasion Boost:
```
ability icon, speed dash arrows, motion streaks, game UI icon
```

---

## Planets / levels

Mars surface tile:
```
mars planet surface tile, red rocky craters, seamless game background tile
```

---

## Faction emblems

Terran:
```
faction emblem icon, TERRAN, modular motif, simple glyph, 16x16 pixel feel, game UI icon
```

Kronax:
```
faction emblem icon, KRONAX, spikes motif, simple glyph, 16x16 pixel feel, game UI icon
```

Voidborn:
```
faction emblem icon, VOIDBORN, rings motif, simple glyph, 16x16 pixel feel, game UI icon
```

Pirate:
```
faction emblem icon, PIRATE, scrap motif, simple glyph, 16x16 pixel feel, game UI icon
```

Machine:
```
faction emblem icon, MACHINE, circuit motif, simple glyph, 16x16 pixel feel, game UI icon
```

Save prefix: `icons/vf_faction` → Accept as `assets/icons/sprites/faction-{id}.png`

---

## Faction ships (enemy-{faction}-{class})

Identity = silhouette topology only (shared Game Boy gray). Same pixel budget for all classes —
never “one more tip”, never faction hue coding.

Kronax scout (needle + claws):
```
top-down enemy spaceship, Game Boy grayscale only, shared gray metal palette, identity by silhouette topology only, NO faction colors, NO hue coding, diagonal claw blades, chevron spike hull, aggressive angled silhouette, needle dart topology, thin 1-lane spine, sharp tip, NO wings, single rear thruster, same tiny pixel budget, do not raise resolution, do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels
```

Machine capital (dual-hull + circuit):
```
top-down enemy spaceship, Game Boy grayscale only, shared gray metal palette, identity by silhouette topology only, NO faction colors, NO hue coding, orthogonal circuit grid, notched right-angle traces, forge-node silhouette, split dual-hull carrier topology, wide flat deck, four corner thrusters, catamaran outline, same tiny pixel budget, do not raise resolution, do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels
```

Terran assault (delta + modular plates):
```
top-down enemy spaceship, Game Boy grayscale only, shared gray metal palette, identity by silhouette topology only, NO faction colors, NO hue coding, stepped rectangular modular plates, brick segment hull, orthogonal block silhouette, delta-wing fighter topology, short triangular mid-wings, twin thrusters, closed solid body, same tiny pixel budget, do not raise resolution, do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels
```

Pirate heavy (brick + asymmetric scrap):
```
top-down enemy spaceship, Game Boy grayscale only, shared gray metal palette, identity by silhouette topology only, NO faction colors, NO hue coding, asymmetric L-block salvage, offset junk plates, uneven scrap silhouette, wide blunt brick topology, flat nose, side turret stubs, thick rectangle, NOT a scaled fighter, same tiny pixel budget, do not raise resolution, do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels
```

Voidborn elite (X-cross + broken ring):
```
top-down enemy spaceship, Game Boy grayscale only, shared gray metal palette, identity by silhouette topology only, NO faction colors, NO hue coding, broken ring arcs, hollow center gap, incomplete crescent silhouette, X-cross command topology, forked twin nose prongs, diagonal fins, center gap, same tiny pixel budget, do not raise resolution, do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels
```

Save prefix: `ships/vf_faction_ship` → Accept as `assets/ships/sprites/enemy-{faction}-{enemyClass}.png`

In `#` Asset Generator: categories **FACTIONS** and **FACTION SHIPS**.

---

## Obstacles

Small asteroid:
```
small asteroid rock, irregular silhouette, cratered surface, obstacle sprite
```

---

## In-Game (#)

Press `#` → category + element → Generate (bridge + Flux) → Accept writes an RGBA PNG and hot-reloads.
