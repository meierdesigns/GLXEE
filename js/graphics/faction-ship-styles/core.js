"use strict";

/**
 * Faction ship visuals — identity by silhouette + per-faction colors.
 * Each enemyClass is a different topology; each faction remorphs that topology
 * and paints with its own hull/edge/accent (from getFactionPlanetTheme).
 * Fixed low-res grid with mirrored silhouettes. PNG: enemy-{faction}-{enemyClass}.
 */
class FactionShipStyles {
    constructor() {
        this.factions = ['terran', 'kronax', 'voidborn', 'pirate', 'machine'];
        this.classes = ['scout', 'assault', 'heavy', 'elite', 'capital'];
        this.classTier = {
            scout: 1,
            assault: 2,
            heavy: 3,
            elite: 4,
            capital: 5
        };
        // The fallback drawing grid stays compact. Asset resolution is 16/32/64
        // for crisp sprites; on-screen display size is separate (see displaySizeForClass).
        this.spriteW = 18;
        this.spriteH = 14;
        this.sharedHull = '#7a8490';
        this.sharedEdge = '#2a3038';
        this.sharedAccent = '#c8d0d8';
        this.sharedEngine = '#9ab0c0';
        // How far faction ships depart from a neutral hull: 1 = the base
        // anatomy/profiles below, 2 = twice as pronounced, 0 = all alike.
        this.styleStrength = 2;
        this.styles = this.buildFactionStyles();
        this.pixelCache = Object.create(null);
        this.buildAllPixelSprites();
    }

