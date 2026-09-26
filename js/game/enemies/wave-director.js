"use strict";

// EnemyManager methods: wave director. The planet schedule is the authored
// backbone; the director makes every run different (timing, head count,
// escort formation, champion events) and reacts to what happens in the
// fight — player health, kill pace, champion phases, obstacle pressure and
// running combat events — by adding or holding back extra waves.
const WAVE_FORMATIONS = ['wedge', 'line', 'flank', 'box', 'loose'];
const WAVE_EXTRA_EVENT_ROLES = ['gunner', 'bomber', 'blocker', 'repair', 'shieldBattery'];
const DIRECTOR_TICK_MS = 1000;
const DIRECTOR_MIN_GAP_MS = 7000;

extendClass(EnemyManager, {
    /** Per-run variation of the authored schedule. Called by setEnemySchedule. */
    varyRun() {
        const rand = (a, b) => a + Math.random() * (b - a);
        this.runFormation = WAVE_FORMATIONS[Math.floor(Math.random() * WAVE_FORMATIONS.length)];
        const normals = this.schedule.filter((e) => !e.champion && e.spawnAt < 999999);
        const extra = [];
        normals.forEach((e) => {
            // Timing: ±25 % plus a little absolute jitter, never before 0.
            e.spawnAt = Math.max(0, e.spawnAt * rand(0.75, 1.25) + rand(-1.5, 1.5));
            // Head count: sometimes a wingman joins, sometimes the ship stays home.
            const r = Math.random();
            if (r < 0.3) {
                extra.push(Object.assign({}, e, {
                    id: e.id + '_w' + extra.length,
                    spawnAt: e.spawnAt + rand(1.5, 5),
                    combatEvents: [],
                    spawned: false
                }));
            } else if (r > 0.88 && normals.length > 1) {
                e.spawnAt = 999999;
            }
        });
        this.schedule = this.schedule.concat(extra);
        this.director = {
            tickMs: 0,
            sinceWaveMs: 0,
            sinceKillMs: 0,
            killStreak: 0,
            lastPlayerHp: null,
            recentDamage: 0,
            pendingRevengeMs: 0,
            waves: 0
        };
    },

    /** Champion combat events vary per run: thresholds, counts, one surprise. */
    varyCombatEvents(list) {
        const rand = (a, b) => a + Math.random() * (b - a);
        const out = list.map((ev) => {
            const v = Object.assign({}, ev);
            if (v.threshold != null) v.threshold = Math.max(0.1, Math.min(0.9, v.threshold + rand(-0.08, 0.08)));
            if (v.elapsedSec != null) v.elapsedSec = Math.max(2, v.elapsedSec * rand(0.8, 1.2));
            if (v.count != null) v.count = Math.max(1, Math.round(v.count + rand(-1, 1.4)));
            return v;
        });
        if (Math.random() < 0.5) {
            const used = out.map((e) => e.role);
            const pool = WAVE_EXTRA_EVENT_ROLES.filter((r) => used.indexOf(r) === -1);
            if (pool.length) {
                const role = pool[Math.floor(Math.random() * pool.length)];
                const type = (this.sideEnemyPool[0] && this.sideEnemyPool[0].type) || 'enemyBasic';
                out.push({
                    id: 'dir_' + role,
                    trigger: 'hpBelow',
                    threshold: rand(0.3, 0.75),
                    once: true,
                    action: 'summon',
                    count: role === 'bomber' ? 3 : (role === 'gunner' ? 2 : 1),
                    role: role,
                    type: type
                });
            }
        }
        return out;
    },

    /** Escort slot offset for the run's formation (called by escortFormationOffset). */
    formationOffset(slot) {
        const i = slot | 0;
        const side = i % 2 === 0 ? -1 : 1;
        const rank = Math.floor(i / 2);
        const jitter = () => (Math.random() - 0.5) * 6;
        switch (this.runFormation) {
            case 'line':
                return { x: side * (16 + rank * 14) + jitter(), y: jitter() };
            case 'flank':
                return { x: side * (30 + rank * 6) + jitter(), y: -10 + rank * 14 + jitter() };
            case 'box':
                return { x: side * (18 + (rank % 2) * 4), y: (rank < 1 ? -14 : 16) + jitter() };
            case 'wedge':
                return { x: side * (14 + rank * 11) + jitter(), y: 10 + rank * 10 + jitter() };
            default:
                return null; // loose: original random scatter
        }
    },

    /** Called every frame from update(). */
    updateDirector(deltaTime, gameState) {
        const d = this.director;
        if (!d || this.spawnFrozen || !gameState) return;
        d.sinceWaveMs += deltaTime;
        d.sinceKillMs += deltaTime;
        if (d.pendingRevengeMs > 0) {
            d.pendingRevengeMs -= deltaTime;
            if (d.pendingRevengeMs <= 0) this.spawnDirectorWave(gameState, 'revenge');
        }
        d.tickMs += deltaTime;
        if (d.tickMs < DIRECTOR_TICK_MS) return;
        d.tickMs = 0;

        // --- Read the fight ---
        const pm = typeof playerManager !== 'undefined' ? playerManager : null;
        const playerHp = pm && pm.maxHealth ? pm.health / pm.maxHealth : 1;
        if (d.lastPlayerHp != null && playerHp < d.lastPlayerHp) {
            d.recentDamage += d.lastPlayerHp - playerHp;
        }
        d.recentDamage *= 0.9; // decays over ~10 s
        d.lastPlayerHp = playerHp;
        const champAlive = !!(this.enemy && !this.exploding);
        const champHp = champAlive && this.maxHealth ? this.health / this.maxHealth : 1;
        const eventRunning = Object.keys(this.pendingCombatAnnounces || {}).length > 0;
        const obstacles = typeof obstacleManager !== 'undefined' && obstacleManager.getObstacles
            ? obstacleManager.getObstacles().filter((o) => !o.isFog).length : 0;
        const room = this.sideEnemyCap - this.sideEnemies.length;

        // --- Hold back when the player is struggling or the screen is busy ---
        if (!champAlive || this.sideFleeing || eventRunning || room < 2) return;
        if (playerHp < 0.3 || d.recentDamage > 0.25 || obstacles > 30) return;
        if (d.sinceWaveMs < DIRECTOR_MIN_GAP_MS) return;

        // --- Push when the player is cruising ---
        // Pressure rises with kill streaks, a healthy player, a wounded
        // champion (last stand) and quiet stretches with an empty field.
        let chance = 0.08;
        if (playerHp > 0.7 && d.recentDamage < 0.05) chance += 0.12;
        chance += Math.min(0.2, d.killStreak * 0.05);
        if (champHp < 0.4) chance += 0.15;
        if (!this.sideEnemies.length && d.sinceKillMs > 12000) chance += 0.25;
        if (Math.random() < chance) {
            this.spawnDirectorWave(gameState, champHp < 0.4 ? 'laststand' : 'reinforce');
        }
    },

    /** Kill feedback: streaks raise pressure, lost escorts may call for revenge. */
    directorOnKill(info) {
        const d = this.director;
        if (!d) return;
        d.sinceKillMs = 0;
        d.killStreak += 1;
        if (info && !info.champion && this.enemy && !this.exploding
            && d.pendingRevengeMs <= 0 && Math.random() < 0.3) {
            d.pendingRevengeMs = 3000 + Math.random() * 3000;
        }
        if (info && info.champion) d.killStreak = 0;
    },

    /** Extra flyby wave in a shape; kind picks size/roles. */
    spawnDirectorWave(gameState, kind) {
        const d = this.director;
        if (!d || !this.sideEnemyPool.length) return 0;
        const room = this.sideEnemyCap - this.sideEnemies.length;
        if (room < 1) return 0;
        const size = Math.min(room, kind === 'laststand' ? 3 + Math.floor(Math.random() * 2)
            : (kind === 'revenge' ? 2 : 2 + Math.floor(Math.random() * 2)));
        const role = kind === 'laststand' && Math.random() < 0.5 ? 'bomber' : 'assault';
        const shape = ['line', 'vee', 'column', 'stagger'][Math.floor(Math.random() * 4)];
        const fromLeft = Math.random() < 0.5;
        const W = gameState.width || 200;
        const H = gameState.height || 300;
        const baseY = H * (0.12 + Math.random() * 0.25);
        const cluster = 'wave_' + (++d.waves);
        const spawned = [];
        for (let n = 0; n < size; n++) {
            const type = this.pickSideEnemyType();
            if (!type) break;
            const side = this.spawnScheduledNormal({
                id: 'dir_' + cluster + '_' + n,
                type: type,
                faction: (this.enemy && this.enemy.faction) || 'pirate',
                enemyClass: 'assault',
                tier: 1,
                level: 1,
                champion: false,
                cluster: cluster,
                role: role,
                forceEscort: false
            }, gameState);
            if (side) spawned.push(side);
        }
        const mid = (spawned.length - 1) / 2;
        spawned.forEach((s, n) => {
            const k = n - mid;
            let dx = 0;
            let dy = 0;
            if (shape === 'line') dx = n * 18;
            else if (shape === 'vee') { dx = Math.abs(k) * 14; dy = k * 14; }
            else if (shape === 'column') dx = n * 22;
            else { dx = n * 16; dy = (n % 2 ? 12 : -12); }
            if (shape === 'line') dy = k * 16;
            s.x = fromLeft ? -20 - dx : W + 20 + dx;
            s.y = Math.max(10, Math.min(H * 0.5, baseY + dy));
            const speed = Math.abs(s.speed || 0.45);
            s.speed = fromLeft ? speed : -speed;
            s.verticalSpeed = 0;
        });
        if (spawned.length) {
            d.sinceWaveMs = 0;
            if (kind !== 'reinforce' && this.announceCombatEvent) {
                this.announceCombatEvent({ id: 'dir_' + kind, role: role === 'bomber' ? 'bomber' : 'gunner' });
            }
        }
        return spawned.length;
    },
});
