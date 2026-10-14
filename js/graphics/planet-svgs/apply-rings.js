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
        // Per-planet ring system: 1–4 bands, own widths, gaps and tilt.
        // Everything stays inside r + 3.4k so it fits the grid padding.
        const tones = [['ring', 'ringDark'], ['soft', 'ring'], ['ringDark', 'ring'], ['ring', 'soft']];
        const count = 1 + Math.floor(rng() * 4);
        const flat = 2.2 + rng() * 1.8;
        const rings = [];
        let at = r + (0.5 + rng() * 0.8) * k;
        for (let i = 0; i < count; i++) {
            const thick = (0.3 + rng() * (count === 1 ? 0.9 : 0.6)) * k;
            const radius = at + thick;
            if (radius + thick > r + 3.4 * k) break;
            const t = tones[Math.floor(rng() * tones.length)];
            rings.push({ radius: radius, thick: thick, toneA: t[0], toneB: t[1] });
            at = radius + thick + rng() * 0.7 * k;
        }
        rings.forEach((ring) => {
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const dx = x - cx;
                    const dy = (y - cy) * flat;
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
        // Noise-driven styles (extra-styles.js); storms / ice / rings below still apply.
        const extra = this.applyExtraStyle ? this.applyExtraStyle(grid, st, seed, meta, feat) : false;

        if (extra) {
            // Everything (incl. storms) was painted on the sphere.
        } else if (st === 'banded' || (feat.bands && st !== 'ringed')) {
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
            // Loose ice patches only on the classic styles (they don't turn).
            for (let i = 0; i < (extra ? 0 : 4); i++) {
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

        // Classic styles get the factions' city lamps too.
        if (!extra && this.applyClassicLamps) this.applyClassicLamps(grid, seed, meta, feat);

        if (feat.rings) {
            this.applyRings(grid, seed, meta);
        }
    },
    /**
     * Atmosphere pass on a copy of the finished grid: a bright sky-tinted
     * rim on the sun side, a dim scattering edge on the night side, and a
     * dithered translucent halo just outside the disc. Only empty cells get
     * halo and only body cells get rim, so rings stay on top.
     */
    applyAtmosphere(src, geo) {
        const grid = src.map((row) => row.slice());
        const n = grid.length;
        const { cx, cy, r } = geo;
        const k = geo.k || 1;
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const isRing = (t) => t === 'ring' || t === 'ringDark';
        const rimW = Math.max(1, k * 0.55);
        const haloW = Math.max(1, k * 0.9);
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > r + haloW || d < r - rimW * 1.6) continue;
                // Light from upper-left: 1 = facing the sun, 0 = night side.
                const lit = Math.max(0, Math.min(1, 0.5 - (dx + dy) / (d || 1) * 0.5));
                const th = bayer[(y % 4) * 4 + (x % 4)] / 16;
                const t = grid[y][x];
                if (d <= r) {
                    if (t === null || isRing(t)) continue;
                    const edge = (d - (r - rimW * 1.6)) / (rimW * 1.6); // 0 inner → 1 limb
                    if (lit > 0.6) {
                        // Thin limb line, brightest only right at the sun point.
                        if (edge > 0.72) grid[y][x] = lit > 0.88 ? 'atmoLight' : 'atmo';
                        else if (edge * (lit - 0.4) > th * 0.7 + 0.1) grid[y][x] = 'atmo';
                    } else if (lit < 0.3 && k > 1 && edge > 0.7 && th < 0.5) {
                        grid[y][x] = 'atmoNight';
                    }
                } else if (t === null) {
                    const fall = 1 - (d - r) / haloW; // 1 at the limb → 0 outside
                    const glow = fall * (0.15 + lit * 0.7);
                    if (glow > 0.7) grid[y][x] = 'atmoHaze';
                    else if (glow > th * 0.8 + 0.2) grid[y][x] = 'atmoHazeFaint';
                }
            }
        }
        return grid;
    },
    /**
     * Small moons on tilted orbits (feat.moons), drawn as pixel rects that
     * may sit outside the viewBox. rot (spin frames) moves them along; the
     * part behind the planet is hidden.
     */
    moonRects(grid, geo, palette) {
        const moons = geo && Array.isArray(geo.moons) ? geo.moons.slice(0, 1) : null;
        if (!Array.isArray(moons) || !moons.length) return [];
        const k = geo.k || 1;
        const out = [];
        moons.forEach((m) => {
            const a = m.phase + (geo.rot || 0) * m.speed;
            const orbit = geo.r + m.orbit * k;
            const mx = geo.cx + Math.cos(a) * orbit;
            const my = geo.cy + Math.sin(a) * orbit * m.tilt;
            const behind = Math.sin(a) < 0;
            const rr = Math.max(0.7, m.size * k);
            const lo = Math.floor(-rr - 1), hi = Math.ceil(rr + 1);
            for (let yy = lo; yy <= hi; yy++) {
                for (let xx = lo; xx <= hi; xx++) {
                    const px = Math.round(mx) + xx, py = Math.round(my) + yy;
                    const d = Math.hypot(px - mx, py - my);
                    if (d > rr) continue;
                    if (behind && grid[py] && grid[py][px] != null) continue;
                    const lit = ((px - mx) + (py - my)) / (rr || 1);
                    const tone = lit < -0.45 ? 'moon_0' : (lit < 0.5 ? 'moon_1' : 'moon_2');
                    out.push(`<rect x="${px}" y="${py}" width="1" height="1" fill="${this.toneFill(tone, palette)}"/>`);
                }
            }
        });
        return out;
    },
    gridToSvg(grid, uid, palette, geo) {
        if (geo) grid = this.applyAtmosphere(grid, geo);
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
        const moons = this.moonRects(grid, geo, palette);
        // Moons in front are drawn after the planet.
        rects.push.apply(rects, moons);
        return `
            <svg width="64" height="64" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="overflow: visible; image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;" data-planet-uid="${uid}"${geo && geo.r ? ` data-disc="${(geo.r / (n / 2)).toFixed(3)}"` : ''}>
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
        const built = this.buildBaseGrid(n, seedKey + '|' + id, radiusBias, k, (feat.rings ? 2 : 1) * k);
        built.moons = feat.moons;
        this.applyStyleDetails(built.grid, style, seedKey + '|' + style, built, feat);
        const palette = this.buildPalette(baseColor || this.namedPalettes[id] || '#808080', feat.altColor, feat);
        const uid = 'px_' + id.replace(/[^a-z0-9]/g, '') + '_' + this.hashId(seedKey).toString(16) + (k > 1 ? '_d' + k : '');
        return this.gridToSvg(built.grid, uid, palette, built);
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
        let style = this.resolveIconStyle(cfg, faction);
        let features = this.resolveFeatures(cfg, style);
        let baseColor = this.resolveBaseColor(cfg, id);
        // Planets of one faction share style + colour; give each its own look
        // unless the config pins it.
        if (!this.namedStyles[id]) {
            const look = this.varyPlanetLook(id, style, baseColor, features, cfg);
            style = look.style;
            features = look.features;
            baseColor = look.baseColor;
        }
        features = this.addPlanetExtras(id, cfg, features);
        const seed = this.hashId(
            id + '|' + faction + '|' + style + '|' + baseColor + '|' +
            (features.rings ? 'R' : '') + '|' + (cfg.galaxyId || '')
        );
        const svg = this.createFactionPlanetSVG(id, faction, style, seed, baseColor, features);
        this.planets[id] = svg;
        return svg;
    },
});
