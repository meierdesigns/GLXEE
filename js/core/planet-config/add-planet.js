"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
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
    },

    isBuiltinPlanet(planetId) {
        const id = String(planetId || '').toLowerCase();
        if (!id) return false;
        if (!this._builtinPlanetIds) {
            this._builtinPlanetIds = new Set(Object.keys(this.createDefaults()));
        }
        return this._builtinPlanetIds.has(id);
    },

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
    },

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
    },

    getConfig(planetId) {
        const id = String(planetId || 'mars').toLowerCase();
        if (!this.configs[id]) {
            this.configs[id] = this.makePlanet({ id: id, name: id.toUpperCase() });
        }
        return this.configs[id];
    },

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
    },

    setConfig(planetId, config) {
        const id = String(planetId).toLowerCase();
        this.configs[id] = this.makePlanet(Object.assign({}, config, { id: id }));
        this.syncGalaxyMembership();
        this.save();
        this.applyToRuntime(id);
        return this.configs[id];
    },

    updateConfig(planetId, partial) {
        const current = this.getConfig(planetId);
        return this.setConfig(planetId, Object.assign({}, current, partial, { id: planetId }));
    },

    resetPlanet(planetId) {
        const defaults = this.createDefaults();
        const id = String(planetId).toLowerCase();
        if (defaults[id]) {
            this.configs[id] = defaults[id];
            this.save();
            this.applyToRuntime(id);
        }
        return this.configs[id];
    },

    resetAll() {
        this.configs = this.createDefaults();
        this.save();
        const current = typeof parallaxManager !== 'undefined' ? parallaxManager.currentPlanet : 'mars';
        this.applyToRuntime(current);
    },

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.configs));
        } catch (e) {
            console.warn('PlanetConfigManager: save failed', e);
        }
        this.saveGalaxies();
    },

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
    },

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
    },

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
    },

    setGalaxyBaseColor(galaxyId, baseColor, options) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return null;
        g.baseColor = this.normalizeGalaxyBaseColor(baseColor);
        delete g.theme;
        const persist = !options || options.persist !== false;
        if (persist) this.saveGalaxies();
        return g;
    },

    setGalaxyTheme(galaxyId, themeId) {
        return this.setGalaxyBaseColor(galaxyId, this.themeIdToBaseColor(themeId));
    },
});
