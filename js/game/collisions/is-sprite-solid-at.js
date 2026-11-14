"use strict";

// CollisionManager methods, split from collisions.js.
extendClass(CollisionManager, {
    isSpriteSolidAt(obj, spriteInfo, worldX, worldY) {
        const info = spriteInfo || this.getCollisionSprite(obj);
        if (!info || !info.sprite || !info.sprite.length) return true;

        const sprite = info.sprite;
        const rows = sprite.length;
        const first = sprite[0];
        const cols = first && first.length;
        if (!cols || !rows) return true;

        const drawW = info.drawW != null ? info.drawW : obj.width;
        const drawH = info.drawH != null ? info.drawH : obj.height;
        if (!(drawW > 0) || !(drawH > 0)) return true;
        const ox = obj.x + (obj.width - drawW) / 2;
        const oy = obj.y + (obj.height - drawH) / 2;
        const lx = worldX - ox;
        const ly = worldY - oy;
        if (lx < 0 || ly < 0 || lx >= drawW || ly >= drawH) return false;

        const col = Math.floor(lx * cols / drawW);
        const row = Math.floor(ly * rows / drawH);
        if (row < 0 || col < 0 || row >= rows || col >= cols) return false;
        const line = sprite[row];
        if (!line) return false;
        return !!line[col];
    },

    isPixelSolid(obj, x, y) {
        return this.isSpriteSolidAt(obj, null, x, y);
    },

    /**
     * Bounce math for optical mirrors: keep a little lateral kick, but always
     * lock the new team's forward axis so beams never park mid-lane.
     */
    reflectShotOffObstacle(bullet, obstacle, asEnemy) {
        const fallback = asEnemy ? 5 : 6;
        const keepSpd = (typeof bulletManager !== 'undefined' && bulletManager.getBulletMoveSpeed)
            ? bulletManager.getBulletMoveSpeed(bullet, fallback)
            : Math.abs(Number(bullet.speed) || fallback);
        let vx = Number(bullet.vx);
        let vy = Number(bullet.vy);
        if (!(Math.hypot(vx, vy) > 0.05)) {
            vx = Number(bullet._sweepDx) || 0;
            vy = Number(bullet._sweepDy) || 0;
        }
        if (Math.hypot(vx, vy) < 0.05) {
            vx = 0;
            vy = asEnemy ? keepSpd : -keepSpd;
        }
        const tip = this.shotImpactXY(bullet);
        const ocx = obstacle.x + obstacle.width / 2;
        const ocy = obstacle.y + obstacle.height / 2;
        const rx = tip.x - ocx;
        const ry = tip.y - ocy;
        let nx = 0;
        let ny = 0;
        if (Math.abs(rx) > Math.abs(ry)) nx = rx > 0 ? 1 : -1;
        else ny = ry > 0 ? 1 : -1;
        const dot = vx * nx + vy * ny;
        vx -= 2 * dot * nx;
        vy -= 2 * dot * ny;
        const forward = asEnemy ? 1 : -1;
        let lat = vx;
        // Forward must dominate after a bounce.
        if (Math.abs(vy) < keepSpd * 0.55 || Math.sign(vy || forward) !== Math.sign(forward)) {
            lat = Math.max(-keepSpd * 0.55, Math.min(keepSpd * 0.55, lat));
            const rem = Math.sqrt(Math.max(0.01, keepSpd * keepSpd - lat * lat));
            vx = lat;
            vy = forward * rem;
        } else {
            const len = Math.hypot(vx, vy) || 1;
            vx = (vx / len) * keepSpd;
            vy = (vy / len) * keepSpd;
        }
        bullet.isEnemyShot = !!asEnemy;
        bullet.angle = undefined;
        bullet.moveSpeed = keepSpd;
        bullet.speed = keepSpd;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.reflected = true;
    },

    reflectBullet(bullet, obstacle) {
        this.reflectShotOffObstacle(bullet, obstacle, false);
    },

    reflectEnemyBullet(bullet, obstacle) {
        this.reflectShotOffObstacle(bullet, obstacle, true);
    },

    /**
     * Bulwark hit: no damage, the shot shoves the block along its flight
     * direction (heavier blocks move less, stronger shots more).
     */
    pushObstacleByBullet(obstacle, bullet) {
        let dx = bullet._sweepDx || 0;
        let dy = bullet._sweepDy || 0;
        const len = Math.hypot(dx, dy);
        if (len < 0.001) {
            dx = 0;
            dy = -1;
        } else {
            dx /= len;
            dy /= len;
        }
        const mass = Math.max(0.5, (obstacle.width * obstacle.height) / 196);
        const power = Math.max(0.5, Math.min(3, (bullet.damage != null ? bullet.damage : 10) / 10));
        const k = 0.35 * power / mass;
        obstacle.pushVx = Math.max(-2.5, Math.min(2.5, (obstacle.pushVx || 0) + dx * k));
        obstacle.pushVy = Math.max(-2.5, Math.min(2.5, (obstacle.pushVy || 0) + dy * k));
        obstacle.pushFlashMs = 120;
        const tip = this.shotImpactXY(bullet);
        this.createDetailedHitEffect(tip.x, tip.y, 'impact');
        if (typeof soundManager !== 'undefined') soundManager.playHit();
    },

    checkBulletObstacleCollisions(gameState) {
        const bullets = bulletManager.getBullets();
        const enemyBullets = bulletManager.getEnemyBullets();
        const obstacles = obstacleManager.getObstacles();

        // Check player bullets vs obstacles
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet) continue;
            if (!(Number(bullet.vy) < 0) && !(Number(bullet._sweepDy) < 0)) continue;
            if (typeof bulletManager !== 'undefined' && bulletManager.playerShotSpawnBlocked
                && bulletManager.playerShotSpawnBlocked(bullet)) continue;
            const bTop = bullet.y - 20;
            const bBot = bullet.y + (bullet.height || 0) + 20;
            for (let j = obstacles.length - 1; j >= 0; j--) {
                const obstacle = obstacles[j];
                if (obstacle.y > bBot || obstacle.y + (obstacle.height || 0) < bTop) continue;
                if (this.isColliding(bullet, obstacle)) {
                    if (obstacle.isFog || bullet._ignoreObstacle === obstacle) continue;
                    const tip = this.shotImpactXY(bullet);
                    const bulletX = tip.x;
                    const bulletY = tip.y;
                    const explosionId = obstacle.explosionId || 'asteroid_burst';
                    const optical = obstacle.opticalMode || 'none';
                    if (optical === 'mirror' || optical === 'prism' || optical === 'kaleidoscope') {
                        const handled = this.applyOpticalBulletHit(bullet, obstacle, 'player', i, j);
                        if (handled) break;
                    }

                    if (obstacle.pushable) {
                        this.pushObstacleByBullet(obstacle, bullet);
                        bulletManager.removeBullet(i);
                        break;
                    }

                    if (obstacle.reflectsShots) {
                        this.reassignShotTeam(i, 'player', true, obstacle);
                        if (typeof soundManager !== 'undefined') soundManager.playReflect();
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId, obstacle);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
                        } else {
                            this.createDetailedHitEffect(bulletX, bulletY, 'reflect');
                        }
                    } else if (obstacle.isDestructible) {
                        const hx = bulletX;
                        const hy = bulletY;
                        // Bomb crates: detonate immediately on shot contact.
                        if (obstacle.isCrate && obstacle.trap === 'bomb') {
                            bulletManager.removeBullet(i);
                            if (typeof pickupManager !== 'undefined' && pickupManager.trapBlast) {
                                pickupManager.trapBlast(hx, hy);
                            }
                            // Spent: removeObstacle → spawnPowerUp must not drop loot or re-blast.
                            obstacle._trapSpent = true;
                            obstacle.trap = null;
                            obstacleManager.removeObstacle(j);
                            game.score += 10;
                            break;
                        }
                        // Weapon-scaled damage plus splash to nearby rocks.
                        const rockDmg = obstacleManager.bulletRockDamage(bullet);
                        const splash = obstacleManager.bulletSplashRadius(bullet);
                        const destroyed = obstacleManager.damageObstacle(j, rockDmg, hx, hy);
                        obstacleManager.splashObstacles(hx, hy, splash, Math.max(1, Math.ceil(rockDmg * 0.6)), destroyed ? null : obstacle);
                        if (destroyed) {
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId, obstacle);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.85);
                        } else {
                            this.createDetailedHitEffect(bulletX, bulletY, 'damage');
                            if (typeof soundManager !== 'undefined') soundManager.playHit();
                        }

                        // Remove bullet
                        bulletManager.removeBullet(i);

                        // Award points for destruction
                        game.score += 10;
                    } else {
                        // Non-destructible obstacle - tip pop then cull
                        this.destroyShotAt('player', i, 'impact');
                        if (typeof soundManager !== 'undefined') soundManager.playHit();
                    }

                    break;
                }
            }
        }

        // Check enemy bullets vs obstacles
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            const bTop = bullet.y - 20;
            const bBot = bullet.y + (bullet.height || 0) + 20;
            for (let j = obstacles.length - 1; j >= 0; j--) {
                const obstacle = obstacles[j];
                if (obstacle.y > bBot || obstacle.y + (obstacle.height || 0) < bTop) continue;
                if (this.isColliding(bullet, obstacle)) {
                    if (obstacle.isFog || bullet._ignoreObstacle === obstacle) continue;
                    const tip = this.shotImpactXY(bullet);
                    const bulletX = tip.x;
                    const bulletY = tip.y;
                    const explosionId = obstacle.explosionId || 'asteroid_burst';
                    const optical = obstacle.opticalMode || 'none';

                    if (optical === 'mirror' || optical === 'prism' || optical === 'kaleidoscope') {
                        const handled = this.applyOpticalBulletHit(bullet, obstacle, 'enemy', i, j);
                        if (handled) break;
                    }

                    if (obstacle.pushable) {
                        this.pushObstacleByBullet(obstacle, bullet);
                        bulletManager.removeEnemyBullet(i);
                        break;
                    }

                    if (obstacle.reflectsShots) {
                        this.reassignShotTeam(i, 'enemy', false, obstacle);
                        if (typeof soundManager !== 'undefined') soundManager.playReflect();
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId, obstacle);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
                        } else {
                            this.createDetailedHitEffect(bulletX, bulletY, 'reflect');
                        }
                    } else if (obstacle.isDestructible) {
                        const hx = bulletX;
                        const hy = bulletY;
                        if (obstacle.isCrate && obstacle.trap === 'bomb') {
                            bulletManager.removeEnemyBullet(i);
                            if (typeof pickupManager !== 'undefined' && pickupManager.trapBlast) {
                                pickupManager.trapBlast(hx, hy);
                            }
                            obstacle._trapSpent = true;
                            obstacle.trap = null;
                            obstacleManager.removeObstacle(j);
                            break;
                        }
                        // Destroy obstacle
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId, obstacle);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.85);
                        } else if (typeof soundManager !== 'undefined') {
                            soundManager.playHit();
                        }

                        // Remove bullet
                        bulletManager.removeEnemyBullet(i);
                    } else {
                        // Non-destructible — tip impact only (never full small_pop).
                        this.destroyShotAt('enemy', i, 'impact');
                        if (typeof soundManager !== 'undefined') soundManager.playHit();
                    }

                    break;
                }
            }
        }
    },
});
