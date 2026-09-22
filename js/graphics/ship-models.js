"use strict";

// Ship Models - Detailed pixel art ships for player and enemies
class ShipModels {
    constructor() {
        this.models = {
            player: this.createPlayerShip(),
            enemyBasic: this.createEnemyBasicShip(),
            enemyFast: this.createEnemyFastShip(),
            enemyHeavy: this.createEnemyHeavyShip(),
            enemyBoss: this.createEnemyBossShip()
        };
    }

    createPlayerShip() {
        // 20x16 detailed player spaceship - sleek fighter design
        return {
            name: "Player Fighter",
            width: 20,
            height: 16,
            sprite: [
                [0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0]
            ],
            colors: {
                0: 'transparent',
                1: '#404040',  // Dark gray
                2: '#808080',  // Medium gray
                3: '#C0C0C0'   // Light gray
            },
            engineGlow: {
                positions: [
                    {x: 8, y: 15, intensity: 0.8},
                    {x: 9, y: 15, intensity: 0.8},
                    {x: 10, y: 15, intensity: 0.8},
                    {x: 11, y: 15, intensity: 0.8}
                ],
                color: '#FFFFFF'
            }
        };
    }

    createEnemyBasicShip() {
        // 18x14 basic enemy fighter - angular design
        return {
            name: "Basic Enemy Fighter",
            width: 18,
            height: 14,
            sprite: [
                [0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0]
            ],
            colors: {
                0: 'transparent',
                1: '#404040',  // Dark gray
                2: '#808080',  // Medium gray
                3: '#C0C0C0'   // Light gray
            },
            engineGlow: {
                positions: [
                    {x: 7, y: 13, intensity: 0.6},
                    {x: 8, y: 13, intensity: 0.6},
                    {x: 9, y: 13, intensity: 0.6},
                    {x: 10, y: 13, intensity: 0.6}
                ],
                color: '#FFFFFF'
            }
        };
    }

    createEnemyFastShip() {
        // 16x12 fast enemy interceptor - sleek and narrow
        return {
            name: "Fast Enemy Interceptor",
            width: 16,
            height: 12,
            sprite: [
                [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0]
            ],
            colors: {
                0: 'transparent',
                1: '#4B0082',  // Indigo
                2: '#8A2BE2',  // Blue violet
                3: '#9370DB'   // Medium purple
            },
            engineGlow: {
                positions: [
                    {x: 6, y: 11, intensity: 0.7},
                    {x: 7, y: 11, intensity: 0.7},
                    {x: 8, y: 11, intensity: 0.7},
                    {x: 9, y: 11, intensity: 0.7}
                ],
                color: '#00FFFF'
            }
        };
    }

    createEnemyHeavyShip() {
        // 22x18 heavy enemy cruiser - bulky and armored
        return {
            name: "Heavy Enemy Cruiser",
            width: 22,
            height: 18,
            sprite: [
                [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0]
            ],
            colors: {
                0: 'transparent',
                1: '#2F4F4F',  // Dark slate gray
                2: '#708090',  // Slate gray
                3: '#A9A9A9'   // Dark gray
            },
            engineGlow: {
                positions: [
                    {x: 9, y: 17, intensity: 0.5},
                    {x: 10, y: 17, intensity: 0.5},
                    {x: 11, y: 17, intensity: 0.5},
                    {x: 12, y: 17, intensity: 0.5}
                ],
                color: '#FFD700'
            }
        };
    }

    createEnemyBossShip() {
        // 28x24 boss enemy battleship - massive and intimidating
        return {
            name: "Boss Enemy Battleship",
            width: 26,
            height: 20,
            sprite: [
                [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
                [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
                [0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
                [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
                [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0],
                [0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0]
            ],
            colors: {
                0: 'transparent',
                1: '#404040',  // Dark gray
                2: '#808080',  // Medium gray
                3: '#C0C0C0'   // Light gray
            },
            engineGlow: {
                positions: [
                    {x: 11, y: 23, intensity: 0.9},
                    {x: 12, y: 23, intensity: 0.9},
                    {x: 13, y: 23, intensity: 0.9},
                    {x: 14, y: 23, intensity: 0.9},
                    {x: 10, y: 22, intensity: 0.6},
                    {x: 15, y: 22, intensity: 0.6}
                ],
                color: '#FFFFFF'
            }
        };
    }

    // Get ship model by type
    getShipModel(type) {
        return this.models[type] || this.models.player;
    }

    // Get all available ship types
    getAvailableShips() {
        return Object.keys(this.models);
    }

    // Render ship sprite to canvas with color overlay support
    renderShip(ctx, shipModel, x, y, scale = 1, colorOverlay = null, overlayIntensity = 0) {
        const sprite = shipModel.sprite;
        const colors = shipModel.colors || {};
        if (!sprite || !sprite.length) return;

        const cols = sprite[0].length;
        const rows = sprite.length;
        const destW = shipModel.width * scale;
        const destH = shipModel.height * scale;
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

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                const pixel = sprite[row][col];
                if (!pixel) continue;
                ctx.fillStyle = tint(colors[pixel] || '#888888');
                ctx.fillRect(
                    x + col * pw,
                    y + row * ph,
                    Math.ceil(pw),
                    Math.ceil(ph)
                );
            }
        }

        ctx.restore();

        if (shipModel.engineGlow) {
            this.renderEngineGlow(ctx, shipModel.engineGlow, x, y, scale, pw, ph);
        }
    }

    // Render engine glow effect
    renderEngineGlow(ctx, engineGlow, x, y, scale, cellW = null, cellH = null) {
        if (!engineGlow || !engineGlow.positions) return;
        const originalAlpha = ctx.globalAlpha;
        const cw = cellW != null ? cellW : scale;
        const ch = cellH != null ? cellH : scale;

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

        ctx.globalAlpha = originalAlpha;
    }
}

// Create global instance
const shipModels = new ShipModels();
