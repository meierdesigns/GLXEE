"use strict";

// CollisionManager methods, split from collisions.js.
extendClass(CollisionManager, {
    /**
     * Redirect the clash in the selected shot's travel direction.
     * winnerSide 'player' → both become upward player shots;
     * 'enemy' → both become downward enemy shots.
     */
    redirectLaserClash(playerBullet, enemyBullet, winnerSide, hitX, hitY) {
        const combinedDamage = Math.max(
            playerBullet.damage != null ? playerBullet.damage : 10,
            enemyBullet.damage != null ? enemyBullet.damage : 10
        ) + Math.floor(Math.min(
            playerBullet.damage != null ? playerBullet.damage : 10,
            enemyBullet.damage != null ? enemyBullet.damage : 10
        ) * 0.35);

        const speed = Math.max(
            Math.abs(playerBullet.speed || 6),
            Math.abs(enemyBullet.speed || 6)
        );

        // Remove originals by identity from arrays
        const pList = bulletManager.getBullets();
        const eList = bulletManager.getEnemyBullets();
        const pi = pList.indexOf(playerBullet);
        const ei = eList.indexOf(enemyBullet);
        if (pi !== -1) bulletManager.removeBullet(pi);
        if (ei !== -1) bulletManager.removeEnemyBullet(ei);

        const makeBeam = (dx, side) => {
            const w = Math.max(playerBullet.width || 3, enemyBullet.width || 3);
            const h = Math.max(playerBullet.height || 12, enemyBullet.height || 12);
            if (side === 'player') {
                return {
                    x: hitX - w / 2 + dx,
                    y: hitY - h - 2,
                    width: w,
                    height: h,
                    speed: speed,
                    damage: combinedDamage,
                    color: playerBullet.color || '#808080',
                    type: playerBullet.type || 'laser_beam',
                    reflected: true,
                    lightRadius: Math.max(playerBullet.lightRadius || 60, 60),
                    lightIntensity: 1.4,
                    lightColor: playerBullet.lightColor || '#808080'
                };
            }
            return {
                x: hitX - w / 2 + dx,
                y: hitY + 2,
                width: w,
                height: h,
                speed: speed,
                damage: combinedDamage,
                color: enemyBullet.color || '#808080',
                type: enemyBullet.type || 'enemy_laser',
                reflected: true,
                lightRadius: Math.max(enemyBullet.lightRadius || 50, 50),
                lightIntensity: 1.4,
                lightColor: enemyBullet.lightColor || '#808080'
            };
        };

        if (winnerSide === 'player') {
            pList.push(makeBeam(-4, 'player'));
            pList.push(makeBeam(4, 'player'));
            game.score += 8;
        } else {
            eList.push(makeBeam(-4, 'enemy'));
            eList.push(makeBeam(4, 'enemy'));
        }

        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.createHitEffect(hitX, hitY, 10, 'var(--current-primary)');
        }
        this.createDetailedHitEffect(hitX, hitY, 'reflect');
        if (typeof soundManager !== 'undefined') soundManager.playReflect();
    },

    checkObstaclePlayerCollisions(gameState) {
        const obstacles = obstacleManager.getObstacles();
        const player = playerManager.getPosition();
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (obstacles[i].isFog) continue;
            if (this.isColliding(obstacles[i], player)) {
                // Store positions for particles
                const playerX = player.x + player.width / 2;
                const playerY = player.y + player.height / 2;
                const obstacleX = obstacles[i].x + obstacles[i].width / 2;
                const obstacleY = obstacles[i].y + obstacles[i].height / 2;
                const dmg = Math.max(1, obstacles[i].collisionDamage != null ? obstacles[i].collisionDamage : 15);
                const explosionId = obstacles[i].explosionId || 'asteroid_burst';
                
                // Remove obstacle
                obstacleManager.removeObstacle(i);
                
                // Damage player
                const playerDefeated = playerManager.takeDamage(dmg);
                
                this.createDetailedHitEffect(obstacleX, obstacleY, 'destroy', explosionId);
                if (typeof graphicsManager !== 'undefined') {
                    graphicsManager.createHitEffect(playerX, playerY, 10);
                }

                if (typeof soundManager !== 'undefined') soundManager.playHurt();
                
                if (playerDefeated) {
                    game.gameOver();
                }
                break;
            }
        }
    },

    checkObstacleEnemyCollisions(gameState) {
        const obstacles = obstacleManager.getObstacles();
        const enemy = enemyManager.getEnemy();
        
        if (!enemy || enemyManager.isExploding()) return;
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (obstacles[i].isFog) continue;
            if (this.isColliding(obstacles[i], enemy)) {
                // Store positions for particles
                const enemyX = enemy.x + enemy.width / 2;
                const enemyY = enemy.y + enemy.height / 2;
                const obstacleX = obstacles[i].x + obstacles[i].width / 2;
                const obstacleY = obstacles[i].y + obstacles[i].height / 2;
                const dmg = Math.max(1, obstacles[i].collisionDamage != null ? obstacles[i].collisionDamage : 20);
                const explosionId = obstacles[i].explosionId || 'asteroid_burst';
                
                // Remove obstacle
                obstacleManager.removeObstacle(i);
                
                // Damage enemy
                const enemyDefeated = enemyManager.takeDamage(dmg);
                
                this.createDetailedHitEffect(obstacleX, obstacleY, 'destroy', explosionId);
                if (typeof graphicsManager !== 'undefined') {
                    graphicsManager.createHitEffect(enemyX, enemyY, 12);
                }

                if (typeof soundManager !== 'undefined') {
                    if (enemyDefeated) soundManager.playKill();
                    else soundManager.playHit();
                }
                
                if (enemyDefeated) {
                    // Victory is handled by ObjectiveManager after champion kill / explosion
                }
                break;
            }
        }
    },

    isColliding(obj1, obj2) {
        const b1 = this.getCollisionBounds(obj1);
        const b2 = this.getCollisionBounds(obj2);
        const basicCollision = b1.x < b2.x + b2.width &&
                               b1.x + b1.width > b2.x &&
                               b1.y < b2.y + b2.height &&
                               b1.y + b1.height > b2.y;

        if (!basicCollision) return false;

        const s1 = this.getCollisionSprite(obj1);
        const s2 = this.getCollisionSprite(obj2);
        if (s1 && s2) {
            return this.pixelPerfectCollision(obj1, obj2, s1, s2);
        }
        if (s1) {
            return this.spriteOverlapsRect(obj1, s1, b2);
        }
        if (s2) {
            return this.spriteOverlapsRect(obj2, s2, b1);
        }

        return true;
    },

    getCollisionBounds(obj) {
        if (!obj) return { x: 0, y: 0, width: 0, height: 0 };
        const c = obj.collision;
        if (c && (c.insetL || c.insetT || c.insetR || c.insetB)) {
            const insetL = c.insetL || 0;
            const insetT = c.insetT || 0;
            const insetR = c.insetR || 0;
            const insetB = c.insetB || 0;
            return {
                x: obj.x + insetL,
                y: obj.y + insetT,
                width: Math.max(1, obj.width - insetL - insetR),
                height: Math.max(1, obj.height - insetT - insetB)
            };
        }
        return {
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height
        };
    },

    getCollisionSprite(obj) {
        if (!obj) return null;
        if (obj.collision && obj.collision.sprite && obj.collision.sprite.length) {
            return obj.collision;
        }
        if (obj.sprite && obj.sprite.length && obj.colors) {
            return {
                sprite: obj.sprite,
                colors: obj.colors,
                drawW: obj.width,
                drawH: obj.height,
                insetL: 0,
                insetT: 0,
                insetR: 0,
                insetB: 0
            };
        }
        return null;
    },

    hasSprite(obj) {
        return !!this.getCollisionSprite(obj);
    },

    pixelPerfectCollision(obj1, obj2, s1, s2) {
        const left = Math.max(obj1.x, obj2.x);
        const right = Math.min(obj1.x + obj1.width, obj2.x + obj2.width);
        const top = Math.max(obj1.y, obj2.y);
        const bottom = Math.min(obj1.y + obj1.height, obj2.y + obj2.height);

        if (left >= right || top >= bottom) return false;

        const step = 0.5;
        for (let y = top; y < bottom; y += step) {
            for (let x = left; x < right; x += step) {
                if (this.isSpriteSolidAt(obj1, s1, x, y) && this.isSpriteSolidAt(obj2, s2, x, y)) {
                    return true;
                }
            }
        }
        return false;
    },

    spriteOverlapsRect(obj, spriteInfo, rect) {
        const left = Math.max(obj.x, rect.x);
        const right = Math.min(obj.x + obj.width, rect.x + rect.width);
        const top = Math.max(obj.y, rect.y);
        const bottom = Math.min(obj.y + obj.height, rect.y + rect.height);
        if (left >= right || top >= bottom) return false;

        const step = 0.5;
        for (let y = top; y < bottom; y += step) {
            for (let x = left; x < right; x += step) {
                if (this.isSpriteSolidAt(obj, spriteInfo, x, y)) return true;
            }
        }
        return false;
    },
});
