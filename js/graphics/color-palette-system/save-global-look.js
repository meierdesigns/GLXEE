"use strict";

// ColorPaletteSystem methods, split from color-palette-system.js.
extendClass(ColorPaletteSystem, {
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
    },

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
                // UI stays on the faction palette; only the environment is planet-themed.
                this.applyPalette(this.currentPalette, { persist: false });
                themeContextManager.applyContextTheme(
                    themeContextManager.contextSource.palette,
                    themeContextManager.contextSource
                );
            } else {
                this.applyPalette(this.currentPalette, { persist: false });
            }
        }
        return this.getGlobalLook();
    },

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
    },

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
    },

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
    },

    getSecondBaseColor(paletteId) {
        const id = paletteId || this.currentPalette;
        const p = this.palettes[id];
        if (p && p.secondBaseColor) return this.normalizeHex(p.secondBaseColor);
        return this.defaultSecondBaseColor;
    },

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
    },

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
    },

    normalizeHex(color) {
        if (!color || typeof color !== 'string') return '#808080';
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toUpperCase();
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return ('#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toUpperCase();
        }
        const rgb = this.hexToRgb(color);
        return rgb ? this.rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase() : '#808080';
    },

    loadCachedPalette() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && this.palettes[saved]) return saved;
        } catch (e) { /* ignore */ }
        return null;
    },

    saveCachedPalette(paletteId) {
        try {
            localStorage.setItem(this.storageKey, paletteId);
        } catch (e) { /* ignore */ }
    },

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
    },

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
    },
});
