"use strict";

// Rendering and display management
class CoreRenderManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.canvas = null;
        this.ctx = null;
        this.width = 240;
        this.height = 300;
        this.scale = 1.0;
        this.minScale = 0.5;
        this.maxScale = 3.0;
        this.scaleStep = 0.1;
        this._manualScale = false;
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Game canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Could not get 2D context');
            return;
        }
        this.ctx.imageSmoothingEnabled = false;
        
        // Set canvas size
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
    }

    setPlayfieldSize(width, height) {
        const w = Math.max(80, Math.round(Number(width) || 240));
        const h = Math.max(100, Math.round(Number(height) || 300));
        this.width = w;
        this.height = h;
        if (this.gameState) {
            this.gameState.width = w;
            this.gameState.height = h;
        }
        if (this.canvas) {
            if (this.canvas.width !== w) this.canvas.width = w;
            if (this.canvas.height !== h) this.canvas.height = h;
            if (this.ctx) this.ctx.imageSmoothingEnabled = false;
        }
    }

    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Render game elements
        this.renderGameElements();
        
        // Render UI overlays
        this.renderUIOverlays();
    }

    renderGameElements() {
        // Render background
        this.renderBackground();
        
        // Render parallax background
        if (typeof parallaxManager !== 'undefined' && this.ctx) {
            parallaxManager.render(this.ctx);
        }
        
        // Render game objects
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.render(this.ctx);
        }
    }

    resolveFill(color) {
        try {
            if (typeof color === 'string' && color.indexOf('var(') === 0) {
                const match = color.match(/var\(\s*(--[^),\s]+)/);
                if (match) {
                    const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                    if (value) return value;
                }
                return '#e0e0e0';
            }
        } catch (e) {
            // ignore
        }
        return color;
    }

    renderBackground() {
        // Simple background
        this.ctx.fillStyle = this.resolveFill('var(--current-background)');
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add some stars
        this.ctx.fillStyle = this.resolveFill('var(--current-text)');
        for (let i = 0; i < 50; i++) {
            const x = (i * 7) % this.width;
            const y = (i * 11) % this.height;
            this.ctx.fillRect(x, y, 1, 1);
        }
    }

    renderUIOverlays() {
        // Render pause overlay
        if (this.gameState.isPaused) {
            this.renderPauseOverlay();
        }
        
        // Render cheat menu
        if (typeof cheatSystem !== 'undefined' && cheatSystem.cheatMenuVisible) {
            this.renderCheatMenu();
        }
        
        // Render level select
        if (typeof cheatSystem !== 'undefined' && cheatSystem.levelSelectVisible) {
            this.renderLevelSelect();
        }
    }

    renderPauseOverlay() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Pause text
        this.ctx.fillStyle = this.resolveFill('var(--current-text)');
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.width / 2, this.height / 2 - 20);
        
        // Instructions
        this.ctx.font = '12px Courier New';
        this.ctx.fillText('Press ESC to resume', this.width / 2, this.height / 2 + 10);
    }

    renderCheatMenu() {
        if (typeof cheatSystem === 'undefined') return;
        
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Menu title
        this.ctx.fillStyle = this.resolveFill('var(--status-success)');
        this.ctx.font = '14px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('CHEAT MENU', this.width / 2, 30);
        
        // Menu items
        this.ctx.font = '12px Courier New';
        cheatSystem.cheatMenuItems.forEach((item, index) => {
            if (index === cheatSystem.cheatMenuIndex) {
                this.ctx.fillStyle = this.resolveFill('var(--status-warning)');
                this.ctx.fillText('▶ ' + item, this.width / 2, 50 + index * 20);
            } else {
                this.ctx.fillStyle = this.resolveFill('var(--current-text)');
                this.ctx.fillText(item, this.width / 2, 50 + index * 20);
            }
            
            // Show cheat status
            if (index < cheatSystem.cheatMenuItems.length - 1) { // Not for CLOSE
                const cheatKey = Object.keys(cheatSystem.cheats)[index];
                const status = cheatSystem.cheats[cheatKey] ? 'ON' : 'OFF';
                this.ctx.fillStyle = this.resolveFill(cheatSystem.cheats[cheatKey] ? 'var(--status-success)' : 'var(--status-error)');
                this.ctx.fillText(status, this.width / 2 + 80, 50 + index * 20);
            }
        });
        
        // Instructions
        this.ctx.fillStyle = this.resolveFill('var(--current-text-secondary)');
        this.ctx.font = '10px Courier New';
        this.ctx.fillText('Arrow keys: Navigate | Enter: Select | ESC: Close', this.width / 2, this.height - 20);
    }

    renderLevelSelect() {
        if (typeof cheatSystem === 'undefined') return;
        
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Menu title
        this.ctx.fillStyle = this.resolveFill('var(--status-success)');
        this.ctx.font = '14px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEVEL SELECT', this.width / 2, 30);
        
        // Level list
        this.ctx.font = '12px Courier New';
        cheatSystem.availableLevels.forEach((level, index) => {
            if (index === cheatSystem.levelSelectIndex) {
                this.ctx.fillStyle = this.resolveFill('var(--status-warning)');
                this.ctx.fillText('▶ ' + level.name, this.width / 2, 50 + index * 20);
            } else {
                this.ctx.fillStyle = this.resolveFill('var(--current-text)');
                this.ctx.fillText(level.name, this.width / 2, 50 + index * 20);
            }
            
            // Show difficulty
            this.ctx.fillStyle = this.resolveFill(cheatSystem.getDifficultyColor(level.difficulty));
            this.ctx.fillText(level.difficulty, this.width / 2 + 80, 50 + index * 20);
        });
        
        // Instructions
        this.ctx.fillStyle = this.resolveFill('var(--current-text-secondary)');
        this.ctx.font = '10px Courier New';
        this.ctx.fillText('Arrow keys: Navigate | Enter: Select | ESC: Close', this.width / 2, this.height - 20);
    }

    increaseScale() {
        // Locked: playfield always shows the full map; no mid-mission zoom.
        if (typeof menuStateManager !== 'undefined'
            && menuStateManager.getScreen
            && menuStateManager.getScreen() === 'ingame') {
            return;
        }
        this._manualScale = true;
        this.scale = Math.min(this.scale + this.scaleStep, this.maxScale);
        this.applyScale();
    }

    decreaseScale() {
        if (typeof menuStateManager !== 'undefined'
            && menuStateManager.getScreen
            && menuStateManager.getScreen() === 'ingame') {
            return;
        }
        this._manualScale = true;
        this.scale = Math.max(this.scale - this.scaleStep, this.minScale);
        this.applyScale();
    }

    applyScale() {
        if (!this.canvas) return;
        
        // Display size is driven by CSS viewport fit; keep transform neutral
        // unless user manually overrides scale away from auto.
        if (this._manualScale) {
            this.canvas.style.transform = `scale(${this.scale})`;
            this.canvas.style.transformOrigin = 'center';
        } else {
            this.canvas.style.transform = '';
            this.canvas.style.transformOrigin = 'center';
        }
    }

    syncViewportScale(gameScale) {
        if (this._manualScale) return;
        this.scale = gameScale || 1;
    }

    getScale() {
        return this.scale;
    }

    setScale(scale) {
        this._manualScale = true;
        this.scale = Math.max(this.minScale, Math.min(scale, this.maxScale));
        this.applyScale();
    }
}