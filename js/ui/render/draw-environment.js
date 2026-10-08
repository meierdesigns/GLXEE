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

    /** Smooth value noise over cell coordinates (two octaves). */
    envNoise(x, y) {
        const oct = (fx, fy) => {
            const ix = Math.floor(fx), iy = Math.floor(fy);
            const tx = fx - ix, ty = fy - iy;
            const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
            const a = this.envHash(ix, iy), b = this.envHash(ix + 1, iy);
            const c = this.envHash(ix, iy + 1), d = this.envHash(ix + 1, iy + 1);
            return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
        };
        return oct(x * 0.12, y * 0.12) * 0.7 + oct(x * 0.31 + 17, y * 0.31 + 5) * 0.3;
    },

    /**
     * Regular (scrolling) stages fly low over the planet: its surface fills
     * the playfield on a coarse pixel grid (same cell as the obstacles) with
     * terrain patches, craters and the planet's surface treatment, framed by
     * raised canyon plateaus carrying faction structures. Pure scenery.
     */
    drawScrollTerrain(ctx, width, height) {
        if (typeof obstacleManager === 'undefined' || !obstacleManager.hasTerrain
            || !obstacleManager.hasTerrain()) {
            this._terrainWallReady = false;
            return;
        }
        const env = this.getCombatEnvironment();
        const W = width || 240;
        const H = height || 300;
        const cell = (typeof obstacleManager !== 'undefined' && obstacleManager.terrainCell)
            ? obstacleManager.terrainCell()
            : (1 / OBSTACLE_ART_DENSITY);
        const offset = obstacleManager.terrainOffset || 0;
        // Later stages look harsher: darker floor, walls drift towards red,
        // more glowing veins (stageDanger 0..1, kept subtle).
        const danger = obstacleManager.stageDanger ? obstacleManager.stageDanger() : 0;
        const key = env.base + env.accent + env.surface + (env.planetStyle || '') + '|' + danger.toFixed(2);
        if (!this._terrainPal || this._terrainKey !== key) {
            this._terrainKey = key;
            const rock = this.mixColor(env.base, '#7a7f88', 0.25);
            // Ground: dark, desaturated and cool so it sits far below the
            // walls; walls: bright, full planet colour — clearly solid.
            // Planets with a known graphic style keep much more of their colour.
            const looked = !!env.planetStyle;
            const soil = this.mixColor(this.hueShift(rock, 0, looked ? 1.1 : 0.45), '#1a2230', looked ? 0.15 : 0.35);
            const gt = (looked ? [-0.45, -0.55, -0.65, -0.76] : [-0.62, -0.7, -0.77, -0.84])
                .map((t) => Math.max(-0.92, t - 0.08 * danger));
            const wallBase = this.mixColor(env.base, '#b0402a', 0.14 * danger);
            this._terrainPal = {
                ground: gt.map((t) => this.shadeColor(soil, t)),
                craterLit: this.shadeColor(soil, -0.5),
                craterPit: this.shadeColor(soil, -0.92),
                wall: [0.55, 0.3, 0.05, -0.2].map((t) => this.shadeColor(this.hueShift(wallBase, 0, 1.2), t)),
                accent: this.shadeColor(env.accent, 0.3),
                special: { lava: '#c9501c', ice: '#9fc4d6', void: '#7a3fb8', toxic: '#5f9e24' }[env.surface]
                    || (danger > 0.4 ? this.shadeColor('#c9501c', -0.25) : null),
                veinMul: 1 + 1.2 * danger
            };
        }
        const pal = this._terrainPal;
        const cols = Math.ceil(W / cell);
        // Row r on screen shows world row wr; rows slide down with the scroll.
        const phase = offset % cell;
        const baseRow = Math.floor(offset / cell);
        const crater = (cx, wr) => {
            // One possible crater per 9x9 block of cells.
            const bx = Math.floor(cx / 9), by = Math.floor(wr / 9);
            let hit = null;
            for (let oy = -1; oy <= 1 && !hit; oy++) {
                for (let ox = -1; ox <= 1 && !hit; ox++) {
                    const h = this.envHash(bx + ox + 911, by + oy + 373);
                    if (h > 0.45) continue;
                    const r = 1.6 + this.envHash(bx + ox, by + oy + 71) * 2.6;
                    const ccx = (bx + ox) * 9 + 2 + this.envHash(bx + ox + 5, by + oy) * 5;
                    const ccy = (by + oy) * 9 + 2 + this.envHash(bx + ox, by + oy + 9) * 5;
                    const dx = cx + 0.5 - ccx, dy = wr + 0.5 - ccy;
                    const dist = Math.hypot(dx, dy);
                    if (dist < r + 1) hit = { inRim: dist >= r, lit: (dx + dy) > 0, pit: dist < r * 0.5 };
                }
            }
            return hit;
        };
        const rowsN = Math.ceil(H / cell) + 3;

        // color → flat [x,y,w,h,…] runs (horizontal RLE) in lattice cells.
        // Layers are painted at one pixel per voxel and scaled up, so every
        // voxel is exactly the same size no matter the scroll phase.
        // Ground, slope shading and walls stay in separate batches so
        // obstacles can sit between them or on top of the walls.
        const groundBatch = Object.create(null);
        const overlayBatch = Object.create(null);
        const wallBatch = Object.create(null);
        let batch = groundBatch;
        let curPhase = 0;
        const pushRun = (col, x, y, w, h) => {
            if (!col || !(w > 0) || !(h > 0)) return;
            let a = batch[col];
            if (!a) batch[col] = a = [];
            // y is r * cell + phase with r starting at -1 → row index r + 1.
            a.push(Math.round(x / cell), Math.round((y - curPhase) / cell) + 1,
                Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)));
        };
        const flushBatch = (target, into) => {
            for (const col in target) {
                if (!Object.prototype.hasOwnProperty.call(target, col)) continue;
                into.fillStyle = col;
                const a = target[col];
                for (let i = 0; i < a.length; i += 4) {
                    into.fillRect(a[i], a[i + 1], a[i + 2], a[i + 3]);
                }
            }
        };
        const flushRow = (colsArr, y) => {
            let runCol = null;
            let runX = 0;
            let runW = 0;
            for (let cx = 0; cx < cols; cx++) {
                const col = colsArr[cx];
                if (col === runCol) {
                    runW += cell;
                } else {
                    if (runCol) pushRun(runCol, runX, y, runW, cell);
                    runCol = col;
                    runX = cx * cell;
                    runW = cell;
                }
            }
            if (runCol) pushRun(runCol, runX, y, runW, cell);
        };

        // Ground: a far layer, scrolls at half speed (parallax under the walls).
        const gOff = offset * GROUND_PARALLAX;
        const gPhase = gOff % cell;
        curPhase = gPhase;
        const gBase = Math.floor(gOff / cell);
        const rowCols = new Array(cols);
        for (let r = -1; r * cell + gPhase < H; r++) {
            const y = r * cell + gPhase;
            const wr = gBase - r;
            for (let cx = 0; cx < cols; cx++) {
                const n = this.envNoise(cx, wr);
                let col = pal.ground[n > 0.66 ? 0 : n > 0.5 ? 1 : n > 0.34 ? 2 : 3];
                if (pal.special && Math.abs(n - 0.5) < (env.planetStyle ? 0.04 : 0.018) * pal.veinMul) col = pal.special;
                const floor = obstacleManager.terrainFloorAt
                    ? obstacleManager.terrainFloorAt(baseRow - r, cx) : 'craters';
                if (floor === 'craters') {
                    const c = crater(cx, wr);
                    if (c) col = c.inRim ? (c.lit ? pal.craterLit : pal.ground[3]) : (c.pit ? pal.craterPit : pal.ground[3]);
                } else {
                    col = this.terrainFloorCell(floor, pal, cx, wr, n) || col;
                }
                rowCols[cx] = col;
            }
            flushRow(rowCols, y);
        }
        // Canyon slope
        batch = overlayBatch;
        curPhase = phase;
        // Calm the floor: a dark veil keeps its patterns well below the ships' brightness.
        curPhase = gPhase;
        for (let r = -1; r * cell + gPhase < H; r++) {
            pushRun('rgba(2,6,8,0.5)', 0, r * cell + gPhase, cols * cell, cell);
        }
        curPhase = phase;
        const slope = [0.62, 0.45, 0.3, 0.18, 0.1];
        for (let r = -1; r * cell + phase < H; r++) {
            const y = r * cell + phase;
            const walls = obstacleManager.terrainWallCells(baseRow - r, W);
            for (let side = 0; side < 2; side++) {
                const width = walls[side ? 'right' : 'left'];
                const reach = Math.min(slope.length, 2 + Math.floor(width / 4));
                for (let i = 0; i < reach; i++) {
                    const cx = side ? cols - width - 1 - i : width + i;
                    if (cx < 0 || cx >= cols) continue;
                    pushRun('rgba(0,0,0,' + slope[i + slope.length - reach] + ')', cx * cell, y, cell, cell);
                }
            }
        }
        // Area threshold on the floor
        if (obstacleManager.terrainGateRow) {
            for (let r = -1; r * cell + phase < H; r++) {
                const gd = obstacleManager.terrainGateRow(baseRow - r);
                if (gd == null || Math.abs(gd) > 1) continue;
                const y = r * cell + phase;
                for (let cx = 0; cx < cols; cx++) {
                    let col;
                    if (gd === 0) col = (cx % 6 === 3) ? pal.accent : '#05060a';
                    else if (gd === 1) col = pal.craterLit;
                    else col = pal.ground[3];
                    rowCols[cx] = col;
                }
                flushRow(rowCols, y);
            }
        }
        // Walls (own batch → drawn after under-wall obstacles)
        batch = wallBatch;
        curPhase = phase;
        const mats = this.terrainMaterialPalettes(env, pal);
        for (let r = -1; r * cell + phase < H; r++) {
            const y = r * cell + phase;
            const wr = baseRow - r;
            const walls = obstacleManager.terrainWallCells(wr, W);
            for (let side = 0; side < 2; side++) {
                const k = side ? 'right' : 'left';
                const width = walls[k];
                const base = walls[k + 'Base'];
                const mat = walls[k + 'Mat'];
                const mp = mats[mat.id];
                let runCol = null;
                let runX = 0;
                let runW = 0;
                const flushWall = () => {
                    if (runCol) pushRun(runCol, runX, y, runW, cell);
                    runCol = null;
                    runW = 0;
                };
                for (let edge = -1; edge < width; edge++) {
                    const cx = side ? cols - width + edge : width - 1 - edge;
                    let col;
                    if (edge < 0) col = 'rgba(0,0,0,0.55)';
                    else if (edge === 0) col = walls[k + 'Cracked'] ? mp.crack : '#05060a';
                    else if (walls[k + 'Sill'] && edge < walls[k + 'Sill']) {
                        col = edge === 1 ? '#e8e2d0'
                            : ((((cx + wr) % 4) + 4) % 4) < 2 ? pal.accent : '#1a1c22';
                    }
                    else if (edge === 1) col = side ? mp.lit[1] : mp.lit[0];
                    else if (edge < width - base) col = (env.style === 'tech' && ((wr & 3) < 2)) || env.style === 'organic' ? pal.accent : pal.wall[1];
                    else col = this.terrainMaterialCell(mat.id, mp, cx, wr, edge);
                    const px = cx * cell;
                    if (col === runCol && px === runX + runW) {
                        runW += cell;
                    } else {
                        flushWall();
                        runCol = col;
                        runX = px;
                        runW = cell;
                    }
                }
                flushWall();
            }
        }

        const layer = (name, target, dy, opaque) => {
            let c = this[name];
            if (!c) c = this[name] = document.createElement('canvas');
            if (c.width !== cols || c.height !== rowsN) {
                c.width = cols;
                c.height = rowsN;
            }
            const lc = c.getContext('2d', { alpha: !opaque });
            if (!lc) return null;
            lc.setTransform(1, 0, 0, 1, 0, 0);
            lc.globalAlpha = 1;
            lc.globalCompositeOperation = 'source-over';
            lc.imageSmoothingEnabled = false;
            if (opaque) {
                lc.fillStyle = '#0a0c10';
                lc.fillRect(0, 0, cols, rowsN);
            } else {
                lc.clearRect(0, 0, cols, rowsN);
            }
            flushBatch(target, lc);
            return { canvas: c, y: dy - cell };
        };
        const groundLayer = layer('_terrainBuf', groundBatch, gPhase, true);
        const overlayLayer = layer('_terrainOverlayBuf', overlayBatch, phase, false);
        const wallLayer = layer('_terrainWallBuf', wallBatch, phase, false);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Fill the strip the shifted layers leave uncovered at the edges.
        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(0, 0, W, H);
        [groundLayer, overlayLayer].forEach((l) => {
            if (l) ctx.drawImage(l.canvas, 0, l.y, cols * cell, rowsN * cell);
        });
        ctx.restore();
        // Wall layer stays separate so under-wall obstacles show through the
        // corridor; blitted later via drawScrollTerrainWalls.
        this._terrainWallDraw = wallLayer;
        this._terrainWallReady = !!wallLayer;
        this._terrainWallDims = { w: cols * cell, h: rowsN * cell };
    },

    /** Blit canyon walls prepared by the last drawScrollTerrain call. */
    drawScrollTerrainWalls(ctx) {
        const wl = this._terrainWallDraw;
        if (!this._terrainWallReady || !wl) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wl.canvas, 0, wl.y, this._terrainWallDims.w, this._terrainWallDims.h);
        ctx.restore();
        this._terrainWallReady = false;
    },

    /** Floor patterns for the canyon areas (null = keep the noise colour). */
    terrainFloorCell(floor, pal, cx, wr, n) {
        const g = pal.ground;
        switch (floor) {
            case 'plates': { // big bedrock slabs with dark seams
                const px = ((cx % 7) + 7) % 7, py = ((wr % 6) + 6) % 6;
                const off = (Math.floor(wr / 6) & 1) ? 3 : 0;
                if (py === 0 || ((cx + off) % 7 + 7) % 7 === 0) return g[3];
                return px + py < 3 ? g[0] : n > 0.5 ? g[1] : g[2];
            }
            case 'dunes': { // wind ripples drifting diagonally
                const w = Math.sin(cx * 0.45 + wr * 0.18 + Math.sin(wr * 0.05) * 3);
                return w > 0.6 ? g[0] : w > 0.1 ? g[1] : w > -0.5 ? g[2] : g[3];
            }
            case 'cracks': { // dried riverbed: cells split by cracks
                const v = Math.abs(Math.sin(cx * 0.7 + Math.sin(wr * 0.3) * 2) + Math.cos(wr * 0.55 + Math.sin(cx * 0.2) * 2));
                if (v < 0.18) return pal.craterPit;
                return n > 0.55 ? g[1] : g[2];
            }
            case 'grid': { // buried installation: panel grid with lit nodes
                const gx = ((cx % 8) + 8) % 8, gy = ((wr % 8) + 8) % 8;
                if (gx === 0 && gy === 0) return pal.special || pal.craterLit;
                if (gx === 0 || gy === 0) return g[3];
                return n > 0.6 ? g[1] : g[2];
            }
            case 'ridges': { // parallel rock ridges with a lit crest
                const v = ((cx + Math.floor(Math.sin(wr * 0.08) * 3)) % 6 + 6) % 6;
                return v === 0 ? g[0] : v === 1 ? g[1] : v === 5 ? g[3] : g[2];
            }
            case 'hex': { // basalt columns / alien hex tiles
                const row = Math.floor(wr / 4);
                const hx = ((cx + (row & 1) * 3) % 6 + 6) % 6, hy = ((wr % 4) + 4) % 4;
                if (hy === 0 || hx === 0) return g[3];
                return hx + hy < 4 ? g[0] : n > 0.5 ? g[1] : g[2];
            }
            case 'rubble': { // scattered boulders with shadows
                const h = this.envHash(cx >> 1, wr >> 1);
                if (h < 0.08) return g[0];
                if (h < 0.14) return pal.craterPit;
                return n > 0.5 ? g[2] : g[3];
            }
            case 'veins': { // glowing veins through dark ground
                const v = Math.abs(Math.sin(cx * 0.35 + Math.sin(wr * 0.12) * 2.5) * 1.2 - Math.cos(wr * 0.09 + cx * 0.05));
                if (v < 0.06) return pal.special || pal.accent;
                if (v < 0.16) return g[1];
                return g[3];
            }
            default:
                return null;
        }
    },

    /** Colours per wall material, derived from the planet + faction accent. */
    terrainMaterialPalettes(env, pal) {
        const key = this._terrainKey;
        if (this._terrainMats && this._terrainMatsKey === key) return this._terrainMats;
        const steel = this.mixColor(env.base, '#9aa4b2', 0.65);
        const glass = this.hueShift(env.base, 160, 1.5);
        const t = (c, list) => list.map((v) => this.shadeColor(c, v));
        this._terrainMatsKey = key;
        this._terrainMats = {
            rock: { body: pal.wall, lit: [pal.wall[0], pal.wall[1]], crack: pal.wall[3] },
            metal: { body: t(steel, [0.35, 0.1, -0.2, -0.45]), lit: t(steel, [0.55, 0.3]), crack: '#ffb347', rivet: this.shadeColor(steel, 0.7) },
            crystal: { body: t(glass, [0.45, 0.15, -0.15, -0.4]), lit: ['#ffffff', this.shadeColor(glass, 0.6)], crack: '#ffffff' },
            magma: { body: t(this.mixColor(env.base, '#2a1a14', 0.55), [0.1, -0.15, -0.35, -0.55]), lit: t(env.base, [0.2, 0]), crack: '#ff7a2a', glow: ['#ff7a2a', '#ffc04a'] }
        };
        return this._terrainMats;
    },

    /** One interior wall cell for a material (edge = cells from the canyon side). */
    terrainMaterialCell(id, mp, cx, wr, edge) {
        const n = this.envNoise(cx, wr);
        const b = mp.body;
        switch (id) {
            case 'metal': {
                // Plates with seams every 3 rows / 4 cells and rivets at the corners.
                const seamRow = ((wr % 3) + 3) % 3 === 0;
                const seamCol = edge % 4 === 0;
                if (seamRow && seamCol) return mp.rivet;
                if (seamRow || seamCol) return b[3];
                return n > 0.55 ? b[1] : b[2];
            }
            case 'crystal': {
                // Diagonal facets with bright glints.
                const f = ((cx + wr) % 5 + 5) % 5;
                if (this.envHash(cx * 7, wr) < 0.05) return '#ffffff';
                return f === 0 ? b[0] : f < 3 ? b[1] : b[2];
            }
            case 'magma': {
                // Dark crust with glowing lava veins.
                if (Math.abs(n - 0.5) < 0.05) return mp.glow[((wr >> 1) & 1)];
                return n > 0.6 ? b[1] : n > 0.35 ? b[2] : b[3];
            }
            default:
                return n > 0.62 ? b[1] : n > 0.35 ? b[2] : b[3];
        }
    },

    /**
     * Fog / nebula as a living pixel cloud on the shared art grid: two noise
     * layers drift against each other, the outline breathes and wobbles,
     * and bright wisps stream through. Alpha is quantised in steps so it
     * keeps the pixel look.
     */
    /**
     * Pixel size of the orbit planet (drawOrbitPlanet: diameter 1.3 × field
     * width, planet grid × detail 4), so other scenery can match it.
     */
    planetPixelSize(W) {
        const grid = (typeof planetSVGManager !== 'undefined' && planetSVGManager.gridSize) || 16;
        return ((W || 240) * 1.3) / (grid * 4);
    },

    drawAnimatedFog(ctx, o) {
        const W = this._fieldW || 240;
        const shared = (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell)
            ? renderManager.getCombatVoxelCell()
            : null;
        const cell = (shared != null && shared > 0) ? shared : this.planetPixelSize(W);
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        if (o._fogSeed == null) o._fogSeed = Math.random() * 1000;
        const seed = o._fogSeed;
        // Structure scale per cloud: 0 = broad soft banks, 1 = fine wisps.
        if (o._fogFine == null) o._fogFine = o.fogFineness != null ? o.fogFineness : Math.random();
        const fine = o._fogFine;
        const fq = 1 + fine * 1.6; // noise frequency multiplier
        const base = this.resolveCss ? this.resolveCss(o.color, '#8fa3b8') : (o.color || '#8fa3b8');
        const light = this.shadeColor(base, 0.45);
        const dark = this.shadeColor(base, -0.25);
        // Breathing: the cloud swells and shrinks a little.
        const pad = Math.max(o.width, o.height) * 0.15;
        const cx = o.x + o.width / 2;
        const cy = o.y + o.height / 2;
        const hw = o.width / 2 + pad;
        const hh = o.height / 2 + pad;
        // Cells sit on the fixed world grid (like the terrain), so the cloud
        // glides across it instead of the grid jumping with the cloud; each
        // cell covers whole screen pixels, so there are no seams.
        const gx0 = Math.floor((cx - hw) / cell);
        const gx1 = Math.ceil((cx + hw) / cell);
        const gy0 = Math.floor((cy - hh) / cell);
        const gy1 = Math.ceil((cy + hh) / cell);
        const breathe = 1 + Math.sin(t * 0.9 + seed) * 0.06;
        const alphaMul = o.opacity != null ? o.opacity : 1;
        const fills = [[], [], []];
        for (let gy = gy0; gy < gy1; gy++) {
            for (let gx = gx0; gx < gx1; gx++) {
                // Position relative to the cloud (moves with it, smoothly).
                const lx = (gx + 0.5) * cell - cx;
                const ly = (gy + 0.5) * cell - cy;
                const nx = lx / hw;
                const ny = ly / hh;
                const a = Math.atan2(ny, nx);
                const edge = (0.8 + 0.1 * Math.sin(a * 3 + t * 0.6 + seed)
                    + 0.05 * Math.sin(a * 5 - t * 0.9 + seed * 2)) * breathe;
                const rad = Math.hypot(nx, ny) / edge;
                if (rad >= 1.1) continue;
                // Noise in cloud space (cell units): three slow layers drifting apart.
                const sx = lx / cell, sy = ly / cell;
                const n1 = this.envNoise(sx * 0.9 * fq + t * 1.2 + seed, sy * 0.9 * fq + t * 0.4);
                const n2 = this.envNoise(sx * 1.4 * fq - t * 0.9 + seed * 3, sy * 1.4 * fq - t * 0.7 + 40);
                const n3 = this.envNoise(sx * 0.5 + t * 0.3 + 90, sy * 0.5 - t * 0.5 + seed);
                // Fine detail: stretched, fast streaks that split thick areas
                // into threads (weighted by the cloud's fineness).
                const n4 = this.envNoise(sx * 3.2 * fq + t * 2 + seed * 7, sy * 1.6 * fq - t * 0.8 + 13);
                // Patchy: a slow mask carves drifting gaps, so only a few
                // pockets get thick and the rest is thin haze or open.
                const holes = this.envNoise(sx * 0.35 - t * 0.25 + seed * 5, sy * 0.35 + t * 0.2 + 7);
                const body = n1 * 0.45 + n2 * 0.3 + n3 * 0.25;
                const detail = 1 - fine * 0.7 + fine * 0.7 * (n4 * 1.6 - 0.3);
                const d = body * detail * (1.1 - rad) * 1.6
                    * Math.max(0, (holes - 0.25) * 1.8);
                if (d < FOG_MIN_DENSITY) continue;
                fills[d > 0.8 ? 2 : d > 0.5 ? 1 : 0].push(gx, gy);
            }
        }
        // Batched per density step: one fillStyle/alpha change each.
        const colors = [dark, base, light];
        const alphas = [0.14, 0.26, 0.42];
        ctx.save();
        for (let k = 0; k < 3; k++) {
            const f = fills[k];
            if (!f.length) continue;
            ctx.globalAlpha = alphaMul * alphas[k];
            ctx.fillStyle = colors[k];
            ctx.beginPath();
            for (let i = 0; i < f.length; i += 2) {
                const px = Math.round(f[i] * cell);
                const py = Math.round(f[i + 1] * cell);
                ctx.rect(px, py, Math.round((f[i] + 1) * cell) - px, Math.round((f[i + 1] + 1) * cell) - py);
            }
            ctx.fill();
        }
        ctx.restore();
    },
});
