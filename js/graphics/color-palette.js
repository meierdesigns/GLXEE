"use strict";

/**
 * Color palette and color management utilities
 */
class ColorPalette {
    constructor() {
        this.init();
    }

    init() {
        // Game Boy color palette (4 shades of green)
        this.palette = {
            white: '#000000',    // Black for bullets
            light: '#666666',    // Medium-dark gray
            dark: '#808080',     // Light gray
            black: '#999999'     // Bright gray for background
        };
    }

    getColor(index) {
        // Grayscale base palette — lifted floor so sprites stay readable on dark playfields
        const colorShades = [
            'transparent',  // 0
            '#2a2a2a',      // 1 - near-black (lifted)
            '#3d3d3d',      // 2 - very dark gray
            '#525252',      // 3 - dark gray
            '#686868',      // 4 - medium-dark gray
            '#7e7e7e',      // 5 - medium gray
            '#949494',      // 6 - medium-light gray
            '#adadad',      // 7 - light gray
            '#c8c8c8',      // 8 - very light gray
            '#2a2a2a',      // 9 - near-black (repeat)
            '#3d3d3d',      // 10
            '#525252',      // 11
            '#686868',      // 12
            '#7e7e7e',      // 13
            '#949494',      // 14
            '#adadad'       // 15
        ];
        
        return colorShades[index] || 'transparent';
    }

    getPlanetColor(index) {
        // Special colors for planets
        const planetColors = [
            'transparent',  // 0
            '#8B0000',      // 1 - Mars red
            '#CD5C5C',      // 2 - Light red
            '#FF6347',      // 3 - Tomato
            '#FF4500',      // 4 - Orange red
            '#FFD700',      // 5 - Gold
            '#FFA500',      // 6 - Orange
            '#FF8C00',      // 7 - Dark orange
            '#4169E1',      // 8 - Royal blue
            '#87CEEB',      // 9 - Sky blue
            '#B0C4DE',      // 10 - Light steel blue
            '#E0E0E0',      // 11 - Light gray
            '#C0C0C0',      // 12 - Silver
            '#FFFFFF',      // 13 - White
            '#F0F8FF',      // 14 - Alice blue
            '#F5F5F5'       // 15 - White smoke
        ];
        
        return planetColors[index] || 'transparent';
    }

    resolveCssColor(color) {
        if (!color || color === 'transparent') return color;
        if (typeof color === 'string' && color.indexOf('var(') === 0) {
            const match = color.match(/var\(\s*(--[^),\s]+)/);
            if (match) {
                const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
                if (value) return value;
            }
            return '#999999';
        }
        return color;
    }

    applyColorOverlay(baseColor, overlayColor, intensity = 0.5) {
        baseColor = this.resolveCssColor(baseColor);
        overlayColor = this.resolveCssColor(overlayColor);

        // Convert hex colors to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgbToHex = (r, g, b) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        const baseRgb = hexToRgb(baseColor);
        const overlayRgb = hexToRgb(overlayColor);
        
        if (!baseRgb || !overlayRgb) return baseColor;

        // Apply color overlay
        const blendedR = Math.floor(baseRgb.r + (overlayRgb.r - baseRgb.r) * intensity);
        const blendedG = Math.floor(baseRgb.g + (overlayRgb.g - baseRgb.g) * intensity);
        const blendedB = Math.floor(baseRgb.b + (overlayRgb.b - baseRgb.b) * intensity);

        return rgbToHex(blendedR, blendedG, blendedB);
    }

    applyLighting(baseColor, intensity, lightColor) {
        baseColor = this.resolveCssColor(baseColor);
        lightColor = this.resolveCssColor(lightColor);

        // Convert hex colors to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgbToHex = (r, g, b) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        const baseRgb = hexToRgb(baseColor);
        const lightRgb = hexToRgb(lightColor);
        
        if (!baseRgb || !lightRgb) return baseColor;

        // Enhanced lighting with additive blending for brighter effect
        const blendedR = Math.min(255, Math.floor(baseRgb.r + lightRgb.r * intensity * 0.8));
        const blendedG = Math.min(255, Math.floor(baseRgb.g + lightRgb.g * intensity * 0.8));
        const blendedB = Math.min(255, Math.floor(baseRgb.b + lightRgb.b * intensity * 0.8));

        return rgbToHex(blendedR, blendedG, blendedB);
    }

    getPalette() {
        return this.palette;
    }
}

