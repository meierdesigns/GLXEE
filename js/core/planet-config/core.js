"use strict";

/**
 * Planet configuration — BG layers, obstacles, enemies, objectives, graphics.
 * Persisted in localStorage; consumed by parallax / obstacles / enemies.
 */
class PlanetConfigManager {
    constructor() {
        this.storageKey = 'vf_planet_configs_v1';
        this.availableObstacleTypes = [
            'small_asteroid', 'medium_asteroid', 'large_asteroid',
            'small_shield', 'medium_shield', 'large_shield',
            'fragmented_asteroid', 'fragmented_shield'
        ];
        this.availableEnemyTypes = [
            'enemyBasic', 'enemyFast', 'enemyHeavy', 'enemyBoss',
            'fighter', 'interceptor', 'cruiser', 'battleship',
            'player', 'player_interceptor', 'player_heavy', 'player_assault'
        ];
        this.availableFactions = [
            'terran', 'kronax', 'voidborn', 'pirate', 'machine'
        ];
        this.availableEnemyClasses = [
            'scout', 'assault', 'heavy', 'elite', 'capital'
        ];
        this.availableClusters = [
            'alpha', 'bravo', 'charlie', 'swarm', 'vanguard', 'rear',
            'nebula', 'clouds'
        ];
        this.availableObstacleKinds = ['asteroid', 'shield', 'fog', 'crystal'];
        this.availableObstacleDirections = ['ltr', 'rtl', 'ttb', 'btt', 'diag_dr', 'diag_ur'];
        this.availableObstacleSprites = [
            'obstacle', 'shield', 'obstacleSmall', 'obstacleMedium', 'obstacleLarge', 'fog', 'crystal'
        ];
        this.availableOpticalModes = ['none', 'mirror', 'prism', 'kaleidoscope'];
        this.clusterStorageKey = 'vf_custom_clusters_v1';
        this.typeTaxonomyDefaults = {
            enemyBasic: { faction: 'pirate', enemyClass: 'scout' },
            enemyFast: { faction: 'kronax', enemyClass: 'scout' },
            enemyHeavy: { faction: 'machine', enemyClass: 'heavy' },
            enemyBoss: { faction: 'voidborn', enemyClass: 'capital' },
            fighter: { faction: 'terran', enemyClass: 'assault' },
            interceptor: { faction: 'kronax', enemyClass: 'scout' },
            cruiser: { faction: 'machine', enemyClass: 'heavy' },
            battleship: { faction: 'voidborn', enemyClass: 'capital' },
            player: { faction: 'terran', enemyClass: 'assault' },
            player_interceptor: { faction: 'terran', enemyClass: 'scout' },
            player_heavy: { faction: 'terran', enemyClass: 'heavy' },
            player_assault: { faction: 'terran', enemyClass: 'assault' }
        };
        this.availableObjectiveTypes = [
            'hunt', 'killCount', 'surviveCount', 'surviveTime'
        ];
        this.availablePatterns = [
            'mars_surface', 'mars_dust', 'mars_sky',
            'jupiter_bands', 'jupiter_storms', 'jupiter_atmosphere',
            'saturn_rings', 'saturn_clouds', 'saturn_sky',
            'neptune_deep', 'neptune_storms', 'neptune_ice',
            'grid', 'dots', 'lines'
        ];
        this.colorSources = ['primary', 'secondary', 'accent', 'custom'];
        this.patternStorageKey = 'vf_custom_patterns_v1';
        this.galaxyStorageKey = 'vf_galaxies_v1';
        this.defaultTileSize = 16;
        this.defaultCellSize = 4;
        this.defaultLevelWidth = 240;
        this.defaultLevelHeight = 300;
        this.defaultViewZoom = 1;
        this.minLevelWidth = 160;
        this.maxLevelWidth = 960;
        this.minLevelHeight = 200;
        this.maxLevelHeight = 1200;
        this.minViewZoom = 0.5;
        this.maxViewZoom = 3;
        this.maxObstacleSize = 48;
        this.customPatterns = {};
        this._enemyIdCounter = 0;
        this._obstacleIdCounter = 0;
        this.galaxies = this.createGalaxyDefaults();
        this.configs = this.createDefaults();
        this.load();
        this.loadGalaxies();
        this.loadPatterns();
        this.loadCustomClusters();
    }

    createDefaultGalaxyMap(galaxyId) {
        const gid = String(galaxyId || '').toLowerCase();
        if (gid === 'milky_way') {
            return {
                startPlanetId: 'mars',
                nodes: [
                    { planetId: 'mars', x: 0.18, y: 0.22 },
                    { planetId: 'jupiter', x: 0.50, y: 0.16 },
                    { planetId: 'saturn', x: 0.82, y: 0.28 },
                    { planetId: 'neptune', x: 0.32, y: 0.62 },
                    { planetId: 'pluto', x: 0.68, y: 0.72 }
                ],
                edges: [
                    ['mars', 'jupiter'],
                    ['jupiter', 'saturn'],
                    ['mars', 'neptune'],
                    ['jupiter', 'neptune'],
                    ['jupiter', 'pluto'],
                    ['saturn', 'pluto'],
                    ['neptune', 'pluto']
                ]
            };
        }
        return {
            startPlanetId: null,
            nodes: [],
            edges: []
        };
    }

