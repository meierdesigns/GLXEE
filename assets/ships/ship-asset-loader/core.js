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
            const { playerStarfighterModel } = await import('../player-starfighter-model.js');
            const { playerInterceptorModel } = await import('../player-interceptor-model.js');
            const { playerHeavyFighterModel } = await import('../player-heavy-fighter-model.js');
            const { playerAssaultModel } = await import('../player-assault-model.js');
            const { scoutModel } = await import('../scout-model.js');
            const { fighterModel } = await import('../fighter-model.js');
            const { interceptorModel } = await import('../interceptor-model.js');
            const { cruiserModel } = await import('../cruiser-model.js');
            const { battleshipModel } = await import('../battleship-model.js');

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
}

export { ShipAssetLoader };
