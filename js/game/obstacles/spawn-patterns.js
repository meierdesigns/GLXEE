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
// Carve in square voxel slabs (not 1-row needles). Height in terrain cells.
const TERRAIN_CARVE_BLOCK = 3;
const TERRAIN_MATERIALS = {
    rock: { id: 'rock', hp: 2, score: 2 },
    metal: { id: 'metal', hp: 4, score: 6 },
    crystal: { id: 'crystal', hp: 1, score: 4 },
    magma: { id: 'magma', hp: 2, score: 3 }
};
const TERRAIN_SILL_ROWS = 5;
const TERRAIN_JITTER_ROWS = 4; // wall-depth jitter holds this many rows (no 1-row slivers)
const TERRAIN_OPENING_PX = 34; // height of a hangar opening side craft launch from     // rows of the threshold at an area change
// Visual marker only — keep the upper flight band open (was 0.13 and stacked
// with the gate, which sealed the passage).
const TERRAIN_SILL_REACH = 0.05; // how far it juts in from each side (x W)
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
                verticalSpeed: speeds.verticalSpeed * (pt.speedMul || 1),
                wallDepth: (!def || def.kind === 'fog')
                    ? 'over'
                    : (this.pickWallDepth ? this.pickWallDepth(x, w, gameState) : undefined)
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
        let frameScale = Math.min(3, Math.max(0, Number(deltaTime) || 16.67) / 16.67);
        // Transit stages: the level eases to a stop as the sluice / warp ring slides in, and stays stopped.
        const om = typeof objectiveManager !== 'undefined' ? objectiveManager : null;
        if (om && om.goal) {
            const g = om.goal;
            frameScale *= Math.max(0, Math.min(1, (g.restY - g.y) / (g.restY + 30)));
            if (frameScale <= 0) return;
        }
        // Transit runs: holding DOWN at the bottom edge scrolls the corridor back at a third of the speed.
        // No new layers spawn while backing off.
        if (this.levelScrollMul() < 0) {
            this.terrainOffset = Math.max(0, (this.terrainOffset || 0) - this.scrollSpeed() * frameScale / 3);
            return;
        }
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
        // End of the level: the field only drains, no new layers.
        if (typeof objectiveManager !== 'undefined' && objectiveManager.isLevelEnding()) return;
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
        // Most rows fly straight across; spread their entry height over the
        // whole field instead of a thin top band so obstacles show up
        // through the middle of the playfield too.
        // Obstacles belong in the vertical middle (enemies hold the top and take cover behind them);
        // only the odd stray row crosses the rest of the field.
        const lane = this.midLane(H);
        const baseY = Math.random() < 0.1
            ? H * (0.05 + Math.random() * 0.85)
            : lane.top + Math.random() * (lane.bottom - lane.top);

        // Walk along the train: group, hole, group, hole ...
        const trainLen = W * (1.0 + Math.random() * 0.4);
        const minHole = Math.max(56, 80 - intensity * 20);
        let cursor = Math.random() * 20;
        let spawned = 0;
        while (cursor < trainLen && alive + spawned < OBSTACLE_MAX_ALIVE) {
            const groupSize = 1 + Math.floor(Math.random() * (1.6 + intensity * 1.2));
            // A minority of groups also drift down/up slightly while flying across.
            const vSpeed = Math.random() < 0.25
                ? this.scrollSpeed() * (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1)
                : 0;
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
                // Depth vs canyon walls: near lips prefer tucked under.
                if (!obs.isFog && this.pickWallDepth) {
                    const midX = dir > 0 ? along : (W - along);
                    obs.wallDepth = this.pickWallDepth(midX, obs.width, gameState);
                }
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
        const floorIds = ['craters', 'plates', 'dunes', 'cracks', 'grid', 'ridges', 'hex', 'rubble', 'veins',
            'biomass', 'tendrils', 'spines', 'conduits', 'plating', 'scrapyard'];
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
            // Kept modest so the flyable corridor stays wide without stretching art.
            width: (0.45 + this.terrainHash(pseed % 100003, 2) * 0.35) * (env.width || 1) * (1 + 0.12 * danger),
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
});
