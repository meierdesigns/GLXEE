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
const OBSTACLE_SCROLL_SPEED = 0.55; // px/frame the level scrolls in regular stages
const TERRAIN_ZONES = ['canyon', 'narrows', 'open', 'winding', 'teeth', 'funnel', 'terraces', 'bulges', 'zigzag', 'gorge',
    'spires', 'ruins', 'reef', 'chasm', 'icefall', 'pipes', 'ribs', 'delta'];
const TERRAIN_SEGMENT_ROWS = 40; // wall rows per material segment
const TERRAIN_MATERIALS = {
    rock: { id: 'rock', hp: 1, score: 2 },
    metal: { id: 'metal', hp: 3, score: 6 },
    crystal: { id: 'crystal', hp: 1, score: 4 },
    magma: { id: 'magma', hp: 2, score: 3 }
};
const TERRAIN_SILL_ROWS = 5;     // rows of the threshold at an area change
const TERRAIN_SILL_REACH = 0.13; // how far it juts in from each side (x W)
const OBSTACLE_LAYER_SPACING = 160; // px of scroll between obstacle rows
// Areas that squeeze or stab into the passage; later stages favour them.
const TERRAIN_HARSH_ZONES = ['narrows', 'teeth', 'zigzag', 'gorge', 'spires', 'icefall', 'ribs', 'chasm', 'funnel'];
const TERRAIN_CALM_ZONES = ['canyon', 'open', 'delta', 'winding'];

