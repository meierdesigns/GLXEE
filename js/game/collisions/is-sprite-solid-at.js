"use strict";

// CollisionManager methods, split from collisions.js.
extendClass(CollisionManager, {
    isSpriteSolidAt(obj, spriteInfo, worldX, worldY) {
        const info = spriteInfo || this.getCollisionSprite(obj);
        if (!info || !info.sprite || !info.sprite.length) return true;

        const sprite = info.sprite;
        const rows = sprite.length;
        const cols = sprite[0].length;
        if (!cols || !rows) return true;

        const drawW = info.drawW != null ? info.drawW : obj.width;
        const drawH = info.drawH != null ? info.drawH : obj.height;
        const ox = obj.x + (obj.width - drawW) / 2;
        const oy = obj.y + (obj.height - drawH) / 2;
        const lx = worldX - ox;
        const ly = worldY - oy;
        if (lx < 0 || ly < 0 || lx >= drawW || ly >= drawH) return false;

        const col = Math.floor(lx * cols / drawW);
        const row = Math.floor(ly * rows / drawH);
        if (row < 0 || col < 0 || row >= rows || col >= cols) return false;
        return !!sprite[row][col];
    },

    isPixelSolid(obj, x, y) {
        return this.isSpriteSolidAt(obj, null, x, y);
    },

    reflectBullet(bullet, obstacle) {
        // Calculate bullet center and obstacle center
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        const obstacleCenterX = obstacle.x + obstacle.width / 2;
        const obstacleCenterY = obstacle.y + obstacle.height / 2;
        
        // Calculate collision point relative to obstacle center
        const relativeX = bulletCenterX - obstacleCenterX;
        const relativeY = bulletCenterY - obstacleCenterY;
        
        // Determine which side of the obstacle was hit
        const absX = Math.abs(relativeX);
        const absY = Math.abs(relativeY);
        
        if (absX > absY) {
            // Hit left or right side - reflect horizontally
            if (bullet.angle !== undefined) {
                // For angled bullets, reverse the horizontal component
                bullet.angle = -bullet.angle;
            } else {
                // For straight bullets, add horizontal movement
                bullet.angle = Math.PI / 2; // 90 degrees
                bullet.speed = Math.abs(bullet.speed);
            }
        } else {
            // Hit top or bottom side - reflect vertically
            if (bullet.angle !== undefined) {
                // For angled bullets, reverse the vertical component
                bullet.angle = Math.PI - bullet.angle;
            } else {
                // For straight bullets, reverse vertical direction
                bullet.speed = -bullet.speed;
            }
        }
        
        // Ensure bullet moves away from obstacle
        if (bullet.angle !== undefined) {
            // Adjust angle to ensure proper direction
            if (relativeY > 0) { // Bullet hit from below
                bullet.angle = Math.abs(bullet.angle);
            } else { // Bullet hit from above
                bullet.angle = -Math.abs(bullet.angle);
            }
        }
    },

    reflectEnemyBullet(bullet, obstacle) {
        // Enemy bullets move straight down, so we need simpler reflection
        // Calculate bullet center and obstacle center
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        const obstacleCenterX = obstacle.x + obstacle.width / 2;
        const obstacleCenterY = obstacle.y + obstacle.height / 2;
        
        // Calculate collision point relative to obstacle center
        const relativeX = bulletCenterX - obstacleCenterX;
        const relativeY = bulletCenterY - obstacleCenterY;
        
        // Determine which side of the obstacle was hit
        const absX = Math.abs(relativeX);
        const absY = Math.abs(relativeY);
        
        if (absX > absY) {
            // Hit left or right side - reflect horizontally
            // Add horizontal movement to enemy bullet
            bullet.angle = relativeX > 0 ? Math.PI / 2 : -Math.PI / 2; // Right or left
            bullet.speed = Math.abs(bullet.speed);
        } else {
            // Hit top or bottom side - reflect vertically
            bullet.speed = -bullet.speed; // Reverse direction
        }
    },

    checkBulletObstacleCollisions(gameState) {
        const bullets = bulletManager.getBullets();
        const enemyBullets = bulletManager.getEnemyBullets();
        const obstacles = obstacleManager.getObstacles();
        
        // Check player bullets vs obstacles
        for (let i = bullets.length - 1; i >= 0; i--) {
            for (let j = obstacles.length - 1; j >= 0; j--) {
                if (this.isColliding(bullets[i], obstacles[j])) {
                    const obstacle = obstacles[j];
                    if (obstacle.isFog) continue;
                    const bullet = bullets[i];
                    const bulletX = bullet.x;
                    const bulletY = bullet.y;
                    const explosionId = obstacle.explosionId || 'asteroid_burst';
                    const optical = obstacle.opticalMode || 'none';

                    if (optical === 'mirror' || optical === 'prism' || optical === 'kaleidoscope') {
                        const handled = this.applyOpticalBulletHit(bullet, obstacle, 'player', i, j);
                        if (handled) break;
                    }
                    
                    if (obstacle.reflectsShots) {
                        // Convert reflected bullet to enemy bullet
                        const reflectedBullet = bullets[i];
                        reflectedBullet.speed = -reflectedBullet.speed; // Reverse direction
                        reflectedBullet.y += 5; // Move away from obstacle
                        reflectedBullet.reflected = true;
                        
                        // Add to enemy bullets array
                        bulletManager.getEnemyBullets().push(reflectedBullet);
                        
                        // Remove from player bullets
                        bulletManager.removeBullet(i);
                        
                        // Play reflection sound
                        if (typeof soundManager !== 'undefined') soundManager.playReflect();
                        
                        // Damage obstacle (shields are fragile)
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
                        } else {
                            this.createDetailedHitEffect(bulletX, bulletY, 'reflect');
                        }
                    } else if (obstacle.isDestructible) {
                        // Destroy obstacle
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createDetailedHitEffect(bulletX, bulletY, 'destroy', explosionId);
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
                        // Non-destructible obstacle - just remove bullet
                        bulletManager.removeBullet(i);
                        this.createDetailedHitEffect(bulletX, bulletY, 'impact');
                        if (typeof soundManager !== 'undefined') soundManager.playHit();
                    }
                    
                    break;
                }
            }
        }
        
        // Check enemy bullets vs obstacles
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            for (let j = obstacles.length - 1; j >= 0; j--) {
                if (this.isColliding(enemyBullets[i], obstacles[j])) {
                    const obstacle = obstacles[j];
                    if (obstacle.isFog) continue;
                    const bullet = enemyBullets[i];
                    const bulletX = bullet.x;
                    const bulletY = bullet.y;
                    const explosionId = obstacle.explosionId || 'asteroid_burst';
                    const optical = obstacle.opticalMode || 'none';

                    if (optical === 'mirror' || optical === 'prism' || optical === 'kaleidoscope') {
                        const handled = this.applyOpticalBulletHit(bullet, obstacle, 'enemy', i, j);
                        if (handled) break;
                    }
                    
                    if (obstacle.reflectsShots) {
                        // Convert reflected enemy bullet to player bullet
                        const reflectedBullet = enemyBullets[i];
                        reflectedBullet.speed = -reflectedBullet.speed; // Reverse direction
                        reflectedBullet.y -= 10; // Move away from obstacle
                        reflectedBullet.reflected = true;
                        
                        // Add to player bullets array
                        bulletManager.getBullets().push(reflectedBullet);
                        
                        // Remove from enemy bullets
                        bulletManager.removeEnemyBullet(i);
                        
                        // Play reflection sound
                        if (typeof soundManager !== 'undefined') soundManager.playReflect();
                        
                        // Damage obstacle
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createExplosion(bulletX, bulletY, explosionId);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.8);
                        }
                    } else if (obstacle.isDestructible) {
                        // Destroy obstacle
                        obstacle.health--;
                        if (obstacle.health <= 0) {
                            obstacleManager.removeObstacle(j);
                            this.createExplosion(bulletX, bulletY, explosionId);
                            if (typeof soundManager !== 'undefined') soundManager.playExplosion(0.85);
                        } else if (typeof soundManager !== 'undefined') {
                            soundManager.playHit();
                        }
                        
                        // Remove bullet
                        bulletManager.removeEnemyBullet(i);
                    } else {
                        // Non-destructible obstacle - just remove bullet
                        bulletManager.removeEnemyBullet(i);
                        this.createExplosion(bulletX, bulletY, 'small_pop');
                        if (typeof soundManager !== 'undefined') soundManager.playHit();
                    }
                    
                    break;
                }
            }
        }
    },
});
