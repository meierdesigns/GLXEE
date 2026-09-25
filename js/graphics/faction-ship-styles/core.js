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
                prompt: 'stepped rectangular modular plates, brick segment hull, orthogonal block silhouette, disciplined military construction, exposed service panels and clean docking rails'
            },
            kronax: {
                id: 'kronax',
                hull: fromTheme('kronax', '#C44B2F'),
                edge: '#4a1810',
                accent: '#ff7a4a',
                engine: this.sharedEngine,
                silhouette: 'spikes',
                prompt: 'diagonal claw blades, chevron spike hull, aggressive angled silhouette, brutal raider construction, reinforced armor wedges and serrated external plating'
            },
            voidborn: {
                id: 'voidborn',
                hull: fromTheme('voidborn', '#5B2C8A'),
                edge: '#2a1040',
                accent: '#c090ff',
                engine: this.sharedEngine,
                silhouette: 'rings',
                prompt: 'broken ring arcs, hollow center gap, incomplete crescent silhouette, ancient alien geometry, asymmetric void apertures and floating segmented armor'
            },
            pirate: {
                id: 'pirate',
                hull: fromTheme('pirate', '#8B6914'),
                edge: '#3a2e08',
                accent: '#d4a84a',
                engine: this.sharedEngine,
                silhouette: 'scrap',
                prompt: 'asymmetric L-block salvage, offset junk plates, uneven scrap silhouette, improvised welded wreckage, mismatched armor and exposed machinery'
            },
            machine: {
                id: 'machine',
                hull: fromTheme('machine', '#2F8F6B'),
                edge: '#0e3028',
                accent: '#50e0a8',
                engine: this.sharedEngine,
                silhouette: 'circuit',
                prompt: 'orthogonal circuit grid, notched right-angle traces, forge-node silhouette, precise machine fabrication, modular panels and glowing circuit channels'
            }
        };
    }

    getFactionStyle(factionId) {
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
        root.dataset.faction = id;
        root.style.setProperty('--faction-hull', style.hull || '#7a8490');
        root.style.setProperty('--faction-edge', style.edge || '#2a3038');
        root.style.setProperty('--faction-accent', style.accent || '#c8d0d8');
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
        return 0.92 + Math.max(1, Math.min(5, tier)) * 0.04;
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
     * Kept well below asset resolution so 32/64 assets stay crisp when scaled down.
     */
    displaySizeForClass(enemyClass) {
        switch (this.normalizeClass(enemyClass)) {
            case 'scout':
                return { width: 18, height: 14 };
            case 'assault':
                return { width: 24, height: 19 };
            case 'heavy':
                return { width: 30, height: 23 };
            case 'elite':
                return { width: 33, height: 26 };
            case 'capital':
            default:
                return { width: 39, height: 30 };
        }
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
