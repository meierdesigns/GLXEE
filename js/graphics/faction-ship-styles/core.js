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
                anatomy: { front: { x: 0.8, y: 1.4 }, center: { x: 0.85, y: 1 }, back: { x: 0.9, y: 0.8 }, wing: { x: 1.35, y: 0.8 } },
                defaultWeapons: ['claw_beam'],
                prompt: 'diagonal claw blades, chevron spike hull, aggressive angled silhouette, brutal raider construction, reinforced armor wedges and serrated external plating'
            },
            voidborn: {
                id: 'voidborn',
                hull: fromTheme('voidborn', '#5B2C8A'),
                edge: '#2a1040',
                accent: '#c090ff',
                engine: this.sharedEngine,
                silhouette: 'rings',
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
                defaultWeapons: ['ion'],
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

    /** Per-part size multipliers (front/center/back/wing × x/y) for player hulls. */
    getFactionAnatomy(factionId) {
        const style = this.styles[this.normalizeFaction(factionId)];
        return (style && style.anatomy) || null;
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
     * Kept well below asset resolution so 32/64 assets stay crisp when scaled down.
     */
    displaySizeForClass(enemyClass) {
        switch (this.normalizeClass(enemyClass)) {
            // Relative to the 28px player: scouts ~0.8×, capitals ~1.45× (×tier ≤ 1.5×).
            case 'scout':
                return { width: 22, height: 17 };
            case 'assault':
                return { width: 26, height: 20 };
            case 'heavy':
                return { width: 31, height: 24 };
            case 'elite':
                return { width: 36, height: 28 };
            case 'capital':
            default:
                return { width: 40, height: 31 };
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
