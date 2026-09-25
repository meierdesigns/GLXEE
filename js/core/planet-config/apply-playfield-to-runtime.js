"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
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
    },

    getContentScale(planetId) {
        if (planetId && this.configs) {
            const cfg = this.getConfig(planetId);
            if (cfg) return this.normalizeViewZoom(cfg.viewZoom);
        }
        if (typeof game !== 'undefined' && game && game.contentScale != null) {
            return this.normalizeViewZoom(game.contentScale);
        }
        return this.defaultViewZoom;
    },

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
    },

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
    },

    getPlanetIds() {
        return Object.keys(this.configs);
    },

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
    },

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
    },

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
    },

    hashSeed(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0) || 1;
    },

    seededRandom(seed) {
        let s = (this.hashSeed(seed) >>> 0) || 1;
        return () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    },

    pickSeeded(rng, arr) {
        const list = Array.isArray(arr) ? arr : [];
        if (!list.length) return null;
        return list[Math.floor(rng() * list.length)];
    },
});
