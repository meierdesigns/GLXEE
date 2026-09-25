"use strict";

// ColorPaletteSystem methods, split from color-palette-system.js.
extendClass(ColorPaletteSystem, {
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
    },

    isBuiltin(paletteId) {
        return this.builtinIds.indexOf(paletteId) !== -1;
    },

    isCustom(paletteId) {
        return !!this.palettes[paletteId] && !this.isBuiltin(paletteId);
    },

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
    },

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
    },

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
    },

    init() {
        this.applyPalette(this.currentPalette);
    },

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
    },

    getCurrentPalette() {
        return this.currentPalette;
    },

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
    },

    getCurrentColors() {
        return this.palettes[this.currentPalette];
    },

    reset() {
        this.applyPalette('grayscale');
    },
});
