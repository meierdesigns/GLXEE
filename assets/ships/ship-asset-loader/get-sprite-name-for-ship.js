"use strict";

import { ShipAssetLoader } from './core.js';

// ShipAssetLoader methods, split from ship-asset-loader.js.
extendClass(ShipAssetLoader, {
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
    },

    tintPixelColor(baseColor, colorOverlay, overlayIntensity) {
        if (!colorOverlay || !(overlayIntensity > 0)) return baseColor;
        if (typeof colorPalette !== 'undefined' && colorPalette.applyColorOverlay) {
            return colorPalette.applyColorOverlay(baseColor, colorOverlay, overlayIntensity);
        }
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.applyColorOverlay) {
            return colorPaletteSystem.applyColorOverlay(baseColor, colorOverlay, overlayIntensity);
        }
        return baseColor;
    },

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
    },

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
    },
});
