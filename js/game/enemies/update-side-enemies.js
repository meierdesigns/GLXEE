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
                if (this.sideEnemies.length < this.sideEnemyCap && Math.random() < 0.45) {
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
        if (!mainAlive && !this.sideFleeing && this.sideEnemies.length) {
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

            if (e.fleeing) {
                e.x += (e.speed || 0) * speedMul;
                e.y += (e.verticalSpeed || -1) * speedMul;
            } else if (role === 'bomber' && typeof playerManager !== 'undefined') {
                const player = playerManager.getPosition();
                if (player) {
                    const tx = player.x + player.width / 2;
                    const ty = player.y + player.height / 2;
                    const cx = e.x + e.width / 2;
                    const cy = e.y + e.height / 2;
                    const dx = tx - cx;
                    const dy = ty - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const spd = (e.bomberSpeed || 1.2) * speedMul;
                    e.isEscort = false;
                    e.x += (dx / dist) * spd;
                    e.y += (dy / dist) * spd;
                    e.speed = 0;
                    e.verticalSpeed = 0;
                }
            } else if (e.isEscort && (teamWithMain || teamPending)) {
                const formationTightness = e.flightProfile ? e.flightProfile.formationTightness : 1;
                const formationPulse = (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive())
                    ? beatSyncManager.getFormationPulseMul()
                    : 1;
                if (mainAlive) {
                    const tx = this.enemy.x + this.enemy.width * 0.5
                        + (e.formOffsetX || 0) - e.width * 0.5;
                    const ty = Math.max(8, Math.min(canvasHeight - e.height - 8,
                        this.enemy.y + this.enemy.height * 0.5
                        + (e.formOffsetY || 0) - e.height * 0.5));
                    const follow = Math.min(1, 0.08 * speedMul * formationTightness * formationPulse);
                    e.x += (tx - e.x) * follow;
                    e.y += (ty - e.y) * follow;
                } else {
                    const tx = canvasWidth * 0.55 + (e.formOffsetX || 0) - e.width * 0.5;
                    const ty = 40 + (e.formOffsetY || 0);
                    const follow = Math.min(1, 0.04 * speedMul * formationTightness * formationPulse);
                    e.x += (tx - e.x) * follow;
                    e.y += (ty - e.y) * follow;
                }
                e.speed = 0;
                e.verticalSpeed = 0;
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
                if (e.y < 10 || e.y > canvasHeight - 10) e.verticalSpeed *= -1;
                if (e.x > canvasWidth - 8 && e.speed > 0) e.speed = -Math.abs(e.speed);
                if (e.x < 8 && e.speed < 0 && e.lifetimeMs > 4000) {
                    e.speed = Math.abs(e.speed) * 0.85;
                }
                if (e.lifetimeMs != null) {
                    e.lifetimeMs -= deltaTime;
                    if (e.lifetimeMs <= 0) {
                        e.speed = -Math.max(0.45, Math.abs(e.speed));
                    }
                }
            }

            if (mainAlive && !e.fleeing && (role === 'repair' || role === 'shieldBattery')) {
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

            // Fire while fighting and while fleeing (even during champion explosion)
            if (role === 'gunner' || role === 'assault' || role === 'blocker') {
                e.shootTimer = (e.shootTimer || 0) + deltaTime;
                let interval = e.shootInterval || 1900;
                if (e.fleeing) interval = Math.max(900, interval * 0.75);
                if (typeof beatSyncManager !== 'undefined' && beatSyncManager.isActive()) {
                    // Fire on downbeats when timer is ready enough
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

            if (!e.fleeing && role === 'jammer') hasJammer = true;
            if (!e.fleeing && role === 'tether') hasTether = true;

            if (e.shieldMax > 0 && e.shield < e.shieldMax && e.shieldRegen > 0) {
                const mechs = e.abilities || e.defenseMechanisms || [];
                const canRegen = !mechs.length || mechs.indexOf('shield_regen') !== -1
                    || e.shieldRegen > 0;
                if (canRegen) {
                    e.shield = Math.min(e.shieldMax, e.shield + e.shieldRegen * (deltaTime / 1000));
                }
            }
            const offScreen = e.x < -50 || e.x > canvasWidth + 50
                || e.y < -50 || e.y > canvasHeight + 50;
            if (e.fleeing && offScreen) {
                this.sideEnemies.splice(i, 1);
            } else if (!e.isEscort && role !== 'bomber' && e.x < -40) {
                this.sideEnemies.splice(i, 1);
            } else if (role === 'bomber' && offScreen) {
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
        if (this.schedule && this.schedule.some((e) => !e.spawned)) return false;
        return true;
    },

    getJammerCooldownMul() {
        return this.hasJammerDebuff() ? 1.75 : 1;
    },

    getTetherSpeedMul() {
        return this.hasTetherDebuff() ? 0.55 : 1;
    },

    notifyKill(info) {
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
        if (typeof pickupManager !== 'undefined' && pickupManager.spawnFromKill) {
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
