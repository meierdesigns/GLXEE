"use strict";

// Reused across isColliding() calls to avoid an object allocation per collision test
// (this runs inside every nested bullet/obstacle/enemy collision loop, every frame).
const _collisionBoundsScratch1 = { x: 0, y: 0, width: 0, height: 0 };
const _collisionBoundsScratch2 = { x: 0, y: 0, width: 0, height: 0 };
const _collisionSweptScratch = { x: 0, y: 0, width: 0, height: 0 };

// CollisionManager methods, split from collisions.js.
extendClass(CollisionManager, {
    /**
     * Flip a live shot onto the other team with locked straight velocity.
     * Caps bounce chains so mirrors cannot ping-pong forever.
     */
    reassignShotTeam(index, fromSide, asEnemy, obstacle) {
        if (typeof bulletManager === 'undefined') return null;
        const fromList = fromSide === 'player'
            ? bulletManager.getBullets()
            : bulletManager.getEnemyBullets();
        const b = bulletManager.detachBullet
            ? bulletManager.detachBullet(fromList, index)
            : null;
        if (!b) return null;
        const tip = this.shotImpactXY(b);
        const count = (Number(b._reflectCount) || 0) + 1;
        if (count > 3) {
            this.createDetailedHitEffect(tip.x, tip.y, 'impact');
            if (bulletManager.releaseBullet) bulletManager.releaseBullet(b);
            return null;
        }
        const spd = bulletManager.getBulletMoveSpeed
            ? bulletManager.getBulletMoveSpeed(b, asEnemy ? 5 : 6)
            : Math.abs(Number(b.speed) || (asEnemy ? 5 : 6));
        const w = Math.max(1, Math.min(6, Number(b.width != null ? b.width : b.w) || 2));
        const h = Math.max(3, Math.min(22, Number(b.height != null ? b.height : b.h) || 8));
        b.width = w;
        b.height = h;
        b.isEnemyShot = !!asEnemy;
        b.isBossShot = asEnemy ? b.isBossShot : undefined;
        b.angle = undefined;
        b.reflected = true;
        b._reflectCount = count;
        b._ignoreObstacle = obstacle || null;
        b.moveSpeed = spd;
        b.speed = spd;
        b.vx = 0;
        b.vy = asEnemy ? spd : -spd;
        b._sweepDx = 0;
        b._sweepDy = 0;
        b._spawnAt = undefined;
        // Bounced shots never re-enter laser clash (would eat the next volley).
        b.reflectiveShots = false;
        // Tip sits just past the bounce point along the new travel axis.
        b.x = tip.x - w / 2;
        b.y = asEnemy ? (tip.y + 2 - h) : (tip.y - 2);
        const toList = asEnemy ? bulletManager.enemyBullets : bulletManager.bullets;
        // Always copy into a fresh list entry — never reinsert the same ref.
        if (bulletManager.pushBullet) {
            bulletManager.pushBullet(toList, Object.assign({}, b));
            if (bulletManager.releaseBullet) bulletManager.releaseBullet(b);
        } else {
            toList.push(b);
        }
        return toList[toList.length - 1];
    },

    /**
     * Shot clash: stronger damage wins and continues as one beam.
     * Equal power → both annihilate. No random bounce / dual spawn.
     */
    redirectLaserClash(playerBullet, enemyBullet, winnerSide, hitX, hitY) {
        const pDmg = playerBullet.damage != null ? playerBullet.damage : 10;
        const eDmg = enemyBullet.damage != null ? enemyBullet.damage : 10;
        const combinedDamage = Math.max(pDmg, eDmg)
            + Math.floor(Math.min(pDmg, eDmg) * 0.35);

        const pList = bulletManager.getBullets();
        const eList = bulletManager.getEnemyBullets();
        const pi = pList.indexOf(playerBullet);
        const ei = eList.indexOf(enemyBullet);
        if (pi !== -1) bulletManager.removeBullet(pi);
        if (ei !== -1) bulletManager.removeEnemyBullet(ei);

        this.createDetailedHitEffect(hitX, hitY, 'reflect');
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.createHitEffect(hitX, hitY, 8, 'var(--current-primary)');
        }
        if (typeof soundManager !== 'undefined') soundManager.playReflect();

        // Tie: both die at the clash — no ghost beams.
        if (!winnerSide || pDmg === eDmg) return;

        const asEnemy = winnerSide === 'enemy';
        const src = asEnemy ? enemyBullet : playerBullet;
        const spd = Math.max(
            (typeof bulletManager !== 'undefined' && bulletManager.getBulletMoveSpeed)
                ? bulletManager.getBulletMoveSpeed(playerBullet, 6) : Math.abs(Number(playerBullet.speed) || 6),
            (typeof bulletManager !== 'undefined' && bulletManager.getBulletMoveSpeed)
                ? bulletManager.getBulletMoveSpeed(enemyBullet, 5) : Math.abs(Number(enemyBullet.speed) || 5)
        );
        const w = Math.max(2, Math.min(6, Number(src.width || 3)));
        const h = Math.max(4, Math.min(18, Number(src.height || 10)));
        const beam = {
            x: hitX - w / 2,
            y: asEnemy ? hitY + 2 : hitY - h - 2,
            width: w,
            height: h,
            speed: spd,
            moveSpeed: spd,
            vx: 0,
            vy: asEnemy ? spd : -spd,
            damage: combinedDamage,
            color: src.color,
            type: src.type || (asEnemy ? 'enemy_laser' : 'laser_beam'),
            weaponId: src.weaponId,
            isEnemyShot: asEnemy,
            reflected: true,
            reflectiveShots: false,
            lightRadius: Math.max(src.lightRadius || 50, 50),
            lightIntensity: 1.35,
            lightColor: src.lightColor || src.color,
            _isShot: true,
            _reflectCount: 1
        };
        const list = asEnemy ? eList : pList;
        if (bulletManager.pushBullet) bulletManager.pushBullet(list, beam);
        else list.push(beam);
        if (!asEnemy && typeof game !== 'undefined') game.score += 8;
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
        if (obj.isEnemyShot || obj.isBossShot || obj._isShot) return true;
        if (obj._sweepDx != null || obj._sweepDy != null) {
            if (obj.moveSpeed != null || obj.weaponId || (obj.type && String(obj.type).includes('beam'))) return true;
            if (obj.damage != null && (obj.width != null || obj.height != null) && !obj.kind && !obj.isFog) return true;
        }
        return false;
    },

    /** Impact point when a shot dies — always the leading tip. */
    shotImpactXY(bullet) {
        if (!bullet) return { x: 0, y: 0 };
        if (typeof bulletManager !== 'undefined' && bulletManager.shotTip) {
            return bulletManager.shotTip(bullet);
        }
        return {
            x: Number(bullet.x) + (Number(bullet.width != null ? bullet.width : bullet.w) || 0) / 2,
            y: Number(bullet.y) + (Number(bullet.height != null ? bullet.height : bullet.h) || 0) / 2
        };
    },

    /** Remove a shot and pop a small impact at its tip. */
    destroyShotAt(listSide, index, effectType) {
        const list = listSide === 'enemy'
            ? (bulletManager.getEnemyBullets ? bulletManager.getEnemyBullets() : null)
            : (bulletManager.getBullets ? bulletManager.getBullets() : null);
        const b = list && list[index];
        if (!b) return;
        const p = this.shotImpactXY(b);
        if (listSide === 'enemy') bulletManager.removeEnemyBullet(index);
        else bulletManager.removeBullet(index);
        this.createDetailedHitEffect(p.x, p.y, effectType || 'impact');
    },

    isObstacleEntity(obj) {
        return !!(obj && (obj.isFog || obj.kind
            || obj.pushable != null || obj.reflectsShots != null
            || (obj.isDestructible != null && obj.collisionDamage == null && !obj.maxHealth)));
    },

    /**
     * Shot vs hull: prefer the silhouette mask / opaque insets so empty
     * footprint padding (wing gaps, letterbox) does not count as a hit.
     * Only missing mask data falls back to the padded inset AABB — a sparse
     * mask that was actually sampled is trusted on its "no pixel here" result
     * too, otherwise thin/sparse hulls (rails, wires, debris) ate shots well
     * outside their visible silhouette.
     */
    confirmShotHit(shotBounds, hull) {
        if (!hull || !shotBounds) return true;
        const spr = this.getCollisionSprite(hull);
        // Sparse / tiny masks used to reject real visual hits — only trust a
        // silhouette that has enough solid coverage; otherwise use the hull AABB.
        if (spr && spr.sprite && spr.sprite.length && this.collisionMaskIsTrustworthy(hull, spr)) {
            try {
                if (this.spriteOverlapsRect(hull, spr, shotBounds)) return true;
                return false;
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
        // Shot↔shot: only opposing travel directions may interact.
        if (shot1 && shot2) {
            if (!this.shotsOpposing(obj1, obj2)) return false;
        }
        const anyShot = shot1 || shot2;
        // Broadphase uses the full footprint so silhouette insets cannot drop a
        // glancing visual hit; confirmShotHit then tests the real hull mask.
        // Shots draw on continuous pixel coords (no lattice snap) — match that.
        const b1 = this.getCollisionBounds(obj1, _collisionBoundsScratch1, {
            ignoreInsets: anyShot && !shot1,
            matchVoxelDraw: false
        });
        const b2 = this.getCollisionBounds(obj2, _collisionBoundsScratch2, {
            ignoreInsets: anyShot && !shot2,
            matchVoxelDraw: false
        });
        // Shot vs hull/obstacle: tip only — full beam AABB killed trailing
        // autofire shots while their tip was still behind the lead shot.
        if (!(shot1 && shot2)) {
            const tipBox = (obj, b) => {
                const down = !!(obj.isEnemyShot || obj.isBossShot || Number(obj.vy) > 0);
                const fullH = Number(obj.height != null ? obj.height : obj.h) || b.height || 4;
                const fullW = Number(obj.width != null ? obj.width : obj.w) || b.width || 2;
                const tw = Math.max(2, Math.min(4, fullW));
                const th = Math.max(3, Math.min(5, fullH));
                const cx = Number(obj.x) + fullW / 2;
                b.width = tw;
                b.height = th;
                b.x = cx - tw / 2;
                b.y = down ? (Number(obj.y) + fullH - th) : Number(obj.y);
            };
            if (shot1) tipBox(obj1, b1);
            if (shot2) tipBox(obj2, b2);
        }
        const basicCollision = b1.x < b2.x + b2.width &&
                               b1.x + b1.width > b2.x &&
                               b1.y < b2.y + b2.height &&
                               b1.y + b1.height > b2.y;

        if (!basicCollision) {
            // Swept path vs obstacles grazes wide AABBs — only the live position counts.
            if (anyShot) {
                if (shot1 && shot2) return false;
                if (shot1 && this.isObstacleEntity(obj2)) return false;
                if (shot2 && this.isObstacleEntity(obj1)) return false;
            }
            // Fast shots: also test the strip swept since last frame so they cannot jump over a target.
            const sx = obj1 && obj1._sweepDx, sy = obj1 && obj1._sweepDy;
            if (!(sx || sy)) return false;
            const x0 = Math.min(b1.x, b1.x - sx), x1 = Math.max(b1.x + b1.width, b1.x + b1.width - sx);
            const y0 = Math.min(b1.y, b1.y - sy), y1 = Math.max(b1.y + b1.height, b1.y + b1.height - sy);
            const sweptHit = x0 < b2.x + b2.width && x1 > b2.x && y0 < b2.y + b2.height && y1 > b2.y;
            if (!sweptHit) return false;
            // Carved rocks: confirm the swept strip still touches remaining pixels
            // (previously skipped entirely → shots tunneled through thin lips).
            const swept = _collisionSweptScratch;
            swept.x = x0;
            swept.y = y0;
            swept.width = Math.max(1, x1 - x0);
            swept.height = Math.max(1, y1 - y0);
            if (typeof obstacleManager !== 'undefined' && obstacleManager.maskOverlapsRect) {
                if (obj2 && obj2._mask && !obstacleManager.maskOverlapsRect(obj2, swept)) return false;
                if (obj1 && obj1._mask && !obstacleManager.maskOverlapsRect(obj1, swept)) return false;
            }
            if (anyShot) {
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
            if (shot1 && shot2) return false;
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
