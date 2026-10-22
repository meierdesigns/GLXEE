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
        const key = env.base + env.accent + env.surface + (env.planetStyle || '') + '|'
            + (env.style || '') + '|' + (env.faction || '') + '|' + danger.toFixed(2);
        if (!this._terrainPal || this._terrainKey !== key) {
            this._terrainKey = key;
            const rock = this.mixColor(env.base, '#7a7f88', 0.25);
            // Ground: dark enough to sit under ships, but wide tone steps so
            // planet / faction floor patterns (plates, biomass, conduits…) read.
            const looked = !!env.planetStyle;
            const soil = this.mixColor(this.hueShift(rock, 0, looked ? 1.15 : 0.55), '#1a2230', looked ? 0.1 : 0.28);
            const gt = (looked ? [-0.32, -0.48, -0.64, -0.78] : [-0.5, -0.62, -0.74, -0.86])
                .map((t) => Math.max(-0.92, t - 0.06 * danger));
            const wallBase = this.mixColor(env.base, '#b0402a', 0.14 * danger);
            this._terrainPal = {
                ground: gt.map((t) => this.shadeColor(soil, t)),
                craterLit: this.shadeColor(soil, -0.42),
                craterPit: this.shadeColor(soil, -0.9),
                wall: [0.55, 0.3, 0.05, -0.2].map((t) => this.shadeColor(this.hueShift(wallBase, 0, 1.2), t)),
                accent: this.shadeColor(env.accent, 0.35),
                special: { lava: '#c9501c', ice: '#9fc4d6', void: '#7a3fb8', toxic: '#5f9e24' }[env.surface]
                    || (danger > 0.4 ? this.shadeColor('#c9501c', -0.25) : null),
                veinMul: 1.15 + 1.35 * danger
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
        const dmgEpoch = obstacleManager._terrainDamageEpoch || 0;
        const sameLayers = !!lc && lc.baseRow === baseRow && lc.gBase === Math.floor(gOffC / cell) && lc.cols === cols
            && lc.rowsN === rowsN && lc.cell === cell && lc.W === W && lc.key === this._terrainKey
            && lc.prof === obstacleManager._terrainProfile && lc.pal === pal && lc.dmg === dmgEpoch
            && !!this._terrainWallBuf;
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
                    // Large lighter / darker patches (macro noise) shift the fine noise, so the floor
                    // reads as terrain with plains and hollows instead of one even carpet.
                    const n = Math.max(0, Math.min(1, rc.n[cx] + (rc.m[cx] - 0.5) * 0.7));
                    let col = pal.ground[n > 0.66 ? 0 : n > 0.5 ? 1 : n > 0.34 ? 2 : 3];
                    // Surface veins (ice / lava / …) follow coarse noise: connected seams, not confetti specks.
                    if (pal.special && Math.abs(rc.v[cx] - 0.5) < (env.planetStyle ? 0.035 : 0.018) * pal.veinMul) col = pal.special;
                    if (floor === 'craters') {
                        let c = rc.hits[cx];
                        if (c === undefined) c = rc.hits[cx] = crater(cx, wr);
                        if (c) col = c.inRim ? (c.lit ? pal.craterLit : pal.ground[3]) : (c.pit ? pal.craterPit : pal.ground[3]);
                    } else {
                        col = this.terrainFloorCell(floor, pal, cx, wr, n) || col;
                        // Now and then a crater on the other floors too (sparser than on crater fields).
                        if (rc.m[cx] < 0.42) {
                            let c = rc.hits[cx];
                            if (c === undefined) c = rc.hits[cx] = crater(cx, wr);
                            if (c) col = c.inRim ? (c.lit ? pal.craterLit : pal.ground[3]) : (c.pit ? pal.craterPit : pal.ground[3]);
                        }
                    }
                    // Faction doctrine speckles the planet crust (organic / mechanical).
                    col = this.terrainFactionTint(env, pal, cx, wr, col, n) || col;
                    rowCols[cx] = col;
                }
                flushRow(rowCols, y);
            }
            // Canyon slope
            batch = overlayBatch;
            curPhase = phase;
            // Light veil: keep ships readable without washing out floor doctrine.
            curPhase = gPhase;
            for (let r = -1; r * cell + gPhase < H; r++) {
                pushRun('rgba(2,6,8,0.28)', 0, r * cell + gPhase, cols * cell, cell);
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
                    const hatch = walls[k + 'Hatch'];
                    if (hatch === 'gap' && walls[k + 'Tunnel'] > 0) {
                        // Open hangar slot: dark recess on the floor layer so craft fly out over it.
                        batch = overlayBatch;
                        this.drawHatchRecess(pushRun, env, pal, mp, side, cols, walls[k + 'Tunnel'], wr, y, cell,
                            obstacleManager.terrainOpeningInfo(wr, side));
                        batch = wallBatch;
                    }
                    const lip = hatch === 'frame' ? walls[k + 'Lip'] : 0;
                    // Jamb row right against the slot: one bright accent rim so the door reads at a glance.
                    const doorRim = hatch === 'frame' && (obstacleManager.terrainOpeningAt(wr + 1, side) === 'gap'
                        || obstacleManager.terrainOpeningAt(wr - 1, side) === 'gap');
                    // Rim structure: row inside its 36-row slot (outlined block, see terrainWallCells).
                    const stT = ((wr % 36) + 36) % 36 - 10;
                    /* edge starts at 0 — no corridor-side rgba shadow column
                       (that read as semi-transparent "frame contours" over the playfield). */
                    for (let edge = 0; edge < width; edge++) {
                        const cx = side ? cols - width + edge : width - 1 - edge;
                        let col;
                        if (edge === 0) col = walls[k + 'Cracked'] ? mp.crack : '#05060a';
                        else if (doorRim) col = edge === width - 1 ? '#05060a' : pal.accent;
                        else if (edge <= lip) col = this.hatchLipCell(env.style, pal, mp, cx, wr, edge);
                        else if (walls[k + 'Sill'] && edge < walls[k + 'Sill']) {
                            /* Soft sill — hash speckles, not a checker stripe. */
                            col = edge === 1 ? mp.lit[0]
                                : (this.envHash(cx, wr + 5) < 0.42 ? pal.accent : '#1a1c22');
                        }
                        else if (edge === 1) col = side ? mp.lit[1] : mp.lit[0];
                        else if (edge < width - base) {
                            col = this.structureCell(env.style || 'asteroid', pal, mp, edge, width - base, stT, wr);
                        }
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
                prof: obstacleManager._terrainProfile, pal, dmg: dmgEpoch };
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Fill the strip the shifted layers leave uncovered at the edges.
        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(0, 0, W, H);
        [groundLayer, overlayLayer].forEach((l) => {
            if (l) ctx.drawImage(l.canvas, 0, this.snapToDevicePx(ctx, l.y), cols * cell, rowsN * cell);
        });
        ctx.restore();
        // Wall layer stays separate so under-wall obstacles show through the
        // corridor; blitted later via drawScrollTerrainWalls.
        this._terrainWallDraw = wallLayer;
        this._terrainWallReady = !!wallLayer;
        this._terrainWallDims = { w: cols * cell, h: rowsN * cell };
    },
    /** '#rgb' / '#rrggbb' / opaque rgb(a) → packed little-endian RGBA, or null when not exactly representable. */
    /** Faction look of a hangar frame cell (the lip around the opening). */
    hatchLipCell(style, pal, mp, cx, wr, edge) {
        const h = this.envHash(cx * 5 + edge, wr * 3 + 17);
        switch (style) {
            case 'tech': return ((edge + wr) & 3) < 2 ? pal.accent : '#1a1c22'; // hazard stripes
            case 'spike': return edge === 1 ? pal.accent : pal.wall[0];          // bone fangs, lit tips
            case 'organic': return h < 0.55 ? pal.accent : mp.lit[0];            // swollen flesh lips
            case 'scrap': return h < 0.35 ? (mp.crack || pal.accent) : (h < 0.7 ? pal.wall[1] : mp.lit[1]);
            default: return h < 0.5 ? mp.lit[0] : pal.wall[1];                  // ragged cave rim
        }
    },

    /**
     * One cell of a faction structure on the canyon rim, as a solid outlined
     * block (bunker, pod, fang, junk pile) instead of colour noise.
     * `edge` 1..band-1 from the corridor, `t` = row inside the 14-row block.
     */
    structureCell(style, pal, mp, edge, band, t, wr) {
        if (t <= 0 || t >= 13 || edge === band - 1) return '#05060a';
        const top = t === 1;
        switch (style) {
            case 'tech': // bunker: lit roof strip, dark hull, a column of accent windows
                if (top) return mp.lit[0];
                return edge % 3 === 1 && t % 3 === 0 ? pal.accent : pal.wall[2];
            case 'organic': // pod: glowing core in a fleshy shell
                if (top || edge === 1) return mp.lit[0];
                return Math.abs(t - 6.5) < 3 && edge > 2 && edge < band - 2 ? pal.accent : pal.wall[1];
            case 'spike': // bone fang: pale body, accent tip at the corridor
                if (edge === 1) return pal.accent;
                return top ? '#e6e2d6' : pal.wall[0];
            case 'scrap': // welded junk: plates with rivets and a weld seam
                if (top) return mp.lit[1];
                if (t === 7) return mp.crack || pal.accent;
                return (edge + t) % 5 === 0 ? pal.accent : pal.wall[1];
            default: // boulder ridge
                return top ? pal.wall[0] : (this.envHash(edge, wr) < 0.15 ? pal.wall[2] : pal.wall[1]);
        }
    },

    /**
     * Recess behind an open hangar slot, drawn on the floor layer: dark bay
     * with accent chevrons pointing into the corridor, so it reads as a launch door.
     */
    drawHatchRecess(push, env, pal, mp, side, cols, depth, wr, y, cell, info) {
        const style = env.style || 'asteroid';
        const inner = { tech: '#07090d', organic: '#14060b', spike: '#0b0507', scrap: '#0b0a08' }[style] || '#06070a';
        const mid = info ? info.frame + (info.len - 2 * info.frame - 1) / 2 : 0;
        const dy = info ? Math.abs(info.t - mid) : 99;
        for (let edge = 0; edge < depth; edge++) {
            const cx = side ? cols - 1 - edge : edge;
            let col = inner;
            if (dy <= 2.5 && ((edge + Math.round(dy)) % 5) === 0 && edge < depth - 1) col = pal.accent;
            else if (edge === depth - 1) col = '#05060a';
            push(col, cx * cell, y, cell, cell);
        }
    },

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
            const v = new Float64Array(cols);
            const m = new Float64Array(cols);
            for (let cx = 0; cx < cols; cx++) {
                n[cx] = this.envNoise(cx, wr);
                v[cx] = this.envNoise(cx * 0.22 + 31, wr * 0.22 + 17);
                m[cx] = this.envNoise(cx * 0.16 + 311, wr * 0.16 + 709); // macro patches (~60 cells)
            }
            rc = { n, v, m, hits: new Array(cols) };
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
        ctx.drawImage(wl.canvas, 0, this.snapToDevicePx(ctx, wl.y), this._terrainWallDims.w, this._terrainWallDims.h);
        ctx.restore();
        this._terrainWallReady = false;
    },
    /**
     * Round a logical y to the canvas' device-pixel grid. A fractional blit
     * offset with nearest-neighbour scaling makes voxel rows flicker between
     * heights while scrolling; snapped, every row keeps its size.
     */
    snapToDevicePx(ctx, y) {
        const s = ctx.getTransform ? Math.abs(ctx.getTransform().d) || 1 : 1;
        return Math.round(y * s) / s;
    },
    /** Floor patterns for the canyon areas (null = keep the noise colour). */
    terrainFloorCell(floor, pal, cx, wr, n) {
        const g = pal.ground;
        // Multi-scale ridge: thin organic seams without sin-wave striping.
        const ridge = (sx, sy, a, b) => {
            const u = this.envNoise(cx * sx + a, wr * sy + b);
            const v = this.envNoise(cx * sx * 1.9 + b + 4, wr * sy * 1.7 + a + 2);
            return Math.abs(u - 0.5) * 1.35 + Math.abs(v - 0.5) * 0.65;
        };
        switch (floor) {
            case 'plates': { // irregular bedrock slabs (jittered seams)
                const bx = Math.floor(cx / 7), by = Math.floor(wr / 6);
                const jx = Math.floor(this.envHash(bx, by + 3) * 3) - 1;
                const jy = Math.floor(this.envHash(bx + 5, by) * 2);
                const px = ((cx + jx) % 7 + 7) % 7, py = ((wr + jy) % 6 + 6) % 6;
                if (py === 0 || px === 0) return g[3];
                return px + py < 3 ? g[0] : n > 0.5 ? g[1] : g[2];
            }
            case 'dunes': { // wind ripples with noise warp (no clean diagonals)
                const w = this.envNoise(cx * 0.22 + wr * 0.08, wr * 0.14)
                    - this.envNoise(cx * 0.09 - wr * 0.11 + 8, wr * 0.07 + 3);
                return w > 0.22 ? g[0] : w > 0.05 ? g[1] : w > -0.12 ? g[2] : g[3];
            }
            case 'cracks': { // sparse branching dry-bed cracks (not a dense mesh)
                const r = ridge(0.38, 0.36, 1.1, 7.3);
                if (r < 0.055) return pal.craterPit;
                if (r < 0.1) return g[3];
                if (this.envHash(cx, wr) < 0.035) return g[0];
                return n > 0.58 ? g[1] : g[2];
            }
            case 'grid': { // weathered panel grid — broken seams, sparse nodes
                const gx = ((cx % 9) + 9) % 9, gy = ((wr % 9) + 9) % 9;
                const breakH = this.envHash(Math.floor(cx / 9), wr) > 0.72;
                const breakV = this.envHash(cx, Math.floor(wr / 9)) > 0.72;
                if (gx === 0 && gy === 0 && this.envHash(cx, wr) < 0.55) return pal.special || pal.craterLit;
                if ((gx === 0 && !breakV) || (gy === 0 && !breakH)) return g[3];
                return n > 0.6 ? g[1] : g[2];
            }
            case 'ridges': { // warped rock ridges — crest breaks, not parallel rails
                const und = Math.floor(this.envNoise(wr * 0.12, 2.4) * 5) - 2;
                const v = ((cx + und) % 7 + 7) % 7;
                const gap = this.envHash(cx, wr) < 0.18;
                if (v === 0 && !gap) return g[0];
                if (v === 1) return g[1];
                if (v === 6) return g[3];
                return n > 0.5 ? g[2] : g[3];
            }
            case 'hex': { // basalt columns with eroded cell edges
                const row = Math.floor(wr / 4);
                const hx = ((cx + (row & 1) * 3) % 6 + 6) % 6, hy = ((wr % 4) + 4) % 4;
                if ((hy === 0 || hx === 0) && this.envHash(cx, wr) > 0.2) return g[3];
                return hx + hy < 4 ? g[0] : n > 0.5 ? g[1] : g[2];
            }
            case 'rubble': { // scattered grit — single-cell stones, not 2×2 blocks
                const h = this.envHash(cx, wr);
                if (h < 0.06) return g[0];
                if (h < 0.11) return pal.craterPit;
                if (this.envHash(cx + 17, wr + 3) < 0.04) return g[1];
                return n > 0.5 ? g[2] : g[3];
            }
            case 'veins': { // glowing veins — noise ridges, not sinusoidal stripes
                const r = ridge(0.28, 0.26, 3.2, 11.5);
                if (r < 0.045) return pal.special || pal.accent;
                if (r < 0.11) return g[1];
                return g[3];
            }
            case 'biomass': { // lumpy organic pods / tissue islands
                const h = this.envHash(cx, wr);
                const blob = this.envNoise(cx * 0.5, wr * 0.5);
                if (h < 0.07 && blob > 0.55) return pal.accent;
                if (blob > 0.72) return g[0];
                if (blob > 0.55) return g[1];
                if (blob < 0.28) return pal.craterPit;
                return g[2];
            }
            case 'tendrils': { // branching roots from noise ridges (no sin lattice)
                const r = ridge(0.32, 0.3, 5.7, 2.1);
                if (r < 0.05) return pal.special || pal.accent;
                if (r < 0.12) return g[1];
                return n > 0.55 ? g[2] : g[3];
            }
            case 'spines': { // claw ridges with broken runs (Kronax)
                const und = Math.floor(this.envNoise(wr * 0.1, 4.1) * 4) - 1;
                const v = ((cx + und) % 6 + 6) % 6;
                const row = this.envHash(Math.floor(wr / 5), 33) < 0.35;
                if (row && v === 0) return g[0];
                if (row) return pal.craterPit;
                if (v === 0 && this.envHash(cx, wr) > 0.25) return g[1];
                return n > 0.5 ? g[2] : g[3];
            }
            case 'conduits': { // buried pipes with gaps / breaks (not a full grille)
                const gx = ((cx % 11) + 11) % 11, gy = ((wr % 9) + 9) % 9;
                const gap = this.envHash(Math.floor(cx / 11) + Math.floor(wr / 9), 60) > 0.65;
                if (!gap && (gy === 2 || gy === 3) && gx > 0 && gx < 10) return gx === 5 ? pal.accent : g[1];
                if (!gap && (gx === 2 || gx === 8) && gy > 0 && this.envHash(cx, wr) > 0.3) return g[0];
                return n > 0.55 ? g[2] : g[3];
            }
            case 'plating': { // armored plates with worn / missing rivets
                const bx = Math.floor(cx / 6), by = Math.floor(wr / 5);
                const j = Math.floor(this.envHash(bx, by) * 2);
                const px = ((cx + j) % 6 + 6) % 6, py = ((wr) % 5 + 5) % 5;
                if (py === 0 || px === 0) return g[3];
                if (px === 1 && py === 1 && this.envHash(cx, wr) < 0.7) return pal.accent;
                return px + py < 3 ? g[0] : n > 0.5 ? g[1] : g[2];
            }
            case 'scrapyard': { // welded scrap patches — no diagonal seam rails
                const h = this.envHash(cx, wr + 19);
                const seam = ridge(0.4, 0.35, 9.1, 1.4) < 0.05;
                if (seam) return pal.craterPit;
                if (h < 0.1) return g[0];
                if (h < 0.18) return pal.accent;
                if (h < 0.26) return g[3];
                return n > 0.5 ? g[1] : g[2];
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
                // Worn plates: irregular seams, not a checker lattice.
                const seamRow = ((wr % 4) + 4) % 4 === 0 && this.envHash(Math.floor(wr / 4), 41) > 0.28;
                const seamCol = edge % 5 === 0 && this.envHash(edge, Math.floor(wr / 4) + 7) > 0.32;
                if (seamRow && seamCol) return mp.rivet;
                if (seamRow || seamCol) return b[3];
                return n > 0.55 ? b[1] : b[2];
            }
            case 'crystal': {
                // Facets with jittered glints (less diagonal striping).
                const f = ((cx + wr + Math.floor(this.envHash(cx, wr) * 3)) % 5 + 5) % 5;
                if (this.envHash(cx * 7, wr) < 0.05) return '#ffffff';
                return f === 0 ? b[0] : f < 3 ? b[1] : b[2];
            }
            case 'magma': {
                // Dark crust with glowing lava veins (noise ridge, not row blink).
                const vein = Math.abs(this.envNoise(cx * 0.45, wr * 0.4) - 0.5);
                if (vein < 0.05) return mp.glow[this.envHash(cx, wr) < 0.5 ? 0 : 1];
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
