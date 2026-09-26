"use strict";

// PlanetSVGManager methods, split from planet-svgs.js.
extendClass(PlanetSVGManager, {
    applyRings(grid, seed, meta) {
        const n = grid.length;
        const k = meta.k || 1;
        const rng = this.seededRng(seed + '|rings');
        const cx = meta.cx;
        const cy = meta.cy;
        const r = meta.r;
        const rings = [
            { radius: r + 1.15 * k, thick: 0.75 * k, toneA: 'ring', toneB: 'ringDark' },
            { radius: r + 2.15 * k, thick: 0.7 * k, toneA: 'soft', toneB: 'ring' }
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
                        if (!onBody || y >= cy - 0.5 * k) {
                            // Checker at k=1; at high detail, fine concentric lanes.
                            const lane = k > 1
                                ? Math.floor((d - ring.radius + ring.thick) / Math.max(1, k * 0.35)) % 2 === 0
                                : (x + y) % 2 === 0;
                            this.setTone(grid, x, y, lane ? ring.toneA : ring.toneB, true);
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
                if (d > r + 0.35 * k && d < r + 0.85 * k && y > cy) {
                    if (rng() > 0.55) this.setTone(grid, x, y, 'dark');
                }
            }
        }
    },

    /** Surface detail that keeps the sphere's shading: light marks don't paint the night side. */
    setSurface(grid, x, y, tone) {
        x = Math.round(x);
        y = Math.round(y);
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
        const base = grid[y][x];
        if (base === null) return;
        if (base === 'deep' && (tone === 'light' || tone === 'soft')) tone = 'dark';
        else if (base === 'deep' && tone === 'dark') tone = 'deep';
        grid[y][x] = tone;
    },

    /** Filled disc of a tone (surface detail). */
    stampDisc(grid, x, y, radius, toneFn) {
        const rr = Math.max(0.5, radius);
        const span = Math.ceil(rr);
        for (let yy = -span; yy <= span; yy++) {
            for (let xx = -span; xx <= span; xx++) {
                if (xx * xx + yy * yy <= rr * rr) this.setSurface(grid, x + xx, y + yy, toneFn(xx, yy, rr));
            }
        }
    },

    applyStyleDetails(grid, style, seed, meta, features) {
        const n = grid.length;
        const k = meta.k || 1;
        const rng = this.seededRng(seed + '|' + style);
        const cx = meta.cx;
        const cy = meta.cy;
        const r = meta.r;
        const st = String(style || 'banded').toLowerCase();
        const feat = features || {};
        // Classic icons keep their original look; the helpers only apply at k > 1.
        const put = k > 1 ? (x, y, t) => this.setSurface(grid, x, y, t) : (x, y, t) => this.setTone(grid, x, y, t);

        if (st === 'banded' || (feat.bands && st !== 'ringed')) {
            const bands = 3 + Math.floor(rng() * 3);
            for (let i = 0; i < bands; i++) {
                const y0 = Math.floor(2 * k + (i + 1) * (n - 4 * k) / (bands + 1) + (rng() - 0.5) * k);
                const tone = i % 2 === 0 ? 'dark' : 'soft';
                const thick = k > 1 ? Math.max(1, Math.round(k * (0.8 + rng() * 1.2))) : 1;
                const waveA = k > 1 ? k * (0.3 + rng() * 0.5) : 0;
                const waveF = 2 + rng() * 3;
                const phase = rng() * Math.PI * 2;
                for (let x = 0; x < n; x++) {
                    const yy = y0 + Math.round(Math.sin((x / n) * Math.PI * waveF + phase) * waveA);
                    for (let t = 0; t < thick; t++) put(x, yy + t, tone);
                    if (rng() > 0.45) put(x, yy + thick, tone);
                }
            }
            if (feat.storms) {
                const sx = Math.floor(cx + (-2 + rng() * 4) * k);
                const sy = Math.floor(cy + (-1 + rng() * 3) * k);
                if (k > 1) {
                    // Oval storm eye with a darker ring.
                    for (let yy = -k; yy <= k; yy++) {
                        for (let xx = -2 * k; xx <= 2 * k; xx++) {
                            const e = (xx * xx) / (4 * k * k) + (yy * yy) / (k * k);
                            if (e <= 1) put(sx + xx, sy + yy, e < 0.45 ? 'accent' : 'dark');
                        }
                    }
                } else {
                    put(sx, sy, 'accent');
                    put(sx + 1, sy, 'accent');
                    put(sx, sy + 1, 'light');
                }
            }
        } else if (st === 'cragged') {
            const cracks = (4 + Math.floor(rng() * 4)) * (k > 1 ? 2 : 1);
            for (let i = 0; i < cracks; i++) {
                let x = Math.floor(rng() * n);
                let y = Math.floor(rng() * n);
                const len = (3 + Math.floor(rng() * 5)) * k;
                for (let s = 0; s < len; s++) {
                    put(x, y, rng() > 0.5 ? 'deep' : 'accent');
                    x += rng() > 0.5 ? 1 : -1;
                    y += rng() > 0.4 ? 1 : 0;
                }
            }
            for (let i = 0; i < 5 * k; i++) {
                const x = Math.floor(rng() * n);
                const y = Math.floor(rng() * n);
                put(x, y, 'dark');
                put(x + 1, y, 'deep');
            }
        } else if (st === 'pocked' || feat.craters) {
            if (k > 1) {
                // Big craters with lit rims plus a spray of small pits.
                const craters = 6 + Math.floor(rng() * 6);
                for (let i = 0; i < craters; i++) {
                    const a = rng() * Math.PI * 2;
                    const dist = Math.sqrt(rng()) * r * 0.85;
                    const x = cx + Math.cos(a) * dist;
                    const y = cy + Math.sin(a) * dist;
                    const rr = (0.8 + rng() * 1.6) * k;
                    this.stampDisc(grid, x, y, rr, (xx, yy, R) => {
                        const edge = Math.sqrt(xx * xx + yy * yy) > R - Math.max(1, k * 0.3);
                        if (edge) return xx + yy > 0 ? 'light' : 'deep';
                        return yy < 0 ? 'deep' : 'dark';
                    });
                }
                for (let i = 0; i < 20 * k; i++) {
                    put(cx + (rng() - 0.5) * 2 * r, cy + (rng() - 0.5) * 2 * r, rng() > 0.5 ? 'dark' : 'soft');
                }
            } else {
                const craters = 5 + Math.floor(rng() * 6);
                for (let i = 0; i < craters; i++) {
                    const x = Math.floor(2 + rng() * (n - 4));
                    const y = Math.floor(2 + rng() * (n - 4));
                    const rr = 0.8 + rng() * 1.6;
                    for (let yy = -2; yy <= 2; yy++) {
                        for (let xx = -2; xx <= 2; xx++) {
                            if (xx * xx + yy * yy <= rr * rr) {
                                put(x + xx, y + yy, yy < 0 ? 'dark' : 'deep');
                            }
                        }
                    }
                    put(x - 1, y - 1, 'light');
                }
            }
        } else if (st === 'faceted') {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    if (grid[y][x] === null) continue;
                    const dx = x - cx;
                    const dy = y - cy;
                    if (Math.abs(dx) + Math.abs(dy) < r * 0.55) {
                        grid[y][x] = Math.floor((x + y) / k) % 3 === 0 ? 'secondary' : 'mid';
                    }
                    if (Math.abs(dx) < 0.6 * k || Math.abs(dy) < 0.6 * k) {
                        grid[y][x] = 'soft';
                    }
                    // Panel seams on the high-detail globe.
                    if (k > 1 && (Math.round(dx) % (2 * k) === 0 || Math.round(dy) % (2 * k) === 0) && grid[y][x] !== 'soft') {
                        grid[y][x] = grid[y][x] === 'deep' ? 'deep' : 'dark';
                    }
                }
            }
            const hx = Math.floor(cx + (-2 + rng() * 4) * k);
            const hy = Math.floor(cy + (-2 + rng() * 4) * k);
            if (k > 1) {
                this.stampDisc(grid, hx, hy, k * 0.9, (xx, yy) => (xx + yy < 0 ? 'light' : 'accent'));
            } else {
                put(hx, hy, 'accent');
                put(hx + 1, hy, 'accent');
                put(hx, hy + 1, 'light');
            }
        } else if (st === 'ringed') {
            // Surface bands under rings
            for (let i = 0; i < 3; i++) {
                const y0 = Math.floor(cy + (-2 + i * 2) * k);
                for (let x = 0; x < n; x++) {
                    for (let t = 0; t < k; t++) put(x, y0 + t, i % 2 === 0 ? 'dark' : 'soft');
                }
            }
            for (let i = 0; i < 3; i++) {
                const x = Math.floor(cx + (-2 + rng() * 5) * k);
                const y = Math.floor(cy + (-3 + rng() * 3) * k);
                if (k > 1) this.stampDisc(grid, x, y, k * 0.6, () => 'accent');
                else put(x, y, 'accent');
            }
        } else {
            for (let i = 0; i < 4; i++) {
                const x = Math.floor(2 * k + rng() * (n - 4 * k));
                const y = Math.floor(2 * k + rng() * (n - 4 * k));
                if (k > 1) this.stampDisc(grid, x, y, k * 0.8, () => 'dark');
                else put(x, y, 'dark');
            }
        }

        if (feat.ice && st !== 'pocked') {
            for (let i = 0; i < 4; i++) {
                const x = Math.floor(cx + (-3 + rng() * 6) * k);
                const y = Math.floor(cy + (-3 + rng() * 6) * k);
                if (k > 1) this.stampDisc(grid, x, y, k * 0.7, () => 'light');
                else put(x, y, 'light');
            }
            if (k > 1) {
                // Polar cap.
                for (let y = 0; y < n; y++) {
                    for (let x = 0; x < n; x++) {
                        if (grid[y][x] !== null && y < cy - r * 0.78) this.setSurface(grid, x, y, 'light');
                    }
                }
            }
        }

        if (feat.rings) {
            this.applyRings(grid, seed, meta);
        }
    },

    gridToSvg(grid, uid, palette) {
        const n = grid.length;
        const rects = [];
        // Merge horizontal runs of one tone into a single rect (keeps the
        // high-detail globes to a few hundred elements).
        for (let y = 0; y < n; y++) {
            let x = 0;
            while (x < n) {
                const tone = grid[y][x];
                if (!tone) { x++; continue; }
                let end = x + 1;
                while (end < n && grid[y][end] === tone) end++;
                rects.push(
                    `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${this.toneFill(tone, palette)}"/>`
                );
                x = end;
            }
        }
        return `
            <svg width="64" height="64" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;" data-planet-uid="${uid}">
                ${rects.join('')}
            </svg>
        `;
    },

    /** detail: grid multiplier (1 = 16px icon, 4 = large card art). */
    createPixelPlanetSVG(planetId, iconStyle, seed, baseColor, features, detail) {
        const k = Math.max(1, Math.round(detail || 1));
        const id = String(planetId || 'gen').toLowerCase();
        const style = String(iconStyle || 'banded').toLowerCase();
        const seedKey = String(seed != null ? seed : this.hashId(id));
        const feat = features || { rings: style === 'ringed' };
        if (k === 1) {
            // Remember how this planet was made so a detailed version can be built later.
            this.planetSpecs = this.planetSpecs || {};
            this.planetSpecs[id] = { style: style, seed: seed, baseColor: baseColor, features: feat };
        }
        const n = (feat.rings ? Math.max(this.gridSize, 18) : this.gridSize) * k;
        let radiusBias = ((this.hashId(id + '|r') % 5) - 2) * 0.15;
        if (feat.rings) radiusBias -= 1.1;
        const built = this.buildBaseGrid(n, seedKey + '|' + id, radiusBias, k);
        this.applyStyleDetails(built.grid, style, seedKey + '|' + style, built, feat);
        const palette = this.buildPalette(baseColor || this.namedPalettes[id] || '#808080');
        const uid = 'px_' + id.replace(/[^a-z0-9]/g, '') + '_' + this.hashId(seedKey).toString(16) + (k > 1 ? '_d' + k : '');
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
