"use strict";

// FactionShipStyles methods: one hull builder per faction. The faction sets
// the construction language (how the ship is built), the class only sets
// size and how many parts it gets — so a Kronax scout and a Kronax capital
// read as the same people, and no two factions share an outline.
//   terran   — orthogonal modules, straight wings, cockpit, parallel engines
//   kronax   — arrow ram nose, swept serrated blades, one big thruster
//   voidborn — open crescent rings around a floating core, no wings
//   pirate   — asymmetric salvage: off-centre hull, odd pods, junk plates
//   machine  — square nodes on thin struts, a lattice with visible gaps
// Pixel values: 1 edge, 2 hull, 3 accent. Nose = row 0 (enemies are flipped).
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
        // Mirror the whole layout per ship so pirates lean either way.
        const side = (seed & 1) ? 1 : -1;
        const sx = (c) => (side > 0 ? c : -c - 1);
        const rect = (c0, c1, r0, r1, v) => {
            const a = sx(c0), b = sx(c1);
            d.sRect(Math.min(a, b), Math.max(a, b), r0, r1, v);
        };
        // Off-centre main hull, blunt nose.
        rect(-2, 1, 1, L - 2, 2);
        rect(-1, 0, 0, 0, 2);
        rect(-1, -1, 2, 3, 3);                               // cockpit, off-centre
        // Big bolted-on engine pod on one side.
        rect(-s.hw, -3, L - 5, L - 1, 2);
        rect(-s.hw + 1, -4, L - 4, L - 4, 3);                // hazard stripe
        // Thin strut + gun on the other side.
        if (s.i >= 1) {
            const wr = Math.floor(L * 0.5);
            rect(2, s.hw - 1, wr, wr, 2);
            rect(s.hw - 1, s.hw - 1, wr - 3, wr + 1, 2);
            rect(s.hw - 1, s.hw - 1, wr - 3, wr - 3, 3);     // muzzle
        }
        // Junk plates from the seed.
        const n = s.i + 1;
        for (let k = 0; k < n; k++) {
            const h = (seed >>> (k * 5)) & 31;
            const c = 2 + (h % Math.max(1, s.hw - 2));
            const r = 1 + ((h >> 2) % Math.max(1, L - 4));
            rect(c, c + (h & 1), r, r + 1, 2);
        }
        return [{ dx: sx(-s.hw + 1), y: L }, { dx: sx(-1), y: L - 1 }];
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
        return {
            positions: list.map((p) => ({
                x: Math.max(0, Math.min(this.spriteW * this.spriteScale - 1, p.x)),
                y: Math.max(0, Math.min(this.spriteH * this.spriteScale - 1, p.y)),
                intensity: 0.55 + t * 0.08
            })),
            // Thrusters burn in the faction accent.
            color: style.accent || this.sharedEngine,
            width: this.spriteW * this.spriteScale,
            height: this.spriteH * this.spriteScale
        };
    }
});
