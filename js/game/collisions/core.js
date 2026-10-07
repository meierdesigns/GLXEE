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
        this.checkTerrainCollisions(gameState);
    }

    /**
     * Canyon walls in scrolling stages are solid: the ship is pushed back
     * into the corridor and takes damage (with a short grace period), and
     * any shot that reaches a wall bursts on it.
     */
    checkTerrainCollisions(gameState) {
        if (typeof obstacleManager === 'undefined' || !obstacleManager.terrainWallsOver) return;
        const W = (gameState && gameState.width) || 240;
        const cell = (obstacleManager.terrainCell && obstacleManager.terrainCell()) || 1;
        const player = playerManager.getPosition();
        if (player) {
            const walls = obstacleManager.terrainWallsOver(player.y + 2, player.y + player.height - 2, W);
            if (walls) {
                let hitX = null;
                let hitSide = -1;
                if (player.x < walls.left) {
                    hitX = walls.left;
                    hitSide = 0;
                    player.x = walls.left + 1;
                } else if (player.x + player.width > walls.right) {
                    hitX = walls.right;
                    hitSide = 1;
                    player.x = walls.right - player.width - 1;
                }
                if (typeof window !== 'undefined' && window.combatVoxels && window.combatVoxels.snapEntity) {
                    window.combatVoxels.snapEntity(player);
                }
                const now = Date.now();
                if (hitX != null && hitSide >= 0 && now - (this._terrainHitAt || 0) > 600) {
                    this._terrainHitAt = now;
                    const hy = player.y + player.height / 2;
                    const wr = obstacleManager.terrainRowAtY(hy);
                    const cells = obstacleManager.terrainWallCells
                        ? obstacleManager.terrainWallCells(wr, W) : null;
                    const thick = cells ? (hitSide ? cells.right : cells.left) : 2;
                    // Carved / missing wall: no scrape damage. Thin lip: light tap.
                    if (thick > 0) {
                        const dmg = thick <= 1 ? 3 : 8;
                        this.createDetailedHitEffect(hitX, hy, 'impact');
                        if (typeof soundManager !== 'undefined') soundManager.playHurt();
                        if (playerManager.takeDamage(dmg) && typeof game !== 'undefined') game.gameOver();
                        // Scraping the wall also chips it so you can grind an escape.
                        if (obstacleManager.damageTerrain) {
                            obstacleManager.damageTerrain(hy, hitSide, { power: 4, radius: 1, vsMetal: 2 });
                        }
                    }
                }
            }
        }
        // Shots chip the wall they hit; player shots that break a cell score.
        // Also carve when a shot is within one cell of the wall lip (VOXEL
        // stepping often lands on the corridor edge without entering the rock).
        const burst = (list, remove, byPlayer) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (!b) continue;
                const cx = b.x + (b.width || 0) / 2;
                const cy = b.y + (b.height || 0) / 2;
                const w = obstacleManager.terrainWallsAtY(cy, W);
                if (!w) continue;
                let side = -1;
                if (cx <= w.left + cell) side = 0;
                else if (cx >= w.right - cell) side = 1;
                else continue;
                // Skip if that side is already fully carved away.
                const wrCheck = obstacleManager.terrainRowAtY(cy);
                const cells = obstacleManager.terrainWallCells
                    ? obstacleManager.terrainWallCells(wrCheck, W) : null;
                if (cells && ((side === 0 && cells.left <= 0) || (side === 1 && cells.right <= 0))) {
                    continue;
                }
                const profile = obstacleManager.terrainWeaponProfile(b);
                const row = wrCheck;
                if (profile.pierce && b._terrainRow === row) continue;
                b._terrainRow = row;
                if (!profile.pierce) remove(i);
                const broke = obstacleManager.damageTerrain(cy, side, profile);
                this.createDetailedHitEffect(side ? w.right : w.left, cy, broke ? 'destroy' : 'impact');
                if (broke && byPlayer && typeof game !== 'undefined') {
                    const mat = obstacleManager.terrainMaterial(row, side);
                    game.score += (mat.score || 1) * broke;
                }
                if (typeof soundManager !== 'undefined') soundManager.playHit();
            }
        };
        burst(bulletManager.getBullets(), (i) => bulletManager.removeBullet(i), true);
        burst(bulletManager.getEnemyBullets(), (i) => bulletManager.removeEnemyBullet(i), false);
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
                graphicsManager.createHitEffect(sx, sy, 6);
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
                        graphicsManager.createHitEffect(sx, sy, 4);
                    }
                    if (killedByHit) {
                        const killed = sides[j];
                        if (typeof explosionSystem !== 'undefined' && explosionSystem.play) {
                            explosionSystem.play('small_pop', sx, sy, {
                                width: killed.width,
                                height: killed.height,
                                silent: true,
                                ship: killed,
                                voxelPower: 0.85,
                                scale: 0.75
                            });
                        }
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
                this.createExplosion(enemyX, enemyY, enemyDefeated ? enemyExplosionId : 'small_pop',
                    enemyDefeated ? null : { scale: 0.45 });

                // Create hit particles
                if (typeof graphicsManager !== 'undefined' && !enemyDefeated) {
                    graphicsManager.createHitEffect(enemyX, enemyY, 5);
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
                    graphicsManager.createHitEffect(playerX, playerY, 4);
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

    /**
     * Shot vs shot, swept over this frame: thin fast shots move further per
     * frame than their own length and used to pass through each other
     * without ever overlapping, so clashes/reflections rarely triggered.
     * Player shots move up, enemy shots down; stretch each box back along
     * its path by one frame of travel, and give thin shots a 2 px minimum.
     */
    shotsCrossed(pb, eb) {
        const minW = 2;
        const pw = Math.max(minW, pb.width || 0);
        const ew = Math.max(minW, eb.width || 0);
        const px = pb.x + (pb.width || 0) / 2 - pw / 2;
        const ex = eb.x + (eb.width || 0) / 2 - ew / 2;
        if (!(px < ex + ew && px + pw > ex)) return false;
        const pTop = pb.y;
        const pBot = pb.y + (pb.height || 0) + Math.abs(pb.speed || 0);
        const eTop = eb.y - Math.abs(eb.speed || 0);
        const eBot = eb.y + (eb.height || 0);
        return pTop < eBot && pBot > eTop;
    }

    checkPlayerBulletEnemyBulletCollisions(gameState) {
        const playerBullets = bulletManager.getBullets();
        const enemyBullets = bulletManager.getEnemyBullets();

        for (let i = playerBullets.length - 1; i >= 0; i--) {
            for (let j = enemyBullets.length - 1; j >= 0; j--) {
                if (this.shotsCrossed(playerBullets[i], enemyBullets[j])) {
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
