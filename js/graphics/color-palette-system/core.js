"use strict";

/**
 * Color Palette System — themes are baseColor + secondBaseColor.
 * Contrast / saturation / tones / icon look are global.
 */

class ColorPaletteSystem {
    constructor() {
        /** Brightness 0–100 per role (shared recipe; themes only change baseColor). */
        this.defaultTones = {
            primary: 52,
            secondary: 68,
            accent: 58,
            background: 2,
            backgroundLight: 5,
            surface: 3,
            border: 48,
            outline: 55,
            text: 96,
            textSecondary: 80,
            textMuted: 58,
            textDisabled: 42,
            hover: 22,
            active: 34,
            focus: 55,
            selected: 65,
            disabled: 14,
            player: 96,
            enemy: 82,
            bullet: 88,
            powerup: 78,
            obstacle: 48,
            success: 72,
            warning: 78,
            error: 55,
            info: 70,
            explosion: 90,
            particle: 92,
            glow: 80,
            shadow: 1,
            highlight: 96
        };

        /**
         * Structural roles stay near grayscale so only the main color (primary/accent/…)
         * carries hue — menu-level contrast even with a saturated theme baseColor.
         */
        this.toneSatMul = {
            background: 0.04,
            backgroundLight: 0.06,
            surface: 0.05,
            shadow: 0.03,
            disabled: 0.12,
            obstacle: 0.35,
            text: 0.04,
            textSecondary: 0.06,
            textMuted: 0.08,
            textDisabled: 0.06,
            highlight: 0.12,
            // Combat roles keep base hue so ships/shots are not grayscale
            player: 0.85,
            enemy: 0.9,
            bullet: 1,
            powerup: 0.95,
            explosion: 1,
            particle: 0.95
        };

        this.defaultGlobalLook = {
            brightness: 50,
            contrast: 68,
            saturation: 100,
            iconContrast: 70,
            iconBrightness: 50,
            iconSaturation: 50
        };

        /** Roles derived from secondBaseColor (UI text / highlights only). */
        this.secondBaseRoles = {
            text: true,
            textSecondary: true,
            textMuted: true,
            textDisabled: true,
            highlight: true
        };

        this.defaultSecondBaseColor = '#FFFFFF';

        this.builtinDefs = {
            grayscale: { name: 'Grayscale', baseColor: '#808080', secondBaseColor: '#FFFFFF' },
            white: { name: 'White', baseColor: '#FFFFFF', secondBaseColor: '#FFFFFF' },
            retro: { name: 'Retro', baseColor: '#FF6B6B', secondBaseColor: '#FFFFFF' },
            neon: { name: 'Neon', baseColor: '#00FF00', secondBaseColor: '#FFFFFF' },
            ocean: { name: 'Ocean', baseColor: '#0066CC', secondBaseColor: '#FFFFFF' },
            fire: { name: 'Fire', baseColor: '#FF4500', secondBaseColor: '#FFFFFF' },
            purple: { name: 'Purple', baseColor: '#8A2BE2', secondBaseColor: '#FFFFFF' },
            forest: { name: 'Forest', baseColor: '#228B22', secondBaseColor: '#FFFFFF' },
            sunset: { name: 'Sunset', baseColor: '#FF8C00', secondBaseColor: '#FFFFFF' }
        };

        /** Quick-cycle presets for settings 2nd base toggles. */
        this.secondBasePresets = [
            '#FFFFFF', '#E8E8E8', '#C0C0C0', '#A0A0A0',
            '#FFE4B5', '#87CEEB', '#98FB98', '#FFB6C1', '#E0B0FF'
        ];

        this.palettes = {};
        this.storageKey = 'vf_colorPalette';
        this.customStorageKey = 'vf_custom_palettes_v3';
        this.legacyCustomStorageKey = 'vf_custom_palettes_v2';
        this.globalLookKey = 'vf_global_look_v1';
        this.builtinIds = Object.keys(this.builtinDefs);
        this.globalLook = Object.assign({}, this.defaultGlobalLook);
        this.loadGlobalLook();

        Object.keys(this.builtinDefs).forEach((id) => {
            this.palettes[id] = this.expandPalette(this.builtinDefs[id]);
        });

        this.currentPalette = this.loadCachedPalette() || 'grayscale';
        this.loadCustomPalettes();
        this.init();
    }

    clamp(n, min, max, fallback) {
        const v = Number(n);
        if (!Number.isFinite(v)) return fallback;
        return Math.max(min, Math.min(max, v));
    }

