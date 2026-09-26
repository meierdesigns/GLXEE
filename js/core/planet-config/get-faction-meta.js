"use strict";

// PlanetConfigManager methods, split from planet-config.js.
extendClass(PlanetConfigManager, {
    /**
     * Display meta + lore blurb per faction.
     */
    getFactionMeta(factionId) {
        const id = String(factionId || '').toLowerCase();
        const metas = {
            terran: {
                id: 'terran',
                label: 'TERRAN',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'ADA VOSS',
                    title: 'Commodore of the Concord Escort Wing',
                    lore: 'Ada Voss never lost a freighter she was assigned to. She flies the lanes her own charts made safe, and every Terran pilot learns her rule before their first launch: the convoy comes home, or you do not.'
                },
                icon: 'factionTerran',
                homeGalaxy: 'milky_way',
                traits: ['Engineers', 'Colony fleets', 'Safe lanes'],
                lore: 'Sol-born colonists and fleet crews. Pragmatic engineers who chart safe lanes and hold the Milky Way home stations.',
                loreLong: 'The Terran Concord grew from Sol’s outbound colonies into the backbone of the Milky Way. Their stations are modular, their warp charts obsessively annotated, and their fleets built to escort freighters as often as to fight. Diplomacy is a tool; scrap is a resource; a cleared lane is worth more than a glorious wreck.'
            },
            kronax: {
                id: 'kronax',
                label: 'KRONAX',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'SKARR VELKHAR',
                    title: 'Clawmaster of the Ash Belt',
                    lore: 'Skarr Velkhar carries forty interception scars and refuses to let a medic close a single one. He took the Clawmaster banner in a war-season ambush and has not handed it back since; the packs follow the loudest engines, and his are the loudest.'
                },
                icon: 'factionKronax',
                homeGalaxy: 'andromeda',
                traits: ['Raiders', 'Spike hulls', 'Ambush doctrine'],
                lore: 'Claw-forged raiders of Andromeda. Honor is won in ambush runs; their spike hulls favor speed over mercy.',
                loreLong: 'Kronax packs measure worth in scars and interception kills. Andromeda’s ash belts forged claw-shaped hulls that punch first and argue later. Clan banners shift after every war-season, but the doctrine never does: strike the supply line, claim the wreck, leave the survivors to tell the story.'
            },
            voidborn: {
                id: 'voidborn',
                label: 'VOIDBORN',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'ECHO SIX',
                    title: 'The Voice Between Folds',
                    lore: 'Echo Six is the only Voidborn who has ever answered a hail. Nobody knows if the name is a rank, a count, or a joke. When the rings open and a single silent hull slips through first, archivists log it simply as: Six was here.'
                },
                icon: 'factionVoidborn',
                homeGalaxy: 'void_reach',
                traits: ['Fold-space', 'Silent fleets', 'Cold rings'],
                lore: 'Echoes from the dark between stars. They speak little, fold space like cloth, and leave cold rings where planets used to warm.',
                loreLong: 'Voidborn contacts rarely begin with words. Sensors dim, compass needles spin, and a ring of pale light opens where empty space should be. Their ships look unfinished to Terran eyes — until the void folds and the engagement is already over. Archivists call them echoes; pilots just call them gone.'
            },
            pirate: {
                id: 'pirate',
                label: 'PIRATE',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'MAGPIE RENN',
                    title: 'Captain of the Black Dock',
                    lore: 'Magpie Renn has survived eleven mutinies by starting nine of them. Her hull is welded from the wrecks of everyone who crossed her, and the Scrap Belt knows the sign: a shine of stolen chrome, then nothing where your cargo used to be.'
                },
                icon: 'factionPirate',
                homeGalaxy: 'scrap_belt',
                traits: ['Salvage kings', 'Black docks', 'No lasting banner'],
                lore: 'Scrap-belt freebooters and wreck-yard kings. No banner lasts long — only salvage, black docks, and the next score.',
                loreLong: 'The Scrap Belt has no capital and no constitution — only docks welded from dead freighters and captains who last until the next mutiny. Pirate “fleets” are coalitions of convenience: share the loot code, share the jump window, vanish before Concord patrols arrive. Every hull is a resume written in burn marks.'
            },
            machine: {
                id: 'machine',
                label: 'MACHINE',
                // The faction's hero: the default pilot name for new profiles.
                hero: {
                    name: 'NODE ZERO',
                    title: 'First Forge of the Synth Grid',
                    lore: 'Node Zero is the hull the Collective copies when a copy must not fail. It keeps no memory it cannot use and no loyalty it cannot compute — yet every Machine war-line routes its first signal through Node Zero before it moves.'
                },
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
        if (!meta.hero) meta.hero = { name: 'PILOT', title: '', lore: '' };
        return meta;
    },

    getFactionList() {
        return (this.availableFactions || []).map((id) => this.getFactionMeta(id));
    },

    getFactionIconKey(factionId) {
        return this.getFactionMeta(factionId).icon;
    },

    getFactionLore(factionId) {
        return this.getFactionMeta(factionId).lore;
    },

    normalizeGalaxyFaction(value) {
        const id = String(value || '').toLowerCase().trim();
        if (this.availableFactions.indexOf(id) !== -1) return id;
        return null;
    },

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
    },

    getGalaxyFaction(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return 'pirate';
        return this.ensureGalaxyFaction(g);
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    getGalaxyMap(galaxyId) {
        const g = this.getGalaxy(galaxyId);
        if (!g) return this.createDefaultGalaxyMap(galaxyId);
        if (!g.map) {
            g.map = this.normalizeGalaxyMap(g.id, null);
        } else {
            g.map = this.normalizeGalaxyMap(g.id, g.map);
        }
        return g.map;
    },

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
    },

    getGalaxyIds() {
        return Object.keys(this.galaxies);
    },

    getGalaxy(galaxyId) {
        const id = String(galaxyId || '').toLowerCase();
        return this.galaxies[id] || null;
    },

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
    },

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
    },
});
