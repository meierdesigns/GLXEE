"use strict";

/**
 * ColorManager - Color Palette System
 * Manages colors through predefined color palettes.
 * App theme persistence is handled via ThemeContextManager when available.
 */
class ColorManager {
    constructor() {
        this.paletteSystem = colorPaletteSystem;
        this.currentPalette = this.paletteSystem.getCurrentPalette();
        this.currentColors = this.paletteSystem.getCurrentColors();
        this.init();
    }

    init() {
        // Prefer dedicated app theme if ThemeContext is already loaded
        if (typeof themeContextManager !== 'undefined') {
            this.setPalette(themeContextManager.getAppTheme(), { persist: true, isAppTheme: true });
            return;
        }
        this.currentPalette = this.paletteSystem.getCurrentPalette();
        this.applyColors();
        this._syncOverlay(this.currentPalette);
    }

    getCurrentColors() {
        return this.paletteSystem.getCurrentColors();
    }

    /**
     * @param {string} paletteId
     * @param {{ persist?: boolean, isAppTheme?: boolean }} [options]
     */
    setPalette(paletteId, options) {
        const opts = options || {};
        const persist = opts.persist !== false;
        this.paletteSystem.applyPalette(paletteId, { persist: persist });
        this.currentPalette = this.paletteSystem.getCurrentPalette();
        this.currentColors = this.paletteSystem.getCurrentColors();
        this._syncOverlay(paletteId);

        if (persist && opts.isAppTheme !== false && typeof themeContextManager !== 'undefined') {
            // Keep app theme storage aligned when settings change the palette
            if (themeContextManager.mode === 'app' || opts.isAppTheme) {
                themeContextManager.appTheme = this.currentPalette;
                themeContextManager.saveAppTheme(this.currentPalette);
            }
        }
    }

    _syncOverlay(paletteId) {
        if (typeof graphicsManager !== 'undefined' && graphicsManager.setOverlayColor) {
            const colors = this.currentColors || {};
            const base = colors.baseColor || colors.primary;
            graphicsManager.setOverlayColor(base);
            graphicsManager.setOverlayIntensity(this.getCurrentOverlayIntensity());
        }
    }

    getCurrentPalette() {
        return this.currentPalette;
    }

    getPalettes() {
        return this.paletteSystem.getPalettes();
    }

    applyColors() {
        this.currentColors = this.paletteSystem.getCurrentColors();
    }

    getCurrentOverlayColor() {
        const colors = this.currentColors || {};
        return colors.baseColor || colors.primary;
    }

    getCurrentOverlayIntensity() {
        const colors = this.currentColors || {};
        const contrast = Number.isFinite(Number(colors.contrast)) ? Number(colors.contrast) : 50;
        // Soft theme wash only — faction/ship pixel colors must stay readable
        if (this.currentPalette === 'grayscale' && !colors.baseColor) {
            return Math.max(0, (contrast / 100) * 0.08);
        }
        return Math.max(0, Math.min(0.28, (contrast / 100) * 0.22));
    }

    reset() {
        this.setPalette('grayscale', { persist: true, isAppTheme: true });
    }

    setHSL(hue, saturation, lightness) {
        console.warn('setHSL is deprecated - use setPalette instead');
        if (saturation < 20) {
            this.setPalette('grayscale');
        } else if (hue < 30 || hue > 330) {
            this.setPalette('fire');
        } else if (hue < 90) {
            this.setPalette('sunset');
        } else if (hue < 150) {
            this.setPalette('forest');
        } else if (hue < 210) {
            this.setPalette('ocean');
        } else if (hue < 270) {
            this.setPalette('purple');
        } else {
            this.setPalette('retro');
        }
    }

    getHSL() {
        console.warn('getHSL is deprecated - use getCurrentPalette instead');
        return { hue: 0, saturation: 0, lightness: 50 };
    }
}

let colorManager = new ColorManager();
