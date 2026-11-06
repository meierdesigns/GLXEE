"use strict";

// Supply crates: drift in now and then, break open when shot and drop a
// temporary power-up (stronger, bigger shots for a few seconds).
const CRATE_INTERVAL_MIN = 18000;
const CRATE_INTERVAL_MAX = 28000;
const CRATE_SIZE = 12;
const POWER_SHOT_MS = 12000;
const POWER_SHOT_DAMAGE = 1.6;
const POWER_SHOT_SIZE = 1.3;
const OVERCHARGE_DAMAGE = 2.0;
const OVERCHARGE_SIZE = 1.15;
const FOCUS_DAMAGE = 1.35;
const FOCUS_SIZE = 1.55;
const RAPID_FIRE_MUL = 0.6;      // cooldown × (fires ~1.7× as fast)
const SPRAY_MUL = 0.48;          // cooldown × (fires ~2.1× as fast)
const BARRIER_DAMAGE_MUL = 0.5;  // damage taken ×
const AEGIS_DAMAGE_MUL = 0.7;    // damage taken ×
const SPEED_BOOST_MUL = 1.45;    // move speed ×
const TURBO_MUL = 1.25;          // move speed ×
const FREEZE_SLOW_MUL = 0.4;     // freeze trap: crawl, do not lock
const MAGNET_RADIUS_MUL = 1.8;   // collect radius ×
const MAGNET_BONUS = 3;          // extra magnet strength
const SCRAPPER_RADIUS_MUL = 1.35;
const SCRAPPER_MAGNET_BONUS = 2;
const DOUBLE_LOOT_MUL = 2;       // resource yield ×
const SCRAPPER_LOOT_MUL = 1.5;
const REPAIR_PER_SEC = 0.04;     // share of max hull healed per second
const STIM_PER_SEC = 0.025;
const STIM_BURST = 0.2;          // share of max hull healed on pickup

/**
 * Temporary power-ups a crate can drop. Each has its own colour, silhouette
 * (diamond / hexagon / circle / square) and glyph so they read apart at a glance.
 */
const POWER_UPS = {
    power_shot:  { label: 'POWER SHOT',  ms: POWER_SHOT_MS, color: '#ffcf3a', light: '#fff2a8', shape: 'diamond', glyph: 'arrow' },
    rapid_fire:  { label: 'RAPID FIRE',  ms: 10000, color: '#3ad8ff', light: '#c8f6ff', shape: 'hex', glyph: 'chevrons' },
    barrier:     { label: 'BARRIER',     ms: 10000, color: '#5cff7a', light: '#d4ffdc', shape: 'circle', glyph: 'cross' },
    speed_boost: { label: 'AFTERBURNER', ms: 9000,  color: '#ff8a3a', light: '#ffd8b8', shape: 'triangle', glyph: 'chevrons' },
    magnet:      { label: 'MAGNET',      ms: 12000, color: '#ff5ce0', light: '#ffd0f6', shape: 'square', glyph: 'magnet' },
    double_loot: { label: 'DOUBLE LOOT', ms: 15000, color: '#c49a4a', light: '#f0dca8', shape: 'hex', glyph: 'dots' },
    repair:      { label: 'REPAIR',      ms: 8000,  color: '#ff4a6a', light: '#ffc8d2', shape: 'circle', glyph: 'dots' },
    overcharge:  { label: 'OVERCHARGE',  ms: 9000,  color: '#ff3a3a', light: '#ffb0b0', shape: 'diamond', glyph: 'cross' },
    focus:       { label: 'FOCUS BEAM',  ms: 10000, color: '#a78bfa', light: '#e4d4ff', shape: 'triangle', glyph: 'arrow' },
    spray:       { label: 'SPRAY FIRE',  ms: 9000,  color: '#5ad0ff', light: '#d0f4ff', shape: 'hex', glyph: 'chevrons' },
    aegis:       { label: 'AEGIS',       ms: 11000, color: '#7ec8ff', light: '#d8ecff', shape: 'circle', glyph: 'cross' },
    turbo:       { label: 'TURBO',       ms: 8000,  color: '#ffb347', light: '#ffe0b0', shape: 'triangle', glyph: 'chevrons' },
    scrapper:    { label: 'SCRAPPER',    ms: 14000, color: '#d4a574', light: '#f0e0c8', shape: 'square', glyph: 'magnet' },
    stim:        { label: 'STIM PACK',   ms: 7000,  color: '#ff6b9d', light: '#ffd0e0', shape: 'circle', glyph: 'dots' }
};
const POWER_UP_IDS = Object.keys(POWER_UPS);

