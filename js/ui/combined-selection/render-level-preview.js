"use strict";

// CombinedSelectionManager methods, split from combined-selection.js.
extendClass(CombinedSelectionManager, {
    // Render individual level preview
    renderLevelPreview(canvas, level, scale = 3) {
        const ctx = canvas.getContext('2d');

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set canvas background to transparent
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Get current color overlay from color manager
        let colorOverlay = null;
        let overlayIntensity = 0;

        if (typeof colorManager !== 'undefined') {
            colorOverlay = colorManager.getCurrentOverlayColor();
            overlayIntensity = colorManager.getCurrentOverlayIntensity();
        }

        // Save context for locked level effects
        ctx.save();

        // Apply locked level effects
        if (!level.unlocked) {
            ctx.globalAlpha = 0.3;
            ctx.filter = 'grayscale(100%)';
        }

        // Try to use PNG sprite first, fallback to text rendering
        const spriteName = this.getSpriteNameForLevel(level);

        if (typeof spriteLoader !== 'undefined' && spriteLoader.getSprite(spriteName)) {
            // Use PNG sprite - maintain aspect ratio
            const sprite = spriteLoader.getSprite(spriteName);
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

            spriteLoader.renderSprite(ctx, spriteName, offsetX, offsetY, renderWidth, renderHeight, colorOverlay, overlayIntensity);
        } else {
            // Fallback to text rendering
            this.renderLevelText(ctx, level, canvas.width, canvas.height, colorOverlay, overlayIntensity);
        }

        // Restore context
        ctx.restore();

        // Add lock icon for locked levels
        if (!level.unlocked) {
            this.renderLockIcon(ctx, canvas.width, canvas.height);
        }
    },

    // Get sprite name for level
    getSpriteNameForLevel(level) {
        if (!level) return null;

        const name = level.name.toLowerCase();
        switch (name) {
            case 'mars': return 'mars-surface';
            case 'jupiter': return 'jupiter-atmosphere';
            case 'saturn': return 'saturn-rings';
            case 'neptune': return 'neptune-storm';
            case 'pluto': return 'pluto-surface';
            default: return null;
        }
    },

    // Render level text (fallback)
    renderLevelText(ctx, level, width, height, colorOverlay, overlayIntensity) {
        // Save current context state
        ctx.save();

        // Reset composite operation for normal rendering
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Set text properties
        ctx.fillStyle = (typeof colorManager !== 'undefined' && colorManager.currentColors)
            ? colorManager.currentColors.text
            : (getComputedStyle(document.documentElement).getPropertyValue('--current-text').trim() || '#e0e0e0');
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw level initial
        const initial = level.name.charAt(0);
        ctx.fillText(initial, width / 2, height / 2);

        // Restore context state
        ctx.restore();
    },

    // Render lock icon for locked levels
    renderLockIcon(ctx, width, height) {
        ctx.save();

        // Set lock icon properties
        ctx.fillStyle = (typeof colorManager !== 'undefined' && colorManager.currentColors)
            ? colorManager.currentColors.textSecondary
            : (getComputedStyle(document.documentElement).getPropertyValue('--current-text-secondary').trim() || '#a0a0a0');
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 5;

        // Draw lock icon
        ctx.fillText('🔒', width / 2, height / 2);

        ctx.restore();
    },

    // Render individual ship preview
    renderShipPreview(canvas, ship, scale = 3) {
        if (typeof shipRenderer !== 'undefined') {
            shipRenderer.renderShipPreview(canvas, ship, scale);
        } else {
            console.warn('ShipRenderer not available, using fallback rendering');
        }
    },

    // Add event listeners
    addEventListeners() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => this.handleKeyDown(e);

        // Tab switching
        const tabButtons = this.overlay.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchTab(button.dataset.tab);
            });
        });

        // Level belt mouse select
        this.overlay.querySelectorAll('.level-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                const level = this.levels[index];
                if (!level || !level.unlocked) return;
                this.currentSelection = 'level';
                this.selectedLevelIndex = index;
                this.switchTab('level');
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                const level = this.levels[index];
                if (!level || !level.unlocked) return;
                this.selectedLevelIndex = index;
                this.startGame();
            });
        });

        // Ship belt mouse select
        this.overlay.querySelectorAll('.ship-belt-item').forEach((item) => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.currentSelection = 'ship';
                this.selectedShipIndex = index;
                this.switchTab('ship');
                this.updateSelection();
            });
            item.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const index = Number(item.dataset.index);
                if (Number.isNaN(index)) return;
                this.selectedShipIndex = index;
                this.startGame();
            });
        });

        const startBtn = this.overlay.querySelector('#csStart');
        const cancelBtn = this.overlay.querySelector('#csCancel');
        if (startBtn) startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.startGame();
        });
        if (cancelBtn) cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelSelection();
        });

        document.addEventListener('keydown', this._keyHandler);

        // Listen for HSL color changes to refresh ship previews
        if (typeof colorManager !== 'undefined' && colorManager.setHSL && !this._hslHooked) {
            this._hslHooked = true;
            const originalSetHSL = colorManager.setHSL.bind(colorManager);
            colorManager.setHSL = (hue, saturation, lightness) => {
                originalSetHSL(hue, saturation, lightness);
                if (this.isVisible) {
                    this.renderShipPreviews();
                }
            };
        }
    },

    // Switch between level and ship selection
    switchTab(tab) {
        if (!this.overlay) return;
        this.currentSelection = tab;

        const tabButtons = this.overlay.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tab);
        });

        const levelSelection = this.overlay.querySelector('.level-selection');
        const shipSelection = this.overlay.querySelector('.ship-selection');
        if (levelSelection) levelSelection.classList.toggle('active', tab === 'level');
        if (shipSelection) shipSelection.classList.toggle('active', tab === 'ship' || !levelSelection);

        this.updateSummary();
    },
});
