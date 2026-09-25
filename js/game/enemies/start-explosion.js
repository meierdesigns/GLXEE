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

    avoidObstacles(game) {
        const obstacles = obstacleManager.getObstacles();
        const enemyCenterX = this.enemy.x + this.enemy.width / 2;
        const enemyCenterY = this.enemy.y + this.enemy.height / 2;
        
        // Find the closest obstacle
        let closestObstacle = null;
        let closestDistance = Infinity;
        
        for (let obstacle of obstacles) {
            const obstacleCenterX = obstacle.x + obstacle.width / 2;
            const obstacleCenterY = obstacle.y + obstacle.height / 2;
            const distance = Math.sqrt((obstacleCenterX - enemyCenterX) ** 2 + (obstacleCenterY - enemyCenterY) ** 2);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestObstacle = obstacle;
            }
        }
        
        // If obstacle is close, avoid it with improved logic
        if (closestObstacle && closestDistance < 80) { // Increased detection range from 60 to 80
            const obstacleCenterX = closestObstacle.x + closestObstacle.width / 2;
            const obstacleCenterY = closestObstacle.y + closestObstacle.height / 2;
            
            // Calculate avoidance direction with better logic
            const deltaX = enemyCenterX - obstacleCenterX;
            const deltaY = enemyCenterY - obstacleCenterY;
            
            // Normalize the avoidance vector
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (magnitude > 0) {
                const normalizedX = deltaX / magnitude;
                const normalizedY = deltaY / magnitude;
                
                // Apply stronger avoidance movement
                const avoidanceStrength = Math.max(0.8, 1.2 - (closestDistance / 80)); // Stronger when closer
                this.enemy.x += normalizedX * this.evasionSpeed * avoidanceStrength;
                this.enemy.y += normalizedY * this.enemy.verticalSpeed * avoidanceStrength;
            }
            
            // Keep enemy within bounds with robust boundary checking
            const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
            this.enemy.x = Math.max(0, Math.min(canvasWidth - this.enemy.width, this.enemy.x));
            this.enemy.y = Math.max(this.enemy.minY, Math.min(this.enemy.maxY, this.enemy.y));
            
            // Force enemy back if it somehow escaped
            if (this.enemy.x < 0) this.enemy.x = 0;
            if (this.enemy.x > canvasWidth - this.enemy.width) this.enemy.x = canvasWidth - this.enemy.width;
            if (this.enemy.y < this.enemy.minY) this.enemy.y = this.enemy.minY;
            if (this.enemy.y > this.enemy.maxY) this.enemy.y = this.enemy.maxY;
        }
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