/**
 * Fake crates / perks. Look like the real thing except for a flickering red
 * warning pixel. BOMB blasts on contact (shooting the crate disarms it).
 * FREEZE only slows the ship — guns stay free.
 */
const FAKE_CRATE_CHANCE = 0.25;  // share of drifting supply crates that are fake
const TRAP_BLAST_RADIUS = 36;
const TRAP_BLAST_DAMAGE = 0.2;   // share of max hull at the centre
const TRAP_FREEZE_MS = 2200;
const TRAP_IDS = ['bomb', 'freeze'];
const TRAP_WARN = '#ff2a2a';

function pickTrap() {
    return TRAP_IDS[Math.floor(Math.random() * TRAP_IDS.length)];
}

extendClass(ObstacleManager, {
    /** Called every frame from update(): spawn a crate on a timer. */
    updateCrates(deltaTime, gameState) {
        const level = this.getCurrentLevel();
        if (level && level.isBoss) return;
        if (this.crateTimer == null) this.crateTimer = this.nextCrateDelay() * 0.5;
        this.crateTimer -= Math.max(0, Number(deltaTime) || 16.67);
        if (this.crateTimer > 0) return;
        this.crateTimer = this.nextCrateDelay();
        this.spawnCrate(gameState, Math.random() < FAKE_CRATE_CHANCE ? { trap: pickTrap() } : null);
    },

    /** Enemy wreck sheds a fake crate at (x, y) that drifts with the field. */
    spawnFakeCrate(x, y) {
        this.spawnCrate(null, { trap: pickTrap(), x: x - CRATE_SIZE / 2, y: y - CRATE_SIZE / 2 });
    },

    nextCrateDelay() {
        return CRATE_INTERVAL_MIN + Math.random() * (CRATE_INTERVAL_MAX - CRATE_INTERVAL_MIN);
    },

    spawnCrate(gameState, opts) {
        const o = opts || {};
        const W = (gameState && gameState.width) || 240;
        let x = W * (0.25 + Math.random() * 0.5);
        // Keep it inside the canyon passage.
        const walls = this.terrainWallsAtY ? this.terrainWallsAtY(0, W) : null;
        if (walls) x = walls.left + 6 + Math.random() * Math.max(1, walls.right - walls.left - 12 - CRATE_SIZE);
        const scroll = this.isScrollStage();
        const placed = o.x != null && o.y != null;
        this.obstacles.push({
            trap: o.trap || null,
            x: placed ? o.x : (scroll ? x : -CRATE_SIZE - 2),
            y: placed ? o.y : (scroll ? -CRATE_SIZE - 2 : ((gameState && gameState.height) || 300) * (0.3 + Math.random() * 0.3)),
            width: CRATE_SIZE,
            height: CRATE_SIZE,
            horizontalSpeed: scroll ? (Math.random() - 0.5) * 0.15 : 0.6,
            verticalSpeed: scroll ? this.scrollSpeed() * 0.8 : 0.05,
            rotation: 0,
            rotationSpeed: 0,
            type: 'crate',
            kind: 'crate',
            isCrate: true,
            color: '#c9a45a',
            health: 3,
            maxHealth: 3,
            isDestructible: true,
            reflectsShots: false,
            isFog: false,
            fragmentOnDestroy: false,
            fragmentCount: 0,
            fragmentGeneration: 0,
            collisionDamage: 5,
            opticalMode: 'none',
            explosionId: 'small_pop',
            sprite: 'obstacle',
            opacity: 1,
            entering: !placed,
            age: 0
        });
    },

    /**
     * Shooting a crate disarms BOMB traps — opened crates never explode.
     * Touching an untouched bomb crate still blasts via spawnPowerUp.
     */
    disarmCrateBomb(o) {
        if (!o || !o.isCrate || o.trap !== 'bomb') return false;
        o.trap = null;
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice('BOMB DISARMED');
        }
        return true;
    },

    /** Pixel-art supply crate (baked once). */
    crateImage() {
        if (this._crateImg) return this._crateImg;
        const rows = [
            'OOOOOOOOOO',
            'OLLLLLLLLO',
            'OLbbAAbbDO',
            'OLbAYYAbDO',
            'OLAYYYYADO',
            'OLAYYYYADO',
            'OLbAYYAbDO',
            'OLbbAAbbDO',
            'ODDDDDDDDO',
            'OOOOOOOOOO'
        ];
        const pal = { O: '#05060a', L: '#e8c878', b: '#a8783a', D: '#6a4520', A: '#ffcf3a', Y: '#fff2a8' };
        const c = document.createElement('canvas');
        c.width = rows[0].length;
        c.height = rows.length;
        const x = c.getContext('2d');
        rows.forEach((row, py) => {
            for (let px = 0; px < row.length; px++) {
                x.fillStyle = pal[row[px]];
                x.fillRect(px, py, 1, 1);
            }
        });
        this._crateImg = c;
        return c;
    },

    drawCrate(ctx, o) {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        let x = o.x;
        let y = o.y;
        let w = o.width;
        let h = o.height;
        if (cell) {
            x = Math.round(x / cell) * cell;
            y = Math.round(y / cell) * cell;
            w = Math.max(cell, Math.round(w / cell) * cell);
            h = Math.max(cell, Math.round(h / cell) * cell);
        } else {
            x = Math.round(x);
            y = Math.round(y);
            // Soft pulsing glow so crates read as loot, not rocks.
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 0.006);
            ctx.fillStyle = '#ffcf3a';
            ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
            ctx.globalAlpha = 1;
        }
        ctx.drawImage(this.crateImage(), x, y, w, h);
        // Fake crate tell: a red pixel in the top-right corner flickers.
        if (o.trap && Math.floor(t / 220) % 2) {
            const px = cell || Math.max(1, Math.round(w / 10));
            if (cv && cv.fill) cv.fill(ctx, x + w - 2 * px, y + px, px, px, TRAP_WARN, 1);
            else {
                ctx.fillStyle = TRAP_WARN;
                ctx.fillRect(x + w - 2 * px, y + px, px, px);
            }
        }
        ctx.restore();
    },
});

