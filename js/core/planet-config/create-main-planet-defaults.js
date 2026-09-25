"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    /** Mars through Neptune. */
    createMainPlanetDefaults() {
        return {
            mars: this.makePlanet({
                id: 'mars',
                name: 'MARS',
                galaxyId: 'milky_way',
                difficulty: 'EASY',
                description: 'Red planet with basic enemies',
                factions: ['pirate', 'terran'],
                theme: 'fire',
                enemyType: 'fighter',
                enemySpeed: 0.8,
                enemyHealth: 100,
                obstacleSpawnRate: 3000,
                obstacleTypes: ['small_asteroid', 'medium_asteroid'],
                sideEnemies: [
                    { type: 'enemyBasic', weight: 1, chance: 0.15 }
                ],
                backgroundLayers: [
                    { pattern: 'mars_surface', speed: 0.2, opacity: 0.18, visible: true, colorSource: 'primary' },
                    { pattern: 'mars_dust', speed: 0.4, opacity: 0.12, visible: true, colorSource: 'secondary' },
                    { pattern: 'mars_sky', speed: 0.6, opacity: 0.08, visible: true, colorSource: 'accent' }
                ],
                baseColor: '#C44B2F',
                graphics: { enemyShip: 'fighter', obstacleStyle: 'asteroid', iconStyle: 'pocked' },
                starsEnabled: true,
                starsOpacity: 0.35,
                levelWidth: 240,
                levelHeight: 300,
                viewZoom: 1,
                dailies: { enabled: true, enemyType: 'enemyBasic', killCountPerDay: 5, requiredDays: 3 },
                resources: [
                    { id: 'scrap', weight: 4, min: 12, max: 28 },
                    { id: 'ore', weight: 2, min: 6, max: 16 }
                ]
            }),
            jupiter: this.makePlanet({
                id: 'jupiter',
                name: 'JUPITER',
                galaxyId: 'milky_way',
                difficulty: 'NORMAL',
                description: 'Gas giant with medium enemies',
                // cruiser = machine; enemyFast = kronax — keep both so the champion isn't filtered
                factions: ['kronax', 'machine'],
                theme: 'sunset',
                enemyType: 'cruiser',
                enemySpeed: 1.0,
                enemyHealth: 150,
                obstacleSpawnRate: 2000,
                obstacleTypes: ['small_asteroid', 'medium_asteroid', 'small_shield'],
                sideEnemies: [
                    { type: 'enemyFast', weight: 2, chance: 0.2 },
                    { type: 'interceptor', weight: 1, chance: 0.1 }
                ],
                backgroundLayers: [
                    { pattern: 'jupiter_bands', speed: 0.2, opacity: 0.16, visible: true, colorSource: 'primary' },
                    { pattern: 'jupiter_storms', speed: 0.4, opacity: 0.12, visible: true, colorSource: 'secondary' },
                    { pattern: 'jupiter_atmosphere', speed: 0.6, opacity: 0.08, visible: true, colorSource: 'accent' }
                ],
                baseColor: '#D4893A',
                graphics: { enemyShip: 'cruiser', obstacleStyle: 'asteroid', iconStyle: 'banded' },
                starsEnabled: true,
                starsOpacity: 0.35,
                levelWidth: 280,
                levelHeight: 350,
                viewZoom: 1,
                dailies: { enabled: true, enemyType: 'enemyFast', killCountPerDay: 5, requiredDays: 3 },
                resources: [
                    { id: 'ore', weight: 3, min: 10, max: 22 },
                    { id: 'crystal', weight: 2, min: 6, max: 16 }
                ]
            }),
            saturn: this.makePlanet({
                id: 'saturn',
                name: 'SATURN',
                galaxyId: 'milky_way',
                difficulty: 'HARD',
                description: 'Ringed planet with tough enemies',
                // battleship = voidborn; enemyHeavy = machine
                factions: ['machine', 'voidborn'],
                theme: 'retro',
                enemyType: 'battleship',
                enemySpeed: 1.2,
                enemyHealth: 200,
                obstacleSpawnRate: 1500,
                obstacleTypes: ['medium_asteroid', 'large_asteroid', 'small_shield', 'medium_shield'],
                sideEnemies: [
                    { type: 'enemyHeavy', weight: 2, chance: 0.22 },
                    { type: 'cruiser', weight: 1, chance: 0.12 }
                ],
                backgroundLayers: [
                    { pattern: 'saturn_rings', speed: 0.2, opacity: 0.16, visible: true, colorSource: 'secondary' },
                    { pattern: 'saturn_clouds', speed: 0.4, opacity: 0.12, visible: true, colorSource: 'primary' },
                    { pattern: 'saturn_sky', speed: 0.6, opacity: 0.08, visible: true, colorSource: 'accent' }
                ],
                baseColor: '#C9A84C',
                graphics: { enemyShip: 'battleship', obstacleStyle: 'mixed', iconStyle: 'ringed' },
                starsEnabled: true,
                starsOpacity: 0.3,
                levelWidth: 320,
                levelHeight: 400,
                viewZoom: 1,
                dailies: { enabled: true, enemyType: 'enemyHeavy', killCountPerDay: 5, requiredDays: 4 },
                resources: [
                    { id: 'crystal', weight: 4, min: 12, max: 28 },
                    { id: 'ore', weight: 1, min: 6, max: 12 }
                ]
            }),
            neptune: this.makePlanet({
                id: 'neptune',
                name: 'NEPTUNE',
                galaxyId: 'milky_way',
                difficulty: 'EXPERT',
                description: 'Ice giant with elite enemies',
                factions: ['voidborn', 'kronax'],
                theme: 'ocean',
                enemyType: 'battleship',
                enemySpeed: 1.5,
                enemyHealth: 250,
                obstacleSpawnRate: 1000,
                obstacleTypes: ['large_asteroid', 'small_shield', 'medium_shield', 'large_shield'],
                enemies: [
                    {
                        id: 'nep_champ',
                        type: 'battleship',
                        champion: true,
                        level: 3,
                        spawnAt: 0,
                        cluster: 'alpha',
                        combatEvents: [
                            {
                                id: 'nep_blocker',
                                trigger: 'hpBelow',
                                threshold: 0.5,
                                once: true,
                                count: 1,
                                role: 'blocker',
                                type: 'enemyHeavy'
                            },
                            {
                                id: 'nep_reinforce',
                                trigger: 'hpBelow',
                                threshold: 0.35,
                                once: true,
                                count: 2,
                                role: 'gunner',
                                type: 'enemyFast'
                            },
                            {
                                id: 'nep_repair',
                                trigger: 'hpBelow',
                                threshold: 0.2,
                                once: true,
                                count: 2,
                                role: 'repair',
                                type: 'enemyBasic'
                            }
                        ]
                    },
                    {
                        id: 'nep_escort',
                        type: 'enemyHeavy',
                        champion: false,
                        level: 1,
                        spawnAt: 8,
                        cluster: 'alpha',
                        role: 'gunner'
                    },
                    {
                        id: 'nep_flyby',
                        type: 'enemyBoss',
                        champion: false,
                        level: 1,
                        spawnAt: 16,
                        cluster: 'beta',
                        role: 'assault'
                    }
                ],
                sideEnemies: [
                    { type: 'enemyHeavy', weight: 2, chance: 0.25 },
                    { type: 'enemyBoss', weight: 1, chance: 0.08 }
                ],
                backgroundLayers: [
                    { pattern: 'neptune_deep', speed: 0.2, opacity: 0.15, visible: true, colorSource: 'primary' },
                    { pattern: 'neptune_storms', speed: 0.4, opacity: 0.11, visible: true, colorSource: 'secondary' },
                    { pattern: 'neptune_ice', speed: 0.6, opacity: 0.08, visible: true, colorSource: 'accent' }
                ],
                baseColor: '#3A6EA5',
                graphics: { enemyShip: 'battleship', obstacleStyle: 'shield', iconStyle: 'banded' },
                starsEnabled: true,
                starsOpacity: 0.4,
                levelWidth: 260,
                levelHeight: 340,
                viewZoom: 1,
                dailies: { enabled: true, enemyType: 'enemyHeavy', killCountPerDay: 5, requiredDays: 5 },
                resources: [
                    { id: 'crystal', weight: 3, min: 10, max: 22 },
                    { id: 'voltex', weight: 2, min: 5, max: 12 }
                ]
            })
        };
    },
});
