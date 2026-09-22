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

    /** Build a filled circle mask + base shading on an N×N grid. */
    buildBaseGrid(n, seed, radiusBias) {
        const rng = this.seededRng(seed);
        const cx = (n - 1) / 2;
        const cy = (n - 1) / 2;
        const r = (n * 0.42) + (radiusBias || 0) + (rng() - 0.5) * 0.4;
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
                const light = 0.55 - nx * 0.35 - ny * 0.35 + (rng() - 0.5) * 0.08;
                let tone = 'mid';
                if (light > 0.62) tone = 'light';
                else if (light > 0.38) tone = 'mid';
                else if (light > 0.18) tone = 'dark';
                else tone = 'deep';
                row.push(tone);
            }
            grid.push(row);
        }
        return { grid: grid, cx: cx, cy: cy, r: r, rng: rng };
    }

    setTone(grid, x, y, tone, allowEmpty) {
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
        if (grid[y][x] === null && !allowEmpty) return;
        grid[y][x] = tone;
    }

    applyRings(grid, seed, meta) {
        const n = grid.length;
        const rng = this.seededRng(seed + '|rings');
        const cx = meta.cx;
        const cy = meta.cy;
        const r = meta.r;
        const rings = [
            { radius: r + 1.15, thick: 0.75, toneA: 'ring', toneB: 'ringDark' },
            { radius: r + 2.15, thick: 0.7, toneA: 'soft', toneB: 'ring' }
        ];
        rings.forEach((ring) => {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const dx = x - cx;
                    const dy = (y - cy) * 2.85;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (Math.abs(d - ring.radius) < ring.thick) {
                        const onBody = grid[y][x] !== null;
                        // Front half of ring always; back half only outside the body
                        if (!onBody || y >= cy - 0.5) {
                            const tone = ((x + y) % 2 === 0) ? ring.toneA : ring.toneB;
                            this.setTone(grid, x, y, tone, true);
                        }
                    }
                }
            }
        });
        // Soft gap between body and inner ring
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                if (grid[y][x] === null) continue;
                const dx = x - cx;
                const dy = (y - cy) * 2.85;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > r + 0.35 && d < r + 0.85 && y > cy) {
                    if (rng() > 0.55) this.setTone(grid, x, y, 'dark');
                }
            }
        }
    }

    applyStyleDetails(grid, style, seed, meta, features) {
        const n = grid.length;
        const rng = this.seededRng(seed + '|' + style);
        const cx = meta.cx;
        const cy = meta.cy;
        const r = meta.r;
        const st = String(style || 'banded').toLowerCase();
        const feat = features || {};

        if (st === 'banded' || (feat.bands && st !== 'ringed')) {
            const bands = 3 + Math.floor(rng() * 3);
            for (let i = 0; i < bands; i++) {
                const y0 = Math.floor(2 + (i + 1) * (n - 4) / (bands + 1) + (rng() - 0.5));
                const tone = i % 2 === 0 ? 'dark' : 'soft';
                for (let x = 0; x < n; x++) {
                    this.setTone(grid, x, y0, tone);
                    if (rng() > 0.45) this.setTone(grid, x, y0 + 1, tone);
                }
            }
            if (feat.storms) {
                const sx = Math.floor(cx - 2 + rng() * 4);
                const sy = Math.floor(cy - 1 + rng() * 3);
                this.setTone(grid, sx, sy, 'accent');
                this.setTone(grid, sx + 1, sy, 'accent');
                this.setTone(grid, sx, sy + 1, 'light');
            }
        } else if (st === 'cragged') {
            const cracks = 4 + Math.floor(rng() * 4);
            for (let i = 0; i < cracks; i++) {
                let x = Math.floor(rng() * n);
                let y = Math.floor(rng() * n);
                const len = 3 + Math.floor(rng() * 5);
                for (let s = 0; s < len; s++) {
                    this.setTone(grid, x, y, rng() > 0.5 ? 'deep' : 'accent');
                    x += rng() > 0.5 ? 1 : -1;
                    y += rng() > 0.4 ? 1 : 0;
                }
            }
            for (let i = 0; i < 5; i++) {
                const x = Math.floor(rng() * n);
                const y = Math.floor(rng() * n);
                this.setTone(grid, x, y, 'dark');
                this.setTone(grid, x + 1, y, 'deep');
            }
        } else if (st === 'pocked' || feat.craters) {
            const craters = 5 + Math.floor(rng() * 6);
            for (let i = 0; i < craters; i++) {
                const x = Math.floor(2 + rng() * (n - 4));
                const y = Math.floor(2 + rng() * (n - 4));
                const rr = 0.8 + rng() * 1.6;
                for (let yy = -2; yy <= 2; yy++) {
                    for (let xx = -2; xx <= 2; xx++) {
                        if (xx * xx + yy * yy <= rr * rr) {
                            this.setTone(grid, x + xx, y + yy, yy < 0 ? 'dark' : 'deep');
                        }
                    }
                }
                this.setTone(grid, x - 1, y - 1, 'light');
            }
        } else if (st === 'faceted') {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    if (grid[y][x] === null) continue;
                    const dx = x - cx;
                    const dy = y - cy;
                    if (Math.abs(dx) + Math.abs(dy) < r * 0.55) {
                        grid[y][x] = (x + y) % 3 === 0 ? 'secondary' : 'mid';
                    }
                    if (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) {
                        grid[y][x] = 'soft';
                    }
                }
            }
            const hx = Math.floor(cx - 2 + rng() * 4);
            const hy = Math.floor(cy - 2 + rng() * 4);
            this.setTone(grid, hx, hy, 'accent');
            this.setTone(grid, hx + 1, hy, 'accent');
            this.setTone(grid, hx, hy + 1, 'light');
        } else if (st === 'ringed') {
            // Surface bands under rings
            for (let i = 0; i < 3; i++) {
                const y0 = Math.floor(cy - 2 + i * 2);
                for (let x = 0; x < n; x++) {
                    this.setTone(grid, x, y0, i % 2 === 0 ? 'dark' : 'soft');
                }
            }
            for (let i = 0; i < 3; i++) {
                this.setTone(
                    grid,
                    Math.floor(cx - 2 + rng() * 5),
                    Math.floor(cy - 3 + rng() * 3),
                    'accent'
                );
            }
        } else {
            for (let i = 0; i < 4; i++) {
                this.setTone(
                    grid,
                    Math.floor(2 + rng() * (n - 4)),
                    Math.floor(2 + rng() * (n - 4)),
                    'dark'
                );
            }
        }

        if (feat.ice && st !== 'pocked') {
            for (let i = 0; i < 4; i++) {
                this.setTone(
                    grid,
                    Math.floor(cx - 3 + rng() * 6),
                    Math.floor(cy - 3 + rng() * 6),
                    'light'
                );
            }
        }

        if (feat.rings) {
            this.applyRings(grid, seed, meta);
        }
    }

    gridToSvg(grid, uid, palette) {
        const n = grid.length;
        const rects = [];
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const tone = grid[y][x];
                if (!tone) continue;
                rects.push(
                    `<rect x="${x}" y="${y}" width="1" height="1" fill="${this.toneFill(tone, palette)}"/>`
                );
            }
        }
        return `
            <svg width="64" height="64" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;" data-planet-uid="${uid}">
                ${rects.join('')}
            </svg>
        `;
    }

    createPixelPlanetSVG(planetId, iconStyle, seed, baseColor, features) {
        const id = String(planetId || 'gen').toLowerCase();
        const style = String(iconStyle || 'banded').toLowerCase();
        const seedKey = String(seed != null ? seed : this.hashId(id));
        const feat = features || { rings: style === 'ringed' };
        const n = feat.rings ? Math.max(this.gridSize, 18) : this.gridSize;
        let radiusBias = ((this.hashId(id + '|r') % 5) - 2) * 0.15;
        if (feat.rings) radiusBias -= 1.1;
        const built = this.buildBaseGrid(n, seedKey + '|' + id, radiusBias);
        this.applyStyleDetails(built.grid, style, seedKey + '|' + style, built, feat);
        const palette = this.buildPalette(baseColor || this.namedPalettes[id] || '#808080');
        const uid = 'px_' + id.replace(/[^a-z0-9]/g, '') + '_' + this.hashId(seedKey).toString(16);
        return this.gridToSvg(built.grid, uid, palette);
    }

    createNamedPixelPlanet(name, style, baseColor) {
        const id = String(name || 'gen').toLowerCase();
        const st = String(style || this.namedStyles[id] || 'banded').toLowerCase();
        const color = this.normalizeHex(baseColor) || this.namedPalettes[id] || '#808080';
        return this.createPixelPlanetSVG(
            id,
            st,
            this.hashId(id + '|' + color),
            color,
            { rings: st === 'ringed', bands: st === 'banded', craters: st === 'pocked' }
        );
    }

    createFactionPlanetSVG(planetId, faction, iconStyle, seed, baseColor, features) {
        const id = String(planetId || 'gen').toLowerCase();
        const style = String(iconStyle || 'banded').toLowerCase();
        const seedVal = seed != null ? seed : this.hashId(id + '|' + faction + '|' + style);
        return this.createPixelPlanetSVG(id, style, seedVal, baseColor, features);
    }

    registerFromConfig(cfg, options) {
        if (!cfg || !cfg.id) return null;
        const id = String(cfg.id).toLowerCase();
        const force = !!(options && options.force);
        if (!force && this.planets[id]) {
            return this.planets[id];
        }

        const faction = this.resolveFaction(cfg);
        const style = this.resolveIconStyle(cfg, faction);
        const features = this.resolveFeatures(cfg, style);
        const baseColor = this.resolveBaseColor(cfg, id);
        const seed = this.hashId(
            id + '|' + faction + '|' + style + '|' + baseColor + '|' +
            (features.rings ? 'R' : '') + '|' + (cfg.galaxyId || '')
        );
        const svg = this.createFactionPlanetSVG(id, faction, style, seed, baseColor, features);
        this.planets[id] = svg;
        return svg;
    }

    /** Drop cached SVGs so next register rebuilds generative pixel art. */
    invalidateGalaxy(planetIds) {
        const list = Array.isArray(planetIds) ? planetIds : [];
        list.forEach((pid) => {
            const id = String(pid || '').toLowerCase();
            if (!id) return;
            delete this.planets[id];
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
    }

    ensurePlanetGraphic(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id) return '';
        if (this.planets[id]) return this.planets[id];
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(id);
            if (cfg) return this.registerFromConfig(cfg) || '';
        }
        const style = this.namedStyles[id] || 'banded';
        const color = this.namedPalettes[id] || '#808080';
        const svg = this.createNamedPixelPlanet(id, style, color);
        this.planets[id] = svg;
        return svg;
    }

    getPlanetSVG(planetName) {
        const id = String(planetName || '').toLowerCase();
        if (!id) return '';
        if (this.planets[id]) return this.planets[id];
        return this.ensurePlanetGraphic(id) || '';
    }

    getPlanetDataURL(planetName) {
        const svg = this.getPlanetSVG(planetName);
        if (svg) {
            const encoded = encodeURIComponent(svg);
            return `data:image/svg+xml,${encoded}`;
        }
        return '';
    }
}

// Global planet SVG manager instance
const planetSVGManager = new PlanetSVGManager();
