"use strict";

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
});
