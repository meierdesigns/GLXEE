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
            face
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
    drawProceduralModule(ctx, x, y, width, height, role, kind, colorOverlay, intensity, visualId, factionStyle, mirror = false, face = 'up') {
        // Weapons without a chosen skin use their faction's gun art; the
        // template is the silhouette, so the generic cell mask is skipped.
        const factionWeapon = (kind === 'weapon' && !visualId)
            ? this.getFactionWeaponTemplate(factionStyle, face === 'left' || face === 'right')
            : null;
        const template = factionWeapon || this.getProceduralModuleTemplate(role, kind, visualId);
        const tRows = template.length;
        const tCols = template[0].length;
        const shadeBias = this.getModuleRoleShadeBias(role, kind);
        const { resW: cols, resH: rows, cell } = this.hullPartResolution(width, height);
        const colors = [null];
        const colorIndex = new Map();
        const grid = [];
        for (let row = 0; row < rows; row++) {
            const line = new Array(cols).fill(0);
            const sy = Math.min(tRows - 1, Math.floor(((row + 0.5) * tRows) / rows));
            for (let col = 0; col < cols; col++) {
                if (!factionWeapon && !this.isFactionModuleCell(col, row, cols, rows, factionStyle)) continue;
                // Sample the right half as the mirror of the left: plain
                // floor() lands on different template columns per side
                // whenever cols is not a multiple of the template width.
                const lc = col < cols / 2 ? col : cols - 1 - col;
                const lsx = Math.min(tCols - 1, Math.floor(((lc + 0.5) * tCols) / cols));
                const sx = col < cols / 2 ? lsx : tCols - 1 - lsx;
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
