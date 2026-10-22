"use strict";

// ObstacleManager members, continued from spawn-patterns.js (kept under ~500 lines per file).
extendClass(ObstacleManager, {
    terrainZoneId(idx, prof) {
        // The first stretch is always a plain canyon to ease into the stage.
        if (idx <= 0) return 'canyon';
        // Never the same area twice in a row.
        const cur = this.terrainZonePick(idx, prof);
        const prev = idx === 1 ? 'canyon' : this.terrainZonePick(idx - 1, prof);
        if (cur !== prev) return cur;
        const i = TERRAIN_ZONES.indexOf(cur);
        return TERRAIN_ZONES[(i + 1 + Math.floor(this.terrainHash(idx, 211) * (TERRAIN_ZONES.length - 1))) % TERRAIN_ZONES.length];
    },
    terrainZonePick(idx, prof) {
        const total = prof.zones.reduce((s, z) => s + z.weight, 0);
        let h = this.terrainHash(idx, prof.seed % 7919) * total;
        for (const z of prof.zones) {
            h -= z.weight;
            if (h <= 0) return z.id;
        }
        return 'canyon';
    },
    terrainZoneShape(id, wr, t) {
        // Envelope: shapes ramp in from the zone start so edges stay smooth.
        const env = Math.min(1, t / 0.15);
        switch (id) {
            case 'narrows': // walls close in: a tight squeeze
                return { left: 0.17 * env, right: 0.17 * env, mul: 1, structures: false };
            case 'open': // the canyon opens up into an open field
                return { left: 0, right: 0, mul: 1 - 0.65 * env, structures: false };
            case 'winding': { // corridor snakes left and right
                const s = Math.sin(wr * 0.035) * 0.22 * env;
                return { left: Math.max(0, s), right: Math.max(0, -s), mul: 0.8, structures: false };
            }
            case 'teeth': { // alternating jagged spurs from each side
                const p = ((wr % 36) + 36) % 36;
                const spur = p < 12 ? (1 - Math.abs(p - 6) / 6) * 0.26 * env : 0;
                const left = Math.floor(wr / 36) % 2 ? spur : 0;
                return { left, right: spur - left, mul: 0.9, structures: false };
            }
            case 'funnel': { // walls slowly close in, then snap open at the end
                const k = (t < 0.85 ? t / 0.85 : (1 - t) / 0.15) * env;
                return { left: 0.19 * k, right: 0.19 * k, mul: 1, structures: false };
            }
            case 'terraces': { // stepped shelves, offset per side
                const step = (o) => (Math.floor((((wr + o) % 48) + 48) % 48 / 12)) * 0.055 * env;
                return { left: step(0), right: step(24), mul: 0.85, structures: true };
            }
            case 'bulges': { // round boulders bulging out of both walls
                const b = (o) => Math.max(0, Math.sin((wr + o) * 0.11)) ** 2 * 0.2 * env;
                return { left: b(0), right: b(14), mul: 0.9, structures: false };
            }
            case 'zigzag': { // sharp diagonal switchbacks
                const p = (((wr % 40) + 40) % 40) / 40;
                const tri = (p < 0.5 ? p * 2 : 2 - p * 2) * 2 - 1;
                const s = tri * 0.2 * env;
                return { left: Math.max(0, s), right: Math.max(0, -s), mul: 0.75, structures: false };
            }
            case 'gorge': { // deep narrow cut with alcoves to dodge into
                const alcove = ((((wr % 30) + 30) % 30) < 8) ? 0.1 : 0;
                const side = Math.floor(wr / 30) % 2;
                const n = 0.16 * env;
                return { left: n - (side ? 0 : alcove * env), right: n - (side ? alcove * env : 0), mul: 1.15, structures: false };
            }
            case 'spires': { // thin needle spikes stabbing in from both sides
                const sp = (o) => { const p = (((wr + o) % 16) + 16) % 16; return p < 4 ? (1 - Math.abs(p - 1.5) / 2.5) * 0.24 * env : 0; };
                return { left: sp(0), right: sp(8), mul: 0.8, structures: false };
            }
            case 'ruins': { // collapsed blocks: stepped, square-edged chunks
                const blk = (o) => Math.floor(this.terrainHash(Math.floor((wr + o) / 14), 503 + o) * 4) * 0.05 * env;
                return { left: blk(0), right: blk(7), mul: 0.9, structures: true };
            }
            case 'reef': { // lumpy organic growth
                const lump = (o) => Math.max(0, Math.sin((wr + o) * 0.21) * 0.08 + Math.sin((wr + o) * 0.07) * 0.09 + 0.03) * env;
                return { left: lump(0), right: lump(31), mul: 0.85, structures: false };
            }
            case 'chasm': { // one cliff juts far out, the other side falls away
                const side = Math.floor(wr / 60) % 2;
                const c = 0.28 * env * Math.min(1, Math.min((((wr % 60) + 60) % 60), 60 - (((wr % 60) + 60) % 60)) / 8);
                return { left: side ? c : 0, right: side ? 0 : c, mul: side ? 1.2 : 0.5, structures: false };
            }
            case 'icefall': { // sawtooth icicles, sharp tip pointing downstream
                const saw = (o) => ((((wr + o) % 12) + 12) % 12) / 12 * 0.17 * env;
                return { left: saw(0), right: saw(6), mul: 0.9, structures: false };
            }
            case 'pipes': { // conduits reaching across in flat bands
                const p = ((wr % 24) + 24) % 24;
                const band = p < 3 ? 0.22 * env : 0.03 * env;
                const left = Math.floor(wr / 24) % 2 ? band : 0.03 * env;
                return { left, right: left === band ? 0.03 * env : band, mul: 1, structures: true };
            }
            case 'ribs': { // dense thin ribs like a skeleton
                const rb = ((((wr % 6) + 6) % 6) < 2 ? 0.09 : 0.02) * env;
                return { left: rb, right: rb, mul: 0.85, structures: false };
            }
            case 'delta': { // slow braided channel: walls swell and recede out of phase
                const a = (0.5 + 0.5 * Math.sin(wr * 0.05)) * 0.18 * env;
                const b = (0.5 + 0.5 * Math.sin(wr * 0.05 + 2.4)) * 0.18 * env;
                return { left: a, right: b, mul: 0.7, structures: false };
            }
            default: // canyon: the regular look with faction structures
                return { left: 0, right: 0, mul: 1, structures: true };
        }
    },
    /** Terrain art cell in logical px (shared by walls, ground and obstacles). */
    terrainCell() {
        if (typeof renderManager !== 'undefined' && renderManager.getCombatVoxelCell) {
            const cell = renderManager.getCombatVoxelCell();
            if (cell != null && cell > 0) return cell;
        }
        return typeof OBSTACLE_ART_DENSITY !== 'undefined' ? 1 / OBSTACLE_ART_DENSITY : 2.5;
    },
    /** Deterministic 0..1 hash for terrain segments. */
    terrainHash(a, b) {
        let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    /**
     * Wall material of a ~40-row segment on one side. Each has its own look,
     * silhouette and toughness (hits per cell): loose rock crumbles fast,
     * armour plating takes a beating, crystal shatters, magma vents in between.
     */
    terrainMaterial(wr, side) {
        const seg = Math.floor(wr / TERRAIN_SEGMENT_ROWS);
        const prof = this.terrainProfile();
        // Each area has its own wall material (fixed per planet + zone);
        // now and then a segment breaks the pattern for variety.
        const zi = this.terrainZoneIndex(wr, prof);
        const zoneMat = prof.zoneMats[this.terrainZoneId(zi, prof)];
        if (zoneMat && this.terrainHash(seg * 2 + side, 881) > 0.04) return TERRAIN_MATERIALS[zoneMat];
        const h = this.terrainHash(seg * 2 + side, 4099 + prof.seed % 997);
        const w = prof.materials;
        if (h < w[0]) return TERRAIN_MATERIALS.rock;
        if (h < w[1]) return TERRAIN_MATERIALS.metal;
        if (h < w[2]) return TERRAIN_MATERIALS.crystal;
        return TERRAIN_MATERIALS.magma;
    },
    /**
     * Canyon wall widths (in cells) at world row `wr`: base rock plus the
     * faction structure jutting out, shaped by the segment's material and
     * minus what has been shot away. Used by drawing and collisions alike.
     */
    terrainWallCells(wr, W) {
        const cell = this.terrainCell();
        const style = this.getEnvironment().style;
        const prof = this.terrainProfile();
        const maxCells = Math.floor((W * 0.38) / cell);
        // Build wall extents at an arbitrary world row (used for natural edges
        // and for the shared lip of a carved block band).
        const buildAt = (row) => {
            const zone = this.terrainZoneAt(row, prof);
            const gd = this.terrainGateRow(row, prof);
            const gate = gd == null ? 0 : Math.max(0, Math.round((W * 0.04) / cell) - (Math.abs(gd) === 3 ? 1 : 0));
            const outcrop = (side) => {
                const slot = Math.floor(row / 70);
                if (slot <= 1 || this.terrainHash(slot, prof.seed % 331) > 0.45 + 0.15 * (prof.danger || 0)) return 0;
                if ((this.terrainHash(slot, 17) < 0.5 ? 0 : 1) !== side) return 0;
                const t = (row - slot * 70 - 10) / 44;
                if (t < 0 || t > 1) return 0;
                const reach = 0.07 + this.terrainHash(slot, 29) * 0.1;
                return reach * Math.min(1, Math.sin(t * Math.PI) * 1.4);
            };
            const depth = (side, mat) => {
                const s = side * 37.1 + prof.phase;
                const f = prof.freq;
                const n = Math.sin(row * 0.05 * f + s) * 0.5 + Math.sin(row * 0.11 * f + s * 2) * 0.3
                    + Math.sin(row * 0.23 * f + s * 3) * 0.2;
                let d = (W * (0.03 + 0.028 * (n + 1) / 2) * prof.width * zone.mul
                    + W * (side ? zone.right : zone.left) * 0.7 + W * outcrop(side)) / cell
                    + gate;
                // Material jitter changes in blocks of rows, never per single
                // row: per-row noise left 1-row slivers that read as strata.
                const jr = Math.floor(row / TERRAIN_JITTER_ROWS);
                if (mat.id === 'metal') {
                    d = Math.round(d / 2) * 2 + (this.terrainHash(jr, side + 19) < 0.4 ? 1 : 0);
                } else if (mat.id === 'crystal') {
                    d += 1 + this.terrainHash(jr, side + 31) * 3;
                } else if (mat.id === 'rock') {
                    d += Math.floor(this.terrainHash(jr, side + 7) * 3) - 1;
                } else {
                    d += (this.terrainHash(jr, side + 47) - 0.5) * 3;
                }
                return Math.max(2, Math.round(d));
            };
            const structure = (side) => {
                const slot = Math.floor(row / 36);
                if ((slot + side) % 2 && style !== 'tech' && style !== 'organic') return 0;
                const t = (row - slot * 36 - 10) / 14;
                if (t < 0 || t > 1) return 0;
                let v;
                switch (style) {
                    case 'tech': v = 0.07 * (t < 0.2 || t > 0.8 ? 0.55 : 1); break;
                    case 'organic': v = 0.08 * Math.sin(t * Math.PI) * (0.7 + 0.3 * Math.sin(t * 6)); break;
                    case 'spike': v = 0.11 * (1 - Math.abs(t - 0.5) * 2); break;
                    case 'scrap': v = t < 0.2 || t > 0.75 ? 0.09 : 0.035; break;
                    default: v = 0.045 * Math.sin(t * Math.PI);
                }
                return Math.round((W * v) / cell);
            };
            const zi = this.terrainZoneIndex(row, prof);
            const local = row - zi * prof.zoneRows;
            let sill = 0;
            if (gate <= 0 && zi >= 1 && local < TERRAIN_SILL_ROWS) {
                const edgeRow = local === 0 || local === TERRAIN_SILL_ROWS - 1;
                sill = Math.round((W * TERRAIN_SILL_REACH * (edgeRow ? 0.6 : 1)) / cell);
            }
            const sides = [0, 1].map((side) => {
                let mat = this.terrainMaterial(row, side) || { id: 'rock', hp: 1 };
                let base = depth(side, mat);
                let full = base + sill + (zone.structures && !sill ? structure(side) : 0);
                // Hangar opening side craft fly out of: open slot, metal jambs around it.
                const hatch = gd == null && !sill ? this.terrainOpeningInfo(row, side) : null;
                let tunnel = 0;
                let lip = 0;
                if (hatch && hatch.kind === 'gap') {
                    tunnel = full;
                    full = base = 0;
                } else if (hatch) {
                    lip = this.terrainOpeningLip(style, hatch, row);
                    if (style === 'tech') mat = TERRAIN_MATERIALS.metal;
                    full += lip;
                }
                return { mat, base, sill, full, tunnel, lip, hatch: hatch ? hatch.kind : null };
            });
            const over = sides[0].full + sides[1].full - maxCells;
            if (over > 0) {
                const tot = sides[0].full + sides[1].full;
                sides.forEach((f) => {
                    f.full = Math.max(2, f.full - Math.ceil(over * f.full / tot));
                    f.base = Math.min(f.base, f.full);
                });
            }
            return sides;
        };
        // Each row keeps its natural silhouette until a crater cuts into it: the cut is an absolute
        // depth (cells from the screen edge), so a crater bites through the outline instead of
        // shifting the whole jagged edge outward.
        const fullOf = buildAt(wr);
        const out = {};
        for (let side = 0; side < 2; side++) {
            const key = side + ':' + wr;
            const dmg = this.terrainDamage ? (this.terrainDamage.get(key) || 0) : 0;
            const cut = this.terrainCut ? this.terrainCut.get(key) : undefined;
            const { mat, base, full, sill } = fullOf[side];
            const width = cut != null ? Math.max(0, Math.min(full, cut)) : full;
            const k = side ? 'right' : 'left';
            out[k] = width;
            out[k + 'Base'] = Math.min(base, width);
            out[k + 'Mat'] = mat;
            out[k + 'Cracked'] = width > 0 && (dmg > 0 || (cut != null && cut < full));
            out[k + 'Sill'] = sill > 0 ? Math.max(0, width - out[k + 'Base']) : 0;
            // Hangar opening: recess depth behind an open slot, faction lip on the frame.
            out[k + 'Hatch'] = fullOf[side].hatch;
            out[k + 'Tunnel'] = fullOf[side].tunnel;
            out[k + 'Lip'] = Math.min(width, fullOf[side].lip);
        }
        return out;
    },
    /**
     * Hangar openings in the rim walls: one every ~150px of scroll on an
     * alternating-ish side, tall enough for a side craft. Returns 'gap' for
     * the open slot, 'frame' for the jamb rows above/below it, else null.
     */
    terrainOpeningAt(row, side) {
        const info = this.terrainOpeningInfo(row, side);
        return info ? info.kind : null;
    },
    /** { kind: 'gap'|'frame', t: row index inside the hatch, len: total rows } or null. */
    terrainOpeningInfo(row, side) {
        const cell = this.terrainCell();
        const period = Math.max(20, Math.round(150 / cell));
        const open = Math.max(6, Math.round(TERRAIN_OPENING_PX / cell));
        // Thick enough to read as a solid jamb (and to be hit), not a thin sliver.
        const frame = Math.max(4, Math.round(8 / cell));
        const slot = Math.floor(row / period);
        if (slot < 1) return null;
        const prof = this.terrainProfile();
        if ((this.terrainHash(slot, 613 + prof.seed % 211) < 0.5 ? 0 : 1) !== side) return null;
        const t = row - slot * period - Math.floor(period * 0.3);
        const len = open + frame * 2;
        if (t < 0 || t >= len) return null;
        return { kind: t >= frame && t < frame + open ? 'gap' : 'frame', t: t, len: len, frame: frame };
    },
    /**
     * How far the frame juts out per faction: tech = flat blast-door jambs,
     * spike = fangs, organic = swollen rounded lips, scrap = welded junk,
     * plain rock = a ragged cave rim.
     */
    terrainOpeningLip(style, hatch, row) {
        const below = hatch.t >= hatch.len / 2;
        const k = below ? hatch.len - 1 - hatch.t : hatch.t; // 0 = outer row of the frame
        const near = k + 1; // grows towards the slot
        switch (style) {
            case 'tech': return 3;
            case 'spike': return 1 + near * 2;
            case 'organic': return 2 + Math.round(Math.sin(near / (hatch.frame + 1) * Math.PI * 0.5) * 2);
            // One width per hatch (seeded by its first row), not re-rolled per row.
            case 'scrap': return 2 + Math.floor(this.terrainHash(row - hatch.t, 71) * 3);
            default: return 1 + Math.floor(this.terrainHash(row - hatch.t, 59) * 2);
        }
    },
    /** World row of the wall layer at screen y. */
    terrainRowAtY(y) {
        const cell = this.terrainCell();
        const offset = this.terrainOffset || 0;
        return Math.floor(offset / cell) - Math.floor((y - offset % cell) / cell);
    },
    /**
     * How hard a shot bites into the walls: `power` = damage points on the
     * hit row, `radius` = rows around it that crumble too (crater size),
     * `pierce` = the shot keeps going, `vsMetal` = bonus on armour plating.
     * Scaled by the shot's damage (10 = baseline).
     */
    terrainWeaponProfile(bullet) {
        const type = String((bullet && bullet.type) || '').replace(/^enemy_/, '');
        const base = {
            missile_shot: { power: 10, radius: 5 },
            nova_shot: { power: 9, radius: 5 },
            plasma_beam: { power: 7, radius: 3 },
            plasma: { power: 7, radius: 3 },
            ion_beam: { power: 5, radius: 2, vsMetal: 3 },
            pierce_beam: { power: 5, radius: 2, pierce: true },
            laser_beam: { power: 5, radius: 2 },
            laser: { power: 5, radius: 2 },
            wave_beam: { power: 5, radius: 2 },
            spread_beam: { power: 5, radius: 2 },
            spread: { power: 5, radius: 2 },
            rapid_beam: { power: 4, radius: 1 },
            rapid: { power: 4, radius: 1 },
            burst_shot: { power: 5, radius: 2 }
        }[type] || { power: 5, radius: 2 };
        const dmg = Number(bullet && bullet.damage);
        const scale = Number.isFinite(dmg) && dmg > 0 ? Math.max(1, Math.min(4, dmg / 6)) : 1;
        return {
            power: Math.max(3, Math.round(base.power * scale)),
            radius: base.radius,
            pierce: !!base.pierce,
            vsMetal: base.vsMetal || 2
        };
    },
    /**
     * A shot hit the wall on `side` at screen y: carve a round, slightly
     * ragged crater into it (deepest on the hit row, falling off over
     * `radius` rows). Cells take `hp` points each, so tough material needs
     * several hits and shows cracks in between, like obstacles.
     * Returns how many cells broke off (0 = only chipped).
     */
    damageTerrain(y, side, profile) {
        if (!this.terrainDamage) this.terrainDamage = new Map();
        if (!this.terrainCut) this.terrainCut = new Map();
        const pr = profile || { power: 3, radius: 2, vsMetal: 2 };
        const wr = this.terrainRowAtY(y);
        const R = Math.max(1, pr.radius || 1) + 1;
        const W = (typeof game !== 'undefined' && game && game.internalWidth) || 240;
        const k0 = side ? 'right' : 'left';
        // Crater is anchored at the lip of the row that was hit: rows that stick out further are cut
        // back to the bowl, rows already behind it stay as they are.
        const lip = this.terrainWallCells(wr, W)[k0];
        let broken = 0;
        for (let d = -R; d <= R; d++) {
            const row = wr + d;
            const fall = Math.sqrt(Math.max(0, 1 - (d / (R + 0.5)) * (d / (R + 0.5))));
            const mat = this.terrainMaterial(row, side) || { id: 'rock', hp: 1 };
            const hp = Math.max(1, mat.hp || 1);
            let pts = Math.round(pr.power * fall * (mat.id === 'metal' ? (pr.vsMetal || 2) : 1)
                * (0.7 + Math.random() * 0.6));
            if (d === 0) pts = Math.max(1, pts);
            if (pts <= 0) continue;
            const k = side + ':' + row;
            // Points below one cell's toughness stay as cracks; every full `hp` digs one cell deeper.
            const acc = (this.terrainDamage.get(k) || 0) + pts;
            const depth = Math.floor(acc / hp);
            this.terrainDamage.set(k, acc - depth * hp);
            if (depth <= 0) continue;
            const cur = this.terrainWallCells(row, W)[k0];
            const target = Math.max(0, lip - depth);
            if (target < cur) {
                this.terrainCut.set(k, target);
                broken += cur - target;
            }
        }
        // Force the scroll-terrain wall layer to rebuild so carved cells match collision.
        this._terrainDamageEpoch = (this._terrainDamageEpoch || 0) + 1;
        if (typeof renderManager !== 'undefined' && renderManager._terrainLayerKey) {
            renderManager._terrainLayerKey = null;
        }
        if (this.terrainDamage.size > 4000) {
            const cutoff = wr - 1200;
            this.terrainDamage.forEach((_, k) => { if (+k.split(':')[1] < cutoff) this.terrainDamage.delete(k); });
        }
        if (this.terrainCut.size > 4000) {
            const cutoff = wr - 1200;
            this.terrainCut.forEach((_, k) => { if (+k.split(':')[1] < cutoff) this.terrainCut.delete(k); });
        }
        return broken;
    },
    /** Chunk colours for wall debris of a material (painted palette when available). */
    terrainDebrisColors(mat) {
        const mp = typeof renderManager !== 'undefined' && renderManager._terrainMats
            ? renderManager._terrainMats[(mat && mat.id) || 'rock'] : null;
        return mp ? mp.body.concat([mp.crack, '#05060a']) : ['#9aa0a8', '#6e737b', '#c8ccd2', '#05060a'];
    },
    /** Wall extents in px at screen y: { left, right } = inner edges. */
    terrainWallsAtY(y, W) {
        if (!this.hasTerrain()) return null;
        const cell = this.terrainCell();
        const width = Math.max(1, Number(W) || ((typeof game !== 'undefined' && game && game.internalWidth) || 240));
        const c = this.terrainWallCells(this.terrainRowAtY(y), width);
        if (!c) return null;
        return { left: (c.left || 0) * cell, right: width - (c.right || 0) * cell };
    },
    /** Innermost wall edges over the vertical span [y0, y1]. */
    terrainWallsOver(y0, y1, W) {
        if (!this.hasTerrain()) return null;
        const cell = this.terrainCell();
        let left = 0, right = W;
        for (let y = y0; y <= y1 + cell; y += cell) {
            const w = this.terrainWallsAtY(Math.min(y, y1), W);
            if (!w) return null;
            left = Math.max(left, w.left);
            right = Math.min(right, w.right);
        }
        return { left, right };
    },
});
