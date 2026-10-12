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
        // Three ambush flavours: a raider boss with escorts, a pack of 3-4
        // pirates coming one after another, or a swarm of light craft around
        // a weak leader.
        const roll = rng();
        const variant = roll < 0.34 ? 'boss' : roll < 0.67 ? 'pack' : 'swarm';
        const sides = (n, prefix) => {
            for (let i = 0; i < n; i++) {
                enemies.push({
                    id: id + '_' + prefix + i,
                    type: this.pickSeeded(rng, pool) || 'enemyBasic',
                    weight: 1 + Math.floor(rng() * 2),
                    champion: false,
                    faction: 'pirate',
                    spawnAt: i * 3
                });
            }
        };
        let objective = null;
        let enemyHealth = 70 + tier * 30;
        let name = 'PIRATE AMBUSH';
        if (variant === 'pack') {
            // Each pirate is a lighter champion; they arrive one by one
            // (a champion only spawns once the previous one is down).
            const n = 3 + (rng() < 0.5 ? 1 : 0);
            for (let i = 0; i < n; i++) {
                enemies.push({ id: id + '_pack' + i, type: this.pickSeeded(rng, pool) || 'enemyBasic', weight: 1, champion: true, faction: 'pirate', level: 1, spawnAt: i });
            }
            sides(1 + Math.floor(tier / 2), 's');
            enemyHealth = 35 + tier * 15;
            objective = { type: 'hunt', targetEnemyId: id + '_pack' + (n - 1) };
            name = 'PIRATE PACK';
        } else if (variant === 'swarm') {
            // Many side craft around a fragile leader.
            enemies.push({ id: id + '_lead', type: this.pickSeeded(rng, pool) || 'enemyBasic', weight: 1, champion: true, faction: 'pirate', level: 1, spawnAt: 0 });
            sides(5 + Math.min(3, tier), 's');
            enemyHealth = 60 + tier * 20;
            objective = { type: 'hunt', targetEnemyId: id + '_lead' };
            name = 'PIRATE SWARM';
        } else {
            sides(2 + Math.min(3, tier), '');
            enemies.push({ id: id + '_boss', type: this.pickSeeded(rng, bossPool) || 'enemyBoss', weight: 1, champion: true, faction: 'pirate' });
        }
        const lead = enemies.filter((e) => e.champion).pop();
        const cfg = this.makePlanet({
            id: id,
            name: name,
            galaxyId: gid,
            difficulty: difficulty,
            description: 'Raiders intercepted your flight · PIRATE',
            factions: ['pirate'],
            enemySpeed: 0.9 + tier * 0.08,
            enemyHealth: enemyHealth,
            obstacleSpawnRate: 2400,
            obstacleTypes: ['small_asteroid', 'medium_asteroid'],
            enemies: enemies,
            objective: objective,
            backgroundLayers: [
                { pattern: 'dots', colorSource: 'primary', speed: 0.2, opacity: 0.35 },
                { pattern: 'grid', colorSource: 'secondary', speed: 0.4, opacity: 0.25 }
            ],
            theme: null,
            baseColor: theme.baseColor || null,
            graphics: { enemyShip: lead.type, obstacleStyle: 'asteroid', iconStyle: theme.iconStyle || 'banded', faction: 'pirate' },
            // Raider loot: scrap-heavy salvage.
            resources: [
                { id: 'scrap', weight: 4, min: 8 + tier * 4, max: 16 + tier * 6 },
                { id: 'ore', weight: 2, min: 4 + tier * 2, max: 8 + tier * 3 }
            ]
        });
        cfg.encounter = true;
        cfg.ambushVariant = variant;
        this.configs[id] = cfg;
        return cfg;
    },

    isEncounterPlanet(planetId) {
        const cfg = this.configs && this.configs[String(planetId || '').toLowerCase()];
        return !!(cfg && cfg.encounter);
    },
});
