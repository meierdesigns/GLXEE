"use strict";

// CollisionManager methods, split from collisions.js.
extendClass(CollisionManager, {
    /**
     * Crystal optical hit: mirror / prism / kaleidoscope.
     * @returns {boolean} true if fully handled
     */
    applyOpticalBulletHit(bullet, obstacle, sourceSide, bulletIndex, obstacleIndex) {
        const mode = obstacle.opticalMode || 'none';
        if (mode === 'none') return false;
        const tip = this.shotImpactXY(bullet);
        const cx = tip.x;
        const cy = tip.y;
        const explosionId = obstacle.explosionId || 'crystal_shatter';

        if (mode === 'mirror') {
            // Straight team flip — same path as shield reflects (no mid-air park).
            const asEnemy = sourceSide === 'player';
            this.reassignShotTeam(bulletIndex, sourceSide, asEnemy, obstacle);
            if (typeof soundManager !== 'undefined') soundManager.playReflect();
            this.damageObstacleOptical(obstacle, obstacleIndex, cx, cy, explosionId, 'reflect');
            return true;
        }

        // prism / kaleidoscope — split into angled child bullets
        const splitCount = mode === 'kaleidoscope'
            ? Math.max(3, obstacle.prismSplitCount || 3)
            : Math.max(2, Math.min(4, obstacle.prismSplitCount || 3));
        const angleSpread = ((obstacle.prismAngleDeg != null ? obstacle.prismAngleDeg : 25) * Math.PI) / 180;
        const baseDamage = (bullet.damage != null ? bullet.damage : 10) / splitCount;
        const baseSpeed = Math.abs(bullet.speed != null ? bullet.speed : 8);
        let baseAngle;
        if (bullet.angle !== undefined) {
            baseAngle = bullet.angle;
        } else {
            baseAngle = 0; // player: up via -cos; enemy list: down via +cos
        }

        // Remove original
        if (sourceSide === 'player') bulletManager.removeBullet(bulletIndex);
        else bulletManager.removeEnemyBullet(bulletIndex);

        // Crystals turn the shards against the shooter (player hit → enemy shards, and vice versa);
        // prism obstacles (prismKeepTeam) fan them out forward on the shooter's own side.
        const toEnemy = obstacle.prismKeepTeam ? sourceSide !== 'player' : sourceSide === 'player';
        for (let s = 0; s < splitCount; s++) {
            const t = splitCount === 1 ? 0 : (s / (splitCount - 1)) - 0.5;
            const ang = baseAngle + t * angleSpread * 2;
            const forward = toEnemy ? 1 : -1;
            const shardW = Math.max(1, Math.min(4, bullet.width || 3));
            const shardH = Math.max(3, Math.min(16, bullet.height || 8));
            const shard = {
                x: cx - shardW / 2,
                y: toEnemy ? cy + 2 : cy - shardH - 2,
                width: shardW,
                height: shardH,
                speed: baseSpeed,
                moveSpeed: baseSpeed,
                angle: ang,
                vx: Math.sin(ang) * baseSpeed,
                vy: forward * Math.cos(ang) * baseSpeed,
                isEnemyShot: !!toEnemy,
                damage: Math.max(1, Math.round(baseDamage)),
                color: bullet.color || (mode === 'kaleidoscope' ? 'var(--color-highlight)' : 'var(--color-accent)'),
                type: bullet.type || 'laser_beam',
                weaponId: bullet.weaponId,
                reflected: true,
                reflectiveShots: false,
                _reflectCount: 1,
                lightRadius: bullet.lightRadius || 50,
                lightIntensity: 1.2,
                lightColor: bullet.lightColor || 'var(--color-highlight)',
                _ignoreObstacle: obstacle,
                _isShot: true
            };
            if (typeof bulletManager !== 'undefined' && bulletManager.normalizeBulletMotion) {
                bulletManager.normalizeBulletMotion(shard, { speed: baseSpeed });
            }
            if (typeof bulletManager !== 'undefined' && bulletManager.pushBullet) {
                if (toEnemy) bulletManager.pushBullet(bulletManager.enemyBullets, shard);
                else bulletManager.pushBullet(bulletManager.bullets, shard);
            } else if (toEnemy) {
                bulletManager.getEnemyBullets().push(shard);
            } else {
                bulletManager.getBullets().push(shard);
            }
        }

        if (typeof soundManager !== 'undefined') soundManager.playReflect();
        if (mode === 'kaleidoscope') {
            this.createDetailedHitEffect(cx, cy, 'reflect', 'crystal_shatter');
        } else {
            this.createDetailedHitEffect(cx, cy, 'reflect');
        }
        this.damageObstacleOptical(obstacle, obstacleIndex, cx, cy, explosionId, 'damage');
        return true;
    },

    damageObstacleOptical(obstacle, obstacleIndex, x, y, explosionId, hitFx) {
        obstacle.health--;
        if (obstacle.health <= 0) {
            obstacleManager.removeObstacle(obstacleIndex);
            this.createDetailedHitEffect(x, y, 'destroy', explosionId || 'crystal_shatter', obstacle);
            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
            if (typeof game !== 'undefined') game.score += 12;
        } else {
            this.createDetailedHitEffect(x, y, hitFx || 'damage');
        }
    },

    createExplosion(x, y, presetId, options) {
        const id = presetId || 'default';
        const opts = Object.assign({ silent: true }, options || {});
        // Hit pops stay compact; death bursts keep full preset size.
        if (id === 'small_pop' && opts.scale == null) opts.scale = 0.55;
        if (typeof explosionSystem !== 'undefined' && explosionSystem.play) {
            explosionSystem.play(id, x, y, opts);
            return;
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            const n = Math.max(3, Math.round(6 * (opts.scale != null ? opts.scale : 1)));
            graphicsManager.createHitEffect(x, y, n, 'var(--color-explosion)');
            return;
        }
        if (game && game.renderManager && game.renderManager.ctx) {
            const ctx = game.renderManager.ctx;
            let color = '#ffffff';
            try {
                color = getComputedStyle(document.documentElement).getPropertyValue('--color-highlight').trim() || color;
            } catch (e) { /* ignore */ }
            ctx.fillStyle = color;
            ctx.fillRect(x - 2, y - 2, 8, 8);
        }
    },

    createDetailedHitEffect(x, y, effectType, presetId, source) {
        if (effectType === 'destroy' && typeof explosionSystem !== 'undefined') {
            const w = source && source.width != null ? Number(source.width) : 14;
            const h = source && source.height != null ? Number(source.height) : 14;
            const size = Math.max(w, h);
            // Spread with the rock; particle pixels stay fine on big ones.
            const spread = Math.min(1.85, 0.75 + size / 26);
            const pSizeMul = size >= 16 ? Math.max(0.5, 12 / size) : 0.85;
            explosionSystem.play(presetId || 'asteroid_burst', x, y, {
                silent: true,
                scale: spread,
                particleSizeScale: pSizeMul,
                width: w,
                height: h
            });
            return;
        }
        // Light hits: small particle flecks only — no stacked ring burst.
        if (typeof graphicsManager !== 'undefined') {
            switch (effectType) {
                case 'reflect':
                    graphicsManager.createHitEffect(x, y, 4, 'var(--color-highlight)');
                    break;
                case 'damage':
                    graphicsManager.createHitEffect(x, y, 5, 'var(--color-warning)');
                    break;
                case 'destroy':
                    graphicsManager.createHitEffect(x, y, 8, 'var(--color-explosion)');
                    break;
                case 'impact':
                    graphicsManager.createHitEffect(x, y, 3, 'var(--color-text)');
                    break;
                default:
                    graphicsManager.createHitEffect(x, y, 4);
            }
        }
        // Tiny ring only when an explicit preset is requested.
        if (presetId) {
            this.createExplosion(x, y, presetId, { scale: 0.45 });
        }
    },
});
