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
        const cx = bullet.x + (bullet.width || 0) / 2;
        const cy = bullet.y + (bullet.height || 0) / 2;
        const explosionId = obstacle.explosionId || 'crystal_shatter';

        if (mode === 'mirror') {
            if (sourceSide === 'player') {
                const reflectedBullet = bullet;
                this.reflectBullet(reflectedBullet, obstacle);
                if (reflectedBullet.angle === undefined) {
                    reflectedBullet.speed = Math.abs(reflectedBullet.speed || 8);
                }
                reflectedBullet.y += 5;
                reflectedBullet.reflected = true;
                bulletManager.getEnemyBullets().push(reflectedBullet);
                bulletManager.removeBullet(bulletIndex);
            } else {
                const reflectedBullet = bullet;
                this.reflectEnemyBullet(reflectedBullet, obstacle);
                if (reflectedBullet.angle === undefined) {
                    reflectedBullet.speed = -Math.abs(reflectedBullet.speed || 5);
                }
                reflectedBullet.y -= 10;
                reflectedBullet.reflected = true;
                bulletManager.getBullets().push(reflectedBullet);
                bulletManager.removeEnemyBullet(bulletIndex);
            }
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

        // Mirror team for reflected shards (player hit → enemy shards, and vice versa)
        const toEnemy = sourceSide === 'player';
        for (let s = 0; s < splitCount; s++) {
            const t = splitCount === 1 ? 0 : (s / (splitCount - 1)) - 0.5;
            const ang = baseAngle + t * angleSpread * 2;
            const shard = {
                x: cx - (bullet.width || 3) / 2,
                y: cy - (bullet.height || 8) / 2,
                width: bullet.width || 3,
                height: bullet.height || 8,
                speed: baseSpeed * (toEnemy ? 1 : -1),
                angle: ang,
                damage: Math.max(1, Math.round(baseDamage)),
                color: bullet.color || (mode === 'kaleidoscope' ? 'var(--color-highlight)' : 'var(--color-accent)'),
                type: bullet.type || 'laser_beam',
                reflected: true,
                lightRadius: bullet.lightRadius || 50,
                lightIntensity: 1.2,
                lightColor: bullet.lightColor || 'var(--color-highlight)'
            };
            // Use angled movement: ensure angle is set and speed is magnitude
            shard.speed = baseSpeed;
            if (toEnemy) {
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
            this.createDetailedHitEffect(x, y, 'destroy', explosionId || 'crystal_shatter');
            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
            if (typeof game !== 'undefined') game.score += 12;
        } else {
            this.createDetailedHitEffect(x, y, hitFx || 'damage');
        }
    },

    createExplosion(x, y, presetId) {
        const id = presetId || 'default';
        if (typeof explosionSystem !== 'undefined' && explosionSystem.play) {
            explosionSystem.play(id, x, y, { silent: true });
            return;
        }
        if (typeof graphicsManager !== 'undefined' && graphicsManager.createHitEffect) {
            graphicsManager.createHitEffect(x, y, 14, 'var(--color-explosion)');
            graphicsManager.createHitEffect(x, y, 8, 'var(--color-highlight)');
            return;
        }
        if (game && game.renderManager && game.renderManager.ctx) {
            const ctx = game.renderManager.ctx;
            let color = '#ffffff';
            try {
                color = getComputedStyle(document.documentElement).getPropertyValue('--color-highlight').trim() || color;
            } catch (e) { /* ignore */ }
            ctx.fillStyle = color;
            ctx.fillRect(x - 5, y - 5, 30, 30);
        }
    },

    createDetailedHitEffect(x, y, effectType, presetId) {
        if (effectType === 'destroy' && typeof explosionSystem !== 'undefined') {
            explosionSystem.play(presetId || 'asteroid_burst', x, y, { silent: true });
            return;
        }
        if (typeof graphicsManager !== 'undefined') {
            switch (effectType) {
                case 'reflect':
                    graphicsManager.createHitEffect(x, y, 8, 'var(--color-highlight)');
                    break;
                case 'damage':
                    graphicsManager.createHitEffect(x, y, 10, 'var(--color-warning)');
                    break;
                case 'destroy':
                    graphicsManager.createHitEffect(x, y, 15, 'var(--color-explosion)');
                    break;
                case 'impact':
                    graphicsManager.createHitEffect(x, y, 6, 'var(--color-text)');
                    break;
                default:
                    graphicsManager.createHitEffect(x, y, 8);
            }
        }

        this.createExplosion(x, y, presetId || 'small_pop');
    },
});
