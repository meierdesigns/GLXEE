"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /**
     * Per-ship seed driving which shape variant each hull part uses. Defaults
     * to a value derived from the ship's own id (stable, but differs between
     * ships), overridable per-ship via profileManager.setHullShapeSeed()
     * (e.g. a "reroll" button in the ship editor) so the player can pick a
     * different combination of part shapes for a given hull.
     */
    resolveHullShapeSeed(shipModel) {
        const shipId = (shipModel && (shipModel.id || shipModel.baseId || shipModel.modelClass)) || 'ship';
        if (typeof profileManager !== 'undefined' && profileManager.getHullShapeSeed) {
            const override = profileManager.getHullShapeSeed(shipId);
            if (override != null) return String(override);
        }
        return String(shipId);
    },

    /** Deterministic 0..count-1 variant index for one hull part, from the ship's shape seed. */
    hullShapeVariantIndex(shapeSeed, segId, count) {
        if (typeof factionShipStyles === 'undefined' || !factionShipStyles.hash) return 0;
        // Seeded picks stay inside the original style pool so adding new
        // (unlockable) styles never changes how existing ships look.
        const legacy = { front: 3, back: 3, center: 2 }[segId] || 8;
        const pool = Math.max(1, Math.min(count, legacy));
        return factionShipStyles.hash(String(shapeSeed) + '|' + segId) % pool;
    },

    /**
     * Metal grayscale for hull-mounted parts (1–15).
     * Floor lifted so mounts stay visible on dark theme playfields.
     */
    getHullMountShade(index) {
        const shades = [
            null,
            '#2c2c2c', '#383838', '#454545', '#545454', '#646464',
            '#757575', '#888888', '#9a9a9a', '#adadad', '#bfbfbf',
            '#d0d0d0', '#dedede', '#e8e8e8', '#f0f0f0', '#f8f8f8'
        ];
        return shades[index] || null;
    },

    getFactionModuleShade(index, style) {
        if (!style) return null;
        // Modules sit on top of the hull, so they use a darker body and
        // brighter trim of the faction colours: still the player's faction,
        // but readable as a separate part instead of blending into the hull.
        if (index <= 3) return style.edge ? this.shiftModuleHex(style.edge, -0.45) : null;
        if (index >= 13) return style.accent ? this.shiftModuleHex(style.accent, 0.35) : null;
        if (!style.hull) return null;
        return this.shiftModuleHex(style.hull, index >= 9 ? -0.12 : -0.32);
    },

    /** Darken (amount < 0) or lighten (amount > 0) a #rrggbb colour. */
    shiftModuleHex(hex, amount) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        const ch = (v) => {
            const next = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
            return Math.max(0, Math.min(255, Math.round(next)));
        };
        const r = ch((n >> 16) & 255);
        const g = ch((n >> 8) & 255);
        const b = ch(n & 255);
        return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    },

    isFactionModuleCell(col, row, width, height, style) {
        if (!style || width < 5 || height < 5) return true;
        const u = ((col + 0.5) / width) * 2 - 1;
        const v = ((row + 0.5) / height) * 2 - 1;
        const silhouette = style.silhouette || 'modular';
        if (silhouette === 'rings') {
            // True circular aperture (distance from center) instead of a
            // square notch — reads as a round void, not a blocky cutout.
            const r = Math.sqrt(u * u + v * v);
            return r > 0.32;
        }
        if (silhouette === 'spikes') {
            // Sharper, more aggressive blade taper — narrow spine at the tip
            // that flares hard toward the base instead of a gentle wedge.
            const taper = 0.3 + Math.pow(Math.abs(v), 1.7) * 0.75;
            return Math.abs(u) < taper;
        }
        if (silhouette === 'scrap') {
            // Single diagonal bite out of one corner — asymmetric welded-on
            // salvage notch rather than two mirrored rectangular slots.
            return !((u - v) > 0.75 && u > 0.15);
        }
        if (silhouette === 'circuit') {
            // Chamfered corners on all four sides — a beveled circuit-board
            // notch instead of one hard right-angle cut.
            const au = Math.abs(u);
            const av = Math.abs(v);
            return (au + av) < 1.55 && !(au > 0.74 && av > 0.74);
        }
        if (silhouette === 'modular') {
            // Softly chamfered panel corners instead of a sharp square cut.
            const au = Math.abs(u);
            const av = Math.abs(v);
            return (au + av) < 1.55 && !(au > 0.68 && av > 0.68);
        }
        return true;
    },

    /** Per-role brightness bias so weapons / armor / cores / thrusters read apart. */
    getModuleRoleShadeBias(role, kind) {
        const r = role || kind || '';
        if (r === 'hardpoint' || kind === 'weapon') return 28;
        if (r === 'plating') return -6;
        if (r === 'core' || kind === 'energy' || kind === 'defense') return 16;
        if (r === 'thruster') return 32;
        if (r === 'pod' || kind === 'ability') return 12;
        return 4;
    },

    applyHullOverlayHex(hex, colorOverlay, overlayIntensity, shadeBias = 0) {
        if (!hex || hex.charAt(0) !== '#') return hex;
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        // Lift floor so mounts stay readable on dark playfields
        const lift = 28;
        const boost = (v) => Math.max(0, Math.min(255, Math.round(lift + v * ((255 - lift) / 255))));
        r = boost(r);
        g = boost(g);
        b = boost(b);
        if (shadeBias) {
            r = Math.max(0, Math.min(255, r + shadeBias));
            g = Math.max(0, Math.min(255, g + shadeBias));
            b = Math.max(0, Math.min(255, b + shadeBias));
        }
        if (colorOverlay && overlayIntensity > 0 && /^#[0-9a-fA-F]{6}$/.test(colorOverlay)) {
            const or = parseInt(colorOverlay.slice(1, 3), 16);
            const og = parseInt(colorOverlay.slice(3, 5), 16);
            const ob = parseInt(colorOverlay.slice(5, 7), 16);
            r = Math.max(0, Math.min(255, Math.round(r + (or - 128) * overlayIntensity)));
            g = Math.max(0, Math.min(255, Math.round(g + (og - 128) * overlayIntensity)));
            b = Math.max(0, Math.min(255, Math.round(b + (ob - 128) * overlayIntensity)));
        }
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /**
     * Draw 1px dark outline around opaque mount pixels so equipped modules read clearly.
     */
    drawMountOutline(ctx, sprite, x, y, width, height, colorOverlay, overlayIntensity) {
        if (!sprite || !sprite.length) return;
        const bounds = this.getPixelSpriteBounds(sprite);
        if (!bounds) return;
        const cols = bounds.w;
        const rows = bounds.h;
        const pixel = Math.max(1, Math.floor(Math.min(width / cols, height / rows)));
        const drawW = cols * pixel;
        const drawH = rows * pixel;
        const drawX = x + Math.floor((width - drawW) / 2);
        const drawY = y + Math.floor((height - drawH) / 2);
        const solid = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols
            && !!sprite[bounds.y + r][bounds.x + c];
        const edge = this.applyHullOverlayHex('#1a1a1a', colorOverlay, overlayIntensity, 0);
        ctx.fillStyle = edge;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!sprite[bounds.y + r][bounds.x + c]) continue;
                const bare =
                    !solid(r - 1, c) || !solid(r + 1, c) ||
                    !solid(r, c - 1) || !solid(r, c + 1);
                if (!bare) continue;
                // Expand one pixel outward from transparent neighbors
                const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                dirs.forEach(([dr, dc]) => {
                    if (solid(r + dr, c + dc)) return;
                    const left = Math.floor(drawX + (c + dc) * pixel);
                    const top = Math.floor(drawY + (r + dr) * pixel);
                    const right = left + pixel;
                    const bottom = top + pixel;
                    ctx.fillRect(
                        left,
                        top,
                        right - left,
                        bottom - top
                    );
                });
            }
        }
    },

    drawHullMountSprite(ctx, sprite, x, y, width, height, colorOverlay, overlayIntensity, shadeBias = 0) {
        if (!sprite || !sprite.length) return;
        const bounds = this.getPixelSpriteBounds(sprite);
        if (!bounds) return;
        // Re-map source pixels into the complete component frame. This keeps
        // every destination pixel hard-edged instead of downsampling the art.
        const targetW = Math.max(1, Math.round(width));
        const targetH = Math.max(1, Math.round(height));
        for (let row = 0; row < targetH; row++) {
            const sourceY = bounds.y + Math.min(
                bounds.h - 1,
                Math.floor(row * bounds.h / targetH)
            );
            for (let c = 0; c < targetW; c++) {
                const sourceX = bounds.x + Math.min(
                    bounds.w - 1,
                    Math.floor(c * bounds.w / targetW)
                );
                const idx = sprite[sourceY][sourceX];
                if (!idx) continue;
                let color = this.getHullMountShade(idx);
                if (!color) continue;
                color = this.applyHullOverlayHex(color, colorOverlay, overlayIntensity, shadeBias);
                ctx.fillStyle = color;
                ctx.fillRect(Math.round(x + c), Math.round(y + row), 1, 1);
            }
        }
    },

    getPixelSpriteBounds(sprite) {
        if (!sprite || !sprite.length || !sprite[0]) return null;
        const rows = sprite.length;
        const cols = sprite[0].length;
        let minX = cols;
        let minY = rows;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < rows; y++) {
            const row = sprite[y] || [];
            for (let x = 0; x < cols; x++) {
                if (!row[x]) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        return maxX < 0
            ? null
            : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    },

    /** Mirror / orient mount sprite for dock face (barrels stay forward on flanks). */
    withModuleFace(ctx, face, x, y, width, height, draw) {
        const f = face || 'up';
        ctx.save();
        if (f === 'right') {
            ctx.translate(x + width, y);
            ctx.scale(-1, 1);
            draw(0, 0);
        } else if (f === 'left') {
            draw(x, y);
        } else if (f === 'down') {
            draw(x, y);
        } else {
            draw(x, y);
        }
        ctx.restore();
    },
});
