"use strict";

// Collision detection and management
class CollisionManager {
    constructor() {
        // Empty constructor
    }

    checkCollisions(gameState) {
        this.checkBulletEnemyCollisions(gameState);
        this.checkBulletSideEnemyCollisions(gameState);
        this.checkEnemyBulletPlayerCollisions(gameState);
        this.checkPlayerBulletEnemyBulletCollisions(gameState);
        this.checkObstaclePlayerCollisions(gameState);
        this.checkObstacleEnemyCollisions(gameState);
        this.checkBulletObstacleCollisions(gameState);
        this.checkBomberPlayerCollisions(gameState);
    }

    checkBomberPlayerCollisions(gameState) {
        if (!enemyManager.getSideEnemies || !playerManager.getPosition) return;
        if (typeof game !== 'undefined' && game.cheats && game.cheats.godMode) return;
        const player = playerManager.getPosition();
        if (!player) return;
        const sides = enemyManager.getSideEnemies();
        for (let j = sides.length - 1; j >= 0; j--) {
            const side = sides[j];
            if (!side || side.role !== 'bomber') continue;
            if (!this.isColliding(side, player)) continue;
            const sx = side.x + side.width / 2;
            const sy = side.y + side.height / 2;
            const dmg = side.bomberDamage != null ? side.bomberDamage : 18;
            if (typeof playerManager.takeDamage === 'function') {
                playerManager.takeDamage(dmg);
            }
            if (typeof soundManager !== 'undefined') soundManager.playHurt();
            if (typeof graphicsManager !== 'undefined') {
                graphicsManager.createHitEffect(sx, sy, 14);
            }
            const killed = sides[j];
            sides.splice(j, 1);
            if (typeof soundManager !== 'undefined') soundManager.playExplosion(1.1);
            if (enemyManager.notifyKill) {
                enemyManager.notifyKill({
                    type: killed.type,
                    entryId: killed.entryId,
                    faction: killed.faction,
                    enemyClass: killed.enemyClass,
                    cluster: killed.cluster,
                    champion: false,
                    x: sx,
                    y: sy
                });
            }
        }
    }

    checkBulletSideEnemyCollisions(gameState) {
        if (!enemyManager.getSideEnemies) return;
        const bullets = bulletManager.getBullets();
        const sides = enemyManager.getSideEnemies();
        for (let i = bullets.length - 1; i >= 0; i--) {
            for (let j = sides.length - 1; j >= 0; j--) {
                if (this.isColliding(bullets[i], sides[j])) {
                    const sx = sides[j].x + sides[j].width / 2;
                    const sy = sides[j].y + sides[j].height / 2;
                    bulletManager.removeBullet(i);
                    const killedByHit = enemyManager.damageSideEnemy
                        ? enemyManager.damageSideEnemy(sides[j], 10)
                        : ((sides[j].health -= 10), sides[j].health <= 0);
                    if (typeof soundManager !== 'undefined') {
                        if (killedByHit) soundManager.playKill();
                        else soundManager.playHit();
                    }
                    if (typeof graphicsManager !== 'undefined') {
                        graphicsManager.createHitEffect(sx, sy, 8);
                    }
                    if (killedByHit) {
                        const killed = sides[j];
                        sides.splice(j, 1);
                        if (typeof enemyManager !== 'undefined' && enemyManager.notifyKill) {
                            enemyManager.notifyKill({
                                type: killed.type,
                                entryId: killed.entryId,
                                faction: killed.faction,
                                enemyClass: killed.enemyClass,
                                cluster: killed.cluster,
                                champion: false,
                                x: sx,
                                y: sy
                            });
                        }
                    }
                    return;
                }
            }
        }
    }

