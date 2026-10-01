"use strict";

// Supply crates: drift in now and then, break open when shot and drop a
// temporary power-up (stronger, bigger shots for a few seconds).
const CRATE_INTERVAL_MIN = 18000;
const CRATE_INTERVAL_MAX = 28000;
const CRATE_SIZE = 12;
const POWER_SHOT_MS = 12000;
const POWER_SHOT_DAMAGE = 1.6;
const POWER_SHOT_SIZE = 1.3;

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
        // Soft pulsing glow so crates read as loot, not rocks.
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 0.006);
        ctx.fillStyle = '#ffcf3a';
        ctx.fillRect(Math.round(o.x) - 2, Math.round(o.y) - 2, o.width + 4, o.height + 4);
        ctx.globalAlpha = 1;
        ctx.drawImage(this.crateImage(), Math.round(o.x), Math.round(o.y), o.width, o.height);
        ctx.restore();
    },
});

extendClass(PickupManager, {
    /** Crate broke open: drop a power-up at its centre. */
    spawnPowerUp(o) {
        this.pickups.push({
            id: 'power_shot',
            powerUp: 'power_shot',
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
        const now = Date.now();
        const cur = this.powerShotUntil && this.powerShotUntil > now ? this.powerShotUntil : now;
        // Stacking extends the timer (capped at twice the base duration).
        this.powerShotUntil = Math.min(now + POWER_SHOT_MS * 2, cur + POWER_SHOT_MS);
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
            levelInfoManager.showLootNotice('POWER SHOT ' + Math.round((this.powerShotUntil - now) / 1000) + 's');
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(p.x, p.y, 6, '#ffcf3a');
        }
        if (typeof soundManager !== 'undefined' && soundManager.playReflect) soundManager.playReflect();
        return true;
    },

    /** Current shot multipliers from active power-ups. */
    getPowerShot() {
        const left = (this.powerShotUntil || 0) - Date.now();
        if (left <= 0) return null;
        return { damage: POWER_SHOT_DAMAGE, size: POWER_SHOT_SIZE, left, total: POWER_SHOT_MS };
    },

    drawPowerUp(ctx, p, x, y) {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const s = 8 + Math.round(Math.sin(t * 0.01) * 1.5);
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
        ctx.fillStyle = '#ffcf3a';
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        // Arrow-up glyph: "stronger".
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x - 1, y - 2, 2, 5);
        ctx.fillRect(x - 3, y - 1, 6, 1);
        ctx.fillRect(x - 2, y - 2, 4, 1);
    },

    /** Remaining power-shot time as a thin bar under the player. */
    drawPowerShotBar(ctx) {
        const ps = this.getPowerShot();
        if (!ps || typeof playerManager === 'undefined' || !playerManager.getPosition) return;
        const pl = playerManager.getPosition();
        if (!pl) return;
        const w = Math.max(12, pl.width || 16);
        const x = Math.round(pl.x + (pl.width || 16) / 2 - w / 2);
        const y = Math.round(pl.y + (pl.height || 16) + 3);
        ctx.save();
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x - 1, y - 1, w + 2, 4);
        ctx.fillStyle = ps.left < 2500 && Math.floor(ps.left / 150) % 2 ? '#fff2a8' : '#ffcf3a';
        ctx.fillRect(x, y, Math.round(w * Math.min(1, ps.left / ps.total)), 2);
        ctx.restore();
    },
});
