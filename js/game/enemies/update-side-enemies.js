"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    updateSideEnemies(deltaTime, gameState) {
        if (!gameState) return;
        const canSpawnSides = !this.sideFleeing && !this.spawnFrozen
            && !!(this.enemy && !this.exploding);
        if (canSpawnSides && !this.schedule.length && this.sideEnemyPool.length) {
            this.sideEnemySpawnTimer += deltaTime;
            if (this.sideEnemySpawnTimer >= this.sideEnemySpawnInterval) {
                this.sideEnemySpawnTimer = 0;
                if (this.sideEnemies.length < this.sideEnemyCap && Math.random() < 0.25) {
                    this.spawnSideEnemy(gameState);
                }
            }
        }
        const canvasWidth = gameState.width || 200;
        const canvasHeight = gameState.height || 300;
        let speedMul = (deltaTime || 16.67) / 16.67;
        if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
            speedMul *= beatSyncManager.getEnemySpeedMul();
        }
        const bobY = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
            ? beatSyncManager.getEnemyBobOffset()
            : 0;
        const mainAlive = this.enemy && !this.exploding;
        // Keep calling while the field is clearing so late / stuck sides also flee.
        if (!mainAlive && this.sideEnemies.length) {
            this.beginSideEnemyFlee(gameState);
        }
        const pendingCluster = this.pendingChampionEntry
            ? (this.pendingChampionEntry.cluster || 'alpha')
            : null;
        let hasJammer = false;
        let hasTether = false;

        for (let i = this.sideEnemies.length - 1; i >= 0; i--) {
            const e = this.sideEnemies[i];
            const eCluster = e.cluster || 'alpha';
            const teamWithMain = mainAlive && eCluster === (this.enemy.cluster || 'alpha');
            const teamPending = !!pendingCluster && eCluster === pendingCluster;
            const role = e.role || 'assault';
            e.repairBeamActive = false;

            if (e.isEscort && e.formationReleaseAt && Date.now() >= e.formationReleaseAt
                && Math.random() < 0.08) {
                e.isEscort = false;
                e.escortSlot = -1;
                e.speed = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.35);
                e.verticalSpeed = (Math.random() - 0.5) * 0.7;
                e.lifetimeMs = 12000 + Math.random() * 7000;
            }

            const pad = 4;
            const w = e.width || 8;
            const h = e.height || 8;
            // Corridor bounds from terrain walls (fallback: canvas edges).
            let laneLeft = pad;
            let laneRight = canvasWidth - pad;
            if (!e.fleeing && typeof obstacleManager !== 'undefined'
                && obstacleManager.terrainWallsOver) {
                const walls = obstacleManager.terrainWallsOver(
                    e.y - 8, e.y + h + 4, canvasWidth
                );
                if (walls) {
                    laneLeft = walls.left + pad;
                    laneRight = walls.right - pad;
                    if (laneRight - laneLeft < w) {
                        const mid = (walls.left + walls.right) * 0.5;
                        laneLeft = mid - w * 0.5;
                        laneRight = mid + w * 0.5;
                    }
                }
            }
            const clampX = (x) => Math.max(laneLeft, Math.min(laneRight - w, x));
            const clampY = (y) => Math.max(pad, Math.min(canvasHeight - h - pad, y));
            // Binary presence: inside = active, outside = fled / irrelevant.
            const fullyInside = e.x >= 0 && e.x + w <= canvasWidth
                && e.y >= 0 && e.y + h <= canvasHeight;

            if (e.lifetimeMs != null && e.lifetimeMs <= 0 && !e.fleeing && !e.entering) {
                // Lifetime flyby done → flee out (then cull as outside).
                e.fleeing = true;
                e.isEscort = false;
                e.entering = false;
                const awayX = (e.x + w * 0.5) < canvasWidth * 0.5 ? -1 : 1;
                e.speed = awayX * (1.55 + Math.random() * 0.85);
                e.verticalSpeed = -(1.55 + Math.random() * 0.75);
            }

            if (e.entering && !e.fleeing) {
                // Rim transit through an empty edge opening — not combat-ready yet.
                const tx = e.entryTargetX != null ? e.entryTargetX : clampX(e.x);
                const ty = e.entryTargetY != null ? e.entryTargetY : e.y;
                if (e.isEscort && (teamWithMain || teamPending) && mainAlive) {
                    e.entryTargetX = clampX(this.enemy.x + this.enemy.width * 0.5
                        + (e.formOffsetX || 0) - e.width * 0.5);
                    e.entryTargetY = clampY(this.enemy.y + this.enemy.height * 0.5
                        + (e.formOffsetY || 0) - e.height * 0.5);
                }
                const dir = e.entryFromSide === 1 ? -1 : 1;
                const spd = Math.max(0.75, Math.abs(e.speed) || 1);
                e.x += dir * spd * speedMul;
                // Nudge toward the gap row / formation Y while sliding in.
                e.y += ((e.entryTargetY != null ? e.entryTargetY : ty) - e.y)
                    * Math.min(1, 0.12 * speedMul);
                const reachedX = e.entryFromSide === 1 ? e.x <= tx : e.x >= tx;
                if (reachedX) {
                    e.x = clampX(tx);
                    e.y = clampY(e.entryTargetY != null ? e.entryTargetY : ty);
                    e.entering = false;
                    e.arrived = true;
                    e.entryFromSide = null;
                    if (e.isEscort && (teamWithMain || teamPending)) {
                        e.speed = 0;
                        e.verticalSpeed = 0;
                    } else {
                        e.speed = e.cruiseSpeed != null
                            ? e.cruiseSpeed
                            : (-0.35 - Math.random() * 0.25);
                        e.verticalSpeed = e.cruiseVerticalSpeed != null
                            ? e.cruiseVerticalSpeed
                            : (Math.random() - 0.5) * 0.25;
                    }
                }
            } else if (e.fleeing) {
                // Exit flight — no combat; remove as soon as fully outside.
                const fx = e.speed || ((e.x + w * 0.5) < canvasWidth * 0.5 ? -1.6 : 1.6);
                const fy = (e.verticalSpeed != null && e.verticalSpeed < -0.2)
                    ? e.verticalSpeed
                    : -1.6;
                e.speed = fx;
                e.verticalSpeed = fy;
                e.x += fx * speedMul;
                e.y += fy * speedMul;
            } else if (e.isEscort && mainAlive && (teamWithMain || teamPending)) {
                const formationTightness = e.flightProfile ? e.flightProfile.formationTightness : 1;
                const formationPulse = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
                    ? beatSyncManager.getFormationPulseMul()
                    : 1;
                const tx = clampX(this.enemy.x + this.enemy.width * 0.5
                    + (e.formOffsetX || 0) - e.width * 0.5);
                const ty = clampY(this.enemy.y + this.enemy.height * 0.5
                    + (e.formOffsetY || 0) - e.height * 0.5);
                const follow = Math.min(1, 0.08 * speedMul * formationTightness * formationPulse);
                e.x += (tx - e.x) * follow;
                e.y += (ty - e.y) * follow;
                e.x = clampX(e.x);
                e.y = clampY(e.y);
                if (this.avoidTerrainWalls) this.avoidTerrainWalls(canvasWidth, e);
                e.speed = 0;
                e.verticalSpeed = 0;
                e.arrived = true;
            } else {
                if (e.isEscort) {
                    e.isEscort = false;
                    if (!e.speed) e.speed = (-0.3 - Math.random() * 0.2);
                    if (!e.verticalSpeed) e.verticalSpeed = (Math.random() - 0.5) * 0.2;
                    if (!e.lifetimeMs) e.lifetimeMs = 12000 + Math.random() * 6000;
                }
                e.x += e.speed * speedMul;
                e.y += e.verticalSpeed * speedMul;
                if (e.flightProfile && e.flightProfile.wobbleAmp > 0) {
                    e.wobblePhase = (e.wobblePhase || 0) + e.flightProfile.wobbleFreq * ((deltaTime || 16.67) / 1000);
                    const wobbleBoost = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
                        ? beatSyncManager.getWobbleAmpMul()
                        : 1;
                    e.x += Math.sin(e.wobblePhase) * e.flightProfile.wobbleAmp * wobbleBoost * speedMul;
                }
                if (bobY) e.y += bobY * 0.12;
                const push = this.computeObstacleAvoidance(e);
                if (push) {
                    e.x += push.x * 1.6 * speedMul;
                    e.y += push.y * 1.2 * speedMul;
                }
                if (e.y < 10 || e.y > canvasHeight - 10) e.verticalSpeed *= -1;
                if (e.x + w > laneRight - 4 && e.speed > 0) e.speed = -Math.abs(e.speed);
                if (e.x < laneLeft + 4 && e.speed < 0 && (e.lifetimeMs == null || e.lifetimeMs > 4000)) {
                    e.speed = Math.abs(e.speed) * 0.85;
                }
                if (e.lifetimeMs != null) e.lifetimeMs -= deltaTime;
                // Active craft stay in the corridor — never into the rock walls.
                e.x = clampX(e.x);
                e.y = clampY(e.y);
                if (this.avoidTerrainWalls) this.avoidTerrainWalls(canvasWidth, e);
                e.arrived = true;
            }

            if (mainAlive && !e.fleeing && !e.entering && (role === 'repair' || role === 'shieldBattery')) {
                const dx = (e.x + e.width / 2) - (this.enemy.x + this.enemy.width / 2);
                const dy = (e.y + e.height / 2) - (this.enemy.y + this.enemy.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const range = e.repairRange || 70;
                if (dist <= range) {
                    const dtSec = deltaTime / 1000;
                    if (role === 'repair' && this.health < this.maxHealth) {
                        const heal = Math.min(e.repairRate || 6, 10) * dtSec;
                        this.health = Math.min(this.maxHealth, this.health + heal);
                        e.repairBeamActive = true;
                    }
                    if (role === 'shieldBattery' && this.shieldMax > 0 && this.shield < this.shieldMax) {
                        const recharge = Math.min(e.shieldBatteryRate || 8, 12) * dtSec;
                        this.shield = Math.min(this.shieldMax, this.shield + recharge);
                        e.repairBeamActive = true;
                    }
                }
            }

            // Combat only while fully inside (not entering, not fleeing).
            if (fullyInside && !e.entering && !e.fleeing
                && (role === 'gunner' || role === 'assault' || role === 'blocker' || role === 'bomber')) {
                e.shootTimer = (e.shootTimer || 0) + deltaTime;
                let interval = e.shootInterval || 1900;
                if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                    const beatMs = beatSyncManager.beatDurationMs();
                    interval = Math.max(beatMs * 2, interval * 0.85);
                    if (e.shootTimer >= interval * 0.7 && beatSyncManager.justDownbeat) {
                        e.shootTimer = interval;
                    }
                }
                if (e.shootTimer >= interval) {
                    e.shootTimer = 0;
                    if (typeof bulletManager !== 'undefined' && bulletManager.enemyShoot) {
                        bulletManager.enemyShoot(e);
                    }
                }
            }

            if (!e.fleeing && !e.entering && role === 'jammer') hasJammer = true;
            if (!e.fleeing && !e.entering && role === 'tether') hasTether = true;

            if (e.shieldMax > 0 && e.shield < e.shieldMax && e.shieldRegen > 0) {
                const mechs = e.abilities || e.defenseMechanisms || [];
                const canRegen = !mechs.length || mechs.indexOf('shield_regen') !== -1
                    || e.shieldRegen > 0;
                if (canRegen) {
                    e.shield = Math.min(e.shieldMax, e.shield + e.shieldRegen * (deltaTime / 1000));
                }
            }

            // Outside = fled / irrelevant → drop (re-check after this frame's move).
            const nowOutside = e.x + w < 0 || e.x > canvasWidth
                || e.y + h < 0 || e.y > canvasHeight;
            if (!(e.entering && !e.fleeing) && nowOutside) {
                this.sideEnemies.splice(i, 1);
            }
        }

        this.sideDebuffs.jammer = hasJammer;
        this.sideDebuffs.tether = hasTether;
        if (this.sideFleeing && (!this.sideEnemies || !this.sideEnemies.length)
            && !this.exploding && !this.enemy) {
            this.sideFleeing = false;
        }
    },

    hasJammerDebuff() {
        return !!(this.sideDebuffs && this.sideDebuffs.jammer);
    },

    hasTetherDebuff() {
        return !!(this.sideDebuffs && this.sideDebuffs.tether);
    },

    /** True when every scheduled foe is done and nothing is left alive. */
    isFieldClear() {
        if (this.enemy || this.exploding) return false;
        if (this.sideEnemies && this.sideEnemies.length > 0) return false;
        // Entries parked at 999999 never spawn, and once the objective is done
        // updateSchedule holds back all normals — neither may block the win.
        const objectiveDone = typeof objectiveManager !== 'undefined' && objectiveManager.completed;
        if (this.schedule && this.schedule.some((e) => !e.spawned && e.spawnAt < 999999
            && (e.champion || !objectiveDone))) return false;
        return true;
    },

    getJammerCooldownMul() {
        return this.hasJammerDebuff() ? 1.75 : 1;
    },

    getTetherSpeedMul() {
        return this.hasTetherDebuff() ? 0.55 : 1;
    },

    notifyKill(info) {
        if (this.directorOnKill) this.directorOnKill(info);
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemyKilled(info);
        }
        const planetId = this.levelMods.planetId || 'mars';
        if (typeof dailyTracker !== 'undefined' && info) {
            dailyTracker.onEnemyKilled(planetId, info);
        }
        if (typeof levelInfoManager !== 'undefined' && levelInfoManager.stats) {
            levelInfoManager.stats.enemiesKilled = (levelInfoManager.stats.enemiesKilled || 0) + 1;
            if (levelInfoManager.updateElement) {
                levelInfoManager.updateElement('enemiesKilled', levelInfoManager.stats.enemiesKilled);
            }
        }
        if (typeof game !== 'undefined') {
            const points = info && info.champion ? 100 : 25;
            game.score = (game.score || 0) + points;
            if (typeof levelInfoManager !== 'undefined' && levelInfoManager.stats) {
                levelInfoManager.stats.score = game.score;
                if (levelInfoManager.updateElement) {
                    levelInfoManager.updateElement('currentScore', game.score);
                }
            }
        }
        if (typeof profileManager !== 'undefined' && profileManager.tryBlueprintDrop) {
            const dropped = profileManager.tryBlueprintDrop(info);
            if (dropped && typeof levelInfoManager !== 'undefined' && levelInfoManager.showLootNotice) {
                const name = (typeof shipConfigManager !== 'undefined')
                    ? shipConfigManager.getDisplayName(dropped)
                    : String(dropped).toUpperCase();
                levelInfoManager.showLootNotice('BLUEPRINT: ' + name);
            }
        }
        if (!(info && info.pickupsSpawned) && typeof pickupManager !== 'undefined' && pickupManager.spawnFromKill) {
            let x = info && info.x;
            let y = info && info.y;
            if ((x == null || y == null) && this.enemy) {
                x = this.enemy.x + this.enemy.width / 2;
                y = this.enemy.y + this.enemy.height / 2;
            }
            pickupManager.spawnFromKill(Object.assign({}, info || {}, { x: x, y: y }));
        }
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && info) {
            const enemyType = info.type || null;
            if (enemyType) profileManager.discoverEnemyContents(enemyType);
        } else if (typeof profileManager !== 'undefined' && profileManager.discover && info) {
            const enemyType = info.type || null;
            if (enemyType) profileManager.discover('enemies', enemyType);
        }
    },

    // Set enemy ship type based on level
    async setShipType(type) {
        this.currentShipType = type;

        // Update graphics manager
        if (typeof graphicsManager !== 'undefined') {
            graphicsManager.setEnemyShipType(type);
        }

        // Get ship model for weapon configuration
        this.currentEnemyModel = await this.getEnemyShipModel(type);

    },
});
