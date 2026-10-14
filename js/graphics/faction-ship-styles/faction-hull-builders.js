"use strict";

// FactionShipStyles methods: enemy hulls. Enemies are assembled from the
// same part builders as the player's ship (nose / core / aft / wings from
// ShipAssetLoader), so they share its plating, eight-tone palette and accent
// shading. The faction's combat focus (style.focus, see core.js) picks the
// parts and adds its marks; the class only sets size and part count — so a
// Kronax scout and a Kronax capital read as the same people:
//   terran   — line ship: stepped plates, armoured rim, straight wings
//   kronax   — brawler: needle nose, twin claw lances, forward claws, big thruster
//   voidborn — evasive: compact pod, crescent wings floating apart from the hull
//   pirate   — opportunist: wide salvage hull, gun pods on stubby wing tips
//   machine  — grinder: armoured forge block, wings slotted as missile racks
// Before the ship assets are up, the older one-builder-per-faction hulls
// below stand in (buildLegacyPixelSprite) and are replaced on next use.
// Pixel values: 1 edge, 2 hull, 3 accent, 4/5 hull shade/light, 6/7 accent
// shade/light. Nose = row 0 (enemies are flipped).
extendClass(FactionShipStyles, {
    /** Size set for a class: half width, length in rows, extra part count. */
    hullSizeForClass(enemyClass) {
        const i = Math.max(0, this.classes.indexOf(this.normalizeClass(enemyClass)));
        return {
            i: i,
            hw: [3, 5, 6, 7, 8][i],
            len: [9, 10, 11, 12, 13][i]
        };
    },

    buildPixelSprite(faction, enemyClass) {
        const loader = this.partLoader();
        if (loader) {
            try {
                const grid = this.composeEnemyHull(faction, enemyClass, loader);
                if (grid) return grid;
            } catch (e) {
                if (typeof console !== 'undefined') console.warn('enemy hull compose failed', e);
            }
        }
        const legacy = this.buildLegacyPixelSprite(faction, enemyClass);
        legacy._fallback = true;   // rebuilt from parts once the loader is up (getPixelSprite)
        return legacy;
    },

    /** The ship asset loader that owns the part builders, or null before it exists. */
    partLoader() {
        // graphicsManager is a `let` declared later in the bundle: while this
        // runs during boot it is still in its TDZ, where even typeof throws.
        let gm = null;
        try { gm = typeof graphicsManager !== 'undefined' ? graphicsManager : null; } catch (e) { return null; }
        const loader = gm && gm.shipAssetLoader;
        return loader && loader.buildNoseGrid && loader.buildWingGrid && loader.focusVariantPool ? loader : null;
    },

    /** Enemy sprite grid per class (cols × rows): about display size / 2.2, the part voxel density. */
    enemyGridForClass(enemyClass) {
        const i = Math.max(0, this.classes.indexOf(this.normalizeClass(enemyClass)));
        return [{ w: 26, h: 20 }, { w: 32, h: 24 }, { w: 40, h: 30 }, { w: 44, h: 34 }, { w: 52, h: 40 }][i];
    },

    /**
     * Class layout: body width share, wing span share (0 = none), and the
     * extra parts bigger classes carry.
     */
    enemyClassLayout(enemyClass) {
        switch (this.normalizeClass(enemyClass)) {
            case 'scout': return { body: 0.34, wings: 0 };
            case 'assault': return { body: 0.28, wings: 0.95 };
            case 'heavy': return { body: 0.36, wings: 0.7, pods: true };
            case 'elite': return { body: 0.26, wings: 1, rearWings: 0.62 };
            case 'capital':
            default: return { body: 0.26, wings: 0.8, rearWings: 0.6, outriggers: true };
        }
    },

    /**
     * Assemble an enemy hull from the player's part builders. Returns an
     * indexed grid; engine cells are kept in _hullEngines.
     */
    composeEnemyHull(faction, enemyClass, loader) {
        const f = this.normalizeFaction(faction);
        const cls = this.normalizeClass(enemyClass);
        const style = this.getFactionStyle(f);
        const focus = style.focus || {};
        const A = this.getFactionAnatomy(f) || {};
        const ax = (part, axis) => (A[part] && Number.isFinite(A[part][axis]) ? A[part][axis] : 1);
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        const layout = this.enemyClassLayout(cls);
        const { w: W, h: H } = this.enemyGridForClass(cls);
        const cx = W / 2;
        // Even widths keep every part centred on the axis (W is even).
        const even = (v, lo, hi) => {
            const n = Math.round(clamp(v, lo, hi));
            return n % 2 ? n + 1 : n;
        };
        const pick = (segId, key) => {
            const pool = loader.focusVariantPool(style, segId);
            const h = this.hash(f + '|' + cls + '|' + (key || segId));
            if (pool.length) return pool[h % pool.length];
            const count = /^wing/.test(segId) ? loader.wingShapeVariants.length : loader.bodyShapeVariantCount(segId);
            return h % count;
        };
        const g = [];
        for (let r = 0; r < H; r++) g.push(new Array(W).fill(0));
        const stamp = (part, c0, r0) => {
            if (!part) return;
            for (let r = 0; r < part.length; r++) {
                const rr = r0 + r;
                if (rr < 0 || rr >= H) continue;
                for (let c = 0; c < part[r].length; c++) {
                    const v = part[r][c];
                    const cc = c0 + c;
                    if (!v || cc < 0 || cc >= W) continue;
                    g[rr][cc] = v;
                }
            }
        };
        const mirror = (part) => part.map((row) => row.slice().reverse());

        // Kronax claw lances run ahead of the nose: the hull starts lower.
        const top = focus.hardpoints === 'twinNose' ? Math.max(2, Math.round(H * 0.12)) : 0;
        // Band lengths from the faction anatomy (adjacent bands overlap one row).
        const span = H - top + 2;
        const wf = 0.3 * ax('front', 'y');
        const wc = 0.4 * ax('center', 'y');
        const wb = 0.3 * ax('back', 'y');
        const sum = wf + wc + wb;
        const frontH = Math.max(4, Math.round(span * wf / sum));
        const backH = Math.max(4, Math.round(span * wb / sum));
        const centerH = Math.max(4, span - frontH - backH);
        const rFront = top;
        const rCenter = rFront + frontH - 1;
        const rBack = rCenter + centerH - 1;
        // Band widths from the anatomy, relative to the core.
        const bodyW = even(W * layout.body * clamp(ax('center', 'x'), 0.6, 1.6), 6, W * 0.6);
        const frontW = even(bodyW * clamp(ax('front', 'x') / ax('center', 'x'), 0.6, 1.3), 4, W * 0.6);
        const backW = even(bodyW * clamp(ax('back', 'x') / ax('center', 'x'), 0.6, 1.5), 4, W * 0.7);

        const front = loader.buildNoseGrid(frontW, frontH, style, pick('front'));
        const center = loader.buildCenterGrid(bodyW, centerH, style, pick('center'));
        const back = loader.buildAftGrid(backW, backH, style, pick('back'));
        const backVariant = pick('back');

        // Body mask: where wings / pods attach (core, plus outrigger hulls).
        const body = [];
        for (let r = 0; r < H; r++) body.push(new Array(W).fill(0));
        const mark = (part, c0, r0) => part.forEach((row, r) => row.forEach((v, c) => {
            if (v && r0 + r >= 0 && r0 + r < H && c0 + c >= 0 && c0 + c < W) body[r0 + r][c0 + c] = 1;
        }));
        mark(center, cx - bodyW / 2, rCenter);

        // Capital outrigger hulls: shorter side stacks beside the core.
        const side = [];
        if (layout.outriggers) {
            const ow = even(bodyW * 0.5, 4, W * 0.2);
            const ofH = Math.max(4, Math.round(frontH * 0.6));
            const ocH = Math.max(4, Math.round(centerH * 0.85));
            const obH = Math.max(4, Math.round(backH * 0.8));
            const r0 = H - (ofH + ocH + obH - 2);
            const c0 = cx + bodyW / 2 - 1;
            const parts = {
                front: loader.buildNoseGrid(ow, ofH, style, pick('front', 'outFront')),
                center: loader.buildCenterGrid(ow, ocH, style, pick('center', 'outCenter')),
                back: loader.buildAftGrid(ow, obH, style, pick('back', 'outBack'))
            };
            side.push({ parts, c0, r0, ofH, ocH, w: ow, variant: pick('back', 'outBack') });
            mark(parts.center, c0, r0 + ofH - 1);
            mark(mirror(parts.center), W - c0 - ow, r0 + ofH - 1);
        }

        // Outermost body column (right half) across rows r0..r1.
        const bodyEdge = (r0, r1) => {
            let edge = Infinity;
            for (let r = Math.max(0, r0); r <= Math.min(H - 1, r1); r++) {
                let last = -1;
                for (let c = W - 1; c >= cx; c--) if (body[r][c]) { last = c; break; }
                if (last >= 0) edge = Math.min(edge, last);
            }
            return Number.isFinite(edge) ? edge : cx + bodyW / 2 - 1;
        };
        // Wings attach one voxel under the hull; Voidborn wings float two voxels off it.
        const wingRoot = (r0, rows) => bodyEdge(r0 + 1, r0 + rows - 2) + (focus.wingGap ? 3 : 0);
        const buildWing = (share, rows, r0, key) => {
            const root = wingRoot(r0, rows);
            const cols = Math.round(clamp((W - 1 - root) * share * clamp(ax('wing', 'x'), 0.6, 1.4), 0, W - root));
            if (cols < 3 || rows < 4) return null;
            const grid = loader.buildWingGrid({ id: 'wingRight' }, cols, rows, style, pick('wingLeft', key));
            // A floating wing's root is exposed: give it the rim the hull joint would hide.
            if (focus.wingGap) loader.outlineGridEdges(grid);
            this.liftThinEdges(grid);
            return { grid, c0: root, r0 };
        };
        const wings = [];
        if (layout.wings) {
            // Tall frames: swept / crescent planforms are thin bands of the frame.
            const rows = Math.round(clamp(centerH * 1.6 * clamp(ax('wing', 'y'), 0.6, 1.6), 6, H * 0.8));
            const r0 = Math.round(clamp(rCenter + (centerH - rows) / 2, 0, H - rows));
            const w = buildWing(layout.wings, rows, r0, 'wing');
            if (w) wings.push(w);
        }
        if (layout.rearWings) {
            const rows = Math.round(clamp(backH * 1.6, 5, H * 0.5));
            const r0 = H - rows;
            const w = buildWing(layout.rearWings * (wings[0] ? 0.75 : 1), rows, r0, 'rearWing');
            if (w) wings.push(w);
        }
        // Heavy engine pods: small aft blocks on the core's flanks.
        let pods = null;
        if (layout.pods) {
            const pw = even(bodyW * 0.42, 4, W * 0.18);
            const ph = Math.max(5, Math.round(centerH * 0.85));
            const r0 = rBack + backH - ph;
            pods = { grid: loader.buildAftGrid(pw, ph, style, backVariant), c0: bodyEdge(r0, r0 + ph - 1), r0, w: pw, h: ph };
        }

        // Draw back to front: aft, wings, pods, outriggers, core, nose.
        stamp(back, cx - backW / 2, rBack);
        wings.forEach((w) => {
            stamp(w.grid, w.c0, w.r0);
            stamp(mirror(w.grid), W - w.c0 - w.grid[0].length, w.r0);
        });
        if (pods) {
            stamp(pods.grid, pods.c0, pods.r0);
            stamp(mirror(pods.grid), W - pods.c0 - pods.w, pods.r0);
        }
        side.forEach((o) => {
            const rows = [o.r0, o.r0 + o.ofH - 1, o.r0 + o.ofH - 1 + o.ocH - 1];
            [['back', 2], ['center', 1], ['front', 0]].forEach(([k, i]) => {
                stamp(o.parts[k], o.c0, rows[i]);
                stamp(mirror(o.parts[k]), W - o.c0 - o.w, rows[i]);
            });
        });
        stamp(center, cx - bodyW / 2, rCenter);
        stamp(front, cx - frontW / 2, rFront);

        // Twin claw lances (Kronax): two prongs reaching past the nose tip.
        if (focus.hardpoints === 'twinNose') {
            const dx = Math.max(1, Math.round(frontW / 2) - 2);
            const len = Math.min(top + Math.round(frontH * 0.45), Math.round(H * 0.32));
            // Glowing inner blade (the claw beam's emitter), dark outer rim.
            for (let r = 0; r < len; r++) {
                g[r][cx + dx] = 3;
                g[r][cx + dx + 1] = 1;
                g[r][cx - dx - 1] = 3;
                g[r][cx - dx - 2] = 1;
            }
        }
        // Thrusters: per faction aft layout (buildAftGrid), on every aft block.
        const engines = [];
        const addEngines = (c0, w, r0, h, variant) => {
            this.aftEngineFractions(style.silhouette, variant).forEach((u) => {
                const at = c0 + u * (w - 1);
                // A centred engine on an even-width block burns in both middle columns.
                const cols = at % 1 === 0.5 ? [at - 0.5, at + 0.5] : [Math.round(at)];
                cols.forEach((c) => {
                    let last = -1;
                    for (let r = r0; r < Math.min(H, r0 + h); r++) if (g[r][c]) last = r;
                    if (last >= 0) engines.push({ x: c, y: Math.min(H - 1, last + 1) });
                });
            });
        };
        addEngines(cx - backW / 2, backW, rBack, backH, backVariant);
        if (pods) {
            addEngines(pods.c0, pods.w, pods.r0, pods.h, backVariant);
            addEngines(W - pods.c0 - pods.w, pods.w, pods.r0, pods.h, backVariant);
        }
        side.forEach((o) => {
            const r0 = o.r0 + o.ofH + o.ocH - 2;
            addEngines(o.c0, o.w, r0, H - r0, o.variant);
            addEngines(W - o.c0 - o.w, o.w, r0, H - r0, o.variant);
        });
        if (!this._hullEngines) this._hullEngines = Object.create(null);
        this._hullEngines[f + '|' + cls] = engines;

        // Accent blocks get the parts' lit top / shaded sides (not in VOXEL).
        const voxel = loader.isVoxelStyle && loader.isVoxelStyle();
        const out = voxel ? g : loader.shadeAccentBlocks(g);
        out._renderStyle = voxel ? 'voxel' : 'flat';
        return out;
    },

    /** Engine columns (0..1 across the aft block) per faction aft layout, as in buildAftGrid. */
    aftEngineFractions(silhouette, variant) {
        switch (silhouette) {
            case 'rings': return [0.5];
            case 'circuit': return [0.16, 0.39, 0.61, 0.84];
            case 'spikes': return [0.2, 0.5, 0.8];
            case 'scrap': return [0.25, 0.75];
            default: return variant === 1 ? [0.5] : [0.29, 0.71];
        }
    },

    /**
     * Blades too thin to have an interior are all outline at enemy scale;
     * keep them hull-coloured (as the old hulls did) so they don't read as
     * dark scratches. Rims next to an interior cell stay dark.
     */
    liftThinEdges(g) {
        const H = g.length, W = g[0].length;
        const inner = (r, c) => r >= 0 && c >= 0 && r < H && c < W && g[r][c] > 1;
        const lift = [];
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                if (g[r][c] !== 1) continue;
                let near = false;
                for (let dr = -1; dr <= 1 && !near; dr++) {
                    for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inner(r + dr, c + dc)) { near = true; break; }
                }
                if (!near) lift.push([r, c]);
            }
        }
        lift.forEach(([r, c]) => { g[r][c] = 2; });
    },

    /** The original one-builder-per-faction hull: stand-in until the part builders load. */
    buildLegacyPixelSprite(faction, enemyClass) {
        const f = this.normalizeFaction(faction);
        const cls = this.normalizeClass(enemyClass);
        const g = this.blankGrid();
        const cx = Math.floor(this.spriteW / 2);
        const size = this.hullSizeForClass(cls);
        const seed = this.hash(f + '|' + cls);
        const d = this.hullDrawTools(g, cx);
        const builders = {
            terran: 'buildTerranHull',
            kronax: 'buildKronaxHull',
            voidborn: 'buildVoidbornHull',
            pirate: 'buildPirateHull',
            machine: 'buildMachineHull'
        };
        const engines = this[builders[f] || 'buildPirateHull'](d, size, seed);
        const S = this.spriteScale;
        const hi = this.upscaleGrid(g);
        this.outlineHull(hi);
        if (!this._hullEngines) this._hullEngines = Object.create(null);
        // Engine cells live in the high-res grid: bottom-centre of the old cell.
        this._hullEngines[f + '|' + cls] = (engines || []).map((e) => ({
            x: (cx + e.dx) * S + (S >> 1),
            y: e.y * S + S - 1
        }));
        return hi;
    },

    /**
     * Doubles the build grid with Scale2x (EPX): diagonals become 1px steps
     * instead of 2px blocks, so ships read at twice the resolution.
     */
    upscaleGrid(g) {
        const H = g.length, W = g[0].length;
        const at = (c, r) => (r < 0 || c < 0 || r >= H || c >= W) ? 0 : g[r][c];
        const out = [];
        for (let r = 0; r < H * 2; r++) out.push(new Array(W * 2).fill(0));
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const P = g[r][c];
                const A = at(c, r - 1), B = at(c + 1, r), C = at(c - 1, r), D = at(c, r + 1);
                let p1 = P, p2 = P, p3 = P, p4 = P;
                if (C === A && C !== D && A !== B) p1 = A;
                if (A === B && A !== C && B !== D) p2 = B;
                if (D === C && D !== B && C !== A) p3 = C;
                if (B === D && B !== A && D !== C) p4 = D;
                out[r * 2][c * 2] = p1;
                out[r * 2][c * 2 + 1] = p2;
                out[r * 2 + 1][c * 2] = p3;
                out[r * 2 + 1][c * 2 + 1] = p4;
            }
        }
        return out;
    },

    /** Drawing helpers on the grid: mirrored (m*) and single-sided (s*). */
    hullDrawTools(g, cx) {
        const put = (c, r, v) => {
            if (r < 0 || c < 0 || r >= this.spriteH || c >= this.spriteW) return;
            g[r][c] = v;
        };
        return {
            cx: cx,
            put: (dx, r, v) => put(cx + dx, r, v),
            m: (dx, r, v) => { put(cx + dx, r, v); put(cx - dx - 1, r, v); },
            mRect: (dx0, dx1, r0, r1, v) => {
                for (let r = r0; r <= r1; r++) {
                    for (let dx = dx0; dx <= dx1; dx++) { put(cx + dx, r, v); put(cx - dx - 1, r, v); }
                }
            },
            sRect: (c0, c1, r0, r1, v) => {
                for (let r = r0; r <= r1; r++) {
                    for (let c = c0; c <= c1; c++) put(cx + c, r, v);
                }
            },
            clear: (dx, r) => put(cx + dx, r, 0)
        };
    },

    /**
     * Dark rim on the hull where it is at least 2px thick, so thin blades and
     * struts keep their hull colour instead of turning into black lines.
     */
    outlineHull(g) {
        const H = g.length, W = g[0].length;
        const at = (c, r) => (r < 0 || c < 0 || r >= H || c >= W) ? 0 : (g[r][c] || 0);
        const edge = [];
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                if (g[r][c] !== 2) continue;
                const l = at(c - 1, r), rt = at(c + 1, r), u = at(c, r - 1), dn = at(c, r + 1);
                // Only rim parts at least 3px thick in that direction.
                if ((!l && rt && at(c + 2, r)) || (!rt && l && at(c - 2, r))
                    || (!u && dn && at(c, r + 2)) || (!dn && u && at(c, r - 2))) edge.push([c, r]);
            }
        }
        edge.forEach(([c, r]) => { g[r][c] = 1; });
    },

    // Mirrored helpers treat dx 0 as the column right of the centre line and
    // its mirror left of it, so every symmetric hull is an even width.

    buildTerranHull(d, s) {
        const L = s.len;
        // Fuselage: a stack of rectangular modules, wider in the middle.
        d.mRect(0, 0, 0, 1, 2);
        d.mRect(0, 1, 1, L - 2, 2);
        d.mRect(0, 0, 2, 2, 3);                       // cockpit
        for (let r = 4; r < L - 2; r += 2) d.m(1, r, 3); // service panels
        if (s.i >= 1) {
            // Straight, orthogonal wings with square tips.
            const wr = Math.floor(L * 0.45);
            d.mRect(2, s.hw - 1, wr, wr + 1 + (s.i >= 2 ? 1 : 0), 2);
            d.mRect(s.hw - 1, s.hw - 1, wr - 1, wr + 2 + (s.i >= 2 ? 1 : 0), 2);
            d.m(s.hw - 1, wr - 1, 3);                 // wingtip lights
        }
        if (s.i >= 2) d.mRect(2, 2, 3, L - 3, 2);     // side modules
        if (s.i >= 4) {
            // Capital: second wing pair and a command block.
            d.mRect(3, s.hw - 2, L - 4, L - 3, 2);
            d.mRect(0, 1, 3, 4, 3);
        }
        // Parallel engine blocks.
        d.mRect(1, 1, L - 2, L - 1, 2);
        return s.i >= 2 ? [{ dx: 1, y: L }, { dx: -2, y: L }, { dx: 2, y: L - 1 }, { dx: -3, y: L - 1 }]
            : [{ dx: 1, y: L }, { dx: -2, y: L }];
    },

    buildKronaxHull(d, s) {
        const L = s.len;
        // Long ram nose widening into an arrow body.
        d.mRect(0, 0, 0, L - 2, 2);
        for (let r = 3; r < L - 1; r++) {
            const w = Math.min(s.i >= 2 ? 2 : 1, Math.floor((r - 1) / 3));
            if (w > 0) d.mRect(1, w, r, r, 2);
        }
        for (let r = 2; r < L - 3; r++) d.put(0, r, 3), d.put(-1, r, 3); // spine
        // Swept blades: start mid-body, run outward and back, claw tip at the end.
        const start = Math.floor(L * 0.35);
        const reach = s.i === 0 ? 2 : s.hw - 1;
        for (let k = 0; k <= reach; k++) {
            const dx = 1 + k;
            const r = start + Math.round(k * (L - 2 - start) / Math.max(1, reach));
            d.m(dx, r, 2);
            if (s.i >= 1) d.m(dx, r + 1, 2);
            if (k % 2 === 1 && s.i >= 2) d.m(dx, r - 1, 2);   // serrated leading edge
        }
        d.m(reach + 1, L - 1, 3);                            // claw tips
        d.m(reach + 1, L - 3, 2);
        if (s.i >= 3) {
            // Second, shorter blade row further forward.
            for (let k = 0; k < reach - 2; k++) d.m(2 + k, start - 2 + k, 2);
        }
        return s.i >= 3 ? [{ dx: 0, y: L - 1 }, { dx: -1, y: L - 1 }] : [{ dx: 0, y: L - 1 }];
    },

    buildVoidbornHull(d, s) {
        const L = s.len;
        const cy = (L - 1) / 2;
        const rx = s.hw - 0.5;
        const ry = Math.max(2.5, (L - 1) / 2);
        // Open crescent: ellipse ring with a gap facing forward (row 0).
        // Right half only, mirrored, so the ring stays symmetric.
        const ring = (rxv, ryv, gapTop, v) => {
            for (let a = -32; a <= 32; a++) {
                const ang = (a / 64) * Math.PI * 2;
                const x = Math.cos(ang) * rxv;
                const y = Math.sin(ang) * ryv;
                if (gapTop && y < -ryv * 0.55 && x < rxv * 0.7) continue;
                if (!gapTop && y > ryv * 0.55 && x < rxv * 0.7) continue;
                d.m(Math.max(0, Math.floor(x)), Math.round(cy + y), v);
            }
        };
        ring(rx, ry, true, 2);
        if (s.i >= 1) ring(rx - 1, ry - 1, true, 2);          // double-thick outer arc
        if (s.i >= 3) ring(Math.max(1.5, rx - 3), Math.max(1.5, ry - 3), false, 2); // inner counter-arc
        // Floating core, not connected to the ring.
        const core = Math.round(cy);
        d.mRect(0, 0, core, core + (s.i >= 2 ? 1 : 0), 3);
        if (s.i >= 2) d.mRect(1, 1, core, core, 2);
        return [{ dx: 0, y: Math.min(this.spriteH - 1, Math.round(cy + ry) + 1) }];
    },

    buildPirateHull(d, s, seed) {
        const L = s.len;
        // Salvage look from big bolted-on blocks, but every part is mirrored
        // on the centre line so the hull stays horizontally symmetric.
        const rect = (c0, c1, r0, r1, v) => d.mRect(Math.min(c0, c1), Math.max(c0, c1), r0, r1, v);
        // Blunt-nosed main hull, cockpit on the axis.
        rect(0, 1, 1, L - 2, 2);
        rect(0, 0, 0, 0, 2);
        rect(0, 0, 2, 3, 3);
        // Twin bolted-on engine pods.
        rect(s.hw - 3, s.hw - 1, L - 5, L - 1, 2);
        rect(s.hw - 4, s.hw - 2, L - 4, L - 4, 3);           // hazard stripe
        // Thin struts + guns.
        if (s.i >= 1) {
            const wr = Math.floor(L * 0.5);
            rect(2, s.hw - 1, wr, wr, 2);
            rect(s.hw - 1, s.hw - 1, wr - 3, wr + 1, 2);
            rect(s.hw - 1, s.hw - 1, wr - 3, wr - 3, 3);     // muzzle
        }
        // Junk plates from the seed (mirrored pairs).
        const n = s.i + 1;
        for (let k = 0; k < n; k++) {
            const h = (seed >>> (k * 5)) & 31;
            const c = 2 + (h % Math.max(1, s.hw - 2));
            const r = 1 + ((h >> 2) % Math.max(1, L - 4));
            rect(c, c + (h & 1), r, r + 1, 2);
        }
        return [{ dx: s.hw - 2, y: L }, { dx: 0, y: L - 1 }];
    },

    buildMachineHull(d, s) {
        const L = s.len;
        const mid = Math.floor(L / 2);
        // Square core with a lit centre.
        d.mRect(0, 1, mid - 2, mid + 1, 2);
        d.mRect(0, 0, mid - 1, mid, 3);
        // Nodes on struts in a plus pattern; more nodes on bigger classes.
        const node = (dx, r) => { d.mRect(dx, dx + 1, r, r + 1, 2); d.m(dx, r, 3); };
        const strutH = (dx0, dx1, r) => { for (let dx = dx0; dx <= dx1; dx++) d.m(dx, r, 2); };
        const strutV = (dx, r0, r1) => { for (let r = r0; r <= r1; r++) d.m(dx, r, 2); };
        // Forward node
        strutV(0, 1, mid - 3);
        d.mRect(0, 0, 0, 1, 2);
        // Side nodes
        const sideX = Math.max(3, s.hw - 2);
        strutH(2, sideX - 1, mid - 1);
        node(sideX, mid - 2);
        if (s.i >= 2) {
            // Diagonal rear nodes.
            strutV(2, mid + 2, L - 3);
            node(2, L - 2);
            node(sideX, mid + 2);
            strutV(sideX, mid, mid + 1);
        }
        if (s.i >= 3) {
            node(sideX - 2, 1);
            strutV(sideX - 2, 3, mid - 2);
        }
        // Rear exhaust node
        strutV(0, mid + 2, L - 2);
        return s.i >= 2 ? [{ dx: 0, y: L - 1 }, { dx: 2, y: L }, { dx: -3, y: L }] : [{ dx: 0, y: L - 1 }];
    },

    /** Engine glow at the builder's thrusters (falls back to class slots). */
    buildEngineGlow(faction, enemyClass, tier) {
        const t = Math.max(1, Math.min(5, tier || 1));
        const f = this.normalizeFaction(faction);
        const cls = this.normalizeClass(enemyClass);
        if (!this._hullEngines || !this._hullEngines[f + '|' + cls]) this.getPixelSprite(f, cls);
        const cx = Math.floor(this.spriteW / 2);
        const list = (this._hullEngines && this._hullEngines[f + '|' + cls]) || this.enginePositions(cls, cx);
        const style = this.getFactionStyle(f);
        // Composed hulls differ in size per class: use the sprite's own grid.
        const sprite = this.pixelCache && this.pixelCache[this.spriteKey(f, cls)];
        const w = sprite && sprite[0] ? sprite[0].length : this.spriteW * this.spriteScale;
        const h = sprite ? sprite.length : this.spriteH * this.spriteScale;
        return {
            positions: list.map((p) => ({
                x: Math.max(0, Math.min(w - 1, p.x)),
                y: Math.max(0, Math.min(h - 1, p.y)),
                intensity: 0.55 + t * 0.08
            })),
            // Thrusters burn in the faction accent.
            color: style.accent || this.sharedEngine,
            width: w,
            height: h
        };
    }
});
