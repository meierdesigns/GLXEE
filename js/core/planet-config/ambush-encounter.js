"use strict";

// PlanetConfigManager methods: pirate ambushes on galaxy-map flights.
// An ambush is a one-off combat sector (never placed on the map, not saved,
// not counted as a galaxy planet) that the travel animation can drop the
// player into.

extendClass(PlanetConfigManager, {
    /**
     * Build (or rebuild) the ambush sector for a galaxy. Difficulty follows
     * the destination planet so ambushes scale with where you are flying.
     */
    createAmbushEncounter(galaxyId, destinationPlanetId, seed) {
        const gid = String(galaxyId || '').toLowerCase();
        const rng = this.seededRandom(String(seed || Date.now()));
        const dest = destinationPlanetId ? this.getConfig(destinationPlanetId) : null;
        const difficulty = (dest && dest.difficulty) || 'NORMAL';
        const tier = Math.max(1, ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'].indexOf(difficulty) + 1);
        const theme = this.getFactionPlanetTheme('pirate');
        const pool = (theme.enemyPool && theme.enemyPool.length) ? theme.enemyPool : ['enemyBasic', 'fighter'];
        const bossPool = (theme.bossPool && theme.bossPool.length) ? theme.bossPool : ['enemyBoss'];
        const id = 'ambush_' + gid;
        const enemies = [];
        const count = 2 + Math.min(3, tier);
        for (let i = 0; i < count; i++) {
            enemies.push({
                id: id + '_' + i,
                type: this.pickSeeded(rng, pool) || 'enemyBasic',
                weight: 1 + Math.floor(rng() * 2),
                champion: false,
                faction: 'pirate'
            });
        }
        enemies.push({ id: id + '_boss', type: this.pickSeeded(rng, bossPool) || 'enemyBoss', weight: 1, champion: true, faction: 'pirate' });
        const cfg = this.makePlanet({
            id: id,
            name: 'PIRATE AMBUSH',
            galaxyId: gid,
            difficulty: difficulty,
            description: 'Raiders intercepted your flight · PIRATE',
            factions: ['pirate'],
            enemySpeed: 0.9 + tier * 0.08,
            enemyHealth: 70 + tier * 30,
            obstacleSpawnRate: 2400,
            obstacleTypes: ['small_asteroid', 'medium_asteroid'],
            enemies: enemies,
            backgroundLayers: [
                { pattern: 'dots', colorSource: 'primary', speed: 0.2, opacity: 0.35 },
                { pattern: 'grid', colorSource: 'secondary', speed: 0.4, opacity: 0.25 }
            ],
            theme: null,
            baseColor: theme.baseColor || null,
            graphics: { enemyShip: enemies[enemies.length - 1].type, obstacleStyle: 'asteroid', iconStyle: theme.iconStyle || 'banded', faction: 'pirate' },
            // Raider loot: scrap-heavy salvage.
            resources: [
                { id: 'scrap', weight: 4, min: 8 + tier * 4, max: 16 + tier * 6 },
                { id: 'ore', weight: 2, min: 4 + tier * 2, max: 8 + tier * 3 }
            ]
        });
        cfg.encounter = true;
        this.configs[id] = cfg;
        return cfg;
    },

    isEncounterPlanet(planetId) {
        const cfg = this.configs && this.configs[String(planetId || '').toLowerCase()];
        return !!(cfg && cfg.encounter);
    },
});
