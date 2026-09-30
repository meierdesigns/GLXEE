"use strict";

// GraphicsManager methods, split from graphics-manager.js.
extendClass(GraphicsManager, {
    /**
     * Draw an energy-shield outline that follows the ship silhouette.
     * Built on the ship's own voxel grid (detected from its silhouette): one
     * voxel of gap, rim one voxel thick, so it has the ship's resolution.
     * Color follows --current-primary.
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} entity - { x, y, width, height }
     * @param {number} ratio - visibility 0..1 (proximity fade × shield strength)
     * @param {boolean} [flip] - enemy orientation
     * @param {object} [model] - optional ship model override
     * @param {object} [opts] - optional { thick, pulse }
     */
    drawShieldHull(ctx, entity, ratio, flip = false, model = null, opts = null) {
        if (!ctx || !entity || !(ratio > 0.01)) return;
        // Gap and rim in voxels (px values only size the padding; the ship's
        // voxel is at most MAX_CELL px here).
        const MAX_CELL = 8;
        const gapCells = 1;  // freiraum between hull and shield rim
        const thickCells = Math.max(1, Math.round(((opts && opts.thick) || 2) / 2));
        const pulse = (opts && opts.pulse != null) ? opts.pulse : 1;
        const maxR = (gapCells + thickCells) * MAX_CELL;
        const ew = Math.max(1, Math.ceil(entity.width));
        const eh = Math.max(1, Math.ceil(entity.height));
        const shipModel = model
            || (flip ? this.currentEnemyModel : this.currentPlayerModel);
        const mw = Math.max(ew, Math.ceil((shipModel && shipModel.width) || ew));
        const mh = Math.max(eh, Math.ceil((shipModel && shipModel.height) || eh));
        // Extra bleed: cover-fill sprite overhang + thruster/aura pixels outside entity box
        const bleed = 8;
        const overX = Math.max(0, Math.ceil((mw - ew) / 2));
        const overY = Math.max(0, Math.ceil((mh - eh) / 2));
        const padX = maxR + 1 + overX + bleed;
        const padY = maxR + 1 + overY + bleed;
        const w = ew + padX * 2;
        const h = eh + padY * 2;
        // Faction enemies are drawn from the entity's faction/class, not from
        // the legacy model: key the cache on that so each keeps its own rim.
        const factionSig = flip && entity.faction
            ? '|' + entity.faction + ':' + (entity.enemyClass || '') + ':' + (entity.tier || entity.level || '') + ':' + (entity.type || '')
            : '';
        const modelId = ((shipModel && (shipModel.id || shipModel.name)) || 'ship') + factionSig;
        const layoutSig = this.getShieldLayoutSignature(shipModel);
        const cacheKey = modelId + '|' + ew + 'x' + eh + '|g' + gapCells + 't' + thickCells
            + '|p' + padX + 'x' + padY + '|' + (flip ? 1 : 0) + '|' + layoutSig;

        let rim = this._shieldHullCache[cacheKey];
        if (!rim) {
            const off = document.createElement('canvas');
            off.width = w;
            off.height = h;
            const octx = off.getContext('2d');
            if (!octx) return;
            octx.imageSmoothingEnabled = false;

            // Carry faction / class / tier so the baked silhouette is the ship
            // actually drawn (without them every enemy baked as the default hull).
            const ghost = {
                x: padX, y: padY, width: entity.width, height: entity.height,
                faction: entity.faction, enemyClass: entity.enemyClass,
                tier: entity.tier, level: entity.level, type: entity.type
            };
            const prevPlayer = this.currentPlayerModel;
            const prevEnemy = this.currentEnemyModel;
            const prevBake = this._shieldSilhouetteBake;
            this._shieldSilhouetteBake = true;
            if (model) {
                if (flip) this.currentEnemyModel = model;
                else this.currentPlayerModel = model;
            }
            if (flip) this.renderEnemyShip(octx, ghost, 1);
            else this.renderPlayerShip(octx, ghost, 1);
            this.currentPlayerModel = prevPlayer;
            this.currentEnemyModel = prevEnemy;
            this._shieldSilhouetteBake = prevBake;

            const src = octx.getImageData(0, 0, w, h);
            const sd = src.data;
            const out = octx.createImageData(w, h);
            const od = out.data;
            const opaque = (x, y) => {
                if (x < 0 || y < 0 || x >= w || y >= h) return false;
                return sd[(y * w + x) * 4 + 3] > 40;
            };
            // Ship voxel size + grid offset, so the rim uses the same pixels.
            const grid = this.detectShieldVoxelGrid(sd, w, h, MAX_CELL);
            const c = grid.cell;
            const gx0 = grid.ox - Math.ceil(grid.ox / c) * c; // first column start (<= 0)
            const gy0 = grid.oy - Math.ceil(grid.oy / c) * c;
            const cols = Math.ceil((w - gx0) / c);
            const rows = Math.ceil((h - gy0) / c);
            // Voxel occupied if any of its pixels is.
            const occ = new Uint8Array(cols * rows);
            for (let y = 0; y < h; y++) {
                const r = Math.floor((y - gy0) / c);
                for (let x = 0; x < w; x++) {
                    if (opaque(x, y)) occ[r * cols + Math.floor((x - gx0) / c)] = 1;
                }
            }
            const R = gapCells + thickCells;
            for (let r = 0; r < rows; r++) {
                for (let q = 0; q < cols; q++) {
                    if (occ[r * cols + q]) continue;
                    let minCheb = R + 1;
                    for (let dy = -R; dy <= R && minCheb > 1; dy++) {
                        const rr = r + dy;
                        if (rr < 0 || rr >= rows) continue;
                        for (let dx = -R; dx <= R; dx++) {
                            const qq = q + dx;
                            if (qq < 0 || qq >= cols || !occ[rr * cols + qq]) continue;
                            const cheb = Math.max(Math.abs(dx), Math.abs(dy));
                            if (cheb < minCheb) minCheb = cheb;
                        }
                    }
                    // Ring outside the gap band — empty voxels between hull and rim
                    if (minCheb <= gapCells || minCheb > R) continue;
                    const x0 = Math.max(0, gx0 + q * c);
                    const y0 = Math.max(0, gy0 + r * c);
                    const x1 = Math.min(w, gx0 + (q + 1) * c);
                    const y1 = Math.min(h, gy0 + (r + 1) * c);
                    for (let y = y0; y < y1; y++) {
                        for (let x = x0; x < x1; x++) {
                            const i = (y * w + x) * 4;
                            od[i] = 255;
                            od[i + 1] = 255;
                            od[i + 2] = 255;
                            od[i + 3] = 255;
                        }
                    }
                }
            }
            octx.putImageData(out, 0, 0);
            rim = off;
            this._shieldHullCache[cacheKey] = rim;
        }

        let themeColor = '#b44dff';
        if (this.colorPalette && this.colorPalette.resolveCssColor) {
            themeColor = this.colorPalette.resolveCssColor('var(--current-primary)') || themeColor;
        } else if (typeof getComputedStyle !== 'undefined') {
            const root = getComputedStyle(document.documentElement);
            themeColor = (root.getPropertyValue('--current-primary')
                || root.getPropertyValue('--color-primary') || themeColor).trim() || themeColor;
        }

        if (!this._shieldTintCanvas) {
            this._shieldTintCanvas = document.createElement('canvas');
        }
        const tint = this._shieldTintCanvas;
        if (tint.width !== w) tint.width = w;
        if (tint.height !== h) tint.height = h;
        const tctx = tint.getContext('2d');
        if (!tctx) return;
        tctx.clearRect(0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over';
        tctx.drawImage(rim, 0, 0);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = themeColor;
        tctx.fillRect(0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over';

        // Soft fade: alpha tracks proximity (no hard floor); pulse from charge-sync
        const vis = Math.max(0, Math.min(1, ratio)) * Math.max(0.2, Math.min(1.2, pulse));
        ctx.save();
        ctx.globalAlpha = Math.min(1, vis * 0.9);
        ctx.drawImage(tint, Math.round(entity.x) - padX, Math.round(entity.y) - padY);
        ctx.restore();
    },

    // Get available enemy ship types
    /**
     * Voxel size of a baked ship silhouette: the most common short run of
     * opaque / empty pixels along rows and columns, plus where the grid
     * starts (mode of run starts modulo the size). Falls back to 1 px.
     */
    detectShieldVoxelGrid(sd, w, h, maxCell) {
        const a = (x, y) => sd[(y * w + x) * 4 + 3] > 40;
        const hist = new Array(maxCell + 1).fill(0);
        const startsX = [];
        const startsY = [];
        for (let y = 0; y < h; y++) {
            let run = 0;
            for (let x = 0; x <= w; x++) {
                const on = x < w && a(x, y);
                const prev = x > 0 && a(x - 1, y);
                if (x > 0 && (x === w || on !== prev)) {
                    if (run <= maxCell) hist[run]++;
                    if (x < w) startsX.push(x);
                    run = 0;
                }
                run++;
            }
        }
        for (let x = 0; x < w; x++) {
            let run = 0;
            for (let y = 0; y <= h; y++) {
                const on = y < h && a(x, y);
                const prev = y > 0 && a(x, y - 1);
                if (y > 0 && (y === h || on !== prev)) {
                    if (run <= maxCell) hist[run]++;
                    if (y < h) startsY.push(y);
                    run = 0;
                }
                run++;
            }
        }
        const total = hist.reduce((s, n) => s + n, 0);
        let cell = 1;
        for (let l = 1; l <= maxCell; l++) {
            if (hist[l] >= total * 0.12) { cell = l; break; }
        }
        const modeMod = (arr) => {
            const m = new Array(cell).fill(0);
            arr.forEach((v) => { m[v % cell]++; });
            return m.indexOf(Math.max.apply(null, m));
        };
        return { cell, ox: cell > 1 ? modeMod(startsX) : 0, oy: cell > 1 ? modeMod(startsY) : 0 };
    },

    getAvailableEnemyShips() {
        if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
            return this.shipAssetLoader.getEnemyShips();
        } else {
            return this.shipModels.getAvailableShips().filter(type => type.startsWith('enemy'));
        }
    },

    drawSprite(ctx, sprite, x, y, width, height, lightingIntensity = 0, lightingColor = 'var(--current-text)', overlayColor = null, overlayIntensity = 0) {
        if (!sprite) return;

        const pixelWidth = width / sprite[0].length;
        const pixelHeight = height / sprite.length;
        const resolve = (c) => this.colorPalette.resolveCssColor(c);

        // Use global overlay settings if not specified
        const finalOverlayColor = resolve(overlayColor || globalOverlayColor);
        const finalOverlayIntensity = overlayIntensity > 0 ? overlayIntensity : globalOverlayIntensity;
        const resolvedLighting = resolve(lightingColor);

        for (let row = 0; row < sprite.length; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                const colorIndex = sprite[row][col];
                let color = this.colorPalette.getColor(colorIndex);

                if (color !== 'transparent') {
                    // Apply lighting effect if present
                    if (lightingIntensity > 0) {
                        color = this.colorPalette.applyLighting(color, lightingIntensity, resolvedLighting);
                    }

                    // Apply color overlay if present
                    if (finalOverlayColor && finalOverlayIntensity > 0) {
                        color = this.colorPalette.applyColorOverlay(color, finalOverlayColor, finalOverlayIntensity);
                    }

                    ctx.fillStyle = color;
                    const left = Math.floor(x + col * pixelWidth);
                    const top = Math.floor(y + row * pixelHeight);
                    const right = Math.ceil(x + (col + 1) * pixelWidth);
                    const bottom = Math.ceil(y + (row + 1) * pixelHeight);
                    ctx.fillRect(left, top, right - left, bottom - top);
                }
            }
        }
    },

    getSprite(name) {
        // First try to get from sprite factory (programmatic sprites)
        let sprite = this.spriteFactory.getSprite(name);

        // If not found, try to get from sprite loader (loaded PNG files)
        if (!sprite && typeof window !== 'undefined' && window.spriteLoader) {
            sprite = window.spriteLoader.getSprite(name);
        }

        return sprite;
    },

    // Global overlay functions
    setOverlayColor(color) {
        globalOverlayColor = color;
    },

    setOverlayIntensity(intensity) {
        globalOverlayIntensity = Math.max(0, Math.min(1, intensity));
    },

    getOverlayColor() {
        return globalOverlayColor;
    },

    getOverlayIntensity() {
        return globalOverlayIntensity;
    },

    // Create Game Boy style background patterns
    createBackgroundPattern(ctx, width, height) {
        // Fill with darkest green
        ctx.fillStyle = this.colorPalette.getPalette().black;
        ctx.fillRect(0, 0, width, height);

        // Add subtle grid pattern
        ctx.fillStyle = this.colorPalette.getPalette().dark;
        for (let x = 0; x < width; x += 8) {
            for (let y = 0; y < height; y += 8) {
                if ((x + y) % 16 === 0) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    },

    updateParticles() {
        this.particleSystem.update();
    },

    renderParticles(ctx) {
        this.particleSystem.render(ctx);
    },

    renderColorOverlay(ctx, width, height) {
        if (!this.colorOverlay.enabled) return;

        // Save context state
        ctx.save();

        // Create additive color overlay
        ctx.globalCompositeOperation = 'screen'; // Additive blending
        ctx.fillStyle = this.colorPalette.resolveCssColor(this.colorOverlay.color);
        ctx.globalAlpha = this.colorOverlay.intensity;
        ctx.fillRect(0, 0, width, height);

        // Restore context state
        ctx.restore();
    },

    createHitEffect(x, y, count = 8, color = null) {
        const fx = color || 'var(--color-highlight)';
        this.particleSystem.createHitParticles(x, y, count, fx);
    },

    clearParticles() {
        this.particleSystem.clear();
    },

    // Delegate lighting methods
    renderLighting(ctx, bullets, obstacles, player, enemy) {
        this.lightingSystem.renderLighting(ctx, bullets, obstacles, player, enemy);
    },
});
