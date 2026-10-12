"use strict";

// RenderManager members, continued from draw-environment.js (kept under ~500 lines per file).
extendClass(RenderManager, {
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

        // The lattice layers only change when the scroll crosses a cell boundary (or the palette, width or
        // stage changes); in between they are re-blitted at the new sub-cell phase without being rebuilt.
        const gOffC = offset * GROUND_PARALLAX;
        const lc = this._terrainLayerKey;
        const sameLayers = !!lc && lc.baseRow === baseRow && lc.gBase === Math.floor(gOffC / cell) && lc.cols === cols
            && lc.rowsN === rowsN && lc.cell === cell && lc.W === W && lc.key === this._terrainKey
            && lc.prof === obstacleManager._terrainProfile && lc.pal === pal && !!this._terrainWallBuf;
        let groundLayer, overlayLayer, wallLayer;
        if (sameLayers) {
            groundLayer = { canvas: this._terrainBuf, y: (gOffC % cell) - cell };
            overlayLayer = { canvas: this._terrainOverlayBuf, y: phase - cell };
            wallLayer = { canvas: this._terrainWallBuf, y: phase - cell };
        } else {
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
                // The floor type only depends on the row; noise and craters are pure per cell, so both are
                // computed once per world row (cached while it scrolls past) instead of every frame.
                const floor = obstacleManager.terrainFloorAt
                    ? obstacleManager.terrainFloorAt(baseRow - r, 0) : 'craters';
                const rc = this.terrainRowCache(wr, cols);
                for (let cx = 0; cx < cols; cx++) {
                    const n = rc.n[cx];
                    let col = pal.ground[n > 0.66 ? 0 : n > 0.5 ? 1 : n > 0.34 ? 2 : 3];
                    if (pal.special && Math.abs(n - 0.5) < (env.planetStyle ? 0.04 : 0.018) * pal.veinMul) col = pal.special;
                    if (floor === 'craters') {
                        let c = rc.hits[cx];
                        if (c === undefined) c = rc.hits[cx] = crater(cx, wr);
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
                    /* edge starts at 0 — no corridor-side rgba shadow column
                       (that read as semi-transparent "frame contours" over the playfield). */
                    for (let edge = 0; edge < width; edge++) {
                        const cx = side ? cols - width + edge : width - 1 - edge;
                        let col;
                        if (edge === 0) col = walls[k + 'Cracked'] ? mp.crack : '#05060a';
                        else if (walls[k + 'Sill'] && edge < walls[k + 'Sill']) {
                            /* Soft sill, not a bright cream hairline. */
                            col = edge === 1 ? mp.lit[0]
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

            const layer = (name, target, dy, opaque, px) => {
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
                // Ground and walls paint every cell once with opaque colours: write the pixels directly
                // (one putImageData) instead of thousands of single-cell fillRects.
                if (px && this.flushBatchPixels(target, lc, cols, rowsN, opaque ? '#0a0c10' : null)) {
                    return { canvas: c, y: dy - cell };
                }
                if (opaque) {
                    lc.fillStyle = '#0a0c10';
                    lc.fillRect(0, 0, cols, rowsN);
                } else {
                    lc.clearRect(0, 0, cols, rowsN);
                }
                flushBatch(target, lc);
                return { canvas: c, y: dy - cell };
            };
            groundLayer = layer('_terrainBuf', groundBatch, gPhase, true, true);
            overlayLayer = layer('_terrainOverlayBuf', overlayBatch, phase, false);
            wallLayer = layer('_terrainWallBuf', wallBatch, phase, false, true);
            this._terrainLayerKey = { baseRow, gBase: Math.floor(gOffC / cell), cols, rowsN, cell, W, key: this._terrainKey,
                prof: obstacleManager._terrainProfile, pal };
        }
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
    /** '#rgb' / '#rrggbb' / opaque rgb(a) → packed little-endian RGBA, or null when not exactly representable. */
    packOpaqueColor(css) {
        const cache = this._packedColors || (this._packedColors = new Map());
        let v = cache.get(css);
        if (v !== undefined) return v;
        let r = -1, g = 0, b = 0, m;
        if ((m = /^#([0-9a-f]{6})$/i.exec(css))) {
            r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16);
        } else if ((m = /^#([0-9a-f]{3})$/i.exec(css))) {
            r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16);
        } else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*1(?:\.0+)?\s*)?\)$/i.exec(css))) {
            r = +m[1]; g = +m[2]; b = +m[3];
        }
        v = r < 0 || r > 255 || g > 255 || b > 255 ? null : ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        cache.set(css, v);
        return v;
    },
    /**
     * Paints a colour → [x,y,w,h,…] batch into a cols×rows canvas as raw pixels. Returns false (nothing
     * drawn) when a colour is not opaque, so the caller falls back to fillRect.
     */
    flushBatchPixels(batch, lc, cols, rows, baseCss) {
        const packed = Object.create(null);
        for (const col in batch) {
            if (!Object.prototype.hasOwnProperty.call(batch, col)) continue;
            const v = this.packOpaqueColor(col);
            if (v === null) return false;
            packed[col] = v;
        }
        let base = 0;
        if (baseCss) {
            base = this.packOpaqueColor(baseCss);
            if (base === null) return false;
        }
        const img = this._terrainImg && this._terrainImg.width === cols && this._terrainImg.height === rows
            ? this._terrainImg : (this._terrainImg = lc.createImageData(cols, rows));
        const px = new Uint32Array(img.data.buffer);
        px.fill(base);
        for (const col in packed) {
            const v = packed[col], a = batch[col];
            for (let i = 0; i < a.length; i += 4) {
                const x0 = Math.max(0, a[i]), y0 = Math.max(0, a[i + 1]);
                const x1 = Math.min(cols, a[i] + a[i + 2]), y1 = Math.min(rows, a[i + 1] + a[i + 3]);
                for (let y = y0; y < y1; y++) px.fill(v, y * cols + x0, y * cols + x1);
            }
        }
        lc.putImageData(img, 0, 0);
        return true;
    },
    /** Cached per-world-row terrain noise (and lazily its craters) for one lattice width. */
    terrainRowCache(wr, cols) {
        let c = this._terrainRows;
        if (!c || c.cols !== cols || c.rows.size > 600) c = this._terrainRows = { cols, rows: new Map() };
        let rc = c.rows.get(wr);
        if (!rc) {
            const n = new Float64Array(cols);
            for (let cx = 0; cx < cols; cx++) n[cx] = this.envNoise(cx, wr);
            rc = { n, hits: new Array(cols) };
            c.rows.set(wr, rc);
        }
        return rc;
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
});
