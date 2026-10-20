"use strict";

// RenderManager methods: planet/faction environment art. Obstacles are baked
// as pixel art in the planet's colour, shaped by the faction that holds the
// planet; regular (scrolling) stages also get Xenon-style side terrain with
// faction structures. Environment comes from obstacleManager.getEnvironment().
// Fog cells thinner than this stay open (higher = sparser fog).
const FOG_MIN_DENSITY = 0.3;
// Ground scroll speed relative to the walls (parallax depth).
const GROUND_PARALLAX = 0.5;

extendClass(RenderManager, {
    getCombatEnvironment() {
        return (typeof obstacleManager !== 'undefined' && obstacleManager.getEnvironment)
            ? obstacleManager.getEnvironment()
            : { base: '#7a7f88', accent: '#8B6914', style: 'asteroid' };
    },
    /** Mix two colours (t = 0 → a, 1 → b). */
    mixColor(a, b, t) {
        const parse = (c) => {
            const m = String(this.shadeColor(c, 0)).match(/(\d+),(\d+),(\d+)/);
            return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
        };
        const pa = parse(a);
        const pb = parse(b);
        const f = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
        return 'rgb(' + f(0) + ',' + f(1) + ',' + f(2) + ')';
    },
    /** Rotate a colour's hue by `deg` and scale its saturation. */
    hueShift(color, deg, satMul) {
        const m = String(this.shadeColor(color, 0)).match(/(\d+),(\d+),(\d+)/);
        if (!m) return color;
        const r = m[1] / 255, g = m[2] / 255, b = m[3] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0, sat = 0;
        if (max !== min) {
            const d = max - min;
            sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h *= 60;
        }
        h = (((h + deg) % 360) + 360) % 360;
        sat = Math.max(0, Math.min(1, sat * (satMul == null ? 1 : satMul)));
        const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
        const pp = 2 * l - q;
        const ch = (t) => {
            t = ((t % 1) + 1) % 1;
            const v = t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp;
            return Math.round(v * 255);
        };
        return 'rgb(' + ch(h / 360 + 1 / 3) + ',' + ch(h / 360) + ',' + ch(h / 360 - 1 / 3) + ')';
    },
    pickWeighted(list, rnd) {
        const pool = list && list.length ? list : [{ id: 'asteroid', weight: 1 }];
        let total = 0;
        pool.forEach((e) => { total += e.weight || 1; });
        let r = rnd() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= pool[i].weight || 1;
            if (r <= 0) return pool[i].id;
        }
        return pool[pool.length - 1].id;
    },
    /** 4 body tones (light → dark) from the planet colour, a bit desaturated. */
    environmentTones(base, jitter) {
        const rock = this.mixColor(base, '#7a7f88', 0.35 + (jitter || 0));
        return [0.35, 0.1, -0.25, -0.5].map((t) => this.shadeColor(rock, t));
    },
    bakeObstacleImage(obstacle, isShield) {
        const cell = (typeof obstacleManager !== 'undefined' && obstacleManager.terrainCell)
            ? obstacleManager.terrainCell()
            : (1 / OBSTACLE_ART_DENSITY);
        const d = 1 / Math.max(0.5, cell);
        const gw = Math.max(4, Math.round(obstacle.width * d));
        const gh = Math.max(4, Math.round(obstacle.height * d));
        let seed = Math.floor(Math.random() * 1e9);
        const rnd = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const env = this.getCombatEnvironment();
        // Each rock draws its own shape family, hue variant, material and
        // surface from the level's environment, so a field is never uniform.
        const style = isShield ? 'shield' : this.pickWeighted(env.styles || [{ id: env.style || 'asteroid', weight: 1 }], rnd);
        const material = this.pickWeighted(env.resources || [{ id: 'scrap', weight: 1 }], rnd);
        const surface = env.surface || 'plain';
        const tint = this.hueShift(env.base, (rnd() - 0.5) * 50, 0.7 + rnd() * 0.6);
        const tones = this.environmentTones(tint, (rnd() - 0.5) * 0.3);
        const accent = this.shadeColor(env.accent, 0.35);
        const matColor = {
            ore: rnd() < 0.5 ? '#e8d9a0' : '#c9ced6',
            crystal: this.shadeColor(this.hueShift(env.base, 180, 1.4), 0.45),
            voltex: '#ff5cf0',
            scrap: '#b5652a'
        }[material] || '#c9ced6';
        const surfaceColor = { lava: '#ff7a2a', ice: '#dff4ff', void: '#b36bff', toxic: '#9be83a' }[surface] || null;
        const band = 3 + Math.floor(rnd() * 3);
        const crystals = [];
        if (material === 'crystal') {
            const n = 1 + Math.floor(rnd() * 2);
            for (let i = 0; i < n; i++) crystals.push({ x: (rnd() - 0.5) * 0.8, y: (rnd() - 0.5) * 0.8, r: 0.14 + rnd() * 0.12 });
        }
        const outline = '#05060a';
        const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;

        // Silhouette per style: returns true inside the shape.
        const shape = (nx, ny) => {
            const a = Math.atan2(ny, nx);
            const r = Math.hypot(nx, ny);
            switch (style) {
                case 'shield': {
                    const seg = Math.PI / 3;
                    const t = ((a % seg) + seg) % seg - seg / 2;
                    return r <= 0.92 * Math.cos(Math.PI / 6) / Math.cos(t);
                }
                case 'scrap': // wreck plate with notched corners
                    return Math.abs(nx) < 0.92 && Math.abs(ny) < 0.78
                        && Math.abs(nx) + Math.abs(ny) < 1.45 + Math.sin(p1) * 0.15;
                case 'spike': { // jagged claw shard
                    const arms = 4 + Math.floor(p2);
                    const spike = 0.45 + 0.5 * Math.pow(Math.abs(Math.cos(a * arms / 2 + p1)), 3);
                    return r <= spike;
                }
                case 'tech': { // octagonal machine block
                    return Math.abs(nx) < 0.9 && Math.abs(ny) < 0.9 && Math.abs(nx) + Math.abs(ny) < 1.3;
                }
                case 'organic': // lumpy biomass
                    return r <= 0.72 + 0.16 * Math.sin(a * 4 + p1) + 0.1 * Math.sin(a * 7 + p2);
                default:
                    return r <= 0.8 + 0.1 * Math.sin(a * 3 + p1) + 0.06 * Math.sin(a * 5 + p2) + 0.04 * Math.sin(a * 7 + p3);
            }
        };
        const inside = (px, py) => {
            if (px < 0 || py < 0 || px >= gw || py >= gh) return false;
            return shape(((px + 0.5) / gw) * 2 - 1, ((py + 0.5) / gh) * 2 - 1);
        };
        const craters = [];
        if (style === 'asteroid' || style === 'organic') {
            const n = 1 + Math.floor(rnd() * 3);
            for (let i = 0; i < n; i++) {
                craters.push({ x: (rnd() - 0.5) * 0.9, y: (rnd() - 0.5) * 0.9, r: 0.16 + rnd() * 0.14 });
            }
        }

        const c = document.createElement('canvas');
        c.width = gw;
        c.height = gh;
        const x = c.getContext('2d');
        for (let py = 0; py < gh; py++) {
            for (let px = 0; px < gw; px++) {
                if (!inside(px, py)) continue;
                let col;
                // Small rocks (few art cells) skip the outline, or they'd be
                // nothing but a dark box.
                if (gw >= 7 && gh >= 7 && (!inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1))) {
                    col = outline;
                } else {
                    const nx = ((px + 0.5) / gw) * 2 - 1;
                    const ny = ((py + 0.5) / gh) * 2 - 1;
                    // Key light from the top-left, quantised to the tones.
                    let l = (-nx - ny) * 0.55 + (rnd() - 0.5) * 0.25;
                    let glow = false;
                    if (style === 'shield') {
                        const rim = Math.hypot(nx, ny);
                        if (rim > 0.62 && rim < 0.74) glow = true;
                        if (ny > -0.45 && ny < -0.25) l += 0.5;
                    } else if (style === 'scrap') {
                        // Rivet rows and a rust/hazard stripe.
                        if ((px % 4 === 1) && (py === 2 || py === gh - 3)) l = 0.9;
                        if (Math.abs(nx - ny * 0.6 - Math.sin(p2) * 0.3) < 0.12) glow = true;
                        if (py === Math.floor(gh / 2)) l = -1;
                    } else if (style === 'spike') {
                        if (Math.hypot(nx, ny) > 0.55 && rnd() < 0.5) glow = true; // hot tips
                    } else if (style === 'tech') {
                        if (px % 5 === 0 || py % 5 === 0) l = -0.6; // panel seams
                        if (Math.abs(nx) < 0.18 && Math.abs(ny) < 0.18) glow = true; // core light
                    } else if (style === 'organic') {
                        if (Math.abs(Math.sin(nx * 7 + p3) + Math.cos(ny * 6 + p1)) < 0.15) l = -1; // veins
                    }
                    for (let i = 0; i < craters.length; i++) {
                        const cr = craters[i];
                        const dx = nx - cr.x;
                        const dy = ny - cr.y;
                        if (Math.hypot(dx, dy) < cr.r) {
                            if (style === 'organic') glow = Math.hypot(dx, dy) < cr.r * 0.55; // glowing pods
                            else l = (dx + dy) > 0 ? 0.3 : -1;
                        }
                    }
                    if (surface === 'banded' && style !== 'shield' && (py % band === 0)) l -= 0.35;
                    const ti = l > 0.35 ? 0 : l > 0 ? 1 : l > -0.4 ? 2 : 3;
                    col = glow ? accent : tones[ti];
                    if (!glow && style !== 'shield') {
                        // Material inclusions (from the planet's resources).
                        if (material === 'ore' && rnd() < 0.05) col = matColor;
                        else if (material === 'voltex' && Math.abs(Math.sin(nx * 9 + p2) - ny * 1.6) < 0.09) col = matColor;
                        else if (material === 'scrap' && ti >= 2 && rnd() < 0.12) col = matColor;
                        else if (material === 'crystal') {
                            for (let i = 0; i < crystals.length; i++) {
                                const cr = crystals[i];
                                const dd = Math.abs(nx - cr.x) + Math.abs(ny - cr.y); // diamond facet
                                if (dd < cr.r) col = dd < cr.r * 0.35 ? '#ffffff' : matColor;
                            }
                        }
                        // Planet surface: lava in the shadowed cracks, frost on
                        // the lit rim, void glow in the deepest shade.
                        if (surfaceColor) {
                            if (surface === 'lava' && ti === 3 && rnd() < 0.35) col = surfaceColor;
                            else if (surface === 'ice' && ti === 0 && rnd() < 0.5) col = surfaceColor;
                            else if ((surface === 'void' || surface === 'toxic') && ti === 3 && rnd() < 0.15) col = surfaceColor;
                        }
                    }
                }
                x.fillStyle = col;
                x.fillRect(px, py, 1, 1);
            }
        }
        c._w = obstacle.width;
        c._h = obstacle.height;
        return c;
    },
    /** Deterministic 0..1 hash of an integer cell. */
    envHash(ix, iy) {
        let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    /** Smooth value noise over cell coordinates (three octaves — less blotchy striping). */
    envNoise(x, y) {
        const oct = (fx, fy) => {
            const ix = Math.floor(fx), iy = Math.floor(fy);
            const tx = fx - ix, ty = fy - iy;
            const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
            const a = this.envHash(ix, iy), b = this.envHash(ix + 1, iy);
            const c = this.envHash(ix, iy + 1), d = this.envHash(ix + 1, iy + 1);
            return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
        };
        return oct(x * 0.11, y * 0.11) * 0.55
            + oct(x * 0.27 + 17, y * 0.29 + 5) * 0.3
            + oct(x * 0.61 + 41, y * 0.57 + 23) * 0.15;
    },
});
