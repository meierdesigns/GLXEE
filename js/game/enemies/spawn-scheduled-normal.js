"use strict";

/** Health of light-class side craft relative to their normal value: the lower the rank, the quicker it goes down. */
const LIGHT_CLASS_HP_MUL = { scout: 0.4, assault: 0.55, heavy: 0.7 };

// EnemyManager methods, split from enemies.js.
extendClass(EnemyManager, {
    /**
     * Rim openings where side craft may enter: the hangar openings built into
     * the canyon walls (terrainOpeningAt). No terrain → both rims are open.
     */
    findSideEntryGaps(canvasWidth, canvasHeight, shipH) {
        const W = canvasWidth || 240;
        const H = canvasHeight || 300;
        const h = Math.max(8, shipH || 10);
        const yMin = 18;
        const gaps = [];
        if (typeof obstacleManager === 'undefined' || !obstacleManager.hasTerrain
            || !obstacleManager.hasTerrain() || !obstacleManager.terrainOpeningAt) {
            const yMax = Math.max(yMin + 8, Math.floor(H * 0.34));
            for (let n = 0; n < 6; n++) {
                const y = yMin + Math.random() * (yMax - yMin);
                gaps.push({ side: 0, y: y });
                gaps.push({ side: 1, y: y });
            }
            return gaps;
        }
        // Upper half only: enemies hold the top, the player the bottom.
        const yMax = Math.max(yMin + 8, Math.floor(H * 0.55) - h);
        const cell = (obstacleManager.terrainCell && obstacleManager.terrainCell()) || 4;
        for (let y = yMin; y <= yMax; y += cell) {
            const wr = obstacleManager.terrainRowAtY(y + h * 0.5);
            for (let side = 0; side < 2; side++) {
                if (obstacleManager.terrainOpeningAt(wr, side) !== 'gap') continue;
                // Opening still in one piece (not shot into a wider breach).
                const c = obstacleManager.terrainWallCells(wr, W);
                if ((side ? c.right : c.left) <= 1) gaps.push({ side: side, y: Math.max(yMin, y) });
            }
        }
        return gaps; // empty → no opening on screen yet; spawn retries later
    },

    /** Scout / assault / heavy: single-purpose side craft (see spawnScheduledNormal). */
    isLightClass(enemyClass) {
        const c = String(enemyClass || '').toLowerCase();
        return c === 'scout' || c === 'assault' || c === 'heavy';
    },

    /** Mount groups a side craft of this class carries: scouts one gun, bigger classes add wing / outrigger pairs. */
    sideMuzzleGroupCount(enemyClass) {
        const r = Math.random();
        switch (String(enemyClass || 'assault').toLowerCase()) {
            case 'scout': return 1;
            case 'assault': return r < 0.5 ? 1 : 2;
            case 'heavy': return 2;
            case 'elite': return r < 0.5 ? 2 : 3;
            default: return 3;
        }
    },

    /** Pick a rim gap and place the side craft just off-screen outside it. */
    placeSideEntryFromGap(side, canvasWidth, canvasHeight) {
        const W = canvasWidth || 240;
        const H = canvasHeight || 300;
        const gaps = this.findSideEntryGaps(W, H, side.height || 10);
        if (!gaps.length) return false;
        const gap = gaps[Math.floor(Math.random() * gaps.length)];
        const pad = 6;
        let laneLeft = pad;
        let laneRight = W - pad;
        if (typeof obstacleManager !== 'undefined' && obstacleManager.terrainWallsAtY) {
            const walls = obstacleManager.terrainWallsAtY(gap.y + (side.height || 10) * 0.5, W);
            if (walls) {
                laneLeft = walls.left + pad;
                laneRight = walls.right - pad;
            }
        }
        const targetX = gap.side === 0
            ? laneLeft + 4 + Math.random() * Math.max(8, (laneRight - laneLeft - side.width) * 0.35)
            : laneRight - side.width - 4 - Math.random() * Math.max(8, (laneRight - laneLeft - side.width) * 0.35);
        side.entryFromSide = gap.side;
        side.entryTargetX = Math.max(laneLeft, Math.min(laneRight - side.width, targetX));
        side.entryTargetY = Math.max(12, Math.min(H - side.height - 12, gap.y));
        side.y = side.entryTargetY;
        if (gap.side === 0) {
            side.x = -side.width - 2;
            side.speed = 0.85 + Math.random() * 0.45;
        } else {
            side.x = W + 2;
            side.speed = -(0.85 + Math.random() * 0.45);
        }
        side.verticalSpeed = (Math.random() - 0.5) * 0.15;
        side.entering = true;
        // Shot out of the hangar by compressed air: fast kick, bleeds off to cruise.
        side.launchV = 4.2 + Math.random() * 1.4;
        if (typeof obstacleManager !== 'undefined' && obstacleManager.spawnWallBurst) {
            const env = obstacleManager.getEnvironment ? obstacleManager.getEnvironment() : {};
            obstacleManager.spawnWallBurst(gap.side ? W - 1 : 1, side.y + side.height * 0.5, gap.side ? -1 : 1,
                ['#eef4f8', '#c8d2da', '#9aa6b0', '#eef4f8', env.accent || '#ffd27a'], 30, 1.1, 3.4);
        }
        return true;
    },

    spawnScheduledNormal(entry, gameState) {
        if (!entry || !gameState) return null;
        if (this.sideEnemies.length >= this.sideEnemyCap) {
            if (typeof window !== 'undefined' && window.DEBUG_SIDE_SPAWNS) {
                console.log('[sideDebug] spawnScheduledNormal blocked by cap', entry.id, this.sideEnemies.length, this.sideEnemyCap);
            }
            return null;
        }
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
        // Side craft ~75–80% of the champion footprint — readable, not boss-sized.
        const SIDE_HULL_SEEDS = 12;
        const sideSizeMul = (typeof uiAppearanceManager !== 'undefined' && uiAppearanceManager.getSideSizeMul)
            ? uiAppearanceManager.getSideSizeMul() : 1;
        const SIDE_DRAW_SCALE = (role === 'assault' || role === 'gunner' || role === 'blocker'
            ? 0.78 : 0.68) * sideSizeMul;
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
        const tierMods = this.currentTierMods ? this.currentTierMods() : { health: 1, damage: 1 };
        baseHp = Math.max(1, Math.round(baseHp * tierMods.health));
        const sideFlightProfile = (typeof flightProfiles !== 'undefined')
            ? flightProfiles.resolve(entry.faction || 'pirate', entry.enemyClass || 'assault')
            : null;
        const sideSpeedMul = sideFlightProfile ? sideFlightProfile.speedMul : 1;
        // Enter from an empty rim opening, then settle into cruise / escort.
        const cruiseSpeed = isEscort
            ? 0
            : (-0.8 - Math.random() * 0.5) * levelMul * sideSpeedMul;
        const cruiseVSpeed = isEscort ? 0 : (Math.random() - 0.5) * 0.5 * sideSpeedMul;
        const side = {
            x: 0,
            y: 0,
            width: 12,
            height: 10,
            speed: 0,
            verticalSpeed: 0,
            cruiseSpeed: cruiseSpeed,
            cruiseVerticalSpeed: cruiseVSpeed,
            entering: true,
            entryFromSide: null,
            entryTargetX: null,
            entryTargetY: null,
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
            renegade: !!entry.renegade,
            renegadeColor: entry.renegadeColor || null,
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
            weaponScale: SIDE_DRAW_SCALE,
            // Generative hull: a seed from a small pool (each seed = one cached hull + gun mounts), and how
            // many mount groups (nose, wing pair, outrigger pair) this craft carries.
            hullSeed: 1 + Math.floor(Math.random() * SIDE_HULL_SEEDS),
            muzzleGroups: this.sideMuzzleGroupCount(entry.enemyClass)
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
            hullSeed: side.hullSeed,
            drawScale: SIDE_DRAW_SCALE
        });
        // Only enter through empty rim openings — never through solid rock.
        if (!this.placeSideEntryFromGap(side, canvasWidth, canvasHeight)) {
            if (typeof window !== 'undefined' && window.DEBUG_SIDE_SPAWNS) {
                console.log('[sideDebug] spawnScheduledNormal blocked: no rim gap', entry.id);
            }
            return null; // no open edge this frame; try again later
        }
        if (typeof window !== 'undefined' && window.DEBUG_SIDE_SPAWNS) {
            console.log('[sideDebug] spawned side', entry.id, side.type, side.x, side.y);
        }
        if (isEscort && this.enemy && form) {
            // After the rim entry, settle toward the formation slot.
            const slotX = this.enemy.x + this.enemy.width * 0.5 + form.x - side.width * 0.5;
            const slotY = Math.max(10, Math.min(canvasHeight - side.height - 10,
                this.enemy.y + this.enemy.height * 0.5 + form.y - side.height * 0.5));
            side.entryTargetX = Math.max(4, Math.min(canvasWidth - side.width - 4, slotX));
            side.entryTargetY = slotY;
            side.formOffsetX = form.x;
            side.formOffsetY = form.y;
        }
        if (typeof enemyConfigManager !== 'undefined') {
            const cfg = enemyConfigManager.getConfig(entry.type);
            if (cfg) {
                const ai = (typeof difficultyConfigManager !== 'undefined')
                    ? difficultyConfigManager.resolveEnemy(entry.faction, entry.tier, cfg, 'side') : null;
                side.armor = cfg.armor || 0;
                side.shieldMax = Math.round((cfg.shieldMax || 0) * 0.4 * scale);
                side.shield = side.shieldMax;
                side.shieldRegen = (cfg.shieldRegen || 0) * 0.4;
                side.damageReduction = cfg.damageReduction || 0;
                side.reflectChance = cfg.reflectChance || 0;
                side.damageMul = (ai ? ai.damageMul : 1) * tierMods.damage;
                side.evasionChance = ai ? ai.evasionChance : 1;
                side.predictionSkill = ai ? ai.predictionSkill : 0;
                if (ai) {
                    if (ai.healthMul && ai.healthMul !== 1) {
                        side.maxHealth = Math.max(1, Math.round(side.maxHealth * ai.healthMul));
                        side.health = side.maxHealth;
                    }
                    if (ai.speedMul && ai.speedMul !== 1) {
                        side.speed *= ai.speedMul;
                        side.verticalSpeed *= ai.speedMul;
                        if (side.cruiseSpeed) side.cruiseSpeed *= ai.speedMul;
                        if (side.cruiseVerticalSpeed) side.cruiseVerticalSpeed *= ai.speedMul;
                        if (side.bomberSpeed) side.bomberSpeed *= ai.speedMul;
                    }
                    if (ai.attackRateMul && side.shootInterval > 0) {
                        side.shootInterval = Math.max(500,
                            Math.round(side.shootInterval / Math.max(0.4, ai.attackRateMul)));
                    }
                }
                side.defenseMechanisms = (cfg.abilities || cfg.defenseMechanisms || []).slice();
                side.abilities = side.defenseMechanisms.slice();
                if (role === 'gunner' && cfg.shootInterval) {
                    side.shootInterval = Math.max(800, Math.round(cfg.shootInterval * 1.2));
                }
            }
        } else if (typeof difficultyConfigManager !== 'undefined') {
            const ai = difficultyConfigManager.resolveEnemy(entry.faction, entry.tier, null, 'side');
            side.damageMul = (ai.damageMul || 1) * tierMods.damage;
            side.maxHealth = Math.max(1, Math.round(side.maxHealth * (ai.healthMul || 1)));
            side.health = side.maxHealth;
            side.speed *= ai.speedMul || 1;
            side.verticalSpeed *= ai.speedMul || 1;
            if (side.cruiseSpeed) side.cruiseSpeed *= ai.speedMul || 1;
            if (side.cruiseVerticalSpeed) side.cruiseVerticalSpeed *= ai.speedMul || 1;
        }
        // Transit (canyon) runs: weaker side craft, scaled by planet tier and stage (see buildTransitEnemies).
        if (entry.transitScale > 0 && entry.transitScale < 1) {
            side.maxHealth = Math.max(1, Math.round(side.maxHealth * entry.transitScale));
            side.health = side.maxHealth;
            side.damageMul = (side.damageMul || 1) * (0.6 + 0.4 * entry.transitScale);
        }
        // Light classes (scout / assault / heavy) do exactly one job — their event role — with no extras,
        // and go down quicker. Elite / capital keep their full kit.
        if (this.isLightClass(side.enemyClass)) {
            side.lightClass = true;
            side.shieldMax = 0;
            side.shield = 0;
            side.shieldRegen = 0;
            side.reflectChance = 0;
            side.damageReduction = 0;
            side.armor = 0;
            side.defenseMechanisms = [];
            side.abilities = [];
            side.muzzleGroups = 1;
            side.maxHealth = Math.max(1, Math.round(side.maxHealth * (LIGHT_CLASS_HP_MUL[String(side.enemyClass).toLowerCase()] || 1)));
            side.health = side.maxHealth;
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
        if (typeof objectiveManager !== 'undefined' && objectiveManager.isLevelEnding()) return;
        if (!this.schedule.length) return;
        if (typeof objectiveManager !== 'undefined' && objectiveManager.isArrivalSpawnHold
            && objectiveManager.isArrivalSpawnHold()) return;
        this.scheduleElapsedMs += deltaTime;
        const elapsedSec = this.scheduleElapsedMs / 1000;
        const holdNormals = this.sideFleeing || this.exploding
            || (typeof objectiveManager !== 'undefined' && (
                objectiveManager.awaitingFieldClear
                || objectiveManager.won
                || objectiveManager.completed
                || objectiveManager.exitGate
            ));

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
                if (typeof window !== 'undefined' && window.DEBUG_SIDE_SPAWNS) {
                    console.log('[sideDebug] updateSchedule attempting', entry.id, 'at', elapsedSec.toFixed(1) + 's');
                }
                if (!this.spawnScheduledNormal(entry, gameState)) {
                    // Side slots full: keep it queued instead of dropping it.
                    entry.spawned = false;
                }
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
