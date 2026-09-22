"use strict";

// Ship Asset Loader
class ShipAssetLoader {
    constructor() {
        this.ships = new Map();
        this.loaded = false;
        this._spriteBounds = new WeakMap();
    }

    // Load all ship assets
    async loadAllShips() {
        try {
            // Import all ship model assets
            const { playerStarfighterModel } = await import('./player-starfighter-model.js');
            const { playerInterceptorModel } = await import('./player-interceptor-model.js');
            const { playerHeavyFighterModel } = await import('./player-heavy-fighter-model.js');
            const { playerAssaultModel } = await import('./player-assault-model.js');
            const { scoutModel } = await import('./scout-model.js');
            const { fighterModel } = await import('./fighter-model.js');
            const { interceptorModel } = await import('./interceptor-model.js');
            const { cruiserModel } = await import('./cruiser-model.js');
            const { battleshipModel } = await import('./battleship-model.js');

            // Store ships in map with new naming system
            this.ships.set('player', playerStarfighterModel);
            this.ships.set('player_interceptor', playerInterceptorModel);
            this.ships.set('player_heavy', playerHeavyFighterModel);
            this.ships.set('player_assault', playerAssaultModel);
            this.ships.set('scout', scoutModel);
            this.ships.set('fighter', fighterModel);
            this.ships.set('interceptor', interceptorModel);
            this.ships.set('cruiser', cruiserModel);
            this.ships.set('battleship', battleshipModel);

            // Legacy compatibility mappings
            this.ships.set('enemyBasic', fighterModel);
            this.ships.set('enemyFast', interceptorModel);
            this.ships.set('enemyHeavy', cruiserModel);
            this.ships.set('enemyBoss', battleshipModel);

            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load ship model assets:', error);
            return false;
        }
    }

    // Get ship by type
    getShip(type) {
        if (!this.loaded) {
            console.warn('Ship assets not loaded yet');
            return null;
        }
        return this.ships.get(type) || this.ships.get('player');
    }

    // Get all available ship types
    getAvailableShips() {
        return Array.from(this.ships.keys());
    }

    // Get all enemy ship types
    getEnemyShips() {
        return Array.from(this.ships.keys()).filter(type => type.startsWith('enemy'));
    }

    // Get all player ship types
    getPlayerShips() {
        return Array.from(this.ships.keys()).filter(type => type.startsWith('player'));
    }

    // Get all player ship models
    getPlayerShipModels() {
        return Array.from(this.ships.values()).filter(ship => ship.type === 'player');
    }

    // Get ships by tier
    getShipsByTier(tier) {
        return Array.from(this.ships.values()).filter(ship => ship.tier === tier);
    }

    // Get ships by model class
    getShipsByClass(modelClass) {
        return Array.from(this.ships.values()).filter(ship => ship.modelClass === modelClass);
    }

    // Get ships by speed range
    getShipsBySpeedRange(minSpeed, maxSpeed) {
        return Array.from(this.ships.values()).filter(ship => 
            ship.speed >= minSpeed && ship.speed <= maxSpeed
        );
    }

    // Get ships by health range
    getShipsByHealthRange(minHealth, maxHealth) {
        return Array.from(this.ships.values()).filter(ship => 
            ship.maxHealth >= minHealth && ship.maxHealth <= maxHealth
        );
    }

    // Get all ship models with their properties
    getAllShipModels() {
        return Array.from(this.ships.values());
    }

    // Check if assets are loaded
    isLoaded() {
        return this.loaded;
    }

