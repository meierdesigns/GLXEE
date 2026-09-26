"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    /**
     * Generate + persist a planet for foreign-galaxy explore / arrival.
     * Planets inherit the galaxy's inhabiting faction for enemies + visuals.
     */
    generateExploredPlanet(galaxyId, seed, exploreIndex, options) {
        const opts = options || {};
        const gid = String(galaxyId || '').toLowerCase();
        if (!this.galaxies[gid]) {
            return { ok: false, reason: 'INVALID GALAXY' };
        }
        if (gid === 'milky_way') {
            return { ok: false, reason: 'HANDCRAFTED' };
        }
        const rng = this.seededRandom(seed);
        const idx = Math.max(1, Math.round(Number(exploreIndex) || 1));
        const difficulties = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'NIGHTMARE'];
        const diffIdx = Math.min(difficulties.length - 1, Math.floor((idx - 1) / 2));
        const difficulty = difficulties[diffIdx];
        // Held galaxies: one faction. Contested: owner + an opposing faction
        // fighting over the planet (see galaxy-control.js).
        const planetFactions = this.pickPlanetFactions(gid, rng);
        const faction = planetFactions[0];
        const rival = planetFactions[1] || null;
        const contested = !!rival;
        const theme = this.getFactionPlanetTheme(faction);
        const rivalTheme = rival ? this.getFactionPlanetTheme(rival) : null;
        const names = (theme.names && theme.names.length)
            ? theme.names
            : ['OUTPOST ' + idx, 'SECTOR ' + idx, 'NODE ' + idx, 'RELAY ' + idx];
        const baseName = names[(idx - 1) % names.length];
        const name = idx > names.length ? (baseName + ' ' + idx) : baseName;
        const id = this.uniquePlanetId(
            gid.slice(0, 3) + '_' + faction.slice(0, 3) + '_x' + idx + '_' +
            this.hashSeed(seed).toString(16).slice(0, 4)
        );

        const enemyPool = (theme.enemyPool && theme.enemyPool.length)
            ? theme.enemyPool
            : ['enemyBasic', 'enemyFast', 'fighter', 'interceptor', 'cruiser', 'enemyHeavy'];
        const bossPool = (theme.bossPool && theme.bossPool.length)
            ? theme.bossPool
            : ['enemyBoss', 'battleship', 'cruiser'];
        const obstaclePool = (theme.obstaclePool && theme.obstaclePool.length)
            ? theme.obstaclePool
            : this.availableObstacleTypes.slice();
        const patternPool = (theme.patterns && theme.patterns.length)
            ? theme.patterns.filter((p) => this.availablePatterns.indexOf(p) !== -1)
            : this.availablePatterns.slice();
        const patterns = patternPool.length ? patternPool : this.availablePatterns.slice();

        const rivalPool = (rivalTheme && rivalTheme.enemyPool && rivalTheme.enemyPool.length)
            ? rivalTheme.enemyPool
            : enemyPool;
        // Frontline planets field one extra wave; ~40% of it is the rival.
        const enemyCount = 2 + Math.min(4, Math.floor(idx / 2)) + (contested ? 1 : 0);
        const enemies = [];
        for (let i = 0; i < enemyCount; i++) {
            const isRival = contested && rng() < 0.4;
            const type = this.pickSeeded(rng, isRival ? rivalPool : enemyPool) || 'fighter';
            enemies.push({
                id: 'gen_' + id + '_' + i,
                type: type,
                weight: 1 + Math.floor(rng() * 3),
                champion: false,
                faction: isRival ? rival : faction
            });
        }
        enemies.push({
            id: 'gen_' + id + '_boss',
            type: this.pickSeeded(rng, bossPool) || 'enemyBoss',
            weight: 1,
            champion: true,
            faction: faction
        });

        const obstacles = [];
        const obsCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < obsCount; i++) {
            const t = this.pickSeeded(rng, obstaclePool);
            if (t && obstacles.indexOf(t) === -1) obstacles.push(t);
        }
        if (!obstacles.length) obstacles.push('small_asteroid');

        const layers = [];
        for (let i = 0; i < 3; i++) {
            layers.push({
                pattern: this.pickSeeded(rng, patterns) || 'grid',
                colorSource: this.pickSeeded(rng, this.colorSources) || 'primary',
                speed: 0.15 + i * 0.2,
                opacity: 0.35 + i * 0.15
            });
        }

        const healthScale = Math.round((80 + idx * 25 + Math.floor(rng() * 40)) * (contested ? 1.15 : 1));
        const speedScale = 0.85 + rng() * 0.5 + idx * 0.03;
        const resources = [
            { id: 'scrap', weight: 3, min: 10 + idx * 2, max: 22 + idx * 4 },
            { id: 'ore', weight: 2, min: 6 + idx, max: 14 + idx * 2 },
            { id: 'crystal', weight: 2, min: 4 + idx, max: 12 + idx * 2 }
        ];
        if (idx >= 3) {
            resources.push({ id: 'voltex', weight: 1, min: 3, max: 8 + idx });
        }
        if (contested) {
            // Battlefield salvage: contested planets pay out a quarter more.
            resources.forEach((r) => {
                r.min = Math.round(r.min * 1.25);
                r.max = Math.round(r.max * 1.25);
            });
        }

        const galaxyBase = (this.galaxies[gid] && this.galaxies[gid].baseColor) || theme.baseColor || null;
        const origin = opts.arrival ? 'Arrival sector' : 'Explored sector';
        const cfg = this.makePlanet({
            id: id,
            name: name,
            galaxyId: gid,
            difficulty: difficulty,
            description: origin + ' · ' + (contested
                ? 'FRONTLINE ' + faction.toUpperCase() + ' vs ' + rival.toUpperCase()
                : faction.toUpperCase()) + ' · seed ' +
                this.hashSeed(seed).toString(16).slice(0, 6),
            factions: planetFactions,
            enemySpeed: Math.round(speedScale * 100) / 100,
            enemyHealth: healthScale,
            obstacleSpawnRate: Math.max(900, 2200 - idx * 80),
            obstacleTypes: obstacles,
            enemies: enemies,
            backgroundLayers: layers,
            theme: null,
            baseColor: galaxyBase,
            graphics: {
                enemyShip: (enemies.find((e) => e.champion) || enemies[0] || {}).type || 'fighter',
                obstacleStyle: theme.obstacleStyle || 'asteroid',
                iconStyle: theme.iconStyle || 'banded',
                faction: faction
            },
            resources: resources
        });
        this.configs[id] = cfg;
        this.syncGalaxyMembership();
        this.placePlanetOnGalaxyMap(gid, id);
        this.registerPlanetGraphic(id);

        const map = this.getGalaxyMap(gid);
        const nodes = map.nodes || [];
        const newNode = nodes.find(n => n.planetId === id);
        if (newNode && nodes.length > 1) {
            let best = null;
            let bestDist = Infinity;
            nodes.forEach((n) => {
                if (n.planetId === id) return;
                const dx = (n.x || 0) - (newNode.x || 0);
                const dy = (n.y || 0) - (newNode.y || 0);
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                    bestDist = d;
                    best = n.planetId;
                }
            });
            if (best) {
                const edge = [best, id];
                const exists = (map.edges || []).some(e =>
                    (e[0] === edge[0] && e[1] === edge[1]) ||
                    (e[0] === edge[1] && e[1] === edge[0])
                );
                if (!exists) {
                    map.edges = (map.edges || []).concat([edge]);
                }
            }
            this.galaxies[gid].map = map;
        }

        if (opts.skipSave !== true) {
            this.save();
            this.applyToRuntime(id);
        }
        return { ok: true, planetId: id, name: name, faction: faction, config: cfg };
    },

    registerPlanetGraphic(planetId) {
        if (typeof planetSVGManager === 'undefined' || !planetSVGManager.registerFromConfig) return;
        const cfg = this.configs[String(planetId || '').toLowerCase()];
        if (!cfg) return;
        planetSVGManager.registerFromConfig(cfg);
    },

    registerPlanetGraphicsForGalaxy(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return;
        (g.planetIds || []).forEach((pid) => this.registerPlanetGraphic(pid));
    },

    /**
     * On first travel into a foreign galaxy the profile has not known yet:
     * generatively seed faction-matched planets + pixel icons.
     * opts.firstVisit: profile has never entered this galaxy → always seed if empty,
     * and rebuild generative pixel graphics even when planets already exist.
     */
    ensureGalaxyArrivalContent(galaxyId, seedBase, options) {
        const opts = options || {};
        const gid = String(galaxyId || '').toLowerCase();
        const g = this.getGalaxy(gid);
        if (!g) return { ok: false, reason: 'INVALID GALAXY' };
        const faction = this.ensureGalaxyFaction(g);
        const theme = this.getFactionPlanetTheme(faction);
        if (!g.baseColor && theme.baseColor) {
            g.baseColor = this.normalizeGalaxyBaseColor(theme.baseColor);
        }
        if (gid === 'milky_way') {
            this.registerPlanetGraphicsForGalaxy(gid);
            return {
                ok: true,
                seeded: false,
                faction: faction,
                planetIds: (g.planetIds || []).slice(),
                startPlanetId: (g.map && g.map.startPlanetId) || null
            };
        }

        this.syncGalaxyMembership();
        const map = this.getGalaxyMap(gid);
        const existingCount = Math.max(
            (g.planetIds || []).length,
            (map.nodes || []).length
        );

        if (existingCount > 0) {
            if (opts.firstVisit && typeof planetSVGManager !== 'undefined' &&
                planetSVGManager.invalidateGalaxy) {
                planetSVGManager.invalidateGalaxy(g.planetIds || []);
            }
            this.registerPlanetGraphicsForGalaxy(gid);
            return {
                ok: true,
                seeded: false,
                faction: faction,
                planetIds: (g.planetIds || []).slice(),
                startPlanetId: map.startPlanetId || (g.planetIds && g.planetIds[0]) || null
            };
        }

        // Unknown / empty foreign galaxy → always generative arrival set
        const seedRoot = String(seedBase || ('arrival|' + gid));
        const count = 4;
        const planetIds = [];
        let startPlanetId = null;
        for (let i = 1; i <= count; i++) {
            const result = this.generateExploredPlanet(
                gid,
                seedRoot + '|arrival|' + i,
                i,
                { arrival: true, skipSave: true }
            );
            if (!result || !result.ok) continue;
            planetIds.push(result.planetId);
            if (!startPlanetId) startPlanetId = result.planetId;
        }
        if (startPlanetId) {
            const nextMap = this.getGalaxyMap(gid);
            nextMap.startPlanetId = startPlanetId;
            g.map = nextMap;
        }
        this.syncGalaxyMembership();
        this.registerPlanetGraphicsForGalaxy(gid);
        this.save();
        if (startPlanetId) this.applyToRuntime(startPlanetId);
        return {
            ok: true,
            seeded: planetIds.length > 0,
            faction: faction,
            planetIds: planetIds,
            startPlanetId: startPlanetId
        };
    },
});
