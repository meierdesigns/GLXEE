"use strict";

// Planet SVG graphics — generative pixel-art globes tinted by planet identity
class PlanetSVGManager {
    constructor() {
        this.planets = {};
        this.gridSize = 16;
        this.namedPalettes = {
            mars: '#C44B2F',
            jupiter: '#D4893A',
            saturn: '#C9A84C',
            neptune: '#3A6EA5',
            pluto: '#8A7A9A'
        };
        this.namedStyles = {
            mars: 'pocked',
            jupiter: 'banded',
            saturn: 'ringed',
            neptune: 'banded',
            pluto: 'pocked'
        };
    }

    init() {
        this.createPlanetSVGs();
    }

    createPlanetSVGs() {
        Object.keys(this.namedStyles).forEach((id) => {
            this.planets[id] = this.createNamedPixelPlanet(
                id,
                this.namedStyles[id],
                this.namedPalettes[id]
            );
        });
    }

    hashId(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    seededRng(seed) {
        let s = (this.hashId(seed) >>> 0) || 1;
        return () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    normalizeHex(color) {
        if (!color || typeof color !== 'string') return null;
        let s = color.trim();
        if (s.indexOf('var(') === 0) return null;
        if (s.charAt(0) !== '#') s = '#' + s;
        if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
        return s.toUpperCase();
    }

    hexToRgb(hex) {
        const h = this.normalizeHex(hex);
        if (!h) return null;
        return {
            r: parseInt(h.slice(1, 3), 16),
            g: parseInt(h.slice(3, 5), 16),
            b: parseInt(h.slice(5, 7), 16)
        };
    }

    rgbToHex(r, g, b) {
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
        return '#' + [clamp(r), clamp(g), clamp(b)]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }

    mixHex(a, b, t) {
        const A = this.hexToRgb(a);
        const B = this.hexToRgb(b);
        if (!A || !B) return a || b || '#808080';
        const k = Math.max(0, Math.min(1, t));
        return this.rgbToHex(
            A.r + (B.r - A.r) * k,
            A.g + (B.g - A.g) * k,
            A.b + (B.b - A.b) * k
        );
    }

    shadeHex(hex, amount) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex || '#808080';
        if (amount >= 0) {
            return this.mixHex(hex, '#FFFFFF', amount);
        }
        return this.mixHex(hex, '#0A0A0A', -amount);
    }

    /** Build tone→hex map from a planet base color. */
    buildPalette(baseColor) {
        const base = this.normalizeHex(baseColor) || '#808080';
        return {
            light: this.shadeHex(base, 0.55),
            mid: this.shadeHex(base, 0.12),
            soft: this.shadeHex(base, 0.28),
            dark: this.shadeHex(base, -0.28),
            deep: this.shadeHex(base, -0.55),
            accent: this.mixHex(base, '#FFE8A0', 0.35),
            secondary: this.mixHex(base, '#4A6070', 0.25),
            ring: this.mixHex(this.shadeHex(base, 0.4), '#F0E6C8', 0.45),
            ringDark: this.mixHex(this.shadeHex(base, -0.1), '#A09070', 0.35)
        };
    }

    resolveFaction(cfg) {
        if (!cfg) return 'pirate';
        if (cfg.graphics && cfg.graphics.faction) return String(cfg.graphics.faction).toLowerCase();
        if (Array.isArray(cfg.factions) && cfg.factions[0]) return String(cfg.factions[0]).toLowerCase();
        if (typeof planetConfigManager !== 'undefined' && cfg.galaxyId) {
            return planetConfigManager.getGalaxyFaction(cfg.galaxyId);
        }
        return 'pirate';
    }

    layerPatternBlob(cfg) {
        const layers = (cfg && Array.isArray(cfg.backgroundLayers)) ? cfg.backgroundLayers : [];
        return layers.map((l) => String((l && l.pattern) || '').toLowerCase()).join(' ');
    }

    resolveFeatures(cfg, style) {
        const blob = this.layerPatternBlob(cfg);
        const st = String(style || '').toLowerCase();
        return {
            rings: st === 'ringed' || /\bring/.test(blob) || blob.indexOf('saturn_rings') !== -1,
            bands: st === 'banded' || /jupiter_bands|neptune_|bands/.test(blob),
            craters: st === 'pocked' || /mars_surface|mars_dust|crater/.test(blob),
            ice: /neptune_ice|ice|frost/.test(blob),
            storms: /storm|jupiter_storms|neptune_storms/.test(blob)
        };
    }

    resolveIconStyle(cfg, faction) {
        if (cfg && cfg.graphics && cfg.graphics.iconStyle) {
            return String(cfg.graphics.iconStyle).toLowerCase();
        }
        const id = cfg && cfg.id ? String(cfg.id).toLowerCase() : '';
        if (id && this.namedStyles[id]) return this.namedStyles[id];

        const blob = this.layerPatternBlob(cfg);
        if (blob.indexOf('saturn_rings') !== -1 || /\bring/.test(blob)) return 'ringed';
        if (/jupiter_bands|jupiter_atmosphere/.test(blob)) return 'banded';
        if (/mars_surface|mars_dust/.test(blob)) return 'pocked';
        if (/neptune_/.test(blob)) return 'banded';
        if (/grid|circuit|lines/.test(blob) && faction === 'machine') return 'faceted';

        const map = {
            terran: 'banded',
            kronax: 'cragged',
            voidborn: 'ringed',
            pirate: 'pocked',
            machine: 'faceted'
        };
        return map[faction] || 'banded';
    }

    resolveBaseColor(cfg, planetId) {
        const id = String(planetId || (cfg && cfg.id) || '').toLowerCase();
        if (cfg && cfg.baseColor) {
            const fromCfg = this.normalizeHex(cfg.baseColor);
            if (fromCfg) return fromCfg;
        }
        if (id && this.namedPalettes[id]) return this.namedPalettes[id];

        if (cfg && cfg.theme && typeof colorPaletteSystem !== 'undefined') {
            const tid = String(cfg.theme).toLowerCase();
            const p = colorPaletteSystem.palettes && colorPaletteSystem.palettes[tid];
            if (p && p.baseColor) {
                const fromTheme = this.normalizeHex(p.baseColor);
                if (fromTheme) return fromTheme;
            }
            const builtin = colorPaletteSystem.builtinDefs && colorPaletteSystem.builtinDefs[tid];
            if (builtin && builtin.baseColor) {
                const fromSrc = this.normalizeHex(builtin.baseColor);
                if (fromSrc) return fromSrc;
            }
        }

        if (typeof planetConfigManager !== 'undefined') {
            const faction = this.resolveFaction(cfg);
            const theme = planetConfigManager.getFactionPlanetTheme
                ? planetConfigManager.getFactionPlanetTheme(faction)
                : null;
            if (theme && theme.baseColor) {
                const fromFaction = this.normalizeHex(theme.baseColor);
                if (fromFaction) return fromFaction;
            }
            if (cfg && cfg.galaxyId) {
                const g = planetConfigManager.getGalaxy(cfg.galaxyId);
                if (g && g.baseColor) {
                    const fromGalaxy = this.normalizeHex(g.baseColor);
                    if (fromGalaxy) return fromGalaxy;
                }
            }
        }

        return this.namedPalettes[id] || '#808080';
    }

    toneFill(tone, palette) {
        if (palette && palette[tone]) return palette[tone];
        const map = {
            light: 'var(--color-text, #e0e0e0)',
            mid: 'var(--color-primary, #808080)',
            dark: 'var(--color-border, #404040)',
            deep: 'var(--color-background, #0a0a0a)',
            accent: 'var(--color-accent, #808080)',
            secondary: 'var(--color-secondary, #606060)',
            soft: 'var(--color-text-secondary, #a0a0a0)',
            ring: 'var(--color-text-secondary, #a0a0a0)',
            ringDark: 'var(--color-primary, #808080)'
        };
        return map[tone] || map.mid;
    }

    /**
     * Build a filled circle mask + base shading on an N×N grid. k is the
     * detail factor (1 = classic 16px icon); at k > 1 the sphere is lit as
     * a 3D ball with an ordered-dither terminator and a lit rim, so large
     * card views read as a globe instead of a blown-up icon.
     */
    buildBaseGrid(n, seed, radiusBias, k) {
        const kk = k || 1;
        const rng = this.seededRng(seed);
        const cx = (n - 1) / 2;
        const cy = (n - 1) / 2;
        const r = (n * 0.42) + ((radiusBias || 0) + (rng() - 0.5) * 0.4) * kk;
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        // Light from upper-left, slightly in front.
        const L = [-0.55, -0.6, 0.58];
        const grid = [];
        for (let y = 0; y < n; y++) {
            const row = [];
            for (let x = 0; x < n; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > r) {
                    row.push(null);
                    continue;
                }
                const nx = dx / r;
                const ny = dy / r;
                let light;
                if (kk > 1) {
                    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                    const lambert = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                    const dither = (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.12;
                    light = 0.1 + lambert * 0.72 + dither + (rng() - 0.5) * 0.03;
                } else {
                    light = 0.55 - nx * 0.35 - ny * 0.35 + (rng() - 0.5) * 0.08;
                }
                let tone = 'mid';
                if (light > 0.62) tone = 'light';
                else if (light > 0.38) tone = 'mid';
                else if (light > 0.18) tone = 'dark';
                else tone = 'deep';
                // Thin lit rim on the sun side (atmosphere edge).
                if (kk > 1 && d > r - kk * 0.9 && nx + ny < -0.3) tone = 'soft';
                row.push(tone);
            }
            grid.push(row);
        }
        return { grid: grid, cx: cx, cy: cy, r: r, rng: rng, k: kk };
    }

    setTone(grid, x, y, tone, allowEmpty) {
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
        if (grid[y][x] === null && !allowEmpty) return;
        grid[y][x] = tone;
    }
}
