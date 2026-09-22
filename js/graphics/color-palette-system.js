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

    saveGlobalLook() {
        try {
            const look = this.getGlobalLook();
            localStorage.setItem(this.globalLookKey, JSON.stringify({
                brightness: look.brightness,
                contrast: look.contrast,
                saturation: look.saturation,
                iconContrast: look.iconContrast,
                iconBrightness: look.iconBrightness,
                iconSaturation: look.iconSaturation,
                tones: look.tones
            }));
        } catch (e) {
            console.warn('ColorPaletteSystem: saveGlobalLook failed', e);
        }
    }

    /**
     * Update global look and re-expand all palettes.
     * @param {object} patch
     * @param {{ apply?: boolean }} [options]
     */
    setGlobalLook(patch, options) {
        const opts = options || {};
        const src = patch || {};
        const next = this.getGlobalLook();
        if (src.brightness != null) next.brightness = this.clamp(src.brightness, 0, 200, next.brightness);
        if (src.contrast != null) next.contrast = this.clamp(src.contrast, 0, 200, next.contrast);
        if (src.saturation != null) next.saturation = this.clamp(src.saturation, 0, 200, next.saturation);
        if (src.iconContrast != null) next.iconContrast = this.clamp(src.iconContrast, 0, 100, next.iconContrast);
        if (src.iconBrightness != null) next.iconBrightness = this.clamp(src.iconBrightness, 0, 100, next.iconBrightness);
        if (src.iconSaturation != null) next.iconSaturation = this.clamp(src.iconSaturation, 0, 100, next.iconSaturation);
        if (src.tones) next.tones = this.mergeTones(src.tones);
        this.globalLook = next;
        this.saveGlobalLook();

        if (typeof performanceOptimizer !== 'undefined' && performanceOptimizer.colorCache) {
            performanceOptimizer.colorCache.clear();
        }

        Object.keys(this.palettes).forEach((id) => {
            if (id.charAt(0) === '_') return;
            const p = this.palettes[id];
            if (!p) return;
            this.palettes[id] = this.expandPalette({
                name: p.name,
                baseColor: p.baseColor || p.primary,
                secondBaseColor: p.secondBaseColor || this.defaultSecondBaseColor,
                _overridden: p._overridden
            });
        });

        if (opts.apply !== false) {
            // Keep active planet/galaxy context in sync with global look
            if (typeof themeContextManager !== 'undefined'
                && themeContextManager.mode === 'context'
                && themeContextManager.contextSource
                && themeContextManager.contextSource.palette) {
                themeContextManager.applyContextTheme(
                    themeContextManager.contextSource.palette,
                    themeContextManager.contextSource
                );
            } else {
                this.applyPalette(this.currentPalette, { persist: false });
            }
        }
        return this.getGlobalLook();
    }

    /**
     * Shade a second-base color by recipe brightness (100 = full color, 0 = black).
     * Keeps hue/sat so white/cyan/etc. stay selectable as 2nd base.
     */
    shadeSecondBase(hex, brightness) {
        const rgb = this.hexToRgb(hex) || { r: 255, g: 255, b: 255 };
        const f = this.clamp(brightness, 0, 100, 96) / 100;
        return this.rgbToHex(
            Math.round(rgb.r * f),
            Math.round(rgb.g * f),
            Math.round(rgb.b * f)
        );
    }

    /**
     * Expand a compact theme (name + baseColor + secondBaseColor) with global look.
     */
    expandPalette(spec) {
        const src = spec || {};
        const look = this.getGlobalLook();
        const baseColor = this.normalizeHex(src.baseColor || src.primary || '#808080');
        const secondBaseColor = this.normalizeHex(
            src.secondBaseColor || src.text || this.defaultSecondBaseColor
        );
        const contrast = look.contrast;
        const brightness = look.brightness;
        const saturation = look.saturation;
        const tones = look.tones;
        const iconContrast = look.iconContrast;
        const iconBrightness = look.iconBrightness;
        const iconSaturation = look.iconSaturation;

        const derived = {
            name: src.name || 'Custom',
            baseColor,
            secondBaseColor,
            contrast,
            saturation,
            tones,
            iconContrast,
            iconBrightness,
            iconSaturation
        };

        Object.keys(tones).forEach((role) => {
            if (this.secondBaseRoles[role]) {
                derived[role] = this.shadeSecondBase(secondBaseColor, tones[role]);
            } else {
                derived[role] = this.toneColor(baseColor, tones[role], saturation, contrast, role, brightness);
            }
        });

        if (!derived.outline) derived.outline = derived.border;
        if (src._overridden) derived._overridden = true;
        return derived;
    }

    /**
     * Compact form for persistence — themes store baseColor + secondBaseColor.
     */
    compactPalette(palette) {
        const p = palette || {};
        return {
            name: p.name || 'Custom',
            baseColor: this.normalizeHex(p.baseColor || p.primary || '#808080'),
            secondBaseColor: this.normalizeHex(p.secondBaseColor || this.defaultSecondBaseColor)
        };
    }

    getSecondBaseColor(paletteId) {
        const id = paletteId || this.currentPalette;
        const p = this.palettes[id];
        if (p && p.secondBaseColor) return this.normalizeHex(p.secondBaseColor);
        return this.defaultSecondBaseColor;
    }

    /**
     * Set secondBaseColor on a palette (defaults to current) and re-apply.
     */
    setSecondBaseColor(hex, options) {
        const opts = options || {};
        const id = opts.paletteId || this.currentPalette;
        const p = this.palettes[id];
        if (!p) return null;
        const next = this.normalizeHex(hex || this.defaultSecondBaseColor);
        this.palettes[id] = this.expandPalette({
            name: p.name,
            baseColor: p.baseColor || p.primary,
            secondBaseColor: next,
            _overridden: true
        });
        this.saveCustomPalettes();
        if (opts.apply !== false) {
            this.applyPalette(id, { persist: opts.persist !== false });
        }
        return next;
    }

    cycleSecondBaseColor(direction, options) {
        const opts = options || {};
        const id = opts.paletteId || this.currentPalette;
        const current = this.getSecondBaseColor(id);
        const list = this.secondBasePresets.slice();
        let idx = list.findIndex((c) => this.normalizeHex(c) === current);
        if (idx < 0) idx = 0;
        const dir = direction >= 0 ? 1 : -1;
        const next = list[(idx + dir + list.length) % list.length];
        return this.setSecondBaseColor(next, opts);
    }

    normalizeHex(color) {
        if (!color || typeof color !== 'string') return '#808080';
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return ('#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toUpperCase();
        }
        const rgb = this.hexToRgb(color);
        return rgb ? this.rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase() : '#808080';
    }

    loadCachedPalette() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && this.palettes[saved]) return saved;
        } catch (e) { /* ignore */ }
        return null;
    }

    saveCachedPalette(paletteId) {
        try {
            localStorage.setItem(this.storageKey, paletteId);
        } catch (e) { /* ignore */ }
    }

    loadCustomPalettes() {
        try {
            let raw = localStorage.getItem(this.customStorageKey);
            let fromLegacy = false;
            if (!raw) {
                raw = localStorage.getItem(this.legacyCustomStorageKey);
                fromLegacy = !!raw;
            }
            if (!raw) {
                raw = localStorage.getItem('vf_custom_palettes_v1');
                fromLegacy = !!raw;
            }
            if (!raw) return;
            const parsed = JSON.parse(raw);
            let hasSavedLook = false;
            try {
                hasSavedLook = !!localStorage.getItem(this.globalLookKey);
            } catch (e) { /* ignore */ }

            let legacyLookPatch = null;
            Object.keys(parsed || {}).forEach((id) => {
                if (!parsed[id] || typeof parsed[id] !== 'object') return;
                const data = parsed[id];

                if (fromLegacy && !hasSavedLook && !legacyLookPatch) {
                    const patch = {};
                    if (data.contrast != null) patch.contrast = data.contrast;
                    if (data.saturation != null) patch.saturation = data.saturation;
                    if (data.iconContrast != null) patch.iconContrast = data.iconContrast;
                    if (data.iconBrightness != null) patch.iconBrightness = data.iconBrightness;
                    if (data.iconSaturation != null) patch.iconSaturation = data.iconSaturation;
                    if (data.tones) patch.tones = data.tones;
                    if (Object.keys(patch).length) legacyLookPatch = patch;
                }

                const next = this.normalizePalette(data, id);
                if (this.builtinIds.indexOf(id) !== -1) next._overridden = true;
                this.palettes[id] = next;
            });

            if (legacyLookPatch) {
                this.setGlobalLook(legacyLookPatch, { apply: false });
            }
            if (fromLegacy) {
                this.saveCustomPalettes();
            }
        } catch (e) {
            console.warn('ColorPaletteSystem: loadCustomPalettes failed', e);
        }
    }

    saveCustomPalettes() {
        try {
            const payload = {};
            Object.keys(this.palettes).forEach((id) => {
                const p = this.palettes[id];
                if (!p) return;
                if (id.charAt(0) === '_') return;
                if (this.builtinIds.indexOf(id) === -1 || p._overridden) {
                    const compact = this.compactPalette(p);
                    if (p._overridden) compact._overridden = true;
                    payload[id] = compact;
                }
            });
            localStorage.setItem(this.customStorageKey, JSON.stringify(payload));
        } catch (e) {
            console.warn('ColorPaletteSystem: saveCustomPalettes failed', e);
        }
    }

    normalizePalette(data, id) {
        const fallback = this.builtinDefs[id] || this.builtinDefs.grayscale;
        const src = Object.assign({}, fallback, data || {});
        if (!src.baseColor) src.baseColor = src.primary || fallback.baseColor;
        if (!src.secondBaseColor) {
            src.secondBaseColor = fallback.secondBaseColor || this.defaultSecondBaseColor;
        }
        src.name = src.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Custom');
        return this.expandPalette({
            name: src.name,
            baseColor: src.baseColor,
            secondBaseColor: src.secondBaseColor,
            _overridden: !!(data && data._overridden)
        });
    }

    isBuiltin(paletteId) {
        return this.builtinIds.indexOf(paletteId) !== -1;
    }

    isCustom(paletteId) {
        return !!this.palettes[paletteId] && !this.isBuiltin(paletteId);
    }

    upsertPalette(paletteId, colors, options) {
        const opts = options || {};
        let id = String(paletteId || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
        if (!id) id = 'custom_' + Date.now().toString(36);

        if (opts.forceNew || (this.palettes[id] && opts.asNew)) {
            let n = 2;
            let candidate = id;
            while (this.palettes[candidate]) {
                candidate = id + '_' + n;
                n += 1;
            }
            id = candidate;
        }

        const next = this.normalizePalette(colors, id);
        if (this.isBuiltin(id)) next._overridden = true;
        this.palettes[id] = next;
        this.saveCustomPalettes();

        if (typeof performanceOptimizer !== 'undefined' && performanceOptimizer.colorCache) {
            performanceOptimizer.colorCache.delete(id);
            if (typeof performanceOptimizer.preCachePalette === 'function') {
                performanceOptimizer.preCachePalette(id);
            }
        }
        if (typeof themeContextManager !== 'undefined' && themeContextManager.refreshPresetIds) {
            themeContextManager.refreshPresetIds();
        }
        return id;
    }

    deleteCustomPalette(paletteId) {
        const id = String(paletteId || '');
        if (!this.palettes[id]) return false;
        if (this.isBuiltin(id)) return false;
        delete this.palettes[id];
        this.saveCustomPalettes();
        if (this.currentPalette === id) this.applyPalette('grayscale');
        if (typeof themeContextManager !== 'undefined' && themeContextManager.refreshPresetIds) {
            themeContextManager.refreshPresetIds();
        }
        return true;
    }

    resetBuiltinPalette(paletteId) {
        if (!this.isBuiltin(paletteId)) return false;
        try {
            const raw = localStorage.getItem(this.customStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed[paletteId]) {
                    delete parsed[paletteId];
                    localStorage.setItem(this.customStorageKey, JSON.stringify(parsed));
                }
            }
        } catch (e) { /* ignore */ }
        this.palettes[paletteId] = this.expandPalette(this.builtinDefs[paletteId]);
        return true;
    }

    init() {
        this.applyPalette(this.currentPalette);
    }

    getPalettes() {
        return Object.keys(this.palettes).filter((key) => key.charAt(0) !== '_').map((key) => ({
            id: key,
            name: this.palettes[key].name,
            primary: this.palettes[key].primary,
            secondary: this.palettes[key].secondary,
            accent: this.palettes[key].accent,
            baseColor: this.palettes[key].baseColor,
            secondBaseColor: this.palettes[key].secondBaseColor || this.defaultSecondBaseColor,
            custom: !this.isBuiltin(key) || !!this.palettes[key]._overridden
        }));
    }

    getCurrentPalette() {
        return this.currentPalette;
    }

    /**
     * @param {string} paletteId
     * @param {{ persist?: boolean }} [options]
     */
    applyPalette(paletteId, options) {
        if (!this.palettes[paletteId]) {
            console.warn(`Palette ${paletteId} not found, using grayscale`);
            paletteId = 'grayscale';
        }

        const persist = !options || options.persist !== false;
        this.currentPalette = paletteId;
        if (persist) this.saveCachedPalette(paletteId);

        // Always re-expand so tone edits apply live
        const stored = this.palettes[paletteId];
        const palette = this.expandPalette(stored);
        this.palettes[paletteId] = Object.assign({}, palette, {
            _overridden: !!stored._overridden
        });

        const root = document.documentElement;

        root.style.setProperty('--color-primary', palette.primary);
        root.style.setProperty('--color-secondary', palette.secondary);
        root.style.setProperty('--color-accent', palette.accent);
        root.style.setProperty('--color-basecolor', palette.baseColor);
        root.style.setProperty('--color-second-basecolor', palette.secondBaseColor || this.defaultSecondBaseColor);
        root.style.setProperty('--theme-contrast', String(palette.contrast));
        root.style.setProperty('--theme-contrast-filter', String(0.55 + (palette.contrast / 100) * 0.9));
        root.style.setProperty('--theme-saturation', String(palette.saturation));
        root.style.setProperty('--theme-saturation-filter', String(Math.max(0, palette.saturation / 100)));
        root.style.setProperty('--theme-brightness', String(palette.brightness));
        root.style.setProperty('--theme-brightness-filter', String(0.55 + (palette.brightness / 100) * 0.9));
        root.style.setProperty('--theme-icon-contrast', String(palette.iconContrast));
        root.style.setProperty('--theme-icon-contrast-filter', String(0.45 + (palette.iconContrast / 100) * 1.35));
        root.style.setProperty('--theme-icon-brightness', String(palette.iconBrightness));
        root.style.setProperty('--theme-icon-brightness-factor', String(0.35 + (palette.iconBrightness / 100) * 1.3));
        root.style.setProperty('--theme-icon-saturation', String(palette.iconSaturation));
        root.style.setProperty('--theme-icon-saturation-factor', String(0.0 + (palette.iconSaturation / 100) * 2.0));

        root.style.setProperty('--color-background', palette.background);
        root.style.setProperty('--color-background-light', palette.backgroundLight);
        root.style.setProperty('--color-surface', palette.surface);
        root.style.setProperty('--color-border', palette.border);
        root.style.setProperty('--color-outline', palette.outline || palette.border);
        root.style.setProperty('--color-text', palette.text);
        root.style.setProperty('--color-text-secondary', palette.textSecondary);
        root.style.setProperty('--color-text-muted', palette.textMuted || palette.textSecondary);
        root.style.setProperty('--color-text-disabled', palette.textDisabled || palette.textMuted);
        root.style.setProperty('--color-hover', palette.hover);
        root.style.setProperty('--color-active', palette.active);
        root.style.setProperty('--color-focus', palette.focus || palette.active);
        root.style.setProperty('--color-selected', palette.selected || palette.primary);
        root.style.setProperty('--color-disabled', palette.disabled || palette.textDisabled);
        root.style.setProperty('--color-player', palette.player || palette.text);
        root.style.setProperty('--color-enemy', palette.enemy || palette.textSecondary);
        root.style.setProperty('--color-bullet', palette.bullet || palette.primary);
        root.style.setProperty('--color-powerup', palette.powerup || palette.primary);
        root.style.setProperty('--color-obstacle', palette.obstacle || palette.border);
        root.style.setProperty('--color-success', palette.success || palette.primary);
        root.style.setProperty('--color-warning', palette.warning || palette.secondary);
        root.style.setProperty('--color-error', palette.error || palette.border);
        root.style.setProperty('--color-info', palette.info || palette.textSecondary);
        root.style.setProperty('--color-explosion', palette.explosion || palette.primary);
        root.style.setProperty('--color-particle', palette.particle || palette.secondary);
        root.style.setProperty('--color-glow', palette.glow || palette.border);
        root.style.setProperty('--color-shadow', palette.shadow || '#202020');
        root.style.setProperty('--color-highlight', palette.highlight || palette.textSecondary);
        root.style.setProperty('--overlay-color', palette.baseColor);

        root.style.setProperty('--current-primary', palette.primary);
        root.style.setProperty('--current-secondary', palette.secondary);
        root.style.setProperty('--current-accent', palette.accent);
        root.style.setProperty('--current-background', palette.background);
        root.style.setProperty('--current-background-light', palette.backgroundLight);
        root.style.setProperty('--current-surface', palette.surface);
        root.style.setProperty('--current-border', palette.border);
        root.style.setProperty('--current-text', palette.text);
        root.style.setProperty('--current-text-secondary', palette.textSecondary);
        root.style.setProperty('--current-text-dim', palette.textMuted || palette.textSecondary);
        root.style.setProperty('--current-active', palette.active);
        root.style.setProperty('--current-hover', palette.hover);

        document.body.style.background = palette.background;
        document.body.classList.remove(
            'theme-teal', 'theme-green', 'theme-blue', 'theme-red',
            'theme-purple', 'theme-orange', 'theme-pink', 'theme-yellow'
        );

        if (typeof iconRenderer !== 'undefined' && iconRenderer.clearCache) {
            iconRenderer.clearCache();
        }
    }

    getCurrentColors() {
        return this.palettes[this.currentPalette];
    }

    reset() {
        this.applyPalette('grayscale');
    }
}

let colorPaletteSystem = new ColorPaletteSystem();
