"use strict";

import { extendClass } from '../../../core/extend-class-module.js';

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

});
