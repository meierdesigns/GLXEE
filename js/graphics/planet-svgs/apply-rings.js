"use strict";

// PlanetSVGManager methods, split from planet-svgs.js.
extendClass(PlanetSVGManager, {
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
    },

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
    },

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
    },

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
    },

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
    },

    createFactionPlanetSVG(planetId, faction, iconStyle, seed, baseColor, features) {
        const id = String(planetId || 'gen').toLowerCase();
        const style = String(iconStyle || 'banded').toLowerCase();
        const seedVal = seed != null ? seed : this.hashId(id + '|' + faction + '|' + style);
        return this.createPixelPlanetSVG(id, style, seedVal, baseColor, features);
    },

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
    },

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
    },

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
    },
});
