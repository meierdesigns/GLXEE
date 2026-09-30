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
            // Bombers are kamikaze threats: dangerous on approach, fragile
            // when focused by the player.
            baseHp = Math.max(6, Math.round(baseHp * 0.35));
        }
        // Side craft stay a little smaller than champions (drawScale 0.8),
        // including their mounted weapons and projectiles, but no longer tiny.
        // Combat roles get a little more hull so they can pressure the player.
        const SIDE_DRAW_SCALE = role === 'assault' || role === 'gunner' || role === 'blocker'
            ? 0.72 : 0.62;
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
            formationReleaseAt: isEscort
                ? Date.now() + 2200 + Math.random() * 3200
                : 0,
            formOffsetX: form ? form.x : 0,
            formOffsetY: form ? form.y : 0,
            lifetimeMs: isEscort ? 0 : 18000 + Math.random() * 8000,
            shootTimer: 0,
            shootInterval: role === 'gunner' ? 1400
                : (role === 'assault' || role === 'blocker' || role === 'bomber' ? 1900 : 0),
            repairRate: role === 'repair' ? 6 : 0,
            shieldBatteryRate: role === 'shieldBattery' ? 8 : 0,
            repairRange: 70,
            repairBeamActive: false,
            bomberDamage: role === 'bomber' ? 18 : 0,
            bomberSpeed: role === 'bomber' ? 1.35 : 0,
            weaponScale: SIDE_DRAW_SCALE
        };
        // Give escorts distinct attack profiles instead of making the whole
        // formation fire the champion's weapon in unison.
        const factionWeapons = (typeof factionShipStyles !== 'undefined'
            && factionShipStyles.getFactionDefaultWeapons)
            ? factionShipStyles.getFactionDefaultWeapons(side.faction)
            : ['laser'];
        if (factionWeapons.length) {
            side.weaponId = factionWeapons[(escortSlot >= 0 ? escortSlot : Math.floor(Math.random() * factionWeapons.length))
                % factionWeapons.length];
        }
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
        // Fly-bys keep the faction of the scheduled entry they come from
        // (else the level's main faction), not their ship type's default.
        const poolEntry = (this.sideEnemyPool || []).find(e => e.type === type);
        const levelMain = (this.levelFactions && this.levelFactions[0]) || null;
        const faction = (poolEntry && poolEntry.faction)
            || (levelMain && (this.levelFactions.indexOf(tax.faction) === -1) ? levelMain : tax.faction)
            || 'pirate';
        return this.spawnScheduledNormal({
            id: 'legacy_' + Date.now(),
            type: type,
            faction: faction,
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
