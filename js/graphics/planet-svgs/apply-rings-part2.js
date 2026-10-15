"use strict";

// PlanetSVGManager members, continued from apply-rings.js (kept under ~500 lines per file).
extendClass(PlanetSVGManager, {
    /**
     * Seeded per-planet variation: hue / saturation / lightness shift, a
     * chance of another surface style and extra features (storms, ice caps,
     * rings). Explicit cfg.baseColor / cfg.graphics.iconStyle are kept.
     */
    varyPlanetLook(id, style, baseColor, features, cfg) {
        const rng = this.seededRng(id + '|look');
        let st = style;
        const pinnedStyle = !!(cfg && cfg.graphics && cfg.graphics.iconStyle);
        // Faction default styles map to their spherical twins.
        const twin = { pocked: 'craters', cragged: 'cracked', faceted: 'crystal', banded: 'swirl', ringed: 'swirl' };
        if (!pinnedStyle && twin[st] && typeof PLANET_EXTRA_STYLES !== 'undefined') st = twin[st];
        if (!pinnedStyle && rng() < 0.8) {
            // Spherical (spin-safe) styles only; the classic flat ones stay
            // for configs that pin them.
            const pool = (typeof PLANET_EXTRA_STYLES !== 'undefined' ? PLANET_EXTRA_STYLES : ['banded', 'pocked', 'cragged'])
                .filter((s) => s !== style);
            st = pool[Math.floor(rng() * pool.length)];
        }
        const feat = Object.assign({}, features);
        feat.bands = st === 'banded' || (!!feat.bands && st === style);
        feat.craters = st === 'pocked' || (!!feat.craters && st === style);
        // Any style can carry rings now and then.
        feat.rings = st === 'ringed' || style === 'ringed' || rng() < 0.14;
        if (rng() < 0.3) feat.storms = true;
        if (rng() < 0.2) feat.ice = true;

        const toHsl = (hex) => {
            const rgb = this.hexToRgb(hex) || { r: 128, g: 128, b: 128 };
            const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0;
            const l = (max + min) / 2;
            const d = max - min;
            if (d) {
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : (max === g ? (b - r) / d + 2 : (r - g) / d + 4);
                h /= 6;
            }
            return { h, s, l };
        };
        const fromHsl = (h, s, l) => {
            h = ((h % 1) + 1) % 1;
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            const f = (t) => {
                t = ((t % 1) + 1) % 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            return this.rgbToHex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
        };

        let color = this.normalizeHex(baseColor) || '#808080';
        const src = toHsl(color);
        let h = src.h, s = src.s, l = src.l;
        // Explored planets store the galaxy (= ruling faction) colour as
        // baseColor; that is no real pin — the planet still gets its own hue.
        const galaxy = cfg && cfg.galaxyId && typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxy
            ? planetConfigManager.getGalaxy(cfg.galaxyId) : null;
        const pinnedColor = !!(cfg && cfg.baseColor) &&
            !(galaxy && galaxy.baseColor && this.normalizeHex(galaxy.baseColor) === this.normalizeHex(cfg.baseColor));
        if (!pinnedColor) {
            // Own colour anywhere on the wheel; factions only show as
            // city lights (applyFactionZones), not as the planet's hue.
            rng();
            h = rng();
            s = 0.25 + rng() * 0.6;
            l = 0.3 + rng() * 0.32;
            color = fromHsl(h, s, l);
        }
        // Second colour: land, bands, veins … — a clearly different hue.
        const altH = h + (rng() < 0.5 ? 1 : -1) * (0.12 + rng() * 0.38);
        feat.altColor = fromHsl(altH, Math.min(0.9, 0.3 + rng() * 0.6), Math.max(0.25, Math.min(0.7, l + (rng() - 0.5) * 0.35)));
        return { style: st, features: feat, baseColor: color };
    },
    /**
     * Clouds, moons and faction territory colours. Own rng stream, so the
     * existing per-planet looks (varyPlanetLook) stay the same.
     */
    addPlanetExtras(id, cfg, features) {
        const rng = this.seededRng(id + '|extras');
        const feat = Object.assign({}, features);
        if (rng() < 0.55) {
            const tints = ['#F2EEE6', '#E6ECF4', '#F4E8D8', '#DCE8E0'];
            feat.clouds = {
                cover: 0.12 + rng() * 0.33,
                scale: 1.4 + rng() * 2.6,
                stretch: 1 + rng() * 4,
                drift: rng() * 50,
                tint: tints[Math.floor(rng() * tints.length)]
            };
        }
        const moonCount = 1;
        if (moonCount) {
            feat.moons = [];
            for (let i = 0; i < moonCount; i++) {
                feat.moons.push({
                    orbit: 2.2 + i * 1.6 + rng() * 1.2,
                    size: 0.55 + rng() * 0.7,
                    tilt: 0.25 + rng() * 0.35,
                    phase: rng() * Math.PI * 2,
                    speed: (rng() < 0.5 ? 1 : 2) * (rng() < 0.25 ? -1 : 1)
                });
            }
        }
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetFactions &&
            typeof factionShipStyles !== 'undefined' && factionShipStyles.getFactionStyle) {
            let factions = [];
            try { factions = planetConfigManager.getPlanetFactions(id) || []; } catch (e) { factions = []; }
            feat.factionColors = factions.slice(0, 3)
                .map((f) => (factionShipStyles.getFactionStyle(f) || {}).accent)
                .filter((c) => !!this.normalizeHex(c));
        }
        return feat;
    },
    /** Drop cached SVGs so next register rebuilds generative pixel art. */
    invalidateGalaxy(planetIds) {
        const list = Array.isArray(planetIds) ? planetIds : [];
        list.forEach((pid) => {
            const id = String(pid || '').toLowerCase();
            if (!id) return;
            delete this.planets[id];
            if (this.planetsDetailed) {
                Object.keys(this.planetsDetailed).forEach((key) => {
                    if (key.indexOf(id + '@') === 0) delete this.planetsDetailed[key];
                });
            }
        });
        // Restore named defaults if wiped without configs yet
        Object.keys(this.namedStyles).forEach((id) => {
            if (!this.planets[id]) {
                this.planets[id] = this.createNamedPixelPlanet(
                    id,
                    this.namedStyles[id],
                    this.namedPalettes[id]
                );
            }
        });
    },
    ensurePlanetGraphic(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id) return '';
        if (this._selectorVariantVersion !== 1) {
            this._selectorVariantVersion = 1;
            Object.keys(this.planets || {}).forEach((key) => delete this.planets[key]);
            if (this.planetsDetailed) this.planetsDetailed = {};
        }
        if (this.planets[id]) return this.planets[id];
        // Mid-flight ambushes are ship encounters, not planets — never mint a
        // grey globe for ambush_* (victory used to show that instead of the wreck).
        if (id.indexOf('ambush_') === 0) return '';
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.configs
                ? planetConfigManager.configs[id]
                : (planetConfigManager.getConfig && planetConfigManager.getConfig(id));
            if (cfg && cfg.encounter) return '';
            if (cfg) return this.registerFromConfig(cfg) || '';
        }
        const style = this.namedStyles[id] || 'banded';
        const color = this.namedPalettes[id] || '#808080';
        const svg = this.createNamedPixelPlanet(id, style, color);
        this.planets[id] = svg;
        return svg;
    },
});