    buildFactionStyles() {
        // Theme colors are applied to the ship body and faction details.
        const fromTheme = (id, fallback) => {
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme) {
                const t = planetConfigManager.getFactionPlanetTheme(id);
                if (t && t.baseColor) return t.baseColor;
            }
            return fallback;
        };
        return {
            terran: {
                id: 'terran',
                hull: fromTheme('terran', '#3A6EA5'),
                edge: '#1a3048',
                accent: '#7ec8ff',
                engine: this.sharedEngine,
                silhouette: 'modular',
                // Balanced line fighter: even bands, straight mid wings.
                anatomy: { front: { x: 1, y: 1 }, center: { x: 1.1, y: 1 }, back: { x: 1.1, y: 1 }, wing: { x: 1, y: 0.9 } },
                defaultWeapons: ['laser'],
                prompt: 'stepped rectangular modular plates, brick segment hull, orthogonal block silhouette, disciplined military construction, exposed service panels and clean docking rails'
            },
            kronax: {
                id: 'kronax',
                hull: fromTheme('kronax', '#C44B2F'),
                edge: '#4a1810',
                accent: '#ff7a4a',
                engine: this.sharedEngine,
                silhouette: 'spikes',
                // Raider: long ram nose, slim body, wide swept blades.
                anatomy: { front: { x: 0.8, y: 1.4 }, center: { x: 0.85, y: 1 }, back: { x: 0.9, y: 0.8 }, wing: { x: 1.35, y: 1.05 } },
                defaultWeapons: ['claw_beam'],
                prompt: 'diagonal claw blades, chevron spike hull, aggressive angled silhouette, brutal raider construction, reinforced armor wedges and serrated external plating'
            },
            voidborn: {
                id: 'voidborn',
                hull: fromTheme('voidborn', '#7B2E86'),
                edge: '#3a1238',
                accent: '#f09cff',
                engine: this.sharedEngine,
                silhouette: 'rings',
                // Default wings sweep back (tips aft), never forward.
                wingVariants: ['delta', 'swept', 'razor'],
                // Ring body: stubby nose, broad core, tall narrow arcs.
                anatomy: { front: { x: 0.9, y: 0.7 }, center: { x: 1.3, y: 1.2 }, back: { x: 0.8, y: 0.8 }, wing: { x: 0.8, y: 1.3 } },
                defaultWeapons: ['wave'],
                prompt: 'broken ring arcs, hollow center gap, incomplete crescent silhouette, ancient alien geometry, asymmetric void apertures and floating segmented armor'
            },
            pirate: {
                id: 'pirate',
                hull: fromTheme('pirate', '#8B6914'),
                edge: '#3a2e08',
                accent: '#d4a84a',
                engine: this.sharedEngine,
                silhouette: 'scrap',
                // Salvage hauler: heavy engine block, short stubby wings.
                anatomy: { front: { x: 1.1, y: 0.85 }, center: { x: 1.1, y: 1 }, back: { x: 1.35, y: 1.2 }, wing: { x: 0.85, y: 1 } },
                defaultWeapons: ['spread'],
                prompt: 'asymmetric L-block salvage, offset junk plates, uneven scrap silhouette, improvised welded wreckage, mismatched armor and exposed machinery'
            },
            machine: {
                id: 'machine',
                hull: fromTheme('machine', '#2F8F6B'),
                edge: '#0e3028',
                accent: '#50e0a8',
                engine: this.sharedEngine,
                silhouette: 'circuit',
                // Forge drone: blocky, wide at every band.
                anatomy: { front: { x: 1.2, y: 0.9 }, center: { x: 1.2, y: 1.1 }, back: { x: 1.2, y: 1 }, wing: { x: 1.1, y: 1.1 } },
                // Machine family (see getFactionWeaponAffinity): missile / pierce.
                defaultWeapons: ['missile'],
                prompt: 'orthogonal circuit grid, notched right-angle traces, forge-node silhouette, precise machine fabrication, modular panels and glowing circuit channels'
            }
        };
    }

    /** Hue (0-359) of a #rrggbb colour. */
    hueOf(hex) {
        const [h] = this.hexToHsl(hex);
        return Math.round(h);
    }

    hexToHsl(hex) {
        const n = parseInt(String(hex).slice(1, 7), 16);
        const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
        let h = 0, sat = 0;
        if (d) {
            sat = d / (1 - Math.abs(2 * l - 1));
            if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
        }
        return [h, sat, l];
    }

    hslToHex(h, sat, l) {
        const c = (1 - Math.abs(2 * l - 1)) * sat, hp = (((h % 360) + 360) % 360) / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1)), m = l - c / 2;
        const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
        const to = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0');
        return '#' + to(r) + to(g) + to(b);
    }

    /**
     * Adjust a default colour: adj.h = new hue (0-359), adj.s = saturation in % of the
     * default (0 = grey), adj.l = lightness shift in points (-50 darker … +50 lighter).
     * Missing parts keep the default, so no adjustment returns the colour unchanged.
     */
    adjustColor(hex, adj) {
        const [h0, s0, l0] = this.hexToHsl(hex);
        const a = adj || {};
        const h = Number.isFinite(a.h) ? a.h : h0;
        const sat = Math.max(0, Math.min(1, s0 * (Number.isFinite(a.s) ? a.s : 100) / 100));
        const l = Math.max(0, Math.min(1, l0 + (Number.isFinite(a.l) ? a.l : 0) / 100));
        return this.hslToHex(h, sat, l);
    }

    /** The three SAT / LIGHT steps (middle = the faction's default). */
    get satSteps() { return [35, 100, 160]; }
    get lightSteps() { return [-22, 0, 22]; }

    /** Unsaved slider positions per faction ({key: {h, s, l}}); they show live until saved or reset. */
    getColorDrafts(factionId) {
        this._colorDrafts = this._colorDrafts || {};
        return this._colorDrafts[String(factionId || '').toLowerCase()] || {};
    }

    /** Baked enemy / ship sprites carry the old colours: drop them whenever a faction colour changes. */
    invalidateColorCaches() {
        // The station / HUD chrome reads the active faction's colours from the document root: refresh it live.
        if (typeof requestAnimationFrame === 'function' && !this._themeRaf) {
            this._themeRaf = requestAnimationFrame(() => {
                this._themeRaf = null;
                try { this.applyDocumentFactionTheme(); } catch (e) { /* theme not ready */ }
            });
        }
        if (typeof graphicsManager === 'undefined' || !graphicsManager) return;
        if (graphicsManager._variantCache && graphicsManager._variantCache.clear) graphicsManager._variantCache.clear();
        if (graphicsManager._voxelShipBake) graphicsManager._voxelShipBake = Object.create(null);
    }

    hasColorDraft(factionId) { return Object.keys(this.getColorDrafts(factionId)).length > 0; }

    setColorDraft(factionId, key, adj) {
        const id = String(factionId || '').toLowerCase();
        this._colorDrafts = this._colorDrafts || {};
        this._colorDrafts[id] = Object.assign({}, this._colorDrafts[id], { [key]: adj });
        this.invalidateColorCaches();
    }

    clearColorDraft(factionId, key) {
        const id = String(factionId || '').toLowerCase();
        if (!this._colorDrafts || !this._colorDrafts[id]) return;
        if (key) delete this._colorDrafts[id][key]; else delete this._colorDrafts[id];
        this.invalidateColorCaches();
    }

    /** Write the unsaved slider positions to storage. */
    commitColorDrafts(factionId) {
        const d = this.getColorDrafts(factionId);
        Object.keys(d).forEach((k) => {
            ['h', 's', 'l'].forEach((part) => this.setColorOverride(factionId, k, part, d[k][part]));
        });
        this.clearColorDraft(factionId);
    }

    /** Saved adjustments only (no drafts). */
    getSavedColorOverrides(factionId) {
        // Parsed once and reused: this runs several times per ship per frame.
        if (!this._savedColors) {
            try { this._savedColors = JSON.parse(localStorage.getItem('vf-faction-hsl') || '{}') || {}; } catch (e) { this._savedColors = {}; }
        }
        try {
            const all = this._savedColors;
            const o = all[String(factionId || '').toLowerCase()] || {};
            const out = {};
            ['hull', 'edge', 'accent', 'engine'].forEach((k) => {
                const v = o[k];
                if (!v || typeof v !== 'object') return;
                const r = {};
                if (Number.isFinite(v.h)) r.h = ((Math.round(v.h) % 360) + 360) % 360;
                if (Number.isFinite(v.s)) r.s = Math.max(0, Math.min(200, Math.round(v.s)));
                if (Number.isFinite(v.l)) r.l = Math.max(-50, Math.min(50, Math.round(v.l)));
                if (Object.keys(r).length) out[k] = r;
            });
            return out;
        } catch (e) { return {}; }
    }

    /** Saved adjustments with any live (unsaved) slider positions on top. */
    getColorOverrides(factionId) {
        const out = this.getSavedColorOverrides(factionId);
        const d = this.getColorDrafts(factionId);
        Object.keys(d).forEach((k) => { out[k] = Object.assign({}, d[k]); });
        return out;
    }

    /** part: 'h' | 's' | 'l'; value null (or part null) resets. */
    setColorOverride(factionId, key, part, value) {
        try {
            this.getSavedColorOverrides(factionId);
            const all = this._savedColors;
            const id = String(factionId || '').toLowerCase();
            all[id] = all[id] || {};
            if (!part) delete all[id][key];
            else {
                all[id][key] = all[id][key] || {};
                if (value == null) delete all[id][key][part]; else all[id][key][part] = Math.round(value);
            }
            localStorage.setItem('vf-faction-hsl', JSON.stringify(all));
        } catch (e) { /* storage unavailable */ }
        this.invalidateColorCaches();
    }

    /** Un-customised style (theme hull, no hue overrides). */
    getDefaultFactionStyle(factionId) {
        const id = String(factionId || 'pirate').toLowerCase();
        const base = this.styles[id] || this.styles.pirate;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionPlanetTheme) {
            const t = planetConfigManager.getFactionPlanetTheme(id);
            if (t && t.baseColor && t.baseColor !== base.hull) {
                return Object.assign({}, base, { hull: t.baseColor });
            }
        }
        return base;
    }

    getFactionStyle(factionId) {
        const style = this.getDefaultFactionStyle(factionId);
        const over = this.getColorOverrides(factionId);
        const keys = Object.keys(over);
        if (!keys.length) return style;
        const out = Object.assign({}, style);
        keys.forEach((k) => { if (/^#[0-9a-f]{6}$/i.test(style[k] || '')) out[k] = this.adjustColor(style[k], over[k]); });
        return out;
    }

    /** Per-part size multipliers (front/center/back/wing × x/y) for player hulls. */
    getFactionAnatomy(factionId) {
        const style = this.styles[this.normalizeFaction(factionId)];
        const base = style && style.anatomy;
        if (!base) return null;
        // styleStrength scales each part's deviation from a neutral 1.
        const k = this.styleStrength;
        const amp = (v) => Math.max(0.45, Math.min(2.4, 1 + ((Number(v) || 1) - 1) * k));
        const out = {};
        Object.keys(base).forEach((part) => {
            out[part] = { x: amp(base[part].x), y: amp(base[part].y) };
        });
        return out;
    }

    /** Global faction-difference factor for the hull builders (see styleStrength). */
    getStyleStrength() {
        return Number.isFinite(this.styleStrength) ? Math.max(0, this.styleStrength) : 1;
    }

    /** Weapons a fresh ship of this faction comes with. */
    getFactionDefaultWeapons(factionId) {
        const style = this.styles[this.normalizeFaction(factionId)];
        return (style && style.defaultWeapons) ? style.defaultWeapons.slice() : ['laser'];
    }

    /** The faction the player currently belongs to, however it was chosen. */
    resolveActiveFaction() {
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            if (profile && profile.faction) return this.normalizeFaction(profile.faction);
        }
        if (typeof factionManager !== 'undefined' && factionManager.getAllegiance) {
            const allegiance = factionManager.getAllegiance();
            if (allegiance) return this.normalizeFaction(allegiance);
        }
        return 'terran';
    }

    /**
     * Stamp the active faction's id and colors on the document root so every
     * surface — station chrome, in-game HUD, menus — can reskin itself from
     * one source instead of each screen theming its own container.
     */
    applyDocumentFactionTheme(factionId) {
        if (typeof document === 'undefined' || !document.documentElement) return null;
        const id = factionId ? this.normalizeFaction(factionId) : this.resolveActiveFaction();
        const style = this.getFactionStyle(id);
        const root = document.documentElement;
        // Switching faction on a live screen: fade colours instead of snapping.
        if (root.dataset.faction && root.dataset.faction !== id) {
            root.classList.add('vf-faction-fade');
            clearTimeout(this._factionFadeTimer);
            this._factionFadeTimer = setTimeout(() => root.classList.remove('vf-faction-fade'), 600);
        }
        root.dataset.faction = id;
        root.style.setProperty('--faction-hull', style.hull || '#7a8490');
        root.style.setProperty('--faction-edge', style.edge || '#2a3038');
        root.style.setProperty('--faction-accent', style.accent || '#c8d0d8');
        // The app palette follows the faction (skipped on first load, before
        // the palette system exists — ColorManager.init picks it up then).
        if (typeof themeContextManager !== 'undefined' && themeContextManager.refreshFactionTheme &&
            typeof colorPaletteSystem !== 'undefined') {
            try { themeContextManager.refreshFactionTheme(id); } catch (e) { /* palette not ready */ }
        }
        return id;
    }

    normalizeFaction(factionId) {
        const id = String(factionId || '').toLowerCase();
        return this.factions.indexOf(id) >= 0 ? id : 'pirate';
    }

    normalizeClass(enemyClass) {
        const id = String(enemyClass || '').toLowerCase();
        return this.classes.indexOf(id) >= 0 ? id : 'assault';
    }

    classFormPrompt(enemyClass) {
        switch (this.normalizeClass(enemyClass)) {
            case 'scout':
                return 'needle dart topology, thin 1-lane spine, sharp tip, NO wings, single rear thruster';
            case 'assault':
                return 'delta-wing fighter topology, short triangular mid-wings, twin thrusters, closed solid body';
            case 'heavy':
                return 'wide blunt brick topology, flat nose, side turret stubs, thick rectangle, NOT a scaled fighter';
            case 'elite':
                return 'X-cross command topology, forked twin nose prongs, diagonal fins, center gap';
            case 'capital':
                return 'split dual-hull carrier topology, wide flat deck, four corner thrusters, catamaran outline';
            default:
                return 'distinct spaceship topology';
        }
    }

    spriteKey(faction, enemyClass) {
        return 'enemy-' + this.normalizeFaction(faction) + '-' + this.normalizeClass(enemyClass);
    }

    emblemKey(faction) {
        return 'faction-' + this.normalizeFaction(faction);
    }

    emblemCamelKey(faction) {
        const id = this.normalizeFaction(faction);
        return 'faction' + id.charAt(0).toUpperCase() + id.slice(1);
    }

    resolveTier(opts) {
        const o = opts || {};
        if (o.tier != null && !isNaN(Number(o.tier))) {
            return Math.max(1, Math.min(5, Math.round(Number(o.tier))));
        }
        if (o.level != null && !isNaN(Number(o.level))) {
            return Math.max(1, Math.min(5, Math.round(Number(o.level))));
        }
        const cls = this.normalizeClass(o.enemyClass);
        return this.classTier[cls] || 2;
    }

    scaleMulForTier(tier) {
        // Narrow band (0.97–1.05) so tier never pushes a capital past 1.5× player.
        return 0.95 + Math.max(1, Math.min(5, tier)) * 0.02;
    }

    /** Asset / PNG pixel budget — not the on-screen hitbox size. */
    resolutionForClass(enemyClass) {
        switch (this.normalizeClass(enemyClass)) {
            case 'scout':
                return 16;
            case 'assault':
            case 'heavy':
                return 32;
            case 'elite':
            case 'capital':
            default:
                return 64;
        }
    }

    /**
     * On-screen footprint in playfield pixels (aspect ≈ sprite grid 18×14).
     * Scaled by Settings → Enemy Size (S–XXL) across the five class tiers.
     */
    displaySizeForClass(enemyClass) {
        let base;
        switch (this.normalizeClass(enemyClass)) {
            // Relative ladder: scout → capital. Defaults already larger than
            // the old 22–40 band so champions read clearly on the playfield.
            case 'scout':
                base = { width: 36, height: 28 };
                break;
            case 'assault':
                base = { width: 48, height: 36 };
                break;
            case 'heavy':
                base = { width: 58, height: 44 };
                break;
            case 'elite':
                base = { width: 70, height: 52 };
                break;
            case 'capital':
            default:
                base = { width: 84, height: 64 };
                break;
        }
        const mul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getEnemySizeMul)
            ? uiAppearanceManager.getEnemySizeMul(this.normalizeClass(enemyClass))
            : 1.35;
        return {
            width: Math.max(12, Math.round(base.width * mul)),
            height: Math.max(10, Math.round(base.height * mul))
        };
    }

    blankGrid() {
        const g = [];
        for (let r = 0; r < this.spriteH; r++) {
            g[r] = [];
            for (let c = 0; c < this.spriteW; c++) g[r][c] = 0;
        }
        return g;
    }

    setPx(g, c, r, v) {
        if (r < 0 || c < 0 || r >= this.spriteH || c >= this.spriteW) return;
        if (v > (g[r][c] || 0)) g[r][c] = v;
    }

    fillRect(g, c0, r0, w, h, v) {
        for (let r = r0; r < r0 + h; r++) {
            for (let c = c0; c < c0 + w; c++) this.setPx(g, c, r, v);
        }
    }

    clearPx(g, c, r) {
        if (r < 0 || c < 0 || r >= this.spriteH || c >= this.spriteW) return;
        g[r][c] = 0;
    }

    /** Deterministic hash for asymmetric scrap / accents. */
    hash(str) {
        let h = 2166136261;
        const s = String(str);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
}
