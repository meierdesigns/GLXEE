"use strict";

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    spawnScheduledNormal(entry, gameState) {
        if (!entry || !gameState) return null;
        if (this.sideEnemies.length >= this.sideEnemyCap) return null;
        const canvasWidth = gameState.width || 200;
        const canvasHeight = gameState.height || 300;
        const scale = this.championScale(entry.level);
        let baseHp = 40;
        if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(entry.type);
            if (cfg && cfg.maxHealth) baseHp = Math.max(15, Math.round(cfg.maxHealth * 0.4));
        }
        const role = entry.role || 'assault';
        if (role === 'repair' || role === 'shieldBattery') {
            baseHp = Math.max(12, Math.round(baseHp * 0.55));
        } else if (role === 'blocker') {
            baseHp = Math.round(baseHp * 2.2);
        } else if (role === 'bomber') {
            baseHp = Math.max(10, Math.round(baseHp * 0.7));
        }
        const SIDE_DRAW_SCALE = 1; // same size table as champions (≤ 1.5× player)
        const forceEscort = !!entry.forceEscort || this.roleForcesEscort(role);
        const isEscort = forceEscort || this.shouldEscortChampion(entry);
        const escortSlot = isEscort ? this.nextEscortSlot() : -1;
        let form = isEscort ? this.escortFormationOffset(escortSlot) : null;
        if (isEscort && role === 'blocker' && form) {
            form = {
                x: form.x * (0.45 + Math.random() * 0.35),
                y: form.y + 10 + Math.random() * 16
            };
        }
        const levelMul = 1 + 0.1 * ((entry.level || 1) - 1);
        const sideFlightProfile = (typeof flightProfiles !== 'undefined')
            ? flightProfiles.resolve(entry.faction || 'pirate', entry.enemyClass || 'assault')
            : null;
        const sideSpeedMul = sideFlightProfile ? sideFlightProfile.speedMul : 1;
        const side = {
            x: canvasWidth + 20,
            y: 40 + Math.random() * Math.max(40, canvasHeight - 80),
            width: 12,
            height: 10,
            speed: isEscort
                ? 0
                : (-0.35 - Math.random() * 0.25) * levelMul * sideSpeedMul,
            verticalSpeed: isEscort ? 0 : (Math.random() - 0.5) * 0.25 * sideSpeedMul,
            flightProfile: sideFlightProfile,
            wobblePhase: Math.random() * Math.PI * 2,
            health: Math.round(baseHp * scale),
            maxHealth: Math.round(baseHp * scale),
            armor: 0,
            shield: 0,
            shieldMax: 0,
            shieldRegen: 0,
            damageReduction: 0,
            reflectChance: 0,
            defenseMechanisms: [],
            type: entry.type,
            faction: entry.faction || 'pirate',
            enemyClass: entry.enemyClass || 'assault',
            tier: entry.tier != null ? entry.tier : (entry.level || 1),
            cluster: entry.cluster || 'alpha',
            entryId: entry.id,
            level: entry.level,
            champion: false,
            isSideEnemy: true,
            role: role,
            isEscort: isEscort,
            escortSlot: escortSlot,
            formOffsetX: form ? form.x : 0,
            formOffsetY: form ? form.y : 0,
            lifetimeMs: isEscort ? 0 : 18000 + Math.random() * 8000,
            shootTimer: 0,
            shootInterval: role === 'gunner' ? 1400
                : (role === 'assault' || role === 'blocker' ? 1900 : 0),
            repairRate: role === 'repair' ? 6 : 0,
            shieldBatteryRate: role === 'shieldBattery' ? 8 : 0,
            repairRange: 70,
            repairBeamActive: false,
            bomberDamage: role === 'bomber' ? 18 : 0,
            bomberSpeed: role === 'bomber' ? 1.35 : 0
        };
        this.applyEnemyHitProfile(side, {
            faction: side.faction,
            enemyClass: side.enemyClass,
            tier: side.tier,
            level: side.level,
            type: side.type,
            drawScale: SIDE_DRAW_SCALE
        });
        if (isEscort && this.enemy && form) {
            side.x = this.enemy.x + this.enemy.width * 0.5 + form.x - side.width * 0.5;
            side.y = Math.max(10, Math.min(canvasHeight - side.height - 10,
                this.enemy.y + this.enemy.height * 0.5 + form.y - side.height * 0.5));
        } else if (!isEscort) {
            side.y = 40 + Math.random() * Math.max(40, canvasHeight - 80 - side.height);
        }
        if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(entry.type);
            if (cfg) {
                const ai = (typeof difficultyConfigManager !== 'undefined')
                    ? difficultyConfigManager.resolveEnemy(entry.faction, entry.tier, cfg) : null;
                side.armor = cfg.armor || 0;
                side.shieldMax = Math.round((cfg.shieldMax || 0) * 0.4 * scale);
                side.shield = side.shieldMax;
                side.shieldRegen = (cfg.shieldRegen || 0) * 0.4;
                side.damageReduction = cfg.damageReduction || 0;
                side.reflectChance = cfg.reflectChance || 0;
                side.damageMul = ai ? ai.damageMul : 1;
                side.evasionChance = ai ? ai.evasionChance : 1;
                side.predictionSkill = ai ? ai.predictionSkill : 0;
                side.defenseMechanisms = (cfg.abilities || cfg.defenseMechanisms || []).slice();
                side.abilities = side.defenseMechanisms.slice();
                if (role === 'gunner' && cfg.shootInterval) {
                    side.shootInterval = Math.max(800, Math.round(cfg.shootInterval * 1.2));
                }
            }
        }
        this.sideEnemies.push(side);
        if (typeof profileManager !== 'undefined' && profileManager.discoverEnemyContents && entry.type) {
            profileManager.discoverEnemyContents(entry.type);
        }
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemySpawned(entry);
        }
        return side;
    },

    spawnSideEnemy(gameState) {
        const type = this.pickSideEnemyType();
        if (!type || !gameState) return null;
        const cluster = (this.enemy && this.enemy.cluster) || 'alpha';
        const escort = !!(this.enemy && !this.exploding && Math.random() < 0.55);
        let tax = { faction: 'pirate', enemyClass: 'assault' };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.taxonomyForType) {
            tax = planetConfigManager.taxonomyForType(type) || tax;
        } else if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
            tax.faction = enemyConfigManager.getDefaultFaction(type);
        }
        const enemyClass = tax.enemyClass || 'assault';
        const tier = (typeof factionShipStyles !== 'undefined' && factionShipStyles.classTier)
            ? (factionShipStyles.classTier[enemyClass] || 2)
            : 1;
        return this.spawnScheduledNormal({
            id: 'legacy_' + Date.now(),
            type: type,
            faction: tax.faction || 'pirate',
            enemyClass: enemyClass,
            tier: tier,
            level: 1,
            champion: false,
            cluster: escort ? cluster : ('flyby_' + Math.floor(Math.random() * 9999)),
            role: this.sideEnemyPool.find(e => e.type === type)?.role || 'assault',
            forceEscort: escort
        }, gameState);
    },

    updateSchedule(deltaTime, gameState) {
        if (this.spawnFrozen) return;
        if (!this.schedule.length) return;
        this.scheduleElapsedMs += deltaTime;
        const elapsedSec = this.scheduleElapsedMs / 1000;
        const holdNormals = this.sideFleeing || this.exploding
            || (typeof objectiveManager !== 'undefined' && objectiveManager.awaitingFieldClear);

        // Cluster wave times: earliest spawnAt per cluster
        const clusterWaveAt = {};
        this.schedule.forEach(e => {
            const c = e.cluster || 'alpha';
            if (clusterWaveAt[c] == null || e.spawnAt < clusterWaveAt[c]) {
                clusterWaveAt[c] = e.spawnAt;
            }
        });

        for (const entry of this.schedule) {
            if (entry.spawned) continue;
            const waveAt = clusterWaveAt[entry.cluster || 'alpha'];
            const dueAt = Math.min(entry.spawnAt, waveAt != null ? waveAt : entry.spawnAt);
            if (elapsedSec < dueAt) continue;
            if (entry.champion && (this.enemy || this.exploding)) {
                continue;
            }
            if (!entry.champion && holdNormals) {
                continue;
            }
            entry.spawned = true;
            if (entry.champion) {
                this.spawnChampionFromEntry(entry);
            } else {
                this.spawnScheduledNormal(entry, gameState);
            }
        }
    },

    async spawnChampionFromEntry(entry) {
        this.pendingChampionEntry = entry;
        this.beginChampionCombatEvents(entry);
        await this.setShipType(entry.type);
        if (typeof graphicsManager !== 'undefined' && graphicsManager.setEnemyShipType) {
            graphicsManager.setEnemyShipType(entry.type);
        }
        this.spawnEnemy(entry);
        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.onEnemySpawned(entry);
        }
    },
});
