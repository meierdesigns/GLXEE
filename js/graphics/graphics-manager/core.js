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
        this._playerModelExplicitlySelected = false;

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
            const { shipAssetLoader } = await import('../../../assets/ships/ship-asset-loader.js');
            this.shipAssetLoader = shipAssetLoader;

            // Load all ship assets
            await this.shipAssetLoader.loadAllShips();

            // Keep the loadout model selected by the hangar while assets load.
            // Replacing it here silently reset the in-game ship to the default hull.
            if (!this._playerModelExplicitlySelected) {
                this.currentPlayerModel = this.shipAssetLoader.getShip('player');
            }
            this.currentEnemyModel = this.shipAssetLoader.getShip('enemyBasic');

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('vf-ships-loaded'));
            }

        } catch (error) {
            console.error('Failed to initialize ship assets:', error);
            // Fallback to old ship models
            if (!this._playerModelExplicitlySelected) {
                this.currentPlayerModel = this.shipModels.getShipModel('player');
            }
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
            this.shipAssetLoader.renderShip(
                ctx,
                model,
                x,
                y,
                drawScale,
                colorOverlay,
                overlayIntensity,
                {
                    showThrusterGlow: true,
                    allowColorMountSprites: true
                }
            );
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
        this._playerModelExplicitlySelected = true;
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
}
