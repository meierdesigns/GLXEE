"use strict";

/**
 * Level objective progress — hunt / killCount / surviveCount / surviveTime.
 */
class ObjectiveManager {
    constructor() {
        this.objective = null;
        this.enemies = [];
        this.elapsedMs = 0;
        this.kills = 0;
        this.spawnsSeen = 0;
        this.completed = false;
        this.won = false;
        this.awaitingFieldClear = false;
        this.label = '';
        this.goal = null;
        this.enter = null;
    }

    reset() {
        this.objective = null;
        this.enemies = [];
        this.elapsedMs = 0;
        this.kills = 0;
        this.spawnsSeen = 0;
        this.completed = false;
        this.won = false;
        this.awaitingFieldClear = false;
        this.label = '';
        this.goal = null;
        this.enter = null;
        this.arrival = null;
        this.exitGate = false;
    }

    /** End of the level reached (goal in view, objective met or won): nothing new may spawn. */
    isLevelEnding() {
        return !!(this.goal || this.completed || this.won || this.awaitingFieldClear);
    }

    needsFieldClear() {
        if (this.exitGate) return false;
        const t = this.objective && this.objective.type;
        return t === 'hunt' || t === 'killCount';
    }

    isFieldClear() {
        if (typeof enemyManager !== 'undefined' && enemyManager.isFieldClear) {
            return enemyManager.isFieldClear();
        }
        return true;
    }

    start(objective, enemies) {
        const prevArrival = this.arrival;
        this.reset();
        this.arrival = this.buildArrival(prevArrival);
        this.enemies = Array.isArray(enemies) ? enemies.slice() : [];
        this.objective = objective && typeof objective === 'object'
            ? Object.assign({}, objective)
            : this.fallbackObjective(this.enemies);
        this.label = this.buildLabel();
    }

    /**
     * Stage start: the ship flies out of a hatch at the bottom edge. Kept if start() runs again mid-arrival.
     */
    buildArrival(prev) {
        const host = typeof game !== 'undefined' ? game : (typeof gameCore !== 'undefined' ? gameCore : null);
        const lm = host && (host.coreLevelManager || host.levelManager);
        const level = lm && lm.getCurrentLevel ? lm.getCurrentLevel() : null;
        if (!level || !level.planetId) return null;
        const id = level.id || (level.planetId + '-' + level.stageIndex);
        if (prev && prev.levelId === id && !prev.done && prev.t < prev.dur) return prev;
        // Arriving on a planet (stage 1, or any stage entered from elsewhere) launches from the home station;
        // later stages on the same planet start in a sluice. Boss stages only get the station launch.
        const arriving = (!level.isBoss && (Number(level.stageIndex) || 1) === 1)
            || this.arrivalPlanetId !== level.planetId
            || !!(prev && prev.levelId === id && prev.kind === 'station');
        this.arrivalPlanetId = level.planetId;
        if (level.isBoss && !arriving) return null;
        const kind = arriving ? 'station' : 'sluice';
        const W = (host && (host.internalWidth || host.baseWidth)) || 240;
        const restY = 46, h = 22, depth = 22;
        return {
            levelId: id, kind: kind, y: -(h + depth), restY: restY, h: h, open: 64, cx: W * 0.5,
            // Phases: the tube rises in from below, the dome splits open, the ship flies out.
            riseMs: 700, openMs: 500, flyMs: 1400, t: 0, dur: 2600, done: false, target: null, quietMs: 2000,
            dome: { hp: 1, max: 1, depth: depth, flashMs: 0, burstMs: 0, split: 0 }
        };
    }

    /**
     * Mission-start intro: the tube rises on FIRE TO START and the dome opens on GO; the intro's own fly-in
     * then carries the ship out of the tube, so the arrival skips its fly phase afterwards.
     */
    updateArrivalIntro(deltaTime, phase) {
        const a = this.arrival;
        if (!a || a.done) return;
        a.intro = true;
        // The tube is already up on FIRE TO START; the dome stays shut through countdown and GO and only
        // opens once the ship actually starts flying out (fly-in).
        // No phase = the intro just completed this frame: keep the dome open, and never rewind it.
        const cap = phase === 'flyIn' || !phase ? a.riseMs + a.openMs : a.riseMs;
        a.t = Math.max(a.t, Math.min(cap, a.t + deltaTime));
        this.applyArrivalHatch(a);
    }

    applyArrivalHatch(a) {
        const out = (v) => 1 - (1 - v) * (1 - v);
        const kRise = Math.min(1, a.t / a.riseMs);
        a.y = -(a.h + a.dome.depth) + (a.restY + a.h + a.dome.depth) * out(kRise);
        a.dome.split = Math.max(0, Math.min(1, (a.t - a.riseMs) / a.openMs));
    }

    /** Arrival: tube rises in, dome opens, ship flies out, then the hatch scrolls away below. */
    updateArrival(deltaTime) {
        const a = this.arrival;
        if (!a) return;
        if (a.done) {
            a.quietMs = Math.max(0, (a.quietMs || 0) - deltaTime);
            return;
        }
        if (a.intro && a.t < a.dur) {
            // Intro already flew the ship out: just let the hatch scroll away.
            a.t = a.dur;
            a.y = a.restY;
            a.dome.split = 1;
        }
        const pm = typeof playerManager !== 'undefined' ? playerManager : null;
        const p = pm && pm.player;
        if (!p) return;
        const H = (typeof game !== 'undefined' && game.internalHeight) || 320;
        if (!a.target) a.target = { x: p.x, y: p.y };
        if (a.t < a.dur) {
            a.t += deltaTime;
            const out = (v) => 1 - (1 - v) * (1 - v);
            this.applyArrivalHatch(a);
            const kFly = Math.max(0, Math.min(1, (a.t - a.riseMs - a.openMs) / a.flyMs));
            const ease = out(kFly);
            const fromY = H + 4;
            p.x = a.cx - p.width / 2 + (a.target.x - (a.cx - p.width / 2)) * ease;
            p.y = fromY + (a.target.y - fromY) * ease;
            return;
        }
        a.y -= 0.04 * deltaTime;
        if (a.y + a.h + a.dome.depth < 0) a.done = true;
    }

    /** Enemies hold fire while the ship comes out of the arrival hatch and until the hatch has scrolled away. */
    isArrivalGrace() {
        return !!(this.arrival && !this.arrival.done);
    }

