"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    startExplosion() {
        this.exploding = true;
        this.explosionTimer = 0;
        this.beginSideEnemyFlee(this.getRuntimeGameState(null));
        let duration = 2000;
        let presetId = 'ship_death';
        if (typeof enemyConfigManager !== 'undefined' && this.enemy) {
            const typeId = this.enemy.type || this.enemy.enemyType || this.currentEnemyType;
            const cfg = enemyConfigManager.getConfig(typeId);
            if (cfg && cfg.explosionId) presetId = cfg.explosionId;
        }
        this.explosionPresetId = presetId;
        if (typeof explosionConfigManager !== 'undefined') {
            const preset = explosionConfigManager.getPreset(presetId);
            if (preset && preset.ringDurationMs) duration = preset.ringDurationMs;
        }
        this.explosionDuration = duration;
        // Resources appear the moment the enemy dies, not after the explosion ends.
        this.pickupsSpawnedAtDeath = false;
        if (this.enemy && typeof pickupManager !== 'undefined' && pickupManager.spawnFromKill) {
            const entry = this.pendingChampionEntry || {};
            pickupManager.spawnFromKill({
                type: entry.type || this.currentShipType,
                entryId: entry.id || this.enemy.entryId,
                faction: entry.faction || this.enemy.faction,
                enemyClass: entry.enemyClass || this.enemy.enemyClass,
                cluster: entry.cluster || this.enemy.cluster,
                champion: true,
                x: this.enemy.x + (this.enemy.width || 0) / 2,
                y: this.enemy.y + (this.enemy.height || 0) / 2
            });
            this.pickupsSpawnedAtDeath = true;
        }
        if (this.enemy && typeof explosionSystem !== 'undefined') {
            const ex = this.enemy.x + (this.enemy.width || 0) / 2;
            const ey = this.enemy.y + (this.enemy.height || 0) / 2;
            explosionSystem.play(presetId, ex, ey, {
                width: this.enemy.width,
                height: this.enemy.height,
                silent: true,
                ship: this.enemy,
                voxelPower: 1.15
            });
        }
    },

    isExploding() {
        return this.exploding;
    },

    updateExplosion(deltaTime) {
        if (!this.exploding) return false;

        this.explosionTimer += deltaTime;
        if (this.explosionTimer >= this.explosionDuration) {
            this.exploding = false;
            return true; // Explosion finished
        }
        return false;
    },

    getEnemies() {
        return this.enemy ? [this.enemy] : [];
    },

    getEnemy() {
        return this.enemy;
    },

    getHealth() {
        return this.health;
    },

    getMaxHealth() {
        return this.maxHealth;
    },

    updateEvasion(deltaTime, game) {
        this.evasionTimer += deltaTime;

        // Check if enemy should start evading (improved detection)
        if (!this.isEvading && this.evasionTimer >= this.evasionCooldown) {
            // Check if player bullets are nearby
            const bullets = bulletManager.getBullets();
            const enemyCenterX = this.enemy.x + this.enemy.width / 2;
            const enemyCenterY = this.enemy.y + this.enemy.height / 2;

            for (let bullet of bullets) {
                const bulletCenterX = bullet.x + bullet.width / 2;
                const bulletCenterY = bullet.y + bullet.height / 2;
                const distance = Math.sqrt((bulletCenterX - enemyCenterX) ** 2 + (bulletCenterY - enemyCenterY) ** 2);

                // If bullet is close, start evading (increased detection range)
                const evasionFreqMul = this.enemy.flightProfile ? this.enemy.flightProfile.evasionFreqMul : 1;
                const evasionBeatPulse = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
                    ? beatSyncManager.getEvasionFreqPulse()
                    : 1;
                if (distance < 100) {
                    // One roll per cooldown: rolling every frame made any
                    // chance above zero a near-certain dodge.
                    if (Math.random() <= this.evasionChance * evasionFreqMul * evasionBeatPulse) {
                        this.startEvasion();
                    } else {
                        this.evasionTimer = 0;
                    }
                    break;
                }
            }
        }

        // Check for nearby obstacles and avoid them
        this.avoidObstacles(game);

        // Update evasion movement
        if (this.isEvading) {
            if (this.evasionTimer >= this.evasionDuration) {
                this.stopEvasion();
            } else {
                // Move away from player bullets with improved logic
                const bullets = bulletManager.getBullets();
                if (bullets.length > 0) {
                    // Find the closest bullet instead of just using the first one
                    let closestBullet = bullets[0];
                    let closestBulletDistance = Infinity;
                    const enemyCenterX = this.enemy.x + this.enemy.width / 2;
                    const enemyCenterY = this.enemy.y + this.enemy.height / 2;

                    for (let bullet of bullets) {
                        const bulletCenterX = bullet.x + bullet.width / 2;
                        const bulletCenterY = bullet.y + bullet.height / 2;
                        const distance = Math.sqrt((bulletCenterX - enemyCenterX) ** 2 + (bulletCenterY - enemyCenterY) ** 2);

                        if (distance < closestBulletDistance) {
                            closestBulletDistance = distance;
                            closestBullet = bullet;
                        }
                    }

                    const bulletCenterX = closestBullet.x + closestBullet.width / 2;
                    const bulletCenterY = closestBullet.y + closestBullet.height / 2;

                    // Calculate evasion direction with better logic
                    const player = (typeof playerManager !== 'undefined') ? playerManager.getPosition() : null;
                    const playerX = player ? player.x : enemyCenterX;
                    const playerY = player ? player.y : enemyCenterY;
                    const previous = this.lastPlayerPosition || { x: playerX, y: playerY };
                    const lead = Math.max(0, Math.min(1, this.predictionSkill));
                    const predictedX = playerX + (playerX - previous.x) * lead * 8;
                    const predictedY = playerY + (playerY - previous.y) * lead * 8;
                    this.lastPlayerPosition = { x: playerX, y: playerY };
                    const deltaX = enemyCenterX - bulletCenterX + (predictedX - playerX) * 0.25;
                    const deltaY = enemyCenterY - bulletCenterY + (predictedY - playerY) * 0.25;

                    // Normalize the evasion vector
                    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    if (magnitude > 0) {
                        const normalizedX = deltaX / magnitude;
                        const normalizedY = deltaY / magnitude;

                        // Apply evasion movement with strength based on distance
                        const evasionStrength = Math.max(0.6, 1.0 - (closestBulletDistance / 100));
                        this.enemy.x += normalizedX * this.evasionSpeed * evasionStrength;
                        this.enemy.y += normalizedY * this.evasionSpeed * evasionStrength;
                    }

                    // Keep enemy on screen with robust boundary checking
                    const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
                    this.enemy.x = Math.max(0, Math.min(canvasWidth - this.enemy.width, this.enemy.x));
                    this.enemy.y = Math.max(this.enemy.minY, Math.min(this.enemy.maxY, this.enemy.y));

                    // Force enemy back if it somehow escaped
                    if (this.enemy.x < 0) this.enemy.x = 0;
                    if (this.enemy.x > canvasWidth - this.enemy.width) this.enemy.x = canvasWidth - this.enemy.width;
                    if (this.enemy.y < this.enemy.minY) this.enemy.y = this.enemy.minY;
                    if (this.enemy.y > this.enemy.maxY) this.enemy.y = this.enemy.maxY;
                }
            }
        }
    },

    /**
     * Predictive obstacle steering for any enemy-like entity. Sweeps each
     * obstacle along its velocity and scores a handful of candidate spots
     * around the entity by how soon it would be hit there; if the current
     * spot is threatened, returns a push towards the nearest safe spot (so a
     * ship facing a row of rocks slides to the gap instead of being pushed
     * back and forth between neighbours). Returns { x, y } in -1..1-ish
     * units, or null if nothing threatens.
     */
    computeObstacleAvoidance(entity) {
        if (!entity || typeof obstacleManager === 'undefined') return null;
        const all = obstacleManager.getObstacles() || [];
        const ex = entity.x + entity.width / 2;
        const ey = entity.y + entity.height / 2;
        const pad = 12;
        const lookahead = 110; // frames
        const obstacles = [];
        for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (!o || o.isFog) continue;
            const vx = o.horizontalSpeed || 0;
            const vy = o.verticalSpeed || 0;
            const ox = o.x + o.width / 2;
            const oy = o.y + o.height / 2;
            // Skip anything that can't come near within the lookahead.
            const range = Math.hypot(vx, vy) * lookahead + 90;
            if (Math.abs(ox - ex) > range || Math.abs(oy - ey) > range) continue;
            obstacles.push({ ox, oy, vx, vy, rw: (entity.width + o.width) / 2 + pad, rh: (entity.height + o.height) / 2 + pad });
        }
        if (!obstacles.length) return null;

        // Danger at an offset: 0 = safe, up to ~1 per obstacle (sooner = worse).
        const danger = (dx, dy) => {
            const px = ex + dx;
            const py = ey + dy;
            let d = 0;
            for (let i = 0; i < obstacles.length; i++) {
                const o = obstacles[i];
                const rx = px - o.ox;
                const ry = py - o.oy;
                const v2 = o.vx * o.vx + o.vy * o.vy;
                // Time window where the swept box overlaps on each axis.
                let t0 = 0;
                let t1 = lookahead;
                const axis = (r, v, reach) => {
                    if (Math.abs(v) < 0.0001) {
                        if (Math.abs(r) > reach) t1 = -1;
                        return;
                    }
                    let a = (r - reach) / v;
                    let b = (r + reach) / v;
                    if (a > b) { const tmp = a; a = b; b = tmp; }
                    t0 = Math.max(t0, a);
                    t1 = Math.min(t1, b);
                };
                if (v2 < 0.0001) {
                    if (Math.abs(rx) > o.rw || Math.abs(ry) > o.rh) continue;
                } else {
                    axis(rx, o.vx, o.rw);
                    axis(ry, o.vy, o.rh);
                    if (t0 > t1) continue;
                }
                d += 1.2 - t0 / lookahead;
            }
            return d;
        };

        const here = danger(0, 0);
        if (here <= 0) return null;
        const minY = entity.minY != null ? entity.minY : -Infinity;
        const maxY = entity.maxY != null ? entity.maxY : Infinity;
        let best = null;
        let bestScore = here;
        for (let dx = -96; dx <= 96; dx += 12) {
            for (let dy = -24; dy <= 24; dy += 24) {
                if (!dx && !dy) continue;
                if (entity.y + dy < minY || entity.y + dy > maxY) continue;
                // Distance costs a little: prefer the closest escape.
                const score = danger(dx, dy) + Math.hypot(dx, dy) / 400;
                if (score < bestScore) {
                    bestScore = score;
                    best = { x: dx, y: dy };
                }
            }
        }
        if (!best) return null;
        const threat = Math.min(1.4, 0.5 + here * 0.5);
        const m = Math.hypot(best.x, best.y) || 1;
        return { x: (best.x / m) * threat, y: (best.y / m) * threat };
    },

    avoidObstacles(game) {
        const push = this.computeObstacleAvoidance(this.enemy);
        if (!push) return;
        const speed = Math.max(this.evasionSpeed || 1.5, 1.2);
        this.enemy.x += push.x * speed * 1.4;
        this.enemy.y += push.y * speed;
        const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
        this.enemy.x = Math.max(0, Math.min(canvasWidth - this.enemy.width, this.enemy.x));
        this.enemy.y = Math.max(this.enemy.minY, Math.min(this.enemy.maxY, this.enemy.y));
    },

    startEvasion() {
        this.isEvading = true;
        this.evasionTimer = 0;
    },

    stopEvasion() {
        this.isEvading = false;
        this.evasionTimer = 0;
    },

    async reset() {
        this.enemy = null;
        this.health = this.maxHealth;
        this.shield = this.shieldMax;
        this.exploding = false;
        this.explosionTimer = 0;
        this.isEvading = false;
        this.evasionTimer = 0;
        this.sideEnemies = [];
        this.scheduleElapsedMs = 0;
        this.pendingChampionEntry = null;
        this.activeCombatEvents = [];
        this.firedCombatEventIds = {};
        this.combatEventCooldowns = {};
        this.pendingCombatAnnounces = {};
        this.championCombatElapsedMs = 0;
        this.sideDebuffs = { jammer: false, tether: false };
        this.sideFleeing = false;
        this.schedule.forEach(e => { e.spawned = false; });

        if (!this.currentEnemyModel) {
            await this.setShipType(this.currentShipType);
        }

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.start(
                objectiveManager.objective || { type: 'hunt', targetEnemyId: (this.schedule[0] && this.schedule[0].id) },
                this.schedule
            );
        }

        if (!this.spawnFrozen) {
            const fakeState = {
                width: (typeof game !== 'undefined' && (game.internalWidth || game.width)) || 200,
                height: (typeof game !== 'undefined' && (game.internalHeight || game.height)) || 300
            };
            this.updateSchedule(0, fakeState);
        }
    },
});
