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
}