    checkBulletEnemyCollisions(gameState) {
        const bullets = bulletManager.getBullets();
        const enemy = enemyManager.getEnemy();
        
        if (!enemy || enemyManager.isExploding()) return;
        
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (this.isColliding(bullets[i], enemy)) {
                // Store enemy position before damage
                const enemyX = enemy.x + enemy.width / 2;
                const enemyY = enemy.y + enemy.height / 2;
                
                // Damage enemy (use bullet damage or instant kill cheat)
                let damage = 10; // Default damage
                if (bullets[i] && bullets[i].damage !== undefined) {
                    damage = bullets[i].damage;
                }
                if (game.cheats && game.cheats.instantKill) {
                    damage = 999; // Instant kill
                }

                // Remove bullet after reading damage
                bulletManager.removeBullet(i);

                const enemyDefeated = enemyManager.takeDamage(damage);
                
                if (typeof soundManager !== 'undefined') {
                    if (enemyDefeated) soundManager.playKill(1.2);
                    else soundManager.playHit();
                }
                
                // Create explosion effect
                let enemyExplosionId = 'default';
                if (typeof enemyConfigManager !== 'undefined' && enemy) {
                    const typeId = enemy.type || enemy.enemyType;
                    const cfg = enemyConfigManager.getConfig(typeId);
                    if (cfg && cfg.explosionId) enemyExplosionId = cfg.explosionId;
                }
                this.createExplosion(enemyX, enemyY, enemyDefeated ? enemyExplosionId : 'small_pop');
                
                // Create hit particles
                if (typeof graphicsManager !== 'undefined' && !enemyDefeated) {
                    graphicsManager.createHitEffect(enemyX, enemyY, 12);
                }
                
                // Enemy will start exploding, victory will be shown after explosion
                // No need to call game.playerWins() here anymore
                break;
            }
        }
    }

    checkEnemyBulletPlayerCollisions(gameState) {
        const enemyBullets = bulletManager.getEnemyBullets();
        const player = playerManager.getPosition();
        
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            if (this.isColliding(enemyBullets[i], player)) {
                // Store player position for particles
                const playerX = player.x + player.width / 2;
                const playerY = player.y + player.height / 2;
                
                // Damage player (use bullet damage or god mode cheat)
                let damage = 10; // Default damage
                if (enemyBullets[i] && enemyBullets[i].damage !== undefined) {
                    damage = enemyBullets[i].damage;
                }
                if (game.cheats && game.cheats.godMode) {
                    damage = 0; // No damage in god mode
                }

                // Remove bullet after reading damage
                bulletManager.removeEnemyBullet(i);

                const playerDefeated = playerManager.takeDamage(damage);
                
                // Create hit particles
                if (typeof graphicsManager !== 'undefined') {
                    graphicsManager.createHitEffect(playerX, playerY, 8);
                }

                if (typeof soundManager !== 'undefined' && damage > 0) {
                    soundManager.playHurt();
                }
                
                if (playerDefeated) {
                    game.gameOver();
                }
                break;
            }
        }
    }

    checkPlayerBulletEnemyBulletCollisions(gameState) {
        const playerBullets = bulletManager.getBullets();
        const enemyBullets = bulletManager.getEnemyBullets();
        
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            for (let j = enemyBullets.length - 1; j >= 0; j--) {
                if (this.isColliding(playerBullets[i], enemyBullets[j])) {
                    const pb = playerBullets[i];
                    const eb = enemyBullets[j];
                    const playerBulletX = pb.x + pb.width / 2;
                    const playerBulletY = pb.y + pb.height / 2;
                    const enemyBulletX = eb.x + eb.width / 2;
                    const enemyBulletY = eb.y + eb.height / 2;
                    const hitX = (playerBulletX + enemyBulletX) / 2;
                    const hitY = (playerBulletY + enemyBulletY) / 2;

                    const playerPower = (pb.damage != null ? pb.damage : 10);
                    const enemyPower = (eb.damage != null ? eb.damage : 10);

                    if (playerPower !== enemyPower) {
                        const weakerSide = playerPower < enemyPower ? 'player' : 'enemy';
                        const strongerSide = weakerSide === 'player' ? 'enemy' : 'player';
                        const weakerPower = Math.min(playerPower, enemyPower);
                        const strongerPower = Math.max(playerPower, enemyPower);
                        const powerGap = (strongerPower - weakerPower) / strongerPower;

                        // A smaller shot has a comeback chance. The larger the gap,
                        // the more likely the clash travels in the weaker shot's direction.
                        const weakerDirectionChance = Math.min(0.75, 0.25 + powerGap * 0.5);
                        const directionSide = Math.random() < weakerDirectionChance
                            ? weakerSide
                            : strongerSide;
                        this.redirectLaserClash(pb, eb, directionSide, hitX, hitY);
                    } else {
                        // Equal power: reflect the clash in a random direction.
                        const directionSide = Math.random() < 0.5 ? 'player' : 'enemy';
                        this.redirectLaserClash(pb, eb, directionSide, hitX, hitY);
                    }
                    
                    break;
                }
            }
        }
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    hasSprite(obj) {
        return !!this.getCollisionSprite(obj);
    }

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
    }

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
    }

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
    }

    isPixelSolid(obj, x, y) {
        return this.isSpriteSolidAt(obj, null, x, y);
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }
}

// Global collision manager instance
const collisionManager = new CollisionManager();
