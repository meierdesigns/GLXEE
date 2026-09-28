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
            // Backing store is supersampled (see renderManager.getRenderScale).
            const k = (typeof renderManager !== 'undefined' && renderManager.getRenderScale)
                ? renderManager.getRenderScale() : 1;
            if (canvas.width !== width * k) canvas.width = width * k;
            if (canvas.height !== height * k) canvas.height = height * k;
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
        // Organic spot: best of 40 seeded random tries (furthest from every
        // other planet) — no tidy 3-column grid.
        const spot = this.pickOrganicMapSpot(map.nodes || [], 'place|' + galaxyId + '|' + pid);
        map.nodes.push({ planetId: pid, x: spot.x, y: spot.y });
        if (!map.startPlanetId) map.startPlanetId = pid;
        g.map = map;
    },

    /** Spot for a new map node: seeded random tries, furthest from `others`. */
    pickOrganicMapSpot(others, seedKey) {
        const rng = this.seededRandom(seedKey);
        let best = { x: 0.5, y: 0.5 };
        let bestScore = -1;
        for (let i = 0; i < 40; i++) {
            const x = 0.1 + rng() * 0.8;
            const y = 0.12 + rng() * 0.76;
            let score = others.length ? Infinity : 1 - Math.hypot(x - 0.5, y - 0.5);
            others.forEach((o) => { score = Math.min(score, Math.hypot((o.x - x) * 2.4, o.y - y)); });
            if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
        }
        return { x: Math.round(best.x * 1000) / 1000, y: Math.round(best.y * 1000) / 1000 };
    },

    /**
     * Maps laid out on the old 3-column grid (most nodes exactly on its
     * points) are re-scattered once, with fresh links: a nearest-neighbour
     * spanning tree plus a few extra short lanes. Hand-built maps untouched.
     */
    relayoutGridGalaxyMap(galaxyId, map) {
        const nodes = map.nodes || [];
        if (galaxyId === 'milky_way' || nodes.length < 3) return false;
        const onGrid = (n) => [0.2, 0.5, 0.8].some((gx) => Math.abs(n.x - gx) < 0.002)
            && Array.from({ length: 4 }, (_, r) => Math.min(0.88, 0.22 + r * 0.28))
                .some((gy) => Math.abs(n.y - gy) < 0.002);
        if (nodes.filter(onGrid).length < Math.ceil(nodes.length * 0.6)) return false;
        const placed = [];
        nodes.forEach((n) => {
            const spot = this.pickOrganicMapSpot(placed, 'relayout|' + galaxyId + '|' + n.planetId);
            n.x = spot.x;
            n.y = spot.y;
            placed.push(n);
        });
        const d = (a, b) => Math.hypot((a.x - b.x) * 2.4, a.y - b.y);
        const edges = [];
        const inTree = [nodes[0]];
        while (inTree.length < nodes.length) {
            let best = null;
            inTree.forEach((a) => nodes.forEach((b) => {
                if (inTree.indexOf(b) !== -1) return;
                const dist = d(a, b);
                if (!best || dist < best.dist) best = { a: a, b: b, dist: dist };
            }));
            edges.push([best.a.planetId, best.b.planetId]);
            inTree.push(best.b);
        }
        // A few extra short lanes so there are loops, not just a tree.
        const has = (a, b) => edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
        const pairs = [];
        nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { if (!has(a.planetId, b.planetId)) pairs.push({ a, b, dist: d(a, b) }); }));
        pairs.sort((p, q) => p.dist - q.dist).slice(0, Math.max(1, Math.floor(nodes.length / 3)))
            .forEach((p) => edges.push([p.a.planetId, p.b.planetId]));
        map.edges = edges;
        return true;
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
