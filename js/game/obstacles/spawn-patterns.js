"use strict";

// ObstacleManager methods: pattern waves built from the planet's obstacle defs.
// Defs are the material palette (asteroid / shield / crystal / fog); the
// pattern decides the shape of the wave: fields, belts with a passage, walls
// with gaps, arcs, swarms and a big rock with a debris halo. Waves grow
// denser the longer a run lasts.
const OBSTACLE_PATTERNS = [
    { id: 'field', weight: 4 },
    { id: 'belt', weight: 3 },
    { id: 'gapWall', weight: 2 },
    { id: 'arc', weight: 2 },
    { id: 'swarm', weight: 2 },
    { id: 'boulder', weight: 2 },
    { id: 'stream', weight: 2 }
];
const OBSTACLE_MAX_ALIVE = 70;
const OBSTACLE_RAMP_MS = 90000; // density ramps up over the first 90 s

extendClass(ObstacleManager, {
    /** 0..1 intensity that grows over the run. */
    patternIntensity() {
        return Math.max(0, Math.min(1, (this.runTime || 0) / OBSTACLE_RAMP_MS));
    },

    pickPattern() {
        const total = OBSTACLE_PATTERNS.reduce((s, p) => s + p.weight, 0);
        let r = Math.random() * total;
        for (let i = 0; i < OBSTACLE_PATTERNS.length; i++) {
            r -= OBSTACLE_PATTERNS[i].weight;
            if (r <= 0) return OBSTACLE_PATTERNS[i].id;
        }
        return 'field';
    },

    /**
     * Spawn one pattern wave. Pattern points are in a local frame:
     * u = distance behind the entry edge (along travel), w = across travel.
     */
    spawnPatternWave(gameState) {
        if (!this.hasDefs()) return;
        const alive = this.obstacles.filter((o) => !o.isFog).length;
        if (alive >= OBSTACLE_MAX_ALIVE) return;

        const lead = this.pickWeightedDef();
        if (!lead) return;
        const solid = this.obstacleDefs.filter((d) => d && d.kind !== 'fog');
        const palette = solid.length ? solid : this.obstacleDefs;
        const direction = lead.direction || 'ltr';
        const speedJitter = 0.85 + Math.random() * 0.3;
        const speeds = this.directionToSpeed(direction, (lead.speed != null ? lead.speed : 0.8) * speedJitter);
        const W = (gameState && gameState.width) || 240;
        const H = (gameState && gameState.height) || 300;

        // Travel axis and its perpendicular (unit vectors).
        const len = Math.hypot(speeds.horizontalSpeed, speeds.verticalSpeed) || 1;
        const vx = speeds.horizontalSpeed / len;
        const vy = speeds.verticalSpeed / len;
        const px = -vy;
        const py = vx;
        // Width of the playfield seen across the travel direction.
        let across = Math.abs(px) * W + Math.abs(py) * H;
        // Entry point: the field centre pushed back to the edge it enters from.
        const cx = W / 2;
        let cy = H / 2;
        // Side-crossing waves are squeezed into the mid lane between enemy
        // and player; vertical/diagonal waves (and a few strays) still sweep
        // the whole field so obstacles occasionally reach both ships.
        if (Math.abs(vx) > Math.abs(vy) * 1.5 && Math.random() >= 0.15) {
            const lane = this.midLane(H);
            across = lane.bottom - lane.top;
            // Entry is pushed back along travel, so the wave crosses the
            // lane centre at mid-field.
            cy = (lane.top + lane.bottom) / 2;
        }
        const back = Math.abs(vx) * W / 2 + Math.abs(vy) * H / 2 + 12;
        const ex = cx - vx * back;
        const ey = cy - vy * back;

        const intensity = this.patternIntensity();
        const pattern = this.pickPattern();
        const pts = this.thinPatternPoints(
            this.buildPatternPoints(pattern, across, intensity),
            { vx: vx, vy: vy, py: py, cy: cy, H: H, intensity: intensity }
        );
        const budget = OBSTACLE_MAX_ALIVE - alive;
        pts.slice(0, budget).forEach((pt) => {
            const def = pt.big ? (palette.slice().sort((a, b) => (b.width || 10) - (a.width || 10))[0])
                : this.pickWeightedDef(palette);
            const scale = pt.scale || (0.7 + Math.random() * 0.6);
            const w = (def.width || 10) * scale;
            const h = (def.height || 10) * scale;
            const x = ex - vx * pt.u + px * pt.w - w / 2;
            const y = ey - vy * pt.u + py * pt.w - h / 2;
            const obs = this.createObstacleFromDef(def, {
                x: x,
                y: y,
                width: w,
                height: h,
                horizontalSpeed: speeds.horizontalSpeed * (pt.speedMul || 1),
                verticalSpeed: speeds.verticalSpeed * (pt.speedMul || 1)
            });
            obs.entering = true;
            obs.age = 0;
            this.obstacles.push(obs);
        });
    },

    /**
     * Keep waves airy and the ship zones mostly clear:
     * - points that would cross the enemy band (top third) or the player band
     *   (bottom ~30%) survive only rarely, so obstacles there come singly;
     * - waves that sweep vertically cross both bands, so they're cut to a
     *   few stragglers;
     * - every wave is randomly thinned and capped so it never fills an area.
     */
    thinPatternPoints(pts, o) {
        const H = o.H;
        const enemyBottom = H * 0.33;
        const playerTop = H * 0.7;
        const vertical = Math.abs(o.vy) >= Math.abs(o.vx) * 1.5;
        const zoneKeep = 0.1;
        let out = pts.filter((pt) => {
            if (Math.random() < 0.3) return false; // open random gaps
            if (vertical) return Math.random() < 0.3;
            // Height of the point when the wave is at mid-field.
            const y = o.cy + o.py * pt.w;
            if (y < enemyBottom || y > playerTop) return Math.random() < zoneKeep;
            return true;
        });
        const cap = vertical ? 4 : Math.round(8 + 6 * (o.intensity || 0));
        if (out.length > cap) {
            out = out.sort(() => Math.random() - 0.5).slice(0, cap);
        }
        return out;
    },

    /** Local-frame points for a pattern; `across` is the field width across travel. */
    buildPatternPoints(pattern, across, intensity) {
        const half = across / 2;
        const rand = (a, b) => a + Math.random() * (b - a);
        const pts = [];
        const count = (min, max) => Math.round(min + (max - min) * intensity + Math.random() * 2);
        switch (pattern) {
            case 'belt': {
                // Dense diagonal band with one passage the player can thread.
                const n = count(10, 22);
                const slope = rand(-0.6, 0.6);
                const gapW = rand(-half * 0.6, half * 0.6);
                const gapSize = Math.max(26, 40 - intensity * 12);
                for (let i = 0; i < n; i++) {
                    const w = -half + (across * (i + Math.random() * 0.6)) / n;
                    if (Math.abs(w - gapW) < gapSize / 2) continue;
                    pts.push({ u: (w + half) * Math.abs(slope) + rand(0, 10), w: w, scale: rand(0.8, 1.3) });
                    if (Math.random() < 0.35 + intensity * 0.3) {
                        pts.push({ u: (w + half) * Math.abs(slope) + rand(12, 22), w: w + rand(-6, 6), scale: rand(0.5, 0.9) });
                    }
                }
                break;
            }
            case 'gapWall': {
                // One or two rows across the whole field, each with a gap.
                const rows = intensity > 0.5 && Math.random() < 0.6 ? 2 : 1;
                for (let r = 0; r < rows; r++) {
                    const step = 11;
                    const gapW = rand(-half * 0.7, half * 0.7);
                    const gapSize = Math.max(28, 42 - intensity * 12);
                    for (let w = -half + 4; w < half; w += step) {
                        if (Math.abs(w - gapW) < gapSize / 2) continue;
                        pts.push({ u: r * 60 + rand(-2, 2), w: w, scale: rand(0.9, 1.15) });
                    }
                }
                break;
            }
            case 'arc': {
                // A curved line, opening towards or away from the player.
                const n = count(7, 14);
                const radius = rand(half * 0.5, half * 0.9);
                const centerW = rand(-half * 0.3, half * 0.3);
                const flip = Math.random() < 0.5 ? 1 : -1;
                for (let i = 0; i < n; i++) {
                    const a = -Math.PI / 2 + (Math.PI * i) / (n - 1);
                    pts.push({ u: radius + flip * Math.cos(a) * radius * 0.6, w: centerW + Math.sin(a) * radius, scale: rand(0.8, 1.1) });
                }
                break;
            }
            case 'swarm': {
                // Many small, slightly faster pebbles in a loose cloud.
                const n = count(12, 26);
                const centerW = rand(-half * 0.5, half * 0.5);
                const spread = rand(half * 0.35, half * 0.7);
                for (let i = 0; i < n; i++) {
                    pts.push({ u: rand(0, 50), w: centerW + rand(-spread, spread), scale: rand(0.45, 0.75), speedMul: rand(1.1, 1.4) });
                }
                break;
            }
            case 'boulder': {
                // One big rock with a halo of debris.
                const centerW = rand(-half * 0.6, half * 0.6);
                pts.push({ u: 34, w: centerW, scale: 2, big: true });
                const n = count(5, 10);
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 * i) / n + rand(-0.3, 0.3);
                    const r = rand(18, 30);
                    pts.push({ u: 34 + Math.cos(a) * r, w: centerW + Math.sin(a) * r, scale: rand(0.4, 0.7) });
                }
                break;
            }
            case 'stream': {
                // A long snaking chain.
                const n = count(8, 16);
                const startW = rand(-half * 0.6, half * 0.6);
                const amp = rand(12, half * 0.4);
                for (let i = 0; i < n; i++) {
                    pts.push({ u: i * 11, w: startW + Math.sin(i * 0.7) * amp, scale: rand(0.7, 1.0) });
                }
                break;
            }
            case 'field':
            default: {
                // Scattered field across the whole width, rocks kept apart.
                const n = count(8, 18);
                let tries = 0;
                while (pts.length < n && tries++ < n * 8) {
                    const p = { u: rand(0, 70), w: rand(-half + 4, half - 4), scale: rand(0.6, 1.4) };
                    if (pts.every((q) => Math.hypot(q.u - p.u, q.w - p.w) > 12)) pts.push(p);
                }
                break;
            }
        }
        return pts;
    },
});