    /** No spawns until the hatch has scrolled away plus a short quiet spell after it. */
    isArrivalSpawnHold() {
        const a = this.arrival;
        return !!(a && (!a.done || a.quietMs > 0));
    }

    /**
     * Screen area where the ship is visible while the arrival hatch is up: everything above the gate band,
     * plus the tube mouth inside the band. Below that is solid rock, which hides the ship. Null = no hatch.
     */
    getArrivalOcclusion() {
        const a = this.arrival;
        if (!a || a.done) return null;
        const H = (typeof game !== 'undefined' && game.internalHeight) || 320;
        // The hatch is the goal gate mirrored onto the bottom edge (see render()).
        const top = H - (a.y + a.h);
        // The open tube runs down to (and past) the bottom edge, so the ship stays visible all the way up it.
        return { top: top, bottom: H + 64, l: a.cx - a.open / 2, r: a.cx + a.open / 2 };
    }

    /** While the ship leaves the arrival hatch: hidden until the dome is open, then grows in from the tube. */
    getArrivalFx() {
        const a = this.arrival;
        if (!a || a.done || a.t >= a.dur) return null;
        if (a.intro) {
            // Intro: hidden in the tube until the fly-in starts, then the fly-in moves it.
            const ms = typeof missionStartManager !== 'undefined' && missionStartManager.isActive() ? missionStartManager.phase : null;
            return ms && ms !== 'flyIn' ? { k: 0, scale: 0.4, alpha: 0 } : null;
        }
        const k =Math.max(0, Math.min(1, (a.t - a.riseMs - a.openMs) / a.flyMs));
        return { k: k, scale: 0.4 + 0.6 * k, alpha: k <= 0 ? 0 : Math.min(1, 0.2 + k * 1.6) };
    }

    fallbackObjective(enemies) {
        const target = (enemies.find(e => e.champion) || enemies[0] || {});
        return { type: 'hunt', targetEnemyId: target.id || null };
    }

    buildLabel() {
        const o = this.objective;
        if (!o) return 'OBJECTIVE';
        switch (o.type) {
            case 'hunt': {
                const t = this.enemies.find(e => e.id === o.targetEnemyId);
                return t ? `HUNT ${t.type}` : 'HUNT TARGET';
            }
            case 'killCount': {
                const bits = [];
                if (o.enemyType) bits.push(o.enemyType);
                if (o.faction) bits.push(o.faction);
                if (o.enemyClass) bits.push(o.enemyClass);
                if (o.cluster) bits.push('#' + o.cluster);
                return bits.length
                    ? `KILL ${o.count} ${bits.join('/')}`
                    : `KILL ${o.count} ENEMIES`;
            }
            case 'surviveCount':
                return `SURVIVE ${o.count} SPAWNS`;
            case 'surviveTime':
                return `SURVIVE ${o.seconds}s`;
            case 'reachGoal':
                return o.goal === 'warp' ? 'REACH THE WARP RING' : 'REACH THE SLUICE';
            default:
                return 'OBJECTIVE';
        }
    }

    getProgressText() {
        const o = this.objective;
        if (!o) return '';
        if (this.exitGate && !this.completed) return this.isGateSealed() ? 'BREACH THE HATCH' : 'GO!';
        switch (o.type) {
            case 'hunt':
                return this.completed ? 'DONE' : 'ACTIVE';
            case 'killCount':
                return `${this.kills}/${o.count}`;
            case 'surviveCount':
                return `${this.spawnsSeen}/${o.count}`;
            case 'surviveTime': {
                const left = Math.max(0, Math.ceil((o.seconds * 1000 - this.elapsedMs) / 1000));
                return `${left}s`;
            }
            case 'reachGoal': {
                if (this.completed) return 'DONE';
                if (this.isGateSealed()) return 'BREACH THE HATCH';
                if (this.goal) return 'GO!';
                const left = Math.max(0, Math.ceil((o.seconds * 1000 - this.elapsedMs) / 1000));
                return `${left}s`;
            }
            default:
                return '';
        }
    }

    onEnemySpawned(entry) {
        if (this.completed || this.won) return;
        this.spawnsSeen += 1;
        if (this.objective && this.objective.type === 'surviveCount') {
            if (this.spawnsSeen >= this.objective.count) {
                this.complete();
            }
        }
    }

    onEnemyKilled(info) {
        if (this.completed || this.won || this.exitGate) return;
        const type = info && info.type;
        const entryId = info && info.entryId;
        const o = this.objective;
        if (!o) return;

        if (o.type === 'hunt') {
            if (entryId && o.targetEnemyId && entryId === o.targetEnemyId) {
                this.complete();
            }
            return;
        }

        if (o.type === 'killCount') {
            if (o.enemyType && type !== o.enemyType) return;
            if (o.faction && info.faction !== o.faction) return;
            if (o.enemyClass && info.enemyClass !== o.enemyClass) return;
            if (o.cluster && info.cluster !== o.cluster) return;
            this.kills += 1;
            if (this.kills >= o.count) {
                this.complete();
            }
        }
    }

    update(deltaTime) {
        if (this.won || !this.objective) return;

        this.updateArrival(deltaTime);

        if (!this.completed && (this.objective.type === 'reachGoal' || this.exitGate)) {
            this.updateGoal(deltaTime);
        }

        if (!this.completed) {
            // Transit run: backing off at the bottom edge rewinds the way to the gate at a third of the pace.
            const back = this.objective.type === 'reachGoal' && !this.goal && this.isPlayerBacktracking();
            this.elapsedMs = back ? Math.max(0, this.elapsedMs - deltaTime / 3) : this.elapsedMs + deltaTime;
            if (this.objective.type === 'surviveTime') {
                if (this.elapsedMs >= this.objective.seconds * 1000) {
                    this.complete();
                }
            }
        }

        if (this.awaitingFieldClear && !this.won) {
            if (this.isFieldClear()) {
                this.awaitingFieldClear = false;
                this.triggerWin();
            }
        }
    }

