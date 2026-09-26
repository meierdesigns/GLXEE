"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
    /**
     * Fit static (non-modular) ships into front/center/back + optional wing UV bands
     * without changing collision size. Prefer segment PNGs; else crop full sprite.
     */
    renderShipAsSegments(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions) {
        if (!shipModel || typeof shipLoadoutManager === 'undefined') return false;
        const uv = shipLoadoutManager.segmentUv;
        if (!uv) return false;

        const destW = (shipModel.width || 16) * scale;
        const destH = (shipModel.height || 12) * scale;
        const isEnemyShip = this.isEnemyShip(shipModel);

        // Procedural faction enemies are one authored pixel sprite, not a
        // segmented hull: slicing them into nose/core/aft/wing bands with
        // fixed proportions stretched them into flat blocks. Draw the whole
        // sprite instead (Scale2x-refined on the supersampled playfield).
        if (shipModel.factionSpriteKey && shipModel.sprite && !this.hasFactionShipPng(shipModel)) {
            ctx.save();
            if (isEnemyShip) {
                ctx.translate(x + destW / 2, y + destH / 2);
                ctx.scale(1, -1);
                ctx.translate(-(x + destW / 2), -(y + destH / 2));
            }
            const drew = this.renderSegmentFromFullSprite(ctx, shipModel,
                { id: 'full', fullUv: true, uv: { x: 0, y: 0, w: 1, h: 1 }, mirror: false },
                x, y, destW, destH, colorOverlay, overlayIntensity);
            if (drew && shipModel.engineGlow
                && !(typeof graphicsManager !== 'undefined' && graphicsManager._shieldSilhouetteBake)) {
                const sp = shipModel.sprite;
                const cellW = destW / Math.max(1, sp[0].length);
                const cellH = destH / Math.max(1, sp.length);
                this.renderEngineGlow(ctx, shipModel.engineGlow, x, y, scale, false, cellW, cellH);
            }
            ctx.restore();
            return drew;
        }

        // Detect whether wings exist in the source art (opaque pixels in wing UV)
        const hasWings = this.shipSpriteHasWingPixels(shipModel);

        const frontH = Math.max(2, Math.round(destH * uv.front.h));
        const backH = Math.max(2, Math.round(destH * uv.back.h));
        const centerH = Math.max(2, destH - frontH - backH);
        const wingW = hasWings ? Math.max(2, Math.round(destW * uv.wing.w)) : 0;
        const wingH = hasWings ? Math.max(2, Math.round(destH * uv.wing.h)) : 0;
        const bodyW = Math.max(2, destW - wingW * 2);
        const bodyX = x + wingW;
        const wingY = y + frontH + Math.floor((centerH - wingH) / 2);

        // Full-width UV when wings are not split out; narrow fuselage UV when wings are separate.
        const bodyUv = (band) => (hasWings
            ? band
            : { x: 0, y: band.y, w: 1, h: band.h });

        const segments = [
            { id: 'back', x: bodyX, y: y + frontH + centerH, width: bodyW, height: backH, mirror: false, uv: bodyUv(uv.back) },
            { id: 'center', x: bodyX, y: y + frontH, width: bodyW, height: centerH, mirror: false, uv: bodyUv(uv.center) },
            { id: 'front', x: bodyX, y: y, width: bodyW, height: frontH, mirror: false, uv: bodyUv(uv.front) }
        ];
        if (hasWings) {
            segments.unshift(
                { id: 'wingLeft', x: x, y: wingY, width: wingW, height: wingH, mirror: false, uv: uv.wing },
                { id: 'wingRight', x: x + destW - wingW, y: wingY, width: wingW, height: wingH, mirror: true, uv: uv.wing }
            );
        }

        ctx.save();
        if (isEnemyShip) {
            ctx.translate(x + destW / 2, y + destH / 2);
            ctx.scale(1, -1);
            ctx.translate(-(x + destW / 2), -(y + destH / 2));
        }

        // Sort draw order: back, wings, center, front
        const order = { back: 0, wingLeft: 1, wingRight: 2, center: 3, front: 4 };
        segments.sort((a, b) => (order[a.id] || 9) - (order[b.id] || 9));

        let drew = false;
        segments.forEach((seg) => {
            const segKey = this.resolveSegmentSpriteKey(shipModel, seg.id);
            const hasSegPng = segKey
                && typeof spriteLoader !== 'undefined'
                && spriteLoader.getSprite
                && spriteLoader.getSprite(segKey);
            if (hasSegPng) {
                ctx.save();
                if (seg.mirror) {
                    ctx.translate(seg.x + seg.width, seg.y);
                    ctx.scale(-1, 1);
                    spriteLoader.renderSprite(ctx, segKey, 0, 0, seg.width, seg.height, colorOverlay, overlayIntensity);
                } else {
                    spriteLoader.renderSprite(
                        ctx, segKey, seg.x, seg.y, seg.width, seg.height, colorOverlay, overlayIntensity
                    );
                }
                ctx.restore();
                drew = true;
                return;
            }
            if (this.renderSegmentFromFullSprite(
                ctx, shipModel, seg, seg.x, seg.y, seg.width, seg.height, colorOverlay, overlayIntensity
            )) {
                drew = true;
            }
        });

        if (drew && shipModel.engineGlow
            && !(typeof graphicsManager !== 'undefined' && graphicsManager._shieldSilhouetteBake)) {
            const sp = shipModel.sprite;
            const cols = (sp && sp[0] && sp[0].length) || shipModel.width || 1;
            const rows = (sp && sp.length) || shipModel.height || 1;
            const cellW = destW / Math.max(1, cols);
            const cellH = destH / Math.max(1, rows);
            this.renderEngineGlow(ctx, shipModel.engineGlow, x, y, scale, false, cellW, cellH);
        }

        ctx.restore();
        return drew;
    },

    hasFactionShipPng(shipModel) {
        return !!(typeof spriteLoader !== 'undefined' && spriteLoader.getSprite
            && spriteLoader.getSprite(this.getSpriteNameForShip(shipModel)));
    },

    shipSpriteHasWingPixels(shipModel) {
        const uv = (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.segmentUv)
            ? shipLoadoutManager.segmentUv.wing
            : null;
        if (!uv) return true;
        const spriteName = this.getSpriteNameForShip(shipModel);
        const png = spriteName
            && typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteName);
        if (png) {
            // Assume winged silhouette when sprite is wider than tall
            return png.width >= png.height * 0.85;
        }
        const sprite = shipModel.sprite;
        if (!sprite || !sprite.length || !sprite[0]) return false;
        const cols = sprite[0].length;
        const rows = sprite.length;
        // Wings are cropped from the outer sprite edges. Do not use the
        // inset UV x-coordinate here, otherwise the detector can miss the
        // actual wing pixels at the left/right border.
        const c0 = 0;
        const r0 = Math.floor(uv.y * rows);
        const cw = Math.max(1, Math.floor(uv.w * cols));
        const rh = Math.max(1, Math.floor(uv.h * rows));
        for (let r = 0; r < rh; r++) {
            const row = sprite[r0 + r];
            if (!row) continue;
            for (let c = 0; c < cw; c++) {
                if (row[c0 + c]) return true;
            }
        }
        return false;
    },

    /**
     * Convert the legacy inset UV bands into edge-based crops.
     * Body bands are cut from the top / middle / bottom of the fuselage;
     * wings are cut from the left / right outer edge of the source image.
     */
    getEdgeCropForSegment(seg, uv) {
        if (!uv) return null;
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const id = String(seg && seg.id || '');
        const fullUv = (uv.front || uv.back || uv.wing)
            ? uv
            : ((typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.segmentUv)
                || {});
        const band = fullUv[id] || fullUv.wing || uv;
        const frontH = clamp(Number(fullUv.front && fullUv.front.h) || 0.2, 0.01, 1);
        const backH = clamp(Number(fullUv.back && fullUv.back.h) || 0.2, 0.01, 1);
        const wing = fullUv.wing || band;

        if (id === 'wingLeft' || id === 'wingRight') {
            const edgeInset = clamp(Number(band.x) || 0, 0, 1);
            const w = clamp(Number(band.w || wing.w) || 0.24, 0.01, 1);
            return {
                x: id === 'wingRight' ? 1 - edgeInset - w : edgeInset,
                y: clamp(Number(band.y || wing.y) || 0.3, 0, 1),
                w: w,
                h: clamp(Number(band.h || wing.h) || 0.4, 0.01, 1)
            };
        }

        const x = clamp(Number(band.x) || 0, 0, 1);
        const w = clamp(Number(band.w) || 1, 0.01, 1 - x);
        if (id === 'front') {
            return { x: x, y: 0, w: w, h: frontH };
        }
        if (id === 'back') {
            return { x: x, y: 1 - backH, w: w, h: backH };
        }
        return {
            x: x,
            y: frontH,
            w: w,
            h: Math.max(0.01, 1 - frontH - backH)
        };
    },

    /**
     * Core hull only + attached weapon / defense / ability modules.
     * Ship size = bounding box of core + modules.
     * Draw order: back → wings → center → front → modules.
     */
    renderModularShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0, renderOptions = null) {
        const layout = shipModel.layout;
        const core = layout.core;
        const isEnemyShip = this.isEnemyShip(shipModel);
        // Pin the whole ship to whole pixels once, so every part rasterizes
        // against the same origin. Letting each part round on its own left
        // them shifting against each other by a pixel as the view panned.
        x = Math.round(x);
        y = Math.round(y);

        ctx.save();
        if (isEnemyShip) {
            const tw = shipModel.width * scale;
            const th = shipModel.height * scale;
            ctx.translate(x + tw / 2, y + th / 2);
            ctx.scale(1, -1);
            ctx.translate(-(x + tw / 2), -(y + th / 2));
        }

        const coreX = x + core.x * scale;
        const coreY = y + core.y * scale;
        const coreW = core.width * scale;
        const coreH = core.height * scale;
        const moduleFactionStyle = this.resolveModuleFactionStyle(shipModel);

        if (layout.segments && layout.segments.length) {
            this.renderHullSegments(
                ctx,
                shipModel,
                x,
                y,
                scale,
                colorOverlay,
                overlayIntensity,
                renderOptions,
                moduleFactionStyle
            );
        } else {
            this.renderModularWingPanels(
                ctx,
                shipModel,
                x,
                y,
                scale,
                colorOverlay,
                overlayIntensity
            );
            this.renderCoreHull(ctx, shipModel, coreX, coreY, coreW, coreH, colorOverlay, overlayIntensity);
        }

        const skipFx = typeof graphicsManager !== 'undefined' && graphicsManager._shieldSilhouetteBake;

        if (!skipFx && shipModel.engineGlow) {
            const srcW = shipModel.sprite && shipModel.sprite[0] ? shipModel.sprite[0].length : (shipModel.coreWidth || core.width);
            const srcH = shipModel.sprite ? shipModel.sprite.length : (shipModel.coreHeight || core.height);
            const gx = coreX;
            const gy = coreY;
            const gs = Math.min(coreW / srcW, coreH / srcH);
            const gox = (coreW - srcW * gs) / 2;
            const goy = (coreH - srcH * gs) / 2;
            this.renderEngineGlow(ctx, shipModel.engineGlow, gx + gox, gy + goy, gs, false);
        }

        // Attached modules (replace/insert segments already drew hull pieces)
        // Modules use the hull's voxel size and lattice, not their own.
        this.withShipVoxelRaster(shipModel, x, y, scale, () => {
            (layout.modules || []).forEach((mod) => {
                if (mod.integrate === 'replace') return;
                const mx = Math.round(x + mod.x * scale);
                const my = Math.round(y + mod.y * scale);
                const mw = Math.max(1, Math.round(mod.width * scale));
                const mh = Math.max(1, Math.round((mod.height != null ? mod.height : mod.width) * scale));
                this.renderShipModule(
                    ctx,
                    mod,
                    mx,
                    my,
                    mw,
                    mh,
                    colorOverlay,
                    overlayIntensity,
                    renderOptions,
                    moduleFactionStyle
                );
            });
        });

        if (!skipFx && renderOptions && renderOptions.showThrusterGlow === true) {
            this.renderModularThrusterGlow(ctx, shipModel, x, y, scale);
        }

        ctx.restore();
    },
});
