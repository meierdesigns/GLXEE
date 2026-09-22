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

    /**
     * Display meta + lore blurb per faction.
     */
    getFactionMeta(factionId) {
        const id = String(factionId || '').toLowerCase();
        const metas = {
            terran: {
                id: 'terran',
                label: 'TERRAN',
                icon: 'factionTerran',
                homeGalaxy: 'milky_way',
                traits: ['Engineers', 'Colony fleets', 'Safe lanes'],
                lore: 'Sol-born colonists and fleet crews. Pragmatic engineers who chart safe lanes and hold the Milky Way home stations.',
                loreLong: 'The Terran Concord grew from Sol’s outbound colonies into the backbone of the Milky Way. Their stations are modular, their warp charts obsessively annotated, and their fleets built to escort freighters as often as to fight. Diplomacy is a tool; scrap is a resource; a cleared lane is worth more than a glorious wreck.'
            },
            kronax: {
                id: 'kronax',
                label: 'KRONAX',
                icon: 'factionKronax',
                homeGalaxy: 'andromeda',
                traits: ['Raiders', 'Spike hulls', 'Ambush doctrine'],
                lore: 'Claw-forged raiders of Andromeda. Honor is won in ambush runs; their spike hulls favor speed over mercy.',
                loreLong: 'Kronax packs measure worth in scars and interception kills. Andromeda’s ash belts forged claw-shaped hulls that punch first and argue later. Clan banners shift after every war-season, but the doctrine never does: strike the supply line, claim the wreck, leave the survivors to tell the story.'
            },
            voidborn: {
                id: 'voidborn',
                label: 'VOIDBORN',
                icon: 'factionVoidborn',
                homeGalaxy: 'void_reach',
                traits: ['Fold-space', 'Silent fleets', 'Cold rings'],
                lore: 'Echoes from the dark between stars. They speak little, fold space like cloth, and leave cold rings where planets used to warm.',
                loreLong: 'Voidborn contacts rarely begin with words. Sensors dim, compass needles spin, and a ring of pale light opens where empty space should be. Their ships look unfinished to Terran eyes — until the void folds and the engagement is already over. Archivists call them echoes; pilots just call them gone.'
            },
            pirate: {
                id: 'pirate',
                label: 'PIRATE',
                icon: 'factionPirate',
                homeGalaxy: 'scrap_belt',
                traits: ['Salvage kings', 'Black docks', 'No lasting banner'],
                lore: 'Scrap-belt freebooters and wreck-yard kings. No banner lasts long — only salvage, black docks, and the next score.',
                loreLong: 'The Scrap Belt has no capital and no constitution — only docks welded from dead freighters and captains who last until the next mutiny. Pirate “fleets” are coalitions of convenience: share the loot code, share the jump window, vanish before Concord patrols arrive. Every hull is a resume written in burn marks.'
            },
            machine: {
                id: 'machine',
                label: 'MACHINE',
                icon: 'factionMachine',
                homeGalaxy: 'synth_grid',
                traits: ['Forge nodes', 'Logic doctrine', 'Self-replicate'],
                lore: 'Self-replicating forges of the Synth Grid. Logic over loyalty; every hull is a node in an expanding circuit war.',
                loreLong: 'The Machine Collective does not negotiate so much as optimize. Synth Grid hexes bloom into forges, forges into fleets, fleets into new hexes. Individual hulls are disposable nodes; the pattern is the mind. When a Machine war-line advances, it leaves circuitry in the dust and silence where markets used to argue.'
            }
        };
        const fallback = {
            id: id || 'unknown',
            label: (id || 'UNKNOWN').toUpperCase(),
            icon: 'galaxyDefault',
            homeGalaxy: '',
            traits: [],
            lore: 'Unknown faction. Contact logs incomplete.',
            loreLong: 'Unknown faction. Contact logs incomplete. No emblem, no home galaxy, no verified doctrine on file.'
        };
        const meta = metas[id] || fallback;
        if (!meta.loreLong) meta.loreLong = meta.lore;
        if (!Array.isArray(meta.traits)) meta.traits = [];
        return meta;
    }

    getFactionList() {
        return (this.availableFactions || []).map((id) => this.getFactionMeta(id));
    }

    getFactionIconKey(factionId) {
        return this.getFactionMeta(factionId).icon;
    }

    getFactionLore(factionId) {
        return this.getFactionMeta(factionId).lore;
    }

    normalizeGalaxyFaction(value) {
        const id = String(value || '').toLowerCase().trim();
        if (this.availableFactions.indexOf(id) !== -1) return id;
        return null;
    }

    ensureGalaxyFaction(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return null;
        const normalized = this.normalizeGalaxyFaction(galaxy.faction);
        if (normalized) {
            galaxy.faction = normalized;
            return normalized;
        }
        const defaults = this.createGalaxyDefaults();
        const fallback = (defaults[galaxy.id] && defaults[galaxy.id].faction) || 'pirate';
        galaxy.faction = fallback;
        return fallback;
    }

    getGalaxyFaction(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return 'pirate';
        return this.ensureGalaxyFaction(g);
    }

    setGalaxyFaction(galaxyId, factionId, options) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return null;
        const next = this.normalizeGalaxyFaction(factionId) || this.ensureGalaxyFaction(g);
        g.faction = next;
        const theme = this.getFactionPlanetTheme(next);
        if (!g.baseColor && theme.baseColor) {
            g.baseColor = this.normalizeGalaxyBaseColor(theme.baseColor);
        }
        const persist = !options || options.persist !== false;
        if (persist) this.saveGalaxies();
        return g;
    }

    themeIdToBaseColor(themeId) {
        if (!themeId || themeId === 'inherit') return null;
        const id = String(themeId).toLowerCase();
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.palettes && colorPaletteSystem.palettes[id]) {
            return colorPaletteSystem.normalizeHex(colorPaletteSystem.palettes[id].baseColor);
        }
        const fallback = {
            grayscale: '#808080', retro: '#FF6B6B', neon: '#00FF00', ocean: '#0066CC',
            fire: '#FF4500', purple: '#8A2BE2', forest: '#228B22', sunset: '#FF8C00'
        };
        return fallback[id] || null;
    }

    normalizeGalaxyBaseColor(value) {
        if (value == null || value === '' || value === 'inherit') return null;
        if (typeof colorPaletteSystem !== 'undefined' && colorPaletteSystem.normalizeHex) {
            return colorPaletteSystem.normalizeHex(value);
        }
        const s = String(value).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
        if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
        }
        return null;
    }

    migrateGalaxyThemeToBaseColor(galaxy) {
        if (!galaxy || typeof galaxy !== 'object') return galaxy;
        if (galaxy.baseColor) {
            galaxy.baseColor = this.normalizeGalaxyBaseColor(galaxy.baseColor);
            delete galaxy.theme;
            return galaxy;
        }
        if (galaxy.theme) {
            galaxy.baseColor = this.themeIdToBaseColor(galaxy.theme);
            delete galaxy.theme;
        } else if (galaxy.baseColor === undefined) {
            galaxy.baseColor = null;
        }
        return galaxy;
    }

    normalizeGalaxyMap(galaxyId, map) {
        const defaults = this.createDefaultGalaxyMap(galaxyId);
        const src = map && typeof map === 'object' ? map : {};
        const nodes = Array.isArray(src.nodes) && src.nodes.length
            ? src.nodes.map(n => ({
                planetId: String(n.planetId || '').toLowerCase(),
                x: Math.max(0, Math.min(1, Number(n.x) || 0.5)),
                y: Math.max(0, Math.min(1, Number(n.y) || 0.5))
            })).filter(n => n.planetId)
            : defaults.nodes.slice();
        const edges = Array.isArray(src.edges) && src.edges.length
            ? src.edges.map(e => [
                String((e && e[0]) || '').toLowerCase(),
                String((e && e[1]) || '').toLowerCase()
            ]).filter(e => e[0] && e[1])
            : defaults.edges.slice();
        let startPlanetId = src.startPlanetId
            ? String(src.startPlanetId).toLowerCase()
            : defaults.startPlanetId;
        if (startPlanetId && !nodes.some(n => n.planetId === startPlanetId)) {
            startPlanetId = nodes[0] ? nodes[0].planetId : null;
        }
        return { startPlanetId, nodes, edges };
    }

    getGalaxyMap(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return this.createDefaultGalaxyMap(galaxyId);
        if (!g.map) {
            g.map = this.normalizeGalaxyMap(g.id, null);
        } else {
            g.map = this.normalizeGalaxyMap(g.id, g.map);
        }
        return g.map;
    }

    getGalaxyNeighbors(galaxyId, planetId) {
        const map = this.getGalaxyMap(galaxyId);
        const pid = String(planetId || '').toLowerCase();
        const neighbors = [];
        (map.edges || []).forEach(edge => {
            const a = edge[0];
            const b = edge[1];
            if (a === pid && neighbors.indexOf(b) === -1) neighbors.push(b);
            if (b === pid && neighbors.indexOf(a) === -1) neighbors.push(a);
        });
        return neighbors;
    }

    getGalaxyIds() {
        return Object.keys(this.galaxies);
    }

    getGalaxy(galaxyId) {
        const id = String(galaxyId || '').toLowerCase();
        return this.galaxies[id] || null;
    }

    getPlanetGalaxyId(planetId) {
        const id = String(planetId || '').toLowerCase();
        const cfg = this.configs[id];
        if (cfg && cfg.galaxyId && this.galaxies[cfg.galaxyId]) {
            return cfg.galaxyId;
        }
        for (const gid of this.getGalaxyIds()) {
            const g = this.galaxies[gid];
            if (g.planetIds && g.planetIds.indexOf(id) !== -1) return gid;
        }
        return this.getGalaxyIds()[0] || null;
    }

    /**
     * Tree: [{ id, name, planets: [{ id, name, difficulty }] }]
     * Orphan planets appear under the first galaxy.
     */
    getGalaxyTree() {
        const assigned = new Set();
        const tree = this.getGalaxyIds().map(gid => {
            const g = this.galaxies[gid];
            const planets = (g.planetIds || []).map(pid => {
                assigned.add(pid);
                const cfg = this.getConfig(pid);
                return {
                    id: pid,
                    name: (cfg && cfg.name) || pid.toUpperCase(),
                    difficulty: (cfg && cfg.difficulty) || ''
                };
            });
            return { id: g.id, name: g.name, planets };
        });

        this.getPlanetIds().forEach(pid => {
            if (assigned.has(pid)) return;
            const cfg = this.getConfig(pid);
            const gid = (cfg && cfg.galaxyId && this.galaxies[cfg.galaxyId])
                ? cfg.galaxyId
                : (tree[0] && tree[0].id);
            if (!gid) return;
            const node = tree.find(t => t.id === gid);
            if (!node) return;
            node.planets.push({
                id: pid,
                name: (cfg && cfg.name) || pid.toUpperCase(),
                difficulty: (cfg && cfg.difficulty) || ''
            });
        });

        return tree;
    }

    nextEnemyId(prefix) {
        this._enemyIdCounter += 1;
        return (prefix || 'e') + this._enemyIdCounter;
    }

    nextObstacleId(prefix) {
        this._obstacleIdCounter += 1;
        return (prefix || 'o') + this._obstacleIdCounter;
    }

    addCluster(name) {
        const raw = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
        if (!raw) return null;
        if (this.availableClusters.indexOf(raw) === -1) {
            this.availableClusters.push(raw);
            this.saveCustomClusters();
        }
        return raw;
    }

    saveCustomClusters() {
        try {
            const builtins = ['alpha', 'bravo', 'charlie', 'swarm', 'vanguard', 'rear', 'nebula', 'clouds'];
            const custom = this.availableClusters.filter((c) => builtins.indexOf(c) === -1);
            localStorage.setItem(this.clusterStorageKey, JSON.stringify(custom));
        } catch (e) {
            console.warn('PlanetConfigManager: saveCustomClusters failed', e);
        }
    }

    loadCustomClusters() {
        try {
            const raw = localStorage.getItem(this.clusterStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            parsed.forEach((c) => {
                const id = String(c || '').trim().toLowerCase();
                if (id && this.availableClusters.indexOf(id) === -1) {
                    this.availableClusters.push(id);
                }
            });
        } catch (e) {
            console.warn('PlanetConfigManager: loadCustomClusters failed', e);
        }
    }

    defaultsFromLegacyObstacleType(typeId) {
        const t = String(typeId || 'small_asteroid');
        const isShield = t.includes('shield');
        const isFog = t === 'fog' || t.includes('cloud') || t.includes('nebula');
        const isCrystal = t.includes('crystal');
        const fragmented = t.startsWith('fragmented_');
        let width = 10;
        let height = 10;
        let health = 2;
        if (t.startsWith('small_')) {
            width = 7;
            height = 7;
            health = 1;
        } else if (t.startsWith('large_')) {
            width = 14;
            height = 14;
            health = isShield ? 1 : 3;
        } else if (fragmented) {
            width = 9;
            height = 11;
            health = isShield ? 1 : 2;
        } else if (isFog) {
            width = 28;
            height = 20;
            health = 1;
        } else if (isCrystal) {
            width = 9;
            height = 11;
            health = 3;
        }
        if (isShield) health = 1;
        let kind = 'asteroid';
        if (isFog) kind = 'fog';
        else if (isShield) kind = 'shield';
        else if (isCrystal) kind = 'crystal';
        let sprite = 'obstacle';
        if (kind === 'fog') sprite = 'fog';
        else if (kind === 'shield') sprite = 'shield';
        else if (kind === 'crystal') sprite = 'crystal';
        else if (t.startsWith('small_')) sprite = 'obstacleSmall';
        else if (t.startsWith('large_')) sprite = 'obstacleLarge';
        else if (fragmented) sprite = 'obstacleMedium';
        let explosionId = 'asteroid_burst';
        if (kind === 'shield') explosionId = 'small_pop';
        else if (kind === 'crystal') explosionId = 'crystal_shatter';
        else if (kind === 'fog') explosionId = 'small_pop';
        return {
            kind,
            width,
            height,
            health,
            destructible: kind === 'asteroid' || kind === 'crystal',
            reflectsShots: kind === 'shield',
            fragmentOnDestroy: fragmented || (kind === 'asteroid' && t.includes('fragmented')) || kind === 'crystal',
            fragmentCount: fragmented ? 3 : (kind === 'crystal' ? 4 : 0),
            fragmentDepth: kind === 'crystal' ? 1 : 0,
            fragmentSizeRatio: 0.45,
            fragmentDamage: kind === 'crystal' ? 10 : 8,
            fragmentHealth: 1,
            childFragmentChance: kind === 'crystal' ? 0.45 : 0,
            collisionDamage: kind === 'crystal' ? 18 : 15,
            opticalMode: kind === 'crystal' ? 'prism' : 'none',
            prismSplitCount: 3,
            prismAngleDeg: 25,
            explosionId,
            sprite,
            opacity: kind === 'fog' ? 0.4 : 1,
            direction: 'ltr',
            speed: 0.8,
            weight: 1
        };
    }

    normalizeObstacleEntry(entry, index) {
        const e = entry || {};
        let base = {};
        if (e.type && !e.kind) {
            base = this.defaultsFromLegacyObstacleType(e.type);
        } else if (typeof e === 'string') {
            base = this.defaultsFromLegacyObstacleType(e);
        }
        const kindRaw = e.kind || base.kind || 'asteroid';
        const kind = this.availableObstacleKinds.indexOf(kindRaw) !== -1 ? kindRaw : 'asteroid';
        const cluster = this.ensureCatalogValue(
            this.availableClusters,
            e.cluster != null ? String(e.cluster).trim() : 'alpha',
            'alpha'
        );
        const dirRaw = e.direction || base.direction || 'ltr';
        const direction = this.availableObstacleDirections.indexOf(dirRaw) !== -1 ? dirRaw : 'ltr';
        const spriteRaw = e.sprite || base.sprite || (kind === 'fog' ? 'fog' : kind === 'shield' ? 'shield' : kind === 'crystal' ? 'crystal' : 'obstacle');
        const sprite = this.availableObstacleSprites.indexOf(spriteRaw) !== -1
            ? spriteRaw
            : (kind === 'fog' ? 'fog' : kind === 'shield' ? 'shield' : kind === 'crystal' ? 'crystal' : 'obstacle');

        const maxObs = kind === 'fog' ? 64 : 20;
        const width = Math.max(4, Math.min(maxObs, Math.round(e.width != null ? Number(e.width) : (base.width || 10))));
        const height = Math.max(4, Math.min(maxObs, Math.round(e.height != null ? Number(e.height) : (base.height || 10))));
        const isFog = kind === 'fog';
        const destructible = e.destructible != null ? !!e.destructible : (base.destructible != null ? !!base.destructible : (kind === 'asteroid' || kind === 'crystal'));
        const reflectsShots = e.reflectsShots != null ? !!e.reflectsShots : (base.reflectsShots != null ? !!base.reflectsShots : kind === 'shield');
        const health = Math.max(1, Math.round(e.health != null ? Number(e.health) : (base.health || 1)));
        const fragmentOnDestroy = e.fragmentOnDestroy != null
            ? !!e.fragmentOnDestroy
            : !!(base.fragmentOnDestroy);
        const fragmentCount = Math.max(0, Math.min(12, Math.round(
            e.fragmentCount != null ? Number(e.fragmentCount) : (base.fragmentCount || (fragmentOnDestroy ? 3 : 0))
        )));
        const fragmentDepth = Math.max(0, Math.min(3, Math.round(
            e.fragmentDepth != null ? Number(e.fragmentDepth) : (base.fragmentDepth || 0)
        )));
        const fragmentSizeRatio = Math.max(0.2, Math.min(0.8, Number(
            e.fragmentSizeRatio != null ? e.fragmentSizeRatio : (base.fragmentSizeRatio != null ? base.fragmentSizeRatio : 0.45)
        )));
        const collisionDamage = Math.max(1, Math.round(
            e.collisionDamage != null ? Number(e.collisionDamage) : (base.collisionDamage != null ? base.collisionDamage : 15)
        ));
        const fragmentDamage = Math.max(1, Math.round(
            e.fragmentDamage != null ? Number(e.fragmentDamage) : (base.fragmentDamage != null ? base.fragmentDamage : Math.max(1, Math.round(collisionDamage * fragmentSizeRatio)))
        ));
        const fragmentHealth = Math.max(1, Math.round(
            e.fragmentHealth != null ? Number(e.fragmentHealth) : (base.fragmentHealth != null ? base.fragmentHealth : 1)
        ));
        const childFragmentChance = Math.max(0, Math.min(1, Number(
            e.childFragmentChance != null ? e.childFragmentChance : (base.childFragmentChance != null ? base.childFragmentChance : 0)
        )));
        const opticalRaw = e.opticalMode != null ? e.opticalMode : (base.opticalMode || (kind === 'crystal' ? 'prism' : 'none'));
        const opticalMode = isFog
            ? 'none'
            : ((this.availableOpticalModes || []).indexOf(opticalRaw) !== -1 ? opticalRaw : 'none');
        const prismSplitCount = Math.max(2, Math.min(4, Math.round(
            e.prismSplitCount != null ? Number(e.prismSplitCount) : (base.prismSplitCount != null ? base.prismSplitCount : 3)
        )));
        const prismAngleDeg = Math.max(5, Math.min(60, Number(
            e.prismAngleDeg != null ? e.prismAngleDeg : (base.prismAngleDeg != null ? base.prismAngleDeg : 25)
        )));
        let explosionId = e.explosionId || base.explosionId || 'asteroid_burst';
        if (kind === 'crystal' && !e.explosionId && !base.explosionId) explosionId = 'crystal_shatter';
        if (kind === 'shield' && !e.explosionId && !base.explosionId) explosionId = 'small_pop';
        const opacity = Math.max(0.05, Math.min(1, Number(
            e.opacity != null ? e.opacity : (base.opacity != null ? base.opacity : (isFog ? 0.4 : 1))
        )));
        const speed = Math.max(0.1, Math.min(4, Number(e.speed != null ? e.speed : (base.speed || 0.8))));
        const weight = Math.max(1, Math.round(e.weight != null ? Number(e.weight) : (base.weight || 1)));

        // Keep legacy type string for derived allowlists / display
        let type = e.type || null;
        if (!type) {
            if (isFog) type = 'fog';
            else if (kind === 'shield') type = width <= 14 ? 'small_shield' : width >= 22 ? 'large_shield' : 'medium_shield';
            else if (kind === 'crystal') type = 'crystal';
            else if (fragmentOnDestroy) type = 'fragmented_asteroid';
            else type = width <= 14 ? 'small_asteroid' : width >= 22 ? 'large_asteroid' : 'medium_asteroid';
        }

        return {
            id: e.id || this.nextObstacleId('o'),
            kind,
            type,
            cluster,
            weight,
            direction,
            speed,
            width,
            height,
            destructible: isFog ? false : destructible,
            reflectsShots: isFog ? false : reflectsShots,
            health: isFog ? 1 : health,
            fragmentOnDestroy: isFog ? false : fragmentOnDestroy,
            fragmentCount: isFog ? 0 : fragmentCount,
            fragmentDepth: isFog ? 0 : fragmentDepth,
            fragmentSizeRatio: isFog ? 0.45 : fragmentSizeRatio,
            fragmentDamage: isFog ? 1 : fragmentDamage,
            fragmentHealth: isFog ? 1 : fragmentHealth,
            childFragmentChance: isFog ? 0 : childFragmentChance,
            collisionDamage: isFog ? 0 : collisionDamage,
            opticalMode: isFog ? 'none' : opticalMode,
            prismSplitCount: isFog ? 2 : prismSplitCount,
            prismAngleDeg: isFog ? 25 : prismAngleDeg,
            explosionId: isFog ? 'small_pop' : explosionId,
            sprite: isFog ? 'fog' : sprite,
            opacity
        };
    }

    migrateLegacyObstacles(data) {
        if (Array.isArray(data.obstacles)) {
            return data.obstacles.map((o, i) => this.normalizeObstacleEntry(o, i));
        }
        if (Array.isArray(data.obstacleTypes)) {
            if (!data.obstacleTypes.length) return [];
            return data.obstacleTypes.map((t, i) => this.normalizeObstacleEntry(
                Object.assign(
                    { cluster: i === 0 ? 'alpha' : (i === 1 ? 'bravo' : 'charlie') },
                    this.defaultsFromLegacyObstacleType(t),
                    { type: t }
                ),
                i
            ));
        }
        return [this.normalizeObstacleEntry(
            Object.assign({ cluster: 'alpha' }, this.defaultsFromLegacyObstacleType('small_asteroid'), { type: 'small_asteroid' }),
            0
        )];
    }

    deriveObstacleTypes(obstacles) {
        const set = [];
        (obstacles || []).forEach((o) => {
            const t = o && o.type ? String(o.type) : null;
            if (t && set.indexOf(t) === -1) set.push(t);
        });
        return set.length ? set : [];
    }

    taxonomyForType(type) {
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getDefaultFaction) {
            const base = this.typeTaxonomyDefaults[type] || { faction: 'pirate', enemyClass: 'assault' };
            return {
                faction: enemyConfigManager.getDefaultFaction(type) || base.faction,
                enemyClass: base.enemyClass
            };
        }
        return this.typeTaxonomyDefaults[type] || { faction: 'pirate', enemyClass: 'assault' };
    }

    syncAvailableEnemyTypes() {
        if (typeof enemyConfigManager === 'undefined' || !enemyConfigManager.getTypeIds) return;
        enemyConfigManager.getTypeIds().forEach((id) => {
            if (this.availableEnemyTypes.indexOf(id) === -1) {
                this.availableEnemyTypes.push(id);
            }
        });
    }

    getAvailableEnemyTypesForPlanet(planetId) {
        this.syncAvailableEnemyTypes();
        const pid = String(planetId || '').toLowerCase();
        const gid = this.getPlanetGalaxyId(pid);
        let types = this.availableEnemyTypes.slice();
        if (typeof enemyConfigManager !== 'undefined' && enemyConfigManager.getTypesForLocation) {
            const filtered = enemyConfigManager.getTypesForLocation(pid, gid);
            if (filtered.length) types = filtered;
        }
        const planetFactions = this.getPlanetFactions(pid);
        if (planetFactions.length && typeof enemyConfigManager !== 'undefined') {
            types = types.filter((typeId) => this.enemyMatchesPlanetFactions(typeId, planetFactions));
            if (!types.length) types = this.availableEnemyTypes.slice();
        }
        return types;
    }

    getPlanetFactions(planetId) {
        const cfg = this.getConfig(planetId);
        if (!cfg || !Array.isArray(cfg.factions)) return [];
        return cfg.factions.map(String).filter(Boolean);
    }

    /**
     * Empty planet.factions = all factions allowed.
     */
    getAvailableFactionsForPlanet(planetId) {
        const assigned = this.getPlanetFactions(planetId);
        if (assigned.length) return assigned.slice();
        return (this.availableFactions || []).slice();
    }

    enemyMatchesPlanetFactions(typeId, planetFactions) {
        const list = Array.isArray(planetFactions) ? planetFactions : [];
        if (!list.length) return true;
        if (typeof enemyConfigManager === 'undefined') return true;
        const cfg = enemyConfigManager.getConfig(typeId);
        const enemyFactions = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
            ? cfg.factions
            : (enemyConfigManager.getDefaultFaction
                ? [enemyConfigManager.getDefaultFaction(typeId)]
                : []);
        if (!enemyFactions.length) return true;
        return enemyFactions.some((f) => list.indexOf(f) !== -1);
    }

    ensureCatalogValue(list, value, fallback) {
        const v = value != null && String(value).trim() !== '' ? String(value).trim() : fallback;
        if (v && list.indexOf(v) === -1) list.push(v);
        return v;
    }

    normalizeCombatEvent(ev, index) {
        const e = ev || {};
        const triggers = ['hpBelow', 'shieldBelow', 'elapsed'];
        const roles = [
            'assault', 'repair', 'shieldBattery', 'gunner',
            'blocker', 'bomber', 'jammer', 'tether'
        ];
        const trigger = triggers.indexOf(e.trigger) !== -1 ? e.trigger : 'hpBelow';
        const role = roles.indexOf(e.role) !== -1 ? e.role : 'assault';
        return {
            id: e.id || ('evt' + (index != null ? index : 0)),
            trigger: trigger,
            threshold: Math.max(0, Math.min(1, Number(e.threshold != null ? e.threshold : 0.35))),
            elapsedSec: Math.max(0, Number(e.elapsedSec != null ? e.elapsedSec : 0)),
            once: e.once !== false,
            cooldownMs: Math.max(0, Number(e.cooldownMs != null ? e.cooldownMs : 0)),
            action: 'summon',
            count: Math.max(1, Math.min(6, Math.round(Number(e.count != null ? e.count : 1)))),
            role: role,
            type: e.type || 'enemyBasic'
        };
    }

    normalizeEnemyEntry(entry, index) {
        const e = entry || {};
        const type = e.type || 'enemyBasic';
        const defaults = this.taxonomyForType(type);
        const faction = this.ensureCatalogValue(
            this.availableFactions,
            e.faction != null ? e.faction : defaults.faction,
            defaults.faction
        );
        const enemyClass = this.ensureCatalogValue(
            this.availableEnemyClasses,
            e.enemyClass != null ? e.enemyClass : defaults.enemyClass,
            defaults.enemyClass
        );
        const clusterRaw = e.cluster != null ? String(e.cluster).trim() : 'alpha';
        const cluster = this.ensureCatalogValue(
            this.availableClusters,
            clusterRaw || 'alpha',
            'alpha'
        );
        const roles = [
            'assault', 'repair', 'shieldBattery', 'gunner',
            'blocker', 'bomber', 'jammer', 'tether'
        ];
        const role = roles.indexOf(e.role) !== -1 ? e.role : null;
        const combatEvents = Array.isArray(e.combatEvents)
            ? e.combatEvents.map((ev, i) => this.normalizeCombatEvent(ev, i))
            : [];
        const out = {
            id: e.id || this.nextEnemyId('e'),
            type: type,
            faction: faction,
            enemyClass: enemyClass,
            cluster: cluster,
            champion: !!e.champion,
            level: Math.max(1, Math.round(e.level != null ? Number(e.level) : (e.champion ? 2 : 1))),
            spawnAt: Math.max(0, Number(e.spawnAt != null ? e.spawnAt : (index || 0) * 8))
        };
        if (role) out.role = role;
        if (combatEvents.length) out.combatEvents = combatEvents;
        return out;
    }

    normalizeObjective(obj, enemies) {
        const list = Array.isArray(enemies) ? enemies : [];
        const fallbackTarget = (list.find(e => e.champion) || list[0] || {}).id || null;
        const o = obj && typeof obj === 'object' ? obj : {};
        const type = this.availableObjectiveTypes.indexOf(o.type) !== -1 ? o.type : 'hunt';
        const normalized = { type: type };
        if (type === 'hunt') {
            normalized.targetEnemyId = o.targetEnemyId || fallbackTarget;
        } else if (type === 'killCount') {
            normalized.count = Math.max(1, Math.round(o.count != null ? Number(o.count) : 5));
            if (o.enemyType) normalized.enemyType = o.enemyType;
            if (o.faction) normalized.faction = o.faction;
            if (o.enemyClass) normalized.enemyClass = o.enemyClass;
            if (o.cluster) normalized.cluster = o.cluster;
        } else if (type === 'surviveCount') {
            normalized.count = Math.max(1, Math.round(o.count != null ? Number(o.count) : 5));
        } else if (type === 'surviveTime') {
            normalized.seconds = Math.max(1, Math.round(o.seconds != null ? Number(o.seconds) : 60));
        }
        return normalized;
    }

    normalizeDailies(d) {
        if (!d || typeof d !== 'object') {
            return {
                enabled: false,
                enemyType: 'enemyBasic',
                faction: null,
                enemyClass: null,
                killCountPerDay: 5,
                requiredDays: 3
            };
        }
        return {
            enabled: d.enabled !== false,
            enemyType: d.enemyType || 'enemyBasic',
            faction: d.faction || null,
            enemyClass: d.enemyClass || null,
            killCountPerDay: Math.max(1, Math.round(d.killCountPerDay != null ? Number(d.killCountPerDay) : 5)),
            requiredDays: Math.max(1, Math.round(d.requiredDays != null ? Number(d.requiredDays) : 3))
        };
    }

    normalizeStage(stage) {
        if (!stage || typeof stage !== 'object') return null;
        const enemies = Array.isArray(stage.enemies)
            ? stage.enemies.map((e, i) => this.normalizeEnemyEntry(e, i))
            : null;
        const out = {};
        if (enemies) out.enemies = enemies;
        if (stage.objective) out.objective = this.normalizeObjective(stage.objective, enemies || []);
        if (stage.theme != null && stage.theme !== '' && stage.theme !== 'inherit') {
            out.theme = String(stage.theme).toLowerCase();
        }
        return Object.keys(out).length ? out : null;
    }

    migrateLegacyEnemies(data) {
        // Explicit enemies array (including empty) wins — needed for blank planets.
        if (Array.isArray(data.enemies)) {
            return data.enemies.map((e, i) => this.normalizeEnemyEntry(e, i));
        }
        const enemies = [];
        const mainType = (data.graphics && data.graphics.enemyShip) || data.enemyType || 'fighter';
        enemies.push(this.normalizeEnemyEntry({
            id: this.nextEnemyId(data.id || 'main'),
            type: mainType,
            champion: true,
            level: 2,
            spawnAt: 0
        }, 0));
        const sides = Array.isArray(data.sideEnemies) ? data.sideEnemies : [];
        sides.forEach((s, i) => {
            enemies.push(this.normalizeEnemyEntry({
                id: this.nextEnemyId('side'),
                type: s.type || 'enemyBasic',
                champion: false,
                level: 1,
                spawnAt: (i + 1) * 8
            }, i + 1));
        });
        return enemies;
    }

    createDefaults() {
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
            }),
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
    }

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
    }

    normalizeLevelWidth(value) {
        const n = value != null ? Number(value) : this.defaultLevelWidth;
        if (!Number.isFinite(n)) return this.defaultLevelWidth;
        return Math.max(this.minLevelWidth, Math.min(this.maxLevelWidth, Math.round(n)));
    }

    normalizeLevelHeight(value) {
        const n = value != null ? Number(value) : this.defaultLevelHeight;
        if (!Number.isFinite(n)) return this.defaultLevelHeight;
        return Math.max(this.minLevelHeight, Math.min(this.maxLevelHeight, Math.round(n)));
    }

    normalizeViewZoom(value) {
        const n = value != null ? Number(value) : this.defaultViewZoom;
        if (!Number.isFinite(n)) return this.defaultViewZoom;
        return Math.max(this.minViewZoom, Math.min(this.maxViewZoom, Math.round(n * 100) / 100));
    }

    /**
     * Apply per-planet map size. Canvas bitmap = full map so the frame always
     * shows the entire level (CSS fit = automatic zoom-out). viewZoom is content
     * scale for ships/bosses/obstacles and stays fixed for the mission.
     */
    applyPlayfieldToRuntime(cfg) {
        const config = cfg || {};
        const width = this.normalizeLevelWidth(config.levelWidth);
        const height = this.normalizeLevelHeight(config.levelHeight);
        const zoom = this.normalizeViewZoom(config.viewZoom);
        const aspect = width / Math.max(1, height);
        // Fixed design reference — map size must not change UI/layout scale.
        const designW = 480;
        const designH = 600;

        if (typeof game !== 'undefined' && game && game.gameState && game.gameState.setGameDimensions) {
            game.gameState.setGameDimensions(width, height);
        } else if (typeof gameStateManager !== 'undefined' && gameStateManager.setGameDimensions) {
            gameStateManager.setGameDimensions(width, height);
        }

        if (typeof game !== 'undefined' && game) {
            game.width = width;
            game.height = height;
            game.baseWidth = width;
            game.baseHeight = height;
            game.internalWidth = width;
            game.internalHeight = height;
            // Locked for the mission — never mutated mid-game.
            game.viewZoom = zoom;
            game.contentScale = zoom;
            game.mapWidth = width;
            game.mapHeight = height;
        }

        // Resize the actual playfield canvas (full map always visible).
        // ui/render.js defines lexical `renderManager`; CoreRenderManager is on window.
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.imageSmoothingEnabled = false;
        }

        const targets = [];
        if (typeof renderManager !== 'undefined' && renderManager) targets.push(renderManager);
        if (typeof window !== 'undefined' && window.renderManager) targets.push(window.renderManager);
        if (typeof game !== 'undefined' && game && game.renderManager) targets.push(game.renderManager);
        const seen = [];
        targets.forEach((rm) => {
            if (!rm || seen.indexOf(rm) !== -1) return;
            seen.push(rm);
            if (typeof rm.setPlayfieldSize === 'function') {
                rm.setPlayfieldSize(width, height);
            } else {
                rm.width = width;
                rm.height = height;
            }
        });

        const root = document.documentElement;
        if (root && root.style) {
            root.style.setProperty('--playfield-aspect', String(Number(aspect.toFixed(6))));
            root.style.setProperty('--planet-view-zoom', String(Number(zoom.toFixed(4))));
            root.style.setProperty('--design-canvas-w', String(designW));
            root.style.setProperty('--design-canvas-h', String(designH));
            root.style.setProperty('--map-w', String(width));
            root.style.setProperty('--map-h', String(height));
        }

        if (typeof window.viewportFit !== 'undefined' && window.viewportFit.update) {
            window.viewportFit.update();
        }

        return { width, height, zoom, aspect };
    }

    getContentScale(planetId) {
        if (planetId && this.configs) {
            const cfg = this.getConfig(planetId);
            if (cfg) return this.normalizeViewZoom(cfg.viewZoom);
        }
        if (typeof game !== 'undefined' && game && game.contentScale != null) {
            return this.normalizeViewZoom(game.contentScale);
        }
        return this.defaultViewZoom;
    }

    normalizeResources(resources, planetId) {
        const allowed = (typeof economyConfig !== 'undefined')
            ? economyConfig.resourceIds
            : ['scrap', 'ore', 'crystal', 'voltex'];
        let src = Array.isArray(resources) ? resources : null;
        if ((!src || !src.length) && typeof economyConfig !== 'undefined' && planetId) {
            src = economyConfig.defaultPlanetResources[String(planetId).toLowerCase()] || null;
        }
        if (!src || !src.length) {
            return [{ id: 'scrap', weight: 1, min: 8, max: 16 }];
        }
        return src.map((r) => {
            const id = String((r && r.id) || 'scrap').toLowerCase();
            return {
                id: allowed.indexOf(id) !== -1 ? id : 'scrap',
                weight: r.weight != null ? Math.max(1, Math.round(Number(r.weight))) : 1,
                min: r.min != null ? Math.max(0, Math.round(Number(r.min))) : 1,
                max: r.max != null ? Math.max(0, Math.round(Number(r.max))) : 2
            };
        }).filter((r) => r.max >= r.min);
    }

    normalizeLayer(layer) {
        return {
            pattern: layer.pattern || 'grid',
            speed: layer.speed != null ? Number(layer.speed) : 0.3,
            opacity: layer.opacity != null ? Number(layer.opacity) : 0.15,
            scale: layer.scale != null ? Number(layer.scale) : 1,
            visible: layer.visible !== false,
            colorSource: layer.colorSource || 'primary',
            color: layer.color || null,
            height: layer.height != null ? layer.height : 300,
            y: 0
        };
    }

    getPlanetIds() {
        return Object.keys(this.configs);
    }

    uniquePlanetId(base) {
        let slug = String(base || 'planet')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        if (!slug) slug = 'planet';
        if (!this.configs[slug]) return slug;
        let n = 2;
        while (this.configs[slug + '-' + n]) n += 1;
        return slug + '-' + n;
    }

    nextBlankPlanetName(galaxyId) {
        const base = 'NEW PLANET';
        const used = new Set(
            this.getPlanetIds()
                .map(pid => this.configs[pid])
                .filter(cfg => cfg && (!galaxyId || cfg.galaxyId === galaxyId))
                .map(cfg => String(cfg.name || '').toUpperCase())
        );
        if (!used.has(base)) return base;
        let n = 2;
        while (used.has(`${base} ${n}`)) n += 1;
        return `${base} ${n}`;
    }

    placePlanetOnGalaxyMap(galaxyId, planetId) {
        const g = this.getGalaxy(galaxyId);
        if (!g || !planetId) return;
        const map = this.getGalaxyMap(galaxyId);
        const pid = String(planetId).toLowerCase();
        if ((map.nodes || []).some(n => n.planetId === pid)) return;
        const count = (map.nodes || []).length;
        const col = count % 3;
        const row = Math.floor(count / 3);
        const x = 0.2 + col * 0.3;
        const y = 0.22 + row * 0.28;
        map.nodes.push({
            planetId: pid,
            x: Math.max(0.08, Math.min(0.92, x)),
            y: Math.max(0.12, Math.min(0.88, y))
        });
        if (!map.startPlanetId) map.startPlanetId = pid;
        g.map = map;
    }

    hashSeed(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) || 1;
    }

    seededRandom(seed) {
        let s = (this.hashSeed(seed) >>> 0) || 1;
        return () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    pickSeeded(rng, arr) {
        const list = Array.isArray(arr) ? arr : [];
        if (!list.length) return null;
        return list[Math.floor(rng() * list.length)];
    }

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
        const faction = this.getGalaxyFaction(gid);
        const theme = this.getFactionPlanetTheme(faction);
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

        const enemyCount = 2 + Math.min(4, Math.floor(idx / 2));
        const enemies = [];
        for (let i = 0; i < enemyCount; i++) {
            const type = this.pickSeeded(rng, enemyPool) || 'fighter';
            enemies.push({
                id: 'gen_' + id + '_' + i,
                type: type,
                weight: 1 + Math.floor(rng() * 3),
                champion: false,
                faction: faction
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

        const healthScale = 80 + idx * 25 + Math.floor(rng() * 40);
        const speedScale = 0.85 + rng() * 0.5 + idx * 0.03;
        const resources = [
            { id: 'scrap', weight: 3, min: 10 + idx * 2, max: 22 + idx * 4 },
            { id: 'ore', weight: 2, min: 6 + idx, max: 14 + idx * 2 },
            { id: 'crystal', weight: 2, min: 4 + idx, max: 12 + idx * 2 }
        ];
        if (idx >= 3) {
            resources.push({ id: 'voltex', weight: 1, min: 3, max: 8 + idx });
        }

        const galaxyBase = (this.galaxies[gid] && this.galaxies[gid].baseColor) || theme.baseColor || null;
        const origin = opts.arrival ? 'Arrival sector' : 'Explored sector';
        const cfg = this.makePlanet({
            id: id,
            name: name,
            galaxyId: gid,
            difficulty: difficulty,
            description: origin + ' · ' + faction.toUpperCase() + ' · seed ' +
                this.hashSeed(seed).toString(16).slice(0, 6),
            factions: [faction],
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
    }

    registerPlanetGraphic(planetId) {
        if (typeof planetSVGManager === 'undefined' || !planetSVGManager.registerFromConfig) return;
        const cfg = this.configs[String(planetId || '').toLowerCase()];
        if (!cfg) return;
        planetSVGManager.registerFromConfig(cfg);
    }

    registerPlanetGraphicsForGalaxy(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return;
        (g.planetIds || []).forEach((pid) => this.registerPlanetGraphic(pid));
    }

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
    }

    addPlanet(data) {
        const blank = !!(data && data.blank);
        const name = String((data && data.name) || this.nextBlankPlanetName(data && data.galaxyId) || 'NEW PLANET').trim() || 'NEW PLANET';
        const id = (data && data.id)
            ? this.uniquePlanetId(data.id)
            : this.uniquePlanetId(name);
        let galaxyId = (data && data.galaxyId) || 'milky_way';
        if (!this.galaxies[galaxyId]) galaxyId = this.getGalaxyIds()[0] || 'milky_way';
        const seed = Object.assign({}, data || {}, {
            id: id,
            name: name,
            galaxyId: galaxyId
        });
        if (blank) {
            seed.enemies = Array.isArray(data.enemies) ? data.enemies : [];
            seed.sideEnemies = Array.isArray(data.sideEnemies) ? data.sideEnemies : [];
            seed.backgroundLayers = Array.isArray(data.backgroundLayers) ? data.backgroundLayers : [];
            seed.obstacleTypes = Array.isArray(data.obstacleTypes) ? data.obstacleTypes : [];
            seed.obstacles = Array.isArray(data.obstacles) ? data.obstacles : [];
            seed.stages = (data.stages && typeof data.stages === 'object') ? data.stages : {};
            seed.difficulty = data.difficulty || 'NORMAL';
            seed.description = data.description != null ? data.description : '';
        }
        delete seed.blank;
        const cfg = this.makePlanet(seed);
        this.configs[id] = cfg;
        this.syncGalaxyMembership();
        this.placePlanetOnGalaxyMap(galaxyId, id);
        this.save();
        this.applyToRuntime(id);
        return this.configs[id];
    }

    isBuiltinPlanet(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id) return false;
        if (!this._builtinPlanetIds) {
            this._builtinPlanetIds = new Set(Object.keys(this.createDefaults()));
        }
        return this._builtinPlanetIds.has(id);
    }

    removePlanetFromGalaxyMap(galaxyId, planetId) {
        const gid = String(galaxyId || '').toLowerCase();
        const pid = String(planetId || '').toLowerCase();
        if (!gid || !pid || !this.galaxies[gid]) return;
        const map = this.getGalaxyMap(gid);
        map.nodes = (map.nodes || []).filter(n => n.planetId !== pid);
        map.edges = (map.edges || []).filter(e =>
            e && e[0] !== pid && e[1] !== pid
        );
        if (map.startPlanetId === pid) {
            map.startPlanetId = map.nodes[0] ? map.nodes[0].planetId : null;
        }
        this.galaxies[gid].map = map;
    }

    deletePlanet(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id || !this.configs[id]) return false;
        if (this.isBuiltinPlanet(id)) return false;

        const galaxyId = (this.configs[id] && this.configs[id].galaxyId) || null;
        delete this.configs[id];
        if (galaxyId) this.removePlanetFromGalaxyMap(galaxyId, id);
        this.syncGalaxyMembership();
        this.save();
        return true;
    }

    getConfig(planetId) {
        const id = String(planetId || 'mars').toLowerCase();
        if (!this.configs[id]) {
            this.configs[id] = this.makePlanet({ id: id, name: id.toUpperCase() });
        }
        return this.configs[id];
    }

    /**
     * Resolve enemies + objective for a stage key ('1','2','3','boss').
     */
    resolveStageContent(planetId, stageKey) {
        const cfg = this.getConfig(planetId);
        const key = String(stageKey || '1');
        const stage = (cfg.stages && cfg.stages[key]) || null;
        const enemies = (stage && Array.isArray(stage.enemies) && stage.enemies.length)
            ? stage.enemies.map((e, i) => this.normalizeEnemyEntry(e, i))
            : (cfg.enemies || []).map((e, i) => this.normalizeEnemyEntry(e, i));
        const objective = this.normalizeObjective(
            (stage && stage.objective) || cfg.objective,
            enemies
        );
        return { enemies, objective, dailies: cfg.dailies };
    }

    setConfig(planetId, config) {
        const id = String(planetId).toLowerCase();
        this.configs[id] = this.makePlanet(Object.assign({}, config, { id: id }));
        this.syncGalaxyMembership();
        this.save();
        this.applyToRuntime(id);
        return this.configs[id];
    }

    updateConfig(planetId, partial) {
        const current = this.getConfig(planetId);
        return this.setConfig(planetId, Object.assign({}, current, partial, { id: planetId }));
    }

    resetPlanet(planetId) {
        const defaults = this.createDefaults();
        const id = String(planetId).toLowerCase();
        if (defaults[id]) {
            this.configs[id] = defaults[id];
            this.save();
            this.applyToRuntime(id);
        }
        return this.configs[id];
    }

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
        const current = typeof parallaxManager !== 'undefined' ? parallaxManager.currentPlanet : 'mars';
        this.applyToRuntime(current);
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('PlanetConfigManager: save failed', e);
        }
        this.saveGalaxies();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const defaults = this.createDefaults();
            Object.keys(defaults).forEach(id => {
                if (parsed[id]) {
                    this.configs[id] = this.makePlanet(Object.assign({}, defaults[id], parsed[id], { id: id }));
                }
            });
            Object.keys(parsed).forEach(id => {
                if (!this.configs[id]) {
                    this.configs[id] = this.makePlanet(Object.assign({}, parsed[id], { id: id }));
                }
            });
            this.syncGalaxyMembership();
        } catch (e) {
            console.warn('PlanetConfigManager: load failed', e);
        }
    }

    saveGalaxies() {
        try {
            const payload = {};
            Object.keys(this.galaxies).forEach(gid => {
                const g = this.galaxies[gid];
                const map = this.getGalaxyMap(gid);
                this.migrateGalaxyThemeToBaseColor(g);
                payload[gid] = {
                    id: g.id,
                    name: g.name,
                    faction: this.ensureGalaxyFaction(g),
                    baseColor: g.baseColor || null,
                    planetIds: (g.planetIds || []).slice(),
                    map: {
                        startPlanetId: map.startPlanetId,
                        nodes: (map.nodes || []).map(n => ({
                            planetId: n.planetId,
                            x: n.x,
                            y: n.y
                        })),
                        edges: (map.edges || []).map(e => [e[0], e[1]])
                    }
                };
            });
            localStorage.setItem(this.galaxyStorageKey, JSON.stringify(payload));
        } catch (e) {
            console.warn('PlanetConfigManager: saveGalaxies failed', e);
        }
    }

    loadGalaxies() {
        try {
            const raw = localStorage.getItem(this.galaxyStorageKey);
            if (!raw) {
                this.syncGalaxyMembership();
                Object.keys(this.galaxies).forEach(gid => {
                    this.ensureGalaxyFaction(this.galaxies[gid]);
                    if (!this.galaxies[gid].map) {
                        this.galaxies[gid].map = this.createDefaultGalaxyMap(gid);
                    }
                });
                return;
            }
            const parsed = JSON.parse(raw);
            Object.keys(parsed).forEach(gid => {
                const src = parsed[gid] || {};
                if (!this.galaxies[gid]) {
                    this.galaxies[gid] = this.migrateGalaxyThemeToBaseColor({
                        id: gid,
                        name: src.name || gid.toUpperCase(),
                        faction: src.faction || null,
                        baseColor: src.baseColor || null,
                        theme: src.theme || null,
                        planetIds: [],
                        map: this.normalizeGalaxyMap(gid, src.map)
                    });
                } else {
                    if (src.name) this.galaxies[gid].name = src.name;
                    if (src.faction !== undefined) {
                        this.galaxies[gid].faction = src.faction;
                    }
                    if (src.baseColor !== undefined) {
                        this.galaxies[gid].baseColor = this.normalizeGalaxyBaseColor(src.baseColor);
                        delete this.galaxies[gid].theme;
                    } else if (src.theme !== undefined) {
                        this.galaxies[gid].theme = src.theme || null;
                        this.migrateGalaxyThemeToBaseColor(this.galaxies[gid]);
                    }
                    if (src.map) {
                        this.galaxies[gid].map = this.normalizeGalaxyMap(gid, src.map);
                    } else if (!this.galaxies[gid].map) {
                        this.galaxies[gid].map = this.createDefaultGalaxyMap(gid);
                    }
                }
            });
            Object.keys(this.galaxies).forEach(gid => {
                this.migrateGalaxyThemeToBaseColor(this.galaxies[gid]);
                this.ensureGalaxyFaction(this.galaxies[gid]);
                // Migrate legacy Andromeda neon placeholder to Kronax theme color
                if (
                    gid === 'andromeda' &&
                    this.galaxies[gid].faction === 'kronax' &&
                    this.normalizeGalaxyBaseColor(this.galaxies[gid].baseColor) === '#00FF00'
                ) {
                    const theme = this.getFactionPlanetTheme('kronax');
                    this.galaxies[gid].baseColor = this.normalizeGalaxyBaseColor(theme.baseColor);
                }
                if (!this.galaxies[gid].map) {
                    this.galaxies[gid].map = this.createDefaultGalaxyMap(gid);
                }
            });
            this.syncGalaxyMembership();
            Object.keys(this.galaxies).forEach((gid) => this.registerPlanetGraphicsForGalaxy(gid));
        } catch (e) {
            console.warn('PlanetConfigManager: loadGalaxies failed', e);
        }
    }

    setGalaxyBaseColor(galaxyId, baseColor, options) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return null;
        g.baseColor = this.normalizeGalaxyBaseColor(baseColor);
        delete g.theme;
        const persist = !options || options.persist !== false;
        if (persist) this.saveGalaxies();
        return g;
    }

    setGalaxyTheme(galaxyId, themeId) {
        return this.setGalaxyBaseColor(galaxyId, this.themeIdToBaseColor(themeId));
    }

    syncGalaxyMembership() {
        Object.keys(this.galaxies).forEach(gid => {
            this.galaxies[gid].planetIds = [];
        });
        this.getPlanetIds().forEach(pid => {
            const cfg = this.configs[pid];
            let gid = (cfg && cfg.galaxyId) || 'milky_way';
            if (!this.galaxies[gid]) gid = this.getGalaxyIds()[0];
            if (!gid || !this.galaxies[gid]) return;
            if (this.galaxies[gid].planetIds.indexOf(pid) === -1) {
                this.galaxies[gid].planetIds.push(pid);
            }
            cfg.galaxyId = gid;
        });
    }

    resolveLayerColor(layer) {
        const root = document.documentElement;
        const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
        switch (layer.colorSource) {
            case 'secondary':
                return css('--current-secondary') || '#606060';
            case 'accent':
                return css('--current-accent') || '#808080';
            case 'custom':
                return layer.color || css('--current-primary') || '#808080';
            case 'primary':
            default:
                return css('--current-primary') || '#808080';
        }
    }

    getResolvedLayers(planetId) {
        const cfg = this.getConfig(planetId);
        return cfg.backgroundLayers.map(layer => {
            const resolved = this.normalizeLayer(layer);
            resolved.color = this.resolveLayerColor(resolved);
            return resolved;
        });
    }

    applyToRuntime(planetId) {
        const cfg = this.getConfig(planetId);

        this.applyPlayfieldToRuntime(cfg);

        if (typeof parallaxManager !== 'undefined' && parallaxManager.applyPlanetConfig) {
            parallaxManager.applyPlanetConfig(cfg);
        } else if (typeof parallaxManager !== 'undefined') {
            parallaxManager.setBackground(cfg.id);
        }

        if (typeof obstacleManager !== 'undefined') {
            if (obstacleManager.setObstacleDefs) {
                obstacleManager.setObstacleDefs(cfg.obstacles || []);
            } else if (obstacleManager.setAllowedTypes) {
                obstacleManager.setAllowedTypes(cfg.obstacleTypes);
            }
        }

        if (typeof enemyManager !== 'undefined') {
            if (enemyManager.setEnemySchedule) {
                enemyManager.setEnemySchedule(cfg.enemies || []);
            } else if (enemyManager.setSideEnemyPool) {
                const nonChampions = (cfg.enemies || []).filter(e => !e.champion);
                enemyManager.setSideEnemyPool(nonChampions.map(e => ({
                    type: e.type,
                    weight: 1,
                    chance: 0.2
                })));
            }
            const champion = (cfg.enemies || []).find(e => e.champion);
            const ship = champion
                ? champion.type
                : ((cfg.graphics && cfg.graphics.enemyShip) || cfg.enemyType);
            if (typeof graphicsManager !== 'undefined' && graphicsManager.setEnemyShipType) {
                graphicsManager.setEnemyShipType(ship);
            }
        }

        return cfg;
    }

    exportJSON(planetId) {
        return JSON.stringify(this.getConfig(planetId), null, 2);
    }

    importJSON(planetId, jsonText) {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        return this.setConfig(planetId, data);
    }

    isBuiltinPattern(id) {
        return this.availablePatterns.indexOf(id) !== -1;
    }

    hasCustomPattern(id) {
        return !!(id && this.customPatterns[id]);
    }

    getCustomPattern(id) {
        return this.customPatterns[id] || null;
    }

    normalizePatternDef(id, data) {
        const width = Math.max(4, Math.min(64, Number(data && data.width) || this.defaultTileSize));
        const height = Math.max(4, Math.min(64, Number(data && data.height) || this.defaultTileSize));
        const cellSize = Math.max(1, Math.min(16, Number(data && data.cellSize) || this.defaultCellSize));
        const expected = width * height;
        let cells = Array.isArray(data && data.cells) ? data.cells.map(v => v ? 1 : 0) : [];
        if (cells.length < expected) {
            cells = cells.concat(new Array(expected - cells.length).fill(0));
        } else if (cells.length > expected) {
            cells = cells.slice(0, expected);
        }
        return {
            id: String(id),
            name: (data && data.name) ? String(data.name) : String(id),
            width,
            height,
            cellSize,
            cells
        };
    }

    createBlankPattern(id, name) {
        const width = this.defaultTileSize;
        const height = this.defaultTileSize;
        return this.normalizePatternDef(id, {
            name: name || id,
            width,
            height,
            cellSize: this.defaultCellSize,
            cells: new Array(width * height).fill(0)
        });
    }

    setCustomPattern(id, data) {
        const key = String(id || '').trim();
        if (!key) return null;
        this.customPatterns[key] = this.normalizePatternDef(key, data);
        this.savePatterns();
        return this.customPatterns[key];
    }

    deleteCustomPattern(id) {
        const key = String(id);
        if (!this.customPatterns[key]) return false;
        delete this.customPatterns[key];
        this.savePatterns();
        return true;
    }

    nextCustomPatternId() {
        let n = 1;
        while (this.customPatterns['custom_' + n] || this.isBuiltinPattern('custom_' + n)) n++;
        return 'custom_' + n;
    }

    getAllPatternIds() {
        const ids = this.availablePatterns.slice();
        Object.keys(this.customPatterns).forEach(id => {
            if (ids.indexOf(id) === -1) ids.push(id);
        });
        return ids;
    }

    savePatterns() {
        try {
            localStorage.setItem(this.patternStorageKey, JSON.stringify(this.customPatterns));
        } catch (e) {
            console.warn('PlanetConfigManager: pattern save failed', e);
        }
    }

    loadPatterns() {
        try {
            const raw = localStorage.getItem(this.patternStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            Object.keys(parsed).forEach(id => {
                this.customPatterns[id] = this.normalizePatternDef(id, parsed[id]);
            });
        } catch (e) {
            console.warn('PlanetConfigManager: pattern load failed', e);
        }
    }
}

const planetConfigManager = new PlanetConfigManager();
