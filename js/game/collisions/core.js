"use strict";

// Collision detection and management
class CollisionManager {
    constructor() {
        // Empty constructor
    }

    checkCollisions(gameState) {
        if (typeof bulletManager !== 'undefined' && bulletManager.beginCollisionFrame
            && typeof playerManager !== 'undefined' && playerManager.getPosition) {
            bulletManager.beginCollisionFrame(playerManager.getPosition());
        }
        // Each pair runs in its own try so one bad sprite/mask cannot abort
        // terrain wall hits (or the rest of the frame's collisions).
        const run = (fn) => {
            try { fn.call(this, gameState); } catch (e) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('collision check failed', e);
                }
            }
        };
        run(this.checkBulletEnemyCollisions);
        run(this.checkBulletSideEnemyCollisions);
        run(this.checkEnemyBulletPlayerCollisions);
        run(this.checkPlayerBulletEnemyBulletCollisions);
        run(this.checkBomberPlayerCollisions);
        run(this.checkObstaclePlayerCollisions);
        run(this.checkObstacleEnemyCollisions);
        run(this.checkBulletObstacleCollisions);
        run(this.checkTerrainCollisions);
        run(this.checkGateCollisions);
    }

    /**
     * Transit gate: its bulkhead stops every shot (nothing flies on past the level's end),
     * and player shots crack the sluice's hatch dome until it bursts open.
     */
    checkGateCollisions() {
        if (typeof objectiveManager === 'undefined' || !objectiveManager.goal) return;
        const g = objectiveManager.goal;
        const sweep = (list, remove, byPlayer) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (!b) continue;
                if (byPlayer && typeof bulletManager !== 'undefined'
                    && bulletManager.playerShotSpawnBlocked
                    && bulletManager.playerShotSpawnBlocked(b)) continue;
                const tip = (typeof bulletManager !== 'undefined' && bulletManager.shotTip)
                    ? bulletManager.shotTip(b)
                    : { x: b.x + (b.width || 0) / 2, y: b.y + (b.height || 0) / 2 };
                const cx = tip.x;
                const cy = tip.y;
                if (objectiveManager.isInGateDome(cx, cy)) {
                    remove(i);
                    this.createDetailedHitEffect(cx, cy, 'impact');
                    if (byPlayer) objectiveManager.hitGateDome(b.damage != null ? b.damage : 10, cx, cy);
                    // hitGateDome already plays coded gate SFX; skip generic hit.
                    continue;
                }
                // Only the solid bulkhead band kills shots — not everything
                // above the gate (that erased mid-screen autofire streams).
                const inOpening = Math.abs(cx - g.cx) <= g.open / 2;
                const inGateBand = cy >= g.y - 2 && cy <= g.y + g.h + 2;
                if (inGateBand && (!inOpening || cy <= g.y)) {
                    remove(i);
                    if (cy >= g.y - 4) this.createDetailedHitEffect(cx, g.y + g.h, 'impact');
                }
            }
        };
        sweep(bulletManager.getBullets(), (i) => bulletManager.removeBullet(i), true);
        sweep(bulletManager.getEnemyBullets(), (i) => bulletManager.removeEnemyBullet(i), false);
    }

    /**
     * Canyon walls in scrolling stages are solid: the ship is pushed back
     * into the corridor and takes damage (with a short grace period), and
     * any shot that reaches a wall bursts on it.
     */
    checkTerrainCollisions(gameState) {
        if (typeof obstacleManager === 'undefined' || !obstacleManager.terrainWallsOver) return;
        // Same logical width the renderer uses for canyon art (not the
        // supersampled canvas bitmap).
        const W = (typeof game !== 'undefined' && game && game.internalWidth)
            || (gameState && gameState.width)
            || 240;
        const cell = (obstacleManager.terrainCell && obstacleManager.terrainCell()) || 1;
        const gateEnter = typeof objectiveManager !== 'undefined'
            && objectiveManager.isGateEnter && objectiveManager.isGateEnter();
        const player = playerManager.getPosition();
        // During sluice enter the ship is pulled into the tube — wall scrapes must not kill it.
        if (player && !gateEnter) {
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
                        if (playerManager.takeDamage(dmg) && typeof game !== 'undefined') game.gameOver();
                        this.spawnPlayerHitFx(hitX, hy);
                        if (typeof soundManager !== 'undefined') {
                            if (soundManager.playWallScrape) soundManager.playWallScrape();
                            if (playerManager.hitSpark === 'shield' && soundManager.playShieldHit) {
                                soundManager.playShieldHit();
                            } else {
                                soundManager.playHurt();
                            }
                        }
                        // Scraping the wall also chips it so you can grind an escape.
                        if (obstacleManager.damageTerrain) {
                            obstacleManager.damageTerrain(hy, hitSide, { power: 4, radius: 1, vsMetal: 2 });
                        }
                    }
                }
            }
        }
        this.checkEnemyTerrainCollisions(W);
        // Shots chip the wall they hit; player shots that break a cell score.
        // Also carve when a shot is within one cell of the wall lip (VOXEL
        // stepping often lands on the corridor edge without entering the rock).
        const burst = (list, remove, byPlayer) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (!b) continue;
                if (byPlayer && typeof bulletManager !== 'undefined'
                    && bulletManager.playerShotSpawnBlocked
                    && bulletManager.playerShotSpawnBlocked(b)) continue;
                // Leading tip — AABB centre made tall lasers vanish mid-lane.
                const tip = (typeof bulletManager !== 'undefined' && bulletManager.shotTip)
                    ? bulletManager.shotTip(b)
                    : { x: b.x + (b.width || 0) / 2, y: b.y + (b.height || 0) / 2 };
                const ex = tip.x;
                const ey = tip.y;
                // Sweep the path travelled this frame in half-cell steps: fast
                // shots otherwise jump over 1–2 row thin ledges and hatch lips.
                const sdx = b._sweepDx || 0;
                const sdy = b._sweepDy || 0;
                const steps = Math.max(1, Math.min(16, Math.ceil(Math.max(Math.abs(sdx), Math.abs(sdy)) / (cell / 2))));
                let side = -1;
                let cx = ex, cy = ey, w = null, wrCheck = 0;
                // Continuous flight: 1px lip only (never +cell).
                const lip = 1;
                for (let s = steps - 1; s >= 0 && side < 0; s--) {
                    const f = s / steps;
                    cx = ex - sdx * f;
                    cy = ey - sdy * f;
                    w = obstacleManager.terrainWallsAtY(cy, W);
                    if (!w) continue;
                    if (cx <= w.left + lip) side = 0;
                    else if (cx >= w.right - lip) side = 1;
                    else continue;
                    // Skip if that side is already fully carved away.
                    wrCheck = obstacleManager.terrainRowAtY(cy);
                    const cells = obstacleManager.terrainWallCells
                        ? obstacleManager.terrainWallCells(wrCheck, W) : null;
                    if (cells && ((side === 0 && cells.left <= 0) || (side === 1 && cells.right <= 0))) {
                        side = -1;
                    }
                }
                if (side < 0) continue;
                const profile = obstacleManager.terrainWeaponProfile(b);
                const row = wrCheck;
                if (profile.pierce && b._terrainRow === row) continue;
                b._terrainRow = row;
                if (!profile.pierce) {
                    remove(i);
                }
                const broke = obstacleManager.damageTerrain(cy, side, profile);
                const lipX = side ? w.right : w.left;
                this.createDetailedHitEffect(lipX, cy, broke ? 'destroy' : 'impact');
                const mat = obstacleManager.terrainMaterial(row, side);
                // Chunks fly off into the corridor, like a rock breaking up.
                if (obstacleManager.spawnWallBurst) {
                    obstacleManager.spawnWallBurst(lipX, cy, side ? -1 : 1, obstacleManager.terrainDebrisColors(mat),
                        broke ? Math.min(28, 6 + broke * 3) : 3, broke ? 2.2 : 1.4, broke ? 2 : 1.1);
                }
                if (broke && byPlayer && typeof game !== 'undefined') {
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
        if (typeof game !== 'undefined' && game.cheatSystem && game.cheatSystem.cheats && game.cheatSystem.cheats.godMode) return;
        if (typeof objectiveManager !== 'undefined'
            && objectiveManager.isGateEnter && objectiveManager.isGateEnter()) {
            return;
        }
        const player = playerManager.getPosition();
        if (!player) return;
        const sides = enemyManager.getSideEnemies();
        for (let j = sides.length - 1; j >= 0; j--) {
            const side = sides[j];
            if (!side || side.role !== 'bomber' || side.entering) continue;
            if (!this.isColliding(side, player)) continue;
            const sx = side.x + side.width / 2;
            const sy = side.y + side.height / 2;
            const dmg = side.bomberDamage != null ? side.bomberDamage : 18;
            const playerDefeated = typeof playerManager.takeDamage === 'function'
                ? playerManager.takeDamage(dmg)
                : false;
            this.spawnPlayerHitFx(sx, sy);
            if (typeof soundManager !== 'undefined') {
                if (playerManager.hitSpark === 'shield' && soundManager.playShieldHit) {
                    soundManager.playShieldHit();
                } else if (soundManager.playHurt) {
                    soundManager.playHurt();
                }
                if (soundManager.playExplosion) soundManager.playExplosion(1.1);
            }
            // Kamikaze boom + kill credit (same pop path as a shot kill).
            this.destroySideEnemy(sides, j);
            if (playerDefeated && typeof game !== 'undefined' && game.gameOver) {
                game.gameOver();
            }
        }
    }

    checkBulletSideEnemyCollisions(gameState) {
        if (!enemyManager.getSideEnemies) return;
        const bullets = bulletManager.getBullets();
        const sides = enemyManager.getSideEnemies();
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet) continue;
            if (!(Number(bullet.vy) < 0) && !(Number(bullet._sweepDy) < 0)) continue;
            if (typeof bulletManager !== 'undefined' && bulletManager.playerShotSpawnBlocked
                && bulletManager.playerShotSpawnBlocked(bullet)) continue;
            for (let j = sides.length - 1; j >= 0; j--) {
                // Still sliding in through the hangar gap: not a fair target yet.
                if (sides[j].entering) continue;
                if (this.isColliding(bullet, sides[j])) {
                    const tip = this.shotImpactXY(bullet);
                    const hitX = tip.x;
                    const hitY = tip.y;
                    let damage = 10;
                    if (bullet && bullet.damage !== undefined) damage = bullet.damage;
                    if (bullet && bullet.chainSlow && enemyManager.applyChainSlow) {
                        enemyManager.applyChainSlow(sides[j]);
                    }
                    bulletManager.removeBullet(i);
                    const killedByHit = enemyManager.damageSideEnemy
                        ? enemyManager.damageSideEnemy(sides[j], damage)
                        : ((sides[j].health -= damage), sides[j].health <= 0);
                    if (typeof soundManager !== 'undefined') {
                        if (killedByHit) soundManager.playKill();
                        else soundManager.playHit();
                    }
                    if (killedByHit) this.destroySideEnemy(sides, j);
                    else this.spawnEnemyHitFx(hitX, hitY, sides[j]);
                    return;
                }
            }
        }
    }

    /** Remove side craft `j` with a pop and count the kill. */
    destroySideEnemy(sides, j) {
        const killed = sides[j];
        if (!killed) return;
        const sx = killed.x + killed.width / 2;
        const sy = killed.y + killed.height / 2;
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
                isBoss: false,
                x: sx,
                y: sy
            });
        }
    }

    /**
     * Enemies scrape the canyon walls like the player: pushed back into the
     * corridor and damaged (per-ship grace period). Craft still sliding in
     * through a hangar opening or fleeing out are exempt.
     */
    checkEnemyTerrainCollisions(W) {
        if (typeof enemyManager === 'undefined') return;
        const now = Date.now();
        const scrape = (e) => {
            const walls = obstacleManager.terrainWallsOver(e.y + 2, e.y + e.height - 2, W);
            if (!walls) return 0;
            let hitSide = -1;
            if (e.x < walls.left) {
                hitSide = 0;
                e.x = walls.left + 1;
            } else if (e.x + e.width > walls.right) {
                hitSide = 1;
                e.x = walls.right - e.width - 1;
            }
            if (hitSide < 0 || now - (e._terrainHitAt || 0) < 600) return 0;
            const hy = e.y + e.height / 2;
            const cells = obstacleManager.terrainWallCells(obstacleManager.terrainRowAtY(hy), W);
            const thick = cells ? (hitSide ? cells.right : cells.left) : 2;
            if (thick <= 0) return 0;
            e._terrainHitAt = now;
            this.createDetailedHitEffect(hitSide ? walls.right : walls.left, hy, 'impact');
            if (obstacleManager.damageTerrain) {
                obstacleManager.damageTerrain(hy, hitSide, { power: 4, radius: 1, vsMetal: 2 });
            }
            return { dmg: thick <= 1 ? 3 : 8, hx: hitSide ? walls.right : walls.left, hy: hy };
        };
        const sides = enemyManager.getSideEnemies ? enemyManager.getSideEnemies() : [];
        for (let j = sides.length - 1; j >= 0; j--) {
            const e = sides[j];
            if (!e || e.entering || e.fleeing) continue;
            const hit = scrape(e);
            if (!hit) continue;
            e.health -= hit.dmg;
            e.hitSpark = 'hull';
            this.spawnEnemyHitFx(hit.hx, hit.hy, e);
            if (e.health <= 0) this.destroySideEnemy(sides, j);
        }
        const champ = enemyManager.getEnemy ? enemyManager.getEnemy() : null;
        if (champ && !(enemyManager.isExploding && enemyManager.isExploding())) {
            const hit = scrape(champ);
            if (hit) {
                enemyManager.takeDamage(hit.dmg);
                this.spawnEnemyHitFx(hit.hx, hit.hy, champ);
            }
        }
    }

    checkBulletEnemyCollisions(gameState) {
        const bullets = bulletManager.getBullets();
        const enemy = enemyManager.getEnemy();

        if (!enemy || enemyManager.isExploding()) return;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet) continue;
            // Wrong-way / dual-list ghosts must not consume hits or die mid-stream.
            if (!(Number(bullet.vy) < 0) && !(Number(bullet._sweepDy) < 0)) continue;
            if (typeof bulletManager !== 'undefined' && bulletManager.playerShotSpawnBlocked
                && bulletManager.playerShotSpawnBlocked(bullet)) continue;
            if (this.isColliding(bullet, enemy)) {
                const tip = this.shotImpactXY(bullet);
                const hitX = tip.x;
                const hitY = tip.y;
                const enemyX = enemy.x + enemy.width / 2;
                const enemyY = enemy.y + enemy.height / 2;

                // Damage enemy (use bullet damage or instant kill cheat)
                let damage = 10; // Default damage
                if (bullet && bullet.damage !== undefined) {
                    damage = bullet.damage;
                }
                if (game.cheatSystem && game.cheatSystem.cheats && game.cheatSystem.cheats.instantKill) {
                    damage = 999; // Instant kill
                }

                if (bullet && bullet.chainSlow && enemyManager.applyChainSlow) {
                    enemyManager.applyChainSlow(enemy);
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
                if (enemyDefeated) {
                    this.createExplosion(enemyX, enemyY, enemyExplosionId);
                } else {
                    this.spawnEnemyHitFx(hitX, hitY, enemy);
                }

                // Enemy will start exploding, victory will be shown after explosion
                // No need to call game.playerWins() here anymore
                break;
            }
        }
    }

    /**
     * Compact impact FX at shot contact: shield → energy flecks, hull → scrap chips.
     * Used for both enemy and player ships.
     */
    spawnShipHitFx(x, y, hitSpark) {
        const shieldHit = hitSpark === 'shield';
        if (typeof graphicsManager === 'undefined' || !graphicsManager.particleSystem) return;
        const ps = graphicsManager.particleSystem;
        if (shieldHit && ps.createShieldHitParticles) {
            ps.createShieldHitParticles(x, y, 8);
        } else if (!shieldHit && ps.createScrapHitParticles) {
            ps.createScrapHitParticles(x, y, 7);
        } else if (ps.createHitParticles) {
            ps.createHitParticles(x, y, 7, {
                speed: shieldHit ? 1.9 : 2.1,
                life: 13,
                size: 1.45,
                fadeOut: true,
                gravity: shieldHit ? -0.015 : 0.14,
                colors: shieldHit
                    ? ['#9fdcff', '#ffffff', '#6ec8e8']
                    : ['#8a9098', '#c4c8ce', '#5a6068']
            });
        }
    }

    /** Impact sparks at the shot contact on an enemy hull / shield. */
    spawnEnemyHitFx(x, y, enemy) {
        const shieldHit = !!(enemy && enemy.hitSpark === 'shield');
        this.spawnShipHitFx(x, y, shieldHit ? 'shield' : 'hull');
    }

    /** Impact sparks when the player ship / shield is hit. */
    spawnPlayerHitFx(x, y) {
        const spark = (typeof playerManager !== 'undefined' && playerManager.hitSpark)
            ? playerManager.hitSpark
            : 'hull';
        this.spawnShipHitFx(x, y, spark);
    }

    checkEnemyBulletPlayerCollisions(gameState) {
        if (typeof objectiveManager !== 'undefined'
            && objectiveManager.isGateEnter && objectiveManager.isGateEnter()) {
            return;
        }
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
                if (game.cheatSystem && game.cheatSystem.cheats && game.cheatSystem.cheats.godMode) {
                    damage = 0; // No damage in god mode
                }

                // Remove bullet after reading damage
                bulletManager.removeEnemyBullet(i);

                const playerDefeated = playerManager.takeDamage(damage);

                if (damage > 0) {
                    this.spawnPlayerHitFx(playerX, playerY);
                    if (typeof soundManager !== 'undefined') {
                        if (playerManager.hitSpark === 'shield' && soundManager.playShieldHit) {
                            soundManager.playShieldHit();
                        } else {
                            soundManager.playHurt();
                        }
                    }
                }

                if (playerDefeated) {
                    game.gameOver();
                }
                break;
            }
        }
    }

    /** Travel vector for a live shot (vx/vy, else sweep, else team axis). */
    shotTravelDir(b) {
        if (!b) return { x: 0, y: 0 };
        let dx = Number(b.vx);
        let dy = Number(b.vy);
        if (!(Math.hypot(dx, dy) > 0.01)) {
            dx = Number(b._sweepDx) || 0;
            dy = Number(b._sweepDy) || 0;
        }
        if (!(Math.hypot(dx, dy) > 0.01)) {
            dy = (b.isEnemyShot || b.isBossShot) ? 1 : -1;
            dx = 0;
        }
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    /** True only when two shots fly toward opposite directions. */
    shotsOpposing(a, b) {
        const da = this.shotTravelDir(a);
        const db = this.shotTravelDir(b);
        return (da.x * db.x + da.y * db.y) < -0.25;
    }

    /**
     * Shot vs shot, swept over this frame: thin fast shots move further per
     * frame than their own length and used to pass through each other
     * without ever overlapping, so clashes/reflections rarely triggered.
     * Only opposing travel directions may clash; same-way beams pass through.
     */
    shotsCrossed(pb, eb) {
        if (!this.shotsOpposing(pb, eb)) return false;
        const minW = 2;
        const pw = Math.max(minW, pb.width || 0);
        const ew = Math.max(minW, eb.width || 0);
        const px = pb.x + (pb.width || 0) / 2 - pw / 2;
        const ex = eb.x + (eb.width || 0) / 2 - ew / 2;
        if (!(px < ex + ew && px + pw > ex)) return false;
        const pSpd = (typeof bulletManager !== 'undefined' && bulletManager.getBulletMoveSpeed)
            ? bulletManager.getBulletMoveSpeed(pb, 6) : Math.abs(Number(pb.speed) || 6);
        const eSpd = (typeof bulletManager !== 'undefined' && bulletManager.getBulletMoveSpeed)
            ? bulletManager.getBulletMoveSpeed(eb, 5) : Math.abs(Number(eb.speed) || 5);
        const pTop = pb.y;
        const pBot = pb.y + (pb.height || 0) + pSpd;
        const eTop = eb.y - eSpd;
        const eBot = eb.y + (eb.height || 0);
        return pTop < eBot && pBot > eTop;
    }

    checkPlayerBulletEnemyBulletCollisions(gameState) {
        const playerBullets = bulletManager.getBullets();
        const enemyBullets = bulletManager.getEnemyBullets();

        for (let i = playerBullets.length - 1; i >= 0; i--) {
            for (let j = enemyBullets.length - 1; j >= 0; j--) {
                const pb = playerBullets[i];
                const eb = enemyBullets[j];
                // Reflective unlock required; same-direction beams never clash.
                if (!pb || !eb || !pb.reflectiveShots) continue;
                if (!this.shotsCrossed(pb, eb)) continue;
                const pTip = this.shotImpactXY(pb);
                const eTip = this.shotImpactXY(eb);
                const hitX = (pTip.x + eTip.x) / 2;
                const hitY = (pTip.y + eTip.y) / 2;
                const playerPower = (pb.damage != null ? pb.damage : 10);
                const enemyPower = (eb.damage != null ? eb.damage : 10);
                let winnerSide = null;
                if (playerPower > enemyPower) winnerSide = 'player';
                else if (enemyPower > playerPower) winnerSide = 'enemy';
                this.redirectLaserClash(pb, eb, winnerSide, hitX, hitY);
                break;
            }
        }
    }
}