    /** Transit stage: the goal scrolls in once the timer ends; fly into the opening. */
    updateGoal(deltaTime) {
        const o = this.objective;
        // The playfield's real width (the canvas is wider than renderManager's 240 default), so the gate sits dead centre.
        const W = (typeof game !== 'undefined' && (game.internalWidth || game.baseWidth))
            || (typeof renderManager !== 'undefined' && renderManager.width) || 240;
        if (!this.goal) {
            if (!this.exitGate && this.elapsedMs < o.seconds * 1000) return;
            const open = o.goal === 'warp' ? 44 : 64;
            this.goal = {
                kind: o.goal === 'warp' ? 'warp' : 'sluice',
                y: -30,
                h: 22,
                open: open,
                cx: W * 0.5,   // always horizontally centred
                restY: 46,
                // Sluice: a Metroid-style hatch dome seals the opening until it is shot open. A hero breaks through, not out.
                dome: o.goal === 'warp' ? null : { hp: 300, max: 300, depth: 22, flashMs: 0, burstMs: 0 }
            };
            return;
        }
        const g = this.goal;
        if (g.y < g.restY) g.y = Math.min(g.restY, g.y + 0.04 * deltaTime);
        if (g.dome) {
            g.dome.flashMs = Math.max(0, g.dome.flashMs - deltaTime);
            // Shot open: the halves fold back like the arrival hatch instead of bursting.
            if (g.dome.hp <= 0) {
                g.dome.burstMs += deltaTime;
                g.dome.split = Math.min(1, g.dome.burstMs / 500);
            }
        }
        const pm = typeof playerManager !== 'undefined' ? playerManager : null;
        const p = pm && pm.player;
        if (!p || g.y < g.restY) return;
        const px = p.x + p.width / 2;
        const py = p.y + p.height / 2;
        // Entering the gate: the ship is flown into the opening and fades into the chamber, then the stage ends.
        if (this.enter) {
            const e = this.enter;
            e.t += deltaTime;
            const k = Math.min(1, e.t / e.dur);
            const ease = 1 - (1 - k) * (1 - k);
            p.x = e.fromX + (g.cx - p.width / 2 - e.fromX) * Math.min(1, ease * 1.6);
            p.y = e.fromY + (g.y - 24 - e.fromY) * ease;
            if (k >= 1) { this.complete(); }
            return;
        }
        const inOpening = Math.abs(px - g.cx) <= g.open / 2;
        // Approaching the sealed hatch below its opening makes it fold open on its own.
        if (this.isGateSealed() && Math.abs(px - g.cx) <= g.open / 2 + 24
            && p.y - (g.y + g.h + g.dome.depth) <= 48) {
            this.openGateDome();
        }
        // Sealed hatch: the dome is as solid as the walls.
        if (this.isGateSealed()) {
            const floor = g.y + g.h + g.dome.depth;
            if (p.y < floor) p.y = floor;
            return;
        }
        if (py <= g.y + g.h && inOpening) {
            this.enter = { t: 0, dur: 1500, fromX: p.x, fromY: p.y };
            // Leftover drops stream after the ship while it flies in, so no loot scoop is needed afterwards.
            if (typeof pickupManager !== 'undefined' && pickupManager.beginLootPhase) pickupManager.beginLootPhase(4000);
            return;
        }
        // The gate walls are solid: ships outside the opening are held below them.
        if (!inOpening && p.y < g.y + g.h) p.y = g.y + g.h;
    }

    /** Player holds DOWN while pinned to the bottom edge (set in player/core.js). */
    isPlayerBacktracking() {
        const p = typeof playerManager !== 'undefined' && playerManager.player;
        return !!(p && p.backtrack);
    }

    /** The sluice hatch dome is still intact. */
    isGateSealed() {
        const d = this.goal && this.goal.dome;
        return !!(d && d.hp > 0);
    }

    /** Lowest y of the gate (incl. a sealed dome); ships stay below it. */
    getGateFloor() {
        const g = this.goal;
        if (!g) return null;
        return g.y + g.h + (this.isGateSealed() ? g.dome.depth : 0);
    }

    /** Fold the sealed hatch dome open (split animation runs in update). */
    openGateDome() {
        const d = this.goal && this.goal.dome;
        if (!d || d.hp <= 0) return;
        d.hp = 0;
        d.burstMs = 0;
        d.split = 0;
    }

    /** A player shot hits the hatch dome; returns true once it bursts. */
    hitGateDome(amount, x, y) {
        const d = this.goal && this.goal.dome;
        if (!d || d.hp <= 0) return false;
        d.hp = Math.max(0, d.hp - Math.max(1, Number(amount) || 10));
        d.flashMs = 90;
        if (d.hp > 0) return false;
        d.burstMs = 0;
        d.split = 0;
        if (typeof soundManager !== 'undefined' && soundManager.playExplosion) soundManager.playExplosion();
        if (typeof game !== 'undefined' && game) game.score += 250;
        return true;
    }

    /** True when (x, y) lies inside the sealed dome's pixel shape. */
    isInGateDome(x, y) {
        if (!this.isGateSealed()) return false;
        const g = this.goal;
        const dy = y - (g.y + g.h);
        if (dy < -g.h || dy > g.dome.depth) return false;
        const half = g.open / 2;
        const k = Math.max(0, dy) / g.dome.depth;
        return Math.abs(x - g.cx) <= half * Math.sqrt(Math.max(0, 1 - k * k)) + 1;
    }

    /** While the ship enters the gate: how far along (0..1), for the renderer to shrink/fade the ship. */
    getEnterFx() {
        const e = this.enter;
        if (!e) return this.getArrivalFx();
        const k = Math.min(1, e.t / e.dur);
        return { k: k, scale: 1 - 0.7 * k, alpha: 1 - k * k };
    }

