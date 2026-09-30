"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    renderShipModule(
        ctx,
        mod,
        x,
        y,
        width,
        height,
        colorOverlay,
        overlayIntensity = 0,
        renderOptions = null,
        factionStyle = null
    ) {
        const intensity = Number.isFinite(Number(overlayIntensity)) ? Number(overlayIntensity) : 0;
        const role = mod.role || mod.kind;
        const face = mod.face || 'up';
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height != null ? height : width));

        // Ship display always rebuilds components procedurally into the full
        // target frame. PNG / matrix mounts are editor assets only.
        const cfg = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.getModuleConfigEntry)
            ? shipLoadoutManager.getModuleConfigEntry(mod.kind, mod.id)
            : null;
        // A player-chosen cosmetic skin (independent dropdown, no stat change)
        // always wins over the module's own baked-in visual.
        const visualId = (mod.skin && mod.skin !== 'default') ? mod.skin
            : (cfg && cfg.visual ? cfg.visual : null);
        // Drawn straight in screen space (mirroring is baked into the voxel
        // grid) so the module lands on the ship's shared voxel lattice.
        this.drawProceduralModule(
            ctx,
            x,
            y,
            w,
            h,
            role,
            mod.kind,
            colorOverlay,
            intensity,
            visualId,
            factionStyle,
            face === 'right',
            face,
            mod.kind === 'weapon' ? mod.id : null
        );
    },

    /**
     * Per-faction gun art (8×8 shades, muzzle at the top). Nose mounts get a
     * heavy centre cannon; wing mounts (face left/right) get pylon guns.
     */
    getFactionWeaponTemplate(factionStyle, onWing) {
        const id = (factionStyle && factionStyle.id) || 'terran';
        const guns = {
            terran: {
                // Twin rectangular autocannons on a squared breech block.
                nose: [
                    [0, 0, 15, 0, 0, 15, 0, 0],
                    [0, 0, 11, 0, 0, 11, 0, 0],
                    [0, 0, 11, 0, 0, 11, 0, 0],
                    [0, 6, 12, 6, 6, 12, 6, 0],
                    [0, 9, 13, 9, 9, 13, 9, 0],
                    [4, 10, 14, 12, 12, 14, 10, 4],
                    [4, 10, 10, 10, 10, 10, 10, 4],
                    [2, 3, 3, 3, 3, 3, 3, 2]
                ],
                wing: [
                    [0, 0, 0, 15, 15, 0, 0, 0],
                    [0, 0, 0, 11, 11, 0, 0, 0],
                    [0, 0, 0, 11, 11, 0, 0, 0],
                    [0, 0, 0, 11, 11, 0, 0, 0],
                    [0, 0, 7, 13, 13, 7, 0, 0],
                    [0, 5, 10, 14, 14, 10, 5, 0],
                    [0, 5, 10, 10, 10, 10, 5, 0],
                    [0, 2, 3, 3, 3, 3, 2, 0]
                ]
            },
            kronax: {
                // Serrated claw prongs with a glowing charge between them.
                nose: [
                    [15, 0, 0, 0, 0, 0, 0, 15],
                    [12, 11, 0, 0, 0, 0, 11, 12],
                    [0, 12, 10, 0, 0, 10, 12, 0],
                    [0, 9, 12, 15, 15, 12, 9, 0],
                    [0, 0, 10, 14, 14, 10, 0, 0],
                    [0, 6, 9, 12, 12, 9, 6, 0],
                    [4, 9, 6, 10, 10, 6, 9, 4],
                    [2, 3, 0, 3, 3, 0, 3, 2]
                ],
                wing: [
                    [0, 0, 0, 15, 15, 0, 0, 0],
                    [0, 0, 0, 12, 12, 0, 0, 0],
                    [0, 0, 11, 13, 13, 11, 0, 0],
                    [0, 0, 9, 12, 12, 9, 0, 0],
                    [0, 10, 8, 11, 11, 8, 10, 0],
                    [10, 7, 0, 10, 10, 0, 7, 10],
                    [6, 0, 0, 8, 8, 0, 0, 6],
                    [0, 0, 0, 3, 3, 0, 0, 0]
                ]
            },
            voidborn: {
                // Ring focus lens hovering over a crescent emitter.
                nose: [
                    [0, 0, 9, 12, 12, 9, 0, 0],
                    [0, 9, 13, 0, 0, 13, 9, 0],
                    [0, 12, 0, 15, 15, 0, 12, 0],
                    [0, 9, 13, 0, 0, 13, 9, 0],
                    [0, 0, 9, 12, 12, 9, 0, 0],
                    [6, 0, 0, 11, 11, 0, 0, 6],
                    [9, 10, 8, 12, 12, 8, 10, 9],
                    [0, 4, 6, 6, 6, 6, 4, 0]
                ],
                wing: [
                    [0, 0, 0, 15, 15, 0, 0, 0],
                    [0, 0, 10, 0, 0, 10, 0, 0],
                    [0, 0, 12, 13, 13, 12, 0, 0],
                    [0, 0, 0, 11, 11, 0, 0, 0],
                    [0, 8, 0, 11, 11, 0, 8, 0],
                    [0, 10, 9, 12, 12, 9, 10, 0],
                    [0, 0, 8, 10, 10, 8, 0, 0],
                    [0, 0, 0, 4, 4, 0, 0, 0]
                ]
            },
            pirate: {
                // Stubby scatter barrels bolted onto a welded drum.
                nose: [
                    [14, 0, 0, 15, 15, 0, 0, 14],
                    [10, 0, 0, 11, 11, 0, 0, 10],
                    [10, 0, 8, 11, 11, 8, 0, 10],
                    [11, 7, 10, 12, 12, 10, 7, 11],
                    [6, 12, 13, 9, 9, 13, 12, 6],
                    [6, 12, 9, 14, 14, 9, 12, 6],
                    [4, 9, 12, 9, 9, 12, 9, 4],
                    [0, 3, 4, 3, 3, 4, 3, 0]
                ],
                wing: [
                    [0, 0, 14, 0, 0, 14, 0, 0],
                    [0, 0, 10, 0, 0, 10, 0, 0],
                    [0, 0, 11, 7, 7, 11, 0, 0],
                    [0, 6, 12, 10, 10, 12, 6, 0],
                    [0, 9, 13, 9, 9, 13, 9, 0],
                    [0, 9, 9, 12, 12, 9, 9, 0],
                    [0, 4, 8, 8, 8, 8, 4, 0],
                    [0, 0, 3, 0, 0, 3, 0, 0]
                ]
            },
            machine: {
                // Rail emitter: long conductor spine with circuit nodes.
                nose: [
                    [0, 0, 0, 15, 15, 0, 0, 0],
                    [0, 13, 0, 12, 12, 0, 13, 0],
                    [0, 10, 0, 12, 12, 0, 10, 0],
                    [0, 10, 6, 14, 14, 6, 10, 0],
                    [0, 12, 10, 12, 12, 10, 12, 0],
                    [5, 9, 15, 9, 9, 15, 9, 5],
                    [5, 9, 9, 12, 12, 9, 9, 5],
                    [0, 3, 5, 3, 3, 5, 3, 0]
                ],
                wing: [
                    [0, 0, 0, 15, 15, 0, 0, 0],
                    [0, 0, 0, 12, 12, 0, 0, 0],
                    [0, 0, 6, 12, 12, 6, 0, 0],
                    [0, 0, 15, 12, 12, 15, 0, 0],
                    [0, 0, 6, 12, 12, 6, 0, 0],
                    [0, 7, 10, 14, 14, 10, 7, 0],
                    [0, 7, 9, 9, 9, 9, 7, 0],
                    [0, 0, 3, 5, 5, 3, 0, 0]
                ]
            }
        };
        const set = guns[id] || guns.terran;
        return onWing ? set.wing : set.nose;
    },

    /**
     * Per-weapon barrel (8 wide × 6 tall, muzzle at the top) so each weapon
     * reads differently on the hull. Sits on the faction breech below.
     */
    getWeaponBarrelTemplate(weaponId) {
        const barrels = {
            // One long focused emitter with a lens tip.
            laser: [
                [0, 0, 0, 15, 15, 0, 0, 0],
                [0, 0, 0, 13, 13, 0, 0, 0],
                [0, 0, 0, 11, 11, 0, 0, 0],
                [0, 0, 6, 12, 12, 6, 0, 0],
                [0, 0, 0, 11, 11, 0, 0, 0],
                [0, 0, 7, 12, 12, 7, 0, 0]
            ],
            // Two thin parallel emitters.
            laser_twin: [
                [0, 15, 0, 0, 0, 0, 15, 0],
                [0, 13, 0, 0, 0, 0, 13, 0],
                [0, 11, 0, 0, 0, 0, 11, 0],
                [0, 12, 6, 0, 0, 6, 12, 0],
                [0, 11, 0, 0, 0, 0, 11, 0],
                [0, 12, 8, 7, 7, 8, 12, 0]
            ],
            // Two long rails with a charged gap between them.
            railgun: [
                [0, 0, 12, 0, 0, 12, 0, 0],
                [0, 0, 12, 15, 15, 12, 0, 0],
                [0, 0, 11, 0, 0, 11, 0, 0],
                [0, 0, 12, 14, 14, 12, 0, 0],
                [0, 0, 11, 0, 0, 11, 0, 0],
                [0, 6, 12, 13, 13, 12, 6, 0]
            ],
            // Three barrels fanned outwards.
            spread: [
                [14, 0, 0, 15, 15, 0, 0, 14],
                [0, 11, 0, 12, 12, 0, 11, 0],
                [0, 11, 0, 11, 11, 0, 11, 0],
                [0, 0, 11, 11, 11, 11, 0, 0],
                [0, 0, 9, 12, 12, 9, 0, 0],
                [0, 6, 10, 12, 12, 10, 6, 0]
            ],
            // Rotary cluster of four short barrels.
            rapid: [
                [0, 14, 0, 14, 14, 0, 14, 0],
                [0, 11, 0, 11, 11, 0, 11, 0],
                [0, 11, 6, 11, 11, 6, 11, 0],
                [0, 9, 13, 9, 9, 13, 9, 0],
                [0, 6, 12, 14, 14, 12, 6, 0],
                [0, 6, 9, 12, 12, 9, 6, 0]
            ],
            // Two stubby thick cannons.
            burst: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 14, 14, 0, 0, 14, 14, 0],
                [0, 11, 12, 0, 0, 12, 11, 0],
                [0, 11, 12, 0, 0, 12, 11, 0],
                [0, 9, 12, 8, 8, 12, 9, 0],
                [6, 10, 12, 12, 12, 12, 10, 6]
            ],
            // Glowing orb chamber in a cradle.
            plasma: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 9, 13, 13, 9, 0, 0],
                [0, 9, 14, 15, 15, 14, 9, 0],
                [0, 9, 15, 15, 15, 15, 9, 0],
                [0, 6, 9, 13, 13, 9, 6, 0],
                [6, 10, 6, 11, 11, 6, 10, 6]
            ],
            // Pointed prongs with a beam between them.
            claw_beam: [
                [12, 0, 0, 0, 0, 0, 0, 12],
                [11, 10, 0, 15, 15, 0, 10, 11],
                [0, 11, 0, 13, 13, 0, 11, 0],
                [0, 11, 9, 12, 12, 9, 11, 0],
                [0, 0, 11, 10, 10, 11, 0, 0],
                [0, 6, 10, 12, 12, 10, 6, 0]
            ],
            // Row of spikes.
            spike_burst: [
                [14, 0, 0, 15, 15, 0, 0, 14],
                [11, 0, 12, 12, 12, 12, 0, 11],
                [11, 9, 11, 9, 9, 11, 9, 11],
                [0, 11, 9, 12, 12, 9, 11, 0],
                [0, 9, 12, 10, 10, 12, 9, 0],
                [6, 10, 11, 12, 12, 11, 10, 6]
            ],
            // Coil rings around a short emitter.
            ion: [
                [0, 0, 0, 15, 15, 0, 0, 0],
                [0, 13, 13, 13, 13, 13, 13, 0],
                [0, 0, 0, 11, 11, 0, 0, 0],
                [0, 13, 13, 13, 13, 13, 13, 0],
                [0, 0, 0, 11, 11, 0, 0, 0],
                [0, 6, 13, 13, 13, 13, 6, 0]
            ],
            // Open dish emitter.
            wave: [
                [13, 0, 0, 0, 0, 0, 0, 13],
                [11, 13, 0, 0, 0, 0, 13, 11],
                [0, 11, 12, 15, 15, 12, 11, 0],
                [0, 0, 11, 12, 12, 11, 0, 0],
                [0, 0, 0, 11, 11, 0, 0, 0],
                [0, 6, 10, 12, 12, 10, 6, 0]
            ],
            // Star-shaped burst emitter.
            nova: [
                [0, 0, 0, 14, 14, 0, 0, 0],
                [12, 0, 0, 13, 13, 0, 0, 12],
                [0, 12, 13, 15, 15, 13, 12, 0],
                [0, 0, 13, 15, 15, 13, 0, 0],
                [0, 12, 9, 12, 12, 9, 12, 0],
                [6, 9, 10, 12, 12, 10, 9, 6]
            ],
            // Pod of four launch tubes.
            missile: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 12, 12, 12, 12, 12, 12, 0],
                [0, 12, 3, 12, 12, 3, 12, 0],
                [0, 12, 12, 12, 12, 12, 12, 0],
                [0, 12, 3, 12, 12, 3, 12, 0],
                [6, 10, 12, 12, 12, 12, 10, 6]
            ],
            // Needle lance with a bright tip.
            pierce: [
                [0, 0, 0, 15, 15, 0, 0, 0],
                [0, 0, 0, 15, 15, 0, 0, 0],
                [0, 0, 0, 12, 12, 0, 0, 0],
                [0, 0, 9, 12, 12, 9, 0, 0],
                [0, 0, 9, 11, 11, 9, 0, 0],
                [0, 6, 10, 12, 12, 10, 6, 0]
            ]
        };
        return barrels[String(weaponId || '')] || null;
    },

    /** Weapon barrel stacked on the faction breech (bottom 4 rows): 8×10. */
    getWeaponTemplate(weaponId, factionStyle, onWing) {
        const base = this.getFactionWeaponTemplate(factionStyle, onWing);
        const barrel = this.getWeaponBarrelTemplate(weaponId);
        if (!barrel) return base;
        return barrel.concat(base.slice(4));
    },

    /**
     * Named per-id visual variants — a module id can opt into one of these via
     * its config's `visual` field, overriding the generic role/kind template
     * below, so a new purchasable variant of an existing module type can look
     * distinct even though it shares the same category (weapon/defense/...).
     */
    getNamedModuleTemplate(visualId) {
        const templates = {
            hardpoint_twin: [
                [0, 5, 15, 12, 12, 15, 5, 0],
                [0, 8, 15, 15, 15, 15, 8, 0],
                [4, 10, 12, 8, 8, 12, 10, 4],
                [6, 12, 15, 10, 10, 15, 12, 6],
                [6, 12, 15, 10, 10, 15, 12, 6],
                [4, 10, 12, 8, 8, 12, 10, 4],
                [0, 8, 15, 15, 15, 15, 8, 0],
                [0, 5, 15, 12, 12, 15, 5, 0]
            ],
            hardpoint_heavy: [
                [6, 10, 12, 15, 15, 12, 10, 6],
                [10, 14, 15, 15, 15, 15, 14, 10],
                [12, 15, 15, 10, 10, 15, 15, 12],
                [12, 15, 10, 8, 8, 10, 15, 12],
                [12, 15, 10, 8, 8, 10, 15, 12],
                [12, 15, 15, 10, 10, 15, 15, 12],
                [10, 14, 15, 12, 12, 15, 14, 10],
                [6, 10, 12, 8, 8, 12, 10, 6]
            ],
            plating_capacitor: [
                [3, 6, 10, 15, 15, 10, 6, 3],
                [6, 10, 14, 8, 8, 14, 10, 6],
                [10, 14, 8, 15, 15, 8, 14, 10],
                [15, 8, 15, 12, 12, 15, 8, 15],
                [15, 8, 15, 12, 12, 15, 8, 15],
                [10, 14, 8, 15, 15, 8, 14, 10],
                [6, 10, 14, 8, 8, 14, 10, 6],
                [3, 6, 10, 15, 15, 10, 6, 3]
            ]
        };
        if (templates[visualId]) return templates[visualId];
        const shader = this.getGeneratedSkinShader(visualId);
        if (!shader) return null;
        const grid = [];
        for (let y = 0; y < 8; y++) {
            const row = [];
            for (let x = 0; x < 8; x++) {
                row.push(Math.max(0, Math.min(15, Math.round(shader(x, y)))));
            }
            grid.push(row);
        }
        return grid;
    },

    /**
     * Unlockable cosmetic skins described as shade functions over the 8×8
     * module grid (x, y in 0..7, shade 0–15). `cx`/`cy` are distances from
     * the centre line, so shapes stay mirror-symmetric.
     */
    getGeneratedSkinShader(visualId) {
        const cx = (x) => Math.abs(x - 3.5);
        const cy = (y) => Math.abs(y - 3.5);
        const shaders = {
            // Weapons
            hardpoint_rail: (x, y) => (cx(x) < 1 ? 15 - y * 0.5 : (cx(x) < 2 ? 6 + y : (y > 4 ? 9 : 3))),
            hardpoint_quad: (x, y) => ((x === 1 || x === 6 || x === 2 || x === 5) && y < 5 ? 14 - y : (y >= 5 ? 11 : 4)),
            hardpoint_flak: (x, y) => (Math.max(cx(x), cy(y)) < 1.5 ? 15 : ((x + y) % 2 ? 11 : 6)),
            hardpoint_lance: (x, y) => (cx(x) < 0.6 ? 15 : (cx(x) < 1.6 ? 8 + y : (y > 5 ? 10 : 2))),
            hardpoint_pulse: (x, y) => [15, 6, 12, 5, 12, 6, 15, 8][Math.round(Math.hypot(cx(x), cy(y)))] || 4,
            // Defenses
            plating_hex: (x, y) => ((x + (y % 2) * 2) % 4 === 0 ? 4 : 11),
            plating_armor: (x, y) => (y % 3 === 2 ? 5 : (cx(x) > 3 ? 7 : 12)),
            plating_stripe: (x, y) => (((x + y) >> 1) % 2 ? 14 : 4),
            plating_mesh: (x, y) => (x % 2 === 0 || y % 2 === 0 ? 10 : 3),
            plating_bastion: (x, y) => (Math.max(cx(x), cy(y)) > 3 ? 5 : (Math.max(cx(x), cy(y)) > 2 ? 13 : 9)),
            // Abilities
            core_prism: (x, y) => (cx(x) + cy(y) < 2 ? 15 : (cx(x) + cy(y) < 4 ? 10 : 3)),
            core_ring: (x, y) => { const d = Math.hypot(cx(x), cy(y)); return d < 1.2 ? 4 : (d < 2.8 ? 15 : 5); },
            core_cross: (x, y) => (cx(x) < 1 || cy(y) < 1 ? 15 : 5),
            core_star: (x, y) => (cx(x) < 1 || cy(y) < 1 || Math.abs(cx(x) - cy(y)) < 0.6 ? 14 : 4),
            core_eye: (x, y) => { const d = Math.hypot(cx(x), cy(y) * 1.8); return d < 1 ? 2 : (d < 2.5 ? 15 : (d < 3.8 ? 9 : 3)); },
            // Energy
            core_cell: (x, y) => (cy(y) > 3 ? 6 : (cx(x) < 2.5 ? 12 + (y % 2) * 3 : 4)),
            core_grid: (x, y) => (x % 3 === 0 || y % 3 === 0 ? 6 : 14),
            core_coil: (x, y) => ((y % 2 === 0) ? 13 : (cx(x) > 2.5 ? 8 : 4)),
            core_spark: (x, y) => (Math.abs(x - y) < 1 || Math.abs(7 - x - y) < 1 ? 15 : 5),
            core_twin: (x, y) => (Math.hypot(cx(x) - 1.8, cy(y)) < 1.6 ? 15 : 5)
        };
        return shaders[visualId] || null;
    },

    /**
     * Dense 8×8 shade templates (1–15). Every cell is opaque so remapping
     * into any target size fills the component frame completely.
     */
    getProceduralModuleTemplate(role, kind, visualId) {
        const named = visualId ? this.getNamedModuleTemplate(visualId) : null;
        if (named) return named;
        const visual = role || kind || 'ability';
        if (visual === 'hardpoint' || kind === 'weapon') {
            // Twin-barrel cannon: narrow muzzle glow tapering into a wide
            // housing seated flush against the hull (dark edge at the base).
            return [
                [0, 0, 3, 9, 9, 3, 0, 0],
                [0, 0, 3, 14, 14, 3, 0, 0],
                [0, 3, 9, 14, 14, 9, 3, 0],
                [0, 3, 8, 10, 10, 8, 3, 0],
                [3, 8, 10, 12, 12, 10, 8, 3],
                [3, 9, 12, 15, 15, 12, 9, 3],
                [2, 7, 10, 11, 11, 10, 7, 2],
                [1, 2, 4, 6, 6, 4, 2, 1]
            ];
        }
        if (visual === 'plating' || kind === 'defense') {
            // Riveted bulkhead plate: dark framed border, flat mid-tone
            // panel, four bright rivets pinning it to the hull.
            return [
                [2, 2, 2, 2, 2, 2, 2, 2],
                [2, 9, 9, 9, 9, 9, 9, 2],
                [2, 9, 13, 9, 9, 13, 9, 2],
                [2, 9, 9, 9, 9, 9, 9, 2],
                [2, 9, 9, 9, 9, 9, 9, 2],
                [2, 9, 13, 9, 9, 13, 9, 2],
                [2, 9, 9, 9, 9, 9, 9, 2],
                [2, 2, 2, 2, 2, 2, 2, 2]
            ];
        }
        if (visual === 'core' || kind === 'energy') {
            // Octagonal reactor cell: bright glowing core fading to a dark
            // containment ring at the edges.
            return [
                [0, 3, 8, 8, 8, 8, 3, 0],
                [3, 8, 12, 13, 13, 12, 8, 3],
                [8, 12, 14, 15, 15, 14, 12, 8],
                [8, 13, 15, 15, 15, 15, 13, 8],
                [8, 13, 15, 15, 15, 15, 13, 8],
                [8, 12, 14, 15, 15, 14, 12, 8],
                [3, 8, 12, 13, 13, 12, 8, 3],
                [0, 3, 8, 8, 8, 8, 3, 0]
            ];
        }
        if (visual === 'thruster') {
            // Bell nozzle: widening cone with a bright exhaust glow at
            // the open end.
            return [
                [2, 4, 6, 8, 8, 6, 4, 2],
                [3, 6, 9, 11, 11, 9, 6, 3],
                [4, 8, 11, 13, 13, 11, 8, 4],
                [3, 7, 10, 12, 12, 10, 7, 3],
                [3, 7, 9, 11, 11, 9, 7, 3],
                [2, 6, 9, 14, 14, 9, 6, 2],
                [1, 4, 8, 15, 15, 8, 4, 1],
                [0, 2, 5, 15, 15, 5, 2, 0]
            ];
        }
        // ability / pod default — domed sensor pod tapering to a mount base.
        return [
            [0, 0, 3, 8, 8, 3, 0, 0],
            [0, 3, 9, 12, 12, 9, 3, 0],
            [3, 9, 13, 14, 14, 13, 9, 3],
            [3, 9, 14, 15, 15, 14, 9, 3],
            [2, 8, 12, 13, 13, 12, 8, 2],
            [2, 7, 9, 10, 10, 9, 7, 2],
            [1, 4, 6, 7, 7, 6, 4, 1],
            [0, 1, 2, 3, 3, 2, 1, 0]
        ];
    },

    /**
     * Modules are voxelised like every other hull part: the same ship-wide
     * square cell, the faction silhouette sampled once per voxel (not per
     * screen pixel, which carved smooth curves), and the shade template
     * resampled onto that voxel grid instead of stretched over the frame.
     */
    drawProceduralModule(ctx, x, y, width, height, role, kind, colorOverlay, intensity, visualId, factionStyle, mirror = false, face = 'up', weaponId = null) {
        if (kind === 'weapon') {
            // Every weapon uses the generated gun art; a skin / config visual
            // only patterns its housing (see drawDetailedWeaponModule).
            this.drawDetailedWeaponModule(ctx, x, y, width, height, weaponId, factionStyle,
                colorOverlay, intensity, this.getModuleRoleShadeBias(role, kind), mirror, face, visualId);
            return;
        }
        // Weapons without a chosen skin use their own barrel on the faction
        // breech; the template is the silhouette, so the cell mask is skipped.
        const factionWeapon = (kind === 'weapon' && !visualId)
            ? this.getWeaponTemplate(weaponId, factionStyle, face === 'left' || face === 'right')
            : null;
        const template = factionWeapon || this.getProceduralModuleTemplate(role, kind, visualId);
        const tRows = template.length;
        const tCols = template[0].length;
        const shadeBias = this.getModuleRoleShadeBias(role, kind);
        const { resW: cols, resH: rows, cell } = this.hullPartResolution(width, height);
        const colors = [null];
        const colorIndex = new Map();
        const grid = [];
        // Weapons keep their template's proportions: the art is fitted and
        // centred in the frame instead of stretched to the frame's aspect.
        let fitRows = rows;
        let fitCols = cols;
        if (kind === 'weapon') {
            const aspect = tCols / tRows;
            if (cols / rows > aspect) fitCols = Math.max(1, Math.min(cols, Math.round(rows * aspect)));
            else fitRows = Math.max(1, Math.min(rows, Math.round(cols / aspect)));
        }
        const offR = Math.floor((rows - fitRows) / 2);
        const offC = Math.floor((cols - fitCols) / 2);
        for (let row = 0; row < rows; row++) {
            const line = new Array(cols).fill(0);
            const r = row - offR;
            if (r < 0 || r >= fitRows) {
                grid.push(line);
                continue;
            }
            const sy = Math.min(tRows - 1, Math.floor(((r + 0.5) * tRows) / fitRows));
            for (let col = 0; col < cols; col++) {
                const c = col - offC;
                if (c < 0 || c >= fitCols) continue;
                if (!factionWeapon && !this.isFactionModuleCell(c, r, fitCols, fitRows, factionStyle)) continue;
                // Sample the right half as the mirror of the left: plain
                // floor() lands on different template columns per side
                // whenever cols is not a multiple of the template width.
                const lc = c < fitCols / 2 ? c : fitCols - 1 - c;
                const lsx = Math.min(tCols - 1, Math.floor(((lc + 0.5) * tCols) / fitCols));
                const sx = c < fitCols / 2 ? lsx : tCols - 1 - lsx;
                const idx = template[sy][sx];
                if (!idx) continue;
                let color = this.getFactionModuleShade(idx, factionStyle)
                    || this.getHullMountShade(idx);
                if (!color) continue;
                color = this.applyHullOverlayHex(color, colorOverlay, intensity, shadeBias);
                if (!colorIndex.has(color)) {
                    colorIndex.set(color, colors.length);
                    colors.push(color);
                }
                line[mirror ? cols - 1 - col : col] = colorIndex.get(color);
            }
            grid.push(line);
        }
        // Dark contour around the part so it separates from the hull below.
        if (factionStyle && factionStyle.edge && rows >= 3 && cols >= 3) {
            const outline = this.shiftModuleHex(factionStyle.edge, -0.6);
            colors.push(outline);
            const o = colors.length - 1;
            const filled = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c] && grid[r][c] !== o;
            const edgeCells = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!grid[r][c]) continue;
                    if (!filled(r - 1, c) || !filled(r + 1, c) || !filled(r, c - 1) || !filled(r, c + 1)) {
                        edgeCells.push([r, c]);
                    }
                }
            }
            edgeCells.forEach(([r, c]) => { grid[r][c] = o; });
        }
        ctx.imageSmoothingEnabled = false;
        this.drawPixelGridHull(ctx, grid, colors, x, y, width, height, cell);
    },

    /**
     * Visual size of weapon art relative to its mount frame. Wing mounts are
     * half the nose size and use the same factor, so a wing pair reads as
     * two half-size guns instead of towering over the wing.
     * Keep in sync with the muzzle offsets in js/game/bullets/core.js.
     */
    WEAPON_DRAW_SCALE: { wing: { x: 1.4, y: 2.4 }, body: { x: 1.4, y: 2.4 } },

    /** 15-step module ramp from the ship's faction colours (14–15 = accent glow). */
    getWeaponShadeRamp(factionStyle, weaponId) {
        const toRgb = (h) => {
            const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
            if (!m) return null;
            const n = parseInt(m[1], 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
        const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
        const hull = factionStyle && toRgb(factionStyle.hull);
        const edge = (factionStyle && toRgb(factionStyle.edge)) || (hull && mix(hull, [0, 0, 0], 0.6));
        const ramp = [null];
        const dark = hull ? mix(edge, [0, 0, 0], 0.45) : [36, 36, 36];
        const mid = hull ? mix(hull, [0, 0, 0], 0.28) : [120, 120, 120];
        const light = hull ? mix(hull, [255, 255, 255], 0.3) : [230, 230, 230];
        for (let i = 1; i <= 13; i++) {
            const t = (i - 1) / 12;
            ramp.push(toHex(t < 0.5 ? mix(dark, mid, t * 2) : mix(mid, light, (t - 0.5) * 2)));
        }
        // Glow in the ship's own accent colour, not the weapon's UI tint.
        const glow = (factionStyle && toRgb(factionStyle.accent)) || (hull && mix(hull, [255, 255, 255], 0.55)) || [255, 255, 255];
        ramp.push(toHex(glow));
        ramp.push(toHex(mix(glow, [255, 255, 255], 0.55)));
        return ramp;
    },

    /**
     * Gun art built at the target resolution (muzzle at row 0): mount plate,
     * receiver, then per-weapon barrels with cylinder shading. Shades 1–13
     * are housing, 14–15 glow in the weapon colour.
     */
    generateWeaponGrid(weaponId, cols, rows) {
        const key = String(weaponId || '') + '|' + cols + 'x' + rows;
        if (!this._weaponGridCache) this._weaponGridCache = new Map();
        const hit = this._weaponGridCache.get(key);
        if (hit) return hit;
        const W = cols;
        const H = rows;
        const g = Array.from({ length: H }, () => new Array(W).fill(0));
        const set = (r, c, v) => {
            r = Math.round(r); c = Math.round(c);
            if (r >= 0 && c >= 0 && r < H && c < W) g[r][c] = Math.max(1, Math.min(15, Math.round(v)));
        };
        // Cylinder shading across the width: lit left, dark right edge.
        const cyl = (c0, c1, r0, r1, base) => {
            c0 = Math.round(c0); c1 = Math.round(c1); r0 = Math.round(r0); r1 = Math.round(r1);
            const w = Math.max(1, c1 - c0);
            for (let r = r0; r < r1; r++) {
                for (let c = c0; c < c1; c++) {
                    const t = (c - c0 + 0.5) / w;
                    const d = w < 3 ? (t < 0.5 ? 2 : -1) : (t < 0.2 ? 1 : t < 0.45 ? 3 : t < 0.8 ? 0 : -3);
                    set(r, c, Math.min(13, base + d));
                }
            }
        };
        const fill = (c0, c1, r0, r1, v) => {
            for (let r = Math.round(r0); r < Math.round(r1); r++) {
                for (let c = Math.round(c0); c < Math.round(c1); c++) set(r, c, v);
            }
        };
        // Centred span of a width fraction, kept symmetric on the grid.
        const span = (f) => {
            let w = Math.max(1, Math.round(W * f));
            if ((W - w) % 2) w += (w < W ? 1 : -1);
            const c0 = (W - w) / 2;
            return [c0, c0 + w];
        };
        // Mirrored pair: centre offset `off` and width `f` (fractions of W).
        const pair = (off, f, fn) => {
            const w = Math.max(1, Math.round(W * f));
            const c0 = Math.max(0, Math.round(W / 2 - W * off - w / 2));
            fn(c0, c0 + w);
            fn(W - c0 - w, W - c0);
        };
        const baseTop = Math.round(H * 0.86);
        const recvTop = Math.round(H * 0.62);
        const barrelTop = (f) => Math.round(H * f);

        // Mount plate with bolts.
        let [b0, b1] = span(0.94);
        cyl(b0, b1, baseTop, H, 5);
        set(H - 2, b0 + 1, 2); set(H - 2, b1 - 2, 2);
        // Receiver block with a panel seam and a status light.
        [b0, b1] = span(0.66);
        cyl(b0, b1, recvTop, baseTop, 8);
        fill(b0, b1, recvTop + Math.round((baseTop - recvTop) / 2), recvTop + Math.round((baseTop - recvTop) / 2) + 1, 4);
        set(recvTop + 1, b0 + 1, 14);

        const id = String(weaponId || 'laser');
        const tip = (c0, c1, r, v) => fill(c0, c1, r, r + Math.max(1, Math.round(H * 0.04)), v || 15);
        switch (id) {
            case 'laser_twin':
                pair(0.17, 0.18, (c0, c1) => { cyl(c0, c1, barrelTop(0.04), recvTop, 9); tip(c0, c1, barrelTop(0.04), 14); });
                break;
            case 'railgun': {
                pair(0.2, 0.14, (c0, c1) => cyl(c0, c1, 0, recvTop, 9));
                const [g0, g1] = span(0.14);
                for (let r = barrelTop(0.06); r < recvTop; r += 2) fill(g0, g1, r, r + 1, 14);
                const [x0, x1] = span(0.6);
                for (let r = barrelTop(0.2); r < recvTop; r += Math.max(3, Math.round(H * 0.12))) cyl(x0, x1, r, r + 1, 6);
                break;
            }
            case 'spread': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.08), recvTop, 9);
                tip(c0, c1, barrelTop(0.08));
                const top = barrelTop(0.2);
                const w = Math.max(1, Math.round(W * 0.14));
                for (let r = top; r < recvTop; r++) {
                    const k = (recvTop - r) / Math.max(1, recvTop - top);
                    const off = Math.round(W * (0.14 + k * 0.28));
                    const l0 = Math.round(W / 2 - off - w / 2);
                    cyl(l0, l0 + w, r, r + 1, 8);
                    cyl(W - l0 - w, W - l0, r, r + 1, 8);
                    if (r === top) { fill(l0, l0 + w, r, r + 1, 15); fill(W - l0 - w, W - l0, r, r + 1, 15); }
                }
                break;
            }
            case 'rapid': {
                [0.07, 0.21].forEach((off) => pair(off, 0.1, (c0, c1) => { cyl(c0, c1, barrelTop(0.05), recvTop, 9); tip(c0, c1, barrelTop(0.05), 14); }));
                const [r0, r1] = span(0.62);
                [0.22, 0.42].forEach((f) => cyl(r0, r1, barrelTop(f), barrelTop(f) + Math.max(1, Math.round(H * 0.05)), 6));
                break;
            }
            case 'burst':
                pair(0.17, 0.26, (c0, c1) => {
                    cyl(c0, c1, barrelTop(0.2), recvTop, 8);
                    cyl(c0 - 1, c1 + 1, barrelTop(0.14), barrelTop(0.2), 10);
                    tip(c0, c1, barrelTop(0.14), 14);
                });
                break;
            case 'plasma': {
                const [c0, c1] = span(0.32);
                cyl(c0, c1, barrelTop(0.22), recvTop, 8);
                for (let r = barrelTop(0.3); r < recvTop - 1; r += 3) fill(c0 + 1, c1 - 1, r, r + 1, 14);
                const [m0, m1] = span(0.46);
                cyl(m0, m1, barrelTop(0.16), barrelTop(0.22), 10);
                fill(c0 + 1, c1 - 1, barrelTop(0.16), barrelTop(0.2), 15);
                // Glowing orb chamber in the receiver.
                const cy = recvTop + (baseTop - recvTop) * 0.35;
                const rad = Math.max(1.2, W * 0.16);
                for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
                    const d = Math.hypot(c + 0.5 - W / 2, r + 0.5 - cy);
                    if (d < rad) set(r, c, d < rad * 0.5 ? 15 : 14);
                }
                break;
            }
            case 'claw_beam': {
                const top = barrelTop(0.06);
                const w = Math.max(1, Math.round(W * 0.14));
                for (let r = top; r < recvTop; r++) {
                    const k = (r - top) / Math.max(1, recvTop - top);
                    const off = Math.round(W * (0.3 - Math.sin(k * Math.PI) * 0.1 - (1 - k) * 0.12));
                    const l0 = Math.round(W / 2 - off - w / 2);
                    cyl(l0, l0 + w, r, r + 1, 9);
                    cyl(W - l0 - w, W - l0, r, r + 1, 9);
                }
                const [g0, g1] = span(0.08);
                fill(g0, g1, barrelTop(0.12), recvTop, 14);
                fill(g0, g1, barrelTop(0.12), barrelTop(0.16), 15);
                break;
            }
            case 'spike_burst':
                [[0, 0.16, 0.02], [0.18, 0.12, 0.18], [0.34, 0.1, 0.34]].forEach(([off, f, t]) => {
                    const fn = (c0, c1) => { cyl(c0, c1, barrelTop(t), recvTop, 9); tip(c0, c1, barrelTop(t), 15); };
                    if (off === 0) { const [c0, c1] = span(f); fn(c0, c1); } else pair(off, f, fn);
                });
                break;
            case 'ion': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.04), recvTop, 9);
                tip(c0, c1, barrelTop(0.04));
                const [r0, r1] = span(0.5);
                for (let r = barrelTop(0.14); r < recvTop - 1; r += Math.max(3, Math.round(H * 0.09))) fill(r0, r1, r, r + 1, 14);
                break;
            }
            case 'wave': {
                const [c0, c1] = span(0.2);
                cyl(c0, c1, barrelTop(0.2), recvTop, 9);
                const top = barrelTop(0.02);
                const flare = barrelTop(0.22);
                for (let r = top; r < flare; r++) {
                    const k = 1 - (r - top) / Math.max(1, flare - top);
                    const [d0, d1] = span(0.2 + k * 0.72);
                    cyl(d0, d1, r, r + 1, 8);
                    if (d1 - d0 > 4) fill(d0 + 2, d1 - 2, r, r + 1, k > 0.6 ? 15 : 14);
                }
                break;
            }
            case 'nova': {
                const [c0, c1] = span(0.22);
                cyl(c0, c1, barrelTop(0.18), recvTop, 9);
                const cy = barrelTop(0.1);
                const arm = Math.max(2, Math.round(W * 0.3));
                const [s0, s1] = span(0.1);
                fill(s0, s1, cy - arm * 0.7, cy + arm * 0.7, 15);
                fill(W / 2 - arm, W / 2 + arm, cy - 0.5, cy + 0.5, 14);
                for (let i = -arm * 0.6; i <= arm * 0.6; i++) { set(cy + i, W / 2 + i, 14); set(cy + i, W / 2 - 1 - i, 14); }
                break;
            }
            case 'missile': {
                const [p0, p1] = span(0.84);
                cyl(p0, p1, barrelTop(0.12), recvTop, 7);
                const tubes = W >= 10 ? 3 : 2;
                const tw = (p1 - p0) / tubes;
                for (let i = 0; i < tubes; i++) {
                    const t0 = Math.round(p0 + i * tw + 1);
                    const t1 = Math.max(t0 + 1, Math.round(p0 + (i + 1) * tw - 1));
                    fill(t0, t1, barrelTop(0.12), barrelTop(0.12) + 1, 2);
                    fill(t0, t1, barrelTop(0.06), barrelTop(0.12), 14);
                    set(barrelTop(0.04), (t0 + t1 - 1) / 2, 15);
                    fill(t0, t1, barrelTop(0.3), barrelTop(0.3) + 1, 4);
                }
                break;
            }
            case 'pierce': {
                const [c0, c1] = span(0.12);
                cyl(c0, c1, 0, recvTop, 10);
                fill(c0, c1, 0, barrelTop(0.06), 15);
                const [k0, k1] = span(0.44);
                cyl(k0, k1, barrelTop(0.4), barrelTop(0.46), 7);
                cyl(span(0.3)[0], span(0.3)[1], barrelTop(0.2), barrelTop(0.24), 7);
                break;
            }
            default: {
                // laser: one long emitter with cooling fins and a lens tip.
                const [c0, c1] = span(0.24);
                cyl(c0, c1, barrelTop(0.04), recvTop, 9);
                tip(c0, c1, barrelTop(0.04));
                const [f0, f1] = span(0.44);
                for (let r = barrelTop(0.3); r < recvTop - 1; r += Math.max(3, Math.round(H * 0.08))) cyl(f0, f1, r, r + 1, 6);
            }
        }
        this._weaponGridCache.set(key, g);
        return g;
    },

    drawDetailedWeaponModule(ctx, x, y, width, height, weaponId, factionStyle, colorOverlay, intensity, shadeBias, mirror, face, visualId = null) {
        // Larger than the mount frame, seated on its base so the receiver
        // stays on the hull and the barrel reaches forward.
        const k = this.WEAPON_DRAW_SCALE[face === 'left' || face === 'right' ? 'wing' : 'body'];
        const w2 = width * k.x;
        const h2 = height * k.y;
        const x2 = x - (w2 - width) / 2;
        const y2 = y + height - h2;
        // Same ship-wide voxel as the hull (follows the VOXEL SIZE setting).
        const cell = this.hullPartResolution(w2, h2).cell;
        let cols = Math.max(4, Math.round(w2 / cell));
        // Keep the gun horizontally centred on its slot: the grid origin snaps
        // to the ship's voxel lattice, so pick the column parity that puts the
        // grid's centre line on the slot's centre line.
        const anchor = this._shipVoxelAnchor;
        if (anchor && anchor.x != null) {
            const t = (x + width / 2 - anchor.x) / cell;
            const frac = t - Math.floor(t);
            const wantOdd = frac > 0.25 && frac < 0.75;
            if ((cols % 2 === 1) !== wantOdd) cols += 1;
        }
        const rows = Math.max(8, Math.round(h2 / cell));
        const template = this.generateWeaponGrid(weaponId, cols, rows);
        const ramp = this.getWeaponShadeRamp(factionStyle, weaponId);
        const skin = visualId ? this.getNamedModuleTemplate(visualId) : null;
        const colors = [null];
        const colorIndex = new Map();
        const grid = [];
        for (let row = 0; row < rows; row++) {
            const line = new Array(cols).fill(0);
            for (let col = 0; col < cols; col++) {
                let idx = template[row][col];
                if (!idx) continue;
                if (skin && idx < 14) {
                    const pv = skin[Math.min(7, Math.floor((row * 8) / rows))][Math.min(7, Math.floor((col * 8) / cols))] || 0;
                    idx = Math.max(1, Math.min(13, Math.round(idx * 0.6 + pv * 0.4)));
                }
                let color = ramp[idx];
                if (!color) continue;
                // Whole gun takes the ship's hull tint, like every other part.
                color = this.applyHullOverlayHex(color, colorOverlay, intensity, shadeBias);
                if (!colorIndex.has(color)) {
                    colorIndex.set(color, colors.length);
                    colors.push(color);
                }
                line[mirror ? cols - 1 - col : col] = colorIndex.get(color);
            }
            grid.push(line);
        }
        // Dark contour so the gun reads against the hull.
        const outlineHex = (factionStyle && factionStyle.edge) ? this.shiftModuleHex(factionStyle.edge, -0.7) : '#151515';
        colors.push(outlineHex);
        const o = colors.length - 1;
        const filled = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c] && grid[r][c] !== o;
        const edgeCells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c]) continue;
                if (filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)) edgeCells.push([r, c]);
            }
        }
        edgeCells.forEach(([r, c]) => { grid[r][c] = o; });
        ctx.imageSmoothingEnabled = false;
        this.drawPixelGridHull(ctx, grid, colors, x2, y2, w2, h2, cell);
    },

    drawMappedImage(ctx, image, bounds, x, y, width, height) {
        const targetW = Math.max(1, Math.round(width));
        const targetH = Math.max(1, Math.round(height));
        for (let row = 0; row < targetH; row++) {
            const sy = bounds.y + Math.min(
                bounds.h - 1,
                Math.floor(row * bounds.h / targetH)
            );
            for (let col = 0; col < targetW; col++) {
                const sx = bounds.x + Math.min(
                    bounds.w - 1,
                    Math.floor(col * bounds.w / targetW)
                );
                ctx.drawImage(image, sx, sy, 1, 1, x + col, y + row, 1, 1);
            }
        }
    },

    getOpaqueSpriteBounds(image) {
        if (!image || !image.width || !image.height) return null;
        const cached = this._spriteBounds.get(image);
        if (cached) return cached;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (data[(y * canvas.width + x) * 4 + 3] < 16) continue;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
            const bounds = maxX < 0
                ? null
                : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
            this._spriteBounds.set(image, bounds);
            return bounds;
        } catch (e) {
            return null;
        }
    },

    // Check if ship is an enemy ship
    isEnemyShip(shipModel) {
        if (!shipModel) return false;
        if (shipModel.forceEnemyOrientation) return true;

        // Check by sprite name patterns
        const spriteName = this.getSpriteNameForShip(shipModel);
        if (spriteName) {
            return spriteName.includes('enemy-') || spriteName.includes('enemy_');
        }

        // Check by ship type/name patterns
        const shipName = shipModel.name ? shipModel.name.toLowerCase() : '';
        return shipName.includes('enemy') || shipName.includes('fighter') ||
               shipName.includes('battleship') || shipName.includes('cruiser') ||
               shipName.includes('interceptor') || shipName.includes('scout') ||
               shipName.includes('destroyer') || shipName.includes('carrier') ||
               shipName.includes('frigate') || shipName.includes('corvette') ||
               shipName.includes('gunship') || shipName.includes('dreadnought') ||
               shipName.includes('bomber') || shipName.includes('stealth');
    },
});