    createGalaxyDefaults() {
        return {
            milky_way: {
                id: 'milky_way',
                name: 'MILKY WAY',
                faction: 'terran',
                baseColor: null,
                planetIds: ['mars', 'jupiter', 'saturn', 'neptune', 'pluto'],
                map: this.createDefaultGalaxyMap('milky_way')
            },
            andromeda: {
                id: 'andromeda',
                name: 'ANDROMEDA',
                faction: 'kronax',
                baseColor: '#C44B2F',
                planetIds: [],
                map: this.createDefaultGalaxyMap('andromeda')
            },
            void_reach: {
                id: 'void_reach',
                name: 'VOID REACH',
                faction: 'voidborn',
                baseColor: '#5B2C8A',
                planetIds: [],
                map: this.createDefaultGalaxyMap('void_reach')
            },
            scrap_belt: {
                id: 'scrap_belt',
                name: 'SCRAP BELT',
                faction: 'pirate',
                baseColor: '#8B6914',
                planetIds: [],
                map: this.createDefaultGalaxyMap('scrap_belt')
            },
            synth_grid: {
                id: 'synth_grid',
                name: 'SYNTH GRID',
                faction: 'machine',
                baseColor: '#2F8F6B',
                planetIds: [],
                map: this.createDefaultGalaxyMap('synth_grid')
            }
        };
    }

    /**
     * Visual + content profile per faction for procedural planets.
     */
    getFactionPlanetTheme(factionId) {
        const id = String(factionId || 'pirate').toLowerCase();
        const themes = {
            terran: {
                baseColor: '#3A6EA5',
                patterns: ['mars_surface', 'mars_dust', 'mars_sky', 'grid', 'dots'],
                names: ['NEW TERRA', 'BLUE HAVEN', 'SOL REACH', 'FRONTIER CORE', 'ORBITAL GARDEN', 'DAWN COLONY'],
                enemyPool: ['fighter', 'player_assault', 'enemyBasic', 'cruiser'],
                bossPool: ['battleship', 'enemyBoss'],
                obstaclePool: ['small_asteroid', 'medium_asteroid', 'small_shield', 'medium_shield'],
                obstacleStyle: 'asteroid',
                iconStyle: 'banded'
            },
            kronax: {
                baseColor: '#C44B2F',
                patterns: ['jupiter_bands', 'jupiter_storms', 'mars_dust', 'lines', 'dots'],
                names: ['KRON SPIRE', 'ASH CLAW', 'BLOOD RIFT', 'WAR FORGE', 'SCAR REACH', 'IRON MAW'],
                enemyPool: ['enemyFast', 'interceptor', 'fighter', 'enemyHeavy'],
                bossPool: ['enemyBoss', 'battleship'],
                obstaclePool: ['medium_asteroid', 'large_asteroid', 'fragmented_asteroid', 'medium_shield'],
                obstacleStyle: 'asteroid',
                iconStyle: 'cragged'
            },
            voidborn: {
                baseColor: '#5B2C8A',
                patterns: ['neptune_deep', 'neptune_storms', 'neptune_ice', 'dots', 'grid'],
                names: ['VOID NEST', 'ECHO HOLLOW', 'NULL RING', 'SHADE GATE', 'DRIFT TOMB', 'ABYSS KEY'],
                enemyPool: ['enemyBoss', 'battleship', 'cruiser', 'enemyFast'],
                bossPool: ['enemyBoss', 'battleship'],
                obstaclePool: ['small_shield', 'medium_shield', 'large_shield', 'fragmented_shield'],
                obstacleStyle: 'shield',
                iconStyle: 'ringed'
            },
            pirate: {
                baseColor: '#8B6914',
                patterns: ['mars_dust', 'saturn_clouds', 'dots', 'lines', 'grid'],
                names: ['SCRAP YARD', 'BLACK DOCK', 'LOOT REEF', 'RUST GATE', 'SMUGGLER DEN', 'WRECK ORBIT'],
                enemyPool: ['enemyBasic', 'enemyFast', 'fighter', 'interceptor'],
                bossPool: ['enemyHeavy', 'cruiser', 'enemyBoss'],
                obstaclePool: ['small_asteroid', 'medium_asteroid', 'fragmented_asteroid', 'small_shield'],
                obstacleStyle: 'asteroid',
                iconStyle: 'pocked'
            },
            machine: {
                baseColor: '#2F8F6B',
                patterns: ['grid', 'lines', 'dots', 'saturn_rings', 'jupiter_atmosphere'],
                names: ['NODE ARRAY', 'CIRCUIT WELL', 'FORGE HEX', 'PULSE CORE', 'GRID SPIRE', 'SYNTH ORBIT'],
                enemyPool: ['enemyHeavy', 'cruiser', 'battleship', 'fighter'],
                bossPool: ['battleship', 'enemyBoss', 'cruiser'],
                obstaclePool: ['medium_shield', 'large_shield', 'small_shield', 'large_asteroid'],
                obstacleStyle: 'shield',
                iconStyle: 'faceted'
            }
        };
        return themes[id] || themes.pirate;
    }
}
