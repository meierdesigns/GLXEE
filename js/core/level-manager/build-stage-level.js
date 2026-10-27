"use strict";

// CoreLevelManager methods, split from level-manager.js.
extendClass(CoreLevelManager, {
    buildStageLevel(parsed) {
        const base = this.getPlanetBase(parsed.planetId);
        if (!base) return null;

        const isAmbush = String(parsed.planetId || '').indexOf('ambush_') === 0;
        const stageCount = isAmbush ? 1 : getPlanetStageCount(parsed.planetId);
        const stageMult = parsed.isBoss
            ? 1.0 + 3 * 0.35
            : 0.75 + (stageCount > 1 ? (parsed.stageIndex - 1) / (stageCount - 1) * 2 : 0) * 0.2;

        // Ramp over the planet's own stage count (2..5 stages) so the last
        // stage is as tough as before, however many stages lead up to it.
        const ramp = stageCount > 1 ? (parsed.stageIndex - 1) / (stageCount - 1) * 2 : 0;
        const healthMult = parsed.isBoss ? 2.2 : (0.85 + ramp * 0.25);
        const speedMult = parsed.isBoss ? 1.25 : (0.9 + ramp * 0.12);
        const spawnMult = parsed.isBoss ? 0.7 : (1.15 - ramp * 0.12);

        // Planet tier: early planets easier, later ones harder.
        const tier = (typeof planetTierIndex === 'function') ? planetTierIndex(base.difficulty) : 1;
        const tierMods = (typeof planetTierMods === 'function') ? planetTierMods(tier)
            : { health: 1, speed: 1, spawn: 1 };

        const stageLabel = isAmbush
            ? 'STAGE 1/1'
            : parsed.isBoss
            ? `BOSS ${stageCount + 1}/${stageCount + 1}`
            : `STAGE ${parsed.stageIndex}/${stageCount + 1}`;

        const stageKey = this.getStageKey(parsed);
        let resolved = { enemies: base.enemies || [], objective: base.objective || null };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.resolveStageContent) {
            resolved = planetConfigManager.resolveStageContent(parsed.planetId, stageKey);
        }

        // Every second regular stage is a transit run: only side craft, and
        // the goal is a sluice / warp ring at the end instead of a kill.
        const isTransit = !parsed.isBoss && isTransitStage(parsed.planetId, parsed.stageIndex);
        if (isTransit) {
            const seconds = 50 + parsed.stageIndex * 5;
            const goalKind = parsed.stageIndex % 4 === 2 ? 'sluice' : 'warp';
            resolved = {
                enemies: this.buildTransitEnemies(resolved.enemies, seconds, parsed.stageIndex, base.difficulty),
                objective: {
                    type: 'reachGoal',
                    seconds: seconds,
                    goal: goalKind
                }
            };
        }

        // A random subset of sluice transit stages also get a shop station
        // beside the gate (seeded on planet+stage so it's stable per replay).
        let hasShop = false;
        if (isTransit && resolved.objective && resolved.objective.goal === 'sluice') {
            const key = `${parsed.planetId}:${parsed.stageIndex}:shop`;
            let h = 2166136261;
            for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
            hasShop = ((h >>> 0) % 100) < 35;
        }

        const champion = (resolved.enemies || []).find(e => e.champion) || (resolved.enemies || [])[0];
        const enemyType = parsed.isBoss
            ? (base.bossEnemyType || 'enemyBoss')
            : (champion && champion.type) || base.enemyType;

        return {
            id: parsed.id,
            planetId: parsed.planetId,
            stageIndex: parsed.stageIndex,
            stageKey,
            isBoss: parsed.isBoss,
            stagesPerPlanet: stageCount,
            name: `${base.name} — ${stageLabel}`,
            planetName: base.name,
            stageLabel,
            stageKind: isTransit ? 'transit' : (parsed.isBoss ? 'boss' : 'combat'),
            difficulty: parsed.isBoss ? 'BOSS' : base.difficulty,
            description: parsed.isBoss
                ? `${base.name} boss chamber`
                : `${base.description} (Stage ${parsed.stageIndex})`,
            enemyType,
            planetTier: tier,
            enemySpeed: Math.round((base.enemySpeed || 1) * speedMult * tierMods.speed * 100) / 100,
            enemyHealth: Math.round((base.enemyHealth || 100) * healthMult * tierMods.health),
            enemyCount: (resolved.enemies && resolved.enemies.length) || base.enemyCount || 3,
            enemies: resolved.enemies || [],
            objective: resolved.objective || null,
            hasShop,
            dailies: base.dailies || null,
            obstacles: base.obstacles || [],
            obstacleSpawnRate: Math.max(250, Math.round((base.obstacleSpawnRate || 2000) * spawnMult * tierMods.spawn)),
            background: base.background || parsed.planetId,
            stageScale: stageMult
        };
    },

    /** Steady stream of side craft (no champion) across a transit run. */
    buildTransitEnemies(source, seconds, stageIndex, difficulty) {
        const pool = (source || []).filter(e => e && e.type);
        const types = pool.length ? pool : [{ type: 'enemyBasic' }];
        const roles = ['assault', 'gunner', 'assault', 'bomber'];
        // Side craft in transit runs were too strong early on: scale them with the planet tier and the stage
        // (0.5 on an easy planet's first stage, up to 1.0 on late stages of hard planets) and thin the stream out.
        const tier = typeof planetTierIndex === 'function' ? planetTierIndex(difficulty) : 1;
        const transitScale = Math.max(0.5, Math.min(1, 0.5 + 0.09 * tier + 0.05 * (stageIndex - 1)));
        const gap = Math.max(2.2, 3.6 - stageIndex * 0.25) * (1 + (1 - transitScale) * 0.8);
        const out = [];
        for (let t = 3, i = 0; t < seconds - 6; t += gap, i++) {
            const src = types[i % types.length];
            out.push(Object.assign({}, src, {
                id: 'transit_' + i,
                champion: false,
                cluster: 'transit_' + i,
                level: 1,
                role: roles[i % roles.length],
                spawnAt: t,
                transitScale: transitScale,
                combatEvents: []
            }));
        }
        return out;
    },

    getLevel(levelId) {
        const parsed = this.parseLevelId(levelId);
        if (!parsed) return null;
        return this.buildStageLevel(parsed);
    },

    setCurrentLevel(levelId) {
        const parsed = this.parseLevelId(levelId);
        if (!parsed) {
            console.error('Level not found:', levelId);
            return false;
        }

        const level = this.buildStageLevel(parsed);

        if (!level) {
            console.error('Level not found:', levelId);
            return false;
        }

        this.currentLevel = level;
        this.gameState.setLevel(level);
        this.applyLevelSettings(level);
        return true;
    },

    getInternalLevel(levelId) {
        return this.getLevel(levelId);
    },

    getCurrentLevel() {
        return this.currentLevel;
    },

    applyLevelSettings(level) {
        const planetId = (level && (level.planetId || level.background || level.id || '')).toString().toLowerCase().split('-')[0];

        this.gameState.setObstacleSpawnInterval(level.obstacleSpawnRate);

        if (typeof planetConfigManager !== 'undefined' && planetId) {
            planetConfigManager.applyToRuntime(planetId);
        }

        const enemies = level.enemies || [];
        const objective = level.objective || null;

        if (typeof enemyManager !== 'undefined' && enemyManager.setEnemySchedule) {
            enemyManager.setEnemySchedule(enemies, {
                enemySpeed: level.enemySpeed,
                enemyHealth: level.enemyHealth,
                isBoss: level.isBoss,
                transit: level.stageKind === 'transit',
                planetId: planetId
            });
            // setEnemySchedule rebuilds sideEnemyPool from `enemies` (usually
            // just the champion), clobbering the per-planet side-enemy pool
            // applyToRuntime just set above — reapply it after.
            if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig && enemyManager.setSideEnemyPool) {
                const cfg = planetConfigManager.getConfig(planetId);
                if (cfg && cfg.sideEnemies && cfg.sideEnemies.length) {
                    enemyManager.setSideEnemyPool(cfg.sideEnemies);
                }
            }
        }

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.start(objective, enemies);
            objectiveManager.hasShop = !!level.hasShop;
        }

        const champion = enemies.find(e => e.champion) || enemies[0];
        const shipType = (champion && champion.type) || level.enemyType;
        if (typeof graphicsManager !== 'undefined' && shipType) {
            graphicsManager.setEnemyShipType(shipType);
        }
        if (typeof enemyManager !== 'undefined' && typeof enemyManager.setShipType === 'function' && shipType) {
            enemyManager.setShipType(shipType);
        }
        if (typeof parallaxManager !== 'undefined' && level.background) {
            parallaxManager.setBackground(level.background);
        }

        if (typeof themeContextManager !== 'undefined') {
            themeContextManager.applyForLevel(level);
        }

        if (typeof soundManager !== 'undefined' && soundManager.startPlanetAmbient) {
            soundManager.startPlanetAmbient(planetId || 'mars');
        }
    },

    startLevel(levelId) {
        return this.setCurrentLevel(levelId);
    },

    getLevelInfo(levelId) {
        const level = this.getLevel(levelId);
        if (!level) return null;

        return {
            name: level.name,
            difficulty: level.difficulty,
            description: level.description,
            enemyType: level.enemyType,
            enemySpeed: String(level.enemySpeed),
            enemyHealth: String(level.enemyHealth),
            enemyCount: String(level.enemyCount),
            obstacles: level.obstacles,
            obstacleSpawnRate: level.obstacleSpawnRate,
            background: level.background,
            stageLabel: level.stageLabel,
            isBoss: level.isBoss
        };
    },

    getNextLevel(currentLevelId) {
        const parsed = this.parseLevelId(currentLevelId);
        if (!parsed) return null;

        // Custom/explored planets are not necessarily in the legacy
        // planetOrder list, but their local stage progression still applies.
        if (!parsed.isBoss && parsed.stageIndex < getPlanetStageCount(parsed.planetId)) {
            return `${parsed.planetId}-${parsed.stageIndex + 1}`;
        }
        // Last stage → this planet's boss room (explored planets are not in
        // planetOrder, so the global list below would skip the boss).
        if (!parsed.isBoss) return `${parsed.planetId}-boss`;

        const all = this.getAllStageIds();
        const idx = all.indexOf(parsed.id);
        if (idx >= 0 && idx < all.length - 1) {
            return all[idx + 1];
        }
        return null;
    },

    getPreviousLevel(currentLevelId) {
        const parsed = this.parseLevelId(currentLevelId);
        if (!parsed) return null;

        const all = this.getAllStageIds();
        const idx = all.indexOf(parsed.id);
        if (idx > 0) {
            return all[idx - 1];
        }
        return null;
    },

    getNextLevelMeta(currentLevelId) {
        const nextId = this.getNextLevel(currentLevelId);
        if (!nextId) return null;
        const next = this.parseLevelId(nextId);
        if (!next) return { id: nextId, label: 'NEXT LEVEL', kind: 'level' };

        const current = this.parseLevelId(currentLevelId);
        if (next.isBoss) {
            return { id: nextId, label: 'BOSS ROOM', kind: 'boss' };
        }
        if (current && next.planetId !== current.planetId) {
            return { id: nextId, label: 'NEXT PLANET', kind: 'planet' };
        }
        return { id: nextId, label: 'NEXT STAGE', kind: 'stage' };
    },

    isLevelUnlocked(levelId) {
        const parsed = this.parseLevelId(levelId);
        return !!(parsed && this.levels[parsed.planetId]);
    },

    getUnlockedLevels() {
        return this.getAvailableLevels().filter(levelId => this.isLevelUnlocked(levelId));
    },
});
