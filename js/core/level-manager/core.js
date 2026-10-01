"use strict";

/**
 * Core Level Management System
 * Planets have multiple stages + a boss room. Progression is linear across stages.
 */
/**
 * Stages before the boss, per planet: base by difficulty (EASY 2 … NIGHTMARE 5)
 * plus a seeded -1/0/+1, clamped 2..5. A planet config's `stageCount` wins.
 * Ambush encounters are a single stage.
 */
/**
 * Planet id from a planet or level id (mars, mars-2, mars-boss). Planet ids
 * themselves may contain '-' (duplicates like terra-2), so a known planet id
 * wins over splitting off a stage suffix.
 */
function planetIdOfLevelId(id) {
    let raw = String(id || '').toLowerCase().trim();
    const known = (k) => typeof planetConfigManager !== 'undefined' && planetConfigManager.configs
        && Object.prototype.hasOwnProperty.call(planetConfigManager.configs, k);
    while (raw.indexOf('-') !== -1 && !known(raw)) raw = raw.slice(0, raw.lastIndexOf('-'));
    return raw;
}

const PLANET_STAGE_BASE = { EASY: 2, NORMAL: 3, HARD: 3, EXPERT: 4, NIGHTMARE: 4 };
function getPlanetStageCount(planetId) {
    const pid = planetIdOfLevelId(planetId);
    if (!pid) return 3;
    if (pid.indexOf('ambush_') === 0) return 1;
    const cfg = typeof planetConfigManager !== 'undefined' && planetConfigManager.getConfig
        ? planetConfigManager.getConfig(pid) : null;
    if (cfg && Number(cfg.stageCount) > 0) return Math.max(1, Math.min(8, Math.round(Number(cfg.stageCount))));
    const diff = String((cfg && cfg.difficulty) || 'NORMAL').toUpperCase();
    const base = PLANET_STAGE_BASE[diff] || 3;
    let h = 2166136261;
    for (let i = 0; i < pid.length; i++) { h ^= pid.charCodeAt(i); h = Math.imul(h, 16777619); }
    const jitter = ((h >>> 0) % 3) - 1;
    return Math.max(2, Math.min(5, base + jitter));
}

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
                bossEnemyType: 'battleship'
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
                bossEnemyType: 'cruiser'
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
                bossEnemyType: 'enemyHeavy'
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
                bossEnemyType: 'enemyFast'
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
        const exact = String(raw).toLowerCase().trim();
        if (exact.indexOf('-') !== -1 && typeof planetConfigManager !== 'undefined'
            && planetConfigManager.configs && planetConfigManager.configs[exact]) return exact;
        const s = exact.replace(/[^a-z0-9_]+/g, '_');
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
            const base = planetIdOfLevelId(raw);
            planetId = this.normalizePlanetId(base);
            stageKey = raw.slice(base.length + 1) || '1';
        } else {
            planetId = this.normalizePlanetId(raw);
            stageKey = '1';
        }

        if (!planetId) return null;

        const isBoss = stageKey === 'boss' || stageKey === 'b';
        const n = getPlanetStageCount(planetId);
        let stageIndex = isBoss ? n + 1 : parseInt(stageKey, 10);
        if (Number.isNaN(stageIndex) || stageIndex < 1) stageIndex = 1;
        if (!isBoss && stageIndex > n) {
            stageIndex = n;
        }

        return {
            planetId,
            stageIndex: isBoss ? n + 1 : stageIndex,
            isBoss,
            id: isBoss ? `${planetId}-boss` : `${planetId}-${stageIndex}`
        };
    }

    getStageIdsForPlanet(planetId) {
        const pid = this.normalizePlanetId(planetId);
        if (!pid) return [];
        const ids = [];
        for (let i = 1; i <= getPlanetStageCount(pid); i++) {
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
}