    // Render ship sprite to canvas with color overlay support
    renderShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0, renderOptions = null) {
        if (!shipModel) return;
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;

        if (shipModel.weakenOverlay && overlayIntensity > 0) {
            overlayIntensity = overlayIntensity * 0.2;
        }

        if (shipModel.modular && shipModel.layout && shipModel.layout.core) {
            this.renderModularShip(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions);
            return;
        }

        // Non-modular hulls: still draw as front/center/back/(wings) when possible
        if (this.renderShipAsSegments(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions)) {
            return;
        }
        
        // Check if this is an enemy ship (needs vertical flip)
        const isEnemyShip = this.isEnemyShip(shipModel);
        
        // Try to use PNG sprite first, fallback to pixel sprite
        const spriteName = this.getSpriteNameForShip(shipModel);
        const hasSprite = typeof spriteLoader !== 'undefined' && spriteName && spriteLoader.getSprite(spriteName);
        if (hasSprite) {
            // Use PNG sprite - maintain aspect ratio
            const sprite = spriteLoader.getSprite(spriteName);
            const spriteAspect = sprite.width / sprite.height;
            const targetWidth = shipModel.width * scale;
            const targetHeight = shipModel.height * scale;
            const targetAspect = targetWidth / targetHeight;
            
            let renderWidth, renderHeight, offsetX, offsetY;
            
            if (spriteAspect > targetAspect) {
                // Sprite is wider - fit to width
                renderWidth = targetWidth;
                renderHeight = targetWidth / spriteAspect;
                offsetX = 0;
                offsetY = (targetHeight - renderHeight) / 2;
            } else {
                // Sprite is taller - fit to height
                renderHeight = targetHeight;
                renderWidth = targetHeight * spriteAspect;
                offsetX = (targetWidth - renderWidth) / 2;
                offsetY = 0;
            }
            
            // Apply vertical flip for enemy ships
            if (isEnemyShip) {
                ctx.save();
                ctx.translate(x + offsetX + renderWidth / 2, y + offsetY + renderHeight / 2);
                ctx.scale(1, -1); // Vertical flip
                ctx.translate(-renderWidth / 2, -renderHeight / 2);
                spriteLoader.renderSprite(ctx, spriteName, 0, 0, renderWidth, renderHeight, colorOverlay, overlayIntensity);
                ctx.restore();
            } else {
                spriteLoader.renderSprite(ctx, spriteName, x + offsetX, y + offsetY, renderWidth, renderHeight, colorOverlay, overlayIntensity);
            }
        } else {
            // Fallback to pixel sprite
            this.renderPixelShip(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, isEnemyShip);
        }
        
        // Render engine glow if available (cell size matches fitted pixel grid)
        if (shipModel.engineGlow
            && !(typeof graphicsManager !== 'undefined' && graphicsManager._shieldSilhouetteBake)) {
            const sp = shipModel.sprite;
            const cols = (sp && sp[0] && sp[0].length) || shipModel.width || 1;
            const rows = (sp && sp.length) || shipModel.height || 1;
            const cellW = (shipModel.width * scale) / Math.max(1, cols);
            const cellH = (shipModel.height * scale) / Math.max(1, rows);
            this.renderEngineGlow(ctx, shipModel.engineGlow, x, y, scale, isEnemyShip, cellW, cellH);
        }
    }

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
    }

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
        const c0 = Math.floor(uv.x * cols);
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
    }

    /**
     * Core hull only + attached weapon / defense / ability modules.
     * Ship size = bounding box of core + modules.
     * Draw order: back → wings → center → front → modules.
     */
    renderModularShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0, renderOptions = null) {
        const layout = shipModel.layout;
        const core = layout.core;
        const isEnemyShip = this.isEnemyShip(shipModel);

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

        if (!skipFx && renderOptions && renderOptions.showThrusterGlow === true) {
            this.renderModularThrusterGlow(ctx, shipModel, x, y, scale);
        }

        ctx.restore();
    }

    /**
     * Resolve PNG key for a hull segment. wingRight falls back to mirrored wingLeft.
     */
    resolveSegmentSpriteKey(shipModel, segmentId) {
        const base = this.getSpriteNameForShip(shipModel);
        if (!base || typeof shipLoadoutManager === 'undefined'
            || !shipLoadoutManager.segmentSpriteKey) {
            return null;
        }
        const sid = String(segmentId || '');
        const tryKeys = [];
        if (sid === 'wingRight') {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingRight'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingLeft'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wing'));
        } else if (sid === 'wingLeft') {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wingLeft'));
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, 'wing'));
        } else {
            tryKeys.push(shipLoadoutManager.segmentSpriteKey(base, sid));
        }
        if (typeof spriteLoader === 'undefined' || !spriteLoader.getSprite) return tryKeys[0] || null;
        for (let i = 0; i < tryKeys.length; i++) {
            if (tryKeys[i] && spriteLoader.getSprite(tryKeys[i])) return tryKeys[i];
        }
        return tryKeys[0] || null;
    }

    /**
     * Draw segmented hull: back → wings → center → front.
     * Prefer dedicated segment PNGs; else distinct procedural blocks
     * (full-sprite UV crop only as last soft fallback — it looks fused).
     */
    renderHullSegments(ctx, shipModel, x, y, scale, colorOverlay, overlayIntensity, renderOptions) {
        const layout = shipModel.layout;
        const order = { back: 0, wingLeft: 1, wingRight: 2, center: 3, front: 4 };
        const segs = (layout.segments || []).slice().sort((a, b) => {
            const oa = order[a.id] != null ? order[a.id] : 9;
            const ob = order[b.id] != null ? order[b.id] : 9;
            return oa - ob;
        });
        const showGuides = !!(renderOptions && renderOptions.showSegmentGuides === true);
        // Player hulls always render each segment as its own faction-styled
        // procedural graphic — regenerated fresh (never a stretched bitmap)
        // every time a segment's size or position changes.
        const factionStyle = this.resolvePlayerFactionStyle(shipModel);
        const shapeSeed = this.resolveHullShapeSeed(shipModel);
        const centerSeg = segs.find((seg) => seg.id === 'center');
        if (centerSeg) {
            const wingPalette = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
            ctx.fillStyle = wingPalette[2];
            segs.filter((seg) => seg.id === 'wingLeft' || seg.id === 'wingRight').forEach((wing) => {
                const isLeft = wing.id === 'wingLeft';
                const centerEdge = x + (isLeft
                    ? centerSeg.x
                    : centerSeg.x + centerSeg.width) * scale;
                const wingEdge = x + (isLeft
                    ? wing.x + wing.width
                    : wing.x) * scale;
                const centerY = y + (centerSeg.y + centerSeg.height * 0.5) * scale;
                const wingY = y + (wing.y + wing.height * 0.5) * scale;
                const centerHalf = Math.max(2, centerSeg.height * scale * 0.16);
                const wingHalf = Math.max(2, wing.height * scale * 0.22);
                ctx.beginPath();
                ctx.moveTo(centerEdge, centerY - centerHalf);
                ctx.lineTo(wingEdge, wingY - wingHalf);
                ctx.lineTo(wingEdge, wingY + wingHalf);
                ctx.lineTo(centerEdge, centerY + centerHalf);
                ctx.closePath();
                ctx.fill();
            });
        }

        const hasDedicatedSegments = !factionStyle && segs.some((seg) => {
            const key = this.resolveSegmentSpriteKey(shipModel, seg.id);
            return key
                && typeof spriteLoader !== 'undefined'
                && spriteLoader.getSprite
                && spriteLoader.getSprite(key);
        });
        // Without authored segment assets, split the original sprite into
        // source-backed body and wing pieces. This preserves the ship's
        // anatomy while making both wings independently movable.
        if (!hasDedicatedSegments) {
            this.renderFallbackSegmentedHull(
                ctx,
                shipModel,
                segs,
                x,
                y,
                scale,
                colorOverlay,
                overlayIntensity,
                renderOptions,
                factionStyle,
                shapeSeed
            );
            if (showGuides) {
                this.drawSegmentGuides(
                    ctx,
                    layout,
                    x,
                    y,
                    scale,
                    colorOverlay,
                    overlayIntensity
                );
            }
            return;
        }

        segs.forEach((seg) => {
            const sx = x + seg.x * scale;
            const sy = y + seg.y * scale;
            const sw = Math.max(1, seg.width * scale);
            const sh = Math.max(1, seg.height * scale);

            // Module replace: draw mount art stretched into the segment box
            if (seg.replace && seg.replace.id) {
                const mod = {
                    id: seg.replace.id,
                    kind: seg.replace.kind,
                    role: (typeof shipLoadoutManager !== 'undefined'
                        && shipLoadoutManager.getModuleVisualRole)
                        ? shipLoadoutManager.getModuleVisualRole(seg.replace.kind, seg.replace.id)
                        : seg.replace.kind,
                    face: seg.id === 'wingRight' ? 'right'
                        : (seg.id === 'wingLeft' ? 'left'
                            : (seg.id === 'back' ? 'down' : 'up'))
                };
                this.renderShipModule(
                    ctx,
                    mod,
                    Math.round(sx),
                    Math.round(sy),
                    Math.round(sw),
                    Math.round(sh),
                    colorOverlay,
                    overlayIntensity,
                    renderOptions,
                    factionStyle
                );
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            const segKey = factionStyle ? null : this.resolveSegmentSpriteKey(shipModel, seg.id);
            const hasSegPng = segKey
                && typeof spriteLoader !== 'undefined'
                && spriteLoader.getSprite
                && spriteLoader.getSprite(segKey);

            if (hasSegPng) {
                ctx.save();
                if (seg.mirror) {
                    ctx.translate(sx + sw, sy);
                    ctx.scale(-1, 1);
                    spriteLoader.renderSprite(ctx, segKey, 0, 0, sw, sh, colorOverlay, overlayIntensity);
                } else {
                    spriteLoader.renderSprite(ctx, segKey, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                ctx.restore();
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            // Soft fallback: crop UV region from full ship sprite only when
            // at least one authored segment exists and the missing part needs
            // a temporary visual. Player hulls with a faction style skip this
            // entirely — each segment is generated procedurally instead.
            if (!factionStyle && this.renderSegmentFromFullSprite(
                ctx, shipModel, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity
            )) {
                if (showGuides) {
                    this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
                }
                return;
            }

            if (seg.id === 'wingLeft' || seg.id === 'wingRight') {
                this.renderProceduralWing(
                    ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed
                );
            } else {
                this.renderProceduralBodyBand(
                    ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed
                );
            }
            if (showGuides) {
                this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
            }
        });

        if (showGuides) {
            this.drawSegmentConnectors(ctx, layout, x, y, scale, colorOverlay, overlayIntensity);
        }
    }

    renderFallbackSegmentedHull(
        ctx,
        shipModel,
        segs,
        x,
        y,
        scale,
        colorOverlay,
        overlayIntensity,
        renderOptions,
        factionStyle,
        shapeSeed
    ) {
        const showGuides = !!(renderOptions && renderOptions.showSegmentGuides === true);
        segs.forEach((seg) => {
            const sx = x + seg.x * scale;
            const sy = y + seg.y * scale;
            const sw = Math.max(1, seg.width * scale);
            const sh = Math.max(1, seg.height * scale);
            if (seg.replace && seg.replace.id) {
                const mod = {
                    id: seg.replace.id,
                    kind: seg.replace.kind,
                    role: (typeof shipLoadoutManager !== 'undefined'
                        && shipLoadoutManager.getModuleVisualRole)
                        ? shipLoadoutManager.getModuleVisualRole(seg.replace.kind, seg.replace.id)
                        : seg.replace.kind,
                    face: seg.id === 'wingRight' ? 'right'
                        : (seg.id === 'wingLeft' ? 'left'
                            : (seg.id === 'back' ? 'down' : 'up'))
                };
                this.renderShipModule(
                    ctx,
                    mod,
                    Math.round(sx),
                    Math.round(sy),
                    Math.round(sw),
                    Math.round(sh),
                    colorOverlay,
                    overlayIntensity,
                    renderOptions,
                    factionStyle
                );
                return;
            }
            const drawn = !factionStyle && this.renderSegmentFromFullSprite(
                ctx,
                shipModel,
                seg,
                sx,
                sy,
                sw,
                sh,
                colorOverlay,
                overlayIntensity
            );
            if (!drawn) {
                if (seg.id === 'wingLeft' || seg.id === 'wingRight') {
                    this.renderProceduralWing(ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed);
                } else {
                    this.renderProceduralBodyBand(ctx, seg, sx, sy, sw, sh, colorOverlay, overlayIntensity, factionStyle, shapeSeed);
                }
            }
            if (showGuides) {
                this.drawSegmentSeam(ctx, seg.id, sx, sy, sw, sh, colorOverlay, overlayIntensity);
            }
        });
        if (showGuides) {
            this.drawSegmentConnectors(ctx, shipModel.layout, x, y, scale, colorOverlay, overlayIntensity);
        }
    }

    drawSegmentGuides(ctx, layout, x, y, scale, colorOverlay, overlayIntensity) {
        const segs = layout.segments || [];
        const byId = {};
        segs.forEach((seg) => { byId[seg.id] = seg; });
        const seam = this.applyHullOverlayHex('#171917', colorOverlay, overlayIntensity, 0);
        const edge = this.applyHullOverlayHex('#b4bba4', colorOverlay, overlayIntensity, 3);
        ctx.save();
        ctx.strokeStyle = seam;
        ctx.lineWidth = Math.max(1, Math.round(scale * 0.18));
        ctx.setLineDash([Math.max(1, Math.round(scale * 0.6)), Math.max(1, Math.round(scale * 0.45))]);

        const horizontalGuide = (a, b) => {
            if (!a || !b) return;
            const left = Math.max(a.x, b.x);
            const right = Math.min(a.x + a.width, b.x + b.width);
            if (right <= left) return;
            const yPos = y + ((a.y + a.height + b.y) * 0.5) * scale;
            ctx.beginPath();
            ctx.moveTo(x + left * scale, yPos);
            ctx.lineTo(x + right * scale, yPos);
            ctx.stroke();
        };
        horizontalGuide(byId.front, byId.center);
        horizontalGuide(byId.center, byId.back);
        ctx.setLineDash([]);

        // Short bright docking marks show where interchangeable wings connect,
        // without drawing detached replacement geometry.
        ctx.strokeStyle = edge;
        ctx.lineWidth = Math.max(1, Math.round(scale * 0.22));
        const wingGuide = (wing, core, left) => {
            if (!wing || !core) return;
            const root = left ? wing.x + wing.width : wing.x;
            const y0 = wing.y + wing.height * 0.28;
            const y1 = wing.y + wing.height * 0.72;
            ctx.beginPath();
            ctx.moveTo(x + root * scale, y + y0 * scale);
            ctx.lineTo(x + root * scale, y + y1 * scale);
            ctx.stroke();
        };
        wingGuide(byId.wingLeft, byId.center, true);
        wingGuide(byId.wingRight, byId.center, false);
        ctx.restore();
    }

    /** Thin dark outline so each segment reads as its own plate. */
    drawSegmentSeam(ctx, segId, x, y, w, h, colorOverlay, overlayIntensity) {
        const edge = this.applyHullOverlayHex('#141414', colorOverlay, overlayIntensity, 0);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
        // Highlight docking edge toward the core
        const hi = this.applyHullOverlayHex('#c8c8c8', colorOverlay, overlayIntensity, 6);
        ctx.fillStyle = hi;
        if (segId === 'front') {
            ctx.fillRect(x + w * 0.25, y + h - 1, w * 0.5, 1);
        } else if (segId === 'back') {
            ctx.fillRect(x + w * 0.25, y, w * 0.5, 1);
        } else if (segId === 'wingLeft') {
            ctx.fillRect(x + w - 1, y + h * 0.3, 1, h * 0.4);
        } else if (segId === 'wingRight') {
            ctx.fillRect(x, y + h * 0.3, 1, h * 0.4);
        } else if (segId === 'center') {
            ctx.fillRect(x + w * 0.2, y, w * 0.6, 1);
            ctx.fillRect(x + w * 0.2, y + h - 1, w * 0.6, 1);
        }
    }

    /** Tiny bridge pixels in the air gaps so parts feel docked, not floating random. */
    drawSegmentConnectors(ctx, layout, x, y, scale, colorOverlay, overlayIntensity) {
        const segs = layout.segments || [];
        if (segs.length < 2) return;
        const byId = {};
        segs.forEach((s) => { byId[s.id] = s; });
        const pin = this.applyHullOverlayHex('#8a8a8a', colorOverlay, overlayIntensity, 4);
        ctx.fillStyle = pin;
        const link = (a, b, axis) => {
            if (!a || !b) return;
            if (axis === 'y') {
                const ax = x + (a.x + a.width * 0.5) * scale;
                const top = Math.min(a.y + a.height, b.y);
                const bot = Math.max(a.y + a.height, b.y);
                const mid = y + ((top + bot) * 0.5) * scale;
                ctx.fillRect(Math.round(ax - 1), Math.round(mid - 0.5), 2, 1);
            } else {
                const ay = y + (a.y + a.height * 0.5) * scale;
                const left = Math.min(a.x + a.width, b.x);
                const right = Math.max(a.x + a.width, b.x);
                const mid = x + ((left + right) * 0.5) * scale;
                ctx.fillRect(Math.round(mid - 0.5), Math.round(ay - 1), 1, 2);
            }
        };
        link(byId.front, byId.center, 'y');
        link(byId.center, byId.back, 'y');
        link(byId.wingLeft, byId.center, 'x');
        link(byId.wingRight, byId.center, 'x');
    }

    renderSegmentFromFullSprite(ctx, shipModel, seg, x, y, w, h, colorOverlay, overlayIntensity) {
        const uv = seg.uv || (typeof shipLoadoutManager !== 'undefined'
            && shipLoadoutManager.segmentUv
            && shipLoadoutManager.segmentUv[
                seg.id === 'wingLeft' || seg.id === 'wingRight' ? 'wing' : seg.id
            ]);
        if (!uv) return false;

        const spriteName = this.getSpriteNameForShip(shipModel);
        const png = spriteName
            && typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteName);

        if (png) {
            const srcW = png.width;
            const srcH = png.height;
            let sx = Math.floor(uv.x * srcW);
            let sy = Math.floor(uv.y * srcH);
            let sw = Math.max(1, Math.floor(uv.w * srcW));
            let sh = Math.max(1, Math.floor(uv.h * srcH));
            if (seg.id === 'wingRight' && !seg.mirror) {
                // Explicit right wing crop from opposite side of sprite
                sx = Math.floor((1 - uv.x - uv.w) * srcW);
            }
            // Stretch the authored crop into the full segment frame so scaled
            // wings/body never leave empty cells inside their bounds.
            const drawW = Math.max(1, Math.round(w));
            const drawH = Math.max(1, Math.round(h));
            const drawX = Math.round(x);
            const drawY = Math.round(y);
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (seg.mirror) {
                ctx.translate(drawX + drawW, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(png, sx, sy, sw, sh, 0, 0, drawW, drawH);
            } else {
                ctx.drawImage(png, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
            }
            // Apply grayscale tint overlay if needed
            if (colorOverlay && overlayIntensity > 0 && typeof spriteLoader.renderSprite === 'function') {
                // Soft overlay pass via destination-in is complex; skip — hull tint applied globally elsewhere
            }
            ctx.restore();
            return true;
        }

        // Pixel-grid crop
        const sprite = shipModel.sprite;
        if (!sprite || !sprite.length || !sprite[0]) return false;
        const cols = sprite[0].length;
        const rows = sprite.length;
        let c0 = Math.floor(uv.x * cols);
        let r0 = Math.floor(uv.y * rows);
        let cw = Math.max(1, Math.floor(uv.w * cols));
        let rh = Math.max(1, Math.floor(uv.h * rows));
        if (seg.id === 'wingRight' && !seg.mirror) {
            c0 = Math.floor((1 - uv.x - uv.w) * cols);
        }
        const colors = shipModel.colors || {};
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
        // Cover the full segment: leftover edge pixels get an extra cell.
        ctx.save();
        if (seg.mirror) {
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            x = 0;
            y = 0;
        }
        for (let r = 0; r < rh; r++) {
            const row = sprite[r0 + r];
            if (!row) continue;
            const top = Math.floor(y + (r * h) / rh);
            const bottom = Math.floor(y + ((r + 1) * h) / rh);
            for (let c = 0; c < cw; c++) {
                const pixel = row[c0 + c];
                if (!pixel) continue;
                let fill = resolve(colors[pixel] || '#888888');
                fill = this.tintPixelColor(fill, colorOverlay, overlayIntensity);
                ctx.fillStyle = fill;
                const left = Math.floor(x + (c * w) / cw);
                const right = Math.floor(x + ((c + 1) * w) / cw);
                ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
            }
        }
        ctx.restore();
        return true;
    }

    /** Indexed palette for a hull part: 0 transparent, 1 edge, 2 hull, 3 accent. */
    buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle) {
        const edgeBase = factionStyle ? factionStyle.edge : '#1e221c';
        const hullBase = factionStyle ? factionStyle.hull : '#5a6350';
        const accentBase = factionStyle ? factionStyle.accent : '#a8b090';
        return {
            0: 'transparent',
            1: this.applyHullOverlayHex(edgeBase, colorOverlay, overlayIntensity, 0),
            2: this.applyHullOverlayHex(hullBase, colorOverlay, overlayIntensity, 0),
            3: this.applyHullOverlayHex(accentBase, colorOverlay, overlayIntensity, 8)
        };
    }

    /**
     * Target on-screen size (actual device px) of one hull-part "pixel" cell.
     * Deriving it from the segment's already-scaled on-screen w/h keeps every
     * part's cell size pinned to this same constant regardless of zoom or how
     * big that particular part is — uniform across the whole ship — and it
     * recomputes (more/fewer cells) every render call as parts are scaled or
     * moved, since it always reads the current w/h.
     */
    get HULL_PIXEL_CELL_PX() {
        return 4;
    }

    hullPartResolution(w, h) {
        const cell = this.HULL_PIXEL_CELL_PX;
        // Never request more grid cells than there are physical pixels to draw
        // them into — at small preview/gameplay scale that forced extra cells
        // to share a pixel, so the shape's edges overwrote each other and the
        // part collapsed into a smeared blob instead of a proportional shape.
        const capW = Math.max(1, Math.floor(w));
        const capH = Math.max(1, Math.floor(h));
        return {
            resW: Math.max(1, Math.min(capW, Math.max(6, Math.round(w / cell)))),
            resH: Math.max(1, Math.min(capH, Math.max(6, Math.round(h / cell))))
        };
    }

    blankGrid(cols, rows) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    gridFillRect(g, c0, r0, cw, rh, val) {
        const rows = g.length;
        const cols = g[0].length;
        const r1 = Math.min(rows, Math.round(r0 + rh));
        const c1 = Math.min(cols, Math.round(c0 + cw));
        for (let r = Math.max(0, Math.round(r0)); r < r1; r++) {
            for (let c = Math.max(0, Math.round(c0)); c < c1; c++) {
                g[r][c] = val;
            }
        }
    }

    /**
     * Turns any filled (index 2) cell that touches an empty neighbor into an
     * edge (index 1) cell — a cheap, shape-agnostic way to give every part a
     * dark outline (like real pixel-art sprites) without hand-authoring one
     * per shape.
     */
    outlineGridEdges(g) {
        const rows = g.length;
        const cols = g[0].length;
        const src = g.map((row) => row.slice());
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (src[r][c] !== 2) continue;
                const up = r > 0 ? src[r - 1][c] : 0;
                const down = r < rows - 1 ? src[r + 1][c] : 0;
                const leftN = c > 0 ? src[r][c - 1] : 0;
                const rightN = c < cols - 1 ? src[r][c + 1] : 0;
                if (!up || !down || !leftN || !rightN) g[r][c] = 1;
            }
        }
    }

    /**
     * Each hull part (wing/nose/aft/core) is its own procedural pixel-index
     * grid, built fresh from its live on-screen w/h every render call — the
     * faction silhouette id bends the shape so each faction reads distinct.
     * Drawn with drawPixelGridHull (plain axis-aligned fillRect per cell),
     * never a vector path or an image-scaled bitmap, so it's never blurred
     * or anti-aliased — a real pixel-art sprite, not a stretched drawing.
     */
    renderProceduralWing(ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed) {
        const { resW, resH } = this.hullPartResolution(w, h);
        const shapeVariant = this.hullShapeVariantIndex(
            shapeSeed,
            seg.id === 'wingRight' ? 'wingLeft' : seg.id,
            this.wingShapeVariants.length
        );
        const grid = this.buildWingGrid(seg, resW, resH, factionStyle, shapeVariant);
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        this.drawPixelGridHull(ctx, grid, colors, x, y, w, h);
    }

    // Base tip geometry per shape variant: reach (0-1.3, how far the tip extends
    // from root toward the outer edge), center/spread (vertical opening as a
    // fraction of height). Faction silhouette nudges these further below.
    get wingShapeVariants() {
        return [
            { reach: 1.0, center: 0.5, spread: 0.22 },  // delta — straight wide triangle
            { reach: 1.05, center: 0.72, spread: 0.16 }, // swept — tip pulled toward the back
            { reach: 0.55, center: 0.5, spread: 0.3 }    // stub — short, blunt wing
        ];
    }

    buildWingGrid(seg, cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const left = seg.id === 'wingLeft';
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const base = this.wingShapeVariants[shapeVariant || 0] || this.wingShapeVariants[0];
        let reach = base.reach;
        let center = base.center;
        let spread = base.spread;
        if (silhouette === 'spikes') {
            reach *= 1.3;
            spread *= 0.5;
        } else if (silhouette === 'scrap') {
            spread *= 1.35;
        }
        // Root spar (fuselage-facing strip) tapers out to `reach` at the tip band.
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 0.5 : r / (rows - 1);
            const dist = Math.abs(t - center) / Math.max(0.08, spread);
            const taper = Math.max(0, 1 - dist);
            const widthFrac = Math.min(1, 0.22 + taper * Math.max(0, reach - 0.22));
            const width = Math.max(1, Math.round(cols * widthFrac));
            if (left) this.gridFillRect(g, cols - width, r, width, 1, 2);
            else this.gridFillRect(g, 0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        // Hardpoint rail accent
        const railW = Math.max(1, Math.round(cols * 0.16));
        const railC = left ? Math.max(1, cols - Math.round(cols * 0.55)) : Math.round(cols * 0.35);
        const railR0 = Math.round(rows * 0.22);
        const railH = Math.max(1, Math.round(rows * 0.56));
        this.gridFillRect(g, railC, railR0, railW, railH, 3);
        if (silhouette === 'rings') {
            const holeC = Math.round(cols * (left ? 0.58 : 0.42));
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.18));
            this.gridFillRect(g, holeC - holeR / 2, rows * 0.5 - holeR / 2, holeR, holeR, 0);
        } else if (silhouette === 'circuit') {
            this.gridFillRect(g, Math.round(cols * (left ? 0.68 : 0.18)), Math.round(rows * 0.15), 1, Math.max(1, Math.round(rows * 0.12)), 1);
            this.gridFillRect(g, Math.round(cols * (left ? 0.32 : 0.6)), Math.round(rows * 0.75), 1, Math.max(1, Math.round(rows * 0.12)), 1);
        }
        return g;
    }

    /** Number of shape variants available for a given body-band segment id. */
    bodyShapeVariantCount(segId) {
        if (segId === 'front' || segId === 'back') return 3;
        return 2;
    }

    renderProceduralBodyBand(ctx, seg, x, y, w, h, colorOverlay, overlayIntensity, factionStyle, shapeSeed) {
        const { resW, resH } = this.hullPartResolution(w, h);
        const shapeVariant = this.hullShapeVariantIndex(shapeSeed, seg.id, this.bodyShapeVariantCount(seg.id));
        const colors = this.buildHullPartPalette(colorOverlay, overlayIntensity, factionStyle);
        let grid;
        if (seg.id === 'front') grid = this.buildNoseGrid(resW, resH, factionStyle, shapeVariant);
        else if (seg.id === 'back') grid = this.buildAftGrid(resW, resH, factionStyle, shapeVariant);
        else grid = this.buildCenterGrid(resW, resH, factionStyle, shapeVariant);
        this.drawPixelGridHull(ctx, grid, colors, x, y, w, h);
    }

    buildNoseGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const variant = shapeVariant || 0;
        for (let r = 0; r < rows; r++) {
            const t = rows <= 1 ? 1 : r / (rows - 1); // 0 apex .. 1 base
            let widthFrac;
            if (variant === 1) {
                widthFrac = 0.55 + t * 0.45; // blunt: wide from the start
            } else if (variant === 2) {
                const bump = Math.abs(Math.sin(Math.min(1, t * 1.6) * Math.PI));
                widthFrac = 0.25 + t * 0.55 + bump * 0.18; // forked twin prong
            } else {
                widthFrac = 0.1 + t * 0.9; // pointed
            }
            if (silhouette === 'spikes') widthFrac *= 0.88;
            const width = Math.max(1, Math.round(cols * Math.min(1, widthFrac)));
            const c0 = Math.round((cols - width) / 2);
            this.gridFillRect(g, c0, r, width, 1, 2);
        }
        this.outlineGridEdges(g);
        const capW = Math.max(1, Math.round(cols * 0.2));
        const capC = Math.round((cols - capW) / 2);
        const capR0 = Math.round(rows * 0.4);
        const capH = Math.max(1, Math.round(rows * 0.32));
        this.gridFillRect(g, capC, capR0, capW, capH, 3);
        if (silhouette === 'rings') {
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.16));
            this.gridFillRect(g, cols / 2 - holeR / 2, rows * 0.65 - holeR / 2, holeR, holeR, 0);
        } else if (silhouette === 'circuit') {
            this.gridFillRect(g, Math.round(cols / 2) - 1, Math.round(rows * 0.15), 1, Math.max(1, Math.round(rows * 0.2)), 1);
        }
        return g;
    }

    buildAftGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const variant = shapeVariant || 0;
        this.gridFillRect(g, 0, 0, cols, rows, 2);
        this.outlineGridEdges(g);
        const nozzleCount = variant === 2 ? 3 : (variant === 1 ? 1 : 2);
        const nozzleR0 = Math.round(rows * 0.4);
        const nozzleH = Math.max(1, Math.round(rows * 0.5));
        if (nozzleCount === 1) {
            const w1 = Math.max(1, Math.round(cols * 0.3));
            this.gridFillRect(g, (cols - w1) / 2, nozzleR0, w1, nozzleH, 3);
        } else if (nozzleCount === 3) {
            const w3 = Math.max(1, Math.round(cols * 0.14));
            this.gridFillRect(g, cols * 0.14, nozzleR0, w3, nozzleH, 3);
            this.gridFillRect(g, cols * 0.43, nozzleR0, w3, nozzleH, 3);
            this.gridFillRect(g, cols * 0.72, nozzleR0, w3, nozzleH, 3);
        } else {
            const w2 = Math.max(1, Math.round(cols * 0.18));
            this.gridFillRect(g, cols * 0.22, nozzleR0, w2, nozzleH, 3);
            this.gridFillRect(g, cols * 0.6, nozzleR0, w2, nozzleH, 3);
        }
        return g;
    }

    buildCenterGrid(cols, rows, factionStyle, shapeVariant) {
        const g = this.blankGrid(cols, rows);
        const silhouette = factionStyle ? factionStyle.silhouette : 'modular';
        const variant = shapeVariant || 0;
        this.gridFillRect(g, 0, 0, cols, rows, 2);
        this.outlineGridEdges(g);
        if (silhouette === 'rings') {
            const holeR = Math.max(1, Math.round(Math.min(cols, rows) * 0.24));
            this.gridFillRect(g, cols / 2 - holeR / 2, rows * 0.4 - holeR / 2, holeR, holeR, 3);
        } else if (variant === 1) {
            this.gridFillRect(g, cols * 0.22, rows * 0.24, cols * 0.56, Math.max(1, rows * 0.24), 3);
            this.gridFillRect(g, 1, rows * 0.62, Math.max(1, cols * 0.1), Math.max(1, rows * 0.15), 3);
            this.gridFillRect(g, cols - 1 - Math.max(1, cols * 0.1), rows * 0.62, Math.max(1, cols * 0.1), Math.max(1, rows * 0.15), 3);
        } else {
            this.gridFillRect(g, cols * 0.3, rows * 0.28, cols * 0.4, Math.max(1, rows * 0.22), 3);
        }
        return g;
    }

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
    }

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
    }

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
    }

    /** Scale an indexed pixel grid (sprite[row][col] -> colors[index]) into any target rect, regenerating cell sizes each call. */
    drawPixelGridHull(ctx, sprite, colors, x, y, width, height) {
        if (!sprite || !sprite.length) {
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, width, height);
            return;
        }
        const cols = sprite[0].length;
        const rows = sprite.length;
        const px = width / cols;
        const py = height / rows;
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
                ctx.fillStyle = resolve(palette[pixel] || '#888888');
                const left = Math.floor(x + col * px);
                const top = Math.floor(y + row * py);
                const right = Math.ceil(x + (col + 1) * px);
                const bottom = Math.ceil(y + (row + 1) * py);
                ctx.fillRect(left, top, right - left, bottom - top);
            }
        }
    }

    /** Player hull modelClass ids that should be skinned via the faction silhouette engine. */
    isPlayerHullModel(shipModel) {
        if (!shipModel || shipModel.forceEnemyOrientation) return false;
        const playerClasses = ['starfighter', 'interceptor', 'heavy_fighter', 'assault'];
        return playerClasses.indexOf(shipModel.modelClass) !== -1;
    }

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
    }

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
    }

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
    }

    /** Deterministic 0..count-1 variant index for one hull part, from the ship's shape seed. */
    hullShapeVariantIndex(shapeSeed, segId, count) {
        if (typeof factionShipStyles === 'undefined' || !factionShipStyles.hash) return 0;
        return factionShipStyles.hash(String(shapeSeed) + '|' + segId) % count;
    }

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
    }

    getFactionModuleShade(index, style) {
        if (!style) return null;
        if (index <= 3) return style.edge || null;
        if (index >= 13) return style.accent || null;
        return style.hull || null;
    }

    isFactionModuleCell(col, row, width, height, style) {
        if (!style || width < 5 || height < 5) return true;
        const u = ((col + 0.5) / width) * 2 - 1;
        const v = ((row + 0.5) / height) * 2 - 1;
        const silhouette = style.silhouette || 'modular';
        if (silhouette === 'rings') {
            return Math.abs(u) > 0.28 || Math.abs(v) > 0.28;
        }
        if (silhouette === 'spikes') {
            const taper = 0.48 + Math.abs(v) * 0.42;
            return Math.abs(u) < taper;
        }
        if (silhouette === 'scrap') {
            const au = Math.abs(u);
            const av = Math.abs(v);
            return !(au > 0.35 && av < 0.25) && !(au > 0.72 && av > 0.5);
        }
        if (silhouette === 'circuit') {
            return !(Math.abs(u) > 0.72 && Math.abs(v) > 0.72);
        }
        if (silhouette === 'modular') {
            return !(Math.abs(u) > 0.62 && Math.abs(v) > 0.62);
        }
        return true;
    }

    /** Per-role brightness bias so weapons / armor / cores / thrusters read apart. */
    getModuleRoleShadeBias(role, kind) {
        const r = role || kind || '';
        if (r === 'hardpoint' || kind === 'weapon') return 28;
        if (r === 'plating') return -6;
        if (r === 'core' || kind === 'energy' || kind === 'defense') return 16;
        if (r === 'thruster') return 32;
        if (r === 'pod' || kind === 'ability') return 12;
        return 4;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    /**
     * Dense 8×8 shade templates (1–15). Every cell is opaque so remapping
     * into any target size fills the component frame completely.
     */
    getProceduralModuleTemplate(role, kind, visualId) {
        const named = visualId ? this.getNamedModuleTemplate(visualId) : null;
        if (named) return named;
        const visual = role || kind || 'ability';
        if (visual === 'hardpoint' || kind === 'weapon') {
            return [
                [4, 6, 12, 15, 15, 12, 6, 4],
                [6, 12, 15, 15, 15, 15, 12, 6],
                [6, 12, 14, 10, 10, 14, 12, 6],
                [4, 10, 12, 15, 15, 12, 10, 4],
                [4, 10, 12, 15, 15, 12, 10, 4],
                [6, 12, 14, 10, 10, 14, 12, 6],
                [6, 12, 15, 12, 12, 15, 12, 6],
                [4, 6, 8, 8, 8, 8, 6, 4]
            ];
        }
        if (visual === 'plating' || kind === 'defense') {
            return [
                [3, 8, 12, 14, 14, 12, 8, 3],
                [8, 14, 15, 12, 12, 15, 14, 8],
                [12, 15, 12, 8, 8, 12, 15, 12],
                [14, 12, 8, 15, 15, 8, 12, 14],
                [14, 12, 8, 15, 15, 8, 12, 14],
                [12, 15, 12, 8, 8, 12, 15, 12],
                [8, 14, 15, 12, 12, 15, 14, 8],
                [3, 8, 12, 14, 14, 12, 8, 3]
            ];
        }
        if (visual === 'core' || kind === 'energy') {
            return [
                [4, 8, 12, 14, 14, 12, 8, 4],
                [8, 12, 15, 15, 15, 15, 12, 8],
                [12, 15, 10, 8, 8, 10, 15, 12],
                [14, 15, 8, 15, 15, 8, 15, 14],
                [14, 15, 8, 15, 15, 8, 15, 14],
                [12, 15, 10, 8, 8, 10, 15, 12],
                [8, 12, 15, 15, 15, 15, 12, 8],
                [4, 8, 12, 14, 14, 12, 8, 4]
            ];
        }
        if (visual === 'thruster') {
            return [
                [4, 8, 10, 12, 12, 10, 8, 4],
                [8, 12, 15, 14, 14, 15, 12, 8],
                [10, 15, 12, 8, 8, 12, 15, 10],
                [12, 14, 8, 6, 6, 8, 14, 12],
                [12, 14, 10, 8, 8, 10, 14, 12],
                [10, 15, 14, 12, 12, 14, 15, 10],
                [8, 12, 15, 15, 15, 15, 12, 8],
                [4, 8, 12, 14, 14, 12, 8, 4]
            ];
        }
        // ability / pod default
        return [
            [4, 8, 12, 14, 14, 12, 8, 4],
            [8, 14, 15, 12, 12, 15, 14, 8],
            [12, 15, 10, 8, 8, 10, 15, 12],
            [14, 12, 8, 15, 15, 8, 12, 14],
            [14, 12, 8, 15, 15, 8, 12, 14],
            [12, 15, 10, 8, 8, 10, 15, 12],
            [8, 14, 15, 12, 12, 15, 14, 8],
            [4, 8, 12, 14, 14, 12, 8, 4]
        ];
    }

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
    }

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
    }

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
    }

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
    }

    // Get sprite name for ship model
    getSpriteNameForShip(shipModel) {
        if (!shipModel) return null;

        if (shipModel.factionSpriteKey) {
            if (typeof spriteLoader !== 'undefined' && spriteLoader.getSprite
                && spriteLoader.getSprite(shipModel.factionSpriteKey)) {
                return shipModel.factionSpriteKey;
            }
            // A faction model must never fall back to the generic enemy class sprite.
            // Its procedural faction silhouette is already present on shipModel.sprite.
            return null;
        }
        if (shipModel.spriteKey) {
            if (typeof spriteLoader !== 'undefined' && spriteLoader.getSprite
                && spriteLoader.getSprite(shipModel.spriteKey)) {
                return shipModel.spriteKey;
            }
        }
        
        const type = shipModel.type;
        const modelClass = shipModel.modelClass;
        
        if (type === 'player') {
            switch (modelClass) {
                case 'starfighter': return 'player-starfighter';
                case 'heavy_fighter': return 'player-heavy-fighter';
                case 'assault': return 'player-assault';
                case 'interceptor': return 'player-interceptor';
                default: return 'player-starfighter';
            }
        } else if (type === 'enemy') {
            if (shipModel.faction && shipModel.enemyClass
                && typeof factionShipStyles !== 'undefined' && factionShipStyles.spriteKey) {
                const key = factionShipStyles.spriteKey(shipModel.faction, shipModel.enemyClass);
                if (typeof spriteLoader !== 'undefined' && spriteLoader.getSprite
                    && spriteLoader.getSprite(key)) {
                    return key;
                }
            }
            switch (modelClass) {
                case 'fighter': return 'enemy-fighter';
                case 'battleship': return 'enemy-battleship';
                case 'cruiser': return 'enemy-cruiser';
                case 'interceptor': return 'enemy-interceptor';
                case 'scout': return 'enemy-scout';
                default: return 'enemy-fighter';
            }
        }
        
        return null;
    }

    tintPixelColor(baseColor, colorOverlay, overlayIntensity) {
        if (!colorOverlay || !(overlayIntensity > 0)) return baseColor;
        if (typeof colorPalette !== 'undefined' && colorPalette.applyColorOverlay) {
            return colorPalette.applyColorOverlay(baseColor, colorOverlay, overlayIntensity);
        }
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.applyColorOverlay) {
            return colorPaletteSystem.applyColorOverlay(baseColor, colorOverlay, overlayIntensity);
        }
        return baseColor;
    }

    // Render pixel-based ship (fallback)
    renderPixelShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0, isEnemyShip = false) {
        const sprite = shipModel.sprite;
        const colors = shipModel.colors || {};
        if (!sprite || !sprite.length) return;

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

        const cols = sprite[0].length;
        const rows = sprite.length;
        const destW = shipModel.width * scale;
        const destH = shipModel.height * scale;
        const cellSize = Math.max(1, Math.floor(Math.min(
            destW / Math.max(1, cols),
            destH / Math.max(1, rows)
        )));
        const drawW = cols * cellSize;
        const drawH = rows * cellSize;
        const drawX = x + Math.floor((destW - drawW) / 2);
        const drawY = y + Math.floor((destH - drawH) / 2);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Flip around the destination box (not a separate overlay rect)
        if (isEnemyShip) {
            ctx.translate(x + destW / 2, y + destH / 2);
            ctx.scale(1, -1);
            ctx.translate(-(x + destW / 2), -(y + destH / 2));
        }

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                const pixel = sprite[row][col];
                if (!pixel) continue;
                let fill = resolve(colors[pixel] || '#888888');
                fill = this.tintPixelColor(fill, colorOverlay, overlayIntensity);
                ctx.fillStyle = fill;
                ctx.fillRect(
                    Math.floor(drawX + col * cellSize),
                    Math.floor(drawY + row * cellSize),
                    cellSize,
                    cellSize
                );
            }
        }

        ctx.restore();
    }

    // Render engine glow effect
    renderEngineGlow(ctx, engineGlow, x, y, scale, isEnemyShip = false, cellW = null, cellH = null) {
        if (!engineGlow || !engineGlow.positions) return;
        const originalAlpha = ctx.globalAlpha;
        const cw = cellW != null ? cellW : scale;
        const ch = cellH != null ? cellH : scale;
        const pivotW = (engineGlow.width || 1) * cw;
        const pivotH = (engineGlow.height || 1) * ch;

        ctx.save();

        if (isEnemyShip) {
            ctx.translate(x + pivotW / 2, y + pivotH / 2);
            ctx.scale(1, -1);
            ctx.translate(-(x + pivotW / 2), -(y + pivotH / 2));
        }

        engineGlow.positions.forEach((pos) => {
            ctx.fillStyle = engineGlow.color;
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = pos.intensity * (0.8 - i * 0.2);
                ctx.fillRect(
                    x + pos.x * cw - i,
                    y + pos.y * ch - i,
                    cw + i * 2,
                    ch + i * 2
                );
            }
        });

        ctx.restore();
        ctx.globalAlpha = originalAlpha;
    }
}

// Create global instance
const shipAssetLoader = new ShipAssetLoader();

// Export for use in other modules
export { shipAssetLoader };
