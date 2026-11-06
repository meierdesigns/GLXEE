"use strict";

// Reused across isColliding() calls to avoid an object allocation per collision test
// (this runs inside every nested bullet/obstacle/enemy collision loop, every frame).
const _collisionBoundsScratch1 = { x: 0, y: 0, width: 0, height: 0 };
const _collisionBoundsScratch2 = { x: 0, y: 0, width: 0, height: 0 };

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

    /**
     * A ship touched a bulwark: knock the block away from the ship's centre.
     * Returns false while the block is still on its post-hit cooldown (no repeat damage per frame).
     */
    bounceBulwark(obs, sx, sy) {
        const now = Date.now();
        if (obs._bumpUntil && now < obs._bumpUntil) return false;
        obs._bumpUntil = now + 500;
        const ox = obs.x + obs.width / 2, oy = obs.y + obs.height / 2;
        const dx = ox - sx, dy = oy - sy;
        const len = Math.hypot(dx, dy) || 1;
        obs.pushVx = (dx / len) * 2.2;
        obs.pushVy = (dy / len) * 2.2;
        this.createDetailedHitEffect((ox + sx) / 2, (oy + sy) / 2, 'impact');
        return true;
    },

    checkObstaclePlayerCollisions(gameState) {
        if (typeof objectiveManager !== 'undefined'
            && objectiveManager.isGateEnter && objectiveManager.isGateEnter()) {
            return;
        }
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
                const obs = obstacles[i];
                const dmg = Math.max(1, obs.collisionDamage != null ? obs.collisionDamage : 15);
                const explosionId = obs.explosionId || 'asteroid_burst';

                if (obs.pushable) {
                    // Indestructible bulwark: ram damage, then it bounces off instead of breaking.
                    if (!this.bounceBulwark(obs, playerX, playerY)) continue;
                    if (playerManager.takeDamage(dmg)) game.gameOver();
                    this.spawnPlayerHitFx(playerX, playerY);
                    if (typeof soundManager !== 'undefined') {
                        if (playerManager.hitSpark === 'shield' && soundManager.playShieldHit) {
                            soundManager.playShieldHit();
                        } else {
                            soundManager.playHurt();
                        }
                    }
                    break;
                }

                // Remove obstacle
                obstacleManager.removeObstacle(i);

                // Damage player
                const playerDefeated = playerManager.takeDamage(dmg);

                this.createDetailedHitEffect(obstacleX, obstacleY, 'destroy', explosionId, obs);
                this.spawnPlayerHitFx(playerX, playerY);

                if (typeof soundManager !== 'undefined') {
                    soundManager.playExplosion(0.6);
                    if (playerManager.hitSpark === 'shield' && soundManager.playShieldHit) {
                        soundManager.playShieldHit();
                    } else {
                        soundManager.playHurt();
                    }
                }

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
                const obs = obstacles[i];
                const dmg = Math.max(1, obs.collisionDamage != null ? obs.collisionDamage : 20);
                const explosionId = obs.explosionId || 'asteroid_burst';

                if (obs.pushable) {
                    // Shoving a bulwark into the enemy hurts it; the block itself bounces off.
                    if (!this.bounceBulwark(obs, enemyX, enemyY)) continue;
                    enemyManager.takeDamage(dmg);
                    this.spawnEnemyHitFx(enemyX, enemyY, enemyManager.getEnemy && enemyManager.getEnemy());
                    if (typeof soundManager !== 'undefined') soundManager.playHit();
                    break;
                }

                // Remove obstacle
                obstacleManager.removeObstacle(i);

                // Damage enemy
                const enemyDefeated = enemyManager.takeDamage(dmg);

                this.createDetailedHitEffect(obstacleX, obstacleY, 'destroy', explosionId, obs);
                if (!enemyDefeated) {
                    this.spawnEnemyHitFx(enemyX, enemyY, enemyManager.getEnemy && enemyManager.getEnemy());
                }

                if (typeof soundManager !== 'undefined') {
                    soundManager.playExplosion(0.6);
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

    /**
     * Bullets set _sweepDx/_sweepDy every frame; ships/obstacles do not.
     * Spawn-frame enemy shots (created after bullet.update) have no sweep yet —
     * still treat them as shots so sparse hull masks cannot swallow the hit.
     */
    isShotEntity(obj) {
        if (!obj) return false;
        if (obj._sweepDx != null || obj._sweepDy != null) return true;
        if (obj.isEnemyShot || obj.isBossShot || obj._isShot) return true;
        // Untagged projectile: has shot stats, no hull HP.
        if (obj.damage != null && obj.speed != null && obj.health == null && obj.maxHealth == null
            && !obj.collision) {
            return true;
        }
        return false;
    },

    /**
     * Shot vs hull: prefer the silhouette mask / opaque insets so empty
     * footprint padding (wing gaps, letterbox) does not count as a hit.
     * Broken/sparse masks fall back to padded inset AABB instead of rejecting.
     */
    confirmShotHit(shotBounds, hull) {
        if (!hull || !shotBounds) return true;
        const spr = this.getCollisionSprite(hull);
        if (spr && spr.sprite && spr.sprite.length) {
            try {
                if (this.spriteOverlapsRect(hull, spr, shotBounds)) return true;
                if (this.collisionMaskIsTrustworthy(hull, spr)) return false;
            } catch (e) {
                // Mask path must never abort the frame's collision pass.
            }
        }
        const tight = this.getCollisionBounds(hull, { x: 0, y: 0, width: 0, height: 0 }, {
            ignoreInsets: false,
            insetPad: 1.5
        });
        return shotBounds.x < tight.x + tight.width
            && shotBounds.x + shotBounds.width > tight.x
            && shotBounds.y < tight.y + tight.height
            && shotBounds.y + shotBounds.height > tight.y;
    },

    /** True when the hull mask has enough solid pixels to safely reject misses. */
    collisionMaskIsTrustworthy(obj, spr) {
        const info = spr || this.getCollisionSprite(obj);
        if (!info || !info.sprite || !info.sprite.length) return false;
        if (obj && obj.collision && obj.collision._maskTrust != null) {
            return !!obj.collision._maskTrust;
        }
        const sprite = info.sprite;
        let solid = 0;
        let total = 0;
        for (let r = 0; r < sprite.length; r += 2) {
            const row = sprite[r];
            if (!row || !row.length) continue;
            for (let c = 0; c < row.length; c += 2) {
                total += 1;
                if (row[c]) solid += 1;
            }
        }
        const trust = solid >= 24 && (solid / Math.max(1, total)) >= 0.04;
        if (obj && obj.collision) obj.collision._maskTrust = trust;
        return trust;
    },

    isColliding(obj1, obj2) {
        const shot1 = this.isShotEntity(obj1);
        const shot2 = this.isShotEntity(obj2);
        const anyShot = shot1 || shot2;
        // Broadphase uses the full footprint so silhouette insets cannot drop a
        // glancing visual hit; confirmShotHit then tests the real hull mask.
        const b1 = this.getCollisionBounds(obj1, _collisionBoundsScratch1, {
            ignoreInsets: anyShot && !shot1,
            matchVoxelDraw: shot1
        });
        const b2 = this.getCollisionBounds(obj2, _collisionBoundsScratch2, {
            ignoreInsets: anyShot && !shot2,
            matchVoxelDraw: shot2
        });
        const basicCollision = b1.x < b2.x + b2.width &&
                               b1.x + b1.width > b2.x &&
                               b1.y < b2.y + b2.height &&
                               b1.y + b1.height > b2.y;

        if (!basicCollision) {
            // Fast shots: also test the strip swept since last frame so they cannot jump over a target.
            const sx = obj1 && obj1._sweepDx, sy = obj1 && obj1._sweepDy;
            if (!(sx || sy)) return false;
            const x0 = Math.min(b1.x, b1.x - sx), x1 = Math.max(b1.x + b1.width, b1.x + b1.width - sx);
            const y0 = Math.min(b1.y, b1.y - sy), y1 = Math.max(b1.y + b1.height, b1.y + b1.height - sy);
            const sweptHit = x0 < b2.x + b2.width && x1 > b2.x && y0 < b2.y + b2.height && y1 > b2.y;
            if (!sweptHit) return false;
            // Carved rocks: confirm the swept strip still touches remaining pixels
            // (previously skipped entirely → shots tunneled through thin lips).
            const swept = { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
            if (typeof obstacleManager !== 'undefined' && obstacleManager.maskOverlapsRect) {
                if (obj2 && obj2._mask && !obstacleManager.maskOverlapsRect(obj2, swept)) return false;
                if (obj1 && obj1._mask && !obstacleManager.maskOverlapsRect(obj1, swept)) return false;
            }
            if (anyShot) {
                if (shot1 && shot2) return true;
                return this.confirmShotHit(shot1 ? swept : b2, shot1 ? obj2 : obj1);
            }
            return true;
        }
        // Carved boulders: only their remaining pixels are solid.
        if (typeof obstacleManager !== 'undefined' && obstacleManager.maskOverlapsRect) {
            if (obj2 && obj2._mask && !obstacleManager.maskOverlapsRect(obj2, b1)) return false;
            if (obj1 && obj1._mask && !obstacleManager.maskOverlapsRect(obj1, b2)) return false;
        }

        // Shots vs hull: refine against silhouette (not empty footprint padding).
        if (anyShot) {
            if (shot1 && shot2) return true;
            return this.confirmShotHit(shot1 ? b1 : b2, shot1 ? obj2 : obj1);
        }

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

    getCollisionBounds(obj, out, opts) {
        const o = out || { x: 0, y: 0, width: 0, height: 0 };
        if (!obj) {
            o.x = 0; o.y = 0; o.width = 0; o.height = 0;
            return o;
        }
        const ignoreInsets = !!(opts && opts.ignoreInsets);
        const pad = (opts && opts.insetPad) || 0;
        const c = obj.collision;
        if (!ignoreInsets && c && (c.insetL || c.insetT || c.insetR || c.insetB || pad)) {
            const insetL = Math.max(0, (c.insetL || 0) - pad);
            const insetT = Math.max(0, (c.insetT || 0) - pad);
            const insetR = Math.max(0, (c.insetR || 0) - pad);
            const insetB = Math.max(0, (c.insetB || 0) - pad);
            o.x = obj.x + insetL;
            o.y = obj.y + insetT;
            o.width = Math.max(1, obj.width - insetL - insetR);
            o.height = Math.max(1, obj.height - insetT - insetB);
        } else {
            o.x = obj.x;
            o.y = obj.y;
            o.width = obj.width;
            o.height = obj.height;
        }
        // VOXEL draw path snaps/quantizes shots; collision must use the same box
        // or glancing hits look solid on screen but never register.
        if (opts && opts.matchVoxelDraw
            && typeof renderManager !== 'undefined'
            && renderManager.getCombatVoxelCell) {
            const cell = renderManager.getCombatVoxelCell();
            if (cell != null && cell > 0) {
                const snap = renderManager.snapCombat
                    ? (v) => renderManager.snapCombat(v, cell)
                    : (v) => Math.round(v / cell) * cell;
                const quant = renderManager.quantizeCombatSize
                    ? (s) => renderManager.quantizeCombatSize(s, cell)
                    : (s) => Math.max(cell, Math.round(s / cell) * cell);
                o.x = snap(o.x);
                o.y = snap(o.y);
                o.width = quant(o.width);
                o.height = quant(o.height);
            }
        }
        return o;
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