extendClass(PickupManager, {
    /**
     * Crate broke open: drop a random power-up at its centre. A BOMB crate
     * (untouched — usually from ramming) blows up instead; FREEZE drops a
     * disguised chill perk.
     */
    spawnPowerUp(o) {
        if (o && o.trap === 'bomb') {
            this.trapBlast(o.x + o.width / 2, o.y + o.height / 2);
            return;
        }
        const id = POWER_UP_IDS[Math.floor(Math.random() * POWER_UP_IDS.length)];
        this.pickups.push({
            id: id,
            powerUp: id,
            trap: (o && o.trap) || null,
            amount: 0,
            x: o.x + o.width / 2,
            y: o.y + o.height / 2,
            vx: (o.horizontalSpeed || 0) * 0.3,
            vy: (o.verticalSpeed || 0) * 0.3,
            age: 0,
            life: 12000,
            size: 10
        });
    },

    /** Grants `id` (one of POWER_UPS) for `ms` milliseconds, e.g. an in-stage shop purchase. */
    grantPowerUp(id, ms) {
        if (!POWER_UPS[id]) return false;
        if (!this.powerUntil) this.powerUntil = {};
        const until = Date.now() + Math.max(1000, Number(ms) || POWER_UPS[id].ms);
        this.powerUntil[id] = Math.max(this.powerUntil[id] || 0, until);
        if (id === 'power_shot') this.powerShotUntil = this.powerUntil[id];
        return true;
    },

    /** Returns true if the pickup was a power-up (handled here). */
    collectPowerUp(p) {
        if (!p || !p.powerUp) return false;
        if (p.trap) {
            this.triggerTrap(p);
            return true;
        }
        const def = POWER_UPS[p.powerUp] || POWER_UPS.power_shot;
        const id = POWER_UPS[p.powerUp] ? p.powerUp : 'power_shot';
        if (!this.powerUntil) this.powerUntil = {};
        const now = Date.now();
        const prev = this.powerUntil[id];
        const cur = prev && prev > now ? prev : now;
        // Stacking extends the timer (capped at twice the base duration).
        this.powerUntil[id] = Math.min(now + def.ms * 2, cur + def.ms);
        if (id === 'power_shot') this.powerShotUntil = this.powerUntil[id];
        if (id === 'stim') this.applyStimBurst();
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice(def.label + ' ' + Math.round((this.powerUntil[id] - now) / 1000) + 's');
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(p.x, p.y, 6, def.color);
        }
        if (typeof soundManager !== 'undefined') {
            if (soundManager.playPowerUp) soundManager.playPowerUp();
            else if (soundManager.playReflect) soundManager.playReflect();
        }
        return true;
    },

    /** STIM PACK: instant hull burst on pickup. */
    applyStimBurst() {
        if (typeof playerManager === 'undefined') return;
        const maxHp = playerManager.getMaxHealth ? playerManager.getMaxHealth()
            : (playerManager.maxHealth || 100);
        const cur = playerManager.health != null ? playerManager.health
            : (playerManager.getHealth ? playerManager.getHealth() : 0);
        if (!(maxHp > 0) || !(cur > 0)) return;
        playerManager.health = Math.min(maxHp, cur + maxHp * STIM_BURST);
    },

    /** Fake perk picked up: spring its trap on the player. */
    triggerTrap(p) {
        if (p.trap === 'bomb') {
            this.trapBlast(p.x, p.y);
            return;
        }
        if (!this.powerUntil) this.powerUntil = {};
        this.powerUntil.freeze = Date.now() + TRAP_FREEZE_MS;
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice('FAKE! CHILLED');
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(p.x, p.y, 8, '#9fdcff');
        }
        if (typeof soundManager !== 'undefined' && soundManager.playHurt) soundManager.playHurt();
    },

    /** Trap explosion: hull damage falls off with distance to the player. */
    trapBlast(x, y) {
        if (typeof explosionSystem !== 'undefined' && explosionSystem.play) {
            try { explosionSystem.play('small_pop', x, y, { width: TRAP_BLAST_RADIUS, height: TRAP_BLAST_RADIUS }); } catch (err) { /* optional fx */ }
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(x, y, 10, TRAP_WARN);
        }
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice('FAKE! BOOM');
        }
        if (typeof playerManager === 'undefined' || !playerManager.getPosition) return;
        const pl = playerManager.getPosition();
        if (!pl) return;
        const dx = pl.x + pl.width / 2 - x;
        const dy = pl.y + pl.height / 2 - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > TRAP_BLAST_RADIUS) return;
        const maxHp = playerManager.getMaxHealth ? playerManager.getMaxHealth() : 100;
        const dmg = maxHp * TRAP_BLAST_DAMAGE * (1 - 0.6 * dist / TRAP_BLAST_RADIUS);
        if (typeof soundManager !== 'undefined' && soundManager.playHurt) soundManager.playHurt();
        if (playerManager.takeDamage(dmg) && typeof game !== 'undefined') game.gameOver();
    },

    /** Active power-up state { left, total } or null. */
    getPowerUp(id) {
        const until = id === 'power_shot' ? this.powerShotUntil : (this.powerUntil && this.powerUntil[id]);
        const left = (until || 0) - Date.now();
        if (left <= 0) return null;
        return { left, total: id === 'freeze' ? TRAP_FREEZE_MS : POWER_UPS[id].ms };
    },

    /** FREEZE trap: ship is chilled (slow), not locked. */
    isFrozen() {
        return !!this.getPowerUp('freeze');
    },

    /** Move speed multiplier (AFTERBURNER / TURBO / FREEZE chill). */
    getMoveSpeedMul() {
        let mul = 1;
        if (this.getPowerUp('speed_boost')) mul *= SPEED_BOOST_MUL;
        if (this.getPowerUp('turbo')) mul *= TURBO_MUL;
        if (this.getPowerUp('freeze')) mul *= FREEZE_SLOW_MUL;
        return mul;
    },

    /** Hull healed per second (REPAIR / STIM). */
    getRepairPerSec(maxHealth) {
        let rate = 0;
        if (this.getPowerUp('repair')) rate += REPAIR_PER_SEC;
        if (this.getPowerUp('stim')) rate += STIM_PER_SEC;
        return (Number(maxHealth) || 0) * rate;
    },

    /** Applies MAGNET / SCRAPPER / DOUBLE LOOT to collect stats in place. */
    applyCollectPerks(stats) {
        if (this.getPowerUp('magnet')) {
            stats.radius *= MAGNET_RADIUS_MUL;
            stats.magnet += MAGNET_BONUS;
        }
        if (this.getPowerUp('scrapper')) {
            stats.radius *= SCRAPPER_RADIUS_MUL;
            stats.magnet += SCRAPPER_MAGNET_BONUS;
            stats.yieldMul *= SCRAPPER_LOOT_MUL;
        }
        if (this.getPowerUp('double_loot')) stats.yieldMul *= DOUBLE_LOOT_MUL;
        return stats;
    },

    /** Current shot multipliers from active power-ups. */
    getPowerShot() {
        let damage = 1;
        let size = 1;
        let left = 0;
        let total = POWER_SHOT_MS;
        if (this.getPowerUp('power_shot')) {
            damage *= POWER_SHOT_DAMAGE;
            size *= POWER_SHOT_SIZE;
            const s = this.getPowerUp('power_shot');
            left = Math.max(left, s.left);
            total = Math.max(total, s.total);
        }
        if (this.getPowerUp('overcharge')) {
            damage *= OVERCHARGE_DAMAGE;
            size *= OVERCHARGE_SIZE;
            const s = this.getPowerUp('overcharge');
            left = Math.max(left, s.left);
            total = Math.max(total, s.total);
        }
        if (this.getPowerUp('focus')) {
            damage *= FOCUS_DAMAGE;
            size *= FOCUS_SIZE;
            const s = this.getPowerUp('focus');
            left = Math.max(left, s.left);
            total = Math.max(total, s.total);
        }
        if (damage <= 1 && size <= 1) return null;
        return { left: left || 1, total, damage, size };
    },

    /** Weapon cooldown multiplier (RAPID FIRE / SPRAY). */
    getFireRateMul() {
        let mul = 1;
        if (this.getPowerUp('rapid_fire')) mul *= RAPID_FIRE_MUL;
        if (this.getPowerUp('spray')) mul *= SPRAY_MUL;
        return mul;
    },

    /** Incoming damage multiplier (BARRIER / AEGIS). */
    getDamageTakenMul() {
        let mul = 1;
        if (this.getPowerUp('barrier')) mul *= BARRIER_DAMAGE_MUL;
        if (this.getPowerUp('aegis')) mul *= AEGIS_DAMAGE_MUL;
        return mul;
    },

    drawPowerUp(ctx, p, x, y) {
        const def = POWER_UPS[p.powerUp] || POWER_UPS.power_shot;
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const cv = typeof window !== 'undefined' ? window.combatVoxels : null;
        const cell = cv && cv.cell ? cv.cell() : null;
        let r = 5 + Math.round(Math.sin(t * 0.01) * 1);
        if (cell) {
            x = Math.round(x / cell) * cell;
            y = Math.round(y / cell) * cell;
            r = Math.max(cell, Math.round(r / cell) * cell);
        } else {
            x = Math.round(x);
            y = Math.round(y);
        }
        const step = cell || 1;
        // Silhouette as pixel rows: half-width per row offset dy.
        const half = (dy, rr) => {
            const a = Math.abs(dy);
            if (def.shape === 'diamond') return rr - a;
            if (def.shape === 'hex') return Math.min(rr - step, (rr - a) * 2);
            if (def.shape === 'square') return rr - step;
            if (def.shape === 'triangle') return Math.round((rr - step) * ((dy + rr) / (2 * rr || 1)));
            return Math.round(Math.sqrt(Math.max(0, rr * rr - a * a)));
        };
        const shape = (rr, color, alpha) => {
            if (alpha != null) ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            for (let dy = -rr; dy <= rr; dy += step) {
                const h = half(dy, rr);
                if (h >= 0) {
                    const hw = cell ? Math.max(cell, Math.round(h / cell) * cell) : h;
                    if (cv && cv.fill) cv.fill(ctx, x - hw, y + dy, hw * 2 + step, step, color, alpha == null ? 1 : alpha);
                    else ctx.fillRect(x - hw, y + dy, hw * 2 + step, step);
                }
            }
            if (alpha != null) ctx.globalAlpha = 1;
        };
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Coloured halo so the type reads even when tiny — skipped in VOXEL.
        if (!cell) {
            ctx.globalAlpha = 0.35;
            shape(r + 3, def.color);
            ctx.globalAlpha = 1;
        }
        shape(r + step, '#05060a');
        shape(r, def.color);
        shape(Math.max(step, r - 3 * step), def.light);
        const mark = (mx, my, mw, mh) => {
            if (cv && cv.fill) cv.fill(ctx, mx, my, mw, mh, '#05060a', 1);
            else {
                ctx.fillStyle = '#05060a';
                ctx.fillRect(mx, my, mw, mh);
            }
        };
        if (def.glyph === 'arrow') {
            mark(x, y - 2 * step, step, 5 * step);
            mark(x - step, y - step, 3 * step, step);
            mark(x - 2 * step, y, 5 * step, step);
        } else if (def.glyph === 'chevrons') {
            for (let k = 0; k < 2; k++) {
                const yy = y - 2 * step + k * 3 * step;
                mark(x, yy, step, step);
                mark(x - step, yy + step, step, step);
                mark(x + step, yy + step, step, step);
                mark(x - 2 * step, yy + 2 * step, step, step);
                mark(x + 2 * step, yy + 2 * step, step, step);
            }
        } else if (def.glyph === 'magnet') {
            mark(x - 2 * step, y - 2 * step, step, 4 * step);
            mark(x + 2 * step, y - 2 * step, step, 4 * step);
            mark(x - step, y + step, 3 * step, step);
        } else if (def.glyph === 'dots') {
            mark(x - 2 * step, y - step, 2 * step, 2 * step);
            mark(x + step, y - step, 2 * step, 2 * step);
        } else {
            mark(x, y - 2 * step, step, 5 * step);
            mark(x - 2 * step, y, 5 * step, step);
        }
        // Fake perk tell: flickering red warning pixel, top right.
        if (p.trap && Math.floor(t / 220) % 2) {
            if (cv && cv.fill) cv.fill(ctx, x + r - step, y - r, step, step, TRAP_WARN, 1);
            else {
                ctx.fillStyle = TRAP_WARN;
                ctx.fillRect(x + r - step, y - r, step, step);
            }
        }
        ctx.restore();
    },

    /** Remaining power-up times as thin bars under the player, one per type in its colour. */
    drawPowerShotBar(ctx) {
        if (typeof playerManager === 'undefined' || !playerManager.getPosition) return;
        const pl = playerManager.getPosition();
        if (!pl) return;
        const w = Math.max(12, pl.width || 16);
        const x = Math.round(pl.x + (pl.width || 16) / 2 - w / 2);
        let y = Math.round(pl.y + (pl.height || 16) + 3);
        ctx.save();
        POWER_UP_IDS.concat('freeze').forEach((id) => {
            const ps = this.getPowerUp(id);
            if (!ps) return;
            const def = POWER_UPS[id] || { color: '#9fdcff', light: '#ffffff' };
            ctx.fillStyle = '#05060a';
            ctx.fillRect(x - 1, y - 1, w + 2, 4);
            ctx.fillStyle = ps.left < 2500 && Math.floor(ps.left / 150) % 2 ? def.light : def.color;
            ctx.fillRect(x, y, Math.round(w * Math.min(1, ps.left / ps.total)), 2);
            y += 4;
        });
        ctx.restore();
    },
});
