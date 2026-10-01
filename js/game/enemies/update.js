"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    update(deltaTime, gameState) {
        this.updateSchedule(deltaTime, gameState);
        if (this.updateDirector) this.updateDirector(deltaTime, gameState);
        this.updateSideEnemies(deltaTime, gameState);

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.update(deltaTime);
        }

        if (!this.enemy) return;

        if (!this.exploding) {
            this.championCombatElapsedMs += deltaTime;
            this.evaluateCombatEvents(gameState);
        }

        // Apply slow motion cheat
        let effectiveDeltaTime = deltaTime;
        if (gameState && gameState.cheats && gameState.cheats.slowMotion) {
            effectiveDeltaTime = deltaTime * 0.3; // Slow down to 30% speed
        }

        if (!this.exploding && this.shieldMax > 0 && this.shield < this.shieldMax && this.shieldRegen > 0) {
            const hasRegen = !this.defenseMechanisms.length
                || this.defenseMechanisms.indexOf('shield_regen') !== -1
                || this.shieldRegen > 0;
            if (hasRegen) {
                this.shield = Math.min(this.shieldMax, this.shield + this.shieldRegen * (effectiveDeltaTime / 1000));
            }
        }

        // Update explosion if enemy is exploding
        if (this.exploding) {
            const explosionFinished = this.updateExplosion(effectiveDeltaTime);
            if (explosionFinished) {
                const entry = this.pendingChampionEntry || (this.enemy && {
                    id: this.enemy.entryId,
                    type: this.currentShipType,
                    champion: true
                });
                this.notifyKill({
                    type: (entry && entry.type) || this.currentShipType,
                    entryId: (entry && entry.id) || (this.enemy && this.enemy.entryId),
                    faction: (entry && entry.faction) || (this.enemy && this.enemy.faction),
                    enemyClass: (entry && entry.enemyClass) || (this.enemy && this.enemy.enemyClass),
                    cluster: (entry && entry.cluster) || (this.enemy && this.enemy.cluster),
                    champion: true,
                    x: this.enemy ? this.enemy.x + this.enemy.width / 2 : undefined,
                    y: this.enemy ? this.enemy.y + this.enemy.height / 2 : undefined
                });
                this.enemy = null;
                this.pendingChampionEntry = null;
                this.activeCombatEvents = [];
                this.pendingCombatAnnounces = {};
                this.sideDebuffs = { jammer: false, tether: false };
            }
            return; // Don't update enemy movement during explosion
        }

        // Update enemy position (move left/right and up/down)
        // Calculate frame-rate independent speed multiplier
        let speedMultiplier = effectiveDeltaTime / 16.67; // 16.67ms = 60 FPS baseline
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
            speedMultiplier *= beatSyncManager.getEnemySpeedMul();
            this.enemy.y += beatSyncManager.getEnemyBobOffset() * 0.15;
        }
        this.enemy.x += this.enemy.speed * speedMultiplier;
        this.enemy.y += this.enemy.verticalSpeed * speedMultiplier;

        // Faction/class flight wobble, amplified on downbeats
        const enemyFlightProfile = this.enemy.flightProfile;
        if (enemyFlightProfile && enemyFlightProfile.wobbleAmp > 0) {
            this.enemy.wobblePhase = (this.enemy.wobblePhase || 0) + enemyFlightProfile.wobbleFreq * (effectiveDeltaTime / 1000);
            let wobbleBoost = 1;
            if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                wobbleBoost = beatSyncManager.getWobbleAmpMul();
            }
            this.enemy.x += Math.sin(this.enemy.wobblePhase) * enemyFlightProfile.wobbleAmp * wobbleBoost * speedMultiplier;
        }

        // Get current canvas dimensions with multiple fallbacks
        const canvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
        const canvasHeight = game?.internalHeight || game?.baseHeight || game?.height || 300;

        // Bounce off walls horizontally with safety margins
        if (this.enemy.x <= 0) {
            this.enemy.x = 0;
            this.enemy.speed = Math.abs(this.enemy.speed); // Force positive speed
        } else if (this.enemy.x >= canvasWidth - this.enemy.width) {
            this.enemy.x = canvasWidth - this.enemy.width;
            this.enemy.speed = -Math.abs(this.enemy.speed); // Force negative speed
        }

        // Bounce off vertical boundaries (1/3 of screen) with safety margins
        if (this.enemy.y <= this.enemy.minY) {
            this.enemy.y = this.enemy.minY;
            this.enemy.verticalSpeed = Math.abs(this.enemy.verticalSpeed); // Force positive speed
        } else if (this.enemy.y >= this.enemy.maxY) {
            this.enemy.y = this.enemy.maxY;
            this.enemy.verticalSpeed = -Math.abs(this.enemy.verticalSpeed); // Force negative speed
        }

        // Enemy evasion behavior
        this.updateEvasion(deltaTime, game);
        if (this.enemy.isBoss && this.updateBoss) this.updateBoss(effectiveDeltaTime, gameState);

        // Enemy shooting - use model-specific shooting interval (only if not exploding)
        if (!this.exploding) {
            let shootChance = 0.002; // Reduced default 0.2% chance per frame
            if (this.currentEnemyModel && this.currentEnemyModel.shootInterval) {
                // Convert shootInterval (ms) to chance per frame (60 FPS) with reduced rate
                shootChance = (60 / this.currentEnemyModel.shootInterval) * 0.4; // 40% of original rate
            }
            if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                if (beatSyncManager.justDownbeat) shootChance = Math.max(shootChance, 0.65);
                else if (beatSyncManager.justBeat && beatSyncManager.barBeat === 2) {
                    shootChance = Math.max(shootChance, 0.35);
                } else {
                    shootChance *= 0.25;
                }
            }

            // Bosses fire only their own patterns (boss.js).
            if (!this.enemy.isBoss && Math.random() < shootChance) {
                bulletManager.enemyShoot(this.enemy);
            }
        }

        const finalCanvasWidth = game?.internalWidth || game?.baseWidth || game?.width || 200;
        this.avoidTerrainWalls(finalCanvasWidth);

        // Final safety check - force enemy back into bounds if it somehow escaped
        if (this.enemy.x < 0) {
            console.warn('Enemy escaped left boundary, forcing back');
            this.enemy.x = 0;
            this.enemy.speed = Math.abs(this.enemy.speed);
        }
        if (this.enemy.x > finalCanvasWidth - this.enemy.width) {
            console.warn('Enemy escaped right boundary, forcing back');
            this.enemy.x = finalCanvasWidth - this.enemy.width;
            this.enemy.speed = -Math.abs(this.enemy.speed);
        }
        if (this.enemy.y < this.enemy.minY) {
            console.warn('Enemy escaped top boundary, forcing back');
            this.enemy.y = this.enemy.minY;
            this.enemy.verticalSpeed = Math.abs(this.enemy.verticalSpeed);
        }
        if (this.enemy.y > this.enemy.maxY) {
            console.warn('Enemy escaped bottom boundary, forcing back');
            this.enemy.y = this.enemy.maxY;
            this.enemy.verticalSpeed = -Math.abs(this.enemy.verticalSpeed);
        }
    },

    /**
     * Scrolling stages: steer away from the canyon walls before touching
     * them (looking a bit ahead, since the walls scroll down), and never
     * overlap them — the enemy turns around like at the screen edge.
     */
    avoidTerrainWalls(W) {
        if (typeof obstacleManager === 'undefined' || !obstacleManager.terrainWallsOver || !this.enemy) return;
        const e = this.enemy;
        const walls = obstacleManager.terrainWallsOver(e.y - 12, e.y + e.height + 4, W);
        if (!walls) return;
        const margin = 4;
        const steer = 14; // start turning this far from a wall
        const left = walls.left + margin;
        const right = walls.right - margin;
        if (right - left < e.width) {
            e.x = (walls.left + walls.right - e.width) / 2;
            return;
        }
        if (e.x < left + steer) {
            e.x += Math.min(1.2, (left + steer - e.x) * 0.15);
            if (e.speed < 0) e.speed = Math.abs(e.speed);
        } else if (e.x + e.width > right - steer) {
            e.x -= Math.min(1.2, (e.x + e.width - (right - steer)) * 0.15);
            if (e.speed > 0) e.speed = -Math.abs(e.speed);
        }
        if (e.x < left) e.x = left;
        if (e.x + e.width > right) e.x = right - e.width;
    },
});
