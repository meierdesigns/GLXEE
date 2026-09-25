"use strict";

// CoreLevelManager methods, split from level-manager.js.
extendClass(CoreLevelManager, {
    buildStageLevel(parsed) {
        const base = this.getPlanetBase(parsed.planetId);
        if (!base) return null;

        const stageCount = this.stagesPerPlanet;
        const stageMult = parsed.isBoss
            ? 1.0 + stageCount * 0.35
            : 0.75 + (parsed.stageIndex - 1) * 0.2;

        const healthMult = parsed.isBoss ? 2.2 : (0.85 + (parsed.stageIndex - 1) * 0.25);
        const speedMult = parsed.isBoss ? 1.25 : (0.9 + (parsed.stageIndex - 1) * 0.12);
        const spawnMult = parsed.isBoss ? 0.7 : (1.15 - (parsed.stageIndex - 1) * 0.12);

        const stageLabel = parsed.isBoss
            ? 'BOSS'
            : `STAGE ${parsed.stageIndex}/${stageCount}`;

        const stageKey = this.getStageKey(parsed);
        let resolved = { enemies: base.enemies || [], objective: base.objective || null };
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.resolveStageContent) {
            resolved = planetConfigManager.resolveStageContent(parsed.planetId, stageKey);
        }

        const champion = (resolved.enemies || []).find(e => e.champion) || (resolved.enemies || [])[0];
        const enemyType = parsed.isBoss && !champion
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
            difficulty: parsed.isBoss ? 'BOSS' : base.difficulty,
            description: parsed.isBoss
                ? `${base.name} boss chamber`
                : `${base.description} (Stage ${parsed.stageIndex})`,
            enemyType,
            enemySpeed: Math.round((base.enemySpeed || 1) * speedMult * 100) / 100,
            enemyHealth: Math.round((base.enemyHealth || 100) * healthMult),
            enemyCount: (resolved.enemies && resolved.enemies.length) || base.enemyCount || 3,
            enemies: resolved.enemies || [],
            objective: resolved.objective || null,
            dailies: base.dailies || null,
            obstacles: base.obstacles || [],
            obstacleSpawnRate: Math.max(250, Math.round((base.obstacleSpawnRate || 2000) * spawnMult)),
            background: base.background || parsed.planetId,
            stageScale: stageMult
        };
    },

    getLevel(levelId) {
        const parsed = this.parseLevelId(levelId);
        if (!parsed) return null;
        return this.buildStageLevel(parsed);
    },

    resolveFromLegacyLevelManager(levelId) {
        if (typeof levelManager === 'undefined') return null;
        const parsed = this.parseLevelId(levelId);
        if (!parsed) return null;

        let legacy = null;
        if (typeof levelManager.getLevelByPlanetId === 'function') {
            legacy = levelManager.getLevelByPlanetId(parsed.planetId);
        } else if (typeof levelManager.getLevelById === 'function') {
            legacy = levelManager.getLevelById(parsed.planetId);
            if (!legacy) {
                const idx = this.planetOrder.indexOf(parsed.planetId);
                if (idx >= 0) legacy = levelManager.getLevelById(idx + 1);
            }
        }

        if (!legacy) return null;

        const stage = this.buildStageLevel(parsed);
        return Object.assign({}, legacy, stage, {
            id: stage.id,
            name: stage.name,
            background: stage.background,
            enemyType: stage.enemyType,
            enemySpeed: stage.enemySpeed,
            enemyHealth: stage.enemyHealth,
            enemies: stage.enemies,
            objective: stage.objective,
            dailies: stage.dailies,
            obstacleSpawnInterval: stage.obstacleSpawnRate,
            obstacleSpawnRate: stage.obstacleSpawnRate
        });
    },

    setCurrentLevel(levelId) {
        const parsed = this.parseLevelId(levelId);
        if (!parsed) {
            console.error('Level not found:', levelId);
            return false;
        }

        let level = this.resolveFromLegacyLevelManager(parsed.id);
        if (!level) {
            level = this.buildStageLevel(parsed);
        }

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
                planetId: planetId
            });
        }

        if (typeof objectiveManager !== 'undefined') {
            objectiveManager.start(objective, enemies);
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
