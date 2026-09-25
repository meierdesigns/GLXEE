"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    /** Pluto. */
    createPlutoDefaults() {
        return {
            pluto: this.makePlanet({
                id: 'pluto',
                name: 'PLUTO',
                galaxyId: 'milky_way',
                difficulty: 'NIGHTMARE',
                description: 'Distant ice world',
                factions: ['voidborn', 'pirate'],
                theme: 'purple',
                enemyType: 'enemyBoss',
                enemySpeed: 1.6,
                enemyHealth: 300,
                obstacleSpawnRate: 800,
                obstacleTypes: ['large_asteroid', 'large_shield', 'fragmented_asteroid', 'fragmented_shield'],
                enemies: [
                    {
                        id: 'plu_champ',
                        type: 'enemyBoss',
                        champion: true,
                        level: 3,
                        spawnAt: 0,
                        cluster: 'alpha',
                        combatEvents: [
                            {
                                id: 'plu_jammer',
                                trigger: 'hpBelow',
                                threshold: 0.55,
                                once: true,
                                count: 1,
                                role: 'jammer',
                                type: 'enemyFast'
                            },
                            {
                                id: 'plu_bombers',
                                trigger: 'hpBelow',
                                threshold: 0.4,
                                once: true,
                                count: 2,
                                role: 'bomber',
                                type: 'enemyFast'
                            },
                            {
                                id: 'plu_reinforce',
                                trigger: 'hpBelow',
                                threshold: 0.35,
                                once: true,
                                count: 2,
                                role: 'gunner',
                                type: 'enemyHeavy'
                            },
                            {
                                id: 'plu_tether_repair',
                                trigger: 'hpBelow',
                                threshold: 0.2,
                                once: true,
                                count: 1,
                                role: 'repair',
                                type: 'enemyBasic'
                            },
                            {
                                id: 'plu_tether',
                                trigger: 'hpBelow',
                                threshold: 0.2,
                                once: true,
                                count: 1,
                                role: 'tether',
                                type: 'enemyBasic'
                            },
                            {
                                id: 'plu_shield_bat',
                                trigger: 'shieldBelow',
                                threshold: 0.25,
                                once: true,
                                count: 1,
                                role: 'shieldBattery',
                                type: 'enemyBasic'
                            }
                        ]
                    },
                    {
                        id: 'plu_fast',
                        type: 'enemyFast',
                        champion: false,
                        level: 1,
                        spawnAt: 8,
                        cluster: 'alpha',
                        role: 'gunner'
                    },
                    {
                        id: 'plu_heavy',
                        type: 'enemyHeavy',
                        champion: false,
                        level: 1,
                        spawnAt: 16,
                        cluster: 'alpha',
                        role: 'blocker'
                    },
                    {
                        id: 'plu_boss_fly',
                        type: 'enemyBoss',
                        champion: false,
                        level: 1,
                        spawnAt: 24,
                        cluster: 'beta',
                        role: 'assault'
                    }
                ],
                sideEnemies: [
                    { type: 'enemyFast', weight: 1, chance: 0.2 },
                    { type: 'enemyHeavy', weight: 2, chance: 0.2 },
                    { type: 'enemyBoss', weight: 1, chance: 0.1 }
                ],
                backgroundLayers: [
                    { pattern: 'grid', speed: 0.2, opacity: 0.12, visible: true, colorSource: 'primary' },
                    { pattern: 'dots', speed: 0.4, opacity: 0.1, visible: true, colorSource: 'secondary' },
                    { pattern: 'lines', speed: 0.6, opacity: 0.07, visible: true, colorSource: 'accent' }
                ],
                baseColor: '#8A7A9A',
                graphics: { enemyShip: 'battleship', obstacleStyle: 'mixed', iconStyle: 'pocked' },
                starsEnabled: true,
                starsOpacity: 0.5,
                levelWidth: 360,
                levelHeight: 450,
                viewZoom: 1,
                dailies: { enabled: true, enemyType: 'enemyBoss', killCountPerDay: 3, requiredDays: 5 },
                resources: [
                    { id: 'voltex', weight: 4, min: 10, max: 22 },
                    { id: 'crystal', weight: 1, min: 5, max: 12 }
                ]
            })
        };
    },

    makePlanet(data) {
        const enemies = this.migrateLegacyEnemies(data || {});
        const obstacles = this.migrateLegacyObstacles(data || {});
        const champion = enemies.find(e => e.champion) || enemies[0];
        const objective = this.normalizeObjective(data.objective, enemies);
        const stages = {};
        if (data.stages && typeof data.stages === 'object') {
            Object.keys(data.stages).forEach(key => {
                const normalized = this.normalizeStage(data.stages[key]);
                if (normalized) stages[key] = normalized;
            });
        }
        const mainType = champion ? champion.type : (data.enemyType || 'fighter');
        const obstacleTypes = this.deriveObstacleTypes(obstacles);
        return {
            id: data.id,
            name: data.name,
            galaxyId: data.galaxyId || 'milky_way',
            difficulty: data.difficulty || 'NORMAL',
            description: data.description || '',
            factions: Array.isArray(data.factions)
                ? data.factions.map(String).filter((f, i, arr) => f && arr.indexOf(f) === i)
                : [],
            enemyType: mainType,
            enemySpeed: data.enemySpeed != null ? data.enemySpeed : 1,
            enemyHealth: data.enemyHealth != null ? data.enemyHealth : 100,
            obstacleSpawnRate: data.obstacleSpawnRate != null ? data.obstacleSpawnRate : 2000,
            obstacles: obstacles,
            obstacleTypes: obstacleTypes.length
                ? obstacleTypes
                : (Array.isArray(data.obstacleTypes) ? data.obstacleTypes.slice() : []),
            enemies: enemies,
            objective: objective,
            stages: stages,
            dailies: this.normalizeDailies(data.dailies),
            // Keep legacy fields for older UI reads
            sideEnemies: Array.isArray(data.sideEnemies) ? data.sideEnemies.map(s => ({
                type: s.type,
                weight: s.weight != null ? s.weight : 1,
                chance: s.chance != null ? s.chance : 0.15
            })) : [],
            backgroundLayers: Array.isArray(data.backgroundLayers)
                ? data.backgroundLayers.map(l => this.normalizeLayer(l))
                : [],
            graphics: Object.assign({ enemyShip: mainType, obstacleStyle: 'asteroid' }, data.graphics || {}, {
                enemyShip: (data.graphics && data.graphics.enemyShip) || mainType
            }),
            starsEnabled: data.starsEnabled !== false,
            starsOpacity: data.starsOpacity != null ? data.starsOpacity : 0.35,
            theme: (data.theme && data.theme !== 'inherit') ? String(data.theme).toLowerCase() : null,
            baseColor: this.normalizeGalaxyBaseColor(data.baseColor),
            background: data.id,
            soundtrackUrl: data.soundtrackUrl ? String(data.soundtrackUrl).trim() : '',
            soundtrackBpm: (function () {
                const n = data.soundtrackBpm != null ? Number(data.soundtrackBpm) : null;
                if (n != null && Number.isFinite(n)) return Math.max(60, Math.min(220, Math.round(n)));
                return null;
            })(),
            resources: this.normalizeResources(data.resources, data.id),
            levelWidth: this.normalizeLevelWidth(data.levelWidth),
            levelHeight: this.normalizeLevelHeight(data.levelHeight),
            viewZoom: this.normalizeViewZoom(data.viewZoom)
        };
    },

    normalizeLevelWidth(value) {
        const n = value != null ? Number(value) : this.defaultLevelWidth;
        if (!Number.isFinite(n)) return this.defaultLevelWidth;
        return Math.max(this.minLevelWidth, Math.min(this.maxLevelWidth, Math.round(n)));
    },

    normalizeLevelHeight(value) {
        const n = value != null ? Number(value) : this.defaultLevelHeight;
        if (!Number.isFinite(n)) return this.defaultLevelHeight;
        return Math.max(this.minLevelHeight, Math.min(this.maxLevelHeight, Math.round(n)));
    },

    normalizeViewZoom(value) {
        const n = value != null ? Number(value) : this.defaultViewZoom;
        if (!Number.isFinite(n)) return this.defaultViewZoom;
        return Math.max(this.minViewZoom, Math.min(this.maxViewZoom, Math.round(n * 100) / 100));
    },
});
