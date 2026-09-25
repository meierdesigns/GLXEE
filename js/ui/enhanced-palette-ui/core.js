"use strict";

/**
 * Enhanced Palette UI System
 * Enhanced user interface for the palette system
 */
class EnhancedPaletteUI {
    constructor() {
        this.paletteHistory = [];
        this.favoritePalettes = new Set();
        this.palettePreview = null;
        this.animationSpeed = 300;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserPreferences();
    }

    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        this.quickSwitchPalette('grayscale');
                        break;
                    case '2':
                        this.quickSwitchPalette('retro');
                        break;
                    case '3':
                        this.quickSwitchPalette('neon');
                        break;
                    case '4':
                        this.quickSwitchPalette('ocean');
                        break;
                    case '5':
                        this.quickSwitchPalette('fire');
                        break;
                    case '6':
                        this.quickSwitchPalette('purple');
                        break;
                    case '7':
                        this.quickSwitchPalette('forest');
                        break;
                    case '8':
                        this.quickSwitchPalette('sunset');
                        break;
                    case 'r':
                        this.randomPalette();
                        break;
                    case 'f':
                        this.toggleFavorite();
                        break;
                }
            }
        });
    }

    quickSwitchPalette(paletteId) {
        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.setAppTheme(paletteId);
            this.addToHistory(paletteId);
            this.showPaletteNotification(paletteId);
        } else if (typeof colorManager !== 'undefined') {
            colorManager.setPalette(paletteId, { persist: true, isAppTheme: true });
            this.addToHistory(paletteId);
            this.showPaletteNotification(paletteId);
        }
    }

    randomPalette() {
        const palettes = ['grayscale', 'retro', 'neon', 'ocean', 'fire', 'purple', 'forest', 'sunset'];
        const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
        this.quickSwitchPalette(randomPalette);
    }

    toggleFavorite() {
        if (typeof colorManager !== 'undefined') {
            const currentPalette = colorManager.getCurrentPalette();
            if (this.favoritePalettes.has(currentPalette)) {
                this.favoritePalettes.delete(currentPalette);
                this.showNotification('Removed from favorites', 'info');
            } else {
                this.favoritePalettes.add(currentPalette);
                this.showNotification('Added to favorites', 'success');
            }
            this.saveUserPreferences();
        }
    }

    addToHistory(paletteId) {
        // Remove if already exists
        const index = this.paletteHistory.indexOf(paletteId);
        if (index > -1) {
            this.paletteHistory.splice(index, 1);
        }

        // Add to beginning
        this.paletteHistory.unshift(paletteId);

        // Keep only last 10
        if (this.paletteHistory.length > 10) {
            this.paletteHistory = this.paletteHistory.slice(0, 10);
        }

        this.saveUserPreferences();
    }

    showPaletteNotification(paletteId) {
        const palette = colorPaletteSystem.palettes[paletteId];
        if (palette) {
            this.showNotification(`Switched to ${palette.name}`, 'success');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.palette-notification');
        if (existing) {
            existing.remove();
        }

        // Create notification
        const notification = document.createElement('div');
        notification.className = `palette-notification palette-notification-${type}`;
        notification.textContent = message;

        // Style notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-surface);
            color: var(--color-text);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--spacing-sm) var(--spacing-md);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            z-index: var(--z-toast);
            box-shadow: var(--shadow-lg);
            transition: var(--transition-normal);
            transform: translateX(100%);
        `;

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, this.animationSpeed);
        }, 2000);
    }

    createPalettePreview(paletteId) {
        const palette = colorPaletteSystem.palettes[paletteId];
        if (!palette) return null;

        const preview = document.createElement('div');
        preview.className = 'palette-preview';
        preview.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--color-background);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--spacing-md);
            margin-top: var(--spacing-xs);
            box-shadow: var(--shadow-lg);
            z-index: var(--z-dropdown);
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--spacing-sm);
        `;

        // Create color swatches
        const colorKeys = ['primary', 'secondary', 'accent', 'background', 'surface', 'border', 'text', 'textSecondary'];
        colorKeys.forEach(key => {
            if (palette[key]) {
                const swatch = document.createElement('div');
                swatch.style.cssText = `
                    width: 100%;
                    height: 20px;
                    background: ${palette[key]};
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                `;
                swatch.title = `${key}: ${palette[key]}`;
                preview.appendChild(swatch);
            }
        });

        return preview;
    }

    enhancePaletteButtons() {
        const paletteButtons = document.querySelectorAll('.palette-button');
        paletteButtons.forEach(button => {
            // Add hover preview
            button.addEventListener('mouseenter', (e) => {
                const paletteId = button.dataset.palette;
                if (paletteId) {
                    this.palettePreview = this.createPalettePreview(paletteId);
                    if (this.palettePreview) {
                        button.style.position = 'relative';
                        button.appendChild(this.palettePreview);
                    }
                }
            });

            button.addEventListener('mouseleave', () => {
                if (this.palettePreview) {
                    this.palettePreview.remove();
                    this.palettePreview = null;
                }
            });

            // Add click animation
            button.addEventListener('click', (e) => {
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 100);
            });
        });
    }
}
