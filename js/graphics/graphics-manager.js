"use strict";

/**
 * Main Graphics Manager - coordinates all graphics subsystems
 */

// Global color overlay settings
let globalOverlayColor = 'var(--current-text-secondary)'; // Default gray
let globalOverlayIntensity = 0.3; // Default intensity

class GraphicsManager {
    constructor() {
        this.particleSystem = new ParticleSystem();
        this.spriteFactory = new SpriteFactory();
        this.colorPalette = new ColorPalette();
        this.lightingSystem = new LightingSystem();
        
        this.colorOverlay = {
            enabled: false,
            color: 'var(--current-primary)',
            intensity: 0.3
        };
        
        this.shipModels = null;
        this.currentPlayerModel = null;
        this.currentEnemyModel = null;
        this.shipAssetLoader = null;
        this._shieldHullCache = Object.create(null);
        this._shieldSilhouetteBake = false;
        
        this.init();
    }

    init() {
        // Initialize ship models
        this.shipModels = shipModels;
        
        if (this.shipModels) {
            this.currentPlayerModel = this.shipModels.getShipModel('player');
            this.currentEnemyModel = this.shipModels.getShipModel('enemyBasic');
        } else {
            console.error('ShipModels not available!');
        }
        
        // Initialize sprite factory
        this.spriteFactory.init();
        
        // Initialize ship asset loader
        this.initializeShipAssets();
        
        // Wait for sprite loader to be ready
        this.waitForSpriteLoader();
    }
    
    waitForSpriteLoader() {
        if (typeof window === 'undefined' || !window.spriteLoader || window.spriteLoader.loaded) {
            return;
        }
        const checkInterval = setInterval(() => {
            if (window.spriteLoader && window.spriteLoader.loaded) {
                clearInterval(checkInterval);
            }
        }, 100);
    }
    
    setOverlayColor(color) {
        // Deprecated: Use ColorManager HSL system instead
        console.warn('setOverlayColor is deprecated, use ColorManager HSL system instead');
    }
    
    setOverlayIntensity(intensity) {
        // Deprecated: Use ColorManager HSL system instead
        console.warn('setOverlayIntensity is deprecated, use ColorManager HSL system instead');
    }