    hexToRgb(hex) {
        if (!hex || typeof hex !== 'string') return null;
        let h = hex.trim();
        if (h.charAt(0) === '#') h = h.slice(1);
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    rgbToHex(r, g, b) {
        const to = (x) => Math.max(0, Math.min(255, Math.round(x)));
        return '#' + ((1 << 24) + (to(r) << 16) + (to(g) << 8) + to(b)).toString(16).slice(1);
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d) + (g < b ? 6 : 0); break;
                case g: h = ((b - r) / d) + 2; break;
                default: h = ((r - g) / d) + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;
        if (s === 0) {
            const v = l * 255;
            return { r: v, g: v, b: v };
        }
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hk = h / 360;
        return {
            r: hue2rgb(p, q, hk + 1 / 3) * 255,
            g: hue2rgb(p, q, hk) * 255,
            b: hue2rgb(p, q, hk - 1 / 3) * 255
        };
    }

    /**
     * Derive one role color from base + brightness + global sat/contrast.
     */
    toneColor(baseHex, brightness, saturation, contrast, role, globalBrightness) {
        const rgb = this.hexToRgb(baseHex) || { r: 128, g: 128, b: 128 };
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const satGlobal = this.clamp(saturation, 0, 200, 100) / 100;
        const roleMul = (this.toneSatMul[role] != null) ? this.toneSatMul[role] : 1;
        let s = hsl.s * satGlobal * roleMul;
        let l = this.clamp(brightness, 0, 100, 50);
        const c = (this.clamp(contrast, 0, 200, 50) - 50) / 50;
        // Stronger stretch so dark/light roles stay as punchy as menu chrome
        l = 50 + (l - 50) * (1 + c * 0.9);
        const globalLight = this.clamp(globalBrightness, 0, 200, 50);
        l += (globalLight - 50) * 0.8;
        l = this.clamp(l, 0, 100, 50);
        const out = this.hslToRgb(hsl.h, s, l);
        return this.rgbToHex(out.r, out.g, out.b);
    }

    mergeTones(tones) {
        const out = Object.assign({}, this.defaultTones);
        if (tones && typeof tones === 'object') {
            Object.keys(tones).forEach((k) => {
                if (out[k] == null && this.defaultTones[k] == null) return;
                out[k] = this.clamp(tones[k], 0, 100, this.defaultTones[k]);
            });
        }
        return out;
    }

    getGlobalLook() {
        return {
            brightness: this.clamp(this.globalLook.brightness, 0, 200, 50),
            contrast: this.clamp(this.globalLook.contrast, 0, 200, 50),
            saturation: this.clamp(this.globalLook.saturation, 0, 200, 100),
            iconContrast: this.clamp(this.globalLook.iconContrast, 0, 100, 65),
            iconBrightness: this.clamp(this.globalLook.iconBrightness, 0, 100, 50),
            iconSaturation: this.clamp(this.globalLook.iconSaturation, 0, 100, 50),
            tones: this.mergeTones(this.globalLook.tones)
        };
    }

    loadGlobalLook() {
        try {
            const raw = localStorage.getItem(this.globalLookKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return;
            const tones = this.mergeTones(data.tones);
            // Migrate old structural recipe (muddy tinted darks) → near-black surfaces
            if (tones.background >= 5 && tones.background <= 8) tones.background = 2;
            if (tones.backgroundLight >= 10 && tones.backgroundLight <= 14) tones.backgroundLight = 5;
            if (tones.surface >= 7 && tones.surface <= 10) tones.surface = 3;
            if (tones.shadow >= 3 && tones.shadow <= 5) tones.shadow = 1;
            if (tones.text >= 90 && tones.text <= 93) tones.text = 96;
            if (tones.player >= 88 && tones.player <= 93) tones.player = 96;
            if (tones.enemy >= 72 && tones.enemy <= 78) tones.enemy = 82;
            let contrast = this.clamp(data.contrast, 0, 200, this.defaultGlobalLook.contrast);
            // Old default 50 left ships washed mid-tone against tinted BGs
            if (data.contrast === 50) contrast = this.defaultGlobalLook.contrast;
            this.globalLook = {
                brightness: this.clamp(data.brightness, 0, 200, this.defaultGlobalLook.brightness),
                contrast,
                saturation: this.clamp(data.saturation, 0, 200, this.defaultGlobalLook.saturation),
                iconContrast: this.clamp(data.iconContrast, 0, 100, this.defaultGlobalLook.iconContrast),
                iconBrightness: this.clamp(data.iconBrightness, 0, 100, this.defaultGlobalLook.iconBrightness),
                iconSaturation: this.clamp(data.iconSaturation, 0, 100, this.defaultGlobalLook.iconSaturation),
                tones
            };
        } catch (e) { /* ignore */ }
    }
}
