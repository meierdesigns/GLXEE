"use strict";

// Ship Renderer - Centralized ship rendering functionality
class ShipRenderer {
    constructor() {
        this.spriteLoader = null;
        this.colorManager = null;
    }

    // Initialize with dependencies
    init() {
        if (typeof spriteLoader !== 'undefined') {
            this.spriteLoader = spriteLoader;
        }
        if (typeof colorManager !== 'undefined') {
            this.colorManager = colorManager;
        }
    }

    resolveFillStyle(color) {
        if (!color || color === 'transparent') return color;
        if (typeof color === 'string' && color.indexOf('var(') === 0) {
            const match = color.match(/var\(\s*(--[^),\s]+)/);
            if (match) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                if (value) return value;
            }
            if (/secondary|800|700|600/.test(color)) return '#666666';
            if (/400|300|200|100/.test(color)) return '#cccccc';
            return '#999999';
        }
        return color;
    }

    // Render ship preview to canvas
    // fillBoost: >1 zooms the fit-to-canvas scale in past pure "contain" so
    // small decorative previews (e.g. the galaxy map mini canvas) can sit
    // closer to the edges instead of leaving a big margin; wingtips/aft may
    // clip slightly off-canvas at higher values, so it defaults to 1 (no
    // clipping) for editor/full previews that need the whole hull visible.
    renderShipPreview(canvas, ship, scale = 3, fillBoost = 1) {
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Ensure canvas background is transparent
        canvas.style.backgroundColor = 'transparent';
        ctx.imageSmoothingEnabled = false;
        
        // Get color overlay for non-transparent areas only
        let colorOverlay = null;
        let overlayIntensity = 0;
        
        if (this.colorManager) {
            colorOverlay = this.resolveFillStyle(this.colorManager.getCurrentOverlayColor());
            overlayIntensity = this.colorManager.getCurrentOverlayIntensity();
        }

        // Modular ships: fit core + modules into canvas
        if (ship && ship.modular && ship.layout) {
            const loader = (typeof graphicsManager !== 'undefined' && graphicsManager.shipAssetLoader)
                || (typeof shipAssetLoader !== 'undefined' ? shipAssetLoader : null);
            if (loader && loader.renderShip) {
                const shipW = ship.width || 16;
                const shipH = ship.height || 12;
                const fit = Math.min(canvas.width / shipW, canvas.height / shipH) * Math.max(1, fillBoost);
                const rw = shipW * fit;
                const rh = shipH * fit;
                const ox = (canvas.width - rw) / 2;
                const oy = (canvas.height - rh) / 2;
                loader.renderShip(ctx, ship, ox, oy, fit, colorOverlay, overlayIntensity);
                return;
            }
        }
        
        // Check if this is an enemy ship (needs vertical flip)
        const isEnemyShip = this.isEnemyShip(ship);
        
        // Try to use PNG sprite first, fallback to pixel sprite
        const spriteName = this.getSpriteNameForShip(ship);
        const sprite = this.spriteLoader && spriteName ? this.spriteLoader.getSprite(spriteName) : null;
        
        if (sprite) {
            // Use PNG sprite - maintain aspect ratio
            const spriteAspect = sprite.width / sprite.height;
            const canvasAspect = canvas.width / canvas.height;
            
            let renderWidth, renderHeight, offsetX, offsetY;
            
            if (spriteAspect > canvasAspect) {
                // Sprite is wider - fit to width
                renderWidth = canvas.width;
                renderHeight = canvas.width / spriteAspect;
                offsetX = 0;
                offsetY = (canvas.height - renderHeight) / 2;
            } else {
                // Sprite is taller - fit to height
                renderHeight = canvas.height;
                renderWidth = canvas.height * spriteAspect;
                offsetX = (canvas.width - renderWidth) / 2;
                offsetY = 0;
            }
            
            // Ensure transparency is preserved
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            
            // Apply vertical flip for enemy ships
            if (isEnemyShip) {
                ctx.save();
                ctx.translate(offsetX + renderWidth / 2, offsetY + renderHeight / 2);
                ctx.scale(1, -1); // Vertical flip
                ctx.translate(-renderWidth / 2, -renderHeight / 2);
                this.spriteLoader.renderSprite(ctx, spriteName, 0, 0, renderWidth, renderHeight, colorOverlay, overlayIntensity);
                ctx.restore();
            } else {
                this.spriteLoader.renderSprite(ctx, spriteName, offsetX, offsetY, renderWidth, renderHeight, colorOverlay, overlayIntensity);
            }
        } else {
            // Fallback to pixel sprite - center and scale to fit
            const shipW = ship.width || (ship.sprite && ship.sprite[0] && ship.sprite[0].length) || 16;
            const shipH = ship.height || (ship.sprite && ship.sprite.length) || 12;
            const maxScale = Math.min(canvas.width / shipW, canvas.height / shipH);
            const scaledWidth = shipW * maxScale;
            const scaledHeight = shipH * maxScale;
            const centerX = (canvas.width - scaledWidth) / 2;
            const centerY = (canvas.height - scaledHeight) / 2;
            this.renderPixelShip(ctx, ship, centerX, centerY, maxScale, colorOverlay, overlayIntensity, isEnemyShip);
        }
    }

    // Render pixel-based ship (fallback)
    renderPixelShip(ctx, ship, offsetX, offsetY, scale, colorOverlay, overlayIntensity, isEnemyShip = false) {
        const sprite = ship.sprite;
        const colors = ship.colors || {};
        if (!sprite || !sprite.length) return;

        const cols = sprite[0].length;
        const rows = sprite.length;
        const destW = (ship.width || cols) * scale;
        const destH = (ship.height || rows) * scale;
        const pw = destW / Math.max(1, cols);
        const ph = destH / Math.max(1, rows);

        const tint = (base) => {
            if (!colorOverlay || !(overlayIntensity > 0)) return base;
            if (typeof colorPalette !== 'undefined' && colorPalette.applyColorOverlay) {
                return colorPalette.applyColorOverlay(base, colorOverlay, overlayIntensity);
            }
            return base;
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        if (isEnemyShip) {
            ctx.translate(offsetX + destW / 2, offsetY + destH / 2);
            ctx.scale(1, -1);
            ctx.translate(-(offsetX + destW / 2), -(offsetY + destH / 2));
        }

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                const pixel = sprite[row][col];
                if (!pixel) continue;
                ctx.fillStyle = tint(this.resolveFillStyle(colors[pixel] || '#888888'));
                ctx.fillRect(
                    offsetX + col * pw,
                    offsetY + row * ph,
                    Math.ceil(pw),
                    Math.ceil(ph)
                );
            }
        }

        ctx.restore();

        // Engine glow — flip with ship so aft stays aft after orientation
        if (ship.engineGlow && ship.engineGlow.positions) {
            ctx.save();
            if (isEnemyShip) {
                ctx.translate(offsetX + destW / 2, offsetY + destH / 2);
                ctx.scale(1, -1);
                ctx.translate(-(offsetX + destW / 2), -(offsetY + destH / 2));
            }
            ship.engineGlow.positions.forEach((pos) => {
                ctx.globalAlpha = (pos.intensity || 0.6) * 0.8;
                ctx.fillStyle = pos.color || ship.engineGlow.color || '#9ab0c0';
                ctx.fillRect(
                    offsetX + pos.x * pw,
                    offsetY + pos.y * ph,
                    Math.ceil(pw),
                    Math.ceil(ph)
                );
            });
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    }

    // Check if ship is an enemy ship
    isEnemyShip(ship) {
        if (!ship) return false;
        if (ship.forceEnemyOrientation) return true;

        // Check by sprite name patterns
        const spriteName = this.getSpriteNameForShip(ship);
        if (spriteName) {
            return spriteName.includes('enemy-') || spriteName.includes('enemy_');
        }
        
        // Check by ship type/name patterns
        const shipName = ship.name ? ship.name.toLowerCase() : '';
        return shipName.includes('enemy') || shipName.includes('fighter') || 
               shipName.includes('battleship') || shipName.includes('cruiser') ||
               shipName.includes('interceptor') || shipName.includes('scout') ||
               shipName.includes('destroyer') || shipName.includes('carrier') ||
               shipName.includes('frigate') || shipName.includes('corvette') ||
               shipName.includes('gunship') || shipName.includes('dreadnought') ||
               shipName.includes('bomber') || shipName.includes('stealth');
    }

    // Get sprite name for ship
    getSpriteNameForShip(ship) {
        if (!ship) return null;
        
        const type = ship.type;
        const modelClass = ship.modelClass;
        
        if (type === 'player') {
            switch (modelClass) {
                case 'starfighter': return 'player-starfighter';
                case 'heavy_fighter': return 'player-heavy-fighter';
                case 'assault': return 'player-assault';
                case 'interceptor': return 'player-interceptor';
                case 'bomber': return 'player-bomber';
                case 'stealth': return 'player-stealth';
                default: return 'player-starfighter';
            }
        } else if (type === 'enemy') {
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
}

// Global ship renderer instance
let shipRenderer = new ShipRenderer();
