"use strict";

/**
 * ThemeContextManager
 * - App theme: menus / settings (persisted)
 * - Context theme: planet / galaxy / stage (temporary while playing or editing)
 * Priority: stage > planet > galaxy > app
 */
class ThemeContextManager {
    constructor() {
        this.appStorageKey = 'vf_appTheme';
        this.mode = 'app'; // 'app' | 'context'
        this.contextSource = null; // { level: 'stage'|'planet'|'galaxy'|'app', id, palette }
        this.appTheme = this.loadAppTheme();
        this.presetIds = [
            'grayscale', 'white', 'retro', 'neon', 'ocean', 'fire', 'purple', 'forest', 'sunset'
        ];
        this.refreshPresetIds();
    }

    refreshPresetIds() {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes) {
            this.presetIds = Object.keys(colorPaletteSystem.palettes).filter((id) => id.charAt(0) !== '_');
        }
    }

    loadAppTheme() {
        try {
            const saved = localStorage.getItem(this.appStorageKey);
            if (saved && this.isValidPreset(saved)) return saved;
        } catch (e) { /* ignore */ }
        try {
            const legacy = localStorage.getItem('vf_colorPalette');
            if (legacy && this.isValidPreset(legacy)) return legacy;
        } catch (e) { /* ignore */ }
        return 'grayscale';
    }

    saveAppTheme(paletteId) {
        try {
            localStorage.setItem(this.appStorageKey, paletteId);
            localStorage.setItem('vf_colorPalette', paletteId);
        } catch (e) { /* ignore */ }
    }

    isValidPreset(id) {
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes) {
            return !!colorPaletteSystem.palettes[id];
        }
        return this.presetIds.indexOf(id) !== -1;
    }

    getPresetOptions(includeInherit) {
        const list = includeInherit ? [{ id: 'inherit', name: 'Inherit' }] : [];
        if (typeof colorManager !== 'undefined' && colorManager.getPalettes) {
            return list.concat(colorManager.getPalettes());
        }
        return list.concat(this.presetIds.map(id => ({
            id: id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            primary: '#808080'
        })));
    }

    getAppTheme() {
        return this.appTheme;
    }

    /**
     * Set and persist the application (menus) theme.
     */
    setAppTheme(paletteId) {
        if (!this.isValidPreset(paletteId)) paletteId = 'grayscale';
        this.appTheme = paletteId;
        this.saveAppTheme(paletteId);
        this.mode = 'app';
        this.contextSource = { level: 'app', id: null, palette: paletteId };
        this._apply(paletteId, true);
        return paletteId;
    }

    /**
     * Re-apply saved app theme (menus / after leaving a level).
     */
    restoreAppTheme() {
        this.mode = 'app';
        this.contextSource = { level: 'app', id: null, palette: this.appTheme };
        this._apply(this.appTheme, true);
        return this.appTheme;
    }

    /**
     * Apply a temporary context theme without overwriting app settings.
     */
    applyContextTheme(paletteId, meta) {
        if (!paletteId || paletteId === 'inherit') {
            return this.restoreAppTheme();
        }
        if (!this.isValidPreset(paletteId)) {
            return this.restoreAppTheme();
        }
        this.mode = 'context';
        this.contextSource = Object.assign({ level: 'context', id: null, palette: paletteId }, meta || {});
        this._apply(paletteId, false);
        return paletteId;
    }

    /**
     * Global look recipe (contrast, saturation, tones, icons).
     * Themes / planets only swap baseColor.
     */
    getAppRecipe() {
        if (typeof colorPaletteSystem === 'undefined') return null;
        if (typeof colorPaletteSystem.getGlobalLook === 'function') {
            return colorPaletteSystem.getGlobalLook();
        }
        const app = colorPaletteSystem.palettes[this.appTheme]
            || colorPaletteSystem.palettes.grayscale;
        if (!app) return null;
        return {
            brightness: Number.isFinite(Number(app.brightness)) ? Number(app.brightness) : 50,
            contrast: Number.isFinite(Number(app.contrast)) ? Number(app.contrast) : 50,
            saturation: Number.isFinite(Number(app.saturation)) ? Number(app.saturation) : 100,
            tones: app.tones ? Object.assign({}, app.tones) : undefined,
            iconContrast: Number.isFinite(Number(app.iconContrast)) ? Number(app.iconContrast) : 65,
            iconBrightness: Number.isFinite(Number(app.iconBrightness)) ? Number(app.iconBrightness) : 50,
            iconSaturation: Number.isFinite(Number(app.iconSaturation)) ? Number(app.iconSaturation) : 50
        };
    }

    /**
     * Expand a context palette from baseColor (+ optional secondBaseColor).
     */
    expandWithAppRecipe(spec) {
        const src = spec || {};
        let second = src.secondBaseColor || null;
        if (!second && typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.getSecondBaseColor) {
            const appId = this.appTheme || colorPaletteSystem.currentPalette;
            second = colorPaletteSystem.getSecondBaseColor(appId);
        }
        return colorPaletteSystem.expandPalette({
            name: src.name || 'Context',
            baseColor: src.baseColor || src.primary || '#808080',
            secondBaseColor: second
                || (colorPaletteSystem.defaultSecondBaseColor || '#FFFFFF')
        });
    }

    _apply(paletteId, persist) {
        let id = paletteId;
        // Context (ingame/planet): only baseColor changes — global look + 2nd base stay
        if (!persist && typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes[paletteId]) {
            const src = colorPaletteSystem.palettes[paletteId];
            const tempId = '_ctx_active';
            colorPaletteSystem.palettes[tempId] = this.expandWithAppRecipe({
                name: src.name,
                baseColor: src.baseColor || src.primary,
                secondBaseColor: src.secondBaseColor
            });
            id = tempId;
        }
        if (typeof colorManager !== 'undefined' && colorManager.setPalette) {
            colorManager.setPalette(id, { persist: !!persist, isAppTheme: !!persist });
        } else if (typeof colorPaletteSystem !== 'undefined') {
            colorPaletteSystem.applyPalette(id, { persist: !!persist });
        }
    }

    normalizeThemeId(value) {
        if (value == null || value === '' || value === 'inherit' || value === 'default') {
            return null;
        }
        const id = String(value).toLowerCase();
        return this.isValidPreset(id) ? id : null;
    }

    normalizeHexColor(value) {
        if (value == null || value === '' || value === 'inherit') return null;
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            const hex = colorPaletteSystem.normalizeHex(value);
            return hex || null;
        }
        const s = String(value).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
        return null;
    }

    galaxyPaletteId(galaxyId) {
        const gid = String(galaxyId || 'galaxy').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
        return 'gxy_' + gid;
    }

    ensureGalaxyPalette(galaxyId, baseColor) {
        const hex = this.normalizeHexColor(baseColor);
        if (!hex || typeof colorPaletteSystem === 'undefined') return null;
        const id = this.galaxyPaletteId(galaxyId);
        const name = (typeof planetConfigManager !== 'undefined'
            && planetConfigManager.getGalaxy
            && planetConfigManager.getGalaxy(galaxyId)
            && planetConfigManager.getGalaxy(galaxyId).name)
            || galaxyId
            || 'Galaxy';
        colorPaletteSystem.palettes[id] = this.expandWithAppRecipe({
            name: String(name),
            baseColor: hex
        });
        return id;
    }

    /**
     * Resolve theme for planet + optional stage.
     * @returns {{ palette: string, source: string, planetId: string|null, stageKey: string|null, galaxyId: string|null }}
     */
    resolveTheme(planetId, stageKey) {
        const pid = planetId ? String(planetId).toLowerCase() : null;
        const sk = stageKey != null ? String(stageKey) : null;
        let galaxyId = null;
        let stageTheme = null;
        let planetTheme = null;
        let galaxyPalette = null;

        if (typeof planetConfigManager !== 'undefined' && pid) {
            const cfg = planetConfigManager.getConfig(pid);
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
            planetTheme = this.normalizeThemeId(cfg && cfg.theme);
            if (sk && cfg && cfg.stages && cfg.stages[sk]) {
                stageTheme = this.normalizeThemeId(cfg.stages[sk].theme);
            }
            const galaxy = planetConfigManager.getGalaxy(galaxyId);
            if (galaxy) {
                planetConfigManager.migrateGalaxyThemeToBaseColor(galaxy);
                if (galaxy.baseColor) {
                    galaxyPalette = this.ensureGalaxyPalette(galaxyId, galaxy.baseColor);
                } else {
                    galaxyPalette = this.normalizeThemeId(galaxy.theme);
                }
            }
        }

        if (stageTheme) {
            return { palette: stageTheme, source: 'stage', planetId: pid, stageKey: sk, galaxyId: galaxyId };
        }
        if (planetTheme) {
            return { palette: planetTheme, source: 'planet', planetId: pid, stageKey: sk, galaxyId: galaxyId };
        }
        if (galaxyPalette) {
            return { palette: galaxyPalette, source: 'galaxy', planetId: pid, stageKey: sk, galaxyId: galaxyId };
        }
        return { palette: this.appTheme, source: 'app', planetId: pid, stageKey: sk, galaxyId: galaxyId };
    }

    /**
     * Apply resolved theme for a planet/stage (gameplay or editor preview).
     */
    applyForPlanet(planetId, stageKey) {
        const resolved = this.resolveTheme(planetId, stageKey);
        if (resolved.source === 'app') {
            this.restoreAppTheme();
        } else {
            this.applyContextTheme(resolved.palette, {
                level: resolved.source,
                id: resolved.planetId,
                stageKey: resolved.stageKey,
                galaxyId: resolved.galaxyId,
                palette: resolved.palette
            });
        }
        return resolved;
    }

    /**
     * Apply from a CoreLevelManager level object.
     */
    applyForLevel(level) {
        if (!level) return this.restoreAppTheme();
        const planetId = (level.planetId || level.background || level.id || '')
            .toString().toLowerCase().split('-')[0];
        const stageKey = level.stageKey != null
            ? String(level.stageKey)
            : (level.isBoss ? 'boss' : (level.stage != null ? String(level.stage) : '1'));
        return this.applyForPlanet(planetId, stageKey);
    }
}

let themeContextManager = new ThemeContextManager();