extendClass(ObstacleManager, {
    /**
     * Stage danger 0..1: stage 1 = 0, the last stage and the boss = 1.
     * Later stages start denser and get harsher areas (kept moderate).
     */
    stageDanger() {
        const level = this.getCurrentLevel();
        if (!level) return 0;
        const n = Math.max(2, Number(level.stagesPerPlanet) || 3);
        if (level.isBoss) return 1;
        const i = Math.max(1, Number(level.stageIndex) || 1);
        return Math.max(0, Math.min(1, (i - 1) / (n - 1)));
    },

    /** 0..1 intensity that grows over the run (later stages start higher). */
    patternIntensity() {
        const ramp = (this.runTime || 0) / OBSTACLE_RAMP_MS;
        return Math.max(0, Math.min(1, Math.max(ramp, this.stageDanger() * 0.35)));
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

    /** Downward scroll speed (px/frame) for regular stages. */
    scrollSpeed() {
        return OBSTACLE_SCROLL_SPEED + this.patternIntensity() * 0.15;
    },

    /**
     * Scroll mode: the level moves towards the player. Each layer is a
     * horizontal train that flows in from the left or right (alternating)
     * while drifting down with the scroll. The train is built from small
     * tight groups separated by holes wide enough for a ship to slip through.
     * A new layer spawns once the previous one has scrolled far enough.
     */
    updateScrollLayers(deltaTime, gameState) {
        const frameScale = Math.min(3, Math.max(0, Number(deltaTime) || 16.67) / 16.67);
        this.scrollDistance = (this.scrollDistance || 0) + this.scrollSpeed() * frameScale;
        // Side terrain scrolls with the level (render/draw-environment.js).
        this.terrainOffset = (this.terrainOffset || 0) + this.scrollSpeed() * frameScale;
        const spacing = OBSTACLE_LAYER_SPACING - this.patternIntensity() * 30;
        if (this.scrollDistance < spacing) return;
        this.scrollDistance = 0;
        this.spawnScrollLayer(gameState);
    },

    spawnScrollLayer(gameState) {
        const W = (gameState && gameState.width) || 240;
        const H = (gameState && gameState.height) || 300;
        const intensity = this.patternIntensity();
        const alive = this.obstacles.filter((o) => !o.isFog).length;
        if (alive >= OBSTACLE_MAX_ALIVE) return;
        // Every so often leave a breather layer empty.
        if (Math.random() < 0.2) return;

        const defs = this.hasDefs() ? this.obstacleDefs : null;
        const solid = defs ? defs.filter((d) => d && d.kind !== 'fog') : [];
        const fog = defs ? defs.filter((d) => d && d.kind === 'fog') : [];
        this.scrollFlowDir = -(this.scrollFlowDir || -1);
        const dir = this.scrollFlowDir; // +1 = left→right, -1 = right→left
        const hSpeed = dir * (0.45 + Math.random() * 0.25 + intensity * 0.15);
        const vSpeed = this.scrollSpeed() * 0.5;
        const baseY = H * (0.02 + Math.random() * 0.14);

        // Walk along the train: group, hole, group, hole ...
        const trainLen = W * (1.0 + Math.random() * 0.4);
        const minHole = Math.max(56, 80 - intensity * 20);
        let cursor = Math.random() * 20;
        let spawned = 0;
        while (cursor < trainLen && alive + spawned < OBSTACLE_MAX_ALIVE) {
            const groupSize = 1 + Math.floor(Math.random() * (1.6 + intensity * 1.2));
            const rowY = baseY + (Math.random() - 0.5) * 18;
            let groupEnd = cursor;
            for (let g = 0; g < groupSize; g++) {
                const useFog = fog.length && Math.random() < 0.06;
                // Mostly mid-sized, some pebbles, the odd big chunk.
                const roll = Math.random();
                const scale = roll < 0.25 ? 0.55 + Math.random() * 0.25
                    : roll > 0.88 ? 1.7 + Math.random() * 0.6
                        : 0.85 + Math.random() * 0.6;
                let obs;
                if (defs && (solid.length || useFog)) {
                    const def = this.pickWeightedDef(useFog ? fog : solid);
                    obs = this.createObstacleFromDef(def, {
                        width: (def.width || 10) * scale,
                        height: (def.height || 10) * scale
                    });
                } else {
                    this.spawnObstacle(gameState);
                    obs = this.obstacles.pop();
                }
                // Lead rock of a group may be a big boulder with breakable parts.
                if (g === 0 && !obs.isBoulder) this.maybeBoulder(obs);
                // Tight packing inside a group, occasionally stacked in two rows.
                const stacked = g > 0 && Math.random() < 0.15;
                const along = stacked ? groupEnd - obs.width * 0.9 : groupEnd + (g ? 1 : 0);
                const off = stacked ? obs.height * (Math.random() < 0.5 ? -1 : 1) : (Math.random() - 0.5) * 6;
                obs.x = dir > 0 ? -obs.width - 2 - along : W + 2 + along;
                obs.y = rowY + off - obs.height / 2;
                obs.horizontalSpeed = hSpeed;
                obs.verticalSpeed = vSpeed;
                obs.entering = true;
                obs.age = 0;
                this.obstacles.push(obs);
                spawned++;
                groupEnd = Math.max(groupEnd, along + obs.width);
                // A boulder stands alone instead of being buried in a pile.
                if (obs.isBoulder) break;
            }
            cursor = groupEnd + minHole + Math.random() * 50;
        }
    },

    /**
     * Per-planet canyon character, fixed for a planet (hashed from its id):
     * zone mix and length, wall width, how winding it is, material weights.
     */
    terrainProfile() {
        const level = this.getCurrentLevel();
        const pid = String((level && (level.planetId || level.background)) || 'mars');
        // Each stage gets its own area order / walls / floors.
        const stage = level ? (level.isBoss ? 'boss' : String(level.stageIndex || 1)) : '1';
        const danger = this.stageDanger();
        if (this._terrainProfile && this._terrainProfile.pid === pid && this._terrainProfile.stage === stage
            && this._terrainProfile.env === this.getEnvironment()) return this._terrainProfile;
        let seed = 7;
        const seedKey = pid + '#' + stage;
        for (let i = 0; i < seedKey.length; i++) seed = (Math.imul(seed, 31) + seedKey.charCodeAt(i)) >>> 0;
        // Planet-only seed for the base wall width, so later stages are never
        // thinner-walled than earlier ones.
        let pseed = 7;
        for (let i = 0; i < pid.length; i++) pseed = (Math.imul(pseed, 31) + pid.charCodeAt(i)) >>> 0;
        const r = (k) => this.terrainHash(seed % 100003, k);
        const env = this.getEnvironment();
        // Planet look: only its own areas appear.
        const zoneBias = env.zones || null;
        // Later stages lean towards harsh areas (within the planet's own set).
        const zoneMul = (z) => TERRAIN_HARSH_ZONES.includes(z) ? 1 + 1.5 * danger
            : (TERRAIN_CALM_ZONES.includes(z) ? 1 - 0.5 * danger : 1);
        const zones = TERRAIN_ZONES.map((z, i) => ({
            id: z,
            weight: (zoneBias ? (zoneBias[z] ? zoneBias[z] : 0) : 0.3 + r(50 + i) * 1.4) * zoneMul(z)
        }));
        // Material weights -> cumulative thresholds for rock/metal/crystal/magma.
        const mw = [0.2 + r(3), 0.1 + r(4) * 0.8, 0.1 + r(5) * 0.8, 0.05 + r(6) * 0.7];
        // Wall material per area type (planet-specific pick).
        const matIds = ['rock', 'metal', 'crystal', 'magma'];
        const zoneMats = {};
        // Shuffled per planet so neighbouring area types look distinct.
        const shuffle = (arr, k) => arr.map((v, i) => ({ v, h: r(k + i) })).sort((x, y) => x.h - y.h).map((e) => e.v);
        const mats = shuffle(matIds, 80);
        // The planet graphic's look sets every area's wall + floor (cycled so
        // neighbouring areas still differ within the planet's set).
        const off = Math.floor(r(33) * 5);
        const prefer = (list, k, i, fallback) => (list && list.length) ? list[(i + off) % list.length] : fallback;
        TERRAIN_ZONES.forEach((z, i) => { zoneMats[z] = prefer(env.materials, 120, i, mats[i % mats.length]); });
        // Floor pattern per area type.
        const floorIds = ['craters', 'plates', 'dunes', 'cracks', 'grid', 'ridges', 'hex', 'rubble', 'veins'];
        const zoneFloors = {};
        const floors = shuffle(floorIds, 90);
        TERRAIN_ZONES.forEach((z, i) => { zoneFloors[z] = prefer(env.floors, 160, i, floors[i % floors.length]); });
        if (env.materials) {
            // Random segments lean towards the planet's materials too.
            env.materials.forEach((m) => { mw[matIds.indexOf(m)] *= 10; });
        }
        const tot = mw.reduce((a, b) => a + b, 0);
        let acc = 0;
        const materials = mw.map((v) => (acc += v / tot));
        this._terrainProfile = {
            pid, stage, danger, env, seed, zones, materials, zoneMats, zoneFloors,
            // ~12-17 s per area at the base scroll speed: long, coherent stretches.
            zoneRows: Math.round(170 + r(1) * 70),
            // Thicker walls on later stages (narrower passage, still flyable).
            width: (0.75 + this.terrainHash(pseed % 100003, 2) * 0.6) * (env.width || 1) * (1 + 0.18 * danger),
            freq: 0.6 + r(7) * 1.0,
            phase: r(8) * 100
        };
        return this._terrainProfile;
    },

    /**
     * Flight area at world row `wr`: zones follow each other along the run
     * and blend over a few rows. Returns wall offsets as fractions of W,
     * a depth multiplier and whether faction structures show.
     */
    terrainZoneAt(wr, prof) {
        const len = prof.zoneRows;
        const idx = Math.floor(wr / len);
        const t = (wr - idx * len) / len;
        const a = this.terrainZoneShape(this.terrainZoneId(idx, prof), wr, t);
        // Blend into the next zone over the last 15% of this one.
        if (t < 0.85) return a;
        const b = this.terrainZoneShape(this.terrainZoneId(idx + 1, prof), wr, 0);
        const k = (t - 0.85) / 0.15;
        const m = (x, y) => x + (y - x) * k;
        return { left: m(a.left, b.left), right: m(a.right, b.right), mul: m(a.mul, b.mul), structures: k < 0.5 ? a.structures : b.structures };
    },

    /**
     * Threshold between two areas: rows from the zone seam (0 = seam row),
     * or null when not near one. The gate spans 7 rows centred on it.
     */
    terrainGateRow(wr, prof) {
        const p = prof || this.terrainProfile();
        const len = p.zoneRows;
        const idx = Math.round(wr / len);
        if (idx <= 0) return null;
        const d = wr - idx * len;
        return Math.abs(d) <= 3 ? d : null;
    },

    terrainZoneIndex(wr, prof) {
        return Math.floor(wr / (prof || this.terrainProfile()).zoneRows);
    },

    /** Area floor pattern at world row wr (dithered changeover near the seam). */
    terrainFloorAt(wr, cx) {
        const prof = this.terrainProfile();
        const len = prof.zoneRows;
        const idx = Math.floor(wr / len);
        const t = (wr - idx * len) / len;
        return prof.zoneFloors[this.terrainZoneId(idx, prof)] || 'craters';
    },

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
        const zone = this.terrainZoneAt(wr, prof);
        // Area threshold: both walls step in to flat gate pillars.
        const gd = this.terrainGateRow(wr, prof);
        // Pillar reaches ~10% of W; its top/bottom rows taper by one cell.
        const gate = gd == null ? 0 : Math.round((W * 0.1) / cell) - (Math.abs(gd) === 3 ? 1 : 0);
        // Occasional big outcrop reaching far into the passage (one side per slot).
        const outcrop = (side) => {
            const slot = Math.floor(wr / 70);
            if (slot <= 1 || this.terrainHash(slot, prof.seed % 331) > 0.45 + 0.15 * (prof.danger || 0)) return 0;
            if ((this.terrainHash(slot, 17) < 0.5 ? 0 : 1) !== side) return 0;
            const t = (wr - slot * 70 - 10) / 44;
            if (t < 0 || t > 1) return 0;
            const reach = 0.12 + this.terrainHash(slot, 29) * 0.16;
            // Rounded bump with a flat-ish top.
            return reach * Math.min(1, Math.sin(t * Math.PI) * 1.4);
        };
        const depth = (side, mat) => {
            const s = side * 37.1 + prof.phase;
            const f = prof.freq;
            const n = Math.sin(wr * 0.05 * f + s) * 0.5 + Math.sin(wr * 0.11 * f + s * 2) * 0.3
                + Math.sin(wr * 0.23 * f + s * 3) * 0.2;
            let d = (W * (0.05 + 0.045 * (n + 1) / 2) * prof.width * zone.mul
                + W * (side ? zone.right : zone.left) + W * outcrop(side)) / cell
                + gate;
            // Per-material silhouette on top of the shared canyon curve.
            if (mat.id === 'metal') d = Math.round(d / 3) * 3 + 1;              // stepped blocks
            else if (mat.id === 'crystal') d += 3 * (1 - Math.abs(((wr % 8) + 8) % 8 - 4) / 4); // spikes
            else if (mat.id === 'rock') d += Math.floor(this.terrainHash(wr, side + 7) * 3) - 1; // rubble
            else d += Math.sin(wr * 0.4 + side) * 1.5;                             // bulging vents
            return Math.max(2, Math.round(d));
        };
        const structure = (side) => {
            const slot = Math.floor(wr / 48);
            if ((slot + side) % 2) return 0;
            const t = (wr - slot * 48 - 16) / 12;
            if (t < 0 || t > 1) return 0;
            let v;
            switch (style) {
                case 'tech': v = 0.07; break;
                case 'organic': v = 0.09 * Math.sin(t * Math.PI); break;
                case 'spike': v = 0.14 * (1 - Math.abs(t - 0.5) * 2); break;
                case 'scrap': v = t < 0.25 || t > 0.75 ? 0.1 : 0.03; break;
                default: v = 0.05 * Math.sin(t * Math.PI);
            }
            return Math.round((W * v) / cell);
        };
        const out = {};
        // Always leave a flyable passage (~35% of the width).
        const maxCells = Math.floor((W * 0.65) / cell);
        // Threshold at every area change: a sill juts in from both sides for
        // a few rows (sloped ends, flat top), marking the new area.
        const zi = this.terrainZoneIndex(wr, prof);
        const local = wr - zi * prof.zoneRows;
        let sill = 0;
        if (zi >= 1 && local < TERRAIN_SILL_ROWS) {
            const edgeRow = local === 0 || local === TERRAIN_SILL_ROWS - 1;
            sill = Math.round((W * TERRAIN_SILL_REACH * (edgeRow ? 0.6 : 1)) / cell);
        }
        const fullOf = [0, 1].map((side) => {
            const mat = this.terrainMaterial(wr, side);
            const base = depth(side, mat);
            return { mat, base, sill, full: base + sill + (zone.structures && !sill ? structure(side) : 0) };
        });
        const over = fullOf[0].full + fullOf[1].full - maxCells;
        if (over > 0) {
            const tot = fullOf[0].full + fullOf[1].full;
            fullOf.forEach((f) => {
                f.full = Math.max(2, f.full - Math.ceil(over * f.full / tot));
                f.base = Math.min(f.base, f.full);
            });
        }
        for (let side = 0; side < 2; side++) {
            const { mat, base, full } = fullOf[side];
            const dmg = this.terrainDamage ? (this.terrainDamage.get(side + ':' + wr) || 0) : 0;
            const eroded = Math.floor(dmg / mat.hp);
            // The outermost cell is bedrock: walls never vanish entirely.
            const width = Math.max(1, full - eroded);
            const k = side ? 'right' : 'left';
            out[k] = width;
            out[k + 'Base'] = Math.min(base, width);
            out[k + 'Mat'] = mat;
            out[k + 'Cracked'] = (dmg % mat.hp) > 0; // edge cell already hit
            // Sill cells (between the base wall and the edge) get their own look.
            out[k + 'Sill'] = fullOf[side].sill > 0 ? Math.max(0, width - out[k + 'Base']) : 0;
        }
        return out;
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
            missile_shot: { power: 5, radius: 3 },
            nova_shot: { power: 4, radius: 3 },
            plasma_beam: { power: 3, radius: 2 },
            plasma: { power: 3, radius: 2 },
            ion_beam: { power: 2, radius: 1, vsMetal: 3 },
            pierce_beam: { power: 2, radius: 0, pierce: true },
            laser_beam: { power: 2, radius: 1 },
            laser: { power: 2, radius: 1 },
            wave_beam: { power: 2, radius: 1 },
            spread_beam: { power: 1, radius: 0 },
            spread: { power: 1, radius: 0 },
            rapid_beam: { power: 1, radius: 0 },
            rapid: { power: 1, radius: 0 },
            burst_shot: { power: 1, radius: 1 }
        }[type] || { power: 2, radius: 1 };
        const dmg = Number(bullet && bullet.damage);
        const scale = Number.isFinite(dmg) && dmg > 0 ? Math.max(0.6, Math.min(3, dmg / 10)) : 1;
        return {
            power: Math.max(1, Math.round(base.power * scale)),
            radius: base.radius,
            pierce: !!base.pierce,
            vsMetal: base.vsMetal || 1
        };
    },

    /**
     * A shot hit the wall on `side` at screen y: carve into it. Returns the
     * number of cells that broke off (0 = only chipped).
     */
    damageTerrain(y, side, profile) {
        if (!this.terrainDamage) this.terrainDamage = new Map();
        const pr = profile || { power: 1, radius: 0, vsMetal: 1 };
        const wr = this.terrainRowAtY(y);
        let broken = 0;
        for (let d = -pr.radius; d <= pr.radius; d++) {
            const row = wr + d;
            const mat = this.terrainMaterial(row, side);
            // Full power at the hit row, falling off towards the crater rim,
            // with a little randomness so the edge looks torn.
            const fall = 1 - Math.abs(d) / (pr.radius + 1);
            let pts = pr.power * fall * (mat.id === 'metal' ? pr.vsMetal : 1);
            pts = Math.floor(pts + Math.random() * 0.8);
            if (pts <= 0) continue;
            const k = side + ':' + row;
            const before = this.terrainDamage.get(k) || 0;
            this.terrainDamage.set(k, before + pts);
            broken += Math.floor((before + pts) / mat.hp) - Math.floor(before / mat.hp);
        }
        if (this.terrainDamage.size > 4000) {
            // Forget rows that scrolled far past the bottom.
            const cutoff = wr - 400;
            this.terrainDamage.forEach((_, k) => { if (+k.split(':')[1] < cutoff) this.terrainDamage.delete(k); });
        }
        return broken;
    },

    /** Wall extents in px at screen y: { left, right } = inner edges. */
    terrainWallsAtY(y, W) {
        if (!this.hasTerrain()) return null;
        const cell = this.terrainCell();
        const c = this.terrainWallCells(this.terrainRowAtY(y), W);
        return { left: c.left * cell, right: W - c.right * cell };
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