    render(ctx) {
        if (!ctx) return;
        // Same width as updateGoal(): ctx.canvas.width is not the playfield width, which cut the gate off on the right.
        const W = (typeof game !== 'undefined' && (game.internalWidth || game.baseWidth))
            || (ctx.canvas ? ctx.canvas.width : 240);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 160);
        const a = this.arrival;
        if (a && !a.done) {
            // Arrival hatch: the same gate mirrored onto the bottom edge, its tube leading down off screen.
            const H = (typeof game !== 'undefined' && game.internalHeight) || 320;
            this.renderAtTerrainRes(ctx, W, H, H - (a.y + a.h), (oc) => {
                oc.translate(0, H);
                oc.scale(1, -1);
                this.renderGateFrame(oc, a, W, pulse);
                if (a.dome.split < 1) this.renderGateDome(oc, a);
            });
        }
        const g = this.goal;
        if (!g) return;
        const gH = (typeof game !== 'undefined' && game.internalHeight) || 320;
        this.renderAtTerrainRes(ctx, W, gH, g.y + g.h, (oc) => {
            this.renderGateFrame(oc, g, W, pulse);
            if (g.dome) this.renderGateDome(oc, g);
        });
        ctx.save();
        const l = g.cx - g.open / 2;
        // Entry animation: the opening lights up as the ship flies in, then a flash washes over the field.
        if (this.enter) {
            const k = Math.min(1, this.enter.t / this.enter.dur);
            const glow = g.kind === 'warp' ? '127,232,255' : this.gateTheme().edge;
            ctx.fillStyle = 'rgba(' + glow + ',' + (0.55 * k) + ')';
            ctx.fillRect(l, 0, g.open, g.y + g.h);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * k * k) + ')';
            ctx.fillRect(l + g.open * 0.25, 0, g.open * 0.5, g.y + g.h);
            if (k > 0.8) {
                ctx.fillStyle = 'rgba(255,255,255,' + (((k - 0.8) / 0.2) * 0.7) + ')';
                ctx.fillRect(0, 0, W, ctx.canvas ? Math.max(ctx.canvas.height, 400) : 400);
            }
        }
        ctx.restore();
    }

    /**
     * Draws `draw(oc)` into a low-res buffer with one pixel per terrain art
     * cell and blits it up unsmoothed, so the gate has exactly the canyon's
     * pixel size. The buffer grid is aligned to `anchorY` (the gate edge on
     * screen), so the pixels travel with the gate instead of re-snapping.
     */
    renderAtTerrainRes(ctx, W, H, anchorY, draw) {
        const cell = (typeof obstacleManager !== 'undefined' && obstacleManager.terrainCell)
            ? obstacleManager.terrainCell() : 1;
        const frac = ((anchorY % cell) + cell) % cell;
        const cols = Math.ceil(W / cell);
        const rows = Math.ceil(H / cell) + 1;
        const c = this._gateBuf || (this._gateBuf = document.createElement('canvas'));
        if (c.width !== cols || c.height !== rows) {
            c.width = cols;
            c.height = rows;
        }
        const oc = c.getContext('2d');
        if (!oc) return;
        oc.setTransform(1, 0, 0, 1, 0, 0);
        oc.clearRect(0, 0, cols, rows);
        oc.imageSmoothingEnabled = false;
        oc.setTransform(1 / cell, 0, 0, 1 / cell, 0, (cell - frac) / cell);
        draw(oc);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(c, 0, frac - cell, cols * cell, rows * cell);
        ctx.restore();
    }

    /** Gate walls, faces and the tube behind the opening (y = 0 is the far end of the tube). */
    renderGateFrame(ctx, g, W, pulse) {
        const l = g.cx - g.open / 2;
        const r = g.cx + g.open / 2;
        // The level ends at the gate: everything beyond it is solid rock, so no canyon wall, obstacle or ship
        // shows past it. The opening continues as a tube right through the gate band.
        const rock = this.gateRock();
        const th = this.gateTheme();
        // Rock texture is anchored to the gate, so it scrolls in with it instead of standing still on screen.
        const anchor = g.y + g.h;
        // The home station's launch hatch sits in station hull instead of planet rock.
        const flank = g.kind === 'station'
            ? (x, y, w, h) => this.renderStationHull(ctx, th, x, y, w, h, anchor)
            : (x, y, w, h) => this.renderGateRock(ctx, rock, x, y, w, h, anchor);
        if (g.y > 0) {
            flank(0, 0, l, g.y + g.h);
            flank(r, 0, W - r, g.y + g.h);
        }
        if (g.kind !== 'warp') {
            // The tube's inside only shows once the ship flies in; until then the
            // opening is just a mouth in the band and solid rock sits behind it.
            // The arrival hatch's tube stays open the whole time: it is the ship's way out.
            const tubeTop = this.enter || g === this.arrival ? 0 : Math.max(0, g.y);
            if (tubeTop > 0) this.renderGateRock(ctx, rock, l, 0, g.open, tubeTop, anchor);
            ctx.save();
            ctx.beginPath();
            ctx.rect(l, tubeTop, g.open, g.y + g.h - tubeTop);
            ctx.clip();
            this.renderGateTube(ctx, th, l, g.open, g.y + g.h, pulse);
            ctx.restore();
        } else if (g.y > 0) {
            ctx.fillStyle = '#05060a';
            ctx.fillRect(l, 0, g.open, g.y);
        }
        if (g.kind === 'warp') {
            // Two pylons with a pulsing energy field between them.
            [[0, l], [r, W]].forEach(([x0, x1]) => {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(x0, g.y, x1 - x0, g.h);
                ctx.fillStyle = '#3a4a6a';
                ctx.fillRect(x0, g.y + g.h - 4, x1 - x0, 4);
            });
            ctx.fillStyle = 'rgba(127,232,255,' + (0.2 + pulse * 0.3) + ')';
            ctx.fillRect(l, g.y, g.open, g.h);
            ctx.strokeStyle = '#7fe8ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(l + 1, g.y + 1, g.open - 2, g.h - 2);
        } else {
            if (g.y <= 0) {
                flank(0, g.y, l, g.h);
                flank(r, g.y, W - r, g.h);
            }
            ctx.fillStyle = th.trim;
            ctx.fillRect(0, g.y + g.h - 3, l, 3);
            ctx.fillRect(r, g.y + g.h - 3, W - r, 3);
            this.renderGateFace(ctx, th, 0, l, g, 0);
            this.renderGateFace(ctx, th, r, W - r, g, 1);
            ctx.fillStyle = 'rgba(' + th.edge + ',' + (0.35 + pulse * 0.45) + ')';
            ctx.fillRect(l - 2, g.y, 3, g.h);
            ctx.fillRect(r - 1, g.y, 3, g.h);
        }
    }

    /**
     * Static pixel tube from the far end (y = 0) to `bottom`, built in the home faction's style:
     * terran steel plates, machine hazard bulkhead, pirate scrap patches, kronax bone ribs, voidborn flesh.
     * Lamps sit fixed along both flanks and only breathe softly; nothing scrolls.
     */
    renderGateTube(ctx, th, x, w, bottom, pulse) {
        if (bottom <= 0) return;
        const px = 2;
        const face = th.face || 'plates';
        const mark = th.mark instanceof Array ? th.mark : [th.mark];
        const hash = (a, b) => {
            const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
            return s - Math.floor(s);
        };
        ctx.fillStyle = th.wall;
        ctx.fillRect(x, 0, w, bottom);

        // Wall surface per faction.
        if (face === 'plates') {
            // Steel plates: lighter panels with dark seams and rivets on every corner.
            for (let y = 0; y < bottom; y += 12) {
                ctx.fillStyle = mark[0];
                ctx.fillRect(x + px * 3, y + px, w - px * 6, 12 - px * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + px * 3, y + px, w - px * 6, px);
                ctx.fillStyle = th.trim;
                [x + px * 4, x + w - px * 5].forEach((rx) => {
                    ctx.fillRect(rx, y + px * 2, px, px);
                    ctx.fillRect(rx, y + 12 - px * 3, px, px);
                });
            }
        } else if (face === 'hazard') {
            // Blast bulkhead: dark core, hazard stripes down both flanks, heavy cross beams.
            for (let y = 0; y < bottom; y += px) {
                const on = (Math.floor(y / 4) & 1) === 0;
                ctx.fillStyle = on ? mark[0] : '#1a1c22';
                ctx.fillRect(x + px, y, px * 3, px);
                ctx.fillRect(x + w - px * 4, y, px * 3, px);
            }
            ctx.fillStyle = '#2a2e36';
            for (let y = 6; y < bottom; y += 16) ctx.fillRect(x + px * 4, y, w - px * 8, px * 2);
        } else if (face === 'patch') {
            // Welded scrap: mismatched patches with rough weld seams.
            for (let y = 0; y < bottom; y += 8) {
                for (let cx = x + px * 2; cx < x + w - px * 2; cx += 10) {
                    const h = hash(cx, y);
                    ctx.fillStyle = mark[Math.floor(h * mark.length) % mark.length];
                    ctx.fillRect(cx, y + px, Math.min(10 - px, x + w - px * 2 - cx), 8 - px);
                    if (h > 0.7) {
                        ctx.fillStyle = th.trim;
                        ctx.fillRect(cx + px, y + px * 2, px, px);
                    }
                }
            }
        } else if (face === 'fangs') {
            // Bone gullet: curved rib bones with dark gaps, tips pointing to the centre.
            for (let y = 2; y < bottom; y += 9) {
                ctx.fillStyle = mark[0];
                ctx.fillRect(x + px, y, w - px * 2, px);
                ctx.fillRect(x + px, y + px, px * 3, px);
                ctx.fillRect(x + w - px * 4, y + px, px * 3, px);
                ctx.fillStyle = th.trim;
                ctx.fillRect(x + px * 4, y + px, w - px * 8, px);
            }
        } else if (face === 'flesh') {
            // Living tube: swollen folds with dark creases.
            for (let y = 0; y < bottom; y += 7) {
                ctx.fillStyle = mark[0];
                ctx.fillRect(x + px, y, w - px * 2, 4);
                ctx.fillStyle = th.trim;
                ctx.fillRect(x + px * 2, y + 4, w - px * 4, px);
            }
        }

        // Cylinder shading: dark flanks, a metal sheen strip left of the centre.
        [[0, 0.6], [px, 0.4], [px * 2, 0.22]].forEach(([o, alpha]) => {
            ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
            ctx.fillRect(x + o, 0, px, bottom);
            ctx.fillRect(x + w - o - px, 0, px, bottom);
        });
        if (face !== 'flesh') {
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.fillRect(Math.round(x + w * 0.32), 0, px * 2, bottom);
        }

        // Fixed lamps along both flanks, glowing in the faction colour.
        const glow = 0.75 + pulse * 0.25;
        const lampStep = face === 'flesh' ? 10 : 12;
        for (let y = 6; y < bottom - px; y += lampStep) {
            const j = face === 'flesh' ? Math.round(hash(y, 3) * 4) : 0;
            [x + px * 3 + j, x + w - px * 4 - j].forEach((lx) => {
                ctx.fillStyle = 'rgba(' + th.edge + ',' + (0.25 * glow) + ')';
                ctx.fillRect(lx - px, y - px, px * 3, px * 3);
                ctx.globalAlpha = glow;
                ctx.fillStyle = th.dot;
                ctx.fillRect(lx, y, px, px);
                ctx.globalAlpha = 1;
            });
        }
        // Fade into darkness at the far end.
        const fade = ctx.createLinearGradient(0, 0, 0, Math.min(bottom, 40));
        fade.addColorStop(0, 'rgba(5,6,10,0.9)');
        fade.addColorStop(1, 'rgba(5,6,10,0)');
        ctx.fillStyle = fade;
        ctx.fillRect(x, 0, w, Math.min(bottom, 40));
    }

    /** Pixel hatch dome hanging from the opening; cracks with damage, bursts into shards. */
    renderGateDome(ctx, g) {
        const d = g.dome;
        const th = this.gateTheme();
        const top = g.y + g.h;
        const half = g.open / 2;
        const px = 2;
        // Shot open: fully folded away once the split animation is done.
        if (d.hp <= 0 && (d.split || 0) >= 1) return;
        const ratio = d.hp / d.max;
        const shell = d.flashMs > 0 ? '#ffffff' : th.shell[d.hp <= 0 || ratio > 0.66 ? 0 : (ratio > 0.33 ? 1 : 2)];
        const rim = d.flashMs > 0 ? '#ffffff' : th.rim;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
        const split = d.split || 0;
        if (split > 0) {
            // Opening: the two halves fold back towards their outer flanks, so the silhouette never gets clipped.
            const keep = 1 - split * (2 - split);
            [-1, 1].forEach((dir) => {
                for (let y = 0; y < d.depth; y += px) {
                    const k = (y + px) / d.depth;
                    const full = Math.max(px, Math.round(half * Math.sqrt(Math.max(0, 1 - k * k)) / px) * px);
                    const w = Math.round(full * keep / px) * px;
                    if (w < px) continue;
                    const x0 = Math.round(dir < 0 ? g.cx - full : g.cx + full - w);
                    ctx.fillStyle = shell;
                    ctx.fillRect(x0, top + y, w, px);
                    ctx.fillStyle = rim;
                    ctx.fillRect(x0, top + y, px, px);
                    ctx.fillRect(x0 + w - px, top + y, px, px);
                }
            });
            return;
        }
        for (let y = 0; y < d.depth; y += px) {
            const k = (y + px) / d.depth;
            const w = Math.max(px, Math.round(half * Math.sqrt(Math.max(0, 1 - k * k)) / px) * px);
            const x0 = Math.round(g.cx - w);
            ctx.fillStyle = shell;
            ctx.fillRect(x0, top + y, w * 2, px);
            // Rim pixels on both flanks + a pulsing core band.
            ctx.fillStyle = rim;
            ctx.fillRect(x0, top + y, px, px);
            ctx.fillRect(x0 + w * 2 - px, top + y, px, px);
            if (y > d.depth * 0.25 && y < d.depth * 0.6) {
                ctx.fillStyle = 'rgba(' + th.core + ',' + (0.25 + pulse * 0.35) + ')';
                ctx.fillRect(x0 + px, top + y, w * 2 - px * 2, px);
            }
        }
        // Cracks grow as the hatch loses hp.
        const cracks = Math.floor((1 - ratio) * 6);
        ctx.fillStyle = th.crack;
        for (let i = 0; i < cracks; i++) {
            const cx = Math.round(g.cx + (i % 2 ? 1 : -1) * (4 + i * 4));
            for (let s = 0; s < 4; s++) ctx.fillRect(cx + (s % 2) * px, top + 4 + s * 3, px, 3);
        }
    }

    /**
     * Sluice look of the planet's HOME faction (the one that built it) — not
     * the faction attacking the planet, which only drives enemies/obstacles.
     */
    gateTheme() {
        const env = typeof obstacleManager !== 'undefined' && obstacleManager.getEnvironment
            ? obstacleManager.getEnvironment() : null;
        const home = String((env && (env.homeFaction || env.faction)) || 'terran').toLowerCase();
        const themes = this.gateThemes();
        return themes[home] || themes.terran;
    }

    gateThemes() {
        return this._gateThemes || (this._gateThemes = {
            // Navy bulkhead: steel plates, rivets, blue running lights.
            terran: { face: 'plates', wall: '#10141c', mark: '#3a4a64', dot: '#9fd0ff', trim: '#8c96a8', edge: '127,200,255',
                shell: ['#5a7898', '#3e5a7a', '#24384e'], rim: '#bfe0ff', core: '200,235,255', crack: '#0a1420', shard: '160,210,255' },
            // Industrial: hazard stripes, amber blast door.
            machine: { face: 'hazard', wall: '#05060a', mark: '#e8b020', dot: '#e8b020', trim: '#8c96a8', edge: '120,255,160',
                shell: ['#e06a20', '#c84a18', '#8a2a10'], rim: '#ffb04a', core: '255,220,120', crack: '#2a0a04', shard: '255,170,60' },
            // Welded scrap: mismatched rusty patches, a riveted junk plug.
            pirate: { face: 'patch', wall: '#140e0a', mark: ['#5a3a22', '#3a2a1c', '#6a5a48', '#8a4a20'], dot: '#ff9a3c', trim: '#6a5a48', edge: '255,150,60',
                shell: ['#7a6a50', '#5e4e38', '#3e3020'], rim: '#d8a050', core: '255,180,90', crack: '#1a0e06', shard: '220,170,100' },
            // Bone maw: fangs hang over the opening, a chitin membrane seals it.
            kronax: { face: 'fangs', wall: '#0b0507', mark: '#d8ccb0', dot: '#ff5a46', trim: '#5a1a1c', edge: '255,70,60',
                shell: ['#8a1e22', '#6a1418', '#440c10'], rim: '#e0d0b0', core: '255,120,90', crack: '#1a0204', shard: '230,90,70' },
            // Living sphincter: swollen flesh with glowing pores.
            voidborn: { face: 'flesh', wall: '#0c0612', mark: '#4a1e5e', dot: '#c88aff', trim: '#2a1238', edge: '200,120,255',
                shell: ['#6a2a8a', '#4e1c6a', '#30104a'], rim: '#d8a0ff', core: '230,170,255', crack: '#12041a', shard: '200,140,255' }
        });
    }

    /** Planet wall colours (light → dark), shared with the canyon walls' terrain palette. */
    gateRock() {
        const rm = typeof renderManager !== 'undefined' ? renderManager : null;
        const pal = rm && rm._terrainPal;
        if (pal && pal.wall && pal.wall.length >= 4) return pal.wall;
        const env = typeof obstacleManager !== 'undefined' && obstacleManager.getEnvironment
            ? obstacleManager.getEnvironment() : null;
        const base = (env && env.base) || '#7a7f88';
        if (rm && rm.shadeColor) return [0.2, -0.2, -0.45, -0.7].map((a) => rm.shadeColor(base, a));
        return ['#7a7f88', '#4a4e56', '#2a2c32', '#141518'];
    }

    /**
     * Rock wall block in 4px pixel cells: noisy body, lit top edge, dark seam at the bottom.
     * `anchorY` pins the cell grid and noise to the gate (not the screen), so the texture moves with it.
     */
    renderGateRock(ctx, rock, x, y, w, h, anchorY) {
        if (w <= 0 || h <= 0) return;
        // Same pixel size as the canyon walls (one terrain art cell).
        const c = (typeof obstacleManager !== 'undefined' && obstacleManager.terrainCell) ? obstacleManager.terrainCell() : 4;
        const ay = Number.isFinite(anchorY) ? anchorY : 0;
        const th = this.gateTheme();
        const mark = th.mark instanceof Array ? th.mark : [th.mark];
        const rm = typeof renderManager !== 'undefined' ? renderManager : null;
        const shade = (col, t) => (rm && rm.shadeColor ? rm.shadeColor(col, t) : col);
        const mix = (a, b, t) => (rm && rm.mixColor ? rm.mixColor(a, b, t) : a);
        // Faction body tones: the home faction's colour worked into the planet rock.
        const body = [1, 2, 3].map((i) => mix(rock[i], mark[0], 0.45));
        const hash = (i, j, k) => {
            const s = Math.sin(i * 12.9898 + j * 78.233 + (k || 0) * 37.719) * 43758.5453;
            return s - Math.floor(s);
        };
        ctx.fillStyle = body[1];
        ctx.fillRect(x, y, w, h);
        for (let cy = ay + Math.floor((y - ay) / c) * c; cy < y + h; cy += c) {
            const j = Math.round((cy - ay) / c);
            for (let cx = Math.floor(x / c) * c; cx < x + w; cx += c) {
                const i = Math.round(cx / c);
                const n = hash(i, j);
                let col = null;
                switch (th.face) {
                    case 'plates': { // terran: riveted steel panels with seams
                        const pi = ((i % 8) + 8) % 8, pj = ((j % 6) + 6) % 6;
                        if (pi === 0 || pj === 0) col = shade(th.wall, 0.2);
                        else if ((pi === 1 || pi === 7) && (pj === 1 || pj === 5)) col = th.trim;
                        else if (pj === 1) col = shade(mark[0], 0.25);
                        else col = n > 0.8 ? body[0] : mark[0];
                        break;
                    }
                    case 'hazard': { // machine: dark armour blocks, vents, amber warning tags
                        const pi = ((i % 6) + 6) % 6, pj = ((j % 6) + 6) % 6;
                        const blk = hash(Math.floor(i / 6), Math.floor(j / 6), 3);
                        if (pi === 0 || pj === 0) col = '#05060a';
                        else if (blk > 0.75 && pj >= 2 && pj <= 4 && ((pi + pj) & 1)) col = mark[0];
                        else if (blk < 0.3 && pj % 2 === 0) col = '#1a1c22';
                        else col = n > 0.85 ? '#3a3e48' : '#2a2e36';
                        break;
                    }
                    case 'patch': { // pirate: mismatched welded scrap patches
                        const bi = Math.floor((i + (Math.floor(j / 4) & 1) * 2) / 5), bj = Math.floor(j / 4);
                        const pick = hash(bi, bj, 5);
                        const edge = ((i + (Math.floor(j / 4) & 1) * 2) % 5 + 5) % 5 === 0 || ((j % 4) + 4) % 4 === 0;
                        if (edge) col = n < 0.25 ? th.dot : th.wall;
                        else col = mark[Math.floor(pick * mark.length) % mark.length];
                        if (!edge && n > 0.93) col = th.trim;
                        break;
                    }
                    case 'fangs': { // kronax: bone ribs over dark sinew
                        const rj = ((j % 5) + 5) % 5;
                        if (rj === 0) col = mark[0];
                        else if (rj === 1) col = shade(mark[0], -0.35);
                        else col = n > 0.85 ? th.dot : (n > 0.4 ? th.trim : th.wall);
                        break;
                    }
                    case 'flesh': { // voidborn: swollen folds with glowing pores
                        const fold = Math.sin(i * 0.9 + j * 0.35 + Math.sin(j * 0.5) * 1.5);
                        if (fold > 0.55) col = mark[0];
                        else if (fold < -0.6) col = th.trim;
                        else col = shade(mark[0], -0.35);
                        if (n > 0.97) col = th.dot;
                        break;
                    }
                    default:
                        col = n > 0.7 ? body[0] : (n < 0.18 ? body[2] : null);
                }
                if (!col) continue;
                ctx.fillStyle = col;
                const x0 = Math.max(x, cx), y0 = Math.max(y, cy);
                ctx.fillRect(x0, y0, Math.min(cx + c, x + w) - x0, Math.min(cy + c, y + h) - y0);
            }
        }
    }

    /**
     * Home station hull around the launch hatch: plated decks with lit window rows and
     * blinking beacons along the deck edge (`anchorY`), in the home faction's colours.
     */
    renderStationHull(ctx, th, x, y, w, h, anchorY) {
        if (w <= 0 || h <= 0) return;
        const px = 2;
        const mark = th.mark instanceof Array ? th.mark : [th.mark];
        const hash = (a, b) => {
            const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
            return s - Math.floor(s);
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillStyle = th.wall;
        ctx.fillRect(x, y, w, h);
        // Hull plates, rows offset like brickwork, counted from the deck edge down.
        for (let row = 0, py = anchorY - 4; py > y - 12; row++, py -= 12) {
            const off = (row & 1) * 10;
            for (let sx = -off; sx < x + w; sx += 20) {
                if (sx + 20 < x) continue;
                ctx.fillStyle = mark[(row + Math.floor(sx / 20)) % mark.length];
                ctx.fillRect(sx + px, py - 12 + px, 20 - px * 2, 12 - px * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(sx + px, py - 12 + px, 20 - px * 2, px);
            }
        }
        // Window rows: mostly lit, a few dark cabins.
        for (let row = 0, wy = anchorY - 18; wy > y; row++, wy -= 14) {
            for (let wx = Math.floor(x / 8) * 8 + 2; wx < x + w - 4; wx += 8) {
                if (wx < x) continue;
                const n = hash(wx, row);
                ctx.fillStyle = '#05060a';
                ctx.fillRect(wx - px / 2, wy - px / 2, 4 + px, px * 2 + px);
                if (n < 0.2) continue;
                ctx.fillStyle = n > 0.75 ? '#ffd890' : th.dot;
                ctx.fillRect(wx, wy, 4, px);
            }
        }
        // Deck edge: trim band with a dark lip and blinking landing beacons.
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x, anchorY - 7, w, px);
        ctx.fillStyle = th.trim;
        ctx.fillRect(x, anchorY - 5, w, 5);
        const blink = Math.floor(Date.now() / 400);
        for (let bx = Math.floor(x / 24) * 24 + 10; bx < x + w; bx += 24) {
            if (bx < x) continue;
            const on = ((bx / 24 + blink) & 1) === 0;
            ctx.fillStyle = on ? 'rgba(' + th.edge + ',0.35)' : 'rgba(0,0,0,0)';
            ctx.fillRect(bx - px, anchorY - 5, px * 3, 5);
            ctx.fillStyle = on ? th.dot : '#05060a';
            ctx.fillRect(bx, anchorY - 4, px, px);
        }
        ctx.restore();
    }

    /** Pixel face of one gate wall (x..x+w) in the home faction's style; side 1 = right wall. */
    renderGateFace(ctx, th, x, w, g, side) {
        if (w <= 0) return;
        const px = 2;
        const y0 = g.y;
        const h = g.h - 3;
        const hash = (i) => { const s = Math.sin(i * 12.9898 + side * 78.233) * 43758.5453; return s - Math.floor(s); };
        // Inner end of the wall (next to the opening).
        const inner = side ? x : x + w;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y0, w, g.h);
        ctx.clip();
        switch (th.face) {
            case 'hazard':
                ctx.fillStyle = th.mark;
                for (let sx = x - g.h; sx < x + w; sx += 12) {
                    ctx.beginPath();
                    ctx.moveTo(sx, y0 + g.h);
                    ctx.lineTo(sx + 6, y0 + g.h);
                    ctx.lineTo(sx + 6 + g.h, y0);
                    ctx.lineTo(sx + g.h, y0);
                    ctx.fill();
                }
                break;
            case 'plates':
                for (let sx = x, i = 0; sx < x + w; sx += 16, i++) {
                    ctx.fillStyle = th.mark;
                    ctx.fillRect(sx, y0 + 2, 14, h - 4);
                    ctx.fillStyle = th.wall;
                    ctx.fillRect(sx + 2, y0 + 4, 10, h - 8);
                    ctx.fillStyle = th.trim;
                    ctx.fillRect(sx, y0 + 2, px, px);
                    ctx.fillRect(sx + 12, y0 + h - 4, px, px);
                }
                // Running lights stepping towards the opening.
                ctx.fillStyle = th.dot;
                for (let i = 0; i < 4; i++) ctx.fillRect(side ? inner + 4 + i * 8 : inner - 6 - i * 8, y0 + Math.floor(h / 2), px, px);
                break;
            case 'patch':
                for (let i = 0; i < Math.ceil(w / 6); i++) {
                    const pw = 6 + Math.floor(hash(i) * 4) * px;
                    const ph = 6 + Math.floor(hash(i + 50) * 4) * px;
                    const sx = x + Math.floor(hash(i + 100) * w / px) * px - 4;
                    const sy = y0 + Math.floor(hash(i + 150) * Math.max(1, h - ph) / px) * px;
                    ctx.fillStyle = th.mark[i % th.mark.length];
                    ctx.fillRect(sx, sy, pw, ph);
                    ctx.fillStyle = '#c8b090';
                    ctx.fillRect(sx + px, sy + px, px, px);
                    ctx.fillRect(sx + pw - px * 2, sy + ph - px * 2, px, px);
                }
                ctx.fillStyle = th.dot;
                ctx.fillRect(side ? inner + 6 : inner - 8, y0 + 4, px, px);
                break;
            case 'fangs':
                // Bone ridge with teeth growing down; the longest fangs flank the opening.
                ctx.fillStyle = '#2a0e10';
                ctx.fillRect(x, y0, w, 6);
                for (let i = 0, sx = side ? x : x + w - 8; side ? sx < x + w : sx > x - 8; i++, sx += side ? 8 : -8) {
                    const len = Math.max(4, 16 - i * 2 - Math.floor(hash(i) * 3) * px);
                    ctx.fillStyle = th.mark;
                    for (let k = 0; k < len; k += px) {
                        const tw = Math.max(px, Math.round((6 * (1 - k / len)) / px) * px);
                        ctx.fillRect(sx + 4 - Math.floor(tw / 2 / px) * px, y0 + 4 + k, tw, px);
                    }
                }
                ctx.fillStyle = th.dot;
                ctx.fillRect(side ? inner + 2 : inner - 4, y0 + 2, px, px);
                break;
            case 'flesh':
                // Swollen tissue folds bulging towards the opening, pores glowing.
                for (let i = 0; i < Math.ceil(w / 4); i++) {
                    const sx = x + Math.floor(hash(i) * w / px) * px;
                    const sy = y0 + Math.floor(hash(i + 30) * h / px) * px;
                    const rr = 2 + Math.floor(hash(i + 60) * 3) * px;
                    ctx.fillStyle = th.mark;
                    ctx.fillRect(sx - rr, sy - rr / 2, rr * 2, rr);
                    ctx.fillRect(sx - rr / 2, sy - rr, rr, rr * 2);
                }
                ctx.fillStyle = th.mark;
                ctx.fillRect(side ? inner : inner - 6, y0, 6, h);
                ctx.fillStyle = th.dot;
                for (let i = 0; i < 6; i++) {
                    ctx.fillRect(x + Math.floor(hash(i + 90) * w / px) * px, y0 + Math.floor(hash(i + 120) * h / px) * px, px, px);
                }
                break;
        }
        ctx.restore();
    }

    complete() {
        if (this.completed) return;
        // Main enemy down: the stage goes on until the sluice scrolls in and the ship flies through it.
        if (!this.exitGate && this.needsFieldClear() && this.usesExitGate()) {
            this.exitGate = true;
            return;
        }
        this.completed = true;
        if (this.needsFieldClear()) {
            this.awaitingFieldClear = true;
            if (this.isFieldClear()) {
                this.awaitingFieldClear = false;
                this.triggerWin();
            }
            return;
        }
        this.triggerWin();
    }

    /** Planet stages (not boss levels) end at a sluice instead of on the kill itself. */
    usesExitGate() {
        const host = typeof game !== 'undefined' ? game : (typeof gameCore !== 'undefined' ? gameCore : null);
        const lm = host && (host.coreLevelManager || host.levelManager);
        const level = lm && lm.getCurrentLevel ? lm.getCurrentLevel() : null;
        return !!(level && level.planetId && !level.isBoss);
    }

    triggerWin() {
        if (this.won) return;
        this.won = true;
        // Delay slightly so explosion / spawn FX can play when hunt/kill completes
        const fire = () => {
            if (this.needsFieldClear() && !this.isFieldClear()) {
                this.won = false;
                this.awaitingFieldClear = true;
                return;
            }
            if (typeof game !== 'undefined' && game.playerWins) {
                game.playerWins();
            } else if (typeof gameCore !== 'undefined' && gameCore.playerWins) {
                gameCore.playerWins();
            }
        };
        // Sluice exit: the fly-in already was the pause, so the win follows right away.
        if (this.enter) {
            fire();
        } else if (typeof setTimeout === 'function') {
            setTimeout(fire, 900);
        } else {
            fire();
        }
    }

    getObjective() {
        return this.objective;
    }

    isComplete() {
        return this.completed;
    }
}

const objectiveManager = new ObjectiveManager();