    // Initialize ship assets
    async initializeShipAssets() {
        try {
            // Import ship asset loader
            const { shipAssetLoader } = await import('../../assets/ships/ship-asset-loader.js');
            this.shipAssetLoader = shipAssetLoader;
            
            // Load all ship assets
            await this.shipAssetLoader.loadAllShips();
            
            // Set default models from assets
            this.currentPlayerModel = this.shipAssetLoader.getShip('player');
            this.currentEnemyModel = this.shipAssetLoader.getShip('enemyBasic');

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('vf-ships-loaded'));
            }
            
        } catch (error) {
            console.error('Failed to initialize ship assets:', error);
            // Fallback to old ship models
            this.currentPlayerModel = this.shipModels.getShipModel('player');
            this.currentEnemyModel = this.shipModels.getShipModel('enemyBasic');
        }
    }

    // Render ship models instead of simple sprites
    renderPlayerShip(ctx, player, scale = 1) {
        if (!this.currentPlayerModel || !player) {
            return;
        }

        const model = this.currentPlayerModel;
        const mw = Math.max(1, model.width || player.width || 1);
        const mh = Math.max(1, model.height || player.height || 1);
        // Fit visual to entity footprint so contentScale stays consistent.
        const fit = Math.min(player.width / mw, player.height / mh);
        const drawScale = Math.max(0.25, (scale || 1) * fit);
        const x = player.x - (mw * drawScale - player.width) / 2;
        const y = player.y - (mh * drawScale - player.height) / 2;
        
        // Get current color overlay from color manager
        let colorOverlay = null;
        let overlayIntensity = 0;
        
        if (typeof colorManager !== 'undefined') {
            colorOverlay = colorManager.getCurrentOverlayColor();
            overlayIntensity = colorManager.getCurrentOverlayIntensity();
        }
        
        // Use asset loader if available, otherwise fallback to old system
        if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
            this.shipAssetLoader.renderShip(ctx, model, x, y, drawScale, colorOverlay, overlayIntensity);
        } else {
            this.shipModels.renderShip(ctx, model, x, y, drawScale, colorOverlay, overlayIntensity);
        }
    }
    
    renderEnemyShip(ctx, enemy, scale = 1) {
        if (!enemy) return;

        let visual = null;
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.resolveFactionShipVisual) {
            visual = factionShipStyles.resolveFactionShipVisual({
                faction: enemy.faction,
                enemyClass: enemy.enemyClass,
                tier: enemy.tier,
                level: enemy.level,
                typeId: enemy.type,
                width: enemy.width,
                height: enemy.height
            });
        }

        let enemyModel = visual && visual.model ? visual.model : null;
        if (!enemyModel) {
            enemyModel = this.currentEnemyModel;
        }
        if (!enemyModel) {
            if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
                enemyModel = this.shipAssetLoader.getShip('enemyBasic');
            } else if (this.shipModels) {
                enemyModel = this.shipModels.getShipModel('enemyBasic');
            }
        }

        if (!enemyModel) {
            ctx.fillStyle = (this.colorPalette && this.colorPalette.resolveCssColor)
                ? (this.colorPalette.resolveCssColor('var(--color-error)') || '#ff4444')
                : '#ff4444';
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            return;
        }

        const mw = Math.max(1, enemyModel.width || enemy.width || 1);
        const mh = Math.max(1, enemyModel.height || enemy.height || 1);
        // Entity footprint is authoritative (includes tier + contentScale).
        const finalScale = Math.max(0.25, Math.min(enemy.width / mw, enemy.height / mh) * (scale || 1));
        const x = enemy.x - (mw * finalScale - enemy.width) / 2;
        const y = enemy.y - (mh * finalScale - enemy.height) / 2;

        // Faction ships carry their own hull/edge/accent — do not wash with theme overlay
        let colorOverlay = null;
        let overlayIntensity = 0;
        if (!visual && typeof colorManager !== 'undefined') {
            colorOverlay = colorManager.getCurrentOverlayColor();
            overlayIntensity = colorManager.getCurrentOverlayIntensity();
        }

        if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
            this.shipAssetLoader.renderShip(ctx, enemyModel, x, y, finalScale, colorOverlay, overlayIntensity);
        } else if (this.shipModels) {
            this.shipModels.renderShip(ctx, enemyModel, x, y, finalScale, colorOverlay, overlayIntensity);
        }

    }
    
    // Set enemy ship type based on level or difficulty
    setEnemyShipType(type) {
        let model = null;
        const hullId = (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getHullId)
            ? enemyConfigManager.getHullId(type)
            : type;
        if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
            model = this.shipAssetLoader.getShip(hullId);
        } else {
            model = this.shipModels.getShipModel(hullId);
        }
        if (typeof enemyConfigManager !== 'undefined' && model) {
            model = enemyConfigManager.applyOverridesToModel(type, model);
        } else if (model) {
            model = Object.assign({}, model, { forceEnemyOrientation: true });
        }
        this.currentEnemyModel = model;
    }
    
    // Set player ship model
    setPlayerShipModel(shipModel) {
        this.currentPlayerModel = shipModel;
        this._shieldHullCache = Object.create(null);
        
        // Update player manager with ship model
        if (typeof playerManager !== 'undefined') {
            playerManager.setShipModel(shipModel);
        }
        
        // Update weapon system with ship model
        if (typeof bulletManager !== 'undefined') {
            bulletManager.setShipModel(shipModel);
        }
    }

    /**
     * Stable signature of modular layout so loadout swaps invalidate the rim cache.
     */
    getShieldLayoutSignature(shipModel) {
        if (!shipModel || !shipModel.layout) {
            return 'n|' + Math.round(shipModel && shipModel.width || 0)
                + 'x' + Math.round(shipModel && shipModel.height || 0);
        }
        const L = shipModel.layout;
        const mods = Array.isArray(L.modules) ? L.modules : [];
        const ids = mods.map((m) => String((m && m.id) || '')).filter(Boolean).sort();
        return (L.moduleCount != null ? L.moduleCount : mods.length)
            + '|' + Math.round(L.width || shipModel.width || 0)
            + 'x' + Math.round(L.height || shipModel.height || 0)
            + '|' + ids.join(',');
    }

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
    }
    
    // Get available enemy ship types
    getAvailableEnemyShips() {
        if (this.shipAssetLoader && this.shipAssetLoader.isLoaded()) {
            return this.shipAssetLoader.getEnemyShips();
        } else {
            return this.shipModels.getAvailableShips().filter(type => type.startsWith('enemy'));
        }
    }

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
    }

    getSprite(name) {
        // First try to get from sprite factory (programmatic sprites)
        let sprite = this.spriteFactory.getSprite(name);
        
        // If not found, try to get from sprite loader (loaded PNG files)
        if (!sprite && typeof window !== 'undefined' && window.spriteLoader) {
            sprite = window.spriteLoader.getSprite(name);
        }
        
        return sprite;
    }

    // Global overlay functions
    setOverlayColor(color) {
        globalOverlayColor = color;
    }

    setOverlayIntensity(intensity) {
        globalOverlayIntensity = Math.max(0, Math.min(1, intensity));
    }

    getOverlayColor() {
        return globalOverlayColor;
    }

    getOverlayIntensity() {
        return globalOverlayIntensity;
    }

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
    }

    updateParticles() {
        this.particleSystem.update();
    }

    renderParticles(ctx) {
        this.particleSystem.render(ctx);
    }
    
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
    }

    createHitEffect(x, y, count = 8, color = null) {
        const fx = color || 'var(--color-highlight)';
        this.particleSystem.createHitParticles(x, y, count, fx);
    }

    clearParticles() {
        this.particleSystem.clear();
    }

    // Delegate lighting methods
    renderLighting(ctx, bullets, obstacles, player, enemy) {
        this.lightingSystem.renderLighting(ctx, bullets, obstacles, player, enemy);
    }
}

// Global graphics manager instance
let graphicsManager;
// GraphicsManager will be instantiated by core.js
