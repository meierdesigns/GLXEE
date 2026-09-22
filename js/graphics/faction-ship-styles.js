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

    /**
     * Class = topology. Same pixel budget for all — never “one more tip”.
     * Grid origin: nose toward smaller row index.
     */
    paintClassTopology(g, enemyClass, cx) {
        const cls = this.normalizeClass(enemyClass);
        switch (cls) {
            case 'scout': {
                // Needle: 1–2 px spine, no wings
                this.fillRect(g, cx - 1, 2, 2, 1, 1);
                this.fillRect(g, cx - 1, 3, 2, 6, 2);
                this.fillRect(g, cx, 4, 1, 4, 3);
                this.setPx(g, cx, 9, 3);
                this.setPx(g, cx, 10, 2);
                break;
            }
            case 'assault': {
                // Delta: triangular mid-wings, solid core
                this.fillRect(g, cx - 2, 2, 4, 1, 1);
                this.fillRect(g, cx - 3, 3, 6, 5, 2);
                this.fillRect(g, cx - 2, 4, 4, 3, 3);
                this.fillRect(g, cx - 5, 5, 2, 2, 2);
                this.fillRect(g, cx + 3, 5, 2, 2, 2);
                this.setPx(g, cx - 1, 9, 3);
                this.setPx(g, cx + 1, 9, 3);
                this.setPx(g, cx - 1, 10, 2);
                this.setPx(g, cx + 1, 10, 2);
                break;
            }
            case 'heavy': {
                // Blunt brick + side turret stubs (no pointed nose)
                this.fillRect(g, cx - 5, 3, 10, 6, 2);
                this.fillRect(g, cx - 4, 4, 8, 4, 3);
                this.fillRect(g, cx - 6, 4, 1, 2, 1);
                this.fillRect(g, cx + 5, 4, 1, 2, 1);
                this.fillRect(g, cx - 6, 5, 1, 1, 2);
                this.fillRect(g, cx + 5, 5, 1, 1, 2);
                this.fillRect(g, cx - 3, 9, 2, 1, 3);
                this.fillRect(g, cx + 1, 9, 2, 1, 3);
                this.fillRect(g, cx - 3, 10, 2, 1, 2);
                this.fillRect(g, cx + 1, 10, 2, 1, 2);
                break;
            }
            case 'elite': {
                // X / fork: twin nose prongs + diagonal fins + center gap
                this.setPx(g, cx - 2, 1, 1);
                this.setPx(g, cx + 2, 1, 1);
                this.setPx(g, cx - 1, 2, 2);
                this.setPx(g, cx + 1, 2, 2);
                this.fillRect(g, cx - 3, 3, 2, 4, 2);
                this.fillRect(g, cx + 1, 3, 2, 4, 2);
                this.fillRect(g, cx - 1, 4, 2, 2, 3);
                this.setPx(g, cx - 5, 4, 1);
                this.setPx(g, cx - 4, 5, 2);
                this.setPx(g, cx + 4, 4, 1);
                this.setPx(g, cx + 3, 5, 2);
                this.setPx(g, cx - 5, 6, 1);
                this.setPx(g, cx + 5, 6, 1);
                this.setPx(g, cx - 2, 8, 2);
                this.setPx(g, cx + 2, 8, 2);
                this.setPx(g, cx - 2, 9, 3);
                this.setPx(g, cx + 2, 9, 3);
                this.setPx(g, cx - 2, 10, 2);
                this.setPx(g, cx + 2, 10, 2);
                break;
            }
            case 'capital':
            default: {
                // Dual-hull / catamaran deck — different topology from heavy brick
                this.fillRect(g, cx - 7, 3, 3, 5, 2);
                this.fillRect(g, cx + 4, 3, 3, 5, 2);
                this.fillRect(g, cx - 4, 4, 8, 4, 2);
                this.fillRect(g, cx - 3, 5, 6, 2, 3);
                this.fillRect(g, cx - 6, 2, 2, 1, 1);
                this.fillRect(g, cx + 4, 2, 2, 1, 1);
                this.setPx(g, cx - 7, 8, 3);
                this.setPx(g, cx - 5, 8, 3);
                this.setPx(g, cx + 4, 8, 3);
                this.setPx(g, cx + 6, 8, 3);
                this.setPx(g, cx - 7, 9, 2);
                this.setPx(g, cx - 5, 9, 2);
                this.setPx(g, cx + 4, 9, 2);
                this.setPx(g, cx + 6, 9, 2);
                break;
            }
        }
    }

    /** Faction remorphs topology — never color, never tip-stacking. */
    paintFactionMorph(g, silhouette, enemyClass, cx, seed) {
        const cls = this.normalizeClass(enemyClass);
        switch (silhouette) {
            case 'modular': {
                // Step sides into plate blocks
                for (let r = 3; r <= 8; r++) {
                    if (r % 2 === 0) {
                        this.setPx(g, cx - 4 - (cls === 'capital' ? 2 : 0), r, 1);
                        this.setPx(g, cx + 3 + (cls === 'capital' ? 2 : 0), r, 1);
                    }
                }
                if (cls === 'assault' || cls === 'heavy') {
                    this.fillRect(g, cx - 1, 4, 2, 2, 3);
                }
                break;
            }
            case 'spikes': {
                // Replace soft wings with diagonal claws
                this.setPx(g, cx - 4, 3, 1);
                this.setPx(g, cx - 5, 4, 1);
                this.setPx(g, cx - 6, 5, 2);
                this.setPx(g, cx + 3, 3, 1);
                this.setPx(g, cx + 4, 4, 1);
                this.setPx(g, cx + 5, 5, 2);
                if (cls !== 'scout') {
                    this.setPx(g, cx - 3, 2, 1);
                    this.setPx(g, cx + 3, 2, 1);
                }
                break;
            }
            case 'rings': {
                // Hollow / arc — punch center, draw incomplete ring
                if (cls === 'scout') {
                    this.clearPx(g, cx, 5);
                    this.clearPx(g, cx, 6);
                } else {
                    this.clearPx(g, cx, 5);
                    this.clearPx(g, cx - 1, 5);
                    this.clearPx(g, cx + 1, 5);
                    this.clearPx(g, cx, 6);
                }
                const rr = cls === 'capital' ? 5 : (cls === 'scout' ? 2 : 4);
                for (let a = 0; a < 12; a++) {
                    if (a === 9 || a === 10) continue; // broken ring gap
                    const ang = (a / 12) * Math.PI * 2;
                    const px = Math.round(cx + Math.cos(ang) * rr);
                    const py = Math.round(5 + Math.sin(ang) * (rr * 0.55));
                    this.setPx(g, px, py, a % 2 ? 1 : 2);
                }
                break;
            }
            case 'scrap': {
                // Asymmetric L-blocks — chop one side, pad the other
                const leftHeavy = (seed & 1) === 0;
                if (leftHeavy) {
                    this.fillRect(g, cx - 6, 6, 2, 2, 1);
                    this.fillRect(g, cx - 5, 7, 3, 1, 2);
                    this.clearPx(g, cx + 4, 4);
                    this.clearPx(g, cx + 5, 5);
                } else {
                    this.fillRect(g, cx + 4, 6, 2, 2, 1);
                    this.fillRect(g, cx + 2, 7, 3, 1, 2);
                    this.clearPx(g, cx - 5, 4);
                    this.clearPx(g, cx - 6, 5);
                }
                break;
            }
            case 'circuit': {
                // Orthogonal notches + grid traces only
                for (let c = cx - 4; c <= cx + 4; c += 2) {
                    this.setPx(g, c, 3, 1);
                    this.setPx(g, c, 8, 1);
                }
                this.setPx(g, cx - 3, 5, 2);
                this.setPx(g, cx + 2, 5, 2);
                this.setPx(g, cx - 2, 6, 1);
                this.setPx(g, cx + 1, 6, 1);
                if (cls === 'elite' || cls === 'capital') {
                    this.fillRect(g, cx - 1, 5, 2, 2, 3);
                }
                break;
            }
            default:
                break;
        }
    }

    enginePositions(enemyClass, cx) {
        const cls = this.normalizeClass(enemyClass);
        switch (cls) {
            case 'scout':
                return [{ x: cx, y: 10 }];
            case 'assault':
                return [{ x: cx - 1, y: 10 }, { x: cx + 1, y: 10 }];
            case 'heavy':
                return [{ x: cx - 2, y: 10 }, { x: cx + 2, y: 10 }];
            case 'elite':
                return [{ x: cx - 2, y: 10 }, { x: cx + 2, y: 10 }];
            case 'capital':
                return [
                    { x: cx - 7, y: 9 },
                    { x: cx - 5, y: 9 },
                    { x: cx + 4, y: 9 },
                    { x: cx + 6, y: 9 }
                ];
            default:
                return [{ x: cx - 1, y: 10 }, { x: cx + 1, y: 10 }];
        }
    }

    buildPixelSprite(faction, enemyClass) {
        const style = this.getFactionStyle(faction);
        const cls = this.normalizeClass(enemyClass);
        const g = this.blankGrid();
        const cx = Math.floor(this.spriteW / 2);
        const seed = this.hash(faction + '|' + cls);

        this.paintClassTopology(g, cls, cx);
        this.paintFactionMorph(g, style.silhouette, cls, cx, seed);
        this.mirrorSprite(g, cx);

        return g;
    }

    mirrorSprite(g, cx) {
        for (let r = 0; r < this.spriteH; r++) {
            for (let d = 1; cx - d >= 0 && cx + d < this.spriteW; d++) {
                const value = Math.max(g[r][cx - d] || 0, g[r][cx + d] || 0);
                g[r][cx - d] = value;
                g[r][cx + d] = value;
            }
        }
    }

    shadeColor(color, amount) {
        const hex = String(color || '').replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#808080';
        const n = parseInt(hex, 16);
        const target = amount < 0 ? 0 : 255;
        const p = Math.abs(amount);
        const channel = (shift) => {
            const value = (n >> shift) & 255;
            return Math.round(value + (target - value) * p);
        };
        return '#' + [channel(16), channel(8), channel(0)]
            .map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    /** Indexed pixel colors for a faction (edge / hull / accent). */
    buildFactionColors(factionId) {
        const style = this.getFactionStyle(factionId);
        const base = style.hull || '#808080';
        return {
            0: 'transparent',
            1: style.edge || this.shadeColor(base, -0.55),
            2: base,
            3: style.accent || this.shadeColor(base, 0.55)
        };
    }

    getFactionColor(factionId) {
        const style = this.getFactionStyle(factionId);
        return style.hull || '#808080';
    }

    buildEngineGlow(faction, enemyClass, tier) {
        const t = Math.max(1, Math.min(5, tier || 1));
        const cx = Math.floor(this.spriteW / 2);
        const positions = this.enginePositions(enemyClass, cx).map((p) => ({
            x: p.x,
            y: p.y,
            intensity: 0.55 + t * 0.08
        }));
        return {
            positions: positions,
            color: this.sharedEngine,
            width: this.spriteW,
            height: this.spriteH
        };
    }

    buildAllPixelSprites() {
        this.factions.forEach((f) => {
            this.classes.forEach((c) => {
                const key = this.spriteKey(f, c);
                this.pixelCache[key] = this.buildPixelSprite(f, c);
            });
        });
    }

    getPixelSprite(faction, enemyClass) {
        const key = this.spriteKey(faction, enemyClass);
        if (!this.pixelCache[key]) {
            this.pixelCache[key] = this.buildPixelSprite(faction, enemyClass);
        }
        return this.pixelCache[key];
    }

    hasPng(spriteKey) {
        return !!(typeof spriteLoader !== 'undefined'
            && spriteLoader.getSprite
            && spriteLoader.getSprite(spriteKey));
    }

    resolveEnemyMeta(opts) {
        const o = opts || {};
        let faction = o.faction;
        let enemyClass = o.enemyClass;
        const typeId = o.typeId || o.type;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType && typeId) {
            const tax = planetConfigManager.taxonomyForType(typeId);
            if (!faction) faction = tax.faction;
            if (!enemyClass) enemyClass = tax.enemyClass;
        }
        if (!faction && typeof enemyConfigManager !== 'undefined' && typeId) {
            faction = enemyConfigManager.getDefaultFaction
                ? enemyConfigManager.getDefaultFaction(typeId)
                : 'pirate';
        }
        return {
            faction: this.normalizeFaction(faction),
            enemyClass: this.normalizeClass(enemyClass),
            tier: this.resolveTier({
                tier: o.tier,
                level: o.level,
                enemyClass: enemyClass
            })
        };
    }

    /**
     * @returns {{
     *   faction: string, enemyClass: string, tier: number,
     *   spriteKey: string, hasPng: boolean,
     *   scaleMul: number, decor: object, model: object
     * }}
     */
    resolveFactionShipVisual(opts) {
        const meta = this.resolveEnemyMeta(opts);
        const key = this.spriteKey(meta.faction, meta.enemyClass);
        const hasPng = this.hasPng(key);
        const style = this.getFactionStyle(meta.faction);
        const colors = this.buildFactionColors(meta.faction);
        const themeColors = {
            edge: colors[1],
            hull: colors[2],
            accent: colors[3]
        };
        const sprite = this.getPixelSprite(meta.faction, meta.enemyClass);
        const scaleMul = this.scaleMulForTier(meta.tier);
        // Asset resolution (16/32/64) is for crisp sprites; display size is playfield px.
        const resolution = this.resolutionForClass(meta.enemyClass);
        const display = this.displaySizeForClass(meta.enemyClass);
        const model = {
            name: String(meta.faction).toUpperCase() + ' ' + String(meta.enemyClass).toUpperCase(),
            type: 'enemy',
            modelClass: meta.enemyClass === 'scout' ? 'scout'
                : (meta.enemyClass === 'capital' ? 'battleship'
                    : (meta.enemyClass === 'heavy' ? 'cruiser' : 'fighter')),
            faction: meta.faction,
            enemyClass: meta.enemyClass,
            tier: meta.tier,
            factionSpriteKey: key,
            weakenOverlay: true,
            forceEnemyOrientation: true,
            assetResolution: resolution,
            width: display.width,
            height: display.height,
            sprite: sprite,
            colors: colors,
            engineGlow: this.buildEngineGlow(meta.faction, meta.enemyClass, meta.tier)
        };
        return {
            faction: meta.faction,
            enemyClass: meta.enemyClass,
            tier: meta.tier,
            spriteKey: key,
            hasPng: hasPng,
            scaleMul: scaleMul,
            decor: {
                stripes: meta.tier,
                accent: themeColors.accent,
                edge: themeColors.edge,
                hull: themeColors.hull
            },
            model: model,
            style: style
        };
    }

    /** Draw tier rank marks near the ship after hull render. */
    drawTierDecor(ctx, enemy, visual, scale) {
        if (!ctx || !enemy || !visual || !visual.decor) return;
        const n = Math.max(0, Math.min(5, visual.decor.stripes || 0));
        if (n <= 0) return;
        const s = scale || 1;
        const x = enemy.x + enemy.width * 0.5;
        const y = enemy.y + enemy.height + 2 * s;
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i % 2 === 0 ? visual.decor.accent : visual.decor.edge;
            ctx.fillRect(x - n * 2 + i * 4, y, 3, 2);
        }
        ctx.restore();
    }

    listFactionShipSpriteKeys() {
        const keys = [];
        this.factions.forEach((f) => {
            this.classes.forEach((c) => keys.push(this.spriteKey(f, c)));
        });
        return keys;
    }

    listEmblemKeys() {
        return this.factions.map((f) => this.emblemKey(f));
    }

    buildShipPrompt(faction, enemyClass) {
        const style = this.getFactionStyle(faction);
        return 'top-down enemy spaceship, monochrome hull in ' + (style.hull || '#808080')
            + ' with light and dark shading of the same hue, '
            + 'faction color identity, no multicolor rainbow palette, '
            + 'identity by mirrored silhouette topology, '
            + style.prompt + ', '
            + this.classFormPrompt(enemyClass)
            + ', render at ' + this.resolutionForClass(enemyClass) + 'x'
            + this.resolutionForClass(enemyClass) + ' pixel resolution, '
            + 'do not differentiate by adding tips or nubs, hostile silhouette, crisp pixels';
    }

    buildEmblemPrompt(faction) {
        const style = this.getFactionStyle(faction);
        const meta = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getFactionMeta)
            ? planetConfigManager.getFactionMeta(faction)
            : { label: String(faction).toUpperCase() };
        return 'faction emblem icon, ' + (meta.label || faction) + ', '
            + style.silhouette + ' motif, tinted ' + (style.hull || '#808080')
            + ', simple glyph, 16x16 pixel feel, game UI icon';
    }
}

const factionShipStyles = new FactionShipStyles();
window.FactionShipStyles = FactionShipStyles;
window.factionShipStyles = factionShipStyles;
