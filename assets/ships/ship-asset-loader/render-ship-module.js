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
        this.withModuleFace(ctx, face, x, y, w, h, (dx, dy) => {
            this.drawProceduralModule(
                ctx,
                Math.round(dx),
                Math.round(dy),
                w,
                h,
                role,
                mod.kind,
                colorOverlay,
                intensity,
                visualId,
                factionStyle
            );
        });
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
        return templates[visualId] || null;
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

    drawProceduralModule(ctx, x, y, width, height, role, kind, colorOverlay, intensity, visualId, factionStyle) {
        const w = Math.max(1, Math.round(width));
        const h = Math.max(1, Math.round(height));
        const template = this.getProceduralModuleTemplate(role, kind, visualId);
        const rows = template.length;
        const cols = template[0].length;
        const shadeBias = this.getModuleRoleShadeBias(role, kind);
        ctx.imageSmoothingEnabled = false;
        for (let row = 0; row < h; row++) {
            const sy = Math.min(rows - 1, Math.floor((row * rows) / h));
            for (let col = 0; col < w; col++) {
                if (!this.isFactionModuleCell(col, row, w, h, factionStyle)) continue;
                const sx = Math.min(cols - 1, Math.floor((col * cols) / w));
                const idx = template[sy][sx];
                if (!idx) continue;
                let color = this.getFactionModuleShade(idx, factionStyle)
                    || this.getHullMountShade(idx);
                if (!color) continue;
                color = this.applyHullOverlayHex(color, colorOverlay, intensity, shadeBias);
                ctx.fillStyle = color;
                ctx.fillRect(x + col, y + row, 1, 1);
            }
        }
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
