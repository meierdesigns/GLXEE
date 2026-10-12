"use strict";

// Planet graphic style -> combat ground: surface treatment, preferred floor
// patterns, wall materials, which flight areas show up (weights) and how wide
// the walls are (see drawScrollTerrain / terrainProfile).
// Extra flight areas by planet theme and by holding faction (added on top).
const THEME_ZONES = {
    fire: { spires: 2, chasm: 2 },
    ocean: { reef: 2, delta: 2 },
    purple: { spires: 2, ribs: 2 },
    sunset: { chasm: 2, ruins: 2 },
    retro: { pipes: 2, ruins: 2 }
};
const FACTION_ZONES = {
    pirate: { ruins: 1, pipes: 1 },
    terran: { terraces: 1, pipes: 1 },
    kronax: { spires: 1, teeth: 1 },
    machine: { pipes: 1, ribs: 1 },
    voidborn: { reef: 1, ribs: 1 }
};

const PLANET_LOOK_ENV = {
    lava: { surface: 'lava', floors: ['cracks', 'veins', 'rubble'], mats: ['magma', 'rock'], zones: { teeth: 3, narrows: 2, gorge: 2, zigzag: 1, chasm: 2 }, width: 1.25 },
    cracked: { surface: 'lava', floors: ['cracks', 'plates', 'rubble'], mats: ['rock', 'magma'], zones: { teeth: 2, canyon: 2, terraces: 2, chasm: 2 } },
    glacial: { surface: 'ice', floors: ['plates', 'cracks', 'hex'], mats: ['crystal', 'rock'], zones: { open: 3, winding: 2, bulges: 2, icefall: 3 } },
    oceanic: { surface: 'ice', floors: ['dunes', 'plates', 'ridges'], mats: ['crystal', 'rock'], zones: { open: 4, bulges: 2, reef: 2, delta: 2 }, width: 0.7 },
    crystal: { surface: 'void', floors: ['plates', 'grid', 'hex'], mats: ['crystal'], zones: { teeth: 3, narrows: 1, zigzag: 3, spires: 3 }, width: 1.2 },
    toxic: { surface: 'toxic', floors: ['cracks', 'craters', 'veins'], mats: ['crystal', 'rock'], zones: { narrows: 3, winding: 2, funnel: 2, gorge: 1, reef: 2 }, width: 1.3 },
    dunes: { surface: 'banded', floors: ['dunes', 'ridges'], mats: ['rock'], zones: { winding: 3, open: 2, bulges: 1, delta: 2 }, width: 0.9 },
    craters: { surface: 'plain', floors: ['craters', 'rubble'], mats: ['rock', 'metal'], zones: { canyon: 3, open: 1, terraces: 2, ruins: 2 } },
    pocked: { surface: 'plain', floors: ['craters', 'cracks', 'rubble'], mats: ['rock'], zones: { canyon: 2, teeth: 2, bulges: 2, ruins: 1 }, width: 1.1 },
    continents: { surface: 'plain', floors: ['plates', 'craters', 'ridges'], mats: ['rock', 'metal'], zones: { canyon: 2, winding: 2, terraces: 2, delta: 1 } },
    spotted: { surface: 'plain', floors: ['craters', 'dunes', 'rubble'], mats: ['rock', 'crystal'], zones: { open: 2, canyon: 2, bulges: 2, reef: 1 } },
    banded: { surface: 'banded', floors: ['dunes', 'grid', 'ridges'], mats: ['metal', 'crystal'], zones: { open: 3, winding: 1, funnel: 2, ribs: 2 }, width: 0.8 },
    striped: { surface: 'banded', floors: ['dunes', 'grid', 'ridges'], mats: ['metal'], zones: { winding: 3, zigzag: 2, ribs: 2 } },
    swirl: { surface: 'banded', floors: ['dunes', 'plates', 'veins'], mats: ['metal', 'crystal'], zones: { winding: 3, open: 1, funnel: 2, delta: 2 } },
    cloudy: { surface: 'banded', floors: ['dunes', 'ridges'], mats: ['metal', 'crystal'], zones: { open: 4, funnel: 1, delta: 2 }, width: 0.7 },
    marbled: { surface: 'plain', floors: ['plates', 'dunes', 'veins'], mats: ['crystal', 'metal'], zones: { winding: 2, narrows: 2, zigzag: 1, reef: 2 } },
    ringed: { surface: 'banded', floors: ['grid', 'dunes', 'hex'], mats: ['metal', 'crystal'], zones: { open: 2, narrows: 2, terraces: 2, gorge: 1, pipes: 3 } }
};

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    syncGalaxyMembership() {
        Object.keys(this.galaxies).forEach(gid => {
            this.galaxies[gid].planetIds = [];
        });
        this.getPlanetIds().forEach(pid => {
            const cfg = this.configs[pid];
            // Ambush sectors are transient combat spaces, not galaxy planets.
            if (cfg && cfg.encounter) return;
            let gid = (cfg && cfg.galaxyId) || 'milky_way';
            if (!this.galaxies[gid]) gid = this.getGalaxyIds()[0];
            if (!gid || !this.galaxies[gid]) return;
            if (this.galaxies[gid].planetIds.indexOf(pid) === -1) {
                this.galaxies[gid].planetIds.push(pid);
            }
            cfg.galaxyId = gid;
        });
    },

    resolveLayerColor(layer) {
        const root = document.documentElement;
        const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
        switch (layer.colorSource) {
            case 'secondary':
                return (css('--env-secondary') || css('--current-secondary')) || '#606060';
            case 'accent':
                return (css('--env-accent') || css('--current-accent')) || '#808080';
            case 'custom':
                return layer.color || (css('--env-primary') || css('--current-primary')) || '#808080';
            case 'primary':
            default:
                return (css('--env-primary') || css('--current-primary')) || '#808080';
        }
    },

    getResolvedLayers(planetId) {
        const cfg = this.getConfig(planetId);
        return cfg.backgroundLayers.map(layer => {
            const resolved = this.normalizeLayer(layer);
            resolved.color = this.resolveLayerColor(resolved);
            return resolved;
        });
    },

    applyToRuntime(planetId) {
        const cfg = this.getConfig(planetId);

        this.applyPlayfieldToRuntime(cfg);

        if (typeof parallaxManager !== 'undefined' && parallaxManager.applyPlanetConfig) {
            parallaxManager.applyPlanetConfig(cfg);
        } else if (typeof parallaxManager !== 'undefined') {
            parallaxManager.setBackground(cfg.id);
        }

        if (typeof obstacleManager !== 'undefined') {
            if (obstacleManager.setEnvironment) {
                obstacleManager.setEnvironment(this.getPlanetEnvironment(planetId, cfg));
            }
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
    },

    exportJSON(planetId) {
        return JSON.stringify(this.getConfig(planetId), null, 2);
    },

    importJSON(planetId, jsonText) {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        return this.setConfig(planetId, data);
    },

    isBuiltinPattern(id) {
        return this.availablePatterns.indexOf(id) !== -1;
    },

    hasCustomPattern(id) {
        return !!(id && this.customPatterns[id]);
    },

    getCustomPattern(id) {
        return this.customPatterns[id] || null;
    },

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
    },

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
    },

    setCustomPattern(id, data) {
        const key = String(id || '').trim();
        if (!key) return null;
        this.customPatterns[key] = this.normalizePatternDef(key, data);
        this.savePatterns();
        return this.customPatterns[key];
    },

    deleteCustomPattern(id) {
        const key = String(id);
        if (!this.customPatterns[key]) return false;
        delete this.customPatterns[key];
        this.savePatterns();
        return true;
    },

    nextCustomPatternId() {
        let n = 1;
        while (this.customPatterns['custom_' + n] || this.isBuiltinPattern('custom_' + n)) n++;
        return 'custom_' + n;
    },

    getAllPatternIds() {
        const ids = this.availablePatterns.slice();
        Object.keys(this.customPatterns).forEach(id => {
            if (ids.indexOf(id) === -1) ids.push(id);
        });
        return ids;
    },

    savePatterns() {
        try {
            localStorage.setItem(this.patternStorageKey, JSON.stringify(this.customPatterns));
        } catch (e) {
            console.warn('PlanetConfigManager: pattern save failed', e);
        }
    },

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
    },

    /**
     * Look of a planet's combat environment: obstacles take the planet's
     * colour, while the faction that holds it decides their shape, the side
     * terrain's structures and the accent lights.
     */
    getPlanetEnvironment(planetId, cfg) {
        const c = cfg || this.getConfig(planetId) || {};
        const hostile = (this.getHostileFactions ? this.getHostileFactions(planetId) : []) || [];
        const all = (c.factions || []).map((f) => String(f).toLowerCase());
        const faction = String(hostile[0] || all[0] || 'pirate').toLowerCase();
        const second = String(hostile[1] || all.find((f) => f !== faction) || '').toLowerCase();
        const theme = this.getFactionPlanetTheme ? this.getFactionPlanetTheme(faction) : {};
        const galaxy = c.galaxyId && this.getGalaxy ? this.getGalaxy(c.galaxyId) : null;
        const styleOf = { terran: 'asteroid', pirate: 'scrap', kronax: 'spike', machine: 'tech', voidborn: 'organic' };
        const style = styleOf[faction] || 'asteroid';
        // Shape mix: mostly the holding faction, some of its rival, the rest
        // plain planet rock — so a level never shows one repeated obstacle.
        const styles = [];
        const addStyle = (id, weight) => {
            const hit = styles.find((e) => e.id === id);
            if (hit) hit.weight += weight;
            else styles.push({ id: id, weight: weight });
        };
        addStyle(style, 5);
        addStyle('asteroid', 3);
        if (second && styleOf[second]) addStyle(styleOf[second], 2);
        // Material inclusions follow what the planet yields.
        const resources = (c.resources || []).map((r) => ({ id: String(r.id || 'scrap'), weight: Math.max(1, r.weight || 1) }));
        // Surface treatment from the planet theme (explored planets inherit
        // the faction's palette theme).
        const surfaceOf = { fire: 'lava', ocean: 'ice', purple: 'void', sunset: 'banded', retro: 'banded' };
        const graphics = c.graphics || {};
        // The planet's own artwork (lava world, ice ball, gas giant…) shapes
        // the ground: surface treatment, floor patterns and wall materials.
        const look = this.getPlanetLook(planetId || c.id);
        const lookEnv = PLANET_LOOK_ENV[look.style] || null;
        return {
            planetId: String(planetId || c.id || ''),
            faction: faction,
            planetStyle: look.style,
            floors: lookEnv ? lookEnv.floors : null,
            materials: lookEnv ? lookEnv.mats : null,
            zones: this.mergeZoneWeights(lookEnv && lookEnv.zones,
                THEME_ZONES[String(c.theme || theme.theme || '').toLowerCase()], FACTION_ZONES[faction]),
            width: lookEnv ? lookEnv.width : null,
            base: look.baseColor || c.baseColor || (galaxy && galaxy.baseColor) || theme.baseColor || '#7a7f88',
            accent: theme.baseColor || '#8B6914',
            style: style,
            styles: graphics.obstacleStyle === 'asteroid' && !c.factions ? [{ id: 'asteroid', weight: 1 }] : styles,
            resources: resources.length ? resources : [{ id: 'scrap', weight: 1 }],
            surface: (lookEnv && lookEnv.surface) || surfaceOf[String(c.theme || '').toLowerCase()] || 'plain'
        };
    },

    /** Sum area weights from several sources (null if none). */
    mergeZoneWeights(...sources) {
        const out = {};
        sources.forEach((src) => Object.keys(src || {}).forEach((z) => { out[z] = (out[z] || 0) + src[z]; }));
        return Object.keys(out).length ? out : null;
    },

    /** Style + colour the planet graphic was drawn with ({} if unknown). */
    getPlanetLook(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id || typeof planetSVGManager === 'undefined') return {};
        try {
            if (!planetSVGManager.planetSpecs || !planetSVGManager.planetSpecs[id]) planetSVGManager.getPlanetSVG(id);
        } catch (e) { return {}; }
        const spec = planetSVGManager.planetSpecs && planetSVGManager.planetSpecs[id];
        return spec ? { style: spec.style, baseColor: spec.baseColor } : {};
    },
});
