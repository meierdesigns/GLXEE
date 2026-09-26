"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    buildCenterGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const variant = shapeVariant || 0;
        // A continuous tapered fuselage reads as one ship body instead of
        // several stacked rectangular plates.
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 0.5 : r / (rows - 1);
            const taper = 0.88 + Math.sin(t * Math.PI) * 0.12;
            const variantMul = variant === 1 ? 0.9 : (variant === 2 ? 0.78 : 1);
            const prof = this.factionRowProfile(silhouette, t, 4);
            const width = this.evenSpan(cols, Math.max(1, Math.round(cols * taper * variantMul * prof.widthMul)));
            const c0 = Math.max(0, Math.min(cols - width,
                Math.round((cols - width) / 2 + prof.offsetMul * cols)));
            this.gridFillRect(g, c0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        this.applyFactionPlating(g, silhouette, 4);
        if (silhouette === 'rings') {
            // Twin hollow ring apertures — the voidborn's hallmark void gap.
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.22));
            this.gridFillRect(g, cols / 2 - holeR / 2, rows * 0.38 - holeR / 2, holeR, holeR, 3);
            const holeR2 = Math.max(1, Math.round(holeR * 0.6));
            this.gridFillRect(g, cols * 0.72 - holeR2 / 2, rows * 0.68 - holeR2 / 2, holeR2, holeR2, 0);
        } else if (silhouette === 'spikes') {
            // Diagonal chevron brand — an angled raider V etched into the hull.
            const armW = Math.max(1, Math.round(cols * 0.12));
            const half = Math.max(1, Math.round(rows * 0.5));
            for (let r = 0; r < half; r++) {
                const c = Math.round(cols * 0.5 - (r / half) * cols * 0.3);
                this.gridFillRect(g, c, r, armW, 1, 3);
                this.gridFillRect(g, cols - c - armW, r, armW, 1, 3);
            }
        } else if (silhouette === 'scrap') {
            // Off-center welded patches — irregular, not centered or mirrored.
            this.gridFillRect(g, cols * 0.08, rows * 0.5, cols * 0.34, Math.max(1, rows * 0.3), 3);
            this.gridFillRect(g, cols * 0.62, rows * 0.12, cols * 0.28, Math.max(1, rows * 0.18), 3);
        } else if (silhouette === 'circuit') {
            // Chip node grid — a regular array of small square contacts.
            const nodeW = Math.max(1, Math.round(cols * 0.1));
            const nodeH = Math.max(1, Math.round(rows * 0.12));
            for (let cx = 0; cx < 3; cx++) {
                for (let cy = 0; cy < 2; cy++) {
                    const px = cols * (0.22 + cx * 0.28);
                    const py = rows * (0.28 + cy * 0.34);
                    this.gridFillRect(g, px, py, nodeW, nodeH, 3);
                }
            }
        }
        if (variant === 1) {
            this.gridFillRect(g, cols * 0.22, rows * 0.24, cols * 0.56, Math.max(1, rows * 0.24), 3);
            this.gridFillRect(g, 1, rows * 0.62, Math.max(1, cols * 0.1), Math.max(1, rows * 0.15), 3);
            this.gridFillRect(g, cols - 1 - Math.max(1, cols * 0.1), rows * 0.62, Math.max(1, cols * 0.1), Math.max(1, rows * 0.15), 3);
        } else if (silhouette === 'modular') {
            this.gridFillRect(g, cols * 0.3, rows * 0.28, cols * 0.4, Math.max(1, rows * 0.22), 3);
        }
        return g;
    },

    renderModularWingPanels(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity) {
        const panels = shipModel.layout && shipModel.layout.wingPanels;
        if (!panels || !panels.length) return;
        const mid = this.applyHullOverlayHex('#666c5e', colorOverlay, overlayIntensity, 0);
        const core = shipModel.layout.core;
        const coreLeft = x + core.x * scale;
        const coreRight = coreLeft + core.width * scale;
        const coreCenterY = y + (core.y + core.height * 0.5) * scale;
        panels.forEach((panel) => {
            const px = x + panel.x * scale;
            const py = y + panel.y * scale;
            const pw = Math.max(1, panel.width * scale);
            const ph = Math.max(1, panel.height * scale);
            const left = panel.side === 'left';
            const tipX = left ? px : px + pw;
            const rootX = left ? px + pw : px;
            const bridgeX = left ? coreLeft : coreRight;
            const bridgeY = py + ph * 0.5;
            const bridgeHalf = Math.max(2, Math.min(ph, core.height * scale) * 0.16);
            ctx.fillStyle = mid;
            ctx.beginPath();
            ctx.moveTo(bridgeX, coreCenterY - bridgeHalf);
            ctx.lineTo(rootX, bridgeY - Math.max(2, ph * 0.18));
            ctx.lineTo(rootX, bridgeY + Math.max(2, ph * 0.18));
            ctx.lineTo(bridgeX, coreCenterY + bridgeHalf);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = mid;
            ctx.beginPath();
            ctx.moveTo(rootX, py + ph * 0.16);
            ctx.lineTo(tipX, py + ph * 0.42);
            ctx.lineTo(tipX, py + ph * 0.58);
            ctx.lineTo(rootX, py + ph * 0.84);
            ctx.closePath();
            ctx.fill();
        });
    },

    renderModularThrusterGlow(ctx, shipModel, x, y, scale) {
        const modules = (shipModel.layout && shipModel.layout.modules) || [];
        const thrusters = modules.filter((m) => m.role === 'thruster' ||
            (m.kind === 'ability' && typeof shipLoadoutManager !== 'undefined'
                && shipLoadoutManager.isDriveId && shipLoadoutManager.isDriveId(m.id)));
        if (!thrusters.length) return;
        const base = (typeof getComputedStyle !== 'undefined')
            ? (getComputedStyle(document.documentElement).getPropertyValue('--gray-100').trim() || '#f0f0f0')
            : '#f0f0f0';
        thrusters.forEach((mod) => {
            const mx = x + (mod.x + mod.width / 2) * scale;
            const my = y + (mod.y + mod.height) * scale;
            const r = Math.max(2, mod.width * scale * 0.35);
            for (let i = 2; i >= 0; i--) {
                ctx.globalAlpha = 0.18 + i * 0.12;
                ctx.fillStyle = base;
                ctx.fillRect(mx - r - i, my - i, (r + i) * 2, r + i * 2);
            }
            ctx.globalAlpha = 1;
        });
    },

    renderCoreHull(ctx, shipModel, x, y, width, height, colorOverlay, overlayIntensity, fitMode = 'cover') {
        const spriteName = this.getSpriteNameForShip(shipModel);
        const hasSprite = typeof spriteLoader !== 'undefined' && spriteName && spriteLoader.getSprite(spriteName);
        if (hasSprite) {
            // Cover-fill core rect so modules dock flush to visible hull edges.
            const sprite = spriteLoader.getSprite(spriteName);
            const spriteAspect = sprite.width / Math.max(1, sprite.height);
            const targetAspect = width / Math.max(1, height);
            let rw, rh, ox, oy;
            if (fitMode === 'contain') {
                if (spriteAspect > targetAspect) {
                    rw = width;
                    rh = width / spriteAspect;
                    ox = 0;
                    oy = (height - rh) / 2;
                } else {
                    rh = height;
                    rw = height * spriteAspect;
                    ox = (width - rw) / 2;
                    oy = 0;
                }
            } else if (spriteAspect > targetAspect) {
                rh = height;
                rw = height * spriteAspect;
                ox = (width - rw) / 2;
                oy = 0;
            } else {
                rw = width;
                rh = width / spriteAspect;
                ox = 0;
                oy = (height - rh) / 2;
            }
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.clip();
            spriteLoader.renderSprite(ctx, spriteName, x + ox, y + oy, rw, rh, colorOverlay, overlayIntensity);
            ctx.restore();
            return;
        }

        // Pixel core: scale entire sprite into core rect
        this.drawPixelGridHull(ctx, shipModel.sprite, shipModel.colors, x, y, width, height);
    },

    /** Current ship rendering style — 'FLAT' (default) or 'VOXEL', set via Settings. */
    getShipRenderStyle() {
        return (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.shipRenderStyle) || 'FLAT';
    },

    /** Shift each RGB channel of a #rrggbb hex color by `amount`, clamped to 0-255. */
    shadeHex(hex, amount) {
        if (!hex || hex.charAt(0) !== '#' || hex.length < 7) return hex;
        const n = parseInt(hex.slice(1, 7), 16);
        const clamp = (v) => Math.max(0, Math.min(255, v));
        const r = clamp(((n >> 16) & 255) + amount);
        const g = clamp(((n >> 8) & 255) + amount);
        const b = clamp((n & 255) + amount);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /** Fill one clean, axis-aligned 2D voxel cell. */
    fillVoxelCell(ctx, x, y, w, h, baseColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, w, h);
    },

    /**
     * Snap a screen coordinate onto the ship-wide voxel lattice (anchored at
     * the ship origin while a hull renders); plain rounding otherwise.
     */
    snapToVoxelLattice(v, cell, axis) {
        const anchor = this._shipVoxelAnchor;
        if (!anchor || !(cell >= 1)) return Math.round(v);
        const a = anchor[axis];
        return a + Math.round((v - a) / cell) * cell;
    },

    /** Scale an indexed pixel grid (sprite[row][col] -> colors[index]) into any target rect, regenerating cell sizes each call. */
    drawPixelGridHull(ctx, sprite, colors, x, y, width, height, cellPx) {
        if (!sprite || !sprite.length) {
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, width, height);
            return;
        }
        const cols = sprite[0].length;
        const rows = sprite.length;
        // Rasterize every generated hull part into equal square 2D voxels.
        // This is also used after rotation, so no part falls back to
        // stretched rectangular pixels.
        // Procedural hull parts pass the ship-wide voxel size; other sprites
        // fit their grid into the rect.
        const cell = cellPx || Math.max(1, Math.min(width / cols, height / rows));
        const gridWidth = cols * cell;
        const gridHeight = rows * cell;
        // Snap the part's origin once, then lay cells out relative to it.
        // Rounding each cell against its absolute screen position instead made
        // the voxel raster depend on where the ship sat, so panning the view
        // reshuffled every cell boundary by a pixel.
        const originX = cellPx
            ? this.snapToVoxelLattice(x + (width - gridWidth) * 0.5, cell, 'x')
            : Math.round(x + (width - gridWidth) * 0.5);
        const originY = cellPx
            ? this.snapToVoxelLattice(y + (height - gridHeight) * 0.5, cell, 'y')
            : Math.round(y + (height - gridHeight) * 0.5);
        const palette = colors || {};
        const resolve = (color) => {
            if (!color || color === 'transparent') return color;
            if (typeof color === 'string' && color.indexOf('var(') === 0) {
                const match = color.match(/var\(\s*(--[^),\s]+)/);
                if (match) {
                    const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                    if (value) return value;
                }
                return '#888888';
            }
            return color;
        };
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const pixel = sprite[row][col];
                if (!pixel) continue;
                const color = resolve(palette[pixel] || '#888888');
                const left = originX + Math.floor(col * cell);
                const top = originY + Math.floor(row * cell);
                const right = originX + Math.ceil((col + 1) * cell);
                const bottom = originY + Math.ceil((row + 1) * cell);
                this.fillVoxelCell(ctx, left, top, right - left, bottom - top, color);
            }
        }
    },

    /** Player hull modelClass ids that should be skinned via the faction silhouette engine. */
    isPlayerHullModel(shipModel) {
        if (!shipModel || shipModel.forceEnemyOrientation) return false;
        const playerClasses = ['starfighter', 'interceptor', 'heavy_fighter', 'assault'];
        return playerClasses.indexOf(shipModel.modelClass) !== -1;
    },

    /** Resolve the faction color/silhouette style for a player hull, or null when not applicable. */
    resolvePlayerFactionStyle(shipModel) {
        if (!this.isPlayerHullModel(shipModel)) return null;
        if (typeof factionShipStyles === 'undefined' || !factionShipStyles.getFactionStyle) return null;
        let faction = shipModel.faction;
        if (!faction && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            faction = profileManager.getActiveProfile().faction;
        }
        if (!faction && typeof factionManager !== 'undefined' && factionManager.getAllegiance) {
            faction = factionManager.getAllegiance();
        }
        if (!faction) faction = 'terran';
        return factionShipStyles.getFactionStyle(faction);
    },

    resolveModuleFactionStyle(shipModel) {
        if (typeof factionShipStyles === 'undefined' || !factionShipStyles.getFactionStyle) return null;
        let faction = shipModel && shipModel.faction;
        if (!faction && typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            faction = profile && profile.faction;
        }
        if (!faction && typeof factionManager !== 'undefined' && factionManager.getAllegiance) {
            faction = factionManager.getAllegiance();
        }
        return factionShipStyles.getFactionStyle(faction || 'terran');
    },
});
