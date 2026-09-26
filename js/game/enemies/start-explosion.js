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
        if (this.enemy && typeof explosionSystem !== 'undefined') {
            const ex = this.enemy.x + (this.enemy.width || 0) / 2;
            const ey = this.enemy.y + (this.enemy.height || 0) / 2;
            explosionSystem.play(presetId, ex, ey, {
                width: this.enemy.width,
                height: this.enemy.height,
                silent: true
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
                if (distance < 100 && Math.random() <= this.evasionChance * evasionFreqMul * evasionBeatPulse) {
                    this.startEvasion();
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
     * Predictive obstacle steering for any enemy-like entity. Looks ahead
     * along each obstacle's velocity, keeps only those whose swept path
     * reaches the entity's padded box, and sums a sideways push (perpendicular
     * to the obstacle's travel, away from its line) weighted by urgency.
     * Returns { x, y } in -1..1-ish units, or null if nothing threatens.
     */
    computeObstacleAvoidance(entity) {
        if (!entity || typeof obstacleManager === 'undefined') return null;
        const obstacles = obstacleManager.getObstacles() || [];
        const ex = entity.x + entity.width / 2;
        const ey = entity.y + entity.height / 2;
        const pad = 10;
        const lookahead = 45; // frames
        let ax = 0;
        let ay = 0;
        let threat = 0;
        for (let i = 0; i < obstacles.length; i++) {
            const o = obstacles[i];
            if (!o || o.isFog) continue;
            const ox = o.x + o.width / 2;
            const oy = o.y + o.height / 2;
            const vx = o.horizontalSpeed || 0;
            const vy = o.verticalSpeed || 0;
            const rx = ex - ox;
            const ry = ey - oy;
            const reach = (entity.width + o.width) / 2 + pad;
            const reachY = (entity.height + o.height) / 2 + pad;
            // Closest approach time along obstacle velocity (relative frame).
            const v2 = vx * vx + vy * vy;
            let t = v2 > 0.0001 ? (rx * vx + ry * vy) / v2 : 0;
            t = Math.max(0, Math.min(lookahead, t));
            const cx = rx - vx * t;
            const cy = ry - vy * t;
            if (Math.abs(cx) > reach || Math.abs(cy) > reachY) continue;
            // Urgency: sooner and more central = stronger.
            const soon = 1 - t / lookahead;
            const central = 1 - Math.min(1, Math.hypot(cx / reach, cy / reachY));
            const w = 0.35 + soon * 0.4 + central * 0.25;
            // Push away from the obstacle's path; if dead-centre, pick the
            // side perpendicular to its travel that points into open space.
            let px = cx;
            let py = cy;
            if (Math.hypot(px, py) < 1) {
                px = -vy;
                py = vx;
                if (px * rx + py * ry < 0) { px = -px; py = -py; }
            }
            const m = Math.hypot(px, py) || 1;
            ax += (px / m) * w;
            ay += (py / m) * w;
            threat = Math.max(threat, w);
        }
        if (threat <= 0) return null;
        const m = Math.hypot(ax, ay) || 1;
        return { x: (ax / m) * threat, y: (ay / m) * threat };
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
