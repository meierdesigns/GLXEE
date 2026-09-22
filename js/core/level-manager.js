"use strict";

/**
 * Core Level Management System
 * Planets have multiple stages + a boss room. Progression is linear across stages.
 */
class CoreLevelManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.levels = {};
        this.currentLevel = null;
        this.planetOrder = ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'];
        this.stagesPerPlanet = 3; // stages 1..N, then boss
        this.init();
    }

    init() {
        this.loadLevels();
    }

    loadLevels() {
        this.levels = {
            mars: {
                id: 'mars',
                name: 'MARS',
                difficulty: 'EASY',
                description: 'Red planet with basic enemies',
                enemyType: 'enemyBasic',
                enemySpeed: 0.8,
                enemyHealth: 100,
                enemyCount: 5,
                obstacles: [
                    { name: 'Asteroid', count: 3 },
                    { name: 'Shield', count: 1 }
                ],
                obstacleSpawnRate: 1000,
                background: 'mars',
                bossEnemyType: 'enemyBoss'
            },
            jupiter: {
                id: 'jupiter',
                name: 'JUPITER',
                difficulty: 'NORMAL',
                description: 'Gas giant with medium enemies',
                enemyType: 'enemyFast',
                enemySpeed: 1.0,
                enemyHealth: 150,
                enemyCount: 4,
                obstacles: [
                    { name: 'Asteroid', count: 4 },
                    { name: 'Shield', count: 2 }
                ],
                obstacleSpawnRate: 800,
                background: 'jupiter',
                bossEnemyType: 'enemyBoss'
            },
            saturn: {
                id: 'saturn',
                name: 'SATURN',
                difficulty: 'HARD',
                description: 'Ringed planet with tough enemies',
                enemyType: 'enemyHeavy',
                enemySpeed: 1.2,
                enemyHealth: 200,
                enemyCount: 3,
                obstacles: [
                    { name: 'Asteroid', count: 5 },
                    { name: 'Shield', count: 3 }
                ],
                obstacleSpawnRate: 600,
                background: 'saturn',
                bossEnemyType: 'enemyBoss'
            },
            neptune: {
                id: 'neptune',
                name: 'NEPTUNE',
                difficulty: 'EXPERT',
                description: 'Ice giant with elite enemies',
                enemyType: 'enemyHeavy',
                enemySpeed: 1.5,
                enemyHealth: 250,
                enemyCount: 2,
                obstacles: [
                    { name: 'Asteroid', count: 6 },
                    { name: 'Shield', count: 4 }
                ],
                obstacleSpawnRate: 500,
                background: 'neptune',
                bossEnemyType: 'enemyBoss'
            },
            pluto: {
                id: 'pluto',
                name: 'PLUTO',
                difficulty: 'NIGHTMARE',
                description: 'Distant ice world',
                enemyType: 'enemyBoss',
                enemySpeed: 1.6,
                enemyHealth: 300,
                enemyCount: 2,
                obstacles: [
                    { name: 'Asteroid', count: 7 },
                    { name: 'Shield', count: 4 }
                ],
                obstacleSpawnRate: 400,
                background: 'pluto',
                bossEnemyType: 'enemyBoss'
            }
        };
    }

    normalizePlanetId(raw) {
        if (raw == null) return null;
        const s = String(raw).toLowerCase().trim().replace(/[^a-z0-9_]+/g, '_');
        if (!s) return null;
        if (this.levels[s]) return s;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.configs &&
            planetConfigManager.configs[s]) {
            return s;
        }
        const num = parseInt(s, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= this.planetOrder.length) {
            return this.planetOrder[num - 1];
        }
        const byName = Object.values(this.levels).find(l => l.name.toLowerCase() === s);
        if (byName) return byName.id;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.configs) {
            const match = Object.keys(planetConfigManager.configs).find((id) => {
                const cfg = planetConfigManager.configs[id];
                return cfg && String(cfg.name || '').toLowerCase() === s;
            });
            if (match) return match;
        }
        // Explored / editor planets: accept slug ids and resolve via planetConfigManager
        if (typeof planetConfigManager !== 'undefined' && /^[a-z][a-z0-9_]{0,63}$/.test(s)) {
            return s;
        }
        return null;
    }

    /**
     * Parse ids like: mars | mars-1 | mars-2 | mars-boss | 1 | jupiter-boss
     */
    parseLevelId(levelId) {
        if (levelId == null) return null;
        const raw = String(levelId).toLowerCase().trim();

        let planetId = null;
        let stageKey = '1';

        if (raw.includes('-')) {
            const parts = raw.split('-');
            planetId = this.normalizePlanetId(parts[0]);
            stageKey = parts.slice(1).join('-') || '1';
        } else {
            planetId = this.normalizePlanetId(raw);
            stageKey = '1';
        }

        if (!planetId) return null;

        const isBoss = stageKey === 'boss' || stageKey === 'b';
        let stageIndex = isBoss ? this.stagesPerPlanet + 1 : parseInt(stageKey, 10);
        if (Number.isNaN(stageIndex) || stageIndex < 1) stageIndex = 1;
        if (!isBoss && stageIndex > this.stagesPerPlanet) {
            stageIndex = this.stagesPerPlanet;
        }

        return {
            planetId,
            stageIndex: isBoss ? this.stagesPerPlanet + 1 : stageIndex,
            isBoss,
            id: isBoss ? `${planetId}-boss` : `${planetId}-${stageIndex}`
        };
    }

    getStageIdsForPlanet(planetId) {
        const pid = this.normalizePlanetId(planetId);
        if (!pid) return [];
        const ids = [];
        for (let i = 1; i <= this.stagesPerPlanet; i++) {
            ids.push(`${pid}-${i}`);
        }
        ids.push(`${pid}-boss`);
        return ids;
    }

    getAllStageIds() {
        const ids = [];
        this.planetOrder.forEach(pid => {
            if (this.levels[pid]) {
                ids.push(...this.getStageIdsForPlanet(pid));
            }
        });
        return ids;
    }

    getAvailableLevels() {
        return this.getAllStageIds();
    }

    getPlanetBase(planetId) {
        const pid = this.normalizePlanetId(planetId);
        if (!pid) return null;

        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg) {
                const champion = (cfg.enemies || []).find(e => e.champion);
                return Object.assign({}, this.levels[pid] || {}, {
                    id: pid,
                    name: cfg.name || (this.levels[pid] && this.levels[pid].name) || pid.toUpperCase(),
                    difficulty: cfg.difficulty || (this.levels[pid] && this.levels[pid].difficulty),
                    description: cfg.description || '',
                    enemyType: (champion && champion.type) || (cfg.graphics && cfg.graphics.enemyShip) || cfg.enemyType || (this.levels[pid] && this.levels[pid].enemyType),
                    enemySpeed: cfg.enemySpeed != null ? cfg.enemySpeed : (this.levels[pid] && this.levels[pid].enemySpeed),
                    enemyHealth: cfg.enemyHealth != null ? cfg.enemyHealth : (this.levels[pid] && this.levels[pid].enemyHealth),
                    obstacleSpawnRate: cfg.obstacleSpawnRate || (this.levels[pid] && this.levels[pid].obstacleSpawnRate),
                    enemies: cfg.enemies || [],
                    objective: cfg.objective || null,
                    dailies: cfg.dailies || null,
                    background: pid,
                    bossEnemyType: (this.levels[pid] && this.levels[pid].bossEnemyType) || 'enemyBoss'
                });
            }
        }

        return this.levels[pid] ? Object.assign({}, this.levels[pid]) : null;
    }

    getStageKey(parsed) {
        if (!parsed) return '1';
        return parsed.isBoss ? 'boss' : String(parsed.stageIndex);
    }

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
    }

    getLevel(levelId) {
        const parsed = this.parseLevelId(levelId);
        if (!parsed) return null;
        return this.buildStageLevel(parsed);
    }

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
    }

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
    }

    getInternalLevel(levelId) {
        return this.getLevel(levelId);
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

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
    }

    startLevel(levelId) {
        return this.setCurrentLevel(levelId);
    }

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
    }

    getNextLevel(currentLevelId) {
        const parsed = this.parseLevelId(currentLevelId);
        if (!parsed) return null;

        const all = this.getAllStageIds();
        const idx = all.indexOf(parsed.id);
        if (idx >= 0 && idx < all.length - 1) {
            return all[idx + 1];
        }
        return null;
    }

    getPreviousLevel(currentLevelId) {
        const parsed = this.parseLevelId(currentLevelId);
        if (!parsed) return null;

        const all = this.getAllStageIds();
        const idx = all.indexOf(parsed.id);
        if (idx > 0) {
            return all[idx - 1];
        }
        return null;
    }

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
    }

    isLevelUnlocked(levelId) {
        const parsed = this.parseLevelId(levelId);
        return !!(parsed && this.levels[parsed.planetId]);
    }

    getUnlockedLevels() {
        return this.getAvailableLevels().filter(levelId => this.isLevelUnlocked(levelId));
    }
}
