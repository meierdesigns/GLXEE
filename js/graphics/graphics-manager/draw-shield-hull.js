"use strict";

// GraphicsManager methods, split from graphics-manager.js.
extendClass(GraphicsManager, {
    /**
     * Draw an energy-shield outline that follows the ship silhouette.
     * Leaves a few pixels of gap around the hull; color follows --current-primary.
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} entity - { x, y, width, height }
     * @param {number} ratio - visibility 0..1 (proximity fade × shield strength)
     * @param {boolean} [flip] - enemy orientation
     * @param {object} [model] - optional ship model override
     * @param {object} [opts] - optional { thick, pulse }
     */
    drawShieldHull(ctx, entity, ratio, flip = false, model = null, opts = null) {
        if (!ctx || !entity || !(ratio > 0.01)) return;
        const gap = 3;       // freiraum between hull and shield rim
        const thick = Math.max(2, Math.round((opts && opts.thick) || 2));
        const pulse = (opts && opts.pulse != null) ? opts.pulse : 1;
        const maxR = gap + thick;
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
        const padX = gap + thick + 1 + overX + bleed;
        const padY = gap + thick + 1 + overY + bleed;
        const w = ew + padX * 2;
        const h = eh + padY * 2;
        const modelId = (shipModel && (shipModel.id || shipModel.name)) || 'ship';
        const layoutSig = this.getShieldLayoutSignature(shipModel);
        const cacheKey = modelId + '|' + ew + 'x' + eh + '|g' + gap + 't' + thick
            + '|p' + padX + 'x' + padY + '|' + (flip ? 1 : 0) + '|' + layoutSig;

        let rim = this._shieldHullCache[cacheKey];
        if (!rim) {
            const off = document.createElement('canvas');
            off.width = w;
            off.height = h;
            const octx = off.getContext('2d');
            if (!octx) return;
            octx.imageSmoothingEnabled = false;

            const ghost = { x: padX, y: padY, width: entity.width, height: entity.height };
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
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (opaque(x, y)) continue;
                    let minCheb = maxR + 1;
                    for (let dy = -maxR; dy <= maxR; dy++) {
                        for (let dx = -maxR; dx <= maxR; dx++) {
                            if (!opaque(x + dx, y + dy)) continue;
                            const cheb = Math.max(Math.abs(dx), Math.abs(dy));
                            if (cheb < minCheb) minCheb = cheb;
                        }
                    }
                    // Ring outside the gap band — empty pixels between hull and rim
                    if (minCheb <= gap || minCheb > maxR) continue;
                    const i = (y * w + x) * 4;
                    od[i] = 255;
                    od[i + 1] = 255;
                    od[i + 2] = 255;
                    od[i + 3] = 255;
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
