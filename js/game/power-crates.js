"use strict";

// Supply crates: drift in now and then, break open when shot and drop a
// temporary power-up (stronger, bigger shots for a few seconds).
const CRATE_INTERVAL_MIN = 18000;
const CRATE_INTERVAL_MAX = 28000;
const CRATE_SIZE = 12;
const POWER_SHOT_MS = 12000;
const POWER_SHOT_DAMAGE = 1.6;
const POWER_SHOT_SIZE = 1.3;
const RAPID_FIRE_MUL = 0.6;      // cooldown × (fires ~1.7× as fast)
const BARRIER_DAMAGE_MUL = 0.5;  // damage taken ×

/**
 * Temporary power-ups a crate can drop. Each has its own colour, silhouette
 * (diamond / hexagon / circle) and glyph so they read apart at a glance.
 */
const POWER_UPS = {
    power_shot: { label: 'POWER SHOT', ms: POWER_SHOT_MS, color: '#ffcf3a', light: '#fff2a8', shape: 'diamond', glyph: 'arrow' },
    rapid_fire: { label: 'RAPID FIRE', ms: 10000, color: '#3ad8ff', light: '#c8f6ff', shape: 'hex', glyph: 'chevrons' },
    barrier:    { label: 'BARRIER',    ms: 10000, color: '#5cff7a', light: '#d4ffdc', shape: 'circle', glyph: 'cross' }
};
const POWER_UP_IDS = Object.keys(POWER_UPS);

extendClass(ObstacleManager, {
    /** Called every frame from update(): spawn a crate on a timer. */
    updateCrates(deltaTime, gameState) {
        const level = this.getCurrentLevel();
        if (level && level.isBoss) return;
        if (this.crateTimer == null) this.crateTimer = this.nextCrateDelay() * 0.5;
        this.crateTimer -= Math.max(0, Number(deltaTime) || 16.67);
        if (this.crateTimer > 0) return;
        this.crateTimer = this.nextCrateDelay();
        this.spawnCrate(gameState);
    },

    nextCrateDelay() {
        return CRATE_INTERVAL_MIN + Math.random() * (CRATE_INTERVAL_MAX - CRATE_INTERVAL_MIN);
    },

    spawnCrate(gameState) {
        const W = (gameState && gameState.width) || 240;
        let x = W * (0.25 + Math.random() * 0.5);
        // Keep it inside the canyon passage.
        const walls = this.terrainWallsAtY ? this.terrainWallsAtY(0, W) : null;
        if (walls) x = walls.left + 6 + Math.random() * Math.max(1, walls.right - walls.left - 12 - CRATE_SIZE);
        const scroll = this.isScrollStage();
        this.obstacles.push({
            x: scroll ? x : -CRATE_SIZE - 2,
            y: scroll ? -CRATE_SIZE - 2 : ((gameState && gameState.height) || 300) * (0.3 + Math.random() * 0.3),
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
            entering: true,
            age: 0
        });
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
        ctx.restore();
    },
});

extendClass(PickupManager, {
    /** Crate broke open: drop a random power-up at its centre. */
    spawnPowerUp(o) {
        const id = POWER_UP_IDS[Math.floor(Math.random() * POWER_UP_IDS.length)];
        this.pickups.push({
            id: id,
            powerUp: id,
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

    /** Returns true if the pickup was a power-up (handled here). */
    collectPowerUp(p) {
        if (!p || !p.powerUp) return false;
        const def = POWER_UPS[p.powerUp] || POWER_UPS.power_shot;
        const id = POWER_UPS[p.powerUp] ? p.powerUp : 'power_shot';
        if (!this.powerUntil) this.powerUntil = {};
        const now = Date.now();
        const prev = this.powerUntil[id];
        const cur = prev && prev > now ? prev : now;
        // Stacking extends the timer (capped at twice the base duration).
        this.powerUntil[id] = Math.min(now + def.ms * 2, cur + def.ms);
        if (id === 'power_shot') this.powerShotUntil = this.powerUntil[id];
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice(def.label + ' ' + Math.round((this.powerUntil[id] - now) / 1000) + 's');
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(p.x, p.y, 6, def.color);
        }
        if (typeof soundManager !== 'undefined' && soundManager.playReflect) soundManager.playReflect();
        return true;
    },

    /** Active power-up state { left, total } or null. */
    getPowerUp(id) {
        const until = id === 'power_shot' ? this.powerShotUntil : (this.powerUntil && this.powerUntil[id]);
        const left = (until || 0) - Date.now();
        if (left <= 0) return null;
        return { left, total: POWER_UPS[id].ms };
    },

    /** Current shot multipliers from active power-ups. */
    getPowerShot() {
        const s = this.getPowerUp('power_shot');
        return s ? Object.assign(s, { damage: POWER_SHOT_DAMAGE, size: POWER_SHOT_SIZE }) : null;
    },

    /** Weapon cooldown multiplier (RAPID FIRE). */
    getFireRateMul() {
        return this.getPowerUp('rapid_fire') ? RAPID_FIRE_MUL : 1;
    },

    /** Incoming damage multiplier (BARRIER). */
    getDamageTakenMul() {
        return this.getPowerUp('barrier') ? BARRIER_DAMAGE_MUL : 1;
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
        } else {
            mark(x, y - 2 * step, step, 5 * step);
            mark(x - 2 * step, y, 5 * step, step);
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
        POWER_UP_IDS.forEach((id) => {
            const ps = this.getPowerUp(id);
            if (!ps) return;
            const def = POWER_UPS[id];
            ctx.fillStyle = '#05060a';
            ctx.fillRect(x - 1, y - 1, w + 2, 4);
            ctx.fillStyle = ps.left < 2500 && Math.floor(ps.left / 150) % 2 ? def.light : def.color;
            ctx.fillRect(x, y, Math.round(w * Math.min(1, ps.left / ps.total)), 2);
            y += 4;
        });
        ctx.restore();
    },
});
